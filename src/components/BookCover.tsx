import React from 'react';
import { Book } from '../types';

interface BookCoverProps {
  book: Pick<Book, 'titulo' | 'autor' | 'capa'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  imageClassName?: string;
  children?: React.ReactNode;
}

/**
 * Renders every book strictly in vertical book format (aspect-[2/3])
 * with just the cover artwork and subtle spine lighting.
 */
export const BookCover: React.FC<BookCoverProps> = ({
  book,
  className = '',
  imageClassName = '',
  children,
}) => {
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

      {children}
    </div>
  );
};
