import React, { useState, useEffect } from 'react';
import { Book } from '../types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const LOCAL_CREATED_AT_CACHE_KEY = 'livroflix_book_created_at_v1';

/**
 * Resolve the creation timestamp (ISO string) of a book.
 * Checks book.createdAt first, then PDF upload timestamps, then ID timestamp,
 * and finally anchors a persistent first-seen timestamp in localStorage for legacy books.
 */
export function resolveBookCreatedAtIso(
  book: Partial<Book> & { id?: string }
): string | undefined {
  if (book.createdAt && typeof book.createdAt === 'string') {
    const parsed = Date.parse(book.createdAt);
    if (!Number.isNaN(parsed)) return book.createdAt;
  }

  if (
    book.createdAt &&
    typeof book.createdAt === 'object' &&
    'seconds' in (book.createdAt as Record<string, unknown>)
  ) {
    const secs = Number((book.createdAt as Record<string, unknown>).seconds);
    if (Number.isFinite(secs)) {
      return new Date(secs * 1000).toISOString();
    }
  }

  const pdfUploadedAt =
    book.readingOptions?.pdf?.uploadedAt || book.pdfUpdatedAt;
  if (pdfUploadedAt && typeof pdfUploadedAt === 'string') {
    const parsed = Date.parse(pdfUploadedAt);
    if (!Number.isNaN(parsed)) return pdfUploadedAt;
  }

  if (book.id) {
    const match = book.id.match(/^livro-(\d{13})/);
    if (match) {
      const ts = Number(match[1]);
      if (Number.isFinite(ts)) return new Date(ts).toISOString();
    }

    try {
      const raw = localStorage.getItem(LOCAL_CREATED_AT_CACHE_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      if (map[book.id] && !Number.isNaN(Date.parse(map[book.id]))) {
        return map[book.id];
      }
      const nowIso = new Date().toISOString();
      map[book.id] = nowIso;
      localStorage.setItem(LOCAL_CREATED_AT_CACHE_KEY, JSON.stringify(map));
      return nowIso;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/**
 * Returns true if the book was created/added within the last 7 days (1 week).
 * After 7 days, returns false so the "NOVO" badge is automatically removed.
 */
export function isBookNewWithinSevenDays(
  book: Partial<Book> & { id?: string },
  nowMs: number = Date.now()
): boolean {
  const iso = resolveBookCreatedAtIso(book);
  if (!iso) return false;
  const createdAtMs = Date.parse(iso);
  if (Number.isNaN(createdAtMs)) return false;

  const elapsedMs = nowMs - createdAtMs;
  return elapsedMs <= SEVEN_DAYS_MS;
}

interface BookCoverProps {
  book: Pick<Book, 'titulo' | 'autor' | 'capa'> & Partial<Book>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  imageClassName?: string;
  children?: React.ReactNode;
}

/**
 * Renders every book strictly in vertical book format (aspect-[2/3])
 * with just the cover artwork, subtle spine lighting, and the orange "NOVO"
 * badge in the top-left corner for books added within the last 7 days.
 */
export const BookCover: React.FC<BookCoverProps> = ({
  book,
  size,
  className = '',
  imageClassName = '',
  children,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const isNew = isBookNewWithinSevenDays(book, nowMs);

  return (
    <div
      className={`relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-[#071426] border border-blue-400/20 shadow-[0_14px_34px_rgba(2,8,23,0.85)] select-none ${className}`}
    >
      <img
        src={book.capa}
        alt={`Capa do livro ${book.titulo}`}
        loading="lazy"
        className={`h-full w-full object-cover transition-transform duration-700 ${imageClassName}`}
      />

      {/* Realistic book spine crease along the left edge */}
      <div className="pointer-events-none absolute inset-0 book-spine-overlay" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[6px] bg-gradient-to-r from-white/25 via-black/35 to-transparent" />

      {/* Selo laranja "NOVO" no canto superior esquerdo (exibido apenas durante os primeiros 7 dias) */}
      {isNew && size !== 'sm' && (
        <div className="pointer-events-none absolute top-2 left-2 z-30">
          <span className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-[#FF6B00] to-[#F97316] border border-orange-300/40 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-white shadow-[0_4px_12px_rgba(249,115,22,0.55)]">
            NOVO
          </span>
        </div>
      )}

      {children}
    </div>
  );
};
