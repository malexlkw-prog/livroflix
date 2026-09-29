import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Bell,
  PlusCircle,
  Image as ImageIcon,
  BookOpen,
  AtSign,
  Trash2,
  Flag,
  UserPlus,
  UserCheck,
  X,
  Check,
  Send,
  MoreHorizontal,
  Sparkles,
  Search,
  ShieldAlert,
  Loader2,
  CornerDownRight,
  Users,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Crown,
} from 'lucide-react';
import {
  Book,
  CommunityFollow,
  CommunityLike,
  CommunityNotification,
  CommunityPost,
  CommunityReply,
  CommunityReport,
  PublicProfile,
  UserProfile,
} from '../types';
import { BookCover } from './BookCover';
import {
  isAdminIdentity,
  isAdminPost,
  isAdminUid,
  isReservedAdminUsername,
} from '../utils/adminStealthUtils';
import {
  ProfileBadgesShowcase,
  ProfileFavoriteBooksShowcase,
} from './MyLibraryAndProfile';
import { ProfileHighlightSection } from './ProfileHighlightSection';
import {
  getProfileBackgroundStyle,
  ProfileDecorativeEffectLayer,
  ProfileIntegratedBanner,
} from './ProfileCustomization';
import {
  getEffectiveProfileCustomization,
  getEffectiveUsernameColor,
  getMaxProfileFavoriteBooks,
  isUserPremium,
} from '../utils/premiumUtils';

export const POST_MAX_LENGTH = 300;
export const REPLY_MAX_LENGTH = 300;

export interface CreatePostInput {
  text: string;
  imageUrl?: string;
  bookId?: string;
}

export interface CreateReplyInput {
  postId: string;
  postAuthorId: string;
  text: string;
  parentReplyId?: string;
  replyToUsername?: string;
}

export interface CreateReportInput {
  targetType: 'post' | 'user' | 'review';
  targetPostId?: string;
  targetReviewId?: string;
  targetBookId?: string;
  targetUserId: string;
  targetUsername?: string;
  reason: string;
  details?: string;
}

export function extractMentionsFromText(text: string): string[] {
  const matches = text.match(/@([a-z0-9._]{3,30})/gi) || [];
  const unique = new Set<string>();
  matches.forEach((m) => {
    const clean = m.replace(/^@+/, '').toLowerCase();
    if (clean.length >= 3 && clean.length <= 30) {
      unique.add(clean);
    }
  });
  return Array.from(unique).slice(0, 15);
}

export function getTypedMentionMatch(
  text: string,
  cursorPosition?: number | null
): {
  query: string;
  firstThree: string;
  tokenStart: number;
  tokenEnd: number;
} | null {
  const pos =
    typeof cursorPosition === 'number' && cursorPosition >= 0
      ? Math.min(cursorPosition, text.length)
      : text.length;
  const beforeCursor = text.slice(0, pos);
  const match = beforeCursor.match(/(?:^|\s)@([a-zA-Z0-9._]*)$/);
  if (!match) return null;
  const rawQuery = (match[1] || '').toLowerCase();
  // Ao digitar apenas @ (ou menos de 3 letras), não aparece nada de cara;
  // ao digitar as 3 primeiras letras, exibe os resultados correspondentes.
  if (rawQuery.length < 3) return null;
  const atIndex = beforeCursor.lastIndexOf('@');
  if (atIndex === -1) return null;
  return {
    query: rawQuery,
    firstThree: rawQuery.slice(0, 3),
    tokenStart: atIndex,
    tokenEnd: pos,
  };
}

export function formatCommunityTimestamp(isoString: string): string {
  if (!isoString) return 'agora';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'recente';

  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  if (diffSeconds < 60) return 'agora mesmo';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `há ${diffDays}d`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year:
      date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export function formatFullDateTime(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function compressPostImageToDataUrl(
  file: File,
  maxWidth = 960,
  maxHeight = 960,
  quality = 0.8
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
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let compressed = canvas.toDataURL('image/jpeg', quality);
        if (compressed.length > 350000) {
          compressed = canvas.toDataURL('image/jpeg', 0.65);
        }
        resolve(compressed);
      };
      img.onerror = () =>
        reject(new Error('Não foi possível carregar a imagem selecionada.'));
      img.src = String(reader.result);
    };
    reader.onerror = () =>
      reject(new Error('Erro ao ler a imagem do dispositivo.'));
    reader.readAsDataURL(file);
  });
}

interface FormattedTextWithMentionsProps {
  text: string;
  onClickMention?: (username: string) => void;
}

export const FormattedTextWithMentions: React.FC<
  FormattedTextWithMentionsProps
