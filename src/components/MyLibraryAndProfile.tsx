import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Heart,
  Play,
  Trash2,
  Trophy,
  Flame,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  Download,
  HardDrive,
  Loader2,
  Camera,
  Edit3,
  AtSign,
  X,
  AlertCircle,
  Check,
  MessageSquare,
  Palette,
  Settings,
  ArrowLeft,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Star,
  Crown,
} from 'lucide-react';
import {
  Book,
  BookReview,
  CommunityFollow,
  CommunityLike,
  CommunityPost,
  CommunityReply,
  PlatformSettings,
  ProfileCustomization,
  PublicProfile,
  ReadingStatus,
  UserBookItem,
  UserProfile,
} from '../types';
import { BookCover } from './BookCover';
import {
  BADGE_DEFINITIONS,
  BadgeId,
  BadgeImage,
  evaluateLiteraryAchievementsAndBadges,
  isValidBadgeId,
} from '../data/badges';
import { downloadBookPdf } from '../utils/pdfUtils';
import { CommunityPostCard, CreateReplyInput } from './CommunityView';
import {
  DEFAULT_PROFILE_CUSTOMIZATION,
  getProfileBackgroundStyle,
  ProfileCustomizationModal,
  ProfileDecorativeEffectLayer,
  ProfileIntegratedBanner,
} from './ProfileCustomization';
import {
  canBookBeDownloaded,
  getEffectiveProfileCustomization,
  getEffectiveUsernameColor,
  getMaxProfileFavoriteBooks,
  isUserPremium,
} from '../utils/premiumUtils';

