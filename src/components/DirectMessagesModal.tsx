import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  MessageCircle,
  ArrowLeft,
  Send,
  X,
  Search,
  Trash2,
  UserPlus,
  Crown,
  Loader2,
} from 'lucide-react';
import {
  db,
  auth,
  stripUndefined,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  CommunityFollow,
  DirectConversation,
  DirectMessage,
  PublicProfile,
  UserProfile,
} from '../types';
import {
  getEffectiveUsernameColor,
  isUserPremium,
} from '../utils/premiumUtils';
import {
  isAdminConversation,
  isAdminIdentity,
  isAdminUid,
} from '../utils/adminStealthUtils';

export const DM_MAX_LENGTH = 1000;

/**
 * Deterministic conversation ID for any pair of users.
 * Prevents duplicate conversations between the same two users.
 */
export function getDeterministicConversationId(
  uidA: string,
  uidB: string
): string {
  return [uidA, uidB].sort().join('__');
}

function formatMessageTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatConversationListTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Ontem';
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatDateSeparatorLabel(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isSameDay) return 'Hoje';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getDateKey(iso?: string): string {
  if (!iso) return 'unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface DirectMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin?: boolean;
  conversations: DirectConversation[];
  publicProfilesMap: Record<string, PublicProfile>;
  follows: CommunityFollow[];
  initialRecipientId: string | null;
  onClearInitialRecipient?: () => void;
  onToggleFollow?: (targetUserId: string) => Promise<void>;
  onRequireAuth?: () => void;
}