> = ({ text, onClickMention }) => {
  const parts = text.split(/(@[a-zA-Z0-9._]{3,30})/g);
  return (
    <>
      {parts.map((part, index) => {
        if (/^@[a-zA-Z0-9._]{3,30}$/.test(part)) {
          const cleanUsername = part.slice(1).toLowerCase();
          return (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClickMention?.(cleanUsername);
              }}
              className="font-semibold text-[#60A5FA] hover:text-blue-300 hover:underline transition-colors cursor-pointer"
            >
              {part}
            </button>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
};

export interface CommunityPostCardProps {
  post: CommunityPost;
  books: Book[];
  likes: CommunityLike[];
  replies: CommunityReply[];
  follows: CommunityFollow[];
  publicProfilesMap: Record<string, PublicProfile>;
  currentUserProfile: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  onSelectBook: (book: Book) => void;
  onToggleLike: (post: CommunityPost) => Promise<void>;
  onCreateReply: (input: CreateReplyInput) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onDeleteReply: (replyId: string) => Promise<void>;
  onToggleFollow: (targetUserId: string) => Promise<void>;
  onOpenReportModal?: (target: {
    targetType: 'post' | 'user';
    targetPostId?: string;
    targetUserId: string;
    targetUsername?: string;
  }) => void;
  onInspectUser?: (userId: string) => void;
  onInspectMention?: (username: string) => void;
  onRequireAuth?: () => void;
  isDetailView?: boolean;
  onOpenPostDetail?: (post: CommunityPost) => void;
  onBackFromDetail?: () => void;
}

export const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
  post,
  books,
  likes,
  replies,
  follows,
  publicProfilesMap,
  currentUserProfile,
  isAuthenticated,
  isAdmin,
  onSelectBook,
  onToggleLike,
  onCreateReply,
  onDeletePost,
  onDeleteReply,
  onToggleFollow,
  onOpenReportModal,
  onInspectUser,
  onInspectMention,
  onRequireAuth,
  isDetailView = false,
  onOpenPostDetail,
  onBackFromDetail,
}) => {
  const [repliesOpen, setRepliesOpen] = useState(isDetailView);
  const [replyText, setReplyText] = useState('');
  const [replyCursorPos, setReplyCursorPos] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<{
    replyId: string;
    username: string;
  } | null>(null);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentUserId = currentUserProfile?.uid || null;
  const isOwnPost = Boolean(currentUserId && post.authorId === currentUserId);
  const canDeletePost = isOwnPost || isAdmin;

  // Live author info from publicProfilesMap (or fallback to post snapshot)
  const liveAuthor = publicProfilesMap[post.authorId];
  const authorName =
    (isOwnPost &&
      (currentUserProfile?.displayName || currentUserProfile?.nome)) ||
    liveAuthor?.displayName ||
    post.authorName ||
    'Leitor LIVROFLIX';
  const authorUsername = (
    (isOwnPost && currentUserProfile?.username) ||
    liveAuthor?.username ||
    post.authorUsername ||
    'leitor'
  )
    .replace(/^@+/, '')
    .toLowerCase();
  const authorPhoto = isOwnPost
    ? (currentUserProfile?.photoURL ?? currentUserProfile?.foto ?? '')
    : liveAuthor && 'photoURL' in liveAuthor
    ? liveAuthor.photoURL || ''
    : post.authorPhoto || '';
  const authorUsernameColor = getEffectiveUsernameColor(
    isOwnPost ? currentUserProfile : liveAuthor
  );
  const isAuthorPremium = isUserPremium(
    isOwnPost ? currentUserProfile : liveAuthor
  );

  // Linked Book resolved strictly by Firestore Book ID
  const linkedBook = useMemo(() => {
    if (!post.bookId) return null;
    return books.find((b) => b.id === post.bookId) || null;
  }, [post.bookId, books]);

  const postLikes = useMemo(
    () => likes.filter((l) => l.postId === post.id),
    [likes, post.id]
  );
  const isLikedByMe = useMemo(
    () =>
      Boolean(
        currentUserId && postLikes.some((l) => l.userId === currentUserId)
      ),
    [postLikes, currentUserId]
  );

  const postReplies = useMemo(
    () =>
      replies
        .filter((r) => r.postId === post.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [replies, post.id]
  );

  const isFollowingAuthor = useMemo(
    () =>
      Boolean(
        currentUserId &&
          !isOwnPost &&
          follows.some(
            (f) =>
              f.followerId === currentUserId && f.followingId === post.authorId
          )
      ),
    [follows, currentUserId, isOwnPost, post.authorId]
  );

  const isAuthorFollowingMe = useMemo(
    () =>
      Boolean(
        currentUserId &&
          !isOwnPost &&
          follows.some(
            (f) =>
              f.followerId === post.authorId && f.followingId === currentUserId
          )
      ),
    [follows, currentUserId, isOwnPost, post.authorId]
  );

  const typedReplyMention = useMemo(
    () => getTypedMentionMatch(replyText, replyCursorPos),
    [replyText, replyCursorPos]
  );

  const replyMentionSuggestions = useMemo(() => {
    if (!typedReplyMention) return [];
    const map = new Map<string, PublicProfile>();
    Object.values(publicProfilesMap).forEach((prof) => {
      if (prof && prof.uid && prof.username) {
        if (
          !isAdmin &&
          (isAdminIdentity(prof) || isAdminUid(prof.uid, publicProfilesMap))
        ) {
          return;
        }
        map.set(prof.uid, prof);
      }
    });
    return Array.from(map.values())
      .filter((prof) => {
        const uname = prof.username.replace(/^@+/, '').toLowerCase();
        return (
          uname.startsWith(typedReplyMention.query) ||
          uname.startsWith(typedReplyMention.firstThree)
        );
      })
      .sort((a, b) => {
        const aExact = a.username
          .replace(/^@+/, '')
          .toLowerCase()
          .startsWith(typedReplyMention.query)
          ? 0
          : 1;
        const bExact = b.username
          .replace(/^@+/, '')
          .toLowerCase()
          .startsWith(typedReplyMention.query)
          ? 0
          : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.username.localeCompare(b.username);
      })
      .slice(0, 8);
  }, [typedReplyMention, publicProfilesMap, isAdmin]);

  const handleInsertReplyMention = (username: string) => {
    const clean = username.replace(/^@+/, '').toLowerCase();
    if (typedReplyMention) {
      const before = replyText.slice(0, typedReplyMention.tokenStart);
      const after = replyText.slice(typedReplyMention.tokenEnd);
      const inserted = `@${clean} `;
      const next = `${before}${inserted}${after.replace(/^\s+/, '')}`.slice(
        0,
        REPLY_MAX_LENGTH
      );
      setReplyText(next);
      setReplyCursorPos(Math.min(next.length, before.length + inserted.length));
      return;
    }
    const insertion = `@${clean} `;
    const next = (
      replyText ? `${replyText.trimEnd()} ${insertion}` : insertion
    ).slice(0, REPLY_MAX_LENGTH);
    setReplyText(next);
    setReplyCursorPos(next.length);
  };

  const handleLikeClick = async () => {
    if (!isAuthenticated || !currentUserId) {
      onRequireAuth?.();
      return;
    }
    await onToggleLike(post);
  };

  const handleFollowClick = async () => {
    if (!isAuthenticated || !currentUserId) {
      onRequireAuth?.();
      return;
    }
    if (isOwnPost) return;
    await onToggleFollow(post.authorId);
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !currentUserId) {
      onRequireAuth?.();
      return;
    }
    const cleanText = replyText.trim();
    if (!cleanText || cleanText.length > REPLY_MAX_LENGTH) return;

    setIsSubmittingReply(true);
    try {
      await onCreateReply({
        postId: post.id,
        postAuthorId: post.authorId,
        text: cleanText,
        parentReplyId: replyingTo?.replyId,
        replyToUsername: replyingTo?.username,
      });
      setReplyText('');
      setReplyingTo(null);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const startReplyToPerson = (reply: CommunityReply) => {
    const targetHandle = (
      publicProfilesMap[reply.authorId]?.username ||
      reply.authorUsername ||
      'leitor'
    )
      .replace(/^@+/, '')
      .toLowerCase();
    setReplyingTo({
      replyId: reply.id,
      username: targetHandle,
    });
    if (!replyText.startsWith(`@${targetHandle} `)) {
      setReplyText(`@${targetHandle} `);
    }
    setRepliesOpen(true);
  };

  return (
    <article className="rounded-2xl bg-[#071426] border border-blue-400/20 p-4 sm:p-5 shadow-lg transition-colors hover:border-blue-400/30">
      {/* Top Row: Author Identity, Timestamp, Follow & Menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {isDetailView && onBackFromDetail && (
            <button
              type="button"
              onClick={onBackFromDetail}
              aria-label="Voltar"
              title="Voltar"
              className="shrink-0 p-1 text-white hover:text-[#60A5FA] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onInspectUser?.(post.authorId)}
            className="shrink-0 focus:outline-none cursor-pointer group"
          >
            {authorPhoto ? (
              <img
                src={authorPhoto}
                alt={authorName}
                className="h-11 w-11 rounded-full object-cover ring-1 ring-[#60A5FA]/50 group-hover:ring-[#60A5FA] transition-all"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#040D1A] border border-[#60A5FA]/40 text-[#60A5FA] font-display text-lg font-bold group-hover:border-[#60A5FA] transition-colors">
                {(authorName || 'L')[0].toUpperCase()}
              </div>
            )}
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <button
                type="button"
                onClick={() => onInspectUser?.(post.authorId)}
                style={
                  authorUsernameColor ? { color: authorUsernameColor } : undefined
                }
                className="font-semibold text-sm sm:text-base text-white hover:text-[#60A5FA] transition-colors truncate cursor-pointer"
              >
                @{authorUsername}
              </button>
              {isAuthorPremium && (
                <span title="LIVROFLIX Premium" className="inline-flex shrink-0">
                  <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/25 shrink-0" />
                </span>
              )}
            </div>
            <p
              className="text-[11px] text-blue-200/60"
              title={formatFullDateTime(post.createdAt)}
            >
              {formatCommunityTimestamp(post.createdAt)}
              { formatFullDateTime(post.createdAt)
                ? ` · ${formatFullDateTime(post.createdAt)}`
                : '' }
            </p>
          </div>
        </div>

        {/* Right Controls: Follow Button + Moderation Menu */}
        <div className="flex items-center gap-2 shrink-0 relative">
          {!isOwnPost && isAuthenticated && (
            <button
              type="button"
              onClick={handleFollowClick}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                isFollowingAuthor
                  ? 'bg-blue-950/70 border border-blue-400/30 text-blue-200 hover:border-rose-400/40 hover:text-rose-200'
                  : 'bg-[#2563EB] hover:bg-[#3B82F6] text-white shadow-sm'
              }`}
            >
              {isFollowingAuthor ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Seguindo</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isAuthorFollowingMe ? 'Seguir de volta' : 'Seguir'}</span>
                </>
              )}
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="rounded-full p-1.5 text-blue-200/60 hover:bg-blue-500/15 hover:text-white transition-colors cursor-pointer"
              aria-label="Opções da publicação"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-[#040D1A] border border-blue-400/30 py-1.5 shadow-2xl z-30">
                {canDeletePost && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir publicação</span>
                  </button>
                )}

                {!isOwnPost && onOpenReportModal && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenReportModal({
                          targetType: 'post',
                          targetPostId: post.id,
                          targetUserId: post.authorId,
                          targetUsername: authorUsername,
                        });
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-blue-100 hover:bg-blue-500/15 transition-colors cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5 text-amber-400" />
                      <span>Denunciar publicação</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenReportModal({
                          targetType: 'user',
                          targetUserId: post.authorId,
                          targetUsername: authorUsername,
                        });
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-blue-100 hover:bg-blue-500/15 transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>Denunciar @{authorUsername}</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Inline Banner */}
      {confirmDelete && (
        <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-400/30 p-3 flex items-center justify-between gap-3">
          <span className="text-xs text-rose-200">
            Deseja realmente excluir esta publicação?
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg px-2.5 py-1 text-xs text-blue-200 hover:bg-white/10 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                setConfirmDelete(false);
                await onDeletePost(post.id);
              }}
              className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1 text-xs font-bold text-white cursor-pointer"
            >
              Excluir
            </button>
          </div>
        </div>
      )}

      {/* Post Text */}
      {post.text && (
        <div
          onClick={() => {
            if (!isDetailView && onOpenPostDetail) {
              onOpenPostDetail(post);
            }
          }}
          className={
            !isDetailView && onOpenPostDetail ? 'cursor-pointer' : undefined
          }
        >
          <p className="mt-3.5 text-sm sm:text-[15px] text-blue-50/95 leading-relaxed whitespace-pre-line break-words">
            <FormattedTextWithMentions
              text={post.text}
              onClickMention={onInspectMention}
            />
          </p>
        </div>
      )}

      {/* Optional Attached Image */}
      {post.imageUrl && (
        <div
          onClick={() => {
            if (!isDetailView && onOpenPostDetail) {
              onOpenPostDetail(post);
            }
          }}
          className={`mt-3.5 overflow-hidden rounded-xl border border-blue-400/20 bg-[#040D1A] ${
            !isDetailView && onOpenPostDetail ? 'cursor-pointer' : ''
          }`}
        >
          <img
            src={post.imageUrl}
            alt="Imagem da publicação"
            className="max-h-[420px] w-full object-contain mx-auto"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Optional Linked Catalog Book Block (referenced by Firestore bookId) */}
      {linkedBook && (
        <div
          onClick={() => onSelectBook(linkedBook)}
          role="button"
          tabIndex={0}
          title={linkedBook.titulo}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectBook(linkedBook);
            }
          }}
          className="mt-3.5 inline-block w-28 sm:w-32 cursor-pointer group"
        >
          <BookCover
            book={linkedBook}
            className="group-hover:scale-[1.03] transition-transform"
          />
        </div>
      )}

      {/* Interaction Bar: ❤️ & 💬 ONLY */}
      <div className="mt-4 pt-3 border-t border-blue-400/15 flex items-center gap-6">
        <button
          type="button"
          onClick={handleLikeClick}
          aria-label="Curtidas"
          className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
            isLikedByMe
              ? 'text-rose-500'
              : 'text-blue-200/75 hover:text-rose-400'
          }`}
        >
          <Heart
            className={`w-4 h-4 transition-transform active:scale-125 ${
              isLikedByMe ? 'fill-rose-500 text-rose-500' : ''
            }`}
          />
          <span className="font-mono-num">{postLikes.length}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!isDetailView && onOpenPostDetail) {
              onOpenPostDetail(post);
            } else {
              setRepliesOpen((prev) => !prev);
            }
          }}
          aria-label="Respostas"
          className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
            isDetailView || repliesOpen
              ? 'text-[#60A5FA]'
              : 'text-blue-200/75 hover:text-[#60A5FA]'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="font-mono-num">{postReplies.length}</span>
        </button>
      </div>

      {/* Replies Thread (Shown in dedicated post view or when expanded) */}
      {(isDetailView || (repliesOpen && !onOpenPostDetail)) && (
        <div className="mt-4 pt-4 border-t border-blue-400/15 space-y-3.5">
          {postReplies.length === 0 ? (
            <p className="text-xs text-blue-200/60 text-center py-2">
              Nenhuma resposta ainda. Participe da conversa literária!
            </p>
          ) : (
            <div className="space-y-2.5">
              {postReplies.map((reply) => {
                const isOwnReply = Boolean(
                  currentUserId && reply.authorId === currentUserId
                );
                const liveReplyAuthor = publicProfilesMap[reply.authorId];
                const replyAuthorName =
                  (isOwnReply &&
                    (currentUserProfile?.displayName ||
                      currentUserProfile?.nome)) ||
                  liveReplyAuthor?.displayName ||
                  reply.authorName ||
                  'Leitor';
                const replyAuthorUsername = (
                  (isOwnReply && currentUserProfile?.username) ||
                  liveReplyAuthor?.username ||
                  reply.authorUsername ||
                  'leitor'
                )
                  .replace(/^@+/, '')
                  .toLowerCase();
                const replyAuthorPhoto = isOwnReply
                  ? (currentUserProfile?.photoURL ??
                      currentUserProfile?.foto ??
                      '')
                  : liveReplyAuthor && 'photoURL' in liveReplyAuthor
                  ? liveReplyAuthor.photoURL || ''
                  : reply.authorPhoto || '';
                const replyAuthorUsernameColor = getEffectiveUsernameColor(
                  isOwnReply ? currentUserProfile : liveReplyAuthor
                );
                const isReplyAuthorPremium = isUserPremium(
                  isOwnReply ? currentUserProfile : liveReplyAuthor
                );

                return (
                  <div
                    key={reply.id}
                    className="rounded-xl bg-[#040D1A]/80 border border-blue-400/15 p-3 flex items-start gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onInspectUser?.(reply.authorId)}
                      className="shrink-0 cursor-pointer"
                    >
                      {replyAuthorPhoto ? (
                        <img
                          src={replyAuthorPhoto}
                          alt={replyAuthorName}
                          className="h-8 w-8 rounded-full object-cover ring-1 ring-[#60A5FA]/40"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#071426] border border-[#60A5FA]/40 text-[#60A5FA] font-display text-xs font-bold">
                          {(replyAuthorName || 'L')[0].toUpperCase()}
                        </div>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => onInspectUser?.(reply.authorId)}
                            style={
                              replyAuthorUsernameColor
                                ? { color: replyAuthorUsernameColor }
                                : undefined
                            }
                            className="font-semibold text-white hover:text-[#60A5FA] cursor-pointer"
                          >
                            @{replyAuthorUsername}
                          </button>
                          {isReplyAuthorPremium && (
                            <span title="LIVROFLIX Premium" className="inline-flex shrink-0">
                              <Crown className="w-3 h-3 text-amber-400 fill-amber-400/25 shrink-0" />
                            </span>
                          )}
                          <span className="text-blue-200/50">·</span>
                          <span className="text-[11px] text-blue-200/60">
                            {formatCommunityTimestamp(reply.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isAuthenticated && (
                            <button
                              type="button"
                              onClick={() => startReplyToPerson(reply)}
                              className="text-[11px] font-semibold text-[#60A5FA] hover:underline cursor-pointer"
                            >
                              Responder
                            </button>
                          )}
                          {(isOwnReply || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => onDeleteReply(reply.id)}
                              className="text-rose-400/80 hover:text-rose-300 p-0.5 cursor-pointer"
                              title="Excluir resposta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {reply.replyToUsername && (
                        <p className="text-[11px] text-blue-300/70 mt-0.5 flex items-center gap-1">
                          <CornerDownRight className="w-3 h-3 text-[#60A5FA]" />
                          <span>
                            Respondendo a{' '}
                            <strong className="text-[#60A5FA]">
                              @{reply.replyToUsername}
                            </strong>
                          </span>
                        </p>
                      )}

                      <p className="mt-1 text-xs sm:text-sm text-blue-50/90 leading-relaxed whitespace-pre-line break-words">
                        <FormattedTextWithMentions
                          text={reply.text}
                          onClickMention={onInspectMention}
                        />
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reply Form */}
          {isAuthenticated && currentUserProfile ? (
            <form onSubmit={handleReplySubmit} className="space-y-2 pt-1">
              {replyingTo && (
                <div className="flex items-center justify-between rounded-lg bg-blue-500/10 border border-blue-400/25 px-3 py-1.5 text-xs text-blue-200">
                  <span>
                    Respondendo a{' '}
                    <strong className="text-[#60A5FA]">
                      @{replyingTo.username}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="text-blue-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <div className="flex-1">
                  <textarea
                    rows={2}
                    maxLength={REPLY_MAX_LENGTH}
                    value={replyText}
                    onChange={(e) => {
                      const nextVal = e.target.value.slice(0, REPLY_MAX_LENGTH);
                      setReplyText(nextVal);
                      setReplyCursorPos(e.target.selectionStart);
                    }}
                    onKeyUp={(e) =>
                      setReplyCursorPos(e.currentTarget.selectionStart)
                    }
                    onClick={(e) =>
                      setReplyCursorPos(e.currentTarget.selectionStart)
                    }
                    placeholder="Escreva uma resposta (use @username para mencionar)..."
                    className="w-full rounded-xl bg-[#040D1A] border border-blue-400/25 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-blue-300/40 focus:border-[#60A5FA] focus:outline-none resize-none"
                  />
                  {typedReplyMention && (
                    <div className="mt-1.5 rounded-xl bg-[#040D1A] border border-blue-400/30 p-2.5 space-y-1.5">
                      <span className="block text-[11px] font-semibold text-[#60A5FA]">
                        Usuários com &ldquo;@{typedReplyMention.firstThree}&rdquo;
                      </span>
                      {replyMentionSuggestions.length === 0 ? (
                        <p className="text-[11px] text-blue-200/60">
                          Nenhum usuário encontrado com essas iniciais.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                          {replyMentionSuggestions.map((prof) => (
                            <button
                              key={prof.uid}
                              type="button"
                              onClick={() =>
                                handleInsertReplyMention(prof.username)
                              }
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#071426] hover:bg-[#2563EB]/25 border border-blue-400/25 px-2.5 py-1 text-xs text-blue-100 cursor-pointer"
                            >
                              <span className="text-[#60A5FA] font-semibold">
                                @{prof.username.replace(/^@+/, '').toLowerCase()}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between text-[11px] text-blue-300/60">
                    <span>Até {REPLY_MAX_LENGTH} caracteres</span>
                    <span
                      className={`font-mono-num ${
                        replyText.length >= REPLY_MAX_LENGTH
                          ? 'text-amber-400 font-bold'
                          : ''
                      }`}
                    >
                      {replyText.length}/{REPLY_MAX_LENGTH}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    isSubmittingReply ||
                    replyText.trim().length === 0 ||
                    replyText.length > REPLY_MAX_LENGTH
                  }
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-45 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all cursor-pointer shrink-0"
                >
                  {isSubmittingReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Responder</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-xl bg-[#040D1A]/80 border border-blue-400/20 p-3 text-center">
              <button
                type="button"
                onClick={onRequireAuth}
                className="text-xs font-semibold text-[#60A5FA] hover:underline cursor-pointer"
              >
                Entre na sua conta para responder a esta publicação
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

interface CommunityViewProps {
  books: Book[];
  posts: CommunityPost[];
  likes: CommunityLike[];
  replies: CommunityReply[];
  follows: CommunityFollow[];
  notifications: CommunityNotification[];
  reports: CommunityReport[];
  publicProfilesMap: Record<string, PublicProfile>;
  currentUserProfile: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  onSelectBook: (book: Book) => void;
  onCreatePost: (input: CreatePostInput) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onToggleLike: (post: CommunityPost) => Promise<void>;
  onCreateReply: (input: CreateReplyInput) => Promise<void>;
  onDeleteReply: (replyId: string) => Promise<void>;
  onToggleFollow: (targetUserId: string) => Promise<void>;
  onMarkNotificationsRead: () => Promise<void>;
  onSubmitReport: (input: CreateReportInput) => Promise<void>;
  onResolveReport?: (
    reportId: string,
    status: 'reviewed' | 'dismissed'
  ) => Promise<void>;
  onNavigateProfile: () => void;
  onRefreshFeed?: () => Promise<void>;
  unreadMessagesCount?: number;
  onOpenMessages?: (targetUserId?: string) => void;
  onOpenNotifications?: () => void;
  initialPostId?: string | null;
  onClearInitialPostId?: () => void;
  initialInspectUserId?: string | null;
  onClearInitialInspectUserId?: () => void;
}

const FEED_PAGE_SIZE = 10;
const PULL_REFRESH_THRESHOLD = 54;
const PULL_MAX_DISTANCE = 96;

export const CommunityView: React.FC<CommunityViewProps> = ({
  books,
  posts,
  likes,
  replies,
  follows,
  notifications,
  reports,
  publicProfilesMap,
  currentUserProfile,
  isAuthenticated,
  isAdmin,
  onSelectBook,
  onCreatePost,
  onDeletePost,
  onToggleLike,
  onCreateReply,
  onDeleteReply,
  onToggleFollow,
  onMarkNotificationsRead,
  onSubmitReport,
  onResolveReport,
  onNavigateProfile,
  onRefreshFeed,
  unreadMessagesCount = 0,
  onOpenMessages,
  onOpenNotifications,
  initialPostId,
  onClearInitialPostId,
  initialInspectUserId,
  onClearInitialInspectUserId,
}) => {
  const activeBooks = useMemo(
    () => books.filter((b) => b.status === 'ativo'),
    [books]
  );

  // Feed Filter ('todos' | 'seguindo')
  const [feedMode, setFeedMode] = useState<'todos' | 'seguindo'>('todos');

  useEffect(() => {
    const syncMobileFeedMode = () => {
      if (window.innerWidth < 768 && feedMode === 'seguindo') {
        setFeedMode('todos');
      }
    };
    syncMobileFeedMode();
    window.addEventListener('resize', syncMobileFeedMode);
    return () => window.removeEventListener('resize', syncMobileFeedMode);
  }, [feedMode]);

  // Post Composer State
  const [composerModalOpen, setComposerModalOpen] = useState(false);
  const [postText, setPostText] = useState('');
  const [composerCursorPos, setComposerCursorPos] = useState<number | null>(
    null
  );
  const [postImageUrl, setPostImageUrl] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const postImageInputRef = useRef<HTMLInputElement | null>(null);

  // Notifications Drawer State
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Dedicated Post Thread View State (Feed -> Post Conversation -> Back to Feed)
  const [activeThreadPostId, setActiveThreadPostId] = useState<string | null>(
    null
  );
  const savedFeedScrollYRef = useRef<number>(0);

  const openPostThread = useCallback((postId: string) => {
    savedFeedScrollYRef.current = window.scrollY;
    setActiveThreadPostId(postId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const closePostThread = useCallback(() => {
    setActiveThreadPostId(null);
    requestAnimationFrame(() => {
      window.scrollTo({
        top: savedFeedScrollYRef.current,
        behavior: 'auto',
      });
    });
  }, []);

  // Inspected Reader Public Profile Modal
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);
  const [showInspectedUserPosts, setShowInspectedUserPosts] = useState(false);

  const openInspectedUser = (uid: string | null) => {
    if (
      uid &&
      !isAdmin &&
      (isAdminUid(uid, publicProfilesMap) ||
        isAdminIdentity(publicProfilesMap[uid]))
    ) {
      return;
    }
    setInspectedUserId(uid);
    setShowInspectedUserPosts(false);
  };

  useEffect(() => {
    if (initialPostId) {
      openPostThread(initialPostId);
      onClearInitialPostId?.();
    }
  }, [initialPostId, openPostThread, onClearInitialPostId]);

  useEffect(() => {
    if (initialInspectUserId) {
      if (
        !isAdmin &&
        (isAdminUid(initialInspectUserId, publicProfilesMap) ||
          isAdminIdentity(publicProfilesMap[initialInspectUserId]))
      ) {
        onClearInitialInspectUserId?.();
        return;
      }
      setInspectedUserId(initialInspectUserId);
      setShowInspectedUserPosts(false);
      onClearInitialInspectUserId?.();
    }
  }, [initialInspectUserId, onClearInitialInspectUserId, isAdmin, publicProfilesMap]);

  // Report Modal State
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'post' | 'user';
    targetPostId?: string;
    targetUserId: string;
    targetUsername?: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('Spam ou propaganda');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const currentUserId = currentUserProfile?.uid || null;

  const showTempBanner = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => {
      setFeedbackBanner(null);
    }, 3500);
  };

  // Follow sets & counts for current user
  const myFollowingIds = useMemo(() => {
    if (!currentUserId) return new Set<string>();
    return new Set(
      follows
        .filter((f) => f.followerId === currentUserId)
        .map((f) => f.followingId)
    );
  }, [follows, currentUserId]);

  const myFollowerIds = useMemo(() => {
    if (!currentUserId) return new Set<string>();
    return new Set(
      follows
        .filter((f) => f.followingId === currentUserId)
        .map((f) => f.followerId)
    );
  }, [follows, currentUserId]);

  const myFollowersCount = useMemo(() => {
    if (!currentUserId) return 0;
    return follows.filter((f) => f.followingId === currentUserId).length;
  }, [follows, currentUserId]);

  const myPostsCount = useMemo(() => {
    if (!currentUserId) return 0;
    return posts.filter((p) => p.authorId === currentUserId).length;
  }, [posts, currentUserId]);

  // Unread notifications for current user
  const myNotifications = useMemo(() => {
    if (!currentUserId) return [];
    return notifications
      .filter((n) => n.recipientId === currentUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notifications, currentUserId]);

  const unreadNotificationsCount = useMemo(
    () => myNotifications.filter((n) => !n.read).length,
    [myNotifications]
  );

  // Known community profiles for @mention suggestions and "Leitores na Comunidade"
  const knownCommunityProfiles = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    Object.values(publicProfilesMap).forEach((prof) => {
      if (prof && prof.uid && prof.username) {
        if (
          !isAdmin &&
          (isAdminIdentity(prof) || isAdminUid(prof.uid, publicProfilesMap))
        ) {
          return;
        }
        map.set(prof.uid, prof);
      }
    });
    posts.forEach((p) => {
      if (!isAdmin && isAdminPost(p, publicProfilesMap)) return;
      if (!map.has(p.authorId) && p.authorUsername) {
        map.set(p.authorId, {
          uid: p.authorId,
          displayName: p.authorName,
          username: p.authorUsername.replace(/^@+/, '').toLowerCase(),
          photoURL: p.authorPhoto,
          updatedAt: p.createdAt,
        });
      }
    });
    return Array.from(map.values());
  }, [publicProfilesMap, posts, isAdmin]);

  // Deduplicated & Chronologically Ordered Posts (mais recente -> mais antiga, never expiring)
  const deduplicatedSortedPosts = useMemo(() => {
    const uniqueById = new Map<string, CommunityPost>();
    for (const p of posts) {
      if (p && p.id && !uniqueById.has(p.id)) {
        uniqueById.set(p.id, p);
      } else if (p && p.id) {
        uniqueById.set(p.id, p);
      }
    }
    return Array.from(uniqueById.values()).sort((a, b) => {
      const cmp = (b.createdAt || '').localeCompare(a.createdAt || '');
      if (cmp !== 0) return cmp;
      return b.id.localeCompare(a.id);
    });
  }, [posts]);

  // Feed Refresh, Deduplication & Progressive Pagination State
  const [displayedPostIds, setDisplayedPostIds] = useState<Set<string>>(
    () => new Set()
  );
  const [pendingNewPostIds, setPendingNewPostIds] = useState<Set<string>>(
    () => new Set()
  );
  const [lastRefreshAt, setLastRefreshAt] = useState<string>(() =>
    new Date().toISOString()
  );
  const [visiblePostsCount, setVisiblePostsCount] =
    useState<number>(FEED_PAGE_SIZE);
  const [isLoadingOlderPosts, setIsLoadingOlderPosts] = useState(false);

  // Pull-to-Refresh Gesture State
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const hasInitializedFeedRef = useRef(false);
  const feedTopRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  // Track already-displayed vs newly-arrived posts without duplicating or losing position
  useEffect(() => {
    if (deduplicatedSortedPosts.length === 0) {
      return;
    }

    const currentCatalogIds = new Set(deduplicatedSortedPosts.map((p) => p.id));

    if (!hasInitializedFeedRef.current) {
      hasInitializedFeedRef.current = true;
      setDisplayedPostIds(new Set(currentCatalogIds));
      setPendingNewPostIds(new Set());
      setLastRefreshAt(new Date().toISOString());
      return;
    }

    setDisplayedPostIds((prevDisplayed) => {
      const nextDisplayed = new Set<string>();
      // Keep existing displayed posts that still exist (handles deletions cleanly)
      prevDisplayed.forEach((id) => {
        if (currentCatalogIds.has(id)) {
          nextDisplayed.add(id);
        }
      });

      // Immediately show posts created by the current user or if feed was empty
      for (const post of deduplicatedSortedPosts) {
        if (
          !nextDisplayed.has(post.id) &&
          (post.authorId === currentUserId || prevDisplayed.size === 0)
        ) {
          nextDisplayed.add(post.id);
        }
      }

      return nextDisplayed;
    });

    setPendingNewPostIds((prevPending) => {
      const nextPending = new Set<string>();
      prevPending.forEach((id) => {
        if (currentCatalogIds.has(id)) {
          nextPending.add(id);
        }
      });

      for (const post of deduplicatedSortedPosts) {
        if (
          !displayedPostIds.has(post.id) &&
          post.authorId !== currentUserId &&
          displayedPostIds.size > 0
        ) {
          nextPending.add(post.id);
        }
      }

      return nextPending;
    });
  }, [deduplicatedSortedPosts, currentUserId]);

  // Filter posts by feed mode ('todos' = Para você, 'seguindo' = Seguindo)
  const modeFilteredAllPosts = useMemo(() => {
    if (feedMode === 'seguindo') {
      if (!currentUserId) return [];
      return deduplicatedSortedPosts.filter(
        (p) =>
          myFollowingIds.has(p.authorId) || p.authorId === currentUserId
      );
    }
    return deduplicatedSortedPosts;
  }, [deduplicatedSortedPosts, feedMode, currentUserId, myFollowingIds]);

  // New posts waiting to be revealed via "↑ X novas publicações" or pull-to-refresh
  const pendingNewPostsForCurrentMode = useMemo(() => {
    return modeFilteredAllPosts.filter(
      (p) => pendingNewPostIds.has(p.id) && !displayedPostIds.has(p.id)
    );
  }, [modeFilteredAllPosts, pendingNewPostIds, displayedPostIds]);

  // All displayed posts (mais recente -> mais antiga, never expiring)
  const allDisplayedFeedPosts = useMemo(() => {
    if (!hasInitializedFeedRef.current) return modeFilteredAllPosts;
    return modeFilteredAllPosts.filter((p) => !pendingNewPostIds.has(p.id));
  }, [modeFilteredAllPosts, pendingNewPostIds]);

  // Paginated slice of displayed posts (progressive loading as user scrolls down)
  const feedPosts = useMemo(() => {
    return allDisplayedFeedPosts.slice(0, visiblePostsCount);
  }, [allDisplayedFeedPosts, visiblePostsCount]);

  const hasMoreOlderPosts = visiblePostsCount < allDisplayedFeedPosts.length;

  const activeThreadPost = useMemo(() => {
    if (!activeThreadPostId) return null;
    return deduplicatedSortedPosts.find((p) => p.id === activeThreadPostId) || null;
  }, [activeThreadPostId, deduplicatedSortedPosts]);

  useEffect(() => {
    if (activeThreadPostId && !activeThreadPost) {
      setActiveThreadPostId(null);
    }
  }, [activeThreadPostId, activeThreadPost]);

  // Apply pending new posts and scroll to top
  const applyNewPostsAndScrollTop = useCallback(() => {
    const allIds = new Set(deduplicatedSortedPosts.map((p) => p.id));
    setDisplayedPostIds(allIds);
    setPendingNewPostIds(new Set());
    setLastRefreshAt(new Date().toISOString());
    if (feedTopRef.current) {
      feedTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [deduplicatedSortedPosts]);

  // Pull-to-refresh execution (fetches latest posts without reloading the page)
  const executePullToRefresh = useCallback(async () => {
    if (isRefreshingFeed) return;
    setIsRefreshingFeed(true);
    setPullDistance(PULL_REFRESH_THRESHOLD);
    const minDelay = new Promise((res) => setTimeout(res, 520));
    try {
      await Promise.all([onRefreshFeed ? onRefreshFeed() : Promise.resolve(), minDelay]);
    } finally {
      setDisplayedPostIds(new Set(deduplicatedSortedPosts.map((p) => p.id)));
      setPendingNewPostIds(new Set());
      setLastRefreshAt(new Date().toISOString());
      setIsRefreshingFeed(false);
      setPullDistance(0);
    }
  }, [isRefreshingFeed, onRefreshFeed, deduplicatedSortedPosts]);

  // Touch & Mouse Pull-to-Refresh Handlers when at top of feed
  const handlePullStart = (clientY: number) => {
    if (isRefreshingFeed) return;
    if (window.scrollY <= 12) {
      pullStartYRef.current = clientY;
      isPullingRef.current = true;
    } else {
      pullStartYRef.current = null;
      isPullingRef.current = false;
    }
  };

  const handlePullMove = (clientY: number) => {
    if (!isPullingRef.current || pullStartYRef.current === null || isRefreshingFeed) {
      return;
    }
    if (window.scrollY > 12) {
      isPullingRef.current = false;
      pullStartYRef.current = null;
      setPullDistance(0);
      return;
    }
    const deltaY = clientY - pullStartYRef.current;
    if (deltaY > 0) {
      const damped = Math.min(PULL_MAX_DISTANCE, deltaY * 0.46);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
    }
  };

  const handlePullEnd = () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    pullStartYRef.current = null;
    if (pullDistance >= PULL_REFRESH_THRESHOLD && !isRefreshingFeed) {
      void executePullToRefresh();
    } else if (!isRefreshingFeed) {
      setPullDistance(0);
    }
  };

  // Progressive Infinite Scroll Observer for older posts
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMoreOlderPosts) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting && !isLoadingOlderPosts) {
          setIsLoadingOlderPosts(true);
          setTimeout(() => {
            setVisiblePostsCount((prev) =>
              Math.min(allDisplayedFeedPosts.length, prev + FEED_PAGE_SIZE)
            );
            setIsLoadingOlderPosts(false);
          }, 220);
        }
      },
      { rootMargin: '260px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreOlderPosts, isLoadingOlderPosts, allDisplayedFeedPosts.length]);

  const selectedBookForComposer = useMemo(() => {
    if (!selectedBookId) return null;
    return activeBooks.find((b) => b.id === selectedBookId) || null;
  }, [selectedBookId, activeBooks]);

  const filteredBooksForPicker = useMemo(() => {
    const q = bookSearchQuery.trim().toLowerCase();
    if (!q) return activeBooks.slice(0, 12);
    return activeBooks
      .filter(
        (b) =>
          b.titulo.toLowerCase().includes(q) ||
          b.autor.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [activeBooks, bookSearchQuery]);

  const canPublishPost =
    isAuthenticated &&
    Boolean(currentUserProfile) &&
    !isPublishing &&
    !isProcessingImage &&
    postText.length <= POST_MAX_LENGTH &&
    (postText.trim().length > 0 || Boolean(postImageUrl));

  const handleImageFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComposerError(null);
    setIsProcessingImage(true);
    try {
      const dataUrl = await compressPostImageToDataUrl(file);
      setPostImageUrl(dataUrl);
    } catch (err: unknown) {
      setComposerError(
        err instanceof Error
          ? err.message
          : 'Erro ao processar a imagem selecionada.'
      );
    } finally {
      setIsProcessingImage(false);
      if (postImageInputRef.current) {
        postImageInputRef.current.value = '';
      }
    }
  };

  const handleInsertMention = (username: string) => {
    const clean = username.replace(/^@+/, '').toLowerCase();
    const activeTyped = getTypedMentionMatch(postText, composerCursorPos);
    if (activeTyped) {
      const before = postText.slice(0, activeTyped.tokenStart);
      const after = postText.slice(activeTyped.tokenEnd);
      const inserted = `@${clean} `;
      const next = `${before}${inserted}${after.replace(/^\s+/, '')}`.slice(
        0,
        POST_MAX_LENGTH
      );
      setPostText(next);
      setComposerCursorPos(
        Math.min(next.length, before.length + inserted.length)
      );
      setMentionPickerOpen(false);
      return;
    }
    const insertion = `@${clean} `;
    const next = (postText ? `${postText.trimEnd()} ${insertion}` : insertion).slice(
      0,
      POST_MAX_LENGTH
    );
    setPostText(next);
    setComposerCursorPos(next.length);
    setMentionPickerOpen(false);
  };

  const typedComposerMention = useMemo(
    () => getTypedMentionMatch(postText, composerCursorPos),
    [postText, composerCursorPos]
  );

  const typedComposerMentionSuggestions = useMemo(() => {
    if (!typedComposerMention) return [];
    return knownCommunityProfiles
      .filter((prof) => {
        const uname = prof.username.replace(/^@+/, '').toLowerCase();
        return (
          uname.startsWith(typedComposerMention.query) ||
          uname.startsWith(typedComposerMention.firstThree)
        );
      })
      .sort((a, b) => {
        const aExact = a.username
          .replace(/^@+/, '')
          .toLowerCase()
          .startsWith(typedComposerMention.query)
          ? 0
          : 1;
        const bExact = b.username
          .replace(/^@+/, '')
          .toLowerCase()
          .startsWith(typedComposerMention.query)
          ? 0
          : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.username.localeCompare(b.username);
      })
      .slice(0, 10);
  }, [typedComposerMention, knownCommunityProfiles]);

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublishPost) return;
    setComposerError(null);

    if (postText.length > POST_MAX_LENGTH) {
      setComposerError(
        `A publicação não pode ultrapassar ${POST_MAX_LENGTH} caracteres.`
      );
      return;
    }

    setIsPublishing(true);
    try {
      await onCreatePost({
        text: postText.trim(),
        imageUrl: postImageUrl || undefined,
        bookId: selectedBookId || undefined,
      });
      setPostText('');
      setPostImageUrl('');
      setSelectedBookId('');
      setBookPickerOpen(false);
      setMentionPickerOpen(false);
      setComposerModalOpen(false);
      showTempBanner('Publicação compartilhada na Comunidade!');
    } catch (err: unknown) {
      setComposerError(
        err instanceof Error
          ? err.message
          : 'Não foi possível publicar agora. Tente novamente.'
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleInspectMention = (username: string) => {
    const clean = username.replace(/^@+/, '').toLowerCase();
    if (!isAdmin && isReservedAdminUsername(clean)) return;
    const found = knownCommunityProfiles.find(
      (p) => p.username.replace(/^@+/, '').toLowerCase() === clean
    );
    if (found) {
      openInspectedUser(found.uid);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    setIsSubmittingReport(true);
    try {
      await onSubmitReport({
        targetType: reportTarget.targetType,
        targetPostId: reportTarget.targetPostId,
        targetUserId: reportTarget.targetUserId,
        targetUsername: reportTarget.targetUsername,
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      });
      setReportTarget(null);
      setReportDetails('');
      showTempBanner(
        'Denúncia enviada para análise da moderação do LIVROFLIX.'
      );
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Inspected Reader Profile Data
  const inspectedProfile = useMemo(() => {
    if (!inspectedUserId) return null;
    if (!isAdmin && isAdminUid(inspectedUserId, publicProfilesMap)) {
      return null;
    }
    if (currentUserProfile && inspectedUserId === currentUserProfile.uid) {
      return {
        uid: currentUserProfile.uid,
        displayName:
          currentUserProfile.displayName ||
          currentUserProfile.nome ||
          'Leitor LIVROFLIX',
        username: (currentUserProfile.username || 'leitor')
          .replace(/^@+/, '')
          .toLowerCase(),
        bio: currentUserProfile.bio || '',
        photoURL: currentUserProfile.photoURL ?? currentUserProfile.foto ?? '',
        premium: currentUserProfile.premium,
        usernameColor: currentUserProfile.usernameColor,
        profileCustomization: getEffectiveProfileCustomization(
          currentUserProfile,
          currentUserProfile.profileCustomization
        ),
        favoriteBooks:
          currentUserProfile.profileFavoriteBooks ??
          currentUserProfile.favoriteBooks,
        unlockedBadges: currentUserProfile.unlockedBadges,
        profileBadges: currentUserProfile.profileBadges,
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
    const postFromUser = posts.find((p) => p.authorId === inspectedUserId);
    if (postFromUser) {
      return {
        uid: postFromUser.authorId,
        displayName: postFromUser.authorName,
        username: postFromUser.authorUsername.replace(/^@+/, '').toLowerCase(),
        bio: '',
        photoURL: postFromUser.authorPhoto || '',
        premium: undefined,
        usernameColor: undefined,
        profileCustomization: undefined,
        favoriteBooks: undefined,
        unlockedBadges: undefined,
        profileBadges: undefined,
      };
    }
    return null;
  }, [inspectedUserId, currentUserProfile, publicProfilesMap, posts]);

  const inspectedUserPosts = useMemo(() => {
    if (!inspectedUserId) return [];
    return posts
      .filter((p) => p.authorId === inspectedUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [posts, inspectedUserId]);

  const inspectedFollowersCount = useMemo(() => {
    if (!inspectedUserId) return 0;
    return follows.filter((f) => f.followingId === inspectedUserId).length;
  }, [follows, inspectedUserId]);

  const inspectedFollowingCount = useMemo(() => {
    if (!inspectedUserId) return 0;
    return follows.filter((f) => f.followerId === inspectedUserId).length;
  }, [follows, inspectedUserId]);

  const renderComposerControls = () => (
    <form onSubmit={handlePublishSubmit} className="space-y-3.5">
      {composerError && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3 text-xs text-rose-200">
          {composerError}
        </div>
      )}

      <div className="flex items-start gap-3.5">
        {currentUserProfile?.photoURL || currentUserProfile?.foto ? (
          <img
            src={currentUserProfile.photoURL || currentUserProfile.foto}
            alt={currentUserProfile.displayName || currentUserProfile.nome}
            className="h-11 w-11 rounded-full object-cover ring-1 ring-[#60A5FA]/50 shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#040D1A] border border-[#60A5FA]/40 text-[#60A5FA] font-display text-lg font-bold">
            {(
              currentUserProfile?.displayName ||
              currentUserProfile?.nome ||
              'L'
            )[0].toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <textarea
            rows={3}
            maxLength={POST_MAX_LENGTH}
            value={postText}
            onChange={(e) => {
              const nextVal = e.target.value.slice(0, POST_MAX_LENGTH);
              setPostText(nextVal);
              setComposerCursorPos(e.target.selectionStart);
            }}
            onKeyUp={(e) =>
              setComposerCursorPos(e.currentTarget.selectionStart)
            }
            onClick={(e) =>
              setComposerCursorPos(e.currentTarget.selectionStart)
            }
            placeholder="O que você está lendo ou pensando hoje? Mencione leitores com @username..."
            className="w-full rounded-xl bg-[#040D1A] border border-blue-400/25 p-3.5 text-sm sm:text-[15px] text-white placeholder-blue-300/40 focus:border-[#60A5FA] focus:outline-none resize-none leading-relaxed"
          />

          {/* Lista automática de usuários ao digitar @ + 3 primeiras letras */}
          {typedComposerMention && (
            <div className="mt-2.5 rounded-xl bg-[#040D1A] border border-blue-400/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#60A5FA]">
                  Usuários com &ldquo;@{typedComposerMention.firstThree}&rdquo;
                </span>
              </div>
              {typedComposerMentionSuggestions.length === 0 ? (
                <p className="text-xs text-blue-200/60">
                  Nenhum usuário encontrado com essas 3 primeiras letras.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {typedComposerMentionSuggestions.map((prof) => (
                    <button
                      key={prof.uid}
                      type="button"
                      onClick={() => handleInsertMention(prof.username)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#071426] hover:bg-[#2563EB]/25 border border-blue-400/25 px-2.5 py-1 text-xs text-blue-100 cursor-pointer"
                    >
                      <span className="text-[#60A5FA] font-semibold">
                        @{prof.username.replace(/^@+/, '').toLowerCase()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Image Preview */}
          {postImageUrl && (
            <div className="mt-3 relative inline-block overflow-hidden rounded-xl border border-blue-400/30 bg-[#040D1A]">
              <img
                src={postImageUrl}
                alt="Prévia da imagem"
                className="max-h-56 w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setPostImageUrl('')}
                className="absolute top-2 right-2 rounded-full bg-black/75 hover:bg-rose-600 p-1.5 text-white transition-colors cursor-pointer"
                title="Remover imagem"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Selected Book Preview */}
          {selectedBookForComposer && (
            <div className="mt-3 relative inline-block w-24 sm:w-28">
              <BookCover book={selectedBookForComposer} />
              <button
                type="button"
                onClick={() => setSelectedBookId('')}
                className="absolute top-1.5 right-1.5 z-10 rounded-full bg-black/75 hover:bg-rose-600 p-1 text-white transition-colors cursor-pointer"
                title="Desvincular livro"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Book Picker Dropdown */}
          {bookPickerOpen && (
            <div className="mt-3 rounded-xl bg-[#040D1A] border border-blue-400/30 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#60A5FA] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Vincular um livro do catálogo</span>
                </span>
                <button
                  type="button"
                  onClick={() => setBookPickerOpen(false)}
                  className="text-xs text-blue-200/70 hover:text-white cursor-pointer"
                >
                  Fechar
                </button>
              </div>

              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-blue-300/60 absolute left-3" />
                <input
                  type="text"
                  value={bookSearchQuery}
                  onChange={(e) => setBookSearchQuery(e.target.value)}
                  placeholder="Buscar livro por título ou autor..."
                  className="w-full rounded-lg bg-[#071426] border border-blue-400/20 pl-8 pr-3 py-2 text-xs text-white focus:border-[#60A5FA] focus:outline-none"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {filteredBooksForPicker.length === 0 ? (
                  <p className="text-xs text-blue-200/60 py-2 text-center">
                    Nenhum livro encontrado no catálogo.
                  </p>
                ) : (
                  filteredBooksForPicker.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBookId(b.id);
                        setBookPickerOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 rounded-lg p-2 text-left transition-colors cursor-pointer ${
                        selectedBookId === b.id
                          ? 'bg-[#2563EB]/30 border border-[#60A5FA]/50'
                          : 'hover:bg-blue-500/10'
                      }`}
                    >
                      <div className="w-8 shrink-0 overflow-hidden rounded">
                        <BookCover book={b} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">
                          {b.titulo}
                        </p>
                        <p className="text-[11px] text-blue-200/70 truncate">
                          {b.autor}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* @Mention Quick Picker (Apenas Desktop) */}
          {mentionPickerOpen && !typedComposerMention && (
            <div className="hidden md:block mt-3 rounded-xl bg-[#040D1A] border border-blue-400/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#60A5FA]">
                  Mencionar leitor (@username)
                </span>
                <button
                  type="button"
                  onClick={() => setMentionPickerOpen(false)}
                  className="text-xs text-blue-200/70 hover:text-white cursor-pointer"
                >
                  Fechar
                </button>
              </div>
              {knownCommunityProfiles.length === 0 ? (
                <p className="text-xs text-blue-200/60">
                  Digite @nomeusuario diretamente no texto da publicação.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {knownCommunityProfiles.map((prof) => (
                    <button
                      key={prof.uid}
                      type="button"
                      onClick={() => handleInsertMention(prof.username)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#071426] hover:bg-[#2563EB]/25 border border-blue-400/25 px-2.5 py-1 text-xs text-blue-100 cursor-pointer"
                    >
                      <span className="text-[#60A5FA] font-semibold">
                        @{prof.username}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom Toolbar: Image + Book + Mention + Counter 0/300 + Publicar */}
          <div className="mt-3 pt-3 border-t border-blue-400/15 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <input
                ref={postImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileSelect}
                className="hidden"
              />

              <button
                type="button"
                disabled={isProcessingImage || isPublishing}
                onClick={() => postImageInputRef.current?.click()}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  postImageUrl
                    ? 'bg-blue-500/20 text-[#60A5FA] border border-blue-400/40'
                    : 'bg-[#040D1A] hover:bg-blue-500/15 text-blue-200 border border-blue-400/20'
                }`}
                title="Adicionar uma imagem"
              >
                {isProcessingImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#60A5FA]" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-[#60A5FA]" />
                )}
                <span>Imagem</span>
              </button>

              <button
                type="button"
                disabled={isPublishing}
                onClick={() => {
                  setBookPickerOpen((prev) => !prev);
                  setMentionPickerOpen(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  selectedBookId || bookPickerOpen
                    ? 'bg-blue-500/20 text-[#60A5FA] border border-blue-400/40'
                    : 'bg-[#040D1A] hover:bg-blue-500/15 text-blue-200 border border-blue-400/20'
                }`}
                title="Vincular um livro do catálogo"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Livro</span>
              </button>

              <button
                type="button"
                disabled={isPublishing}
                onClick={() => {
                  setMentionPickerOpen((prev) => !prev);
                  setBookPickerOpen(false);
                }}
                className={`hidden md:inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  mentionPickerOpen
                    ? 'bg-blue-500/20 text-[#60A5FA] border border-blue-400/40'
                    : 'bg-[#040D1A] hover:bg-blue-500/15 text-blue-200 border border-blue-400/20'
                }`}
                title="Mencionar usuário com @username"
              >
                <AtSign className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span className="hidden sm:inline">Mencionar</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Character Counter 0/300 */}
              <span
                className={`text-xs font-mono-num font-semibold ${
                  postText.length >= POST_MAX_LENGTH
                    ? 'text-amber-400'
                    : 'text-blue-200/70'
                }`}
              >
                {postText.length}/{POST_MAX_LENGTH}
              </span>

              <button
                type="submit"
                disabled={!canPublishPost}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-45 disabled:cursor-not-allowed px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publicando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Publicar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );

  return (
    <div
      className="min-h-screen bg-[#040D1A] pt-28 lg:pt-24 pb-24"
      onTouchStart={(e) => {
        if (e.touches.length === 1) {
          handlePullStart(e.touches[0].clientY);
        }
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 1) {
          handlePullMove(e.touches[0].clientY);
        }
      }}
      onTouchEnd={handlePullEnd}
      onTouchCancel={handlePullEnd}
      onMouseDown={(e) => {
        if (e.button === 0) {
          handlePullStart(e.clientY);
        }
      }}
      onMouseMove={(e) => {
        if (isPullingRef.current) {
          handlePullMove(e.clientY);
        }
      }}
      onMouseUp={handlePullEnd}
      onMouseLeave={handlePullEnd}
    >
      <div ref={feedTopRef} className="mx-auto max-w-3xl px-4 sm:px-8">
        {/* Pull-to-Refresh Animated Indicator */}
        <div
          className="overflow-hidden transition-all duration-200 flex items-center justify-center"
          style={{
            height: isRefreshingFeed
              ? `${PULL_REFRESH_THRESHOLD}px`
              : pullDistance > 4
              ? `${pullDistance}px`
              : '0px',
            opacity: isRefreshingFeed
              ? 1
              : Math.min(1, pullDistance / PULL_REFRESH_THRESHOLD),
          }}
          aria-live="polite"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-[#071426] border border-blue-400/30 px-4 py-1.5 text-xs font-semibold text-[#60A5FA] shadow-lg">
            {isRefreshingFeed ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#60A5FA]" />
                <span>Atualizando feed...</span>
              </>
            ) : pullDistance >= PULL_REFRESH_THRESHOLD ? (
              <>
                <ArrowUp className="w-4 h-4 text-[#60A5FA] transition-transform duration-200" />
                <span>Solte para atualizar</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-4 h-4 text-blue-300/80 transition-transform duration-200" />
                <span>Puxe para atualizar</span>
              </>
            )}
          </div>
        </div>
        {feedbackBanner && (
          <div className="mb-6 rounded-xl bg-emerald-500/15 border border-emerald-400/30 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-300 flex items-center justify-between gap-3 shadow-lg">
            <span className="inline-flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              {feedbackBanner}
            </span>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-emerald-200/70 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dedicated Post Thread View OR Central Feed & Composer */}
        {activeThreadPost ? (
          <div>
            {/* Original Post at the Top + Replies Below */}
            <CommunityPostCard
              key={activeThreadPost.id}
              post={activeThreadPost}
              books={books}
              likes={likes}
              replies={replies}
              follows={follows}
              publicProfilesMap={publicProfilesMap}
              currentUserProfile={currentUserProfile}
              isAuthenticated={isAuthenticated}
              isAdmin={isAdmin}
              onSelectBook={onSelectBook}
              onToggleLike={onToggleLike}
              onCreateReply={onCreateReply}
              onDeletePost={async (postId) => {
                await onDeletePost(postId);
                closePostThread();
              }}
              onDeleteReply={onDeleteReply}
              onToggleFollow={onToggleFollow}
              onOpenReportModal={(target) => setReportTarget(target)}
              onInspectUser={(uid) => openInspectedUser(uid)}
              onInspectMention={handleInspectMention}
              onRequireAuth={onNavigateProfile}
              isDetailView={true}
              onBackFromDetail={closePostThread}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Bar da Comunidade: No celular exibe Mensagens (como antes); no PC sem os botões Notificações e Mensagens */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFeedMode('todos')}
                  className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    feedMode === 'todos'
                      ? 'bg-[#2563EB] text-white shadow-md'
                      : 'bg-[#071426] hover:bg-blue-500/15 border border-blue-400/20 text-blue-200 hover:text-white'
                  }`}
                >
                  Para você
                </button>
                <button
                  type="button"
                  onClick={() => setFeedMode('seguindo')}
                  className={`hidden md:inline-flex rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    feedMode === 'seguindo'
                      ? 'bg-[#2563EB] text-white shadow-md'
                      : 'bg-[#071426] hover:bg-blue-500/15 border border-blue-400/20 text-blue-200 hover:text-white'
                  }`}
                >
                  Seguindo
                </button>
              </div>

              {onOpenMessages && (
                <div className="flex items-center gap-2 md:hidden">
                  <button
                    type="button"
                    onClick={() => onOpenMessages()}
                    className="relative inline-flex items-center gap-2 rounded-xl bg-[#071426] hover:bg-blue-500/15 border border-blue-400/30 px-4 py-2 text-xs sm:text-sm font-bold text-white transition-all cursor-pointer shadow-md"
                  >
                    <MessageCircle className="w-4 h-4 text-[#60A5FA]" />
                    <span>Mensagens</span>
                    {unreadMessagesCount > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2563EB] px-1.5 text-[11px] font-mono-num font-bold text-white">
                        {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Inline Post Composer Card */}
            {isAuthenticated && currentUserProfile ? (
              <div className="rounded-2xl bg-[#071426] border border-blue-400/25 p-4 sm:p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-blue-200/90">
                    Criar publicação
                  </span>
                </div>
                {renderComposerControls()}
              </div>
            ) : (
              <div className="rounded-2xl bg-gradient-to-br from-[#071426] to-[#0B1E36] border border-blue-400/25 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    Participe da Comunidade LIVROFLIX
                  </h2>
                  <p className="text-xs sm:text-sm text-blue-200/75 mt-1">
                    Faça login na sua conta para publicar, vincular livros, seguir leitores, curtir e responder.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onNavigateProfile}
                  className="rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition-all cursor-pointer shrink-0"
                >
                  Entrar na Conta
                </button>
              </div>
            )}

            {/* Discreet New Posts Indicator: ↑ X novas publicações */}
            {pendingNewPostsForCurrentMode.length > 0 && (
              <div className="sticky top-20 z-30 flex justify-center py-1">
                <button
                  type="button"
                  onClick={applyNewPostsAndScrollTop}
                  className="inline-flex items-center gap-2 rounded-full bg-[#2563EB] hover:bg-[#3B82F6] border border-blue-300/40 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-[0_10px_25px_rgba(37,99,235,0.45)] transition-all cursor-pointer animate-bounce"
                >
                  <ArrowUp className="w-4 h-4" />
                  <span>
                    ↑ {pendingNewPostsForCurrentMode.length}{' '}
                    {pendingNewPostsForCurrentMode.length === 1
                      ? 'nova publicação'
                      : 'novas publicações'}
                  </span>
                </button>
              </div>
            )}

            {/* Feed Posts List (mais recente -> mais antiga, progressive pagination) */}
            {feedPosts.length === 0 ? (
              <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-10 text-center space-y-3">
                <MessageCircle className="w-10 h-10 text-[#60A5FA] mx-auto opacity-80" />
                <h3 className="font-display text-2xl font-bold text-white">
                  {feedMode === 'seguindo'
                    ? 'Nenhuma publicação de quem você segue ainda'
                    : 'Seja o primeiro a publicar na Comunidade!'}
                </h3>
                <p className="text-xs sm:text-sm text-blue-200/75 max-w-md mx-auto">
                  {feedMode === 'seguindo'
                    ? 'Siga outros leitores na aba Para você para acompanhar as publicações deles aqui.'
                    : 'Compartilhe uma reflexão, indique um livro do catálogo ou inicie uma conversa literária.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedPosts.map((post) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    books={books}
                    likes={likes}
                    replies={replies}
                    follows={follows}
                    publicProfilesMap={publicProfilesMap}
                    currentUserProfile={currentUserProfile}
                    isAuthenticated={isAuthenticated}
                    isAdmin={isAdmin}
                    onSelectBook={onSelectBook}
                    onToggleLike={onToggleLike}
                    onCreateReply={onCreateReply}
                    onDeletePost={onDeletePost}
                    onDeleteReply={onDeleteReply}
                    onToggleFollow={onToggleFollow}
                    onOpenReportModal={(target) => setReportTarget(target)}
                    onInspectUser={(uid) => openInspectedUser(uid)}
                    onInspectMention={handleInspectMention}
                    onRequireAuth={onNavigateProfile}
                    onOpenPostDetail={(p) => openPostThread(p.id)}
                  />
                ))}

                {/* Progressive Loading Sentinel for Older Publications */}
                {hasMoreOlderPosts && (
                  <div
                    ref={loadMoreSentinelRef}
                    className="py-6 flex items-center justify-center"
                  >
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-200/70">
                      <Loader2 className="w-4 h-4 animate-spin text-[#60A5FA]" />
                      <span>Carregando publicações anteriores...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: NOVA PUBLICAÇÃO (Accessible from top button & mobile) */}
      {composerModalOpen && isAuthenticated && currentUserProfile && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
          onClick={() => {
            if (!isPublishing) setComposerModalOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-[#071426] border border-blue-400/30 p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-blue-400/15">
              <h2 className="font-display text-xl font-bold text-white">
                Nova publicação
              </h2>
              <button
                type="button"
                onClick={() => setComposerModalOpen(false)}
                className="rounded-full p-1.5 text-blue-200/70 hover:bg-blue-500/15 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderComposerControls()}
          </div>
        </div>
      )}

      {/* MODAL: PERFIL PÚBLICO DO LEITOR NA COMUNIDADE */}
      {inspectedProfile && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
          onClick={() => openInspectedUser(null)}
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
                  <span title="LIVROFLIX Premium" className="inline-flex shrink-0">
                    <Crown className="w-4 h-4 text-amber-400 fill-amber-400/25 shrink-0" />
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => openInspectedUser(null)}
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
                      {(inspectedProfile.username || 'L')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <h3
                        className="font-display text-2xl font-bold text-white"
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
                      </h3>
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
                        isAuthenticated &&
                          currentUserId &&
                          inspectedProfile.uid === currentUserId
                      )}
                      align="center-sm-left"
                    />
                    <div className="mt-3 flex items-center justify-center sm:justify-start gap-5 text-xs text-blue-200/80">
                      <button
                        type="button"
                        onClick={() =>
                          setShowInspectedUserPosts((prev) => !prev)
                        }
                        className={`transition-colors cursor-pointer ${
                          showInspectedUserPosts
                            ? 'text-[#60A5FA] font-semibold underline'
                            : 'hover:text-[#60A5FA]'
                        }`}
                      >
                        <strong className="font-mono-num text-white">
                          {inspectedUserPosts.length}
                        </strong>{' '}
                        {inspectedUserPosts.length === 1
                          ? 'publicação'
                          : 'publicações'}
                      </button>
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

                  <div className="flex items-center gap-2">
                    {isAuthenticated &&
                      currentUserId &&
                      inspectedProfile.uid !== currentUserId && (
                      <>
                        <button
                          type="button"
                          onClick={() => onToggleFollow(inspectedProfile.uid)}
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
                              <span>
                                {myFollowerIds.has(inspectedProfile.uid)
                                  ? 'Seguir de volta'
                                  : 'Seguir'}
                              </span>
                            </>
                          )}
                        </button>

                        {onOpenMessages && (
                          <button
                            type="button"
                            onClick={() => {
                              const targetUid = inspectedProfile.uid;
                              openInspectedUser(null);
                              onOpenMessages(targetUid);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#040D1A] hover:bg-blue-500/20 border border-blue-400/35 px-4 py-2 text-xs font-bold text-[#60A5FA] hover:text-white transition-colors cursor-pointer"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>Mensagem</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setReportTarget({
                              targetType: 'user',
                              targetUserId: inspectedProfile.uid,
                              targetUsername: inspectedProfile.username,
                            });
                          }}
                          className="rounded-xl bg-blue-950/60 hover:bg-rose-500/20 border border-blue-400/20 p-2 text-blue-200 hover:text-rose-300 cursor-pointer"
                          title="Denunciar usuário"
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                </div>
              </div>

              <ProfileFavoriteBooksShowcase
                favoriteBookIds={inspectedProfile.favoriteBooks}
                books={books}
                maxBooks={getMaxProfileFavoriteBooks(inspectedProfile)}
                onSelectBook={(book) => {
                  openInspectedUser(null);
                  onSelectBook(book);
                }}
              />

              {showInspectedUserPosts && (
                <div className="space-y-4">
                  {inspectedUserPosts.length === 0 ? (
                    <p className="text-xs text-blue-200/60 py-4 text-center">
                      Nenhuma publicação feita ainda.
                    </p>
                  ) : (
                    inspectedUserPosts.map((p) => (
                      <CommunityPostCard
                        key={p.id}
                        post={p}
                        books={books}
                        likes={likes}
                        replies={replies}
                        follows={follows}
                        publicProfilesMap={publicProfilesMap}
                        currentUserProfile={currentUserProfile}
                        isAuthenticated={isAuthenticated}
                        isAdmin={isAdmin}
                        onSelectBook={(b) => {
                          openInspectedUser(null);
                          onSelectBook(b);
                        }}
                        onToggleLike={onToggleLike}
                        onCreateReply={onCreateReply}
                        onDeletePost={onDeletePost}
                        onDeleteReply={onDeleteReply}
                        onToggleFollow={onToggleFollow}
                        onOpenReportModal={(target) => setReportTarget(target)}
                        onInspectUser={(uid) => openInspectedUser(uid)}
                        onInspectMention={handleInspectMention}
                        onRequireAuth={onNavigateProfile}
                        onOpenPostDetail={(selectedPost) => {
                          openInspectedUser(null);
                          openPostThread(selectedPost.id);
                        }}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DENUNCIAR PUBLICAÇÃO OU USUÁRIO */}
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
                  {reportTarget.targetType === 'post'
                    ? 'Denunciar publicação'
                    : `Denunciar @${reportTarget.targetUsername || 'usuário'}`}
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
