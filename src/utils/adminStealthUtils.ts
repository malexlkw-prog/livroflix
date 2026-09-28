import {
  BookReview,
  CommunityFollow,
  CommunityLike,
  CommunityNotification,
  CommunityPost,
  CommunityReply,
  DirectConversation,
  PublicProfile,
  UserProfile,
} from '../types';

const KNOWN_ADMIN_UIDS_STORAGE_KEY = 'livroflix_known_admin_uids_v1';

export const ADMIN_EMAILS = new Set<string>(['malexlkw@gmail.com']);

export const ADMIN_RESERVED_USERNAMES = new Set<string>([
  'malexlkw',
  'admin',
  'administrador',
  'adm',
  'livroflix_admin',
  'root',
  'moderador',
  'suporte',
]);

export const STATIC_ADMIN_UIDS = new Set<string>([
  'user-malexlkw-gmail-com',
]);

function normalizeHandle(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.replace(/^@+/, '').trim().toLowerCase();
}

export function getKnownAdminUids(): Set<string> {
  const result = new Set<string>(STATIC_ADMIN_UIDS);
  try {
    const raw = localStorage.getItem(KNOWN_ADMIN_UIDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((uid) => {
          if (typeof uid === 'string' && uid.trim()) {
            result.add(uid.trim());
          }
        });
      }
    }
  } catch {
    // ignore storage errors
  }
  return result;
}

export function registerKnownAdminUid(uid?: string | null): void {
  if (!uid || typeof uid !== 'string' || !uid.trim()) return;
  const cleanUid = uid.trim();
  try {
    const current = getKnownAdminUids();
    if (!current.has(cleanUid)) {
      current.add(cleanUid);
      localStorage.setItem(
        KNOWN_ADMIN_UIDS_STORAGE_KEY,
        JSON.stringify(Array.from(current))
      );
    }
  } catch {
    // ignore storage errors
  }
}

export function isReservedAdminUsername(rawUsername?: string | null): boolean {
  const clean = normalizeHandle(rawUsername);
  if (!clean) return false;
  return ADMIN_RESERVED_USERNAMES.has(clean);
}

export interface AdminIdentityCandidate {
  uid?: string | null;
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  nome?: string | null;
  role?: string | null;
  isAdmin?: boolean | null;
}

/**
 * Checks whether any user/profile object or identifier belongs to an Administrator account.
 * If matched and a UID is present, records the UID as a known admin UID so all associated content is hidden from regular users.
 */
export function isAdminIdentity(
  candidate?: AdminIdentityCandidate | null,
  extraAdminUids?: ReadonlySet<string>
): boolean {
  if (!candidate) return false;

  const uid = candidate.uid?.trim() || '';
  const email = candidate.email?.trim().toLowerCase() || '';
  const username = normalizeHandle(candidate.username);
  const displayName = normalizeHandle(candidate.displayName);
  const nome = normalizeHandle(candidate.nome);

  const isMatched =
    candidate.role === 'admin' ||
    candidate.isAdmin === true ||
    (Boolean(email) && ADMIN_EMAILS.has(email)) ||
    (Boolean(uid) &&
      (STATIC_ADMIN_UIDS.has(uid) ||
        Boolean(extraAdminUids?.has(uid)) ||
        getKnownAdminUids().has(uid))) ||
    (Boolean(username) &&
      ( username === 'malexlkw' ||
        username === 'admin' ||
        username === 'administrador' ||
        username === 'adm' ||
        username === 'livroflix_admin' )) ||
    displayName === 'malexlkw' ||
    nome === 'malexlkw';

  if (isMatched && uid) {
    registerKnownAdminUid(uid);
  }

  return isMatched;
}

export function isAdminUid(
  uid?: string | null,
  publicProfilesMap?: Record<string, PublicProfile>,
  registeredUsers?: UserProfile[],
  extraAdminUids?: ReadonlySet<string>
): boolean {
  if (!uid) return false;
  const cleanUid = uid.trim();
  if (!cleanUid) return false;

  if (
    STATIC_ADMIN_UIDS.has(cleanUid) ||
    extraAdminUids?.has(cleanUid) ||
    getKnownAdminUids().has(cleanUid)
  ) {
    return true;
  }

  const pub = publicProfilesMap?.[cleanUid];
  if (pub && isAdminIdentity(pub, extraAdminUids)) {
    registerKnownAdminUid(cleanUid);
    return true;
  }

  if (registeredUsers && registeredUsers.length > 0) {
    const reg = registeredUsers.find((u) => u.uid === cleanUid);
    if (reg && isAdminIdentity(reg, extraAdminUids)) {
      registerKnownAdminUid(cleanUid);
      return true;
    }
  }

  return false;
}

