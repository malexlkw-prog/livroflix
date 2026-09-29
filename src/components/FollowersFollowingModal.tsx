import React, { useEffect, useMemo, useState } from 'react';
import {
  Crown,
  Loader2,
  Search,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { CommunityFollow, PublicProfile, UserProfile } from '../types';
import {
  getEffectiveUsernameColor,
  isUserPremium,
} from '../utils/premiumUtils';
import { isAdminIdentity, isAdminUid } from '../utils/adminStealthUtils';

export interface FollowersFollowingModalProps {
  isOpen: boolean;
  initialTab: 'seguidores' | 'seguindo' | 'followers' | 'following';
  targetUserId: string;
  targetUsername?: string;
  follows?: CommunityFollow[];
  communityFollows?: CommunityFollow[];
  publicProfilesMap: Record<string, PublicProfile>;
  currentUserProfile?: UserProfile | null;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onToggleFollow?: (targetUserId: string) => Promise<void> | void;
  onSelectUser?: (uid: string) => void;
  onEnsureUserFollowsLoaded?: (uid: string) => Promise<void> | void;
  onEnsurePublicProfileLoaded?: (uid: string) => void;
  onRequireAuth?: () => void;
}

function normalizeTab(
  tab: 'seguidores' | 'seguindo' | 'followers' | 'following'
): 'seguidores' | 'seguindo' {
  if (tab === 'following' || tab === 'seguindo') return 'seguindo';
  return 'seguidores';
}

export const FollowersFollowingModal: React.FC<
  FollowersFollowingModalProps
> = ({
  isOpen,
  initialTab,
  targetUserId,
  targetUsername,
  follows,
  communityFollows,
  publicProfilesMap,
  currentUserProfile = null,
  isAuthenticated: isAuthenticatedProp,
  isAdmin = false,
  onClose,
  onToggleFollow,
  onSelectUser,
  onEnsureUserFollowsLoaded,
  onEnsurePublicProfileLoaded,
  onRequireAuth,
}) => {
  const effectiveFollows = follows ?? communityFollows ?? [];
  const isAuthenticated =
    isAuthenticatedProp ?? Boolean(currentUserProfile?.uid);
  const [activeTab, setActiveTab] = useState<'seguidores' | 'seguindo'>(
    normalizeTab(initialTab)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingFollowUid, setPendingFollowUid] = useState<string | null>(null);
  const [hoveredFollowUid, setHoveredFollowUid] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(normalizeTab(initialTab));
      setSearchQuery('');
    }
  }, [isOpen, initialTab, targetUserId]);

  useEffect(() => {
    if (!isOpen || !targetUserId) return;
    void onEnsureUserFollowsLoaded?.(targetUserId);
  }, [isOpen, targetUserId, onEnsureUserFollowsLoaded]);

  const currentUserId = currentUserProfile?.uid || '';

  // Deduplicate follows by followerId + followingId
  const uniqueFollows = useMemo(() => {
    const map = new Map<string, CommunityFollow>();
    for (const f of effectiveFollows) {
      if (!f?.followerId || !f?.followingId) continue;
      if (f.followerId === f.followingId) continue;
      if (
        !isAdmin &&
        (isAdminUid(f.followerId, publicProfilesMap) ||
          isAdminUid(f.followingId, publicProfilesMap))
      ) {
        continue;
      }
      const key = `${f.followerId}_${f.followingId}`;
      map.set(key, f);
    }
    return Array.from(map.values());
  }, [effectiveFollows, isAdmin, publicProfilesMap]);

  const myFollowingIds = useMemo(() => {
    const set = new Set<string>();
    if (!currentUserId) return set;
    for (const f of uniqueFollows) {
      if (f.followerId === currentUserId) {
        set.add(f.followingId);
      }
    }
    return set;
  }, [uniqueFollows, currentUserId]);

  const myFollowerIds = useMemo(() => {
    const set = new Set<string>();
    if (!currentUserId) return set;
    for (const f of uniqueFollows) {
      if (f.followingId === currentUserId) {
        set.add(f.followerId);
      }
    }
    return set;
  }, [uniqueFollows, currentUserId]);

  const followerUids = useMemo(() => {
    if (!targetUserId) return [] as string[];
    const seen = new Set<string>();
    const list: string[] = [];
    const sorted = uniqueFollows
      .filter((f) => f.followingId === targetUserId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    for (const f of sorted) {
      if (f.followerId && !seen.has(f.followerId)) {
        seen.add(f.followerId);
        list.push(f.followerId);
      }
    }
    return list;
  }, [uniqueFollows, targetUserId]);

  const followingUids = useMemo(() => {
    if (!targetUserId) return [] as string[];
    const seen = new Set<string>();
    const list: string[] = [];
    const sorted = uniqueFollows
      .filter((f) => f.followerId === targetUserId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    for (const f of sorted) {
      if (f.followingId && !seen.has(f.followingId)) {
        seen.add(f.followingId);
        list.push(f.followingId);
      }
    }
    return list;
  }, [uniqueFollows, targetUserId]);

  // Ensure public profiles are loaded for all followers/following UIDs
  useEffect(() => {
    if (!isOpen || !onEnsurePublicProfileLoaded) return;
    const allUids = Array.from(new Set([...followerUids, ...followingUids]));
    allUids.forEach((uid) => {
      if (uid && !publicProfilesMap[uid]) {
        onEnsurePublicProfileLoaded(uid);
      }
    });
  }, [
    isOpen,
    followerUids,
    followingUids,
    publicProfilesMap,
    onEnsurePublicProfileLoaded,
  ]);

  const resolveProfileForUid = (uid: string): PublicProfile => {
    const fromMap = publicProfilesMap[uid];
    if (fromMap) {
      return {
        ...fromMap,
        uid,
        username: (fromMap.username || 'leitor').replace(/^@+/, ''),
      };
    }
    if (currentUserProfile && currentUserProfile.uid === uid) {
      const uname = (
        currentUserProfile.username ||
        currentUserProfile.displayName ||
        currentUserProfile.nome ||
        'leitor'
      )
        .replace(/^@+/, '')
        .toLowerCase();
      return {
        uid,
        displayName:
          currentUserProfile.displayName || currentUserProfile.nome || uname,
        username: uname,
        bio: currentUserProfile.bio || '',
        photoURL: currentUserProfile.photoURL ?? currentUserProfile.foto ?? '',
        premium: currentUserProfile.premium,
        usernameColor: currentUserProfile.usernameColor,
        profileCustomization: currentUserProfile.profileCustomization,
        updatedAt: currentUserProfile.updatedAt || '',
      };
    }
    return {
      uid,
      displayName: 'Leitor LIVROFLIX',
      username: `leitor_${uid.slice(-4).toLowerCase()}`,
      bio: '',
      photoURL: '',
      updatedAt: '',
    };
  };

  const activeProfilesList = useMemo(() => {
    const targetUids =
      activeTab === 'seguidores' ? followerUids : followingUids;
    const profiles = targetUids
      .map((uid) => resolveProfileForUid(uid))
      .filter(
        (prof) =>
          isAdmin ||
          (!isAdminIdentity(prof) && !isAdminUid(prof.uid, publicProfilesMap))
      );

    const q = searchQuery.trim().replace(/^@+/, '').toLowerCase();
    if (!q) return profiles;

    return profiles.filter((prof) => {
      const uname = (prof.username || '').toLowerCase();
      const dname = (prof.displayName || '').toLowerCase();
      return uname.includes(q) || dname.includes(q);
    });
  }, [
    activeTab,
    followerUids,
    followingUids,
    publicProfilesMap,
    currentUserProfile,
    isAdmin,
    searchQuery,
  ]);

  const handleToggleFollowClick = async (
    uid: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (!isAuthenticated || !currentUserId) {
      onClose();
      onRequireAuth?.();
      return;
    }
    if (!onToggleFollow || pendingFollowUid === uid) return;
    setPendingFollowUid(uid);
    try {
      await onToggleFollow(uid);
    } finally {
      setPendingFollowUid(null);
    }
  };

  if (!isOpen) return null;

  const cleanTargetUsername = (
    targetUsername ||
    publicProfilesMap[targetUserId]?.username ||
    (currentUserProfile?.uid === targetUserId
      ? currentUserProfile.username
      : '') ||
    'leitor'
  ).replace(/^@+/, '');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#071426] border border-blue-400/30 shadow-[0_25px_70px_rgba(2,6,23,0.95)] overflow-hidden max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-400/15 bg-[#040D1A]/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <Users className="w-5 h-5 text-[#60A5FA] shrink-0" />
            <div className="min-w-0">
              <h3 className="font-display text-lg sm:text-xl font-bold text-white truncate">
                @{cleanTargetUsername}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-blue-200/70 hover:bg-blue-500/15 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs: Seguidores | Seguindo */}
        <div className="grid grid-cols-2 border-b border-blue-400/15 bg-[#040D1A]/50">
          <button
            type="button"
            onClick={() => setActiveTab('seguidores')}
            className={`py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'seguidores'
                ? 'border-[#60A5FA] text-white bg-blue-500/10'
                : 'border-transparent text-blue-200/65 hover:text-white'
            }`}
          >
            <span>Seguidores</span>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-mono-num text-[#60A5FA]">
              {followerUids.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('seguindo')}
            className={`py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'seguindo'
                ? 'border-[#60A5FA] text-white bg-blue-500/10'
                : 'border-transparent text-blue-200/65 hover:text-white'
            }`}
          >
            <span>Seguindo</span>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-mono-num text-[#60A5FA]">
              {followingUids.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3.5 border-b border-blue-400/15 bg-[#040D1A]/30">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-blue-300/60 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'seguidores'
                  ? 'Pesquisar em seguidores...'
                  : 'Pesquisar em seguindo...'
              }
              className="w-full rounded-xl bg-[#040D1A] border border-blue-400/20 pl-9 pr-9 py-2 text-xs sm:text-sm text-white placeholder-blue-300/40 focus:border-[#60A5FA] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-blue-300/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Users List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {activeProfilesList.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Users className="w-8 h-8 text-blue-400/40 mx-auto" />
              <p className="text-sm font-semibold text-white">
                {searchQuery.trim()
                  ? `Nenhum usuário encontrado para "${searchQuery}".`
                  : activeTab === 'seguidores'
                  ? 'Nenhum seguidor ainda.'
                  : 'Não está seguindo ninguém ainda.'}
              </p>
            </div>
          ) : (
            activeProfilesList.map((prof) => {
              const isMe = prof.uid === currentUserId;
              const isFollowing = myFollowingIds.has(prof.uid);
              const followsMe = myFollowerIds.has(prof.uid);
              const isPending = pendingFollowUid === prof.uid;
              const isHovered = hoveredFollowUid === prof.uid;
              const unameColor = getEffectiveUsernameColor(prof);

              return (
                <div
                  key={prof.uid}
                  onClick={() => {
                    if (onSelectUser) {
                      onSelectUser(prof.uid);
                    }
                  }}
                  className={`flex items-center justify-between gap-3 rounded-xl bg-[#040D1A]/90 hover:bg-[#0B1E36]/90 border border-blue-400/20 p-3 transition-all ${
                    onSelectUser ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {prof.photoURL ? (
                      <img
                        src={prof.photoURL}
                        alt={`@${prof.username}`}
                        className="h-11 w-11 rounded-full object-cover ring-2 ring-[#60A5FA]/50 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#071426] border border-[#60A5FA]/50 text-[#60A5FA] font-display text-lg font-bold">
                        {(prof.username || 'L')[0].toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="font-display text-base font-bold text-white truncate"
                          style={
                            unameColor ? { color: unameColor } : undefined
                          }
                        >
                          @{prof.username}
                        </span>
                        {isUserPremium(prof) && (
                          <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/25 shrink-0" />
                        )}
                        {followsMe && !isMe && (
                          <span className="rounded bg-blue-500/15 border border-blue-400/25 px-1.5 py-0.5 text-[10px] font-semibold text-blue-200">
                            Segue você
                          </span>
                        )}
                      </div>
                      {prof.bio ? (
                        <p className="text-xs text-blue-200/70 truncate max-w-[210px]">
                          {prof.bio}
                        </p>
                      ) : (
                        <p className="text-xs text-blue-300/55 truncate">
                          {prof.displayName}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isMe && onToggleFollow && (
                    <button
                      type="button"
                      disabled={isPending}
                      onMouseEnter={() => setHoveredFollowUid(prof.uid)}
                      onMouseLeave={() => setHoveredFollowUid(null)}
                      onClick={(e) => handleToggleFollowClick(prof.uid, e)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shrink-0 disabled:opacity-60 ${
                        isFollowing
                          ? 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 hover:text-white'
                          : 'bg-[#2563EB] hover:bg-[#3B82F6] text-white shadow-md'
                      }`}
                    >
                      {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isFollowing ? (
                        <>
                          {isHovered || activeTab === 'seguindo' ? (
                            <UserMinus className="w-3.5 h-3.5 text-rose-300" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-rose-300" />
                          )}
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
            })
          )}
        </div>
      </div>
    </div>
  );
};
