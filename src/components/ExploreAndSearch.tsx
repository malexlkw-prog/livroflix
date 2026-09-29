import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  User,
  Tag,
  BookOpen,
  Users,
  UserPlus,
  UserCheck,
  UserMinus,
  Crown,
  MessageCircle,
} from 'lucide-react';
import {
  Book,
  CommunityFollow,
  CommunityLike,
  CommunityPost,
  CommunityReply,
  PlatformSettings,
  PublicProfile,
  UserBookItem,
  UserProfile,
} from '../types';
import { BookCard } from './BookCard';
import { CommunityPostCard, CreateReplyInput } from './CommunityView';
import { ProfileFavoriteBooksShowcase } from './MyLibraryAndProfile';
import { ProfileHighlightSection } from './ProfileHighlightSection';
import { FollowersFollowingModal } from './FollowersFollowingModal';
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
import {
  isAdminIdentity,
  isAdminPost,
  isAdminReply,
  isAdminUid,
} from '../utils/adminStealthUtils';

interface SearchViewProps {
  books: Book[];
  userLibrary: Record<string, UserBookItem>;
  onSelectBook: (book: Book) => void;
  onReadBook: (book: Book) => void;
  onToggleList: (book: Book, e: React.MouseEvent) => void;
  platformSettings?: PlatformSettings;
  publicProfilesMap?: Record<string, PublicProfile>;
  communityPosts?: CommunityPost[];
  communityLikes?: CommunityLike[];
  communityReplies?: CommunityReply[];
  communityFollows?: CommunityFollow[];
  currentUserProfile?: UserProfile | null;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  onToggleFollow?: (targetUserId: string) => Promise<void>;
  onToggleLike?: (post: CommunityPost) => Promise<void>;
  onCreateReply?: (input: CreateReplyInput) => Promise<void>;
  onDeletePost?: (postId: string) => Promise<void>;
  onDeleteReply?: (replyId: string) => Promise<void>;
  onRequireAuth?: () => void;
  onOpenMessages?: (targetUserId?: string) => void;
  onSearchPublicProfiles?: (searchQuery: string) => void;
  onLoadRecommendedProfiles?: () => Promise<void> | void;
  onEnsurePublicProfileLoaded?: (uid: string) => void;
  onEnsureUserFollowsLoaded?: (uid: string) => Promise<void> | void;
}

const LEGACY_SUGGESTIONS = new Set([
  'Harry Potter',
  'Machado de Assis',
  'Capitu',
  'Anne Frank',
  'Pequeno Príncipe',
  'George Orwell',
]);