export function isAdminPost(
  post: CommunityPost,
  publicProfilesMap?: Record<string, PublicProfile>,
  registeredUsers?: UserProfile[],
  extraAdminUids?: ReadonlySet<string>
): boolean {
  if (!post) return false;
  if (
    isAdminUid(post.authorId, publicProfilesMap, registeredUsers, extraAdminUids)
  ) {
    return true;
  }
  if (
    isAdminIdentity(
      {
        uid: post.authorId,
        username: post.authorUsername,
        displayName: post.authorName,
      },
      extraAdminUids
    )
  ) {
    return true;
  }
  return false;
}

export function isAdminReply(
  reply: CommunityReply,
  publicProfilesMap?: Record<string, PublicProfile>,
  registeredUsers?: UserProfile[],
  extraAdminUids?: ReadonlySet<string>
): boolean {
  if (!reply) return false;
  if (
    isAdminUid(
      reply.authorId,
      publicProfilesMap,
      registeredUsers,
      extraAdminUids
    ) ||
    isAdminUid(
      reply.postAuthorId,
      publicProfilesMap,
      registeredUsers,
      extraAdminUids
    )
  ) {
    return true;
  }
  if (
    isAdminIdentity(
      {
        uid: reply.authorId,
        username: reply.authorUsername,
        displayName: reply.authorName,
      },
      extraAdminUids
    )
  ) {
    return true;
  }
  return false;
}

export function isAdminLike(
  like: CommunityLike,
  publicProfilesMap?: Record<string, PublicProfile>,
  registeredUsers?: UserProfile[],
  extraAdminUids?: ReadonlySet<string>
): boolean {
  if (!like) return false;
  return (
    isAdminUid(like.userId, publicProfilesMap, registeredUsers, extraAdminUids) ||
    isAdminUid(
      like.postAuthorId,
      publicProfilesMap,
      registeredUsers,
      extraAdminUids
    )
  );
}

export function isAdminFollow(
  follow: CommunityFollow,
  publicProfilesMap?: Record<string, PublicProfile>,
  registeredUsers?: UserProfile[],
  extraAdminUids?: ReadonlySet<string>
): boolean {
  if (!follow) return false;
  return (
    isAdminUid(
      follow.followerId,
      publicProfilesMap,
      registeredUsers,
      extraAdminUids
    ) ||
    isAdminUid(
      follow.followingId,
      publicProfilesMap,
      registeredUsers,
      extraAdminUids
    )
  );
}

export function isAdminReview(
  review: BookReview,
  publicProfilesMap?: Record<string, PublicProfile>,
  registeredUsers?: UserProfile[],
  extraAdminUids?: ReadonlySet<string>
): boolean {
  if (!review) return false;
  if (
    isAdminUid(review.userId, publicProfilesMap, registeredUsers, extraAdminUids)
  ) {
    return true;
  }
  if (
    isAdminIdentity(
      {
        uid: review.userId,
        username: review.authorUsername,
        displayName: review.authorName,
      },
      extraAdminUids
    )
  ) {
    return true;
  }
  return false;
}

export function isAdminNotification(
  notif: CommunityNotification,
  publicProfilesMap?: Record<string, PublicProfile>,
  registeredUsers?: UserProfile[],
  extraAdminUids?: ReadonlySet<string>
): boolean {
  if (!notif) return false;
  if (
    isAdminUid(
      notif.actorId,
      publicProfilesMap,
      registeredUsers,
      extraAdminUids
    ) ||
    isAdminUid(
      notif.recipientId,
      publicProfilesMap,
      registeredUsers,
      extraAdminUids
    )
  ) {
    return true;
  }
  if (
    isAdminIdentity(
      {
        uid: notif.actorId,
        username: notif.actorUsername,
        displayName: notif.actorName,
      },
      extraAdminUids
    )
  ) {
    return true;
  }
  return false;
}

export function isAdminConversation(
  conv: DirectConversation,
  publicProfilesMap?: Record<string, PublicProfile>,
  registeredUsers?: UserProfile[],
  extraAdminUids?: ReadonlySet<string>
): boolean {
  if (!conv) return false;
  if (Array.isArray(conv.participants)) {
    for (const uid of conv.participants) {
      if (isAdminUid(uid, publicProfilesMap, registeredUsers, extraAdminUids)) {
        return true;
      }
      const meta = conv.participantProfiles?.[uid];
      if (
        meta &&
        isAdminIdentity(
          {
            uid,
            username: meta.username,
            displayName: meta.displayName,
          },
          extraAdminUids
        )
      ) {
        return true;
      }
    }
  }
  return false;
}
