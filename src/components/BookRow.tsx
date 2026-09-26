import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Book } from '../types';
import { BookCard } from './BookCard';

interface BookRowProps {
  title: string;
  subtitle?: string;
  books: Book[];
  onSelectBook: (book: Book) => void;
  onReadNow?: (book: Book) => void;
  savedBookIds: string[];
  onToggleSave: (bookId: string, e: React.MouseEvent) => void;
  downloadedBookIds?: string[];
  onToggleDownload?: (book: Book, e: React.MouseEvent) => void;
  progressMap?: Record<string, { percent: number; paginaAtual: number; totalPaginas: number }>;
  showRank?: boolean;
  cardSize?: 'sm' | 'md' | 'lg';
}

export const BookRow: React.FC<BookRowProps> = ({
  title,
  books,
  onSelectBook,
  showRank = false,
  cardSize = 'md',
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  if (books.length === 0) return null;

  const scrollRow = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const { scrollLeft, clientWidth } = rowRef.current;
    const scrollAmount = clientWidth * 0.78;
    rowRef.current.scrollTo({
      left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section className="relative py-3.5 sm:py-4 group/row">
      {/* Row Header — Only the category title, without the blue bar next to it */}
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 mb-3 flex items-end justify-between gap-4">
        <h2 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight">
          {title}
        </h2>

        {/* Navigation Arrows */}
        <div className="hidden sm:flex items-center gap-2 opacity-80 group-hover/row:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => scrollRow('left')}
            aria-label="Rolar para a esquerda"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/20 bg-[#071426] hover:bg-[#2563EB] hover:border-[#3B82F6] text-blue-100 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollRow('right')}
            aria-label="Rolar para a direita"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/20 bg-[#071426] hover:bg-[#2563EB] hover:border-[#3B82F6] text-blue-100 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div className="relative mx-auto max-w-[1440px]">
        <div
          ref={rowRef}
          className={`flex items-end ${
            showRank ? 'gap-5 sm:gap-7' : 'gap-4 sm:gap-5'
          } overflow-x-auto no-scrollbar px-4 sm:px-8 py-2 scroll-smooth`}
        >
          {books.map((book, index) => (
            <BookCard
              key={book.id}
              book={book}
              onSelect={onSelectBook}
              rankNumber={showRank ? index + 1 : undefined}
              size={cardSize}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