export const DirectMessagesModal: React.FC<DirectMessagesModalProps> = ({
  isOpen,
  onClose,
  currentUserProfile,
  isAuthenticated,
  isAdmin = false,
  conversations,
  publicProfilesMap,
  follows,
  initialRecipientId,
  onClearInitialRecipient,
  onToggleFollow,
  onRequireAuth,
}) => {
  const currentUserId =
    auth.currentUser?.uid || currentUserProfile?.uid || '';

  const [selectedOtherUserId, setSelectedOtherUserId] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync initialRecipientId when opening from a user's public profile ("Mensagem")
  useEffect(() => {
    if (isOpen && initialRecipientId && initialRecipientId !== currentUserId) {
      if (
        !isAdmin &&
        (isAdminUid(initialRecipientId, publicProfilesMap) ||
          isAdminIdentity(publicProfilesMap[initialRecipientId]))
      ) {
        if (onClearInitialRecipient) {
          onClearInitialRecipient();
        }
        return;
      }
      setSelectedOtherUserId(initialRecipientId);
      setSendError(null);
      if (onClearInitialRecipient) {
        onClearInitialRecipient();
      }
    }
  }, [
    isOpen,
    initialRecipientId,
    currentUserId,
    onClearInitialRecipient,
    isAdmin,
    publicProfilesMap,
  ]);

  // Follow relationships for currentUserId
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

  // Helper to resolve another user's profile info (foto, nome, @username)
  const resolveParticipantProfile = (
    otherUid: string,
    conv?: DirectConversation
  ): {
    uid: string;
    displayName: string;
    username: string;
    photoURL: string;
    premium?: boolean;
    usernameColor?: string;
  } => {
    const pub = publicProfilesMap[otherUid];
    const cached = conv?.participantProfiles?.[otherUid];
    const rawUsername = (
      pub?.username ||
      cached?.username ||
      pub?.displayName ||
      cached?.displayName ||
      'leitor'
    )
      .replace(/^@+/, '')
      .toLowerCase();
    const displayName =
      pub?.displayName || cached?.displayName || `@${rawUsername}`;
    const photoURL = pub?.photoURL || cached?.photoURL || '';

    return {
      uid: otherUid,
      displayName,
      username: rawUsername,
      photoURL,
      premium: pub?.premium,
      usernameColor: pub?.usernameColor,
    };
  };

  // Sorted user conversations (most recent first)
  const sortedConversations = useMemo(() => {
    if (!currentUserId) return [];
    return [...conversations]
      .filter(
        (c) =>
          Array.isArray(c.participants) &&
          c.participants.includes(currentUserId) &&
          c.participants.length === 2 &&
          (isAdmin || !isAdminConversation(c, publicProfilesMap))
      )
      .sort((a, b) =>
        (b.lastMessageAt || b.updatedAt || '').localeCompare(
          a.lastMessageAt || a.updatedAt || ''
        )
      );
  }, [conversations, currentUserId, isAdmin, publicProfilesMap]);

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@+/, '');
    if (!q) return sortedConversations;
    return sortedConversations.filter((conv) => {
      const otherUid =
        conv.participants.find((id) => id !== currentUserId) || '';
      const resolved = resolveParticipantProfile(otherUid, conv);
      return (
        resolved.displayName.toLowerCase().includes(q) ||
        resolved.username.toLowerCase().includes(q) ||
        (conv.lastMessage || '').toLowerCase().includes(q)
      );
    });
  }, [sortedConversations, searchQuery, currentUserId, publicProfilesMap]);

  // People the user follows who don't have an active conversation yet (or match search)
  const followingContactsToStart = useMemo(() => {
    if (!currentUserId) return [];
    const existingOtherUids = new Set(
      sortedConversations.map(
        (c) => c.participants.find((id) => id !== currentUserId) || ''
      )
    );
    const q = searchQuery.trim().toLowerCase().replace(/^@+/, '');
    const list: Array<{
      uid: string;
      displayName: string;
      username: string;
      photoURL: string;
      premium?: boolean;
      usernameColor?: string;
    }> = [];

    myFollowingIds.forEach((uid) => {
      if (!uid || uid === currentUserId) return;
      if (
        !isAdmin &&
        (isAdminUid(uid, publicProfilesMap) ||
          isAdminIdentity(publicProfilesMap[uid]))
      ) {
        return;
      }
      if (!q && existingOtherUids.has(uid)) return;
      const resolved = resolveParticipantProfile(uid);
      if (!isAdmin && isAdminIdentity(resolved)) return;
      if (
        !q ||
        resolved.displayName.toLowerCase().includes(q) ||
        resolved.username.toLowerCase().includes(q)
      ) {
        list.push(resolved);
      }
    });

    return list;
  }, [
    currentUserId,
    myFollowingIds,
    sortedConversations,
    searchQuery,
    publicProfilesMap,
  ]);

  // Active conversation ID and object
  const activeConversationId = useMemo(() => {
    if (!currentUserId || !selectedOtherUserId) return null;
    return getDeterministicConversationId(currentUserId, selectedOtherUserId);
  }, [currentUserId, selectedOtherUserId]);

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return undefined;
    return sortedConversations.find((c) => c.id === activeConversationId);
  }, [sortedConversations, activeConversationId]);

  const activeRecipientProfile = useMemo(() => {
    if (!selectedOtherUserId) return null;
    return resolveParticipantProfile(selectedOtherUserId, activeConversation);
  }, [selectedOtherUserId, activeConversation, publicProfilesMap]);

  // Check if messaging is allowed between currentUserId and selectedOtherUserId
  // Allowed if: user follows recipient, OR recipient follows user, OR conversation already exists
  const canMessageSelectedUser = useMemo(() => {
    if (!currentUserId || !selectedOtherUserId) return false;
    return (
      myFollowingIds.has(selectedOtherUserId) ||
      myFollowerIds.has(selectedOtherUserId) ||
      Boolean(activeConversation)
    );
  }, [
    currentUserId,
    selectedOtherUserId,
    myFollowingIds,
    myFollowerIds,
    activeConversation,
  ]);

  // Real-time listener for messages in the active conversation
  useEffect(() => {
    const authedUid = auth.currentUser?.uid;
    if (
      !isOpen ||
      !isAuthenticated ||
      !authedUid ||
      !currentUserId ||
      currentUserId !== authedUid ||
      !activeConversationId
    ) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    setLoadingMessages(true);
    const messagesRef = collection(
      db,
      'conversations',
      activeConversationId,
      'messages'
    );

    const unsub = onSnapshot(
      messagesRef,
      (snap) => {
        const loaded: DirectMessage[] = [];
        const unreadIncomingDocs: DirectMessage[] = [];

        snap.forEach((d) => {
          const data = d.data() as DirectMessage;
          const msg: DirectMessage = {
            ...data,
            id: data.id || d.id,
          };
          loaded.push(msg);

          if (msg.recipientId === currentUserId && !msg.read) {
            unreadIncomingDocs.push(msg);
          }
        });

        loaded.sort((a, b) =>
          (a.createdAt || '').localeCompare(b.createdAt || '')
        );
        setMessages(loaded);
        setLoadingMessages(false);

        // Mark incoming unread messages as read
        if (unreadIncomingDocs.length > 0) {
          unreadIncomingDocs.forEach((m) => {
            updateDoc(
              doc(db, 'conversations', activeConversationId, 'messages', m.id),
              { read: true }
            ).catch(() => {});
          });
        }
      },
      (error) => {
        setLoadingMessages(false);
        handleFirestoreError(
          error,
          OperationType.LIST,
          `conversations/${activeConversationId}/messages`
        );
      }
    );

    return () => unsub();
  }, [
    isOpen,
    isAuthenticated,
    currentUserId,
    activeConversationId,
  ]);

  // Mark conversation-level unread state as read when opened
  useEffect(() => {
    if (
      !isOpen ||
      !currentUserId ||
      !activeConversation ||
      !activeConversationId
    ) {
      return;
    }

    const isUnreadForMe =
      (Array.isArray(activeConversation.unreadBy) &&
        activeConversation.unreadBy.includes(currentUserId)) ||
      Number(activeConversation.unreadCounts?.[currentUserId] || 0) > 0;

    if (!isUnreadForMe) return;

    const nextUnreadBy = (activeConversation.unreadBy || []).filter(
      (uid) => uid !== currentUserId
    );
    const nextUnreadCounts = {
      ...(activeConversation.unreadCounts || {}),
      [currentUserId]: 0,
    };

    setDoc(
      doc(db, 'conversations', activeConversationId),
      {
        unreadBy: nextUnreadBy,
        unreadCounts: nextUnreadCounts,
      },
      { merge: true }
    ).catch(() => {});
  }, [isOpen, currentUserId, activeConversation, activeConversationId]);

  // Visible messages (excluding messages the sender deleted from their own view)
  const visibleMessages = useMemo(() => {
    if (!currentUserId) return [];
    return messages.filter(
      (m) =>
        !Array.isArray(m.hiddenFor) || !m.hiddenFor.includes(currentUserId)
    );
  }, [messages, currentUserId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!isOpen || !selectedOtherUserId) return;
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(timer);
  }, [isOpen, selectedOtherUserId, visibleMessages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !isAuthenticated ||
      !currentUserProfile ||
      !currentUserId ||
      !selectedOtherUserId ||
      !activeConversationId ||
      !activeRecipientProfile
    ) {
      return;
    }

    if (!canMessageSelectedUser) {
      setSendError(
        `Siga @${activeRecipientProfile.username} para enviar uma mensagem direta.`
      );
      return;
    }

    const cleanText = messageText.trim();
    if (!cleanText || isSending) return;
    if (cleanText.length > DM_MAX_LENGTH) {
      setSendError(`A mensagem pode ter no máximo ${DM_MAX_LENGTH} caracteres.`);
      return;
    }

    setSendError(null);
    setIsSending(true);
    setMessageText('');

    const nowIso = new Date().toISOString();
    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const myUsername = (
      currentUserProfile.username ||
      currentUserProfile.displayName ||
      currentUserProfile.nome ||
      'leitor'
    )
      .replace(/^@+/, '')
      .toLowerCase();
    const myDisplayName =
      currentUserProfile.displayName ||
      currentUserProfile.nome ||
      `@${myUsername}`;
    const myPhotoURL =
      currentUserProfile.photoURL ?? currentUserProfile.foto ?? '';

    const sortedParticipants = [currentUserId, selectedOtherUserId].sort();
    const prevRecipientUnread = Number(
      activeConversation?.unreadCounts?.[selectedOtherUserId] || 0
    );

    const conversationPayload: DirectConversation = stripUndefined({
      id: activeConversationId,
      participants: sortedParticipants,
      lastMessage: cleanText,
      lastMessageAt: nowIso,
      lastSenderId: currentUserId,
      unreadBy: [selectedOtherUserId],
      unreadCounts: {
        [currentUserId]: 0,
        [selectedOtherUserId]: prevRecipientUnread + 1,
      },
      participantProfiles: {
        ...(activeConversation?.participantProfiles || {}),
        [currentUserId]: {
          displayName: myDisplayName,
          username: myUsername,
          photoURL: myPhotoURL,
        },
        [selectedOtherUserId]: {
          displayName: activeRecipientProfile.displayName,
          username: activeRecipientProfile.username,
          photoURL: activeRecipientProfile.photoURL,
        },
      },
      createdAt: activeConversation?.createdAt || nowIso,
      updatedAt: nowIso,
    });

    const newMessage: DirectMessage = {
      id: messageId,
      conversationId: activeConversationId,
      senderId: currentUserId,
      recipientId: selectedOtherUserId,
      text: cleanText,
      createdAt: nowIso,
      read: false,
    };

    try {
      // 1. Ensure conversation metadata document exists/updates first
      await setDoc(
        doc(db, 'conversations', activeConversationId),
        conversationPayload,
        { merge: true }
      );

      // 2. Write message document in subcollection
      await setDoc(
        doc(
          db,
          'conversations',
          activeConversationId,
          'messages',
          messageId
        ),
        newMessage
      );

      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (error) {
      setMessageText(cleanText);
      setSendError(
        'Não foi possível enviar a mensagem. Verifique se você segue este leitor.'
      );
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `conversations/${activeConversationId}`
      );
    } finally {
      setIsSending(false);
    }
  };

  // Allow sender to hide/delete their own message from their own view
  const handleHideOwnMessageFromMyView = async (msg: DirectMessage) => {
    if (
      !currentUserId ||
      !activeConversationId ||
      msg.senderId !== currentUserId
    ) {
      return;
    }
    const existingHidden = Array.isArray(msg.hiddenFor) ? msg.hiddenFor : [];
    if (existingHidden.includes(currentUserId)) return;
    const nextHidden = [...existingHidden, currentUserId];

    try {
      await updateDoc(
        doc(db, 'conversations', activeConversationId, 'messages', msg.id),
        {
          hiddenFor: nextHidden,
        }
      );
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-0 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-[100dvh] md:h-[85vh] md:max-w-5xl md:rounded-2xl bg-[#040D1A] border-0 md:border md:border-blue-400/30 shadow-[0_25px_70px_rgba(2,6,23,0.95)] flex overflow-hidden"
      >
        {!isAuthenticated || !currentUserProfile ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/15 border border-blue-400/30 text-[#60A5FA]">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Mensagens Diretas
            </h2>
            <p className="text-xs sm:text-sm text-blue-200/75 max-w-md">
              Entre na sua conta para conversar em privado com os leitores que você segue na Comunidade LIVROFLIX.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-blue-400/25 bg-[#071426] px-5 py-2.5 text-xs sm:text-sm font-semibold text-blue-100 hover:text-white cursor-pointer"
              >
                Fechar
              </button>
              {onRequireAuth && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequireAuth();
                  }}
                  className="rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg cursor-pointer"
                >
                  Entrar na conta
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ===============================================================
                LEFT PANEL: LISTA DE CONVERSAS ("Mensagens")
                On mobile: visible when no conversation is selected
                On desktop: always visible as the left column
               =============================================================== */}
            <div
              className={`${
                selectedOtherUserId ? 'hidden md:flex' : 'flex'
              } w-full md:w-80 lg:w-96 shrink-0 flex-col border-r border-blue-400/15 bg-[#071426]/90 h-full`}
            >
              {/* Left Panel Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-blue-400/15 bg-[#040D1A]/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="w-5 h-5 text-[#60A5FA]" />
                  <h2 className="font-display text-2xl font-bold text-white">
                    Mensagens
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar Mensagens"
                  className="rounded-full p-2 text-blue-200/70 hover:bg-blue-500/15 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-3.5 border-b border-blue-400/15 bg-[#040D1A]/30 shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-blue-300/60 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar conversa ou @username..."
                    className="w-full rounded-xl bg-[#040D1A] border border-blue-400/20 pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-blue-300/40 focus:border-[#60A5FA] focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 text-blue-300/60 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Conversations & Following List */}
              <div className="flex-1 overflow-y-auto divide-y divide-blue-400/10">
                {filteredConversations.length === 0 &&
                followingContactsToStart.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <MessageCircle className="w-8 h-8 text-[#60A5FA]/60 mx-auto" />
                    <p className="font-display text-lg font-bold text-white">
                      Nenhuma conversa ainda
                    </p>
                    <p className="text-xs text-blue-200/70 leading-relaxed">
                      Siga outros leitores na Comunidade ou visite o perfil público de um leitor e toque em <strong className="text-white">Mensagem</strong> para iniciar uma conversa privada.
                    </p>
                  </div>
                ) : (
                  <>
                    {filteredConversations.map((conv) => {
                      const otherUid =
                        conv.participants.find((id) => id !== currentUserId) ||
                        '';
                      const otherProfile = resolveParticipantProfile(
                        otherUid,
                        conv
                      );
                      const isSelected = selectedOtherUserId === otherUid;
                      const unreadCount = Number(
                        conv.unreadCounts?.[currentUserId] ||
                          (Array.isArray(conv.unreadBy) &&
                          conv.unreadBy.includes(currentUserId)
                            ? 1
                            : 0)
                      );
                      const isUnread = unreadCount > 0;
                      const isLastFromMe = conv.lastSenderId === currentUserId;

                      return (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => {
                            setSelectedOtherUserId(otherUid);
                            setSendError(null);
                          }}
                          className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#2563EB]/20 border-l-2 border-l-[#60A5FA]'
                              : isUnread
                              ? 'bg-blue-500/10 hover:bg-blue-500/15'
                              : 'hover:bg-[#040D1A]/60'
                          }`}
                        >
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            {otherProfile.photoURL ? (
                              <img
                                src={otherProfile.photoURL}
                                alt={otherProfile.displayName}
                                className="h-12 w-12 rounded-full object-cover ring-1 ring-[#60A5FA]/50"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#040D1A] border border-[#60A5FA]/50 text-[#60A5FA] font-display text-lg font-bold">
                                {(
                                  otherProfile.displayName ||
                                  otherProfile.username ||
                                  'L'
                                )[0].toUpperCase()}
                              </div>
                            )}
                            {isUnread && (
                              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#2563EB] ring-2 ring-[#071426]" />
                            )}
                          </div>

                          {/* Name, @username, Last Message & Time */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex items-center gap-1">
                                <span
                                  className={`text-sm truncate ${
                                    isUnread
                                      ? 'font-bold text-white'
                                      : 'font-semibold text-white/95'
                                  }`}
                                >
                                  {otherProfile.displayName}
                                </span>
                                {isUserPremium(otherProfile) && (
                                  <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/25 shrink-0" />
                                )}
                              </div>
                              <span
                                className={`text-[11px] font-mono-num shrink-0 ${
                                  isUnread
                                    ? 'text-[#60A5FA] font-bold'
                                    : 'text-blue-200/60'
                                }`}
                              >
                                {formatConversationListTime(conv.lastMessageAt)}
                              </span>
                            </div>

                            <p
                              className="text-[11px] text-[#60A5FA] truncate"
                              style={
                                getEffectiveUsernameColor(otherProfile)
                                  ? {
                                      color:
                                        getEffectiveUsernameColor(otherProfile),
                                    }
                                  : undefined
                              }
                            >
                              @{otherProfile.username}
                            </p>

                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p
                                className={`text-xs truncate ${
                                  isUnread
                                    ? 'font-semibold text-white'
                                    : 'text-blue-200/70'
                                }`}
                              >
                                {conv.lastMessage ? (
                                  <>
                                    {isLastFromMe ? 'Você: ' : ''}
                                    {conv.lastMessage}
                                  </>
                                ) : (
                                  'Inicie a conversa...'
                                )}
                              </p>

                              {isUnread && (
                                <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-mono-num font-bold text-white">
                                  {unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {/* Quick Start Conversation with Followed Users */}
                    {followingContactsToStart.length > 0 && (
                      <div className="p-3.5 bg-[#040D1A]/30">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-200/60 px-1 mb-2">
                          Iniciar conversa com quem você segue
                        </p>
                        <div className="space-y-1">
                          {followingContactsToStart.map((contact) => (
                            <button
                              key={contact.uid}
                              type="button"
                              onClick={() => {
                                setSelectedOtherUserId(contact.uid);
                                setSendError(null);
                              }}
                              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                                selectedOtherUserId === contact.uid
                                  ? 'bg-[#2563EB]/20 border border-blue-400/30'
                                  : 'hover:bg-[#040D1A]/80'
                              }`}
                            >
                              {contact.photoURL ? (
                                <img
                                  src={contact.photoURL}
                                  alt={contact.displayName}
                                  className="h-9 w-9 rounded-full object-cover ring-1 ring-[#60A5FA]/40 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#040D1A] border border-[#60A5FA]/40 text-[#60A5FA] font-display text-sm font-bold">
                                  {(
                                    contact.displayName ||
                                    contact.username ||
                                    'L'
                                  )[0].toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-white truncate">
                                  {contact.displayName}
                                </p>
                                <p className="text-[11px] text-[#60A5FA] truncate">
                                  @{contact.username}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ===============================================================
                RIGHT PANEL: TELA DA CONVERSA
                On mobile: occupies the entire screen when selected
                On desktop: occupies the right pane
               =============================================================== */}
            <div
              className={`${
                selectedOtherUserId ? 'flex' : 'hidden md:flex'
              } flex-1 flex-col bg-[#040D1A] h-full min-w-0`}
            >
              {!selectedOtherUserId || !activeRecipientProfile ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#071426] border border-blue-400/25 text-[#60A5FA]">
                    <MessageCircle className="w-8 h-8" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white">
                    Suas Mensagens
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-200/70 max-w-sm">
                    Selecione uma conversa ao lado ou escolha um leitor que você segue para enviar uma mensagem privada.
                  </p>
                </div>
              ) : (
                <>
                  {/* TOPO DA CONVERSA: Botão voltar, foto, nome, @username */}
                  <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-blue-400/15 bg-[#071426]/95 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOtherUserId(null);
                          setSendError(null);
                        }}
                        aria-label="Voltar para a lista de conversas"
                        title="Voltar"
                        className="inline-flex items-center justify-center rounded-xl bg-[#040D1A] hover:bg-blue-500/15 border border-blue-400/25 p-2 text-blue-100 hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        <ArrowLeft className="w-4 h-4 text-[#60A5FA]" />
                      </button>

                      {activeRecipientProfile.photoURL ? (
                        <img
                          src={activeRecipientProfile.photoURL}
                          alt={activeRecipientProfile.displayName}
                          className="h-10 w-10 rounded-full object-cover ring-1 ring-[#60A5FA]/60 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#040D1A] border border-[#60A5FA]/50 text-[#60A5FA] font-display text-base font-bold">
                          {(
                            activeRecipientProfile.displayName ||
                            activeRecipientProfile.username ||
                            'L'
                          )[0].toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-display text-base sm:text-lg font-bold text-white truncate">
                            {activeRecipientProfile.displayName}
                          </h3>
                          {isUserPremium(activeRecipientProfile) && (
                            <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/25 shrink-0" />
                          )}
                        </div>
                        <p
                          className="text-xs text-[#60A5FA] truncate"
                          style={
                            getEffectiveUsernameColor(activeRecipientProfile)
                              ? {
                                  color: getEffectiveUsernameColor(
                                    activeRecipientProfile
                                  ),
                                }
                              : undefined
                          }
                        >
                          @{activeRecipientProfile.username}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Fechar Mensagens"
                      className="rounded-full p-2 text-blue-200/70 hover:bg-blue-500/15 hover:text-white transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* ÁREA CENTRAL: Mensagens agrupadas com separação por data e horário */}
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center py-12 text-xs text-blue-200/70 gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#60A5FA]" />
                        <span>Carregando mensagens...</span>
                      </div>
                    ) : visibleMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-10 space-y-2">
                        <p className="font-display text-lg font-bold text-white">
                          Conversa privada com @{activeRecipientProfile.username}
                        </p>
                        <p className="text-xs text-blue-200/65 max-w-xs">
                          As mensagens enviadas aqui são privadas e visíveis somente para vocês dois.
                        </p>
                      </div>
                    ) : (
                      visibleMessages.map((msg, index) => {
                        const isMine = msg.senderId === currentUserId;
                        const prevMsg =
                          index > 0 ? visibleMessages[index - 1] : null;
                        const showDateDivider =
                          !prevMsg ||
                          getDateKey(prevMsg.createdAt) !==
                            getDateKey(msg.createdAt);

                        return (
                          <React.Fragment key={msg.id}>
                            {showDateDivider && (
                              <div className="flex items-center justify-center my-3">
                                <span className="rounded-full bg-[#071426] border border-blue-400/20 px-3 py-0.5 text-[11px] font-medium text-blue-200/75">
                                  {formatDateSeparatorLabel(msg.createdAt)}
                                </span>
                              </div>
                            )}

                            <div
                              className={`flex items-end gap-2 group ${
                                isMine ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              {isMine && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleHideOwnMessageFromMyView(msg)
                                  }
                                  title="Apagar mensagem para mim"
                                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-full p-1.5 text-blue-300/50 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <div
                                className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-md ${
                                  isMine
                                    ? 'bg-[#2563EB] text-white rounded-br-sm'
                                    : 'bg-[#071426] border border-blue-400/20 text-blue-50 rounded-bl-sm'
                                }`}
                              >
                                <p className="text-sm leading-relaxed whitespace-pre-line break-words">
                                  {msg.text}
                                </p>
                                <div
                                  className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] font-mono-num ${
                                    isMine
                                      ? 'text-blue-100/80'
                                      : 'text-blue-300/60'
                                  }`}
                                >
                                  <span>{formatMessageTime(msg.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* PARTE INFERIOR: "Escreva uma mensagem..." + "Enviar" */}
                  <div className="p-3.5 sm:px-6 sm:py-4 border-t border-blue-400/15 bg-[#071426]/95 shrink-0">
                    {sendError && (
                      <div className="mb-2.5 rounded-xl bg-rose-500/10 border border-rose-400/30 px-3 py-2 text-xs text-rose-200 flex items-center justify-between gap-2">
                        <span>{sendError}</span>
                        <button
                          type="button"
                          onClick={() => setSendError(null)}
                          className="text-rose-300 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {!canMessageSelectedUser ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl bg-[#040D1A] border border-blue-400/25 px-4 py-3">
                        <p className="text-xs text-blue-200/85 text-center sm:text-left">
                          Siga{' '}
                          <strong className="text-white">
                            @{activeRecipientProfile.username}
                          </strong>{' '}
                          para enviar mensagens diretas.
                        </p>
                        {onToggleFollow && (
                          <button
                            type="button"
                            onClick={() =>
                              onToggleFollow(activeRecipientProfile.uid)
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-4 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer shrink-0"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Seguir @{activeRecipientProfile.username}</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <form
                        onSubmit={handleSendMessage}
                        className="flex items-center gap-2.5"
                      >
                        <input
                          ref={inputRef}
                          type="text"
                          maxLength={DM_MAX_LENGTH}
                          value={messageText}
                          onChange={(e) =>
                            setMessageText(
                              e.target.value.slice(0, DM_MAX_LENGTH)
                            )
                          }
                          placeholder="Escreva uma mensagem..."
                          className="flex-1 rounded-xl bg-[#040D1A] border border-blue-400/25 px-4 py-3 text-sm text-white placeholder-blue-300/45 focus:border-[#60A5FA] focus:outline-none transition-colors"
                        />

                        <button
                          type="submit"
                          disabled={
                            isSending || messageText.trim().length === 0
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-45 disabled:cursor-not-allowed px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-lg transition-all cursor-pointer shrink-0"
                        >
                          {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          <span>Enviar</span>
                        </button>
                      </form>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
