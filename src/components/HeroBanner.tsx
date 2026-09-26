import React from 'react';
import {
  Star,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Book, PlatformSettings } from '../types';
import { BookCover } from './BookCover';

interface HeroBannerProps {
  featuredBooks: Book[];
  activeHeroIndex: number;
  onSelectHeroIndex: (index: number) => void;
  onSelectBook: (book: Book) => void;
  heroButtonText?: string;
  platformSettings?: PlatformSettings;
}

/**
 * HeroBanner (Destaques):
 * Displays ONLY:
 * - Avaliação (★)
 * - Nome do livro
 * - Sinopse
 * - Botão "Ver livro"
 * - Capa do livro em formato de livro (2:3)
 * Well-organized in a deep blue cinematic layout.
 */
export const HeroBanner: React.FC<HeroBannerProps> = ({
  featuredBooks,
  activeHeroIndex,
  onSelectHeroIndex,
  onSelectBook,
  heroButtonText = 'Ver livro',
  platformSettings,
}) => {
  if (featuredBooks.length === 0) return null;

  const showRating = platformSettings?.showHeroRating !== false;
  const showSynopsis = platformSettings?.showHeroSynopsis !== false;
  const showCover = platformSettings?.showHeroCover !== false;

  const totalSlides = featuredBooks.length;
  const safeIndex = ((activeHeroIndex % totalSlides) + totalSlides) % totalSlides;
  const currentBook = featuredBooks[safeIndex] || featuredBooks[0];

  const handlePrevSlide = () => {
    onSelectHeroIndex((safeIndex - 1 + totalSlides) % totalSlides);
  };

  const handleNextSlide = () => {
    onSelectHeroIndex((safeIndex + 1) % totalSlides);
  };

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-[#07162C] via-[#061224] to-[#040D1A] pt-28 lg:pt-32 pb-12 sm:pb-14 border-b border-blue-400/10">
      {/* Ambient Blurred Book Cover Glow */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src={currentBook.bannerUrl || currentBook.capa}
          alt=""
          className="h-full w-full object-cover object-center scale-125 blur-3xl opacity-20 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#040D1A] via-[#061326]/90 to-[#040D1A]/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#040D1A] via-transparent to-[#040D1A]/60" />
      </div>

      {/* Main Organized Container */}
      <div className="relative z-10 mx-auto max-w-[1280px] w-full px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: ONLY Avaliação, Nome do Livro, Sinopse e Botão "Ver livro" */}
          <div className={`${showCover ? 'lg:col-span-7' : 'lg:col-span-12'} flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1`}>
            {/* 1. Avaliação */}
            {showRating && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 px-3.5 py-1 text-sm font-bold text-[#60A5FA] mb-4 shadow-sm">
                <Star className="w-4 h-4 fill-[#60A5FA] text-[#60A5FA]" />
                <span>{currentBook.avaliacao.toFixed(1)}</span>
              </div>
            )}

            {/* 2. Nome do Livro */}
            <h1
              onClick={() => onSelectBook(currentBook)}
              className="font-display text-3xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-white uppercase leading-[1.06] cursor-pointer hover:text-[#60A5FA] transition-colors"
            >
              {currentBook.titulo}
            </h1>

            {/* 3. Sinopse */}
            {showSynopsis && (
              <p className="mt-4 max-w-xl text-sm sm:text-base md:text-lg text-blue-100/85 leading-relaxed line-clamp-3">
                {currentBook.descricao}
              </p>
            )}

            {/* 4. Botão "Ver livro" */}
            <div className="mt-7">
              <button
                type="button"
                onClick={() => onSelectBook(currentBook)}
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-8 py-3.5 text-sm sm:text-base font-extrabold text-white shadow-[0_10px_30px_rgba(37,99,235,0.45)] transition-all hover:scale-[1.03] active:scale-[0.99] cursor-pointer"
              >
                <Eye className="w-5 h-5" />
                <span>{heroButtonText}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Featured Book in Vertical Book Format (2:3) */}
          {showCover && (
            <div className="lg:col-span-5 flex items-center justify-center lg:justify-end order-1 lg:order-2">
              <div
                onClick={() => onSelectBook(currentBook)}
                className="group relative w-[185px] sm:w-[225px] md:w-[250px] cursor-pointer transition-transform duration-500 hover:scale-[1.03]"
              >
                <div className="absolute -inset-4 rounded-2xl bg-blue-500/25 blur-2xl opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <BookCover
                  book={currentBook}
                  className="ring-2 ring-blue-400/50 shadow-[0_25px_55px_rgba(2,6,23,0.95)]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Clean Carousel Navigation Controls */}
        <div className="mt-10 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevSlide}
            aria-label="Livro anterior em destaque"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-400/25 bg-[#071426]/80 hover:bg-[#2563EB] text-white transition-colors cursor-pointer backdrop-blur-md"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            {featuredBooks.map((b, idx) => {
              const active = idx === safeIndex;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelectHeroIndex(idx)}
                  aria-label={`Destaque ${b.titulo}`}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    active
                      ? 'w-8 bg-[#3B82F6]'
                      : 'w-2 bg-blue-200/25 hover:bg-blue-200/50'
                  }`}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleNextSlide}
            aria-label="Próximo livro em destaque"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-400/25 bg-[#071426]/80 hover:bg-[#2563EB] text-white transition-colors cursor-pointer backdrop-blur-md"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};
