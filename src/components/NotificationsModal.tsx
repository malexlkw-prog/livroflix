import React, { useState, useMemo } from 'react';
import {
  Bell,
  Heart,
  MessageCircle,
  AtSign,
  UserPlus,
  UserCheck,
  CheckCheck,
  X,
  Crown,
} from 'lucide-react';
import {
  CommunityFollow,
  CommunityNotification,
  PublicProfile,
  UserProfile,
} from '../types';
import {
  getEffectiveUsernameColor,
  isUserPremium,
} from '../utils/premiumUtils';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: CommunityNotification[];
  follows?: CommunityFollow[];
  publicProfilesMap: Record<string, PublicProfile>;
  currentUserProfile: UserProfile | null;
  isAuthenticated: boolean;
  onMarkAllRead: () => Promise<void>;
  onMarkOneRead?: (notificationId: string) => Promise<void>;
  onSelectNotification: (notification: CommunityNotification) => void;
  onToggleFollow?: (targetUserId: string) => Promise<void>;
  onRequireAuth: () => void;
}

type NotificationFilterTab = 'all' | 'like' | 'reply' | 'follow';

function formatRelativeNotificationTime(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(1, Math.floor(diffMs / 1000));
  if (diffSec < 60) return 'agora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays} dias`;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  follows = [],
  publicProfilesMap,
  currentUserProfile,
  isAuthenticated,
  onMarkAllRead,
  onMarkOneRead,
  onSelectNotification,
  onToggleFollow,
  onRequireAuth,
}) => {
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>('all');

  const currentUserId = currentUserProfile?.uid || '';

  const myFollowingIds = useMemo(() => {
    const set = new Set<string>();
    if (!currentUserId) return set;
    follows.forEach((f) => {
      if (f.followerId === currentUserId) set.add(f.followingId);
    });
    return set;
  }, [follows, currentUserId]);

  const myFollowerIds = useMemo(() => {
    const set = new Set<string>();
    if (!currentUserId) return set;
    follows.forEach((f) => {
      if (f.followingId === currentUserId) set.add(f.followerId);
    });
    return set;
  }, [follows, currentUserId]);

  const myNotifications = useMemo(() => {
    if (!currentUserId) return [];
    return notifications
      .filter((n) => n.recipientId === currentUserId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [notifications, currentUserId]);

  const unreadCount = useMemo(
    () => myNotifications.filter((n) => !n.read).length,
    [myNotifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return myNotifications;
    if (activeTab === 'like') {
      return myNotifications.filter((n) => n.type === 'like');
    }
    if (activeTab === 'reply') {
      return myNotifications.filter(
        (n) => n.type === 'reply' || n.type === 'mention'
      );
    }
    if (activeTab === 'follow') {
      return myNotifications.filter((n) => n.type === 'follow');
    }
    return myNotifications;
  }, [myNotifications, activeTab]);

  if (!isOpen) return null;

  const renderTypeBadge = (type: CommunityNotification['type']) => {
    switch (type) {
      case 'like':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-md">
            <Heart className="w-3 h-3 fill-current" />
          </span>
        );
      case 'reply':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-md">
            <MessageCircle className="w-3 h-3 fill-current" />
          </span>
        );
      case 'mention':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white shadow-md">
            <AtSign className="w-3 h-3" />
          </span>
        );
      case 'follow':
      default:
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
            <UserPlus className="w-3 h-3" />
          </span>
        );
    }
  };

  const renderActionDescription = (type: CommunityNotification['type']) => {
    switch (type) {
      case 'like':
        return 'curtiu sua publicação';
      case 'reply':
        return 'respondeu à sua publicação';
      case 'mention':
        return 'mencionou você';
      case 'follow':
      default:
        return 'começou a seguir você';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#071426] border border-blue-400/30 shadow-[0_25px_70px_rgba(2,6,23,0.95)] overflow-hidden h-[85dvh] sm:h-auto sm:max-h-[82vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-400/15 bg-[#040D1A]/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-400/30 text-[#60A5FA]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                  Notificações
                </h2>
                {unreadCount > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2563EB] px-1.5 text-[11px] font-mono-num font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-blue-200/65">
                Curtidas, respostas, menções e seguidores
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  void onMarkAllRead();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/30 px-3 py-1.5 text-xs font-semibold text-[#60A5FA] hover:text-white transition-colors cursor-pointer"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Marcar lidas</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-blue-200/70 hover:bg-blue-500/15 hover:text-white transition-colors cursor-pointer"
              aria-label="Fechar notificações"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        {isAuthenticated && currentUserProfile && (
          <div className="flex items-center gap-1.5 px-5 py-3 border-b border-blue-400/15 bg-[#040D1A]/40 overflow-x-auto no-scrollbar shrink-0">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'like', label: 'Curtidas' },
                { id: 'reply', label: 'Respostas' },
                { id: 'follow', label: 'Seguidores' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#2563EB] text-white shadow-md'
                    : 'bg-[#071426] hover:bg-blue-500/15 border border-blue-400/20 text-blue-200/80 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-blue-400/10">
          {!isAuthenticated || !currentUserProfile ? (
            <div className="p-10 text-center space-y-4">
              <Bell className="w-10 h-10 text-[#60A5FA] mx-auto opacity-80" />
              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  Receba alertas das suas interações
                </h3>
                <p className="text-xs sm:text-sm text-blue-200/75 mt-1 max-w-xs mx-auto">
                  Entre na sua conta para acompanhar curtidas, respostas, menções e novos seguidores.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequireAuth();
                }}
                className="rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
              >
                Entrar na conta
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-10 text-center space-y-2.5">
              <Bell className="w-10 h-10 text-[#60A5FA]/70 mx-auto" />
              <h3 className="font-display text-lg font-bold text-white">
                Nenhuma notificação por aqui
              </h3>
              <p className="text-xs text-blue-200/70 max-w-xs mx-auto">
                {activeTab === 'all'
                  ? 'Quando alguém curtir, responder suas publicações ou seguir você, aparecerá aqui.'
                  : 'Nenhuma notificação encontrada nesta categoria.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const actorProfile = publicProfilesMap[notif.actorId];
              const actorUsername = (
                actorProfile?.username ||
                notif.actorUsername ||
                'leitor'
              )
                .replace(/^@+/, '')
                .toLowerCase();
              const actorPhoto =
                actorProfile?.photoURL ||
                notif.actorPhotoURL ||
                notif.actorPhoto ||
                '';
              const actorUsernameColor = getEffectiveUsernameColor(actorProfile);
              const actorIsPremium = isUserPremium(actorProfile);
              const previewSnippet =
                notif.postSnippet || notif.snippet || '';

              return (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => {
                    if (!notif.read && onMarkOneRead) {
                      void onMarkOneRead(notif.id);
                    }
                    onSelectNotification(notif);
                  }}
                  className={`w-full flex items-start gap-3.5 px-5 py-4 text-left transition-colors cursor-pointer ${
                    !notif.read
                      ? 'bg-[#0B1E36]/85 hover:bg-[#0E2542]'
                      : 'hover:bg-[#0B1E36]/40'
                  }`}
                >
                  {/* Avatar + Type Badge */}
                  <div className="relative shrink-0">
                    {actorPhoto ? (
                      <img
                        src={actorPhoto}
                        alt={`@${actorUsername}`}
                        className="h-11 w-11 rounded-full object-cover ring-1 ring-[#60A5FA]/50"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#040D1A] border border-[#60A5FA]/40 text-[#60A5FA] font-display text-base font-bold">
                        {(actorUsername || 'L')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1">
                      {renderTypeBadge(notif.type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs sm:text-sm text-blue-100 leading-snug">
                        <span
                          className="font-bold text-white inline-flex items-center gap-1 mr-1"
                          style={
                            actorUsernameColor
                              ? { color: actorUsernameColor }
                              : undefined
                          }
                        >
                          @{actorUsername}
                          {actorIsPremium && (
                            <Crown className="w-3 h-3 text-amber-400 fill-amber-400/25 inline shrink-0" />
                          )}
                        </span>
                        <span className="text-blue-100/90">
                          {renderActionDescription(notif.type)}
                        </span>
                      </p>

                      <div className="flex items-center gap-2 shrink-0">
                        {notif.type === 'follow' &&
                          onToggleFollow &&
                          notif.actorId &&
                          notif.actorId !== currentUserId && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!notif.read && onMarkOneRead) {
                                  void onMarkOneRead(notif.id);
                                }
                                void onToggleFollow(notif.actorId);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!notif.read && onMarkOneRead) {
                                    void onMarkOneRead(notif.id);
                                  }
                                  void onToggleFollow(notif.actorId);
                                }
                              }}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                                myFollowingIds.has(notif.actorId)
                                  ? 'bg-blue-950/80 border border-blue-400/30 text-blue-200 hover:border-rose-400/40 hover:text-rose-200'
                                  : 'bg-[#2563EB] hover:bg-[#3B82F6] text-white shadow-sm'
                              }`}
                            >
                              {myFollowingIds.has(notif.actorId) ? (
                                <>
                                  <UserCheck className="w-3 h-3" />
                                  <span>Seguindo</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-3 h-3" />
                                  <span>
                                    {myFollowerIds.has(notif.actorId) ||
                                    notif.type === 'follow'
                                      ? 'Seguir de volta'
                                      : 'Seguir'}
                                  </span>
                                </>
                              )}
                            </span>
                          )}
                        <span className="text-[11px] font-mono-num text-blue-300/65">
                          {formatRelativeNotificationTime(notif.createdAt)}
                        </span>
                        {!notif.read && (
                          <span
                            className="h-2.5 w-2.5 rounded-full bg-[#60A5FA] shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                            title="Não lida"
                          />
                        )}
                      </div>
                    </div>

                    {previewSnippet && (
                      <p className="mt-1.5 text-xs text-blue-200/75 line-clamp-2 rounded-lg bg-[#040D1A]/70 border border-blue-400/15 px-2.5 py-1.5">
                        “{previewSnippet}”
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