export const SearchView: React.FC<SearchViewProps> = ({
  books,
  onSelectBook,
  platformSettings,
  publicProfilesMap = {},
  communityPosts = [],
  communityLikes = [],
  communityReplies = [],
  communityFollows = [],
  currentUserProfile = null,
  isAuthenticated = false,
  isAdmin = false,
  onToggleFollow,
  onToggleLike,
  onCreateReply,
  onDeletePost,
  onDeleteReply,
  onRequireAuth,
  onOpenMessages,
  onSearchPublicProfiles,
  onLoadRecommendedProfiles,
  onEnsurePublicProfileLoaded,
  onEnsureUserFollowsLoaded,
}) => {
  const [query, setQuery] = useState<string>('');
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);
  const [showInspectedUserPosts, setShowInspectedUserPosts] = useState(false);
  const [followersModalState, setFollowersModalState] = useState<{
    isOpen: boolean;
    initialTab: 'seguidores' | 'seguindo';
    targetUserId: string;
    targetUsername?: string;
  }>({
    isOpen: false,
    initialTab: 'seguidores',
    targetUserId: '',
  });

  const onSearchProfilesRef = React.useRef(onSearchPublicProfiles);
  React.useEffect(() => {
    onSearchProfilesRef.current = onSearchPublicProfiles;
  }, [onSearchPublicProfiles]);

  React.useEffect(() => {
    void onLoadRecommendedProfiles?.();
  }, [onLoadRecommendedProfiles]);

  React.useEffect(() => {
    const clean = query.trim().replace(/^@+/, '').toLowerCase();
    if (clean.length < 2 || !onSearchProfilesRef.current) return;
    const timer = setTimeout(() => {
      onSearchProfilesRef.current?.(clean);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const openInspectedUser = (uid: string | null) => {
    if (
      uid &&
      !isAdmin &&
      (isAdminUid(uid, publicProfilesMap) ||
        isAdminIdentity(publicProfilesMap[uid]))
    ) {
      return;
    }
    if (uid) {
      onEnsurePublicProfileLoaded?.(uid);
      void onEnsureUserFollowsLoaded?.(uid);
    }
    setInspectedUserId(uid);
    setShowInspectedUserPosts(false);
  };

  const currentUserId = currentUserProfile?.uid || '';

  const activeBooks = useMemo(
    () => books.filter((b) => b.status === 'ativo'),
    [books]
  );

  // Build consolidated list of known users from public_profiles, posts, replies, and current user (excluding Admin for regular users)
  const allKnownProfiles = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    Object.values(publicProfilesMap).forEach((prof) => {
      if (prof?.uid) {
        if (!isAdmin && (isAdminIdentity(prof) || isAdminUid(prof.uid, publicProfilesMap))) {
          return;
        }
        map.set(prof.uid, {
          ...prof,
          username: (prof.username || 'leitor').replace(/^@+/, ''),
        });
      }
    });
    communityPosts.forEach((p) => {
      if (!isAdmin && isAdminPost(p, publicProfilesMap)) return;
      if (!map.has(p.authorId)) {
        map.set(p.authorId, {
          uid: p.authorId,
          displayName: p.authorName || p.authorUsername,
          username: (p.authorUsername || 'leitor').replace(/^@+/, ''),
          bio: '',
          photoURL: p.authorPhoto || '',
          updatedAt: p.createdAt,
        });
      }
    });
    communityReplies.forEach((r) => {
      if (!isAdmin && isAdminReply(r, publicProfilesMap)) return;
      if (!map.has(r.authorId)) {
        map.set(r.authorId, {
          uid: r.authorId,
          displayName: r.authorName || r.authorUsername,
          username: (r.authorUsername || 'leitor').replace(/^@+/, ''),
          bio: '',
          photoURL: r.authorPhoto || '',
          updatedAt: r.createdAt,
        });
      }
    });
    if (
      currentUserProfile?.uid &&
      !map.has(currentUserProfile.uid) &&
      (isAdmin || !isAdminIdentity(currentUserProfile))
    ) {
      const uname = (
        currentUserProfile.username ||
        currentUserProfile.displayName ||
        currentUserProfile.nome ||
        'leitor'
      )
        .replace(/^@+/, '')
        .toLowerCase();
      map.set(currentUserProfile.uid, {
        uid: currentUserProfile.uid,
        displayName: uname,
        username: uname,
        bio: currentUserProfile.bio || '',
        photoURL: currentUserProfile.photoURL ?? currentUserProfile.foto ?? '',
        updatedAt: currentUserProfile.updatedAt || new Date().toISOString(),
      });
    }
    return Array.from(map.values());
  }, [
    publicProfilesMap,
    communityPosts,
    communityReplies,
    currentUserProfile,
    isAdmin,
  ]);

  const myFollowingIds = useMemo(() => {
    const set = new Set<string>();
    if (!currentUserId) return set;
    communityFollows.forEach((f) => {
      if (f.followerId === currentUserId) set.add(f.followingId);
    });
    return set;
  }, [communityFollows, currentUserId]);

  const myFollowerIds = useMemo(() => {
    const set = new Set<string>();
    if (!currentUserId) return set;
    communityFollows.forEach((f) => {
      if (f.followingId === currentUserId) set.add(f.followerId);
    });
    return set;
  }, [communityFollows, currentUserId]);

  const recommendedUsers = useMemo(() => {
    const others = allKnownProfiles.filter(
      (prof) => prof.uid && prof.uid !== currentUserId
    );
    return [...others].sort((a, b) => {
      const aFollowed = myFollowingIds.has(a.uid) ? 1 : 0;
      const bFollowed = myFollowingIds.has(b.uid) ? 1 : 0;
      if (aFollowed !== bFollowed) return aFollowed - bFollowed;
      const aFollowsMe = myFollowerIds.has(a.uid) ? 0 : 1;
      const bFollowsMe = myFollowerIds.has(b.uid) ? 0 : 1;
      if (aFollowsMe !== bFollowsMe) return aFollowsMe - bFollowsMe;
      return (a.username || '').localeCompare(b.username || '');
    });
  }, [allKnownProfiles, currentUserId, myFollowingIds, myFollowerIds]);

  const matchedUsers = useMemo(() => {
    const raw = query.trim().toLowerCase();
    if (!raw) return [] as PublicProfile[];
    const cleanQ = raw.replace(/^@+/, '');
    if (!cleanQ) return allKnownProfiles.slice(0, 12);

    return allKnownProfiles.filter((prof) => {
      const uname = (prof.username || '').replace(/^@+/, '').toLowerCase();
      const dname = (prof.displayName || '').toLowerCase();
      return uname.includes(cleanQ) || dname.includes(cleanQ);
    });
  }, [allKnownProfiles, query]);

  // Use custom admin suggestions (filtering out old legacy demo names if any) or derive dynamically from real books
  const quickSuggestions = useMemo(() => {
    const custom = (platformSettings?.searchSuggestions || []).filter(
      (s) => !LEGACY_SUGGESTIONS.has(s)
    );
    if (custom.length > 0) return custom;

    const dynamicSet = new Set<string>();
    activeBooks.forEach((b) => {
      if (b.titulo) dynamicSet.add(b.titulo);
      if (b.autor) dynamicSet.add(b.autor);
      b.generos.forEach((g) => dynamicSet.add(g));
    });
    return Array.from(dynamicSet).slice(0, 8);
  }, [platformSettings?.searchSuggestions, activeBooks]);

  const { matchedBooks, matchedAuthors, matchedGenres, relatedBooks } = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return {
        matchedBooks: activeBooks.slice(0, 12),
        matchedAuthors: [] as string[],
        matchedGenres: [] as string[],
        relatedBooks: [] as Book[],
      };
    }

    const directMatches = activeBooks.filter((book) => {
      const inTitle = book.titulo.toLowerCase().includes(q);
      const inAuthor = book.autor.toLowerCase().includes(q);
      const inGenre = book.generos.some((g) => g.toLowerCase().includes(q));
      const inCharacters = (book.personagens || []).some((p) =>
        p.toLowerCase().includes(q)
      );
      const inKeywords = (book.palavrasChave || []).some((k) =>
        k.toLowerCase().includes(q)
      );
      const inDesc = book.descricao.toLowerCase().includes(q);

      return (
        inTitle || inAuthor || inGenre || inCharacters || inKeywords || inDesc
      );
    });

    const authors = Array.from(new Set(directMatches.map((b) => b.autor)));
    const genres = Array.from(new Set(directMatches.flatMap((b) => b.generos)));

    const directIds = new Set(directMatches.map((b) => b.id));
    const related = activeBooks
      .filter(
        (b) =>
          !directIds.has(b.id) &&
          b.generos.some((g) => genres.includes(g))
      )
      .slice(0, 6);

    return {
      matchedBooks: directMatches,
      matchedAuthors: authors,
      matchedGenres: genres.slice(0, 6),
      relatedBooks: related,
    };
  }, [activeBooks, query]);

  // Inspected profile details for modal
  const inspectedProfile = useMemo(() => {
    if (!inspectedUserId) return null;
    const fromKnown = allKnownProfiles.find((p) => p.uid === inspectedUserId);
    if (fromKnown) {
      return {
        ...fromKnown,
        profileCustomization: getEffectiveProfileCustomization(
          fromKnown,
          fromKnown.profileCustomization
        ),
      };
    }
    return null;
  }, [inspectedUserId, allKnownProfiles]);

  const inspectedUserPosts = useMemo(() => {
    if (!inspectedUserId) return [];
    return communityPosts
      .filter((p) => p.authorId === inspectedUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [communityPosts, inspectedUserId]);

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

  const handleFollowButtonClick = async (
    targetUid: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    if (onToggleFollow) {
      await onToggleFollow(targetUid);
    }
  };

  return (
    <div className="min-h-screen bg-[#040D1A] pt-28 lg:pt-24 pb-24">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        {/* Search Input Header */}
        <div className="max-w-3xl mx-auto mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            {platformSettings?.searchTitle || 'Pesquisa Literária'}
          </h1>

          <div className="relative">
            <Search className="w-5 h-5 text-[#60A5FA] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquise por livro, autor, gênero ou @usuário..."
              autoFocus
              className="w-full rounded-xl bg-[#071426] border border-blue-400/25 focus:border-[#3B82F6] pl-12 pr-12 py-4 text-base text-white placeholder:text-blue-200/45 shadow-2xl focus:outline-none transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-200/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Quick Search Chips (only shown when real suggestions exist) */}
          {quickSuggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-blue-200/70">Sugestões rápidas:</span>
              {quickSuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuery(item)}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                    query.toLowerCase() === item.toLowerCase()
                      ? 'bg-[#2563EB] text-white font-semibold'
                      : 'bg-blue-950/60 hover:bg-blue-900/60 text-blue-200 hover:text-white border border-blue-400/15'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Profiles (when query is empty) OR Matched Users Section (@username search) */}
        {(query.trim() === ''
          ? recommendedUsers.length > 0
          : matchedUsers.length > 0 || query.trim().startsWith('@')) && (
          <div className="mb-10">
            <h2 className="font-display text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#60A5FA]" />
              <span>
                {query.trim() === ''
                  ? 'Sugestões para seguir'
                  : `Usuários encontrados (${matchedUsers.length})`}
              </span>
            </h2>

            {query.trim() !== '' && matchedUsers.length === 0 ? (
              <div className="rounded-xl bg-[#071426] border border-blue-400/15 p-6 text-center text-sm text-blue-200/75">
                Nenhum usuário encontrado para &ldquo;{query}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(query.trim() === '' ? recommendedUsers : matchedUsers).map((prof) => {
                  const isOwn = prof.uid === currentUserId;
                  const isFollowing = myFollowingIds.has(prof.uid);
                  const followsMe = myFollowerIds.has(prof.uid);
                  const followersCount = communityFollows.filter(
                    (f) => f.followingId === prof.uid
                  ).length;

                  return (
                    <div
                      key={prof.uid}
                      onClick={() => openInspectedUser(prof.uid)}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[#071426] hover:bg-[#0B1E36] border border-blue-400/20 hover:border-blue-400/40 p-4 transition-all cursor-pointer shadow-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {prof.photoURL ? (
                          <img
                            src={prof.photoURL}
                            alt={`@${prof.username}`}
                            className="h-12 w-12 rounded-full object-cover ring-2 ring-[#60A5FA]/60 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#040D1A] border border-[#60A5FA]/50 text-[#60A5FA] font-display text-xl font-bold">
                            {(prof.username || 'L')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p
                              className="font-display text-lg font-bold text-white truncate"
                              style={
                                getEffectiveUsernameColor(prof)
                                  ? { color: getEffectiveUsernameColor(prof) }
                                  : undefined
                              }
                            >
                              @{prof.username}
                            </p>
                            {isUserPremium(prof) && (
                              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/25 shrink-0" />
                            )}
                          </div>
                          {prof.bio ? (
                            <p className="text-xs text-blue-200/75 truncate max-w-[200px]">
                              {prof.bio}
                            </p>
                          ) : (
                            <p className="text-[11px] text-blue-300/60">
                              {followersCount}{' '}
                              {followersCount === 1 ? 'seguidor' : 'seguidores'}
                            </p>
                          )}
                        </div>
                      </div>

                      {!isOwn && (
                        <button
                          type="button"
                          onClick={(e) => handleFollowButtonClick(prof.uid, e)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shrink-0 ${
                            isFollowing
                              ? 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 hover:text-white'
                              : 'bg-[#2563EB] hover:bg-[#3B82F6] text-white shadow-md'
                          }`}
                        >
                          {isFollowing ? (
                            <>
                              <UserMinus className="w-3.5 h-3.5 text-rose-300" />
                              <span>Deixar de seguir</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>
                                {followsMe ? 'Seguir de volta' : 'Seguir'}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Matched Authors & Genres Summary Pills */}
        {query.trim() !== '' && (matchedAuthors.length > 0 || matchedGenres.length > 0) && (
          <div className="mb-8 rounded-xl bg-[#071426]/90 border border-blue-400/20 p-4 flex flex-wrap items-center gap-6">
            {matchedAuthors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-blue-200/75 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#60A5FA]" /> Autores:
                </span>
                {matchedAuthors.map((author) => (
                  <button
                    key={author}
                    type="button"
                    onClick={() => setQuery(author)}
                    className="rounded bg-blue-900/40 hover:bg-blue-800/60 px-2.5 py-1 text-xs font-medium text-white cursor-pointer"
                  >
                    {author}
                  </button>
                ))}
              </div>
            )}

            {matchedGenres.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-blue-200/75 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-[#60A5FA]" /> Gêneros:
                </span>
                {matchedGenres.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setQuery(g)}
                    className="rounded bg-blue-500/15 border border-blue-400/30 px-2.5 py-1 text-xs font-medium text-[#60A5FA] cursor-pointer"
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Primary Book Search Results */}
        <div className="mb-12">
          <h2 className="font-display text-2xl font-bold text-white mb-5 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#60A5FA]" />
            <span>
              {query.trim()
                ? `Livros encontrados para "${query}" (${matchedBooks.length})`
                : 'Catálogo de Obras'}
            </span>
          </h2>

          {matchedBooks.length === 0 ? (
            <div className="rounded-xl bg-[#071426] border border-blue-400/15 p-10 text-center">
              <p className="font-display text-xl text-white">
                {query.trim()
                  ? `Nenhum livro encontrado diretamente para "${query}".`
                  : 'Nenhum livro disponível no momento.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 justify-items-center">
              {matchedBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onSelect={onSelectBook}
                />
              ))}
            </div>
          )}
        </div>

        {/* Related Results */}
        {query.trim() !== '' && relatedBooks.length > 0 && (
          <div className="pt-8 border-t border-blue-400/15">
            <h3 className="font-display text-2xl font-bold text-white mb-4">
              Resultados relacionados
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 justify-items-center">
              {relatedBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onSelect={onSelectBook}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: PERFIL DO USUÁRIO (Acessado pela busca da lupa) */}
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
                  <Crown className="w-4 h-4 text-amber-400 fill-amber-400/25 shrink-0" />
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
                          currentUserProfile?.uid &&
                          inspectedProfile.uid === currentUserProfile.uid
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
                      <button
                        type="button"
                        onClick={() => {
                          void onEnsureUserFollowsLoaded?.(inspectedProfile.uid);
                          setFollowersModalState({
                            isOpen: true,
                            initialTab: 'seguidores',
                            targetUserId: inspectedProfile.uid,
                            targetUsername: inspectedProfile.username,
                          });
                        }}
                        className="hover:text-[#60A5FA] transition-colors cursor-pointer"
                      >
                        <strong className="font-mono-num text-white">
                          {inspectedFollowersCount}
                        </strong>{' '}
                        {inspectedFollowersCount === 1
                          ? 'seguidor'
                          : 'seguidores'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void onEnsureUserFollowsLoaded?.(inspectedProfile.uid);
                          setFollowersModalState({
                            isOpen: true,
                            initialTab: 'seguindo',
                            targetUserId: inspectedProfile.uid,
                            targetUsername: inspectedProfile.username,
                          });
                        }}
                        className="hover:text-[#60A5FA] transition-colors cursor-pointer"
                      >
                        <strong className="font-mono-num text-white">
                          {inspectedFollowingCount}
                        </strong>{' '}
                        seguindo
                      </button>
                    </div>
                  </div>
                </div>

                {inspectedProfile.uid !== currentUserId && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleFollowButtonClick(inspectedProfile.uid)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
                        myFollowingIds.has(inspectedProfile.uid)
                          ? 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 hover:text-white'
                          : 'bg-[#2563EB] hover:bg-[#3B82F6] text-white shadow-lg'
                      }`}
                    >
                      {myFollowingIds.has(inspectedProfile.uid) ? (
                        <>
                          <UserMinus className="w-4 h-4 text-rose-300" />
                          <span>Deixar de seguir</span>
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
                        className="inline-flex items-center gap-2 rounded-xl bg-[#040D1A] hover:bg-blue-500/20 border border-blue-400/35 px-4 py-2.5 text-xs sm:text-sm font-bold text-[#60A5FA] hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Mensagem</span>
                      </button>
                    )}
                  </div>
                )}
                </div>
              </div>

              <ProfileFavoriteBooksShowcase
                favoriteBookIds={
                  inspectedProfile.profileFavoriteBooks ??
                  inspectedProfile.favoriteBooks
                }
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
                        likes={communityLikes}
                        replies={communityReplies}
                        follows={communityFollows}
                        publicProfilesMap={publicProfilesMap}
                        currentUserProfile={currentUserProfile}
                        isAuthenticated={isAuthenticated}
                        isAdmin={isAdmin}
                        onSelectBook={(b) => {
                          openInspectedUser(null);
                          onSelectBook(b);
                        }}
                        onToggleLike={onToggleLike || (async () => {})}
                        onCreateReply={onCreateReply || (async () => {})}
                        onDeletePost={onDeletePost || (async () => {})}
                        onDeleteReply={onDeleteReply || (async () => {})}
                        onToggleFollow={onToggleFollow || (async () => {})}
                        onInspectUser={(uid) => openInspectedUser(uid)}
                        onRequireAuth={onRequireAuth}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LISTA DE SEGUIDORES E SEGUINDO */}
      <FollowersFollowingModal
        isOpen={followersModalState.isOpen}
        initialTab={followersModalState.initialTab}
        targetUserId={followersModalState.targetUserId}
        targetUsername={followersModalState.targetUsername}
        follows={communityFollows}
        publicProfilesMap={publicProfilesMap}
        currentUserProfile={currentUserProfile}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        onClose={() =>
          setFollowersModalState((prev) => ({ ...prev, isOpen: false }))
        }
        onToggleFollow={onToggleFollow}
        onSelectUser={(uid) => {
          setFollowersModalState((prev) => ({ ...prev, isOpen: false }));
          if (uid !== currentUserId) {
            openInspectedUser(uid);
          }
        }}
        onEnsureUserFollowsLoaded={onEnsureUserFollowsLoaded}
        onEnsurePublicProfileLoaded={onEnsurePublicProfileLoaded}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
};
