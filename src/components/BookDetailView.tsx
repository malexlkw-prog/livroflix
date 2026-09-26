import React, { useState } from 'react';
import {
  ArrowLeft,
  Play,
  Heart,
  Star,
  BookOpen,
  Calendar,
} from 'lucide-react';
import { Book, ReadingStatus, UserBookItem } from '../types';
import { BookCover } from './BookCover';
import { BookRow } from './BookRow';

interface BookDetailViewProps {
  book: Book;
  allBooks: Book[];
  userLibrary: Record<string, UserBookItem>;
  onBack: () => void;
  onReadBook: (book: Book) => void;
  onSelectBook: (book: Book) => void;
  onToggleList: (book: Book, e?: React.MouseEvent) => void;
  onToggleFavorite: (book: Book) => void;
  onChangeStatus: (book: Book, status: ReadingStatus) => void;
  onRateBook: (book: Book, stars: number, recommend?: boolean) => void;
  readButtonText?: string;
  ratingPromptText?: string;
  relatedBooksPrefix?: string;
}

export const BookDetailView: React.FC<BookDetailViewProps> = ({
  book,
  allBooks,
  userLibrary,
  onBack,
  onReadBook,
  onSelectBook,
  onToggleFavorite,
  onRateBook,
  readButtonText = 'LER LIVRO',
  ratingPromptText = 'Avalie esta obra',
  relatedBooksPrefix = 'Se você gostou de',
}) => {
  const effectiveReadButtonText =
    !readButtonText || readButtonText === 'Ler agora'
      ? 'LER LIVRO'
      : readButtonText;
  const userItem = userLibrary[book.id];
  const isFavorite = Boolean(userItem?.isFavorite);
  const userRating = userItem?.avaliacaoUsuario || 0;
  const [hoverRating, setHoverRating] = useState(0);

  // Only show progress if the book has actually been read/started
  const hasBeenRead = Boolean(
    userItem &&
      (userItem.status === 'lendo' || userItem.status === 'concluido') &&
      userItem.progresso > 0
  );

  const relatedBooks = allBooks
    .filter((b) => b.id !== book.id && b.status === 'ativo')
    .map((b) => {
      const sharedGenres = b.generos.filter((g) => book.generos.includes(g)).length;
      const sameAuthor = b.autor === book.autor ? 3 : 0;
      return { book: b, score: sharedGenres + sameAuthor };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((item) => item.book);

  return (
    <div className="min-h-screen bg-[#040D1A] pt-24 pb-24">
      {/* Ambient Blurred Cover Header Backdrop */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={book.capa}
            alt=""
            className="h-full w-full object-cover scale-125 blur-3xl opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#040D1A]/60 via-[#040D1A]/90 to-[#040D1A]" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-8 pt-4 pb-12">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 border border-blue-400/20 px-3.5 py-2 text-xs sm:text-sm font-medium text-white transition-colors mb-8 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#60A5FA]" />
            <span>Voltar ao catálogo</span>
          </button>

          {/* Main Book Showcase Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column: Large Cover */}
            <div className="md:col-span-4 lg:col-span-3 flex flex-col items-center md:items-start">
              <div className="w-[220px] sm:w-[260px] md:w-full max-w-[300px]">
                <BookCover
                  book={book}
                  className="ring-2 ring-blue-400/35 shadow-[0_25px_60px_-15px_rgba(2,8,23,0.95)]"
                />
              </div>

              {/* Current Reading Progress — only shown for books that have already been read */}
              {hasBeenRead && userItem && (
                <div className="mt-5 w-[220px] sm:w-[260px] md:w-full max-w-[300px] rounded-xl bg-[#071426] border border-blue-400/20 p-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-blue-200/75 font-medium">Seu progresso</span>
                    <span className="font-mono-num font-bold text-[#60A5FA]">
                      {userItem.progresso}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-blue-950 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA]"
                      style={{ width: `${userItem.progresso}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-mono-num text-blue-200/70">
                    Parou na página {userItem.paginaAtual} de {book.paginas}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Book Details, Actions, Synopsis & Rating */}
            <div className="md:col-span-8 lg:col-span-9 space-y-6">
              {/* Genres */}
              <div className="flex flex-wrap items-center gap-2">
                {book.generos.map((genero) => (
                  <span
                    key={genero}
                    className="rounded-md bg-blue-500/15 border border-blue-400/30 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#60A5FA]"
                  >
                    {genero}
                  </span>
                ))}
              </div>

              {/* Title & Author */}
              <div>
                <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05]">
                  {book.titulo}
                </h1>
                <p className="mt-2 text-lg sm:text-xl text-blue-200/75">
                  por <span className="font-semibold text-white">{book.autor}</span>
                </p>
              </div>

              {/* Quick Stats Bar (without recommendation percentage) */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-3 border-y border-blue-400/15 text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[#60A5FA]">
                    <Star className="w-5 h-5 fill-[#60A5FA]" />
                    <span className="font-mono-num text-lg font-bold text-white">
                      {book.avaliacao > 0 ? book.avaliacao.toFixed(1) : '—'}
                    </span>
                  </div>
                  <span className="text-xs text-blue-200/70">
                    ({book.totalAvaliacoes || 0}{' '}
                    {(book.totalAvaliacoes || 0) === 1
                      ? 'avaliação'
                      : 'avaliações'}
                    )
                  </span>
                </div>

                <span className="text-blue-400/30">•</span>

                <div className="flex items-center gap-1.5 text-white">
                  <BookOpen className="w-4 h-4 text-[#60A5FA]" />
                  <span className="font-mono-num">{book.paginas} páginas</span>
                </div>

                <span className="text-blue-400/30">•</span>

                <div className="flex items-center gap-1.5 text-white">
                  <Calendar className="w-4 h-4 text-[#60A5FA]" />
                  <span className="font-mono-num">Ano {book.ano}</span>
                </div>
              </div>

              {/* Primary Action Buttons: LER LIVRO + Simple Heart Button */}
              <div className="flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => onReadBook(book)}
                  className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-8 py-3.5 text-base font-bold text-white shadow-[0_10px_30px_-5px_rgba(37,99,235,0.55)] transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>{effectiveReadButtonText}</span>
                </button>

                {/* Simple Heart Icon Button */}
                <button
                  type="button"
                  onClick={() => onToggleFavorite(book)}
                  aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
                  title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
                  className={`flex h-[52px] w-[52px] items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    isFavorite
                      ? 'bg-rose-500/15 border-rose-500/60 text-rose-500'
                      : 'bg-blue-950/60 hover:bg-blue-900/60 border-blue-400/20 text-white hover:text-rose-400'
                  }`}
                >
                  <Heart
                    className={`w-5 h-5 transition-transform hover:scale-110 ${
                      isFavorite ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Synopsis Only (no "Sinopse da Obra" heading) */}
              <div className="pt-2">
                <p className="text-base sm:text-lg text-blue-50/90 leading-relaxed max-w-3xl font-reader">
                  {book.descricao}
                </p>
              </div>

              {/* Clean Rating Section (only "Avalie esta obra" + 5 stars) */}
              <div className="rounded-xl bg-gradient-to-r from-[#071426] to-[#0B1E36] border border-blue-400/20 p-5 sm:p-6">
                <h3 className="font-display text-xl font-bold text-white">
                  {ratingPromptText}
                </h3>

                <div className="mt-3 flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || userRating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => onRateBook(book, star)}
                        className="p-1 transition-transform hover:scale-115 cursor-pointer"
                        title={`Avaliar com ${star} estrelas`}
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            active
                              ? 'fill-[#60A5FA] text-[#60A5FA]'
                              : 'text-blue-200/30 hover:text-[#60A5FA]/60'
                          }`}
                        />
                      </button>
                    );
                  })}
                  {userRating > 0 && (
                    <span className="ml-2 text-xs font-mono-num text-[#60A5FA] font-semibold">
                      Sua nota: {userRating}/5
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Books Section */}
      {relatedBooks.length > 0 && (
        <div className="mt-6 pt-6 border-t border-blue-400/15">
          <BookRow
            title={`${relatedBooksPrefix} "${book.titulo}"`}
            books={relatedBooks}
            onSelectBook={onSelectBook}
            savedBookIds={[]}
            onToggleSave={() => {}}
          />
        </div>
      )}
    </div>
  );
};
