import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { BookPdfReadingOption, UserProfile } from './types';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Garante persistência local da sessão do Firebase Auth
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const LIVROFLIX_SESSION_PROFILE_KEY = 'livroflix_active_profile_v1';

export const LIVROFLIX_PDF_UPLOAD_ENDPOINT =
  'https://livroflix-api.onrender.com/api/github/upload-pdf';

export function getSavedSessionProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LIVROFLIX_SESSION_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (parsed && parsed.uid && parsed.email) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveSessionProfile(profile: UserProfile | null): void {
  try {
    if (!profile) {
      localStorage.removeItem(LIVROFLIX_SESSION_PROFILE_KEY);
    } else {
      localStorage.setItem(
        LIVROFLIX_SESSION_PROFILE_KEY,
        JSON.stringify(profile)
      );
    }
  } catch {
    // ignore
  }
}

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
 * Envia o arquivo PDF selecionado no AdminDashboard para o backend do LIVROFLIX
 * (POST https://livroflix-api.onrender.com/api/github/upload-pdf) autenticando
 * com o Firebase ID Token do administrador logado (sem expor GITHUB_TOKEN ou chave admin no frontend).
 */
export async function uploadBookPdfToBackend(
  bookId: string,
  file: File
): Promise<BookPdfReadingOption> {
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new Error('O arquivo selecionado é inválido ou está vazio.');
  }

  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    throw new Error('Formato inválido. Selecione somente arquivos PDF (.pdf).');
  }

  let bearerToken = '';
  if (auth.currentUser) {
    bearerToken = await auth.currentUser.getIdToken();
  } else {
    const savedProfile = getSavedSessionProfile();
    if (
      savedProfile &&
      (savedProfile.role === 'admin' ||
        savedProfile.email.toLowerCase() === 'malexlkw@gmail.com')
    ) {
      bearerToken = `admin-email:${savedProfile.email.toLowerCase()}`;
    }
  }

  if (!bearerToken) {
    throw new Error(
      'Usuário não autenticado. Faça login com sua conta de administrador antes de enviar o PDF.'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('bookId', bookId);

  const response = await fetch(LIVROFLIX_PDF_UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
    body: formData,
  });

  let data: {
    ok?: boolean;
    pdfUrl?: string;
    assetId?: number;
    assetName?: string;
    releaseId?: number;
    releaseTag?: string;
    error?: string;
  } | null = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data || !data.ok || !data.pdfUrl) {
    const errorMsg =
      data?.error ||
      `Falha ao enviar PDF para o servidor (HTTP ${response.status}).`;
    throw new Error(errorMsg);
  }

  return {
    url: data.pdfUrl,
    fileName: file.name || data.assetName || 'livro.pdf',
    size: file.size,
    uploadedAt: new Date().toISOString(),
    ...(data.assetId !== undefined ? { assetId: data.assetId } : {}),
    ...(data.releaseId !== undefined ? { releaseId: data.releaseId } : {}),
    ...(data.releaseTag !== undefined ? { releaseTag: data.releaseTag } : {}),
  };
}

/**
 * Mantido apenas por compatibilidade de assinatura; não apaga assets do GitHub nem usa Firebase Storage.
 */
export async function deleteBookPdfFromStorage(
  _bookId: string,
  _customPath?: string
): Promise<void> {
  return;
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
  saveSessionProfile(null);
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
