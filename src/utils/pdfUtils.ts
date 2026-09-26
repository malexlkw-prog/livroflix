import { Book } from '../types';

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

export async function downloadBookPdf(book: Book): Promise<void> {
  const pdfUrl = (book.readingOptions?.pdf?.url || book.pdfUrl || '').trim();
  if (!pdfUrl) {
    throw new Error('Este livro ainda não possui um arquivo PDF disponível.');
  }

  const sanitizedTitle = (book.titulo || 'livro')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '')
    .trim();
  const baseName = sanitizedTitle || book.id || 'livro';
  const fileName = baseName.toLowerCase().endsWith('.pdf')
    ? baseName
    : `${baseName}.pdf`;

  try {
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
  } catch {
    // Fallback direto para a URL do PDF (GitHub Releases já possui Content-Disposition: attachment)
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
