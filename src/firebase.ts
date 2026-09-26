import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(
  app,
  firebaseConfig.storageBucket
    ? `gs://${firebaseConfig.storageBucket}`
    : undefined
);

// Reduz o tempo máximo de retentativa do SDK (padrão é 10 minutos / 600.000ms),
// evitando que erros de bucket não inicializado ou permissão fiquem travados em 0%.
storage.maxUploadRetryTime = 15000;
storage.maxOperationRetryTime = 15000;

export const googleProvider = new GoogleAuthProvider();

export interface BookPdfMetadata {
  pdfUrl: string;
  pdfPath: string;
  pdfFileName: string;
  pdfSize: number;
  pdfUpdatedAt: string;
}

export function formatPdfFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Remove recursivamente quaisquer propriedades com valor `undefined` antes de salvar no Firestore,
 * evitando o erro "Unsupported field value: undefined" que impedia a gravação para todos os usuários.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) {
        cleaned[k] = stripUndefined(v);
      }
    });
    return cleaned as T;
  }
  return value;
}

/**
 * Faz o upload ou substituição do arquivo PDF do livro no Firebase Storage.
 * Caminho obrigatório: books/{bookId}/book.pdf
 */
export async function uploadBookPdfToStorage(
  bookId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<BookPdfMetadata> {
  console.log('[PDF Upload - 1/6] Iniciando processo de upload...', {
    bookId,
    fileExists: Boolean(file),
    isFileInstance: file instanceof File,
    fileName: file?.name,
    fileSize: file?.size,
    fileType: file?.type,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    currentUserUid: auth.currentUser?.uid || null,
    currentUserEmail: auth.currentUser?.email || null,
  });

  if (!file || !(file instanceof File) || file.size === 0) {
    throw new Error('O arquivo selecionado é inválido ou está vazio.');
  }

  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    throw new Error('Formato inválido. Envie apenas arquivos PDF (.pdf).');
  }

  if (!auth.currentUser) {
    throw new Error(
      'Usuário não autenticado (storage/unauthenticated). Faça login com sua conta de administrador antes de enviar o PDF.'
    );
  }

  // Verificação rápida do bucket no Firebase Storage para diagnosticar imediatamente
  // caso o Firebase Storage ainda não tenha sido ativado no Firebase Console (HTTP 404).
  const bucketName = firebaseConfig.storageBucket;
  if (bucketName) {
    try {
      console.log(
        `[PDF Upload - 2/6] Verificando disponibilidade do bucket "${bucketName}"...`
      );
      const bucketCheckUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
        bucketName
      )}/o?maxResults=1`;
      const checkResp = await fetch(bucketCheckUrl, { method: 'GET' });
      console.log(
        `[PDF Upload - 2/6] Resposta HTTP do bucket "${bucketName}": status ${checkResp.status}`
      );

      if (checkResp.status === 404) {
        const errBody = await checkResp.text().catch(() => '');
        console.error(
          '[PDF Upload - ERRO CRÍTICO] O bucket do Firebase Storage retornou 404 Not Found:',
          errBody
        );
        throw new Error(
          `O Firebase Storage ainda não está habilitado no Firebase Console para o projeto "${firebaseConfig.projectId}" (o bucket "${bucketName}" retornou 404 Not Found). Acesse https://console.firebase.google.com/project/${firebaseConfig.projectId}/storage e clique em "Começar / Get Started" para ativar o Storage.`
        );
      }
    } catch (checkErr) {
      if (
        checkErr instanceof Error &&
        checkErr.message.includes('ainda não está habilitado no Firebase Console')
      ) {
        throw checkErr;
      }
      console.warn(
        '[PDF Upload - 2/6] Aviso ao verificar bucket (prosseguindo para uploadBytesResumable):',
        checkErr
      );
    }
  }

  const pdfPath = `books/${bookId}/book.pdf`;
  const storageRef = ref(storage, pdfPath);

  console.log(
    '[PDF Upload - 3/6] ANTES de uploadBytesResumable() -> Criando task para:',
    {
      fullPath: storageRef.fullPath,
      bucket: storageRef.bucket,
      sizeBytes: file.size,
    }
  );

  return new Promise((resolve, reject) => {
    let settled = false;

    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: 'application/pdf',
      customMetadata: {
        bookId,
        originalFileName: file.name,
      },
    });

    console.log(
      '[PDF Upload - 4/6] DEPOIS de uploadBytesResumable() -> Task iniciada, aguardando eventos state_changed...'
    );

    // Guard de segurança caso a rede ou o endpoint congele em 0% por mais de 20 segundos
    const stallTimeout = setTimeout(() => {
      const snap = uploadTask.snapshot;
      if (!settled && snap.bytesTransferred === 0) {
        settled = true;
        uploadTask.cancel();
        console.error(
          '[PDF Upload - TIMEOUT] O upload permaneceu em 0 bytes por 20s.',
          snap
        );
        reject(
          new Error(
            `Tempo limite excedido em 0%. Verifique se o Firebase Storage está habilitado em https://console.firebase.google.com/project/${firebaseConfig.projectId}/storage e se as regras (Storage Rules) permitem escrita para o administrador.`
          )
        );
      }
    }, 20000);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress =
          snapshot.totalBytes > 0
            ? Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              )
            : 0;
        console.log('[PDF Upload - 5/6] Evento state_changed:', {
          state: snapshot.state,
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          progress: `${progress}%`,
        });
        if (onProgress) {
          onProgress(progress);
        }
      },
      (error) => {
        clearTimeout(stallTimeout);
        if (settled) return;
        settled = true;

        console.error('[PDF Upload - ERRO] Falha no uploadBytesResumable:', {
          code: error.code,
          message: error.message,
          serverResponse: error.serverResponse,
          error,
        });

        let friendlyMessage = `Erro no Firebase Storage (${error.code}): ${error.message}`;
        if (
          error.code === 'storage/unauthorized' ||
          error.code === 'storage/unauthenticated'
        ) {
          friendlyMessage =
            'Permissão negada no Firebase Storage (storage/unauthorized). Verifique as Rules do Storage no Firebase Console para permitir escrita ao administrador.';
        } else if (
          error.code === 'storage/retry-limit-exceeded' ||
          error.code === 'storage/unknown'
        ) {
          friendlyMessage = `Falha de comunicação com o bucket "${firebaseConfig.storageBucket}" (${error.code}). Confirme se o Firebase Storage está ativado no Console do Firebase.`;
        }

        reject(new Error(friendlyMessage));
      },
      async () => {
        clearTimeout(stallTimeout);
        if (settled) return;
        settled = true;

        try {
          console.log(
            '[PDF Upload - 6/6] Upload 100% concluído! Obtendo getDownloadURL()...'
          );
          const pdfUrl = await getDownloadURL(uploadTask.snapshot.ref);
          console.log(
            '[PDF Upload - SUCESSO] URL obtida do Firebase Storage:',
            pdfUrl
          );
          resolve({
            pdfUrl,
            pdfPath,
            pdfFileName: file.name,
            pdfSize: file.size,
            pdfUpdatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error('[PDF Upload - ERRO em getDownloadURL]:', err);
          reject(err);
        }
      }
    );
  });
}

/**
 * Remove o arquivo PDF do livro do Firebase Storage (books/{bookId}/book.pdf).
 */
export async function deleteBookPdfFromStorage(
  bookId: string,
  customPath?: string
): Promise<void> {
  const targetPath = customPath || `books/${bookId}/book.pdf`;
  const storageRef = ref(storage, targetPath);
  try {
    await deleteObject(storageRef);
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code !== 'storage/object-not-found') {
      throw error;
    }
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Erro ao autenticar com Google:', error);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Erro ao encerrar sessão:', error);
  }
}

// Validate connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'books', 'connection_check'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export { onAuthStateChanged };
export type { User };
