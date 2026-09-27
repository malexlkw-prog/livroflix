import { Book, UserProfile } from '../types';
import { auth } from '../firebase';
import { canBookBeDownloaded, isUserPremium } from './premiumUtils';

const LIVROFLIX_PRODUCTION_PDF_STREAM =
  'https://livroflix-api.onrender.com/api/github/pdf-stream';

export function hasPdfMagicHeader(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 5) return false;
  const header = new Uint8Array(buffer, 0, 5);
  // Assinatura ASCII "%PDF-" -> [0x25, 0x50, 0x44, 0x46, 0x2D]
  return (
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46 &&
    header[4] === 0x2d
  );
}

export function buildCandidatePdfUrls(rawUrl: string): string[] {
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];

  const isGitHubReleaseUrl =
    trimmed.includes('github.com/') ||
    trimmed.includes('githubusercontent.com/');

  const encoded = encodeURIComponent(trimmed);
  const localStreamUrl = `/api/github/pdf-stream?url=${encoded}`;
  const prodStreamUrl = `${LIVROFLIX_PRODUCTION_PDF_STREAM}?url=${encoded}`;

  const isRenderHost =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.onrender.com');

  if (isGitHubReleaseUrl) {
    return isRenderHost
      ? [prodStreamUrl, localStreamUrl, trimmed]
      : [localStreamUrl, prodStreamUrl, trimmed];
  }

  return [trimmed, localStreamUrl, prodStreamUrl];
}

export async function fetchPdfBinaryData(
  rawUrl: string,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const candidates = buildCandidatePdfUrls(rawUrl);
  let lastError = 'Não foi possível carregar o arquivo PDF.';

  for (const candidateUrl of candidates) {
    if (signal?.aborted) {
      throw new DOMException('Carregamento cancelado', 'AbortError');
    }

    try {
      const response = await fetch(candidateUrl, {
        method: 'GET',
        signal,
      });

      if (!response.ok) {
        lastError = `Falha ao carregar PDF (HTTP ${response.status}).`;
        continue;
      }

      const buffer = await response.arrayBuffer();
      if (!hasPdfMagicHeader(buffer)) {
        lastError = 'O recurso retornado não é um documento PDF válido.';
        continue;
      }

      return new Uint8Array(buffer);
    } catch (err) {
      if (
        signal?.aborted ||
        (err instanceof DOMException && err.name === 'AbortError')
      ) {
        throw err;
      }
      lastError =
        err instanceof Error
          ? err.message
          : 'Erro de conexão ao buscar o PDF.';
    }
  }

  throw new Error(lastError);
}

export async function downloadBookPdf(
  book: Book,
  userProfile?: Pick<UserProfile, 'uid' | 'premium'> | null
): Promise<void> {
  if (!isUserPremium(userProfile)) {
    throw new Error(
      'O download de livros é exclusivo para assinantes LIVROFLIX Premium.'
    );
  }

  if (!canBookBeDownloaded(book)) {
    throw new Error(
      'Este livro não está disponível para download.'
    );
  }

  const sanitizedTitle = (book.titulo || 'livro')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '')
    .trim();
  const baseName = sanitizedTitle || book.id || 'livro';
  const fileName = baseName.toLowerCase().endsWith('.pdf')
    ? baseName
    : `${baseName}.pdf`;

  const uid = userProfile?.uid || auth.currentUser?.uid || '';
  let idToken = '';
  try {
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }
  } catch {
    idToken = '';
  }

  // 1. Tenta o endpoint seguro de download Premium no backend (/api/premium/download-book)
  if (uid) {
    try {
      const headers: Record<string, string> = {};
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      }
      const resp = await fetch(
        `/api/premium/download-book?bookId=${encodeURIComponent(
          book.id
        )}&uid=${encodeURIComponent(uid)}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (resp.status === 403) {
        const errBody = await resp.json().catch(() => null);
        throw new Error(
          errBody?.error ||
            'Você não possui permissão para baixar este livro.'
        );
      }

      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (hasPdfMagicHeader(buffer)) {
          const blob = new Blob([buffer], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);

          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
          }, 15000);
          return;
        }
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('exclusivo') ||
          err.message.includes('permissão'))
      ) {
        throw err;
      }
    }
  }

  // 2. Fallback seguro de stream binário caso o livro já esteja validado para download
  const pdfUrl = (book.readingOptions?.pdf?.url || book.pdfUrl || '').trim();
  if (!pdfUrl) {
    throw new Error('Este livro ainda não possui um arquivo PDF disponível.');
  }

  const pdfBytes = await fetchPdfBinaryData(pdfUrl);
  const arrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 15000);
}
