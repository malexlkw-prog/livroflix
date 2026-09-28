import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  Heart,
  Star,
  BookOpen,
  Calendar,
  Download,
  Crown,
  Loader2,
  Check,
  Edit3,
  Trash2,
  Flag,
  X,
  UserPlus,
  UserCheck,
  MessageSquareText,
  MessageCircle,
  ChevronDown,
} from 'lucide-react';
import {
  Book,
  BookReview,
  CommunityFollow,
  PublicProfile,
  ReadingStatus,
  UserBookItem,
  UserProfile,
} from '../types';
import { BookCover } from './BookCover';
import { BookRow } from './BookRow';
import {
  canBookBeDownloaded,
  getEffectiveProfileCustomization,
  getEffectiveUsernameColor,
  getMaxProfileFavoriteBooks,
  isUserPremium,
} from '../utils/premiumUtils';
import { downloadBookPdf } from '../utils/pdfUtils';
import {
  isAdminIdentity,
  isAdminReview,
  isAdminUid,
} from '../utils/adminStealthUtils';
import {
  ProfileBadgesShowcase,
  ProfileFavoriteBooksShowcase,
  generateDefaultUsername,
} from './MyLibraryAndProfile';
import { ProfileHighlightSection } from './ProfileHighlightSection';
import {
  getProfileBackgroundStyle,
  ProfileDecorativeEffectLayer,
  ProfileIntegratedBanner,
} from './ProfileCustomization';
import { CreateReportInput } from './CommunityView';

export const REVIEW_MIN_CHARS = 1;
export const REVIEW_MAX_CHARS = 500;
const REVIEWS_PAGE_SIZE = 5;

export function formatStarRating(value: number): string {
  if (!value || value <= 0) return '0';
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace('.', ',');
}

export const StarRatingDisplay: React.FC<{
  rating: number;
  sizeClass?: string;
}> = ({ rating, sizeClass = 'w-4 h-4' }) => {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#60A5FA]">
      {[1, 2, 3, 4, 5].map((star) => {
        if (rating >= star) {
          return (
            <Star
              key={star}
              className={`${sizeClass} fill-[#60A5FA] text-[#60A5FA] shrink-0`}
            />
          );
        }
        if (rating >= star - 0.5) {
          return (
            <span
              key={star}
              className={`relative inline-flex ${sizeClass} shrink-0`}
            >
              <Star className={`${sizeClass} text-blue-200/25`} />
              <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                <Star
                  className={`${sizeClass} fill-[#60A5FA] text-[#60A5FA]`}
                />
              </span>
            </span>
          );
        }
        return (
          <Star
            key={star}
            className={`${sizeClass} text-blue-200/25 shrink-0`}
          />
        );
      })}
    </span>
  );
};

function formatReviewDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

interface BookDetailViewProps {
  book: Book;
  allBooks: Book[];
  userLibrary: Record<string, UserBookItem>;
  userProfile?: UserProfile | null;
  bookReviews?: BookReview[];
  publicProfilesMap?: Record<string, PublicProfile>;
  communityFollows?: CommunityFollow[];
  isAdmin?: boolean;
  initialScrollToReviews?: boolean;
  onClearScrollToReviews?: () => void;
  onBack: () => void;
  onReadBook: (book: Book) => void;
  onSelectBook: (book: Book) => void;
  onToggleList: (book: Book, e?: React.MouseEvent) => void;
  onToggleFavorite: (book: Book) => void;
  onChangeStatus: (book: Book, status: ReadingStatus) => void;
  onRateBook: (book: Book, stars: number, recommend?: boolean) => void;
  onSaveBookReview?: (input: {
    bookId: string;
    text: string;
    rating?: number;
  }) => Promise<void>;
  onDeleteBookReview?: (reviewId: string) => Promise<void>;
  onToggleCommunityFollow?: (targetUserId: string) => Promise<void>;
  onSubmitReport?: (input: CreateReportInput) => Promise<void>;
  onRequireAuth?: () => void;
  onOpenPremiumModal?: () => void;
  onOpenMessages?: (targetUserId?: string) => void;
  readButtonText?: string;
  ratingPromptText?: string;
  relatedBooksPrefix?: string;
}