interface DownloadsViewProps {
  books: Book[];
  userLibrary: Record<string, UserBookItem>;
  userProfile?: UserProfile | null;
  onSelectBook: (book: Book) => void;
  onReadBook: (book: Book) => void;
  onToggleDownload: (book: Book) => void;
  onOpenPremiumModal?: () => void;
  platformSettings?: PlatformSettings;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({
  books,
  userProfile,
  onSelectBook,
  onOpenPremiumModal,
  platformSettings,
}) => {
  const activeBooks = books.filter(
    (b) => b.status === 'ativo' && canBookBeDownloaded(b)
  );
  const isPremium = isUserPremium(userProfile);
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(
    null
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDirectPdfDownload = async (book: Book) => {
    setDownloadError(null);
    if (!isPremium) {
      onOpenPremiumModal?.();
      return;
    }
    setDownloadingBookId(book.id);
    try {
      await downloadBookPdf(book, userProfile);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : 'Não foi possível baixar o PDF deste livro.'
      );
    } finally {
      setDownloadingBookId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#040D1A] pt-28 lg:pt-24 pb-24">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 space-y-10">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-blue-400/15">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#60A5FA] mb-2">
              <Download className="w-3.5 h-3.5" />
              <span>Download Direto em PDF</span>
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white">
              {platformSettings?.downloadsTitle || 'Downloads'}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-blue-200/75">
              {platformSettings?.downloadsSubtitle ||
                'Clique em baixar em qualquer livro abaixo para fazer o download automático do arquivo PDF original.'}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-[#071426] border border-blue-400/20 px-4 py-3">
            <HardDrive className="w-5 h-5 text-[#60A5FA]" />
            <div>
              <span className="text-[11px] uppercase tracking-wider text-blue-200/70 block">
                Catálogo disponível
              </span>
              <span className="font-mono-num text-sm font-bold text-white">
                {activeBooks.length}{' '}
                {activeBooks.length === 1
                  ? 'livro para baixar'
                  : 'livros para baixar'}
              </span>
            </div>
          </div>
        </div>

        {downloadError && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs sm:text-sm text-rose-200">
            {downloadError}
          </div>
        )}

        {/* Books Grid for Direct PDF Download */}
        {activeBooks.length === 0 ? (
          <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-10 text-center max-w-xl mx-auto">
            <Download className="w-10 h-10 text-[#60A5FA] mx-auto mb-3 opacity-80" />
            <h3 className="font-display text-xl font-bold text-white">
              Nenhum livro disponível no catálogo
            </h3>
            <p className="text-sm text-blue-200/75 mt-1">
              Assim que livros forem cadastrados na plataforma, você poderá baixar o PDF diretamente por aqui.
            </p>
          </div>
        ) : (
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white mb-4">
              Disponíveis para Download em PDF
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {activeBooks.map((book) => {
                const isDownloading = downloadingBookId === book.id;
                return (
                  <div
                    key={book.id}
                    className="rounded-xl bg-[#071426] border border-blue-400/20 p-3 flex flex-col justify-between gap-3"
                  >
                    <div
                      onClick={() => onSelectBook(book)}
                      className="cursor-pointer"
                    >
                      <BookCover book={book} />
                      <h4 className="font-display text-sm font-bold text-white truncate mt-2">
                        {book.titulo}
                      </h4>
                      <p className="text-[11px] text-blue-200/70 truncate">
                        {book.autor}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={() => handleDirectPdfDownload(book)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-60 text-white py-2 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Baixando...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface MyLibraryViewProps {
  books: Book[];
  userLibrary: Record<string, UserBookItem>;
  userProfile?: UserProfile | null;
  bookReviews?: BookReview[];
  initialTab?: 'lista' | 'lendo' | 'concluido' | 'favoritos' | 'reviews';
  onSelectBook: (book: Book) => void;
  onOpenBookReview?: (book: Book) => void;
  onReadBook: (book: Book) => void;
  onChangeStatus?: (book: Book, status: ReadingStatus) => void;
  onRemoveFromList: (book: Book) => void;
  profileFavoriteBookIds?: string[];
  onToggleProfileFavoriteBook?: (book: Book) => void;
  onOpenPremiumModal?: () => void;
  platformSettings?: PlatformSettings;
}

export const MyLibraryView: React.FC<MyLibraryViewProps> = ({
  books,
  userLibrary,
  userProfile,
  bookReviews = [],
  initialTab = 'lista',
  onSelectBook,
  onOpenBookReview,
  onReadBook,
  onRemoveFromList,
  profileFavoriteBookIds = [],
  onToggleProfileFavoriteBook,
  onOpenPremiumModal,
  platformSettings,
}) => {
  const [activeTab, setActiveTab] = useState<
    'lista' | 'lendo' | 'concluido' | 'favoritos' | 'reviews'
  >(initialTab);

  const isPremium = isUserPremium(userProfile);
  const maxProfileFavorites = getMaxProfileFavoriteBooks(userProfile);

  // User's published reviews linked to catalog books
  const myPublishedReviews = React.useMemo(() => {
    if (!userProfile?.uid) return [];
    const booksMap = new Map(books.map((b) => [b.id, b]));
    return bookReviews
      .filter((r) => r.userId === userProfile.uid && booksMap.has(r.bookId))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((r) => ({
        review: r,
        book: booksMap.get(r.bookId)!,
      }));
  }, [bookReviews, userProfile?.uid, books]);

  // Only count IDs that are currently favorited / in Minha lista (max 3 free, max 5 Premium)
  const validSelectedProfileIds = React.useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const id of profileFavoriteBookIds) {
      const item = userLibrary[id];
      const isFav =
        Boolean(item) &&
        (item.inMyList || item.isFavorite || item.status === 'quero_ler');
      if (isFav && !seen.has(id)) {
        seen.add(id);
        result.push(id);
        if (result.length === maxProfileFavorites) break;
      }
    }
    return result;
  }, [profileFavoriteBookIds, userLibrary, maxProfileFavorites]);

  const libraryEntries = Object.values(userLibrary);

  const completedCount = libraryEntries.filter((i) => i.status === 'concluido').length;
  const readingCount = libraryEntries.filter((i) => i.status === 'lendo').length;
  const favoritesCount = libraryEntries.filter(
    (i) => i.isFavorite || i.status === 'quero_ler'
  ).length;

  const totalPagesRead = libraryEntries.reduce((acc, item) => {
    if (item.status === 'concluido') return acc + item.totalPaginas;
    return acc + (item.paginaAtual > 1 ? item.paginaAtual : 0);
  }, 0);

  const displayedBooks = books.filter((book) => {
    const item = userLibrary[book.id];
    if (!item) return false;
    if (activeTab === 'lista')
      return item.inMyList || item.isFavorite || item.status !== 'nenhum';
    if (activeTab === 'lendo') return item.status === 'lendo';
    if (activeTab === 'concluido') return item.status === 'concluido';
    if (activeTab === 'favoritos')
      return item.isFavorite || item.status === 'quero_ler';
    return false;
  });

  const statusLabel: Record<ReadingStatus, string> = {
    nenhum: 'Favorito',
    quero_ler: 'Favorito',
    lendo: 'Lendo',
    concluido: 'Concluído',
  };

  return (
    <div className="min-h-screen bg-[#040D1A] pt-28 lg:pt-24 pb-24">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        {/* Top Header & Reading Metrics Banner */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 pb-8 border-b border-blue-400/15">
          <div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold text-white">
              {platformSettings?.myListTitle || 'Minha lista'}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl bg-[#071426] border border-blue-400/20 px-4 py-3.5">
              <span className="text-[11px] uppercase tracking-wider text-blue-200/70 block">
                Livros lidos
              </span>
              <p className="font-mono-num text-xl sm:text-2xl font-bold text-[#60A5FA] mt-1">
                {completedCount}
              </p>
            </div>
            <div className="rounded-xl bg-[#071426] border border-blue-400/20 px-4 py-3.5">
              <span className="text-[11px] uppercase tracking-wider text-blue-200/70 block">
                Páginas lidas
              </span>
              <p className="font-mono-num text-xl sm:text-2xl font-bold text-white mt-1">
                {totalPagesRead.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Sem "Quero ler", deixando "Favoritos" + "✍️ Minhas Reviews") */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {(
            [
              { id: 'lista', label: 'Minha Lista Completa' },
              { id: 'lendo', label: `Lendo (${readingCount})` },
              { id: 'concluido', label: `Concluídos (${completedCount})` },
              { id: 'favoritos', label: `Favoritos (${favoritesCount})` },
              {
                id: 'reviews',
                label: `Minhas Reviews (${myPublishedReviews.length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#2563EB] text-white shadow-lg'
                  : 'bg-[#071426] text-blue-200/80 hover:text-white border border-blue-400/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Library Items Grid (shown when activeTab !== 'reviews') */}
        {activeTab !== 'reviews' && (
          <>
            {displayedBooks.length === 0 ? (
              <div className="rounded-2xl bg-[#071426]/80 border border-blue-400/20 p-12 text-center max-w-xl mx-auto my-8">
                <BookOpen className="w-10 h-10 text-[#60A5FA] mx-auto mb-3 opacity-80" />
                <h3 className="font-display text-2xl font-bold text-white">
                  Nenhum livro nesta seção ainda
                </h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {displayedBooks.map((book) => {
                  const item = userLibrary[book.id];
                  return (
                    <div
                      key={book.id}
                      className="flex gap-4 rounded-xl bg-[#071426] border border-blue-400/20 hover:border-[#60A5FA]/50 p-4 transition-all"
                    >
                      {/* Cover */}
                      <div
                        onClick={() => onSelectBook(book)}
                        className="w-24 sm:w-28 flex-shrink-0 cursor-pointer"
                      >
                        <BookCover book={book} />
                      </div>

                      {/* Book Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            {activeTab === 'lista' ? (
                              <span
                                className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  item.status === 'concluido'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : item.status === 'lendo'
                                    ? 'bg-blue-500/20 text-[#60A5FA] border border-blue-400/30'
                                    : 'bg-blue-950 text-blue-100 border border-blue-400/20'
                                }`}
                              >
                                {statusLabel[item.status]}
                              </span>
                            ) : (
                              <div />
                            )}

                            {/* Exclusão disponível apenas na aba de Favoritos */}
                            {activeTab === 'favoritos' && (
                              <button
                                type="button"
                                onClick={() => onRemoveFromList(book)}
                                title="Excluir livro dos Favoritos"
                                className="text-blue-300/60 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <h3
                            onClick={() => onSelectBook(book)}
                            className="font-display text-xl font-bold text-white hover:text-[#60A5FA] cursor-pointer truncate mt-1"
                          >
                            {book.titulo}
                          </h3>
                          <p className="text-xs text-blue-200/70 truncate">{book.autor}</p>

                          {/* Progress Bar */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[11px] font-mono-num text-blue-200/75 mb-1">
                              <span>
                                Pág. {item.paginaAtual} de {book.paginas}
                              </span>
                              <span className="text-[#60A5FA] font-bold">
                                {item.progresso}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-blue-950 overflow-hidden">
                              <div
                                className="h-full bg-[#3B82F6]"
                                style={{ width: `${item.progresso}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Bottom Controls — Estrela (Mostrar no perfil até 3 ou 5 no Premium) + Ler */}
                        <div className="mt-4 pt-3 border-t border-blue-400/15 flex flex-wrap items-center justify-between gap-2">
                          {(item.inMyList ||
                            item.isFavorite ||
                            item.status === 'quero_ler') &&
                          onToggleProfileFavoriteBook ? (
                            (() => {
                              const isShownOnProfile =
                                validSelectedProfileIds.includes(book.id);
                              const isLimitReached =
                                !isShownOnProfile &&
                                validSelectedProfileIds.length >= maxProfileFavorites;
                              return (
                                <button
                                  type="button"
                                  disabled={isLimitReached && isPremium}
                                  onClick={() => {
                                    if (isLimitReached && !isPremium) {
                                      onOpenPremiumModal?.();
                                      return;
                                    }
                                    onToggleProfileFavoriteBook(book);
                                  }}
                                  title={
                                    isLimitReached
                                      ? isPremium
                                        ? `Você já escolheu ${maxProfileFavorites} livros para o perfil. Desmarque um para selecionar este.`
                                        : 'Limite de 3 livros no plano gratuito atingido. Com LIVROFLIX Premium você pode exibir até 5 livros no perfil!'
                                      : isShownOnProfile
                                      ? 'Desmarcar exibição no perfil (continua na Minha lista)'
                                      : `Destacar este livro no perfil (${validSelectedProfileIds.length}/${maxProfileFavorites})`
                                  }
                                  aria-label="Destacar no perfil"
                                  className={`inline-flex items-center justify-center rounded-lg p-2 border transition-all ${
                                    isShownOnProfile
                                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-400 cursor-pointer'
                                      : isLimitReached
                                      ? isPremium
                                        ? 'bg-[#040D1A]/50 border-blue-400/15 text-blue-200/40 opacity-45 cursor-not-allowed'
                                        : 'bg-[#040D1A]/80 hover:bg-amber-500/15 border-amber-400/25 text-amber-300/75 hover:text-amber-300 cursor-pointer'
                                      : 'bg-[#040D1A] hover:bg-blue-500/15 border-blue-400/30 text-blue-200 hover:text-amber-400 cursor-pointer'
                                  }`}
                                >
                                  <Star
                                    className={`w-4 h-4 ${
                                      isShownOnProfile ? 'fill-amber-400' : ''
                                    }`}
                                  />
                                </button>
                              );
                            })()
                          ) : (
                            <div />
                          )}

                          <button
                            type="button"
                            onClick={() => onReadBook(book)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-4 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>
                              {item.progresso > 0 && item.progresso < 100
                                ? 'Continuar'
                                : 'Ler'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ✍️ Minhas Reviews Section — displayed in "Minha Lista Completa" and "✍️ Minhas Reviews" tab */}
        {(activeTab === 'lista' || activeTab === 'reviews') && (
          <div
            className={
              activeTab === 'lista'
                ? 'mt-12 pt-10 border-t border-blue-400/15'
                : ''
            }
          >
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Minhas Reviews
                </h2>
              </div>
              <span className="text-xs font-mono-num font-bold text-[#60A5FA]">
                {myPublishedReviews.length}{' '}
                {myPublishedReviews.length === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            {myPublishedReviews.length === 0 ? (
              <div className="rounded-2xl bg-[#071426]/80 border border-blue-400/20 p-8 sm:p-10 text-center max-w-xl mx-auto">
                <Edit3 className="w-9 h-9 text-[#60A5FA] mx-auto mb-3 opacity-80" />
                <h3 className="font-display text-xl font-bold text-white">
                  Você ainda não publicou nenhuma review
                </h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {myPublishedReviews.map(({ review, book }) => {
                  const reviewDateFormatted = (() => {
                    const d = new Date(review.createdAt);
                    if (Number.isNaN(d.getTime())) return '';
                    return d.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    });
                  })();
                  const snippet =
                    review.text.length > 220
                      ? `${review.text.slice(0, 220).trimEnd()}...`
                      : review.text;
                  const effectiveStars =
                    review.rating || userLibrary[book.id]?.avaliacaoUsuario || 0;

                  return (
                    <div
                      key={review.id}
                      onClick={() =>
                        onOpenBookReview
                          ? onOpenBookReview(book)
                          : onSelectBook(book)
                      }
                      className="flex gap-4 rounded-xl bg-[#071426] border border-blue-400/20 hover:border-[#60A5FA]/50 p-4 transition-all cursor-pointer group"
                    >
                      {/* Book Cover */}
                      <div className="w-24 sm:w-28 flex-shrink-0">
                        <BookCover book={book} />
                      </div>

                      {/* Review Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          {/* Indication that user evaluated this book + Date */}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Avaliado por você</span>
                            </span>
                            <span className="text-blue-200/65 font-mono-num">
                              {reviewDateFormatted}
                            </span>
                          </div>

                          <h3 className="font-display text-lg sm:text-xl font-bold text-white group-hover:text-[#60A5FA] transition-colors truncate mt-1.5">
                            {book.titulo}
                          </h3>
                          <p className="text-xs text-blue-200/70 truncate">
                            {book.autor}
                          </p>

                          {effectiveStars > 0 && (
                            <div className="mt-1.5 flex items-center gap-1 text-[#60A5FA]">
                              <span className="inline-flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => {
                                  if (effectiveStars >= star) {
                                    return (
                                      <Star
                                        key={star}
                                        className="w-3.5 h-3.5 fill-[#60A5FA] text-[#60A5FA]"
                                      />
                                    );
                                  }
                                  if (effectiveStars >= star - 0.5) {
                                    return (
                                      <span
                                        key={star}
                                        className="relative inline-flex w-3.5 h-3.5"
                                      >
                                        <Star className="w-3.5 h-3.5 text-blue-200/25" />
                                        <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                                          <Star className="w-3.5 h-3.5 fill-[#60A5FA] text-[#60A5FA]" />
                                        </span>
                                      </span>
                                    );
                                  }
                                  return (
                                    <Star
                                      key={star}
                                      className="w-3.5 h-3.5 text-blue-200/25"
                                    />
                                  );
                                })}
                              </span>
                              <span className="text-[11px] font-mono-num font-bold text-[#60A5FA]">
                                {Number.isInteger(effectiveStars)
                                  ? String(effectiveStars)
                                  : effectiveStars.toFixed(1).replace('.', ',')}
                              </span>
                            </div>
                          )}

                          {/* Review Excerpt */}
                          <p className="mt-2.5 text-xs sm:text-sm text-blue-100/85 line-clamp-3 leading-relaxed font-reader">
                            “{snippet}”
                          </p>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-blue-400/15 flex items-center justify-between text-xs font-semibold text-[#60A5FA] group-hover:text-blue-300">
                          <span>Ver review completa na página do livro</span>
                          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export interface ProfileUpdateInput {
  displayName: string;
  username: string;
  bio: string;
  photoURL: string;
  favoriteBooks?: string[];
}

export const ProfileFavoriteBooksShowcase: React.FC<{
  favoriteBookIds?: string[];
  books: Book[];
  maxBooks?: number;
  onSelectBook: (book: Book) => void;
}> = ({ favoriteBookIds, books, maxBooks = 3, onSelectBook }) => {
  const resolvedBooks = React.useMemo(() => {
    if (!Array.isArray(favoriteBookIds) || favoriteBookIds.length === 0) {
      return [];
    }
    const booksMap = new Map(books.map((b) => [b.id, b]));
    const seen = new Set<string>();
    const result: Book[] = [];
    for (const id of favoriteBookIds) {
      if (id && !seen.has(id)) {
        const found = booksMap.get(id);
        if (found) {
          seen.add(id);
          result.push(found);
          if (result.length === maxBooks) break;
        }
      }
    }
    return result;
  }, [favoriteBookIds, books, maxBooks]);

  if (resolvedBooks.length === 0) return null;

  return (
    <div>
      <h2 className="font-display text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
        <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
        <span>Meus livros favoritos</span>
      </h2>

      <div className="flex flex-wrap items-start gap-4">
        {resolvedBooks.map((book) => (
          <div
            key={book.id}
            onClick={() => onSelectBook(book)}
            className="cursor-pointer group w-28 sm:w-32"
          >
            <BookCover
              book={book}
              className="group-hover:scale-[1.03] transition-transform"
            />
            <p className="mt-2 text-xs font-semibold text-white truncate">
              {book.titulo}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ProfileBadgesShowcase: React.FC<{
  unlockedBadgeIds?: string[];
  profileBadgeIds?: string[];
  isOwner?: boolean;
  onToggleProfileBadge?: (badgeId: BadgeId) => void;
  customBadgeImages?: Record<string, string>;
}> = ({
  unlockedBadgeIds = [],
  profileBadgeIds = [],
  isOwner = false,
  onToggleProfileBadge,
  customBadgeImages,
}) => {
  const [isSelecting, setIsSelecting] = useState(false);

  const validUnlockedIds = React.useMemo(() => {
    const seen = new Set<BadgeId>();
    const list: BadgeId[] = [];
    for (const raw of unlockedBadgeIds) {
      if (isValidBadgeId(raw) && !seen.has(raw)) {
        seen.add(raw);
        list.push(raw);
      }
    }
    return list;
  }, [unlockedBadgeIds]);

  const validDisplayedIds = React.useMemo(() => {
    const unlockedSet = new Set<BadgeId>(validUnlockedIds);
    const seen = new Set<BadgeId>();
    const list: BadgeId[] = [];
    for (const raw of profileBadgeIds) {
      if (isValidBadgeId(raw) && unlockedSet.has(raw) && !seen.has(raw)) {
        seen.add(raw);
        list.push(raw);
      }
    }
    return list;
  }, [profileBadgeIds, validUnlockedIds]);

  // Do not leave any empty space if there are no badges to show (and owner has 0 unlocked badges)
  if (validDisplayedIds.length === 0 && (!isOwner || validUnlockedIds.length === 0)) {
    return null;
  }

  return (
    <div className="relative flex flex-col items-center sm:items-end">
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5">
        {validDisplayedIds.map((badgeId) => {
          const def = BADGE_DEFINITIONS[badgeId];
          if (!def) return null;
          return (
            <div
              key={badgeId}
              title={def.name}
              className="inline-flex items-center justify-center transition-transform hover:scale-110"
            >
              <BadgeImage
                badgeId={badgeId}
                customBadgeImages={customBadgeImages}
                className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
              />
            </div>
          );
        })}

        {isOwner && validUnlockedIds.length > 0 && onToggleProfileBadge && (
          <button
            type="button"
            onClick={() => setIsSelecting((prev) => !prev)}
            title={isSelecting ? 'Concluir edição de selos' : 'Editar selos do perfil'}
            className="inline-flex items-center justify-center rounded-full bg-[#040D1A]/85 hover:bg-blue-500/25 border border-blue-400/30 px-2.5 py-1 text-[11px] font-semibold text-[#60A5FA] transition-colors cursor-pointer"
          >
            <span>
              {isSelecting
                ? 'Concluir'
                : validDisplayedIds.length === 0
                ? `+ Selos (${validUnlockedIds.length})`
                : 'Editar'}
            </span>
          </button>
        )}
      </div>

      {isOwner && isSelecting && validUnlockedIds.length > 0 && onToggleProfileBadge && (
        <div className="mt-2 z-30 rounded-xl bg-[#040D1A]/95 border border-blue-400/30 p-3 shadow-2xl max-w-xs sm:max-w-sm">
          <p className="text-[11px] text-blue-200/75 mb-2 text-left">
            Toque nos selos para exibir ou ocultar no topo direito do perfil:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {validUnlockedIds.map((badgeId) => {
              const def = BADGE_DEFINITIONS[badgeId];
              const isVisible = validDisplayedIds.includes(badgeId);
              if (!def) return null;
              return (
                <button
                  key={badgeId}
                  type="button"
                  title={def.name}
                  onClick={() => onToggleProfileBadge(badgeId)}
                  className={`relative inline-flex items-center justify-center rounded-xl p-1.5 border transition-all cursor-pointer ${
                    isVisible
                      ? 'bg-[#2563EB]/25 border-[#60A5FA] ring-1 ring-[#60A5FA]'
                      : 'bg-[#071426] border-blue-400/20 opacity-50 hover:opacity-100'
                  }`}
                >
                  <BadgeImage
                    badgeId={badgeId}
                    customBadgeImages={customBadgeImages}
                    className="w-8 h-8 shrink-0"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const BIO_MAX_LENGTH = 160;
const NAME_MAX_LENGTH = 60;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
export const USERNAME_MAX_CHANGES_PER_WINDOW = 2;
export const USERNAME_CHANGE_WINDOW_DAYS = 15;
export const USERNAME_CHANGE_WINDOW_MS =
  USERNAME_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function getLocalUsernameChangeHistory(uid: string): string[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(`livroflix_username_changes_${uid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveLocalUsernameChangeHistory(
  uid: string,
  timestamps: string[]
): void {
  if (!uid) return;
  try {
    localStorage.setItem(
      `livroflix_username_changes_${uid}`,
      JSON.stringify(timestamps.slice(-5))
    );
  } catch {
    // ignore storage errors
  }
}

export function getUsernameChangeStatus(
  userProfile?: UserProfile | null,
  nowMs = Date.now()
): {
  changesInWindow: number;
  remainingChanges: number;
  canChange: boolean;
  daysUntilAvailable: number;
  nextAvailableDateFormatted: string;
  validTimestampsIso: string[];
} {
  const profileHistory = Array.isArray(userProfile?.usernameChangeHistory)
    ? userProfile!.usernameChangeHistory.filter(
        (item): item is string => typeof item === 'string'
      )
    : [];
  const localHistory = userProfile?.uid
    ? getLocalUsernameChangeHistory(userProfile.uid)
    : [];

  const mergedSet = new Set<string>([...profileHistory, ...localHistory]);
  const validEntries: { iso: string; ms: number }[] = [];

  for (const iso of mergedSet) {
    const ms = new Date(iso).getTime();
    if (
      !Number.isNaN(ms) &&
      ms <= nowMs + 60000 &&
      nowMs - ms < USERNAME_CHANGE_WINDOW_MS
    ) {
      validEntries.push({ iso: new Date(ms).toISOString(), ms });
    }
  }

  validEntries.sort((a, b) => a.ms - b.ms);
  const validTimestampsIso = validEntries.map((e) => e.iso);
  const changesInWindow = validEntries.length;
  const remainingChanges = Math.max(
    0,
    USERNAME_MAX_CHANGES_PER_WINDOW - changesInWindow
  );
  const canChange = remainingChanges > 0;

  let daysUntilAvailable = 0;
  let nextAvailableDateFormatted = '';

  if (!canChange && validEntries.length >= USERNAME_MAX_CHANGES_PER_WINDOW) {
    const unlockEntry =
      validEntries[validEntries.length - USERNAME_MAX_CHANGES_PER_WINDOW];
    const unlockMs = unlockEntry.ms + USERNAME_CHANGE_WINDOW_MS;
    daysUntilAvailable = Math.max(
      1,
      Math.ceil((unlockMs - nowMs) / (24 * 60 * 60 * 1000))
    );
    nextAvailableDateFormatted = new Date(unlockMs).toLocaleDateString(
      'pt-BR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }
    );
  }

  return {
    changesInWindow,
    remainingChanges,
    canChange,
    daysUntilAvailable,
    nextAvailableDateFormatted,
    validTimestampsIso,
  };
}

export function sanitizeUsernameInput(raw: string): string {
  return raw
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .slice(0, USERNAME_MAX_LENGTH);
}

export function validateUsernameFormat(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = raw.trim().replace(/^@+/, '').toLowerCase();
  if (!normalized) {
    return {
      valid: false,
      normalized: '',
      error: 'Informe um nome de usuário.',
    };
  }
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `O nome de usuário deve ter pelo menos ${USERNAME_MIN_LENGTH} caracteres.`,
    };
  }
  if (normalized.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      normalized,
      error: `O nome de usuário pode ter no máximo ${USERNAME_MAX_LENGTH} caracteres.`,
    };
  }
  if (!/^[a-z0-9._]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        'Use apenas letras minúsculas (a-z), números (0-9), ponto (.) e sublinhado (_), sem espaços.',
    };
  }
  if (
    normalized.startsWith('.') ||
    normalized.endsWith('.') ||
    normalized.includes('..')
  ) {
    return {
      valid: false,
      normalized,
      error:
        'O nome de usuário não pode começar ou terminar com ponto, nem ter pontos seguidos.',
    };
  }
  return { valid: true, normalized };
}

export function generateDefaultUsername(
  profile: Pick<UserProfile, 'nome' | 'displayName' | 'email' | 'uid'>
): string {
  const baseRaw =
    profile.email?.split('@')[0] ||
    profile.displayName ||
    profile.nome ||
    'leitor';
  const cleaned = baseRaw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._]+/g, '')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');

  if (cleaned.length >= USERNAME_MIN_LENGTH) {
    return cleaned.slice(0, 24);
  }
  const uidSuffix = (profile.uid || '100')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(-4);
  return `leitor_${uidSuffix || 'lf'}`;
}

async function compressProfileAvatarToDataUrl(
  file: File,
  maxSize = 360,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem válido (JPG, PNG, WEBP).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Center-crop square avatar like Instagram
        const minSide = Math.min(img.width, img.height);
        const sx = Math.max(0, Math.floor((img.width - minSide) / 2));
        const sy = Math.max(0, Math.floor((img.height - minSide) / 2));
        const targetDim = Math.min(maxSize, minSide || maxSize);

        canvas.width = targetDim;
        canvas.height = targetDim;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(
          img,
          sx,
          sy,
          minSide,
          minSide,
          0,
          0,
          targetDim,
          targetDim
        );
        let compressed = canvas.toDataURL('image/jpeg', quality);
        if (compressed.length > 220000) {
          compressed = canvas.toDataURL('image/jpeg', 0.68);
        }
        resolve(compressed);
      };
      img.onerror = () =>
        reject(new Error('Não foi possível carregar a imagem selecionada.'));
      img.src = String(reader.result);
    };
    reader.onerror = () =>
      reject(new Error('Erro ao ler o arquivo de imagem do dispositivo.'));
    reader.readAsDataURL(file);
  });
}

interface ProfileViewProps {
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  books: Book[];
  userLibrary: Record<string, UserBookItem>;
  communityPosts?: CommunityPost[];
  communityLikes?: CommunityLike[];
  communityReplies?: CommunityReply[];
  communityFollows?: CommunityFollow[];
  publicProfilesMap?: Record<string, PublicProfile>;
  onSignIn: () => Promise<void> | void;
  onDirectSignIn?: (email: string, nome?: string) => Promise<void> | void;
  onSignOut: () => void;
  onSelectBook: (book: Book) => void;
  onOpenAdmin: () => void;
  onNavigateCommunity?: () => void;
  onUpdateOwnProfile?: (input: ProfileUpdateInput) => Promise<void>;
  onSaveProfileCustomization?: (
    customization: ProfileCustomization
  ) => Promise<void>;
  onToggleProfileBadge?: (badgeId: BadgeId) => Promise<void> | void;
  onToggleCommunityLike?: (post: CommunityPost) => Promise<void>;
  onCreateCommunityReply?: (input: CreateReplyInput) => Promise<void>;
  onDeleteCommunityPost?: (postId: string) => Promise<void>;
  onDeleteCommunityReply?: (replyId: string) => Promise<void>;
  onToggleCommunityFollow?: (targetUserId: string) => Promise<void>;
  onOpenPremiumModal?: () => void;
  platformSettings?: PlatformSettings;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  isAuthenticated,
  isAdmin,
  books,
  userLibrary,
  communityPosts = [],
  communityLikes = [],
  communityReplies = [],
  communityFollows = [],
  publicProfilesMap = {},
  onSignIn,
  onDirectSignIn,
  onSignOut,
  onSelectBook,
  onOpenAdmin,
  onNavigateCommunity,
  onUpdateOwnProfile,
  onSaveProfileCustomization,
  onToggleProfileBadge,
  onToggleCommunityLike,
  onCreateCommunityReply,
  onDeleteCommunityPost,
  onDeleteCommunityReply,
  onToggleCommunityFollow,
  onOpenPremiumModal,
  platformSettings,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [directEmail, setDirectEmail] = useState('');
  const [directName, setDirectName] = useState('');

  // Settings Page & Edit/Customize Profile state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'personalizar' | 'editar'>(
    'personalizar'
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [draftCustomization, setDraftCustomization] =
    useState<ProfileCustomization>(DEFAULT_PROFILE_CUSTOMIZATION);
  const [showOwnPosts, setShowOwnPosts] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhotoPreview, setEditPhotoPreview] = useState('');
  const [editFavoriteSlots, setEditFavoriteSlots] = useState<
    (string | null)[]
  >([null, null, null, null, null]);
  const [activeFavoriteSlotIndex, setActiveFavoriteSlotIndex] = useState<
    number | null
  >(null);
  const [favoriteBookSearchQuery, setFavoriteBookSearchQuery] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [profileSaveFeedback, setProfileSaveFeedback] = useState<string | null>(
    null
  );
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const displayName =
    userProfile?.displayName || userProfile?.nome || 'Leitor LIVROFLIX';
  const displayPhoto = userProfile?.photoURL ?? userProfile?.foto ?? '';
  const displayUsername = userProfile?.username
    ? userProfile.username.replace(/^@+/, '')
    : userProfile
    ? generateDefaultUsername(userProfile)
    : '';
  const displayBio = userProfile?.bio || '';

  const openSettingsPage = (
    initialSection: 'personalizar' | 'editar' = 'personalizar'
  ) => {
    if (!userProfile) return;
    const currentUsername = userProfile.username
      ? userProfile.username.replace(/^@+/, '')
      : generateDefaultUsername(userProfile);
    setEditDisplayName(currentUsername);
    setEditUsername(currentUsername);
    setEditBio(userProfile.bio || '');
    setEditPhotoPreview(userProfile.photoURL ?? userProfile.foto ?? '');
    const savedFavs = Array.isArray(userProfile.profileFavoriteBooks)
      ? userProfile.profileFavoriteBooks
      : Array.isArray(userProfile.favoriteBooks)
      ? userProfile.favoriteBooks
      : [];
    setEditFavoriteSlots([
      savedFavs[0] || null,
      savedFavs[1] || null,
      savedFavs[2] || null,
      savedFavs[3] || null,
      savedFavs[4] || null,
    ]);
    setActiveFavoriteSlotIndex(null);
    setFavoriteBookSearchQuery('');
    setEditError(null);
    setDraftCustomization({
      ...(userProfile.profileCustomization || DEFAULT_PROFILE_CUSTOMIZATION),
      usernameColor:
        userProfile.usernameColor ||
        userProfile.profileCustomization?.usernameColor,
    });
    setSettingsTab(initialSection);
    setIsSettingsOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditProfileModal = () => {
    openSettingsPage('editar');
  };

  const openCustomizeProfileModal = () => {
    openSettingsPage('personalizar');
  };

  const handleSaveCustomization = async (
    finalCustomization: ProfileCustomization
  ) => {
    if (!onSaveProfileCustomization) return;
    await onSaveProfileCustomization(finalCustomization);
    setIsCustomizeModalOpen(false);
    setIsSettingsOpen(false);
    setProfileSaveFeedback('Aparência do perfil salva com sucesso!');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      setProfileSaveFeedback(null);
    }, 3500);
  };

  const isCustomizingLive =
    isCustomizeModalOpen || (isSettingsOpen && settingsTab === 'personalizar');

  const activeCustomization: ProfileCustomization | undefined =
    isCustomizingLive
      ? draftCustomization
      : getEffectiveProfileCustomization(
          userProfile,
          userProfile?.profileCustomization
        );

  const effectiveUsernameColor = isCustomizingLive
    ? getEffectiveUsernameColor({
        premium: userProfile?.premium,
        usernameColor: draftCustomization.usernameColor,
        profileCustomization: draftCustomization,
      })
    : getEffectiveUsernameColor(userProfile);

  const isPremium = isUserPremium(userProfile);
  const maxProfileFavorites = getMaxProfileFavoriteBooks(userProfile);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditModalOpen && !isSavingProfile) {
        setIsEditModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen, isSavingProfile]);

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditError(null);
    setIsProcessingPhoto(true);
    try {
      const optimizedDataUrl = await compressProfileAvatarToDataUrl(file);
      setEditPhotoPreview(optimizedDataUrl);
    } catch (err: unknown) {
      setEditError(
        err instanceof Error
          ? err.message
          : 'Não foi possível processar a imagem selecionada.'
      );
    } finally {
      setIsProcessingPhoto(false);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = () => {
    setEditPhotoPreview('');
    setEditError(null);
    if (avatarFileInputRef.current) {
      avatarFileInputRef.current.value = '';
    }
  };

  const handleSelectFavoriteBookForSlot = (slotIdx: number, bookId: string) => {
    setEditFavoriteSlots((prev) => {
      const next: (string | null)[] = [...prev];
      // Prevent duplicating the same book across positions
      for (let i = 0; i < next.length; i++) {
        if (i !== slotIdx && next[i] === bookId) {
          next[i] = null;
        }
      }
      next[slotIdx] = bookId;
      return next;
    });
    setActiveFavoriteSlotIndex(null);
    setFavoriteBookSearchQuery('');
  };

  const handleRemoveFavoriteSlot = (slotIdx: number) => {
    setEditFavoriteSlots((prev) => {
      const next: (string | null)[] = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  const handleMoveFavoriteSlot = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= maxProfileFavorites) return;
    setEditFavoriteSlots((prev) => {
      const next: (string | null)[] = [...prev];
      const temp = next[fromIdx];
      next[fromIdx] = next[toIdx];
      next[toIdx] = temp;
      return next;
    });
  };

  const filteredCatalogBooksForFavorites = React.useMemo(() => {
    const q = favoriteBookSearchQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.titulo.toLowerCase().includes(q) ||
        b.autor.toLowerCase().includes(q)
    );
  }, [books, favoriteBookSearchQuery]);

  const handleSaveProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !onUpdateOwnProfile) return;
    setEditError(null);

    const usernameCheck = validateUsernameFormat(editUsername);
    if (!usernameCheck.valid) {
      setEditError(usernameCheck.error || 'Nome de usuário inválido.');
      return;
    }

    const currentNormalizedUsername = (
      userProfile.username || generateDefaultUsername(userProfile)
    )
      .replace(/^@+/, '')
      .toLowerCase();
    const isChangingUsername =
      usernameCheck.normalized !== currentNormalizedUsername;
    const changeStatus = getUsernameChangeStatus(userProfile);

    if (isChangingUsername && !changeStatus.canChange) {
      setEditError(
        `Você só pode mudar o @username 2 vezes a cada 15 dias. Próxima alteração disponível em ${
          changeStatus.daysUntilAvailable
        } ${changeStatus.daysUntilAvailable === 1 ? 'dia' : 'dias'} (${
          changeStatus.nextAvailableDateFormatted
        }).`
      );
      return;
    }

    const cleanBio = editBio.trim();
    if (cleanBio.length > BIO_MAX_LENGTH) {
      setEditError(`A bio pode ter no máximo ${BIO_MAX_LENGTH} caracteres.`);
      return;
    }

    const orderedChosenFavorites = editFavoriteSlots.filter(
      (id): id is string => Boolean(id)
    );

    setIsSavingProfile(true);
    try {
      await onUpdateOwnProfile({
        displayName: usernameCheck.normalized,
        username: usernameCheck.normalized,
        bio: cleanBio,
        photoURL: editPhotoPreview,
        favoriteBooks: orderedChosenFavorites,
      });
      setIsEditModalOpen(false);
      setIsSettingsOpen(false);
      setProfileSaveFeedback('Perfil atualizado com sucesso!');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        setProfileSaveFeedback(null);
      }, 3500);
    } catch (err: unknown) {
      setEditError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar as alterações do perfil.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleGoogleLoginClick = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await onSignIn();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `O domínio atual (${window.location.hostname}) ainda não foi adicionado em Firebase Console → Authentication → Settings → Authorized domains. Você pode entrar imediatamente usando seu e-mail abaixo.`
        );
      } else if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user'
      ) {
        setAuthError(
          'A janela de login do Google foi bloqueada ou fechada. Tente novamente ou entre diretamente com seu e-mail abaixo.'
        );
      } else {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Não foi possível concluir o login com Google. Use o acesso por e-mail abaixo.'
        );
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDirectEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = directEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !onDirectSignIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await onDirectSignIn(cleanEmail, directName.trim() || undefined);
      setDirectEmail('');
      setDirectName('');
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'Erro ao acessar a conta.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const entries = Object.values(userLibrary);
  const completedBooksCount = entries.filter(
    (i) => i.status === 'concluido'
  ).length;
  const currentlyReadingCount = entries.filter(
    (i) => i.status === 'lendo'
  ).length;
  const favoritesCount = entries.filter(
    (i) => i.isFavorite || i.status === 'quero_ler'
  ).length;
  const totalPagesRead = entries.reduce((acc, item) => {
    if (item.status === 'concluido') return acc + item.totalPaginas;
    return acc + (item.paginaAtual > 1 ? item.paginaAtual : 0);
  }, 0);

  const favoriteBooks = React.useMemo(() => {
    const rawSelectedIds = Array.isArray(userProfile?.profileFavoriteBooks)
      ? userProfile.profileFavoriteBooks
      : Array.isArray(userProfile?.favoriteBooks)
      ? userProfile.favoriteBooks
      : [];
    if (rawSelectedIds.length === 0) return [];

    const booksMap = new Map(books.map((b) => [b.id, b]));
    const seen = new Set<string>();
    const result: Book[] = [];

    for (const id of rawSelectedIds) {
      const libItem = userLibrary[id];
      const isFavoritedInMyList =
        Boolean(libItem) &&
        (libItem.inMyList ||
          libItem.isFavorite ||
          libItem.status === 'quero_ler');
      if (isFavoritedInMyList && !seen.has(id)) {
        const foundBook = booksMap.get(id);
        if (foundBook) {
          seen.add(id);
          result.push(foundBook);
          if (result.length === maxProfileFavorites) break;
        }
      }
    }
    return result;
  }, [
    books,
    userLibrary,
    userProfile?.profileFavoriteBooks,
    userProfile?.favoriteBooks,
    maxProfileFavorites,
  ]);

  const userPosts = React.useMemo(() => {
    if (!userProfile?.uid) return [];
    return communityPosts
      .filter((p) => p.authorId === userProfile.uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [communityPosts, userProfile?.uid]);

  const followersCount = React.useMemo(() => {
    if (!userProfile?.uid) return 0;
    return communityFollows.filter((f) => f.followingId === userProfile.uid)
      .length;
  }, [communityFollows, userProfile?.uid]);

  const followingCount = React.useMemo(() => {
    if (!userProfile?.uid) return 0;
    return communityFollows.filter((f) => f.followerId === userProfile.uid)
      .length;
  }, [communityFollows, userProfile?.uid]);

  const { achievements, computedUnlockedBadgeIds } = React.useMemo(
    () =>
      evaluateLiteraryAchievementsAndBadges(books, userLibrary, userProfile),
    [books, userLibrary, userProfile]
  );

  const [showMoreAchievements, setShowMoreAchievements] = useState(false);

  const initialAchievements = React.useMemo(
    () => achievements.filter((ach) => ach.isInitial),
    [achievements]
  );

  const additionalAchievements = React.useMemo(
    () => achievements.filter((ach) => !ach.isInitial),
    [achievements]
  );

  const effectiveUnlockedBadges = React.useMemo(() => {
    const existing = Array.isArray(userProfile?.unlockedBadges)
      ? userProfile.unlockedBadges.filter(isValidBadgeId)
      : [];
    return Array.from(new Set<BadgeId>([...existing, ...computedUnlockedBadgeIds]));
  }, [userProfile?.unlockedBadges, computedUnlockedBadgeIds]);

  const effectiveProfileBadges = React.useMemo(() => {
    const unlockedSet = new Set<BadgeId>(effectiveUnlockedBadges);
    const raw = Array.isArray(userProfile?.profileBadges)
      ? userProfile.profileBadges
      : [];
    return raw.filter(
      (id): id is BadgeId => isValidBadgeId(id) && unlockedSet.has(id)
    );
  }, [userProfile?.profileBadges, effectiveUnlockedBadges]);

  const liveUsernameValidation = validateUsernameFormat(editUsername);
  const usernameChangeStatus = getUsernameChangeStatus(userProfile);

  // ABA DEDICADA DE CONFIGURAÇÕES (Editar perfil, Personalizar perfil e Sair da conta)
  if (isSettingsOpen && isAuthenticated && userProfile) {
    return (
      <div
        className="min-h-screen relative pt-28 lg:pt-24 pb-24 transition-colors duration-300"
        style={getProfileBackgroundStyle(activeCustomization)}
      >
        <ProfileDecorativeEffectLayer effect={activeCustomization?.effects} />

        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-8 space-y-8">
          {/* Top Header of Settings Tab */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-blue-400/20">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#071426] hover:bg-[#0B1E36] border border-blue-400/30 px-4 py-2.5 text-xs sm:text-sm font-bold text-blue-100 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-[#60A5FA]" />
                <span>Voltar ao perfil</span>
              </button>
            </div>

            {/* Quick Account Actions inside Settings */}
            <div className="flex flex-wrap items-center gap-2.5">
              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#60A5FA] transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Painel Admin</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen(false);
                  onSignOut();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-950/60 hover:bg-rose-500/20 border border-blue-400/20 hover:border-rose-500/40 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Sair da conta</span>
              </button>
            </div>
          </div>

          {/* Section Switcher: Personalizar perfil | Editar perfil */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSettingsTab('personalizar')}
              className={`inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-bold transition-all cursor-pointer ${
                settingsTab === 'personalizar'
                  ? 'bg-[#2563EB] text-white shadow-lg'
                  : 'bg-[#071426] text-blue-200/80 hover:text-white border border-blue-400/25'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Personalizar perfil</span>
            </button>

            <button
              type="button"
              onClick={() => setSettingsTab('editar')}
              className={`inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-bold transition-all cursor-pointer ${
                settingsTab === 'editar'
                  ? 'bg-[#2563EB] text-white shadow-lg'
                  : 'bg-[#071426] text-blue-200/80 hover:text-white border border-blue-400/25'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar perfil</span>
            </button>
          </div>

          {/* SECTION 1: PERSONALIZAR PERFIL (Full-page spacious layout) */}
          {settingsTab === 'personalizar' && (
            <ProfileCustomizationModal
              isOpen={true}
              mode="inline"
              userProfile={userProfile}
              draft={draftCustomization}
              onChangeDraft={setDraftCustomization}
              onSave={handleSaveCustomization}
              onOpenPremiumModal={onOpenPremiumModal}
              onCancel={() => {
                setIsSettingsOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {/* SECTION 2: EDITAR PERFIL (Full-page spacious layout) */}
          {settingsTab === 'editar' && (
            <div className="rounded-2xl bg-[#071426] border border-blue-400/25 shadow-2xl overflow-hidden max-w-2xl">
              <div className="px-6 py-5 border-b border-blue-400/15 bg-[#040D1A]/60">
                <h2 className="font-display text-2xl font-bold text-white">
                  Editar perfil
                </h2>
                <p className="text-xs sm:text-sm text-blue-200/75 mt-0.5">
                  Atualize sua foto, @username e bio
                </p>
              </div>

              <form
                onSubmit={handleSaveProfileSubmit}
                className="p-6 sm:p-8 space-y-6"
              >
                {/* Avatar Picker & Preview */}
                <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-blue-400/15">
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />

                  <div
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="relative h-24 w-24 rounded-full overflow-hidden ring-2 ring-[#60A5FA] bg-[#040D1A] flex items-center justify-center cursor-pointer group shadow-xl shrink-0"
                    title="Clique para selecionar uma nova foto"
                  >
                    {editPhotoPreview ? (
                      <img
                        src={editPhotoPreview}
                        alt="Prévia da foto de perfil"
                        className="h-full w-full object-cover group-hover:opacity-80 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="font-display text-4xl font-bold text-[#60A5FA]">
                        {(editUsername || displayUsername || 'L')[0].toUpperCase()}
                      </span>
                    )}

                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {isProcessingPhoto ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6 text-white" />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center sm:items-start gap-2">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        disabled={isProcessingPhoto || isSavingProfile}
                        onClick={() => avatarFileInputRef.current?.click()}
                        className="rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 px-4 py-2 text-xs sm:text-sm font-bold text-[#60A5FA] transition-colors cursor-pointer"
                      >
                        {isProcessingPhoto ? 'Processando...' : 'Alterar foto'}
                      </button>

                      {editPhotoPreview && (
                        <button
                          type="button"
                          disabled={isProcessingPhoto || isSavingProfile}
                          onClick={handleRemoveAvatar}
                          className="rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 px-4 py-2 text-xs sm:text-sm font-semibold text-rose-300 transition-colors cursor-pointer"
                        >
                          Remover foto
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-blue-200/65">
                      JPG, PNG ou WebP. Ajustada automaticamente para o seu perfil.
                    </p>
                  </div>
                </div>

                {editError && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3.5 text-xs sm:text-sm text-rose-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Field: Nome de usuário (@username) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="settings-edit-username"
                      className="block text-xs sm:text-sm font-semibold text-blue-200/90"
                    >
                      Nome de usuário
                    </label>
                    <span className="text-[11px] font-mono-num text-blue-300/60">
                      {editUsername.length}/{USERNAME_MAX_LENGTH}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-sm font-bold text-[#60A5FA] select-none pointer-events-none flex items-center">
                      <AtSign className="w-4 h-4" />
                    </span>
                    <input
                      id="settings-edit-username"
                      type="text"
                      required
                      disabled={!usernameChangeStatus.canChange}
                      maxLength={USERNAME_MAX_LENGTH}
                      value={editUsername}
                      onChange={(e) =>
                        setEditUsername(sanitizeUsernameInput(e.target.value))
                      }
                      placeholder="nomeusuario"
                      className={`w-full rounded-xl bg-[#040D1A] border pl-9 pr-4 py-3 text-sm text-white placeholder-blue-300/35 focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        editUsername.length > 0 && !liveUsernameValidation.valid
                          ? 'border-amber-400/60 focus:border-amber-400'
                          : 'border-blue-400/25 focus:border-[#60A5FA]'
                      }`}
                    />
                  </div>
                  {editUsername.length > 0 && !liveUsernameValidation.valid ? (
                    <p className="mt-1.5 text-xs text-amber-300">
                      {liveUsernameValidation.error}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-blue-300/60">
                      Seu identificador único no LIVROFLIX: @{editUsername || 'nomeusuario'}
                    </p>
                  )}
                  <p
                    className={`mt-1 text-xs ${
                      usernameChangeStatus.canChange
                        ? 'text-blue-200/70'
                        : 'text-amber-300 font-semibold'
                    }`}
                  >
                    {usernameChangeStatus.canChange
                      ? `Você só pode mudar o @username 2 vezes a cada 15 dias (${usernameChangeStatus.remainingChanges}/2 alterações restantes).`
                      : `Limite atingido: você já mudou o @username 2 vezes nos últimos 15 dias. Próxima alteração em ${
                          usernameChangeStatus.daysUntilAvailable
                        } ${
                          usernameChangeStatus.daysUntilAvailable === 1
                            ? 'dia'
                            : 'dias'
                        } (${usernameChangeStatus.nextAvailableDateFormatted}).`}
                  </p>
                </div>

                {/* Field: Bio */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="settings-edit-bio"
                      className="block text-xs sm:text-sm font-semibold text-blue-200/90"
                    >
                      Bio
                    </label>
                    <span
                      className={`text-[11px] font-mono-num ${
                        editBio.length >= BIO_MAX_LENGTH
                          ? 'text-amber-400 font-bold'
                          : 'text-blue-300/60'
                      }`}
                    >
                      {editBio.length}/{BIO_MAX_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="settings-edit-bio"
                    rows={4}
                    maxLength={BIO_MAX_LENGTH}
                    value={editBio}
                    onChange={(e) =>
                      setEditBio(e.target.value.slice(0, BIO_MAX_LENGTH))
                    }
                    placeholder="Conte um pouco sobre você e seus gêneros literários favoritos..."
                    className="w-full rounded-xl bg-[#040D1A] border border-blue-400/25 p-3.5 text-sm text-white placeholder-blue-300/35 focus:border-[#60A5FA] focus:outline-none transition-colors resize-none"
                  />
                </div>

                {/* Footer Actions */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-blue-400/15">
                  <button
                    type="button"
                    disabled={isSavingProfile}
                    onClick={() => {
                      setIsSettingsOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="rounded-xl border border-blue-400/25 bg-blue-950/40 hover:bg-blue-950/80 px-5 py-2.5 text-xs sm:text-sm font-semibold text-blue-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingProfile || isProcessingPhoto}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-60 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <span>Salvar alterações</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* MODAL SELETOR DE LIVROS DO CATÁLOGO PARA OS 3 FAVORITOS */}
          {activeFavoriteSlotIndex !== null && (
            <div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
              onClick={() => setActiveFavoriteSlotIndex(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-[#071426] border border-blue-400/30 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-blue-400/15 bg-[#040D1A]/80">
                  <div>
                    <h3 className="font-display text-xl font-bold text-white">
                      Escolher Favorito {activeFavoriteSlotIndex + 1}
                    </h3>
                    <p className="text-xs text-blue-200/70">
                      Selecione um livro do catálogo do LIVROFLIX
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveFavoriteSlotIndex(null)}
                    className="rounded-full p-2 text-blue-200/70 hover:bg-blue-500/15 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 border-b border-blue-400/15 bg-[#040D1A]/40">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-blue-300/60 absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      value={favoriteBookSearchQuery}
                      onChange={(e) =>
                        setFavoriteBookSearchQuery(e.target.value)
                      }
                      placeholder="Pesquisar por título ou autor..."
                      className="w-full rounded-xl bg-[#040D1A] border border-blue-400/25 pl-10 pr-4 py-2.5 text-sm text-white placeholder-blue-300/40 focus:border-[#60A5FA] focus:outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="p-5 overflow-y-auto flex-1">
                  {filteredCatalogBooksForFavorites.length === 0 ? (
                    <p className="text-center text-sm text-blue-200/65 py-8">
                      Nenhum livro encontrado para "{favoriteBookSearchQuery}".
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {filteredCatalogBooksForFavorites.map((book) => {
                        const existingSlotIdx = editFavoriteSlots.findIndex(
                          (id) => id === book.id
                        );
                        const isAlreadyInOtherSlot =
                          existingSlotIdx !== -1 &&
                          existingSlotIdx !== activeFavoriteSlotIndex;
                        const isCurrentSlotBook =
                          existingSlotIdx === activeFavoriteSlotIndex;

                        return (
                          <button
                            key={book.id}
                            type="button"
                            disabled={isAlreadyInOtherSlot}
                            onClick={() =>
                              handleSelectFavoriteBookForSlot(
                                activeFavoriteSlotIndex,
                                book.id
                              )
                            }
                            className={`group rounded-xl border p-2.5 text-left transition-all flex flex-col justify-between ${
                              isCurrentSlotBook
                                ? 'border-[#60A5FA] bg-blue-500/15 cursor-pointer'
                                : isAlreadyInOtherSlot
                                ? 'border-blue-400/10 bg-[#040D1A]/40 opacity-45 cursor-not-allowed'
                                : 'border-blue-400/20 bg-[#040D1A]/80 hover:border-[#60A5FA] cursor-pointer'
                            }`}
                          >
                            <div>
                              <div className="overflow-hidden rounded-lg border border-blue-400/15">
                                <BookCover
                                  book={book}
                                  className="group-hover:scale-[1.02] transition-transform"
                                />
                              </div>
                              <p className="mt-2 text-xs font-bold text-white line-clamp-2">
                                {book.titulo}
                              </p>
                              <p className="text-[11px] text-blue-200/70 truncate mt-0.5">
                                {book.autor}
                              </p>
                            </div>

                            {isAlreadyInOtherSlot && (
                              <span className="mt-2 inline-block text-[10px] font-semibold text-amber-300">
                                Já em Favorito {existingSlotIdx + 1}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative pt-28 lg:pt-24 pb-24 transition-colors duration-300"
      style={getProfileBackgroundStyle(activeCustomization)}
    >
      <ProfileDecorativeEffectLayer effect={activeCustomization?.effects} />

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-8 space-y-10">
        {profileSaveFeedback && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/30 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-300 flex items-center justify-between gap-3 shadow-lg">
            <span className="inline-flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              {profileSaveFeedback}
            </span>
            <button
              type="button"
              onClick={() => setProfileSaveFeedback(null)}
              className="text-emerald-200/70 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Profile Header Card — Literary Identity */}
        <div className="relative rounded-2xl bg-gradient-to-br from-[#071426] to-[#0B1E36] border border-blue-400/25 p-6 sm:p-8 shadow-2xl overflow-hidden">
          <ProfileIntegratedBanner banner={activeCustomization?.banner} />

          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
            {/* Avatar Section */}
            <div className="relative group shrink-0">
              {displayPhoto ? (
                <img
                  src={displayPhoto}
                  alt={displayUsername ? `@${displayUsername}` : 'Perfil'}
                  className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover ring-2 ring-[#60A5FA] shadow-[0_0_25px_rgba(37,99,235,0.35)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full bg-[#040D1A] border-2 border-[#60A5FA]/60 text-[#60A5FA] font-display text-4xl sm:text-5xl font-bold shadow-[0_0_25px_rgba(37,99,235,0.25)]">
                  {(displayUsername || 'L')[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Identity (@username only), Top-Right Selos, Bio & Social Counts */}
            <div className="flex-1 min-w-0 w-full text-center md:text-left">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 flex items-center justify-center md:justify-start gap-2.5">
                  <h1
                    className="font-display text-2xl sm:text-3xl font-bold text-white truncate transition-colors"
                    style={
                      effectiveUsernameColor
                        ? { color: effectiveUsernameColor }
                        : undefined
                    }
                  >
                    @{displayUsername || 'leitor'}
                  </h1>
                  {isPremium && (
                    <span
                      title="Assinante LIVROFLIX Premium"
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/35 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 shrink-0"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
                      <span>Premium</span>
                    </span>
                  )}
                </div>

                {/* Selos posicionados no lado superior direito da caixa do perfil (apenas ícones) */}
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 shrink-0">
                  <ProfileBadgesShowcase
                    unlockedBadgeIds={effectiveUnlockedBadges}
                    profileBadgeIds={effectiveProfileBadges}
                    isOwner={isAuthenticated && Boolean(userProfile)}
                    onToggleProfileBadge={onToggleProfileBadge}
                    customBadgeImages={platformSettings?.badgeImages}
                  />

                  {!isAuthenticated && (
                    <button
                      type="button"
                      disabled={isSigningIn}
                      onClick={handleGoogleLoginClick}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-60 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>
                        {isSigningIn ? 'Conectando...' : 'Entrar com Google'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bio Section */}
              {displayBio ? (
                <p className="mt-3.5 text-sm text-blue-100/90 leading-relaxed whitespace-pre-line max-w-2xl mx-auto md:mx-0">
                  {displayBio}
                </p>
              ) : null}

              {/* Social Summary Bar: ONLY publicações, seguidores, seguindo */}
              <div className="mt-4 pt-4 border-t border-blue-400/15 flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-xs text-blue-200/75">
                <button
                  type="button"
                  onClick={() => setShowOwnPosts((prev) => !prev)}
                  className={`transition-colors cursor-pointer ${
                    showOwnPosts
                      ? 'text-[#60A5FA] font-semibold underline'
                      : 'hover:text-[#60A5FA]'
                  }`}
                >
                  <strong className="font-mono-num text-white font-bold">
                    {userPosts.length}
                  </strong>{' '}
                  {userPosts.length === 1 ? 'publicação' : 'publicações'}
                </button>
                <span>
                  <strong className="font-mono-num text-white font-bold">
                    {followersCount}
                  </strong>{' '}
                  {followersCount === 1 ? 'seguidor' : 'seguidores'}
                </span>
                <span>
                  <strong className="font-mono-num text-white font-bold">
                    {followingCount}
                  </strong>{' '}
                  seguindo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Publicações feitas pelo usuário — exibidas ao clicar no número de publicações abaixo do @username */}
        {showOwnPosts && (
          <div className="space-y-4">
            {userPosts.length === 0 ? (
              <div className="rounded-xl bg-[#071426] border border-blue-400/20 p-6 text-center text-xs sm:text-sm text-blue-200/75">
                Nenhuma publicação feita ainda.
              </div>
            ) : (
              userPosts.map((post) => (
                <CommunityPostCard
                  key={post.id}
                  post={post}
                  books={books}
                  likes={communityLikes}
                  replies={communityReplies}
                  follows={communityFollows}
                  publicProfilesMap={publicProfilesMap}
                  currentUserProfile={userProfile}
                  isAuthenticated={isAuthenticated}
                  isAdmin={isAdmin}
                  onSelectBook={onSelectBook}
                  onToggleLike={onToggleCommunityLike || (async () => {})}
                  onCreateReply={onCreateCommunityReply || (async () => {})}
                  onDeletePost={onDeleteCommunityPost || (async () => {})}
                  onDeleteReply={onDeleteCommunityReply || (async () => {})}
                  onToggleFollow={onToggleCommunityFollow || (async () => {})}
                />
              ))
            )}
          </div>
        )}

        {/* MODAL: EDITAR PERFIL */}
        {isEditModalOpen && userProfile && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
            onClick={() => {
              if (!isSavingProfile) setIsEditModalOpen(false);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#071426] border border-blue-400/30 shadow-[0_25px_70px_rgba(2,6,23,0.95)] overflow-hidden max-h-[92vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-blue-400/15 bg-[#040D1A]/60">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  Editar perfil
                </h2>
                <button
                  type="button"
                  disabled={isSavingProfile}
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-full p-2 text-blue-200/70 hover:bg-blue-500/15 hover:text-white transition-colors cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form Body */}
              <form
                onSubmit={handleSaveProfileSubmit}
                className="p-6 space-y-5 overflow-y-auto"
              >
                {/* Avatar Picker & Preview */}
                <div className="flex flex-col items-center text-center pb-4 border-b border-blue-400/15">
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />

                  <div
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="relative h-24 w-24 rounded-full overflow-hidden ring-2 ring-[#60A5FA] bg-[#040D1A] flex items-center justify-center cursor-pointer group shadow-xl"
                    title="Clique para selecionar uma nova foto"
                  >
                    {editPhotoPreview ? (
                      <img
                        src={editPhotoPreview}
                        alt="Prévia da foto de perfil"
                        className="h-full w-full object-cover group-hover:opacity-80 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="font-display text-4xl font-bold text-[#60A5FA]">
                        {(editUsername || displayUsername || 'L')[0].toUpperCase()}
                      </span>
                    )}

                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {isProcessingPhoto ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6 text-white" />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-center gap-4">
                    <button
                      type="button"
                      disabled={isProcessingPhoto || isSavingProfile}
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="text-xs sm:text-sm font-bold text-[#60A5FA] hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      {isProcessingPhoto ? 'Processando...' : 'Alterar foto'}
                    </button>

                    {editPhotoPreview && (
                      <button
                        type="button"
                        disabled={isProcessingPhoto || isSavingProfile}
                        onClick={handleRemoveAvatar}
                        className="text-xs sm:text-sm font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                      >
                        Remover foto
                      </button>
                    )}
                  </div>
                </div>

                {editError && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3.5 text-xs sm:text-sm text-rose-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Field: Nome de usuário (@username) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="profile-edit-username"
                      className="block text-xs font-semibold text-blue-200/90"
                    >
                      Nome de usuário
                    </label>
                    <span className="text-[11px] font-mono-num text-blue-300/60">
                      {editUsername.length}/{USERNAME_MAX_LENGTH}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-sm font-bold text-[#60A5FA] select-none pointer-events-none flex items-center">
                      <AtSign className="w-4 h-4" />
                    </span>
                    <input
                      id="profile-edit-username"
                      type="text"
                      required
                      disabled={!usernameChangeStatus.canChange}
                      maxLength={USERNAME_MAX_LENGTH}
                      value={editUsername}
                      onChange={(e) =>
                        setEditUsername(sanitizeUsernameInput(e.target.value))
                      }
                      placeholder="nomeusuario"
                      className={`w-full rounded-xl bg-[#040D1A] border pl-9 pr-4 py-3 text-sm text-white placeholder-blue-300/35 focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        editUsername.length > 0 && !liveUsernameValidation.valid
                          ? 'border-amber-400/60 focus:border-amber-400'
                          : 'border-blue-400/25 focus:border-[#60A5FA]'
                      }`}
                    />
                  </div>
                  {editUsername.length > 0 && !liveUsernameValidation.valid ? (
                    <p className="mt-1.5 text-[11px] text-amber-300">
                      {liveUsernameValidation.error}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-blue-300/60">
                      Seu identificador único no LIVROFLIX: @{editUsername || 'nomeusuario'}
                    </p>
                  )}
                  <p
                    className={`mt-1 text-[11px] ${
                      usernameChangeStatus.canChange
                        ? 'text-blue-200/70'
                        : 'text-amber-300 font-semibold'
                    }`}
                  >
                    {usernameChangeStatus.canChange
                      ? `Você só pode mudar o @username 2 vezes a cada 15 dias (${usernameChangeStatus.remainingChanges}/2 alterações restantes).`
                      : `Limite atingido: você já mudou o @username 2 vezes nos últimos 15 dias. Próxima alteração em ${
                          usernameChangeStatus.daysUntilAvailable
                        } ${
                          usernameChangeStatus.daysUntilAvailable === 1
                            ? 'dia'
                            : 'dias'
                        } (${usernameChangeStatus.nextAvailableDateFormatted}).`}
                  </p>
                </div>

                {/* Field: Bio */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="profile-edit-bio"
                      className="block text-xs font-semibold text-blue-200/90"
                    >
                      Bio
                    </label>
                    <span
                      className={`text-[11px] font-mono-num ${
                        editBio.length >= BIO_MAX_LENGTH
                          ? 'text-amber-400 font-bold'
                          : 'text-blue-300/60'
                      }`}
                    >
                      {editBio.length}/{BIO_MAX_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="profile-edit-bio"
                    rows={3}
                    maxLength={BIO_MAX_LENGTH}
                    value={editBio}
                    onChange={(e) =>
                      setEditBio(e.target.value.slice(0, BIO_MAX_LENGTH))
                    }
                    placeholder="Conte um pouco sobre você e seus gêneros literários favoritos..."
                    className="w-full rounded-xl bg-[#040D1A] border border-blue-400/25 p-3.5 text-sm text-white placeholder-blue-300/35 focus:border-[#60A5FA] focus:outline-none transition-colors resize-none"
                  />
                </div>

                {/* Footer Actions: [ Cancelar ] [ Salvar ] */}
                <div className="pt-2 flex items-center justify-end gap-3 border-t border-blue-400/15">
                  <button
                    type="button"
                    disabled={isSavingProfile}
                    onClick={() => setIsEditModalOpen(false)}
                    className="rounded-xl border border-blue-400/25 bg-blue-950/40 hover:bg-blue-950/80 px-5 py-2.5 text-xs sm:text-sm font-semibold text-blue-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingProfile || isProcessingPhoto}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-60 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <span>Salvar</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {authError && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 p-3.5 text-xs sm:text-sm text-amber-200">
            {authError}
          </div>
        )}

        {/* Reading Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl bg-[#071426] border border-blue-400/20 p-5">
            <span className="text-xs text-blue-200/75 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#60A5FA]" /> Livros lidos
            </span>
            <p className="font-mono-num text-3xl font-bold text-white mt-2">
              {completedBooksCount}
            </p>
          </div>

          <div className="rounded-xl bg-[#071426] border border-blue-400/20 p-5">
            <span className="text-xs text-blue-200/75 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#60A5FA]" /> Atualmente lendo
            </span>
            <p className="font-mono-num text-3xl font-bold text-white mt-2">
              {currentlyReadingCount}
            </p>
          </div>

          <div className="rounded-xl bg-[#071426] border border-blue-400/20 p-5">
            <span className="text-xs text-blue-200/75 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#60A5FA]" /> Páginas lidas
            </span>
            <p className="font-mono-num text-3xl font-bold text-white mt-2">
              {totalPagesRead.toLocaleString('pt-BR')}
            </p>
          </div>

          <div className="rounded-xl bg-[#071426] border border-blue-400/20 p-5">
            <span className="text-xs text-blue-200/75 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-500" /> Favoritos
            </span>
            <p className="font-mono-num text-3xl font-bold text-white mt-2">
              {favoritesCount}
            </p>
          </div>
        </div>

        {/* Achievements */}
        {platformSettings?.showProfileAchievements !== false && (
          <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#60A5FA]" />
                <span>Conquistas Literárias</span>
              </h2>
            </div>
          </div>

          {/* As 4 Conquistas Atuais (Visualização Inicial Limpa) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {initialAchievements.map((ach) => (
              <div
                key={ach.id}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-all ${
                  ach.unlocked
                    ? 'bg-[#0B1E36]/90 border-blue-400/40 shadow-[0_8px_24px_-8px_rgba(37,99,235,0.3)]'
                    : 'bg-[#040D1A]/60 border-blue-400/10 opacity-60'
                }`}
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-950/70 text-2xl">
                  {ach.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-white">
                      {ach.title}
                    </h3>
                    <span className="text-[11px] font-mono-num text-[#60A5FA]">
                      {ach.progressText}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Botão Discreto "Ver mais" / Seção Expandida "Mais conquistas" */}
          {!showMoreAchievements ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setShowMoreAchievements(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#040D1A] hover:bg-blue-500/15 border border-blue-400/25 px-4 py-2 text-xs font-semibold text-blue-200 hover:text-white transition-colors cursor-pointer"
              >
                <span>Ver mais</span>
              </button>
            </div>
          ) : (
            <div className="mt-8 pt-6 border-t border-blue-400/15">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-white">
                    Mais conquistas
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMoreAchievements(false)}
                  className="rounded-xl bg-[#040D1A] hover:bg-blue-500/15 border border-blue-400/25 px-3.5 py-1.5 text-xs font-semibold text-blue-200 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  Ver menos
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {additionalAchievements.map((ach) => {
                  const rewardBadge = ach.hasBadge ? ach.rewardBadge : undefined;
                  const isBadgeOnProfile = rewardBadge
                    ? effectiveProfileBadges.includes(rewardBadge.id)
                    : false;
                  return (
                    <div
                      key={ach.id}
                      className={`flex flex-col justify-between gap-3.5 rounded-xl border p-4 transition-all ${
                        ach.unlocked
                          ? 'bg-[#0B1E36]/90 border-blue-400/40 shadow-[0_8px_24px_-8px_rgba(37,99,235,0.3)]'
                          : 'bg-[#040D1A]/60 border-blue-400/10 opacity-75'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-950/70 text-2xl">
                          {ach.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-display text-lg font-bold text-white truncate">
                              {ach.title}
                            </h4>
                            <span className="text-[11px] font-mono-num text-[#60A5FA] shrink-0">
                              {ach.progressText}
                            </span>
                          </div>
                          <p className="text-xs text-blue-200/75 mt-1">
                            {ach.description}
                          </p>
                          {ach.unlocked && (
                            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                              <Check className="w-3.5 h-3.5" />
                              <span>Conquista concluída</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {rewardBadge && (
                        <div
                          className={`pt-3 border-t flex items-center justify-between gap-3 ${
                            ach.unlocked
                              ? 'border-blue-400/20'
                              : 'border-blue-400/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <BadgeImage
                              badgeId={rewardBadge.id}
                              locked={!ach.unlocked}
                              customBadgeImages={platformSettings?.badgeImages}
                              className="w-10 h-10 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                🏅 Recompensa: Selo {rewardBadge.name}
                              </p>
                              <p
                                className={`text-[11px] ${
                                  ach.unlocked
                                    ? 'text-amber-300 font-semibold'
                                    : 'text-blue-300/50'
                                }`}
                              >
                                {ach.unlocked
                                  ? 'Selo recebido'
                                  : 'Selo bloqueado'}
                              </p>
                            </div>
                          </div>

                          {ach.unlocked && onToggleProfileBadge && (
                            <button
                              type="button"
                              onClick={() => onToggleProfileBadge(rewardBadge.id)}
                              className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold border transition-all cursor-pointer ${
                                isBadgeOnProfile
                                  ? 'bg-[#2563EB]/25 border-[#60A5FA] text-white'
                                  : 'bg-[#040D1A] hover:bg-blue-500/15 border-blue-400/25 text-blue-200 hover:text-white'
                              }`}
                            >
                              {isBadgeOnProfile ? (
                                <>
                                  <Check className="w-3 h-3 text-[#60A5FA]" />
                                  <span>No perfil</span>
                                </>
                              ) : (
                                <span>Exibir no perfil</span>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowMoreAchievements(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#040D1A] hover:bg-blue-500/15 border border-blue-400/25 px-4 py-2 text-xs font-semibold text-blue-200 hover:text-white transition-colors cursor-pointer"
                >
                  <span>Ver menos</span>
                </button>
              </div>
            </div>
          )}
          </div>
        )}

        {/* Favorite Books Showcase (Somente os até 3 selecionados em Minha lista) */}
        {favoriteBooks.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              <span>Meus livros favoritos</span>
            </h2>
            <div className="flex flex-wrap items-start gap-4">
              {favoriteBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => onSelectBook(book)}
                  className="cursor-pointer group w-32 sm:w-36"
                >
                  <BookCover
                    book={book}
                    className="group-hover:scale-[1.03] transition-transform"
                  />
                  <p className="mt-2 text-xs font-semibold text-white truncate">
                    {book.titulo}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL: PERSONALIZAR PERFIL */}
        {isCustomizeModalOpen && userProfile && (
          <ProfileCustomizationModal
            isOpen={isCustomizeModalOpen}
            userProfile={userProfile}
            draft={draftCustomization}
            onChangeDraft={setDraftCustomization}
            onSave={handleSaveCustomization}
            onOpenPremiumModal={onOpenPremiumModal}
            onCancel={() => setIsCustomizeModalOpen(false)}
          />
        )}

        {/* Botão único de Configurações no Fim da Página de Perfil */}
        {isAuthenticated && userProfile && (
          <div className="pt-6 border-t border-blue-400/15 flex flex-wrap items-center justify-center sm:justify-end gap-3">
            <button
              type="button"
              onClick={() => openSettingsPage('personalizar')}
              className="inline-flex items-center gap-2.5 rounded-xl bg-[#071426] hover:bg-[#0B1E36] border border-blue-400/35 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-[#60A5FA]" />
              <span>Configurações</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
