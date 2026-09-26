import React from 'react';
import { Book } from '../types';
import { BookCover } from './BookCover';

interface BookCardProps {
  book: Book;
  onSelect: (book: Book) => void;
  onReadNow?: (book: Book) => void;
  isSaved?: boolean;
  onToggleSave?: (bookId: string, e: React.MouseEvent) => void;
  isDownloaded?: boolean;
  onToggleDownload?: (book: Book, e: React.MouseEvent) => void;
  progressPercent?: number;
  currentPage?: number;
  totalPages?: number;
  rankNumber?: number;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * BookCard:
 * - At rest: displays ONLY the book cover (zero text below or above).
 * - When rankNumber is provided (Top 10): displays the sculpted rank number alongside the cover.
 * - On hover (when placing the cursor on the cover): displays ONLY the title and author.
 */
export const BookCard: React.FC<BookCardProps> = ({
  book,
  onSelect,
  rankNumber,
  size = 'md',
}) => {
  const widthClasses = {
    sm: 'w-[130px] sm:w-[148px]',
    md: 'w-[148px] sm:w-[172px] md:w-[188px]',
    lg: 'w-[172px] sm:w-[200px] md:w-[220px]',
  }[size];

  if (rankNumber !== undefined) {
    return (
      <div
        onClick={() => onSelect(book)}
        className="group relative flex-shrink-0 flex items-end pl-9 sm:pl-12 md:pl-14 cursor-pointer select-none transition-transform duration-300 hover:-translate-y-1.5"
      >
        {/* Sculpted Streaming Top 10 Rank Number */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 bottom-[-4px] z-10 font-display text-[92px] sm:text-[116px] md:text-[134px] font-black leading-[0.82] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#60A5FA] via-[#2563EB] to-[#071426] drop-shadow-[0_8px_24px_rgba(37,99,235,0.45)] transition-transform duration-300 group-hover:scale-105"
          style={{
            WebkitTextStroke: '2px rgba(96, 165, 250, 0.55)',
          }}
        >
          {rankNumber}
        </span>

        {/* Book Cover */}
        <div className={`relative z-20 ${widthClasses}`}>
          <BookCover
            book={book}
            className="transition-all duration-300 group-hover:border-[#60A5FA]/70 group-hover:shadow-[0_18px_38px_rgba(37,99,235,0.35)]"
            imageClassName="group-hover:scale-105"
          >
            {/* Hover overlay: shows ONLY title and author when cursor is over the book */}
            <div className="absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-[#040D1A]/95 via-[#040D1A]/75 to-transparent p-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-250">
              <h4 className="font-display text-sm sm:text-base font-extrabold text-white leading-tight line-clamp-2">
                {book.titulo}
              </h4>
              <p className="mt-1 text-xs font-medium text-[#60A5FA] truncate">
                {book.autor}
              </p>
            </div>
          </BookCover>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(book)}
      className={`group relative flex-shrink-0 ${widthClasses} cursor-pointer select-none transition-transform duration-300 hover:-translate-y-1.5`}
    >
      <BookCover
        book={book}
        className="transition-all duration-300 group-hover:border-[#60A5FA]/70 group-hover:shadow-[0_18px_38px_rgba(37,99,235,0.35)]"
        imageClassName="group-hover:scale-105"
      >
        {/* Hover overlay: shows ONLY title and author when cursor is over the book */}
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-[#040D1A]/95 via-[#040D1A]/75 to-transparent p-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-250">
          <h4 className="font-display text-sm sm:text-base font-extrabold text-white leading-tight line-clamp-2">
            {book.titulo}
          </h4>
          <p className="mt-1 text-xs font-medium text-[#60A5FA] truncate">
            {book.autor}
          </p>
        </div>
      </BookCover>
    </div>
  );
};