export const BookDetailView: React.FC<BookDetailViewProps> = ({
  book,
  allBooks,
  userLibrary,
  userProfile,
  bookReviews = [],
  publicProfilesMap = {},
  communityFollows = [],
  isAdmin = false,
  initialScrollToReviews = false,
  onClearScrollToReviews,
  onBack,
  onReadBook,
  onSelectBook,
  onToggleFavorite,
  onRateBook,
  onSaveBookReview,
  onDeleteBookReview,
  onToggleCommunityFollow,
  onSubmitReport,
  onRequireAuth,
  onOpenPremiumModal,
  onOpenMessages,
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Review Composer Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewStars, setReviewStars] = useState<number>(0);
  const [reviewHoverStars, setReviewHoverStars] = useState<number>(0);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [confirmDeleteReviewId, setConfirmDeleteReviewId] = useState<
    string | null
  >(null);
  const [isDeletingReview, setIsDeletingReview] = useState(false);

  // Progressive Pagination for Reviews
  const [visibleReviewsCount, setVisibleReviewsCount] =
    useState(REVIEWS_PAGE_SIZE);

  // Public Profile Inspection & Report Modal States
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'review' | 'user';
    targetReviewId?: string;
    targetBookId?: string;
    targetUserId: string;
    targetUsername?: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('Spam ou propaganda');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const isPremium = isUserPremium(userProfile);
  const isBookDownloadable = canBookBeDownloaded(book);

  // Filter and sort reviews for this specific book (most recent first), excluding admin reviews for regular users
  const currentBookReviews = useMemo(() => {
    return bookReviews
      .filter(
        (r) =>
          r.bookId === book.id &&
          (isAdmin || !isAdminReview(r, publicProfilesMap))
      )
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [bookReviews, book.id, isAdmin, publicProfilesMap]);

  // Check if current user already has a review for this book
  const myExistingReview = useMemo(() => {
    if (!userProfile?.uid) return null;
    return (
      currentBookReviews.find((r) => r.userId === userProfile.uid) || null
    );
  }, [currentBookReviews, userProfile?.uid]);

  const visibleReviews = useMemo(
    () => currentBookReviews.slice(0, visibleReviewsCount),
    [currentBookReviews, visibleReviewsCount]
  );

  const hasMoreReviews = currentBookReviews.length > visibleReviewsCount;

  useEffect(() => {
    setVisibleReviewsCount(REVIEWS_PAGE_SIZE);
    setIsReviewModalOpen(false);
  }, [book.id]);

  useEffect(() => {
    const currentStars = myExistingReview?.rating || userRating || 0;
    setReviewStars(currentStars);
  }, [book.id, myExistingReview?.rating, userRating]);

  useEffect(() => {
    if (initialScrollToReviews) {
      const timer = setTimeout(() => {
        const el = document.getElementById('book-reviews-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        onClearScrollToReviews?.();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [initialScrollToReviews, onClearScrollToReviews]);

  const handleSelectStarRating = (value: number) => {
    const clamped = Math.max(0.5, Math.min(5, Math.round(value * 2) / 2));
    setReviewStars(clamped);
    if (userProfile) {
      onRateBook(book, clamped);
    }
  };

  const handleOpenReviewComposer = () => {
    setReviewError(null);
    if (myExistingReview) {
      setReviewText(myExistingReview.text.slice(0, REVIEW_MAX_CHARS));
      setReviewStars(myExistingReview.rating || userRating || 0);
    } else {
      setReviewText('');
      setReviewStars(userRating || 0);
    }
    setIsReviewModalOpen(true);
    const el = document.getElementById('book-reviews-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const reviewCharCount = reviewText.length;
  const reviewTrimmedCharCount = reviewText.trim().length;
  const isReviewValidLength =
    reviewTrimmedCharCount >= REVIEW_MIN_CHARS &&
    reviewCharCount <= REVIEW_MAX_CHARS;

  const handlePublishReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) {
      onRequireAuth?.();
      return;
    }
    if (reviewTrimmedCharCount < REVIEW_MIN_CHARS) {
      setReviewError('Escreva pelo menos 1 caractere na sua resenha.');
      return;
    }
    if (reviewCharCount > REVIEW_MAX_CHARS) {
      setReviewError(
        `Sua resenha pode ter no máximo ${REVIEW_MAX_CHARS} caracteres.`
      );
      return;
    }
    if (!onSaveBookReview) return;

    setIsSavingReview(true);
    setReviewError(null);
    try {
      const effectiveStars = reviewStars > 0 ? reviewStars : undefined;
      if (effectiveStars && effectiveStars !== userRating) {
        onRateBook(book, effectiveStars);
      }
      await onSaveBookReview({
        bookId: book.id,
        text: reviewText.trim().slice(0, REVIEW_MAX_CHARS),
        rating: effectiveStars,
      });
      setIsReviewModalOpen(false);
      setReviewFeedback(
        myExistingReview
          ? 'Sua resenha foi atualizada com sucesso!'
          : 'Sua resenha foi publicada!'
      );
      setTimeout(() => setReviewFeedback(null), 4000);
    } catch (err) {
      setReviewError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar sua resenha agora. Tente novamente.'
      );
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleConfirmDeleteReview = async (reviewId: string) => {
    if (!onDeleteBookReview) return;
    setIsDeletingReview(true);
    try {
      await onDeleteBookReview(reviewId);
      setConfirmDeleteReviewId(null);
      setReviewFeedback('Sua resenha foi excluída.');
      setTimeout(() => setReviewFeedback(null), 3500);
    } catch {
      // ignore
    } finally {
      setIsDeletingReview(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget || !onSubmitReport) return;
    setIsSubmittingReport(true);
    try {
      await onSubmitReport({
        targetType: reportTarget.targetType,
        targetReviewId: reportTarget.targetReviewId,
        targetBookId: reportTarget.targetBookId,
        targetUserId: reportTarget.targetUserId,
        targetUsername: reportTarget.targetUsername,
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      });
      setReportTarget(null);
      setReportDetails('');
      setReviewFeedback(
        'Denúncia enviada para análise da moderação do LIVROFLIX.'
      );
      setTimeout(() => setReviewFeedback(null), 4000);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleDownloadClick = async () => {
    setDownloadError(null);
    if (!isBookDownloadable) return;
    if (!isPremium) {
      onOpenPremiumModal?.();
      return;
    }
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      await downloadBookPdf(book, userProfile);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir o download deste livro.'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  // Resolve inspected user profile for the Public Profile Modal
  const inspectedProfile = useMemo(() => {
    if (!inspectedUserId) return null;
    if (
      !isAdmin &&
      (isAdminUid(inspectedUserId, publicProfilesMap) ||
        isAdminIdentity(publicProfilesMap[inspectedUserId]))
    ) {
      return null;
    }
    if (userProfile && inspectedUserId === userProfile.uid) {
      return {
        uid: userProfile.uid,
        displayName:
          userProfile.displayName || userProfile.nome || 'Leitor LIVROFLIX',
        username: (
          userProfile.username || generateDefaultUsername(userProfile)
        )
          .replace(/^@+/, '')
          .toLowerCase(),
        bio: userProfile.bio || '',
        photoURL: userProfile.photoURL ?? userProfile.foto ?? '',
        premium: userProfile.premium,
        usernameColor: userProfile.usernameColor,
        profileCustomization: getEffectiveProfileCustomization(
          userProfile,
          userProfile.profileCustomization
        ),
        favoriteBooks:
          userProfile.profileFavoriteBooks ?? userProfile.favoriteBooks,
        unlockedBadges: userProfile.unlockedBadges,
        profileBadges: userProfile.profileBadges,
      };
    }
    const pub = publicProfilesMap[inspectedUserId];
    if (pub) {
      return {
        uid: pub.uid,
        displayName: pub.displayName,
        username: pub.username.replace(/^@+/, '').toLowerCase(),
        bio: pub.bio || '',
        photoURL: pub.photoURL || '',
        premium: pub.premium,
        usernameColor: pub.usernameColor,
        profileCustomization: getEffectiveProfileCustomization(
          pub,
          pub.profileCustomization
        ),
        favoriteBooks: pub.profileFavoriteBooks ?? pub.favoriteBooks,
        unlockedBadges: pub.unlockedBadges,
        profileBadges: pub.profileBadges,
      };
    }
    const reviewFromUser = bookReviews.find(
      (r) => r.userId === inspectedUserId
    );
    if (reviewFromUser) {
      return {
        uid: reviewFromUser.userId,
        displayName: reviewFromUser.authorName,
        username: reviewFromUser.authorUsername
          .replace(/^@+/, '')
          .toLowerCase(),
        bio: '',
        photoURL: reviewFromUser.authorPhoto || '',
        premium: undefined,
        usernameColor: undefined,
        profileCustomization: undefined,
        favoriteBooks: undefined,
        unlockedBadges: undefined,
        profileBadges: undefined,
      };
    }
    return null;
  }, [inspectedUserId, userProfile, publicProfilesMap, bookReviews]);

  const myFollowingIds = useMemo(() => {
    if (!userProfile?.uid) return new Set<string>();
    return new Set(
      communityFollows
        .filter((f) => f.followerId === userProfile.uid)
        .map((f) => f.followingId)
    );
  }, [communityFollows, userProfile?.uid]);

  const inspectedFollowersCount = useMemo(() => {
    if (!inspectedUserId) return 0;
    return communityFollows.filter((f) => f.followingId === inspectedUserId)
      .length;
  }, [communityFollows, inspectedUserId]);

  const inspectedFollowingCount = useMemo(() => {
    if (!inspectedUserId) return 0;
    return communityFollows.filter((f) => f.followerId === inspectedUserId)
      .length;
  }, [communityFollows, inspectedUserId]);

  // Only show progress if the book has actually been read/started
  const hasBeenRead = Boolean(
    userItem &&
      (userItem.status === 'lendo' || userItem.status === 'concluido') &&
      userItem.progresso > 0
  );

  const relatedBooks = allBooks
    .filter((b) => b.id !== book.id && b.status === 'ativo')
    .map((b) => {
      const sharedGenres = b.generos.filter((g) =>
        book.generos.includes(g)
      ).length;
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

          {reviewFeedback && (
            <div className="mb-6 rounded-xl bg-emerald-500/15 border border-emerald-400/35 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-300 flex items-center justify-between gap-3 max-w-2xl">
              <span className="inline-flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                {reviewFeedback}
              </span>
              <button
                type="button"
                onClick={() => setReviewFeedback(null)}
                className="text-emerald-200/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

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
                    <span className="text-blue-200/75 font-medium">
                      Seu progresso
                    </span>
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
                  por{' '}
                  <span className="font-semibold text-white">{book.autor}</span>
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
                  aria-label={
                    isFavorite ? 'Remover dos favoritos' : 'Favoritar'
                  }
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
            </div>
          </div>
        </div>
      </div>

      {/* =============================================================== */}
      {/* 📚 RESENHA NA PÁGINA DO LIVRO                                    */}
      {/* =============================================================== */}
      <div
        id="book-reviews-section"
        className="mx-auto max-w-[1440px] px-4 sm:px-8 pt-8 pb-8 border-t border-blue-400/15"
      >
        <div className="flex items-center gap-3 mb-5">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Resenha
          </h2>
          <span className="text-xs font-mono-num font-semibold text-blue-200/75">
            ({currentBookReviews.length})
          </span>
        </div>

        {/* O QUADRADO: Estrelas (com suporte a meia estrela ex: 1,5 / 4,5) + Botão Azul + Caixa de Texto Inline */}
        <div className="rounded-2xl bg-[#071426]/90 border border-blue-400/20 p-6 sm:p-8 max-w-2xl mb-8">
          {/* Estrelas sempre visíveis dentro do quadrado (permite meia estrela: 0,5 a 5,0) */}
          <div className="flex flex-col items-center justify-center text-center pb-5 border-b border-blue-400/15">
            <div
              className="inline-flex items-center gap-1.5"
              onMouseLeave={() => setReviewHoverStars(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const activeValue = reviewHoverStars || reviewStars;
                const isFull = activeValue >= star;
                const isHalf = !isFull && activeValue >= star - 0.5;
                const halfVal = star - 0.5;

                return (
                  <div
                    key={star}
                    className="relative inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 cursor-pointer select-none transition-transform hover:scale-110"
                  >
                    {/* Metade esquerda da estrela (ex: 0,5 / 1,5 / 2,5 / 3,5 / 4,5) */}
                    <button
                      type="button"
                      aria-label={`Avaliar com ${formatStarRating(halfVal)} estrelas`}
                      title={`${formatStarRating(halfVal)} estrelas`}
                      onMouseEnter={() => setReviewHoverStars(halfVal)}
                      onClick={() => handleSelectStarRating(halfVal)}
                      className="absolute inset-y-0 left-0 w-1/2 z-10 cursor-pointer focus:outline-none"
                    />
                    {/* Metade direita da estrela (ex: 1 / 2 / 3 / 4 / 5 — ou alterna para meia estrela se tocar novamente) */}
                    <button
                      type="button"
                      aria-label={`Avaliar com ${formatStarRating(star)} estrelas`}
                      title={`${formatStarRating(star)} ${
                        star === 1 ? 'estrela' : 'estrelas'
                      }`}
                      onMouseEnter={() => setReviewHoverStars(star)}
                      onClick={() =>
                        handleSelectStarRating(
                          reviewStars === star ? halfVal : star
                        )
                      }
                      className="absolute inset-y-0 right-0 w-1/2 z-10 cursor-pointer focus:outline-none"
                    />

                    {/* Ícone base (vazio) */}
                    <Star className="w-7 h-7 sm:w-8 sm:h-8 text-blue-200/30 pointer-events-none" />

                    {/* Preenchimento completo */}
                    {isFull && (
                      <Star className="absolute w-7 h-7 sm:w-8 sm:h-8 fill-[#60A5FA] text-[#60A5FA] pointer-events-none" />
                    )}

                    {/* Preenchimento de metade da estrela (ex: 1,5 / 4,5) */}
                    {isHalf && (
                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="relative w-7 h-7 sm:w-8 sm:h-8">
                          <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                            <Star className="w-7 h-7 sm:w-8 sm:h-8 fill-[#60A5FA] text-[#60A5FA]" />
                          </span>
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}

              {(reviewHoverStars > 0 || reviewStars > 0) && (
                <span className="ml-2 rounded-lg bg-[#040D1A] border border-blue-400/25 px-2.5 py-1 text-xs sm:text-sm font-mono-num font-bold text-[#60A5FA]">
                  {formatStarRating(reviewHoverStars || reviewStars)} / 5
                </span>
              )}
            </div>

            <span className="mt-2 text-xs text-blue-200/70">
              {(reviewHoverStars || reviewStars) > 0
                ? `Nota selecionada: ${formatStarRating(
                    reviewHoverStars || reviewStars
                  )} de 5 estrelas`
                : 'Escolha sua nota nas estrelas (aceita meia estrela, ex: 1,5 ou 4,5)'}
            </span>
          </div>

          {/* Conteúdo abaixo das estrelas dentro do quadrado */}
          {!isReviewModalOpen ? (
            <div className="pt-6 text-center">
              {currentBookReviews.length === 0 && (
                <>
                  <MessageSquareText className="w-8 h-8 text-[#60A5FA] mx-auto mb-2.5 opacity-80" />
                  <h3 className="font-display text-lg sm:text-xl font-bold text-white">
                    Nenhuma resenha publicada ainda
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-200/75 mt-1 mb-5 max-w-md mx-auto">
                    Seja o primeiro leitor a compartilhar uma resenha sobre{' '}
                    <strong className="text-white">{book.titulo}</strong>.
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={handleOpenReviewComposer}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-lg transition-colors cursor-pointer"
              >
                <span>
                  {myExistingReview ? '✍️ Editar resenha' : '✍️ Fazer resenha'}
                </span>
              </button>
            </div>
          ) : !userProfile ? (
            <div className="pt-6 text-center space-y-4">
              <p className="text-xs sm:text-sm text-blue-100 max-w-md mx-auto">
                Faça login na sua conta do LIVROFLIX para publicar sua resenha
                sobre <strong className="text-white">{book.titulo}</strong>.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="rounded-xl border border-blue-400/25 px-4 py-2.5 text-xs sm:text-sm font-semibold text-blue-200 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => onRequireAuth?.()}
                  className="inline-flex items-center justify-center rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition-colors cursor-pointer"
                >
                  Entrar na Conta
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePublishReview} className="pt-5 space-y-4">
              {reviewError && (
                <div className="rounded-xl bg-rose-500/15 border border-rose-400/35 px-4 py-3 text-xs sm:text-sm text-rose-200">
                  {reviewError}
                </div>
              )}

              <div>
                <p className="text-xs sm:text-sm text-blue-200/80 mb-2.5 leading-relaxed">
                  Conte o que você achou da obra, seus personagens, história,
                  escrita e o que mais chamou sua atenção.
                </p>

                <textarea
                  id="book-review-textarea"
                  rows={5}
                  maxLength={REVIEW_MAX_CHARS}
                  value={reviewText}
                  onChange={(e) =>
                    setReviewText(e.target.value.slice(0, REVIEW_MAX_CHARS))
                  }
                  placeholder="Escreva sua resenha sobre o livro (1 a 500 caracteres)..."
                  className="w-full rounded-xl bg-[#040D1A] border border-blue-400/25 p-4 text-sm sm:text-base text-white placeholder-blue-300/35 focus:border-[#60A5FA] focus:outline-none leading-relaxed font-reader resize-y"
                />

                {/* Contador em tempo real: 0 / 500 caracteres (1 até 500) */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`text-xs font-mono-num font-bold ${
                      reviewCharCount >= REVIEW_MAX_CHARS
                        ? 'text-amber-300'
                        : isReviewValidLength
                        ? 'text-[#60A5FA]'
                        : 'text-blue-200/70'
                    }`}
                  >
                    {reviewCharCount} / {REVIEW_MAX_CHARS} caracteres
                  </span>
                  <span className="text-[11px] text-blue-200/60">
                    Máximo de {REVIEW_MAX_CHARS} caracteres
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSavingReview}
                  onClick={() => setIsReviewModalOpen(false)}
                  className="rounded-xl border border-blue-400/25 px-4 py-2.5 text-xs sm:text-sm font-semibold text-blue-200 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!isReviewValidLength || isSavingReview}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-45 disabled:cursor-not-allowed px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
                >
                  {isSavingReview ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publicando...</span>
                    </>
                  ) : (
                    <span>
                      {myExistingReview
                        ? 'Salvar alterações'
                        : 'Publicar resenha'}
                    </span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Lista de resenhas publicadas */}
        {currentBookReviews.length > 0 && (
          <div className="space-y-4 max-w-4xl">
            {visibleReviews.map((review) => {
              const isOwnReview =
                Boolean(userProfile?.uid) &&
                review.userId === userProfile?.uid;

              // Resolve live profile info from current user or publicProfilesMap
              const livePub = isOwnReview
                ? {
                    displayName:
                      userProfile?.displayName ||
                      userProfile?.nome ||
                      review.authorName,
                    username: (
                      userProfile?.username || review.authorUsername
                    )
                      .replace(/^@+/, '')
                      .toLowerCase(),
                    photoURL:
                      userProfile?.photoURL ??
                      userProfile?.foto ??
                      review.authorPhoto ??
                      '',
                    premium: userProfile?.premium,
                    usernameColor: userProfile?.usernameColor,
                    profileCustomization: userProfile?.profileCustomization,
                  }
                : publicProfilesMap[review.userId];

              const authorName =
                livePub?.displayName || review.authorName || 'Leitor LIVROFLIX';
              const authorUsername = (
                livePub?.username ||
                review.authorUsername ||
                'leitor'
              )
                .replace(/^@+/, '')
                .toLowerCase();
              const authorPhoto =
                livePub && 'photoURL' in livePub
                  ? livePub.photoURL || ''
                  : review.authorPhoto || '';
              const authorUsernameColor = getEffectiveUsernameColor(livePub);
              const authorIsPremium = isUserPremium(livePub);

              const effectiveRating =
                review.rating ||
                (isOwnReview ? userItem?.avaliacaoUsuario : undefined);

              return (
                <article
                  key={review.id}
                  className="rounded-2xl bg-[#071426] border border-blue-400/20 p-5 sm:p-6 shadow-lg transition-colors hover:border-blue-400/35"
                >
                  {/* Author Header & Actions */}
                  <div className="flex items-start justify-between gap-4">
                    <div
                      onClick={() => setInspectedUserId(review.userId)}
                      className="flex items-center gap-3.5 cursor-pointer group min-w-0"
                    >
                      {authorPhoto ? (
                        <img
                          src={authorPhoto}
                          alt={authorName}
                          className="h-11 w-11 rounded-full object-cover ring-1 ring-[#60A5FA]/50 shrink-0 group-hover:ring-2 transition-all"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#040D1A] border border-[#60A5FA]/40 text-[#60A5FA] font-display text-lg font-bold">
                          {(authorName || 'L')[0].toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-display text-base font-bold text-white group-hover:text-[#60A5FA] transition-colors truncate">
                            {authorName}
                          </span>
                          <span
                            className="text-xs font-semibold text-[#60A5FA] truncate"
                            style={
                              authorUsernameColor
                                ? { color: authorUsernameColor }
                                : undefined
                            }
                          >
                            @{authorUsername}
                          </span>
                          {authorIsPremium && (
                            <span
                              title="Assinante LIVROFLIX Premium"
                              className="inline-flex shrink-0"
                            >
                              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/25" />
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-blue-200/65 mt-0.5">
                          <span>{formatReviewDate(review.createdAt)}</span>
                          {review.updatedAt &&
                            review.updatedAt !== review.createdAt && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>editada</span>
                              </>
                            )}
                          {effectiveRating && effectiveRating > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1.5 text-[#60A5FA]">
                                <StarRatingDisplay
                                  rating={effectiveRating}
                                  sizeClass="w-3.5 h-3.5"
                                />
                                <span className="font-mono-num font-bold text-[11px] text-[#60A5FA]">
                                  {formatStarRating(effectiveRating)}
                                </span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Review Controls: Owner can Edit / Delete; others can Report; Admin can Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOwnReview && (
                        <>
                          <button
                            type="button"
                            onClick={handleOpenReviewComposer}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#040D1A] hover:bg-blue-500/15 border border-blue-400/25 px-2.5 py-1.5 text-xs font-semibold text-blue-100 hover:text-white transition-colors cursor-pointer"
                            title="Editar sua resenha"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#60A5FA]" />
                            <span className="hidden sm:inline">Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteReviewId(review.id)
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-[#040D1A] hover:bg-rose-500/20 border border-blue-400/20 px-2.5 py-1.5 text-xs font-semibold text-blue-200/80 hover:text-rose-300 transition-colors cursor-pointer"
                            title="Excluir sua resenha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Excluir</span>
                          </button>
                        </>
                      )}

                      {!isOwnReview && isAdmin && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteReviewId(review.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#040D1A] hover:bg-rose-500/20 border border-rose-400/25 px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition-colors cursor-pointer"
                          title="Remover resenha (Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!isOwnReview && userProfile && onSubmitReport && (
                        <button
                          type="button"
                          onClick={() =>
                            setReportTarget({
                              targetType: 'review',
                              targetReviewId: review.id,
                              targetBookId: book.id,
                              targetUserId: review.userId,
                              targetUsername: authorUsername,
                            })
                          }
                          className="rounded-lg bg-[#040D1A] hover:bg-amber-500/15 border border-blue-400/20 p-2 text-blue-200/70 hover:text-amber-300 transition-colors cursor-pointer"
                          title="Denunciar resenha"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delete Confirmation Inline */}
                  {confirmDeleteReviewId === review.id && (
                    <div className="mt-4 rounded-xl bg-rose-950/40 border border-rose-500/35 p-3.5 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs sm:text-sm text-rose-100 font-medium">
                        Tem certeza que deseja excluir esta resenha?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteReviewId(null)}
                          className="rounded-lg border border-blue-400/25 px-3 py-1.5 text-xs font-semibold text-blue-100 hover:text-white cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingReview}
                          onClick={() =>
                            handleConfirmDeleteReview(review.id)
                          }
                          className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer disabled:opacity-60"
                        >
                          {isDeletingReview ? 'Excluindo...' : 'Confirmar exclusão'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Review Body Text */}
                  <div className="mt-4 pt-4 border-t border-blue-400/15">
                    <p className="text-sm sm:text-base text-blue-50/95 leading-relaxed whitespace-pre-line font-reader">
                      {review.text}
                    </p>
                  </div>
                </article>
              );
            })}

            {/* Progressive Pagination Button */}
            {hasMoreReviews && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleReviewsCount((prev) => prev + REVIEWS_PAGE_SIZE)
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#071426] hover:bg-[#0B1E36] border border-blue-400/25 px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#60A5FA] hover:text-white transition-colors cursor-pointer"
                >
                  <span>Carregar mais resenhas</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
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

      {/* =============================================================== */}
      {/* MODAL: PERFIL PÚBLICO DO AUTOR DA REVIEW                         */}
      {/* =============================================================== */}
      {inspectedProfile && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
          onClick={() => setInspectedUserId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-[#040D1A] border border-blue-400/30 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            style={getProfileBackgroundStyle(
              inspectedProfile.profileCustomization
            )}
          >
            <ProfileDecorativeEffectLayer
              effect={inspectedProfile.profileCustomization?.effects}
            />

            <div className="relative z-10 flex items-center justify-between px-6 py-4 bg-[#071426]/90 border-b border-blue-400/15">
              <div className="flex items-center gap-2">
                <span
                  className="font-display text-lg font-bold text-white"
                  style={
                    getEffectiveUsernameColor(inspectedProfile)
                      ? { color: getEffectiveUsernameColor(inspectedProfile) }
                      : undefined
                  }
                >
                  @{inspectedProfile.username}
                </span>
                {isUserPremium(inspectedProfile) && (
                  <span
                    title="LIVROFLIX Premium"
                    className="inline-flex shrink-0"
                  >
                    <Crown className="w-4 h-4 text-amber-400 fill-amber-400/25" />
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectedUserId(null)}
                className="rounded-full p-1.5 text-blue-200/70 hover:bg-blue-500/15 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative z-10 p-6 overflow-y-auto space-y-6">
              <div className="relative rounded-2xl bg-[#071426]/90 border border-blue-400/20 p-5 overflow-hidden">
                <ProfileIntegratedBanner
                  banner={inspectedProfile.profileCustomization?.banner}
                />

                <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    {inspectedProfile.photoURL ? (
                      <img
                        src={inspectedProfile.photoURL}
                        alt={`@${inspectedProfile.username}`}
                        className="h-20 w-20 rounded-full object-cover ring-2 ring-[#60A5FA]"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#040D1A] border-2 border-[#60A5FA]/60 text-[#60A5FA] font-display text-3xl font-bold">
                        {(inspectedProfile.displayName ||
                          inspectedProfile.username ||
                          'L')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-display text-xl font-bold text-white">
                        {inspectedProfile.displayName}
                      </h3>
                      <div className="flex items-center justify-center sm:justify-start gap-2 mt-0.5">
                        <span
                          className="text-sm font-semibold text-[#60A5FA]"
                          style={
                            getEffectiveUsernameColor(inspectedProfile)
                              ? {
                                  color:
                                    getEffectiveUsernameColor(inspectedProfile),
                                }
                              : undefined
                          }
                        >
                          @{inspectedProfile.username}
                        </span>
                        {isUserPremium(inspectedProfile) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/35 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            <Crown className="w-3 h-3 text-amber-400 fill-amber-400/30" />
                            <span>Premium</span>
                          </span>
                        )}
                      </div>
                      {inspectedProfile.bio && (
                        <p className="mt-2 text-xs sm:text-sm text-blue-100/90 max-w-md whitespace-pre-line">
                          {inspectedProfile.bio}
                        </p>
                      )}
                      <ProfileHighlightSection
                        userId={inspectedProfile.uid}
                        isOwner={Boolean(
                          userProfile?.uid &&
                            inspectedProfile.uid === userProfile.uid
                        )}
                        align="center-sm-left"
                      />
                      <div className="mt-3 flex items-center justify-center sm:justify-start gap-5 text-xs text-blue-200/80">
                        <span>
                          <strong className="font-mono-num text-white">
                            {inspectedFollowersCount}
                          </strong>{' '}
                          {inspectedFollowersCount === 1
                            ? 'seguidor'
                            : 'seguidores'}
                        </span>
                        <span>
                          <strong className="font-mono-num text-white">
                            {inspectedFollowingCount}
                          </strong>{' '}
                          seguindo
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center sm:items-end gap-2.5 shrink-0">
                    <ProfileBadgesShowcase
                      unlockedBadgeIds={inspectedProfile.unlockedBadges}
                      profileBadgeIds={inspectedProfile.profileBadges}
                      isOwner={false}
                    />

                    {userProfile?.uid &&
                      inspectedProfile.uid !== userProfile.uid && (
                        <div className="flex flex-wrap items-center gap-2">
                          {onToggleCommunityFollow && (
                            <button
                              type="button"
                              onClick={() =>
                                onToggleCommunityFollow(inspectedProfile.uid)
                              }
                              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
                                myFollowingIds.has(inspectedProfile.uid)
                                  ? 'bg-blue-950 border border-blue-400/30 text-blue-100'
                                  : 'bg-[#2563EB] hover:bg-[#3B82F6] text-white'
                              }`}
                            >
                              {myFollowingIds.has(inspectedProfile.uid) ? (
                                <>
                                  <UserCheck className="w-4 h-4" />
                                  <span>Seguindo</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4" />
                                  <span>Seguir</span>
                                </>
                              )}
                            </button>
                          )}

                          {onOpenMessages && (
                            <button
                              type="button"
                              onClick={() => {
                                const targetUid = inspectedProfile.uid;
                                setInspectedUserId(null);
                                onOpenMessages(targetUid);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#040D1A] hover:bg-blue-500/20 border border-blue-400/35 px-4 py-2 text-xs font-bold text-[#60A5FA] hover:text-white transition-colors cursor-pointer"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>Mensagem</span>
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>

              <ProfileFavoriteBooksShowcase
                favoriteBookIds={inspectedProfile.favoriteBooks}
                books={allBooks}
                maxBooks={getMaxProfileFavoriteBooks(inspectedProfile)}
                onSelectBook={(b) => {
                  setInspectedUserId(null);
                  onSelectBook(b);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* MODAL: DENUNCIAR REVIEW                                          */}
      {/* =============================================================== */}
      {reportTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => {
            if (!isSubmittingReport) setReportTarget(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#071426] border border-blue-400/30 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-blue-400/15 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Flag className="w-4 h-4" />
                <h3 className="font-display text-lg font-bold text-white">
                  Denunciar review de @{reportTarget.targetUsername || 'leitor'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="text-blue-200/70 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-blue-200/90 mb-1.5">
                  Motivo da denúncia
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded-xl bg-[#040D1A] border border-blue-400/25 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-[#60A5FA] focus:outline-none"
                >
                  <option value="Spam ou propaganda">Spam ou propaganda</option>
                  <option value="Conteúdo ofensivo ou assédio">
                    Conteúdo ofensivo ou assédio
                  </option>
                  <option value="Conteúdo impróprio">Conteúdo impróprio</option>
                  <option value="Spoiler pesado sem aviso">
                    Spoiler pesado sem aviso
                  </option>
                  <option value="Outro motivo">Outro motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-blue-200/90 mb-1.5">
                  Detalhes adicionais (opcional)
                </label>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Descreva brevemente o problema..."
                  className="w-full rounded-xl bg-[#040D1A] border border-blue-400/25 p-3 text-xs sm:text-sm text-white placeholder-blue-300/35 focus:border-[#60A5FA] focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="rounded-xl border border-blue-400/20 px-4 py-2 text-xs font-semibold text-blue-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-bold text-black cursor-pointer"
                >
                  {isSubmittingReport ? 'Enviando...' : 'Enviar denúncia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
