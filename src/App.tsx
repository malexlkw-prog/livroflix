import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import {
  Sparkles,
  Crown,
  Check,
  X,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import {
  db,
  auth,
  signInWithGoogle,
  signOutUser,
  onAuthStateChanged,
  handleFirestoreError,
  deleteBookPdfFromStorage,
  stripUndefined,
  getSavedSessionProfile,
  saveSessionProfile,
  OperationType,
  User,
} from './firebase';
import {
  ActiveView,
  Book,
  BookReview,
  CommunityFollow,
  CommunityLike,
  CommunityNotification,
  CommunityPost,
  CommunityReply,
  CommunityReport,
  CustomCategory,
  DirectConversation,
  HomeRow,
  PlatformSettings,
  ProfileCustomization,
  PublicProfile,
  ReaderPreferences,
  ReadingFormat,
  ReadingStatus,
  UserBookItem,
  UserProfile,
} from './types';
import {
  BadgeId,
  EvaluatedAchievement,
  evaluateLiteraryAchievementsAndBadges,
  isNightHour,
  isValidBadgeId,
} from './data/badges';
import {
  BadgeUnlockModal,
  CommonAchievementUnlockedBanner,
} from './components/BadgeUnlockModal';
import {
  LEGACY_AUTO_BOOK_IDS,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_HOME_ROWS,
} from './data/catalog';
import { Header, BOOK_CATEGORIES_LIST } from './components/Header';
import { LivroflixLogo } from './components/LivroflixLogo';
import { HeroBanner } from './components/HeroBanner';
import { BookCard } from './components/BookCard';
import { resolveBookCreatedAtIso } from './components/BookCover';
import { BookRow } from './components/BookRow';
import { BookDetailView, REVIEW_MIN_CHARS } from './components/BookDetailView';
import { BookReader } from './components/BookReader';
import { ReadingFormatModal } from './components/ReadingFormatModal';
import { PdfReaderView } from './components/PdfReaderView';
import { SearchView } from './components/ExploreAndSearch';
import { downloadBookPdf } from './utils/pdfUtils';
import {
  MyLibraryView,
  ProfileView,
  DownloadsView,
  ProfileUpdateInput,
  validateUsernameFormat,
  generateDefaultUsername,
  getUsernameChangeStatus,
  saveLocalUsernameChangeHistory,
} from './components/MyLibraryAndProfile';
import {
  CommunityView,
  CreatePostInput,
  CreateReplyInput,
  CreateReportInput,
  extractMentionsFromText,
  POST_MAX_LENGTH,
  REPLY_MAX_LENGTH,
} from './components/CommunityView';
import { AdminDashboard } from './components/AdminDashboard';
import { PremiumModal } from './components/PremiumModal';
import { DirectMessagesModal } from './components/DirectMessagesModal';
import {
  getMaxProfileFavoriteBooks,
  isUserPremium,
  isValidHexColor,
} from './utils/premiumUtils';

const DEFAULT_READER_PREFS: ReaderPreferences = {
  fontSize: 20,
  fontFamily: 'editorial',
  lineHeight: 1.85,
  maxWidth: 'comfortable',
  theme: 'dark',
};

const LOCAL_STORAGE_LIB_KEY = 'livroflix_user_library_v1';
const LOCAL_STORAGE_PREFS_KEY = 'livroflix_reader_prefs_v1';
const LOCAL_STORAGE_USERNAMES_KEY = 'livroflix_usernames_registry_v1';
const LOCAL_STORAGE_COMM_POSTS_KEY = 'livroflix_comm_posts_v1';
const LOCAL_STORAGE_COMM_LIKES_KEY = 'livroflix_comm_likes_v1';
const LOCAL_STORAGE_COMM_REPLIES_KEY = 'livroflix_comm_replies_v1';
const LOCAL_STORAGE_COMM_FOLLOWS_KEY = 'livroflix_comm_follows_v1';
const LOCAL_STORAGE_COMM_NOTIFS_KEY = 'livroflix_comm_notifs_v1';
const LOCAL_STORAGE_BOOK_REVIEWS_KEY = 'livroflix_book_reviews_v1';
const LEGACY_AUTO_SET = new Set(LEGACY_AUTO_BOOK_IDS);

function readLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as T[];
    }
  } catch {
    // ignore
  }
  return [];
}

function writeLocalArray<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function getLocalUsernamesRegistry(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USERNAMES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

function saveLocalUsernameOwner(
  username: string,
  uid: string,
  previousUsername?: string
): void {
  try {
    const registry = getLocalUsernamesRegistry();
    if (
      previousUsername &&
      previousUsername !== username &&
      registry[previousUsername] === uid
    ) {
      delete registry[previousUsername];
    }
    if (username) {
      registry[username] = uid;
    }
    localStorage.setItem(LOCAL_STORAGE_USERNAMES_KEY, JSON.stringify(registry));
  } catch {
    // ignore
  }
}

function sanitizeLibraryRecord(
  raw: Record<string, UserBookItem>
): Record<string, UserBookItem> {
  const cleaned: Record<string, UserBookItem> = {};
  Object.entries(raw || {}).forEach(([key, item]) => {
    if (item && item.bookId && !LEGACY_AUTO_SET.has(item.bookId) && !LEGACY_AUTO_SET.has(key)) {
      cleaned[item.bookId] = item;
    }
  });
  return cleaned;
}

export default function App() {
  // Navigation & Active Book State
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [previousView, setPreviousView] = useState<ActiveView>('home');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [formatModalBookId, setFormatModalBookId] = useState<string | null>(null);
  const [selectedReadingFormat, setSelectedReadingFormat] =
    useState<ReadingFormat>('pdf');
  const [selectedCategory, setSelectedCategory] = useState<string>('Em alta');
  const [activeHeroIndex, setActiveHeroIndex] = useState<number>(0);
  const [vipModalOpen, setVipModalOpen] = useState<boolean>(false);
  const [vipSubscribed, setVipSubscribed] = useState<boolean>(false);

  // Real Catalog, Categories, Home Rows & Platform Settings State
  const [books, setBooks] = useState<Book[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(true);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [homeRows, setHomeRows] = useState<HomeRow[]>(DEFAULT_HOME_ROWS);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(
    DEFAULT_PLATFORM_SETTINGS
  );
  const cleanupExecutedRef = useRef<boolean>(false);

  // Auth & Isolated Real User State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() =>
    getSavedSessionProfile()
  );
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [publicProfilesMap, setPublicProfilesMap] = useState<
    Record<string, PublicProfile>
  >({});
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(() =>
    readLocalArray<CommunityPost>(LOCAL_STORAGE_COMM_POSTS_KEY)
  );
  const [communityLikes, setCommunityLikes] = useState<CommunityLike[]>(() =>
    readLocalArray<CommunityLike>(LOCAL_STORAGE_COMM_LIKES_KEY)
  );
  const [communityReplies, setCommunityReplies] = useState<CommunityReply[]>(
    () => readLocalArray<CommunityReply>(LOCAL_STORAGE_COMM_REPLIES_KEY)
  );
  const [communityFollows, setCommunityFollows] = useState<CommunityFollow[]>(
    () => readLocalArray<CommunityFollow>(LOCAL_STORAGE_COMM_FOLLOWS_KEY)
  );
  const [communityNotifications, setCommunityNotifications] = useState<
    CommunityNotification[]
  >(() => readLocalArray<CommunityNotification>(LOCAL_STORAGE_COMM_NOTIFS_KEY));
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>(
    []
  );
  const [directConversations, setDirectConversations] = useState<
    DirectConversation[]
  >([]);
  const [dmModalOpen, setDmModalOpen] = useState<boolean>(false);
  const [dmInitialRecipientId, setDmInitialRecipientId] = useState<
    string | null
  >(null);
  const [bookReviews, setBookReviews] = useState<BookReview[]>(() =>
    readLocalArray<BookReview>(LOCAL_STORAGE_BOOK_REVIEWS_KEY)
  );
  const [scrollToReviewsOnDetail, setScrollToReviewsOnDetail] =
    useState<boolean>(false);

  useEffect(() => {
    writeLocalArray(LOCAL_STORAGE_BOOK_REVIEWS_KEY, bookReviews);
  }, [bookReviews]);

  useEffect(() => {
    writeLocalArray(LOCAL_STORAGE_COMM_POSTS_KEY, communityPosts);
  }, [communityPosts]);

  useEffect(() => {
    writeLocalArray(LOCAL_STORAGE_COMM_LIKES_KEY, communityLikes);
  }, [communityLikes]);

  useEffect(() => {
    writeLocalArray(LOCAL_STORAGE_COMM_REPLIES_KEY, communityReplies);
  }, [communityReplies]);

  useEffect(() => {
    writeLocalArray(LOCAL_STORAGE_COMM_FOLLOWS_KEY, communityFollows);
  }, [communityFollows]);

  useEffect(() => {
    writeLocalArray(LOCAL_STORAGE_COMM_NOTIFS_KEY, communityNotifications);
  }, [communityNotifications]);
  const [userLibrary, setUserLibrary] = useState<Record<string, UserBookItem>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_LIB_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const cleaned = sanitizeLibraryRecord(parsed);
        localStorage.setItem(LOCAL_STORAGE_LIB_KEY, JSON.stringify(cleaned));
        return cleaned;
      }
    } catch {
      // ignore local storage errors
    }
    return {};
  });

  const [readerPrefs, setReaderPrefs] = useState<ReaderPreferences>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_PREFS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_READER_PREFS;
  });

  // Determine if current user is Administrator
  const isAdmin = Boolean(
    (firebaseUser?.email &&
      firebaseUser.email.toLowerCase() === 'malexlkw@gmail.com') ||
      (userProfile?.email &&
        userProfile.email.toLowerCase() === 'malexlkw@gmail.com') ||
      userProfile?.role === 'admin'
  );

  const activeUserId = firebaseUser?.uid || userProfile?.uid || null;

  // Direct Email / Admin Login Handler (works even if Google Popup domain is not yet authorized on Render)
  const handleDirectSignIn = async (emailInput: string, nameInput?: string) => {
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) return;
    const isOwnerAdmin = cleanEmail === 'malexlkw@gmail.com';
    const deterministicUid =
      'user-' + cleanEmail.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const userRef = doc(db, 'users', deterministicUid);

    const initialName =
      nameInput?.trim() ||
      (isOwnerAdmin ? 'Marcos Leandro' : cleanEmail.split('@')[0]);
    const defaultUsername = generateDefaultUsername({
      uid: deterministicUid,
      nome: initialName,
      displayName: initialName,
      email: cleanEmail,
    });

    let finalProfile: UserProfile = {
      uid: deterministicUid,
      nome: initialName,
      displayName: initialName,
      username: defaultUsername,
      bio: '',
      email: cleanEmail,
      foto: '',
      photoURL: '',
      role: isOwnerAdmin ? 'admin' : 'user',
      streakDays: 0,
      totalMinutesRead: 0,
      preferenciasLeitor: readerPrefs,
      updatedAt: new Date().toISOString(),
    };

    try {
      const existingSnap = await getDoc(userRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as UserProfile;
        const resolvedName =
          nameInput?.trim() ||
          existingData.displayName ||
          existingData.nome ||
          initialName;
        const resolvedPhoto =
          'photoURL' in existingData || 'foto' in existingData
            ? (existingData.photoURL ?? existingData.foto ?? '')
            : '';
        const resolvedUsername =
          existingData.username ||
          generateDefaultUsername({
            uid: deterministicUid,
            nome: resolvedName,
            displayName: resolvedName,
            email: cleanEmail,
          });
        finalProfile = stripUndefined({
          ...existingData,
          uid: deterministicUid,
          nome: resolvedName,
          displayName: resolvedName,
          username: resolvedUsername,
          bio: typeof existingData.bio === 'string' ? existingData.bio : '',
          email: cleanEmail,
          foto: resolvedPhoto,
          photoURL: resolvedPhoto,
          role: isOwnerAdmin ? 'admin' : existingData.role || 'user',
          preferenciasLeitor: existingData.preferenciasLeitor || readerPrefs,
          updatedAt: new Date().toISOString(),
        });
      }
      await setDoc(userRef, stripUndefined(finalProfile), { merge: true });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `users/${deterministicUid}`
      );
    }

    if (finalProfile.username) {
      saveLocalUsernameOwner(finalProfile.username, finalProfile.uid);
    }
    saveSessionProfile(finalProfile);
    setUserProfile(finalProfile);
  };

  // 0. Global protection against dragging or downloading any image, book cover, avatar, or graphic
  useEffect(() => {
    const handlePreventDragStart = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handlePreventImageContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tagName = target.tagName?.toUpperCase();
      // Allow normal context menu only inside text inputs/textareas for typing/pasting
      if (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener('dragstart', handlePreventDragStart, {
      capture: true,
    });
    document.addEventListener('contextmenu', handlePreventImageContextMenu, {
      capture: true,
    });

    return () => {
      document.removeEventListener('dragstart', handlePreventDragStart, {
        capture: true,
      });
      document.removeEventListener(
        'contextmenu',
        handlePreventImageContextMenu,
        { capture: true }
      );
    };
  }, []);

  // 1. Listen to Firebase Authentication (using strictly real user metrics)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const isOwnerAdmin =
          user.email?.toLowerCase() === 'malexlkw@gmail.com';
        const userRef = doc(db, 'users', user.uid);

        try {
          const existingSnap = await getDoc(userRef);
          if (existingSnap.exists()) {
            const existingData = existingSnap.data() as UserProfile;
            // Reset legacy superficial 7 days / 540 minutes defaults if present
            const wasLegacyFakeStats =
              existingData.streakDays === 7 &&
              existingData.totalMinutesRead === 540;

            const resolvedName =
              existingData.displayName ||
              existingData.nome ||
              user.displayName ||
              user.email?.split('@')[0] ||
              'Leitor LIVROFLIX';
            const hasSavedPhoto =
              'photoURL' in existingData || 'foto' in existingData;
            const resolvedPhoto = hasSavedPhoto
              ? (existingData.photoURL ?? existingData.foto ?? '')
              : (user.photoURL || '');
            const resolvedUsername =
              existingData.username ||
              generateDefaultUsername({
                uid: user.uid,
                nome: resolvedName,
                displayName: resolvedName,
                email: user.email || existingData.email || '',
              });
            const resolvedBio =
              typeof existingData.bio === 'string' ? existingData.bio : '';

            const updatedProfile: UserProfile = stripUndefined({
              ...existingData,
              uid: user.uid,
              nome: resolvedName,
              displayName: resolvedName,
              username: resolvedUsername,
              bio: resolvedBio,
              email: user.email || existingData.email || '',
              foto: resolvedPhoto,
              photoURL: resolvedPhoto,
              role: isOwnerAdmin ? 'admin' : existingData.role || 'user',
              streakDays: wasLegacyFakeStats
                ? 0
                : typeof existingData.streakDays === 'number'
                ? existingData.streakDays
                : 0,
              totalMinutesRead: wasLegacyFakeStats
                ? 0
                : typeof existingData.totalMinutesRead === 'number'
                ? existingData.totalMinutesRead
                : 0,
              preferenciasLeitor: existingData.preferenciasLeitor || readerPrefs,
              updatedAt: existingData.updatedAt || new Date().toISOString(),
            });
            if (updatedProfile.username) {
              saveLocalUsernameOwner(updatedProfile.username, user.uid);
            }
            saveSessionProfile(updatedProfile);
            setUserProfile(updatedProfile);
            if (existingData.preferenciasLeitor) {
              setReaderPrefs(existingData.preferenciasLeitor);
            }
            // Only write back if key normalized fields were missing
            if (
              !existingData.displayName ||
              !existingData.username ||
              wasLegacyFakeStats
            ) {
              await setDoc(userRef, updatedProfile, { merge: true });
            }
          } else {
            const initialName =
              user.displayName ||
              user.email?.split('@')[0] ||
              'Leitor LIVROFLIX';
            const initialPhoto = user.photoURL || '';
            const initialUsername = generateDefaultUsername({
              uid: user.uid,
              nome: initialName,
              displayName: initialName,
              email: user.email || '',
            });
            const newProfile: UserProfile = stripUndefined({
              uid: user.uid,
              nome: initialName,
              displayName: initialName,
              username: initialUsername,
              bio: '',
              email: user.email || '',
              foto: initialPhoto,
              photoURL: initialPhoto,
              role: isOwnerAdmin ? 'admin' : 'user',
              streakDays: 0,
              totalMinutesRead: 0,
              preferenciasLeitor: readerPrefs,
              updatedAt: new Date().toISOString(),
            });
            if (newProfile.username) {
              saveLocalUsernameOwner(newProfile.username, user.uid);
            }
            saveSessionProfile(newProfile);
            setUserProfile(newProfile);
            await setDoc(userRef, newProfile, { merge: true });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        const savedSession = getSavedSessionProfile();
        if (savedSession) {
          setUserProfile(savedSession);
        } else {
          setUserProfile(null);
          try {
            const saved = localStorage.getItem(LOCAL_STORAGE_LIB_KEY);
            setUserLibrary(saved ? sanitizeLibraryRecord(JSON.parse(saved)) : {});
          } catch {
            setUserLibrary({});
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 1b. Real-time sync of current user's profile document (/users/{activeUserId})
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    const uid = firebaseUser.uid;
    const userRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as UserProfile;
        const resolvedName =
          data.displayName || data.nome || 'Leitor LIVROFLIX';
        const hasSavedPhoto = 'photoURL' in data || 'foto' in data;
        const resolvedPhoto = hasSavedPhoto
          ? (data.photoURL ?? data.foto ?? '')
          : '';
        const syncedProfile: UserProfile = stripUndefined({
          ...data,
          uid,
          nome: resolvedName,
          displayName: resolvedName,
          foto: resolvedPhoto,
          photoURL: resolvedPhoto,
          bio: typeof data.bio === 'string' ? data.bio : '',
        });
        saveSessionProfile(syncedProfile);
        setUserProfile(syncedProfile);
      },
      () => {
        // Ignore snapshot errors if rules are transitioning
      }
    );
    return () => unsubscribe();
  }, [firebaseUser?.uid]);

  // 2. Sync Global Platform Settings (/settings/platform)
  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'platform');
    const unsubscribe = onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<PlatformSettings>;
          setPlatformSettings({
            ...DEFAULT_PLATFORM_SETTINGS,
            ...data,
            heroBookIds: (data.heroBookIds || []).filter(
              (id) => !LEGACY_AUTO_SET.has(id)
            ),
            top10BookIds: (data.top10BookIds || []).filter(
              (id) => !LEGACY_AUTO_SET.has(id)
            ),
            headerCategories:
              data.headerCategories && data.headerCategories.length > 0
                ? data.headerCategories
                : DEFAULT_PLATFORM_SETTINGS.headerCategories,
          });
        } else {
          setPlatformSettings(DEFAULT_PLATFORM_SETTINGS);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/platform');
      }
    );
    return () => unsubscribe();
  }, []);

  // 3. Sync Dynamic Home Rows (/home_rows)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'home_rows'),
      (snapshot) => {
        if (snapshot.empty) {
          setHomeRows(DEFAULT_HOME_ROWS);
        } else {
          const rows: HomeRow[] = [];
          snapshot.forEach((docSnap) => {
            rows.push(docSnap.data() as HomeRow);
          });
          rows.sort((a, b) => a.ordem - b.ordem);
          setHomeRows(rows);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'home_rows');
      }
    );
    return () => unsubscribe();
  }, []);

  // 4. Sync Real Books Catalog from Firestore (/books) — excluding any legacy auto-created book IDs
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setIsCatalogLoading(false);
    }, 3500);

    const unsubscribe = onSnapshot(
      collection(db, 'books'),
      (snapshot) => {
        const realBooks: Book[] = [];
        snapshot.forEach((docSnap) => {
          if (!LEGACY_AUTO_SET.has(docSnap.id)) {
            const rawBook = docSnap.data() as Book;
            const resolvedCreatedAt = resolveBookCreatedAtIso({
              ...rawBook,
              id: rawBook.id || docSnap.id,
            });
            realBooks.push({
              ...rawBook,
              id: rawBook.id || docSnap.id,
              ...(resolvedCreatedAt ? { createdAt: resolvedCreatedAt } : {}),
            });
          }
        });
        realBooks.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        setBooks(realBooks);
        setIsCatalogLoading(false);
      },
      (error) => {
        setIsCatalogLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'books');
      }
    );
    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  // 5. Purge Legacy Auto-Created Books from Firestore (/books) when Admin is authenticated
  useEffect(() => {
    if (!isAdmin || !firebaseUser || cleanupExecutedRef.current) return;
    cleanupExecutedRef.current = true;

    const purgeAutoCreatedBooksAndSeedStructure = async () => {
      try {
        // Delete any legacy auto-seeded books from /books in Firestore & backfill missing createdAt
        const booksSnap = await getDocs(collection(db, 'books'));
        for (const docSnap of booksSnap.docs) {
          if (LEGACY_AUTO_SET.has(docSnap.id)) {
            await deleteDoc(doc(db, 'books', docSnap.id));
          } else {
            const data = docSnap.data() as Book;
            if (!data.createdAt) {
              const resolvedCreatedAt =
                resolveBookCreatedAtIso({ ...data, id: data.id || docSnap.id }) ||
                new Date().toISOString();
              await setDoc(
                doc(db, 'books', docSnap.id),
                { createdAt: resolvedCreatedAt },
                { merge: true }
              );
            }
          }
        }

        // Ensure /home_rows structure exists so Admin can manage rows freely
        const rowsSnap = await getDocs(collection(db, 'home_rows'));
        if (rowsSnap.empty) {
          for (const row of DEFAULT_HOME_ROWS) {
            await setDoc(doc(db, 'home_rows', row.id), stripUndefined(row));
          }
        }
      } catch (error) {
        console.warn('Cleanup check info:', error);
      }
    };

    purgeAutoCreatedBooksAndSeedStructure();
  }, [isAdmin, firebaseUser]);

  // 6. Sync Custom Categories from Firestore (/categories)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'categories'),
      (snapshot) => {
        const cats: CustomCategory[] = [];
        snapshot.forEach((d) => cats.push(d.data() as CustomCategory));
        cats.sort((a, b) => a.ordem - b.ordem);
        setCustomCategories(cats);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'categories');
      }
    );
    return () => unsubscribe();
  }, []);

  // 7. Strictly Isolated Real User Library Subscription (/users/{userId}/library)
  // Purges any legacy auto-seeded library items and never seeds fake books.
  useEffect(() => {
    if (!activeUserId) return;
    const userId = activeUserId;
    const libRef = collection(db, 'users', userId, 'library');

    const unsubscribe = onSnapshot(
      libRef,
      (snapshot) => {
        const loaded: Record<string, UserBookItem> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserBookItem;
          if (LEGACY_AUTO_SET.has(docSnap.id) || LEGACY_AUTO_SET.has(data.bookId)) {
            // Remove legacy superficial library item from Firestore
            deleteDoc(doc(db, 'users', userId, 'library', docSnap.id)).catch(
              () => {}
            );
          } else {
            loaded[data.bookId] = data;
          }
        });
        setUserLibrary(loaded);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `users/${userId}/library`
        );
      }
    );

    return () => unsubscribe();
  }, [activeUserId]);

  // 8. Load Registered Users for Admin Panel when user is Admin
  useEffect(() => {
    if (!isAdmin) return;
    getDocs(collection(db, 'users'))
      .then((snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => list.push(d.data() as UserProfile));
        setRegisteredUsers(list);
      })
      .catch((error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
  }, [isAdmin, activeUserId, activeView]);

  // 9. Sync current user's PublicProfile (/public_profiles/{uid}) so Community cards & @mentions stay up-to-date
  useEffect(() => {
    if (!userProfile?.uid) return;
    const displayName =
      userProfile.displayName || userProfile.nome || 'Leitor LIVROFLIX';
    const username = (
      userProfile.username ||
      generateDefaultUsername(userProfile)
    )
      .replace(/^@+/, '')
      .toLowerCase();
    const photoURL = userProfile.photoURL ?? userProfile.foto ?? '';
    const bio = userProfile.bio || '';
    const resolvedFavIds = Array.isArray(userProfile.profileFavoriteBooks)
      ? userProfile.profileFavoriteBooks.slice(0, 5)
      : Array.isArray(userProfile.favoriteBooks)
      ? userProfile.favoriteBooks.slice(0, 5)
      : undefined;
    const resolvedUnlockedBadges = Array.isArray(userProfile.unlockedBadges)
      ? userProfile.unlockedBadges.filter(isValidBadgeId).slice(0, 10)
      : undefined;
    const resolvedProfileBadges = Array.isArray(userProfile.profileBadges)
      ? userProfile.profileBadges
          .filter(
            (id): id is BadgeId =>
              isValidBadgeId(id) &&
              Boolean(resolvedUnlockedBadges?.includes(id))
          )
          .slice(0, 10)
      : undefined;
    const resolvedUsernameColor =
      userProfile.usernameColor ||
      userProfile.profileCustomization?.usernameColor;
    const pubProfile: PublicProfile = stripUndefined({
      uid: userProfile.uid,
      displayName,
      username,
      bio,
      photoURL,
      premium: Boolean(userProfile.premium),
      usernameColor: isValidHexColor(resolvedUsernameColor)
        ? resolvedUsernameColor
        : undefined,
      profileCustomization: userProfile.profileCustomization,
      favoriteBooks: resolvedFavIds,
      profileFavoriteBooks: resolvedFavIds,
      unlockedBadges: resolvedUnlockedBadges,
      profileBadges: resolvedProfileBadges,
      updatedAt: userProfile.updatedAt || new Date().toISOString(),
    });

    setPublicProfilesMap((prev) => ({
      ...prev,
      [userProfile.uid]: pubProfile,
    }));

    if (firebaseUser && firebaseUser.uid === userProfile.uid) {
      setDoc(
        doc(db, 'public_profiles', userProfile.uid),
        stripUndefined(pubProfile),
        { merge: true }
      ).catch(() => {});
    }
  }, [
    firebaseUser,
    userProfile?.uid,
    userProfile?.displayName,
    userProfile?.nome,
    userProfile?.username,
    userProfile?.bio,
    userProfile?.photoURL,
    userProfile?.foto,
    userProfile?.premium,
    userProfile?.usernameColor,
    userProfile?.profileCustomization,
    userProfile?.favoriteBooks,
    userProfile?.profileFavoriteBooks,
    userProfile?.unlockedBadges,
    userProfile?.profileBadges,
    userProfile?.updatedAt,
  ]);

  // 9b. Automatically evaluate literary achievements and unlock corresponding badges
  const [badgeUnlockQueue, setBadgeUnlockQueue] = useState<
    EvaluatedAchievement[]
  >([]);
  const [commonAchievementQueue, setCommonAchievementQueue] = useState<
    EvaluatedAchievement[]
  >([]);
  const seenAchievementsRef = useRef<{ uid: string; ids: Set<string> } | null>(
    null
  );
  const userActionTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    if (!userProfile?.uid) return;
    const uid = userProfile.uid;
    const storageKey = `livroflix_seen_achievements_${uid}`;

    const { achievements, computedUnlockedBadgeIds } =
      evaluateLiteraryAchievementsAndBadges(books, userLibrary, userProfile);

    const existingUnlocked = Array.isArray(userProfile.unlockedBadges)
      ? userProfile.unlockedBadges.filter(isValidBadgeId)
      : [];
    const existingSet = new Set<BadgeId>(existingUnlocked);

    // Initialize baseline for this user on first evaluation (never animate on initial load/refresh)
    if (
      !seenAchievementsRef.current ||
      seenAchievementsRef.current.uid !== uid
    ) {
      let storedIds: string[] = [];
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) storedIds = parsed;
        }
      } catch {
        // ignore storage errors
      }

      const initialSeen = new Set<string>(storedIds);
      for (const ach of achievements) {
        if (
          ach.unlocked ||
          (ach.hasBadge && ach.badgeId && existingSet.has(ach.badgeId))
        ) {
          initialSeen.add(ach.id);
        }
      }

      seenAchievementsRef.current = { uid, ids: initialSeen };
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(Array.from(initialSeen))
        );
      } catch {
        // ignore storage errors
      }
    } else {
      // Subsequent evaluation during active session
      const seenSet = seenAchievementsRef.current.ids;
      const newlyUnlockedWithBadge: EvaluatedAchievement[] = [];
      const newlyUnlockedWithoutBadge: EvaluatedAchievement[] = [];
      let seenChanged = false;

      for (const ach of achievements) {
        if (ach.unlocked && !seenSet.has(ach.id)) {
          seenSet.add(ach.id);
          seenChanged = true;

          // Only trigger unlock modals/banners if unlocked following a user action in this session
          // and not already present in userProfile.unlockedBadges
          if (userActionTriggeredRef.current) {
            if (ach.hasBadge && ach.badgeId) {
              if (!existingSet.has(ach.badgeId)) {
                newlyUnlockedWithBadge.push(ach);
              }
            } else {
              newlyUnlockedWithoutBadge.push(ach);
            }
          }
        }
      }

      if (seenChanged) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(seenSet)));
        } catch {
          // ignore storage errors
        }
      }

      if (newlyUnlockedWithBadge.length > 0) {
        setBadgeUnlockQueue((prev) => {
          const existingQueueIds = new Set(prev.map((a) => a.id));
          const toAdd = newlyUnlockedWithBadge.filter(
            (a) => !existingQueueIds.has(a.id)
          );
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }

      if (newlyUnlockedWithoutBadge.length > 0) {
        setCommonAchievementQueue((prev) => {
          const existingQueueIds = new Set(prev.map((a) => a.id));
          const toAdd = newlyUnlockedWithoutBadge.filter(
            (a) => !existingQueueIds.has(a.id)
          );
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      }
    }

    const hasNewBadge = computedUnlockedBadgeIds.some(
      (id) => !existingSet.has(id)
    );

    if (!hasNewBadge) return;

    const mergedUnlocked = Array.from(
      new Set<BadgeId>([...existingUnlocked, ...computedUnlockedBadgeIds])
    ).slice(0, 10);

    // Preserve user's chosen profileBadges (validating against mergedUnlocked)
    const currentProfileBadges = Array.isArray(userProfile.profileBadges)
      ? userProfile.profileBadges.filter(
          (id): id is BadgeId =>
            isValidBadgeId(id) && mergedUnlocked.includes(id)
        )
      : [];

    const nowIso = new Date().toISOString();
    const targetUid = firebaseUser?.uid || userProfile.uid;
    const updatedProfile: UserProfile = stripUndefined({
      ...userProfile,
      uid: userProfile.uid,
      unlockedBadges: mergedUnlocked,
      profileBadges: currentProfileBadges,
      updatedAt: nowIso,
    });

    saveSessionProfile(updatedProfile);
    setUserProfile(updatedProfile);
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.uid === targetUid ? updatedProfile : u))
    );

    setDoc(
      doc(db, 'users', targetUid),
      {
        uid: targetUid,
        unlockedBadges: mergedUnlocked,
        profileBadges: currentProfileBadges,
        updatedAt: nowIso,
      },
      { merge: true }
    ).catch(() => {});
  }, [books, userLibrary, userProfile, firebaseUser]);

  // 10. Real-time Subscriptions for Community Collections
  useEffect(() => {
    const unsubProfiles = onSnapshot(
      collection(db, 'public_profiles'),
      (snap) => {
        const nextMap: Record<string, PublicProfile> = {};
        snap.forEach((d) => {
          const data = d.data() as PublicProfile;
          const uid = data.uid || d.id;
          nextMap[uid] = { ...data, uid };
        });
        setPublicProfilesMap((prev) => ({ ...prev, ...nextMap }));
      },
      () => {}
    );

    const unsubPosts = onSnapshot(
      collection(db, 'community_posts'),
      (snap) => {
        const list: CommunityPost[] = [];
        const remoteIds = new Set<string>();
        snap.forEach((d) => {
          const data = d.data() as CommunityPost;
          const id = data.id || d.id;
          remoteIds.add(id);
          list.push({ ...data, id });
        });
        setCommunityPosts((prev) => {
          const merged = firebaseUser
            ? list
            : [...list, ...prev.filter((p) => !remoteIds.has(p.id))];
          return merged.sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          );
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'community_posts');
      }
    );

    const unsubLikes = onSnapshot(
      collection(db, 'community_likes'),
      (snap) => {
        const list: CommunityLike[] = [];
        const remoteIds = new Set<string>();
        snap.forEach((d) => {
          const data = d.data() as CommunityLike;
          const id = data.id || d.id;
          remoteIds.add(id);
          list.push({ ...data, id });
        });
        setCommunityLikes((prev) =>
          firebaseUser
            ? list
            : [...list, ...prev.filter((l) => !remoteIds.has(l.id))]
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'community_likes');
      }
    );

    const unsubReplies = onSnapshot(
      collection(db, 'community_replies'),
      (snap) => {
        const list: CommunityReply[] = [];
        const remoteIds = new Set<string>();
        snap.forEach((d) => {
          const data = d.data() as CommunityReply;
          const id = data.id || d.id;
          remoteIds.add(id);
          list.push({ ...data, id });
        });
        setCommunityReplies((prev) => {
          const merged = firebaseUser
            ? list
            : [...list, ...prev.filter((r) => !remoteIds.has(r.id))];
          return merged.sort((a, b) =>
            (a.createdAt || '').localeCompare(b.createdAt || '')
          );
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'community_replies');
      }
    );

    const unsubFollows = onSnapshot(
      collection(db, 'community_follows'),
      (snap) => {
        const list: CommunityFollow[] = [];
        const remoteIds = new Set<string>();
        snap.forEach((d) => {
          const data = d.data() as CommunityFollow;
          const id = data.id || d.id;
          remoteIds.add(id);
          list.push({ ...data, id });
        });
        setCommunityFollows((prev) =>
          firebaseUser
            ? list
            : [...list, ...prev.filter((f) => !remoteIds.has(f.id))]
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'community_follows');
      }
    );

    const unsubBookReviews = onSnapshot(
      collection(db, 'book_reviews'),
      (snap) => {
        const list: BookReview[] = [];
        const remoteIds = new Set<string>();
        snap.forEach((d) => {
          const data = d.data() as BookReview;
          const id = data.id || d.id;
          if (id && data.bookId && data.userId && data.text) {
            remoteIds.add(id);
            list.push({ ...data, id });
          }
        });
        setBookReviews((prev) => {
          const merged = firebaseUser
            ? list
            : [...list, ...prev.filter((r) => !remoteIds.has(r.id))];
          return merged.sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          );
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'book_reviews');
      }
    );

    return () => {
      unsubProfiles();
      unsubPosts();
      unsubLikes();
      unsubReplies();
      unsubFollows();
      unsubBookReviews();
    };
  }, [firebaseUser]);

  // 11. Real-time Subscription for Current User's Community Notifications (/community_notifications)
  useEffect(() => {
    if (!firebaseUser?.uid) {
      setCommunityNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'community_notifications'),
      where('recipientId', '==', firebaseUser.uid)
    );
    const unsubNotifs = onSnapshot(
      q,
      (snap) => {
        const list: CommunityNotification[] = [];
        snap.forEach((d) => {
          const data = d.data() as CommunityNotification;
          list.push({ ...data, id: data.id || d.id });
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setCommunityNotifications(list);
      },
      () => {}
    );
    return () => unsubNotifs();
  }, [firebaseUser?.uid]);

  // 11b. Real-time Subscription for Current User's Private Direct Conversations (/conversations)
  useEffect(() => {
    if (!firebaseUser?.uid) {
      setDirectConversations([]);
      return;
    }
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', firebaseUser.uid)
    );
    const unsubConvs = onSnapshot(
      q,
      (snap) => {
        const list: DirectConversation[] = [];
        snap.forEach((d) => {
          const data = d.data() as DirectConversation;
          list.push({ ...data, id: data.id || d.id });
        });
        list.sort((a, b) =>
          (b.lastMessageAt || b.updatedAt || '').localeCompare(
            a.lastMessageAt || a.updatedAt || ''
          )
        );
        setDirectConversations(list);
      },
      () => {}
    );
    return () => unsubConvs();
  }, [firebaseUser?.uid]);

  // 12. Real-time Subscription for Community Reports (Admin only)
  useEffect(() => {
    if (!isAdmin || !firebaseUser) {
      setCommunityReports([]);
      return;
    }
    const unsubReports = onSnapshot(
      collection(db, 'community_reports'),
      (snap) => {
        const list: CommunityReport[] = [];
        snap.forEach((d) => {
          const data = d.data() as CommunityReport;
          list.push({ ...data, id: data.id || d.id });
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setCommunityReports(list);
      },
      () => {}
    );
    return () => unsubReports();
  }, [isAdmin, firebaseUser]);

  // Helper to persist a single UserBookItem
  const saveUserBookItem = async (updatedItem: UserBookItem) => {
    const nextLibrary = {
      ...userLibrary,
      [updatedItem.bookId]: updatedItem,
    };
    setUserLibrary(nextLibrary);

    if (!activeUserId) {
      try {
        localStorage.setItem(LOCAL_STORAGE_LIB_KEY, JSON.stringify(nextLibrary));
      } catch {
        // ignore
      }
      return;
    }

    const path = `users/${activeUserId}/library/${updatedItem.bookId}`;
    try {
      await setDoc(
        doc(db, 'users', activeUserId, 'library', updatedItem.bookId),
        stripUndefined({
          ...updatedItem,
          userId: activeUserId,
        }),
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const getOrInitUserItem = (book: Book): UserBookItem => {
    const existing = userLibrary[book.id];
    if (existing) return existing;
    return {
      bookId: book.id,
      userId: activeUserId || 'local',
      inMyList: false,
      isFavorite: false,
      status: 'nenhum',
      paginaAtual: 1,
      totalPaginas: book.paginas,
      progresso: 0,
      minutosLidos: 0,
      ultimoAcesso: new Date().toISOString(),
    };
  };

  const persistProfileFavoriteBookIds = async (nextRawIds: string[]) => {
    if (!userProfile) return;
    const seen = new Set<string>();
    const cleanIds: string[] = [];
    for (const id of nextRawIds) {
      if (typeof id === 'string' && id.trim() && !seen.has(id)) {
        seen.add(id);
        cleanIds.push(id);
        if (cleanIds.length === 5) break;
      }
    }

    const targetUid = firebaseUser?.uid || userProfile.uid;
    const nowIso = new Date().toISOString();
    const updatedProfile: UserProfile = stripUndefined({
      ...userProfile,
      uid: userProfile.uid,
      favoriteBooks: cleanIds,
      profileFavoriteBooks: cleanIds,
      updatedAt: nowIso,
    });

    saveSessionProfile(updatedProfile);
    setUserProfile(updatedProfile);
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.uid === targetUid ? updatedProfile : u))
    );

    const displayName =
      updatedProfile.displayName || updatedProfile.nome || 'Leitor LIVROFLIX';
    const username = (
      updatedProfile.username || generateDefaultUsername(updatedProfile)
    )
      .replace(/^@+/, '')
      .toLowerCase();
    const photoURL = updatedProfile.photoURL ?? updatedProfile.foto ?? '';
    const bio = updatedProfile.bio || '';

    const updatedPubProfile: PublicProfile = stripUndefined({
      uid: targetUid,
      displayName,
      username,
      bio,
      photoURL,
      premium: Boolean(updatedProfile.premium),
      usernameColor: updatedProfile.usernameColor,
      profileCustomization: updatedProfile.profileCustomization,
      favoriteBooks: cleanIds,
      profileFavoriteBooks: cleanIds,
      updatedAt: nowIso,
    });

    setPublicProfilesMap((prev) => ({
      ...prev,
      [targetUid]: updatedPubProfile,
    }));

    if (firebaseUser) {
      try {
        await setDoc(
          doc(db, 'users', targetUid),
          {
            uid: targetUid,
            favoriteBooks: cleanIds,
            profileFavoriteBooks: cleanIds,
            updatedAt: nowIso,
          },
          { merge: true }
        );
        setDoc(
          doc(db, 'public_profiles', targetUid),
          stripUndefined(updatedPubProfile),
          { merge: true }
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `users/${targetUid}`
        );
      }
    } else {
      setDoc(
        doc(db, 'users', targetUid),
        {
          uid: targetUid,
          favoriteBooks: cleanIds,
          profileFavoriteBooks: cleanIds,
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
    }
  };

  const removeBookFromProfileFavoritesIfPresent = (bookId: string) => {
    if (!userProfile) return;
    const currentIds = Array.isArray(userProfile.profileFavoriteBooks)
      ? userProfile.profileFavoriteBooks
      : Array.isArray(userProfile.favoriteBooks)
      ? userProfile.favoriteBooks
      : [];
    if (currentIds.includes(bookId)) {
      void persistProfileFavoriteBookIds(
        currentIds.filter((id) => id !== bookId)
      );
    }
  };

  const handleToggleProfileFavoriteBook = (book: Book) => {
    if (!userProfile) return;
    const item = userLibrary[book.id];
    const isInFavorites =
      Boolean(item) &&
      (item.inMyList || item.isFavorite || item.status === 'quero_ler');
    if (!isInFavorites) return;

    const rawCurrentIds = Array.isArray(userProfile.profileFavoriteBooks)
      ? userProfile.profileFavoriteBooks
      : Array.isArray(userProfile.favoriteBooks)
      ? userProfile.favoriteBooks
      : [];
    // Keep only books that are still in the user's favorites
    const currentValidIds = rawCurrentIds.filter((id) => {
      const libItem = userLibrary[id];
      return (
        Boolean(libItem) &&
        (libItem.inMyList ||
          libItem.isFavorite ||
          libItem.status === 'quero_ler')
      );
    });

    const maxProfileFavorites = getMaxProfileFavoriteBooks(userProfile);

    if (currentValidIds.includes(book.id)) {
      // Unselect from profile without removing from Minha lista
      void persistProfileFavoriteBookIds(
        currentValidIds.filter((id) => id !== book.id)
      );
    } else {
      if (currentValidIds.length >= maxProfileFavorites) {
        if (!isUserPremium(userProfile)) {
          setVipModalOpen(true);
        }
        return;
      }
      void persistProfileFavoriteBookIds([...currentValidIds, book.id]);
    }
  };

  const handleToggleProfileBadge = async (badgeId: BadgeId) => {
    if (!userProfile || !isValidBadgeId(badgeId)) return;
    const { computedUnlockedBadgeIds } = evaluateLiteraryAchievementsAndBadges(
      books,
      userLibrary,
      userProfile
    );
    const existingUnlocked = Array.isArray(userProfile.unlockedBadges)
      ? userProfile.unlockedBadges.filter(isValidBadgeId)
      : [];
    const unlockedSet = new Set<BadgeId>([
      ...existingUnlocked,
      ...computedUnlockedBadgeIds,
    ]);

    // Security check: user can only display badges they have genuinely unlocked
    if (!unlockedSet.has(badgeId)) return;

    const allUnlocked = Array.from(unlockedSet).slice(0, 10);
    const currentProfileBadges = Array.isArray(userProfile.profileBadges)
      ? userProfile.profileBadges.filter(
          (id): id is BadgeId => isValidBadgeId(id) && unlockedSet.has(id)
        )
      : [];

    const nextProfileBadges = currentProfileBadges.includes(badgeId)
      ? currentProfileBadges.filter((id) => id !== badgeId)
      : [...currentProfileBadges, badgeId].slice(0, 10);

    const targetUid = firebaseUser?.uid || userProfile.uid;
    const nowIso = new Date().toISOString();
    const updatedProfile: UserProfile = stripUndefined({
      ...userProfile,
      uid: userProfile.uid,
      unlockedBadges: allUnlocked,
      profileBadges: nextProfileBadges,
      updatedAt: nowIso,
    });

    saveSessionProfile(updatedProfile);
    setUserProfile(updatedProfile);
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.uid === targetUid ? updatedProfile : u))
    );

    setDoc(
      doc(db, 'users', targetUid),
      {
        uid: targetUid,
        unlockedBadges: allUnlocked,
        profileBadges: nextProfileBadges,
        updatedAt: nowIso,
      },
      { merge: true }
    ).catch(() => {});
  };

  // User Actions on Books
  const handleToggleList = (book: Book, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    userActionTriggeredRef.current = true;
    const current = getOrInitUserItem(book);
    const nextInList = !current.inMyList;

    saveUserBookItem({
      ...current,
      inMyList: nextInList,
      isFavorite: nextInList ? true : false,
      status:
        !nextInList && current.status === 'quero_ler'
          ? 'nenhum'
          : current.status,
      ultimoAcesso: new Date().toISOString(),
    });

    if (!nextInList) {
      removeBookFromProfileFavoritesIfPresent(book.id);
    }
  };

  const handleToggleFavorite = (book: Book) => {
    userActionTriggeredRef.current = true;
    const current = getOrInitUserItem(book);
    const nextFav = !current.isFavorite;
    saveUserBookItem({
      ...current,
      isFavorite: nextFav,
      inMyList: nextFav ? true : false,
      status: !nextFav && current.status === 'quero_ler' ? 'nenhum' : current.status,
      ultimoAcesso: new Date().toISOString(),
    });

    if (!nextFav) {
      removeBookFromProfileFavoritesIfPresent(book.id);
    }
  };

  const handleToggleDownload = (book: Book) => {
    if (!isUserPremium(userProfile)) {
      setVipModalOpen(true);
      return;
    }
    downloadBookPdf(book, userProfile).catch(() => {});
  };

  const handleChangeStatus = (book: Book, status: ReadingStatus) => {
    userActionTriggeredRef.current = true;
    const current = getOrInitUserItem(book);
    const paginaAtual =
      status === 'concluido'
        ? book.paginas
        : status === 'lendo' && current.paginaAtual <= 1
        ? 1
        : current.paginaAtual;
    const progresso =
      status === 'concluido'
        ? 100
        : status === 'quero_ler'
        ? 0
        : Math.max(1, Math.round((paginaAtual / book.paginas) * 100));

    saveUserBookItem({
      ...current,
      inMyList: true,
      status,
      paginaAtual,
      progresso,
      ultimoAcesso: new Date().toISOString(),
    });
  };

  const handleRemoveFromList = async (book: Book) => {
    const current = userLibrary[book.id];
    if (!current) return;
    const updated: UserBookItem = {
      ...current,
      inMyList: false,
      isFavorite: false,
      status: current.status === 'quero_ler' ? 'nenhum' : current.status,
    };
    await saveUserBookItem(updated);
    removeBookFromProfileFavoritesIfPresent(book.id);
  };

  const handleSaveReadingProgress = (
    book: Book,
    paginaAtual: number,
    totalPaginasOverride?: number
  ) => {
    userActionTriggeredRef.current = true;
    const effectiveTotalPages = Math.max(
      1,
      totalPaginasOverride && totalPaginasOverride > 0
        ? totalPaginasOverride
        : book.paginas
    );
    const current = getOrInitUserItem(book);
    const progresso = Math.min(
      100,
      Math.max(1, Math.round((paginaAtual / effectiveTotalPages) * 100))
    );
    const isFinished = paginaAtual >= effectiveTotalPages;
    const nextMinutes = (current.minutosLidos || 0) + 1;

    saveUserBookItem({
      ...current,
      inMyList: true,
      status: isFinished ? 'concluido' : 'lendo',
      paginaAtual,
      totalPaginas: effectiveTotalPages,
      progresso: isFinished ? 100 : progresso,
      minutosLidos: nextMinutes,
      ultimoAcesso: new Date().toISOString(),
    });

    // Update real user reading metrics in profile
    if (userProfile) {
      const targetUid = firebaseUser?.uid || userProfile.uid;
      const nextTotalMinutes = (userProfile.totalMinutesRead || 0) + 1;
      const nextStreak = Math.max(1, userProfile.streakDays || 0);
      const isNight = isNightHour(new Date());
      const didAdvanceOrFinish =
        paginaAtual !== current.paginaAtual ||
        (isFinished && current.status !== 'concluido');
      const nextNightReadings =
        isNight && didAdvanceOrFinish
          ? (userProfile.nightReadingsCount || 0) + 1
          : userProfile.nightReadingsCount || 0;

      const updatedProfile: UserProfile = stripUndefined({
        ...userProfile,
        totalMinutesRead: nextTotalMinutes,
        streakDays: nextStreak,
        nightReadingsCount: nextNightReadings,
        updatedAt: new Date().toISOString(),
      });
      saveSessionProfile(updatedProfile);
      setUserProfile(updatedProfile);
      setDoc(doc(db, 'users', targetUid), updatedProfile, {
        merge: true,
      }).catch(() => {});
    }
  };

  const handleRateBook = async (
    book: Book,
    stars: number,
    recommend?: boolean
  ) => {
    const current = getOrInitUserItem(book);
    const hadPreviousRating = Boolean(current.avaliacaoUsuario);
    const previousStars = current.avaliacaoUsuario || 0;

    await saveUserBookItem({
      ...current,
      avaliacaoUsuario: stars,
      recomendaria: recommend,
      ultimoAcesso: new Date().toISOString(),
    });

    // Calculate real average rating and review count
    const currentTotal = book.totalAvaliacoes || 0;
    const currentAvg = book.avaliacao || 0;
    const nextTotal = hadPreviousRating ? Math.max(1, currentTotal) : currentTotal + 1;
    const totalPoints = hadPreviousRating
      ? Math.max(0, currentAvg * currentTotal - previousStars) + stars
      : currentAvg * currentTotal + stars;
    const nextAvg = Number((totalPoints / nextTotal).toFixed(1));

    const updatedBook: Book = {
      ...book,
      avaliacao: nextAvg,
      totalAvaliacoes: nextTotal,
    };

    setBooks((prev) =>
      prev.map((b) => (b.id === book.id ? updatedBook : b))
    );

    if (firebaseUser) {
      setDoc(
        doc(db, 'books', book.id),
        stripUndefined({
          avaliacao: nextAvg,
          totalAvaliacoes: nextTotal,
        }),
        { merge: true }
      ).catch(() => {});
    }
  };

  const handleUpdateReaderPrefs = (prefs: ReaderPreferences) => {
    setReaderPrefs(prefs);
    try {
      localStorage.setItem(LOCAL_STORAGE_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
    if (firebaseUser) {
      setDoc(
        doc(db, 'users', firebaseUser.uid),
        { preferenciasLeitor: prefs, updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch(() => {});
    }
  };

  /**
   * Atualiza exclusivamente o próprio perfil do usuário autenticado (/users/{uid}),
   * garantindo unicidade de @username e preservando role, uid, email e estatísticas.
   */
  const handleUpdateOwnProfile = async (
    input: ProfileUpdateInput
  ): Promise<void> => {
    if (!userProfile || !activeUserId) {
      throw new Error('Faça login na sua conta para editar o perfil.');
    }

    // Garante que o usuário só pode alterar o próprio perfil
    const targetUid = firebaseUser ? firebaseUser.uid : userProfile.uid;
    if (targetUid !== userProfile.uid) {
      throw new Error('Operação não permitida: você só pode editar o próprio perfil.');
    }

    const cleanDisplayName = input.displayName.trim();
    if (!cleanDisplayName || cleanDisplayName.length > 60) {
      throw new Error('Informe um nome válido (entre 1 e 60 caracteres).');
    }

    const usernameValidation = validateUsernameFormat(input.username);
    if (!usernameValidation.valid) {
      throw new Error(
        usernameValidation.error || 'Nome de usuário (@username) inválido.'
      );
    }
    const normalizedUsername = usernameValidation.normalized;
    const previousUsername = (
      userProfile.username || generateDefaultUsername(userProfile)
    )
      .replace(/^@+/, '')
      .toLowerCase();
    const isChangingUsername = normalizedUsername !== previousUsername;

    const changeStatus = getUsernameChangeStatus(userProfile);
    if (isChangingUsername && !changeStatus.canChange) {
      throw new Error(
        `Você só pode mudar o @username 2 vezes a cada 15 dias. Próxima alteração disponível em ${
          changeStatus.daysUntilAvailable
        } ${changeStatus.daysUntilAvailable === 1 ? 'dia' : 'dias'} (${
          changeStatus.nextAvailableDateFormatted
        }).`
      );
    }

    const cleanBio = input.bio.trim().slice(0, 160);
    const cleanPhotoURL = input.photoURL || '';

    // 1. Verificar unicidade de @username na memória (registeredUsers) e registro local
    const conflictInMemory = registeredUsers.some(
      (u) =>
        u.uid !== targetUid &&
        (u.username || '').replace(/^@+/, '').toLowerCase() ===
          normalizedUsername
    );
    if (conflictInMemory) {
      throw new Error(
        `O nome de usuário @${normalizedUsername} já está sendo usado por outro leitor.`
      );
    }

    const localRegistry = getLocalUsernamesRegistry();
    if (
      localRegistry[normalizedUsername] &&
      localRegistry[normalizedUsername] !== targetUid
    ) {
      throw new Error(
        `O nome de usuário @${normalizedUsername} já está sendo usado por outro leitor.`
      );
    }

    // 2. Verificar unicidade de @username no Firestore (/usernames/{username})
    const usernameRef = doc(db, 'usernames', normalizedUsername);
    try {
      const usernameSnap = await getDoc(usernameRef);
      if (usernameSnap.exists()) {
        const data = usernameSnap.data() as { uid?: string };
        if (data?.uid && data.uid !== targetUid) {
          throw new Error(
            `O nome de usuário @${normalizedUsername} já está sendo usado por outro leitor.`
          );
        }
      }
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.message.includes('já está sendo usado')
      ) {
        throw err;
      }
      // Se houver falha de rede/offline, prossegue com verificação local
    }

    const nowIso = new Date().toISOString();
    const nextUsernameChangeHistory = isChangingUsername
      ? [...changeStatus.validTimestampsIso, nowIso].slice(-5)
      : changeStatus.validTimestampsIso;

    if (isChangingUsername) {
      saveLocalUsernameChangeHistory(targetUid, nextUsernameChangeHistory);
    }

    const validBookIdsSet = new Set(books.map((b) => b.id));
    const rawFavIds = Array.isArray(input.favoriteBooks)
      ? input.favoriteBooks
      : Array.isArray(userProfile.favoriteBooks)
      ? userProfile.favoriteBooks
      : [];
    const seenFavs = new Set<string>();
    const cleanFavoriteBooks: string[] = [];
    for (const id of rawFavIds) {
      if (
        typeof id === 'string' &&
        id.trim() &&
        validBookIdsSet.has(id) &&
        !seenFavs.has(id)
      ) {
        seenFavs.add(id);
        cleanFavoriteBooks.push(id);
        if (cleanFavoriteBooks.length === 5) break;
      }
    }

    // Preserva rigorosamente uid, email, role, streakDays, totalMinutesRead e preferenciasLeitor
    const updatedProfile: UserProfile = stripUndefined({
      ...userProfile,
      uid: userProfile.uid,
      email: userProfile.email,
      role: userProfile.role,
      streakDays: userProfile.streakDays || 0,
      totalMinutesRead: userProfile.totalMinutesRead || 0,
      nome: cleanDisplayName,
      displayName: cleanDisplayName,
      username: normalizedUsername,
      usernameChangeHistory: nextUsernameChangeHistory,
      bio: cleanBio,
      foto: cleanPhotoURL,
      photoURL: cleanPhotoURL,
      favoriteBooks: cleanFavoriteBooks,
      updatedAt: nowIso,
    });

    // 3. Persistir no Firestore (/usernames/{username} e /users/{uid})
    if (firebaseUser) {
      try {
        await setDoc(usernameRef, {
          uid: targetUid,
          username: normalizedUsername,
          updatedAt: nowIso,
        });

        if (previousUsername && previousUsername !== normalizedUsername) {
          deleteDoc(doc(db, 'usernames', previousUsername)).catch(() => {});
        }
      } catch (err: unknown) {
        // Se a regra do Firestore rejeitou a escrita em /usernames por já pertencer a outro uid
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
          throw new Error(
            `O nome de usuário @${normalizedUsername} já está reservado por outro leitor.`
          );
        }
      }

      try {
        await setDoc(
          doc(db, 'users', targetUid),
          {
            uid: updatedProfile.uid,
            nome: updatedProfile.nome,
            displayName: updatedProfile.displayName,
            username: updatedProfile.username,
            usernameChangeHistory: nextUsernameChangeHistory,
            bio: updatedProfile.bio,
            foto: updatedProfile.foto,
            photoURL: updatedProfile.photoURL,
            favoriteBooks: cleanFavoriteBooks,
            updatedAt: updatedProfile.updatedAt,
          },
          { merge: true }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
        throw new Error(
          'Não foi possível salvar as alterações no servidor. Tente novamente.'
        );
      }
    } else {
      // Sessão direta local/fallback: tenta sincronizar caso permitido
      setDoc(doc(db, 'users', targetUid), updatedProfile, {
        merge: true,
      }).catch(() => {});
    }

    // 4. Atualizar estado local, perfil público da comunidade e sessão persistente
    const updatedPubProfile: PublicProfile = stripUndefined({
      uid: targetUid,
      displayName: cleanDisplayName,
      username: normalizedUsername,
      bio: cleanBio,
      photoURL: cleanPhotoURL,
      premium: Boolean(userProfile.premium),
      usernameColor: userProfile.usernameColor,
      profileCustomization: userProfile.profileCustomization,
      favoriteBooks: cleanFavoriteBooks,
      profileFavoriteBooks: cleanFavoriteBooks,
      updatedAt: nowIso,
    });
    setPublicProfilesMap((prev) => ({
      ...prev,
      [targetUid]: updatedPubProfile,
    }));
    if (firebaseUser) {
      setDoc(
        doc(db, 'public_profiles', targetUid),
        stripUndefined(updatedPubProfile),
        { merge: true }
      ).catch(() => {});
    }

    saveLocalUsernameOwner(normalizedUsername, targetUid, previousUsername);
    saveSessionProfile(updatedProfile);
    setUserProfile(updatedProfile);
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.uid === targetUid ? updatedProfile : u))
    );
  };

  const handleSaveProfileCustomization = async (
    customization: ProfileCustomization
  ): Promise<void> => {
    if (!userProfile) return;
    const targetUid = firebaseUser?.uid || userProfile.uid;
    const nowIso = new Date().toISOString();

    const rawUsernameColor =
      customization.usernameColor !== undefined
        ? customization.usernameColor
        : userProfile.usernameColor;
    const cleanUsernameColor = isValidHexColor(rawUsernameColor)
      ? rawUsernameColor!.trim()
      : undefined;

    const cleanCustomization: ProfileCustomization = stripUndefined({
      background: customization.background,
      banner: customization.banner,
      effects: customization.effects || 'none',
      theme: customization.theme || 'default',
      usernameColor: cleanUsernameColor,
      updatedAt: nowIso,
    });

    // Preserves strictly uid, email, role, nome, displayName, username, bio, foto, photoURL, streakDays, totalMinutesRead, preferenciasLeitor
    const updatedProfile: UserProfile = stripUndefined({
      ...userProfile,
      uid: userProfile.uid,
      usernameColor: cleanUsernameColor,
      profileCustomization: cleanCustomization,
      updatedAt: nowIso,
    });

    if (firebaseUser) {
      try {
        await setDoc(
          doc(db, 'users', targetUid),
          stripUndefined({
            uid: targetUid,
            usernameColor: cleanUsernameColor || '',
            profileCustomization: cleanCustomization,
            updatedAt: nowIso,
          }),
          { merge: true }
        );
        // Also persist under users/{uid}/profileCustomization/main as requested
        setDoc(
          doc(db, 'users', targetUid, 'profileCustomization', 'main'),
          cleanCustomization,
          { merge: true }
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `users/${targetUid}`
        );
        throw new Error(
          'Não foi possível salvar a personalização no servidor. Tente novamente.'
        );
      }
    } else {
      setDoc(
        doc(db, 'users', targetUid),
        stripUndefined({
          uid: targetUid,
          usernameColor: cleanUsernameColor || '',
          profileCustomization: cleanCustomization,
          updatedAt: nowIso,
        }),
        { merge: true }
      ).catch(() => {});
    }

    const displayName =
      updatedProfile.displayName || updatedProfile.nome || 'Leitor LIVROFLIX';
    const username = (
      updatedProfile.username || generateDefaultUsername(updatedProfile)
    )
      .replace(/^@+/, '')
      .toLowerCase();
    const photoURL = updatedProfile.photoURL ?? updatedProfile.foto ?? '';
    const bio = updatedProfile.bio || '';

    const updatedPubProfile: PublicProfile = stripUndefined({
      uid: targetUid,
      displayName,
      username,
      bio,
      photoURL,
      premium: Boolean(updatedProfile.premium),
      usernameColor: cleanUsernameColor,
      profileCustomization: cleanCustomization,
      favoriteBooks: updatedProfile.favoriteBooks,
      profileFavoriteBooks:
        updatedProfile.profileFavoriteBooks ?? updatedProfile.favoriteBooks,
      updatedAt: nowIso,
    });

    setPublicProfilesMap((prev) => ({
      ...prev,
      [targetUid]: updatedPubProfile,
    }));

    if (firebaseUser) {
      setDoc(
        doc(db, 'public_profiles', targetUid),
        stripUndefined(updatedPubProfile),
        { merge: true }
      ).catch(() => {});
    }

    saveSessionProfile(updatedProfile);
    setUserProfile(updatedProfile);
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.uid === targetUid ? updatedProfile : u))
    );
  };

  const handleTogglePremiumSubscription = async (
    activate: boolean
  ): Promise<void> => {
    if (!userProfile) return;
    const targetUid = firebaseUser?.uid || userProfile.uid;
    const nowIso = new Date().toISOString();

    // Preserva todas as personalizações, cor do nome e até 5 livros favoritos salvos no banco,
    // mesmo quando a assinatura é encerrada (activate === false).
    const updatedProfile: UserProfile = stripUndefined({
      ...userProfile,
      uid: userProfile.uid,
      premium: activate,
      premiumPlan: 'mensal_11',
      premiumStatus: activate ? 'active' : 'canceled',
      premiumUpdatedAt: nowIso,
      updatedAt: nowIso,
    });

    saveSessionProfile(updatedProfile);
    setUserProfile(updatedProfile);
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.uid === targetUid ? updatedProfile : u))
    );

    const displayName =
      updatedProfile.displayName || updatedProfile.nome || 'Leitor LIVROFLIX';
    const username = (
      updatedProfile.username || generateDefaultUsername(updatedProfile)
    )
      .replace(/^@+/, '')
      .toLowerCase();
    const photoURL = updatedProfile.photoURL ?? updatedProfile.foto ?? '';
    const bio = updatedProfile.bio || '';

    const updatedPubProfile: PublicProfile = stripUndefined({
      uid: targetUid,
      displayName,
      username,
      bio,
      photoURL,
      premium: activate,
      usernameColor: updatedProfile.usernameColor,
      profileCustomization: updatedProfile.profileCustomization,
      favoriteBooks: updatedProfile.favoriteBooks,
      profileFavoriteBooks:
        updatedProfile.profileFavoriteBooks ?? updatedProfile.favoriteBooks,
      unlockedBadges: updatedProfile.unlockedBadges,
      profileBadges: updatedProfile.profileBadges,
      updatedAt: nowIso,
    });

    setPublicProfilesMap((prev) => ({
      ...prev,
      [targetUid]: updatedPubProfile,
    }));

    if (firebaseUser) {
      try {
        await setDoc(
          doc(db, 'users', targetUid),
          {
            uid: targetUid,
            premium: activate,
            premiumPlan: 'mensal_11',
            premiumStatus: activate ? 'active' : 'canceled',
            premiumUpdatedAt: nowIso,
            updatedAt: nowIso,
          },
          { merge: true }
        );
        setDoc(
          doc(db, 'public_profiles', targetUid),
          stripUndefined(updatedPubProfile),
          { merge: true }
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `users/${targetUid}`
        );
        throw new Error(
          'Não foi possível atualizar sua assinatura Premium agora. Tente novamente.'
        );
      }
    } else {
      setDoc(
        doc(db, 'users', targetUid),
        {
          uid: targetUid,
          premium: activate,
          premiumPlan: 'mensal_11',
          premiumStatus: activate ? 'active' : 'canceled',
          premiumUpdatedAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});
    }
  };

  // ===============================================================
  // Community Handlers (Posts, Likes, Replies, Follows, Notifications, Moderation)
  // ===============================================================
  const resolveUidByUsername = async (
    usernameInput: string
  ): Promise<string | null> => {
    const normalized = usernameInput.replace(/^@+/, '').toLowerCase().trim();
    if (!normalized) return null;

    // 1. Check publicProfilesMap
    const foundPublic = Object.values(publicProfilesMap).find(
      (p) => (p.username || '').replace(/^@+/, '').toLowerCase() === normalized
    );
    if (foundPublic?.uid) return foundPublic.uid;

    // 2. Check registeredUsers in memory
    const foundReg = registeredUsers.find(
      (u) => (u.username || '').replace(/^@+/, '').toLowerCase() === normalized
    );
    if (foundReg?.uid) return foundReg.uid;

    // 3. Check local usernames registry
    const localMap = getLocalUsernamesRegistry();
    if (localMap[normalized]) return localMap[normalized];

    // 4. Query /usernames/{normalized} in Firestore
    try {
      const snap = await getDoc(doc(db, 'usernames', normalized));
      if (snap.exists()) {
        const data = snap.data() as { uid?: string };
        if (data?.uid) return data.uid;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const handleRefreshCommunityFeed = async (): Promise<void> => {
    try {
      const snap = await getDocs(collection(db, 'community_posts'));
      const remoteList: CommunityPost[] = [];
      const remoteIds = new Set<string>();
      snap.forEach((d) => {
        const data = d.data() as CommunityPost;
        const id = data.id || d.id;
        if (id && !remoteIds.has(id)) {
          remoteIds.add(id);
          remoteList.push({ ...data, id });
        }
      });
      setCommunityPosts((prev) => {
        const mergedMap = new Map<string, CommunityPost>();
        remoteList.forEach((p) => mergedMap.set(p.id, p));
        if (!firebaseUser) {
          prev.forEach((p) => {
            if (!mergedMap.has(p.id)) mergedMap.set(p.id, p);
          });
        }
        return Array.from(mergedMap.values()).sort((a, b) =>
          (b.createdAt || '').localeCompare(a.createdAt || '')
        );
      });
    } catch {
      // Offline or snapshot already active
    }
  };

  const handleCreateCommunityPost = async (
    input: CreatePostInput
  ): Promise<void> => {
    if (!userProfile || !activeUserId) {
      throw new Error('Faça login na sua conta para publicar na Comunidade.');
    }

    const cleanText = input.text.trim();
    if (cleanText.length > POST_MAX_LENGTH) {
      throw new Error(
        `A publicação não pode ultrapassar ${POST_MAX_LENGTH} caracteres.`
      );
    }

    const hasImage = Boolean(input.imageUrl && input.imageUrl.trim());
    const hasBook = Boolean(input.bookId && input.bookId.trim());
    if (cleanText.length === 0 && !hasImage && !hasBook) {
      throw new Error(
        'Escreva um texto, adicione uma imagem ou vincule um livro para publicar.'
      );
    }

    const nowIso = new Date().toISOString();
    const postId = `post_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const authorName =
      userProfile.displayName || userProfile.nome || 'Leitor LIVROFLIX';
    const authorUsername = (
      userProfile.username || generateDefaultUsername(userProfile)
    )
      .replace(/^@+/, '')
      .toLowerCase();
    const authorPhotoURL = userProfile.photoURL ?? userProfile.foto ?? '';
    const mentions = extractMentionsFromText(cleanText);

    const newPost: CommunityPost = stripUndefined({
      id: postId,
      authorId: activeUserId,
      authorName,
      authorUsername,
      authorPhotoURL,
      text: cleanText,
      imageUrl: hasImage ? input.imageUrl : undefined,
      bookId: hasBook ? input.bookId : undefined,
      mentions,
      createdAt: nowIso,
    });

    setCommunityPosts((prev) => [
      newPost,
      ...prev.filter((p) => p.id !== postId),
    ]);

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'community_posts', postId), newPost);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `community_posts/${postId}`
        );
        throw new Error('Não foi possível salvar sua publicação. Tente novamente.');
      }

      // Send notifications for @username mentions
      for (const mentionedUsername of mentions) {
        const targetUid = await resolveUidByUsername(mentionedUsername);
        if (targetUid && targetUid !== activeUserId) {
          const notifId = `notif_mention_${postId}_${targetUid}`;
          const notif: CommunityNotification = stripUndefined({
            id: notifId,
            recipientId: targetUid,
            actorId: activeUserId,
            actorName: authorName,
            actorUsername: authorUsername,
            actorPhotoURL: authorPhotoURL,
            type: 'mention',
            postId,
            postSnippet: cleanText.slice(0, 120),
            read: false,
            createdAt: nowIso,
          });
          setDoc(doc(db, 'community_notifications', notifId), notif).catch(
            () => {}
          );
        }
      }
    }
  };

  const handleDeleteCommunityPost = async (postId: string): Promise<void> => {
    if (!activeUserId) return;
    const targetPost = communityPosts.find((p) => p.id === postId);
    if (!targetPost) return;
    if (targetPost.authorId !== activeUserId && !isAdmin) {
      throw new Error('Você só pode excluir suas próprias publicações.');
    }

    setCommunityPosts((prev) => prev.filter((p) => p.id !== postId));
    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'community_posts', postId));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `community_posts/${postId}`
        );
      }
    }
  };

  const handleToggleCommunityLike = async (
    post: CommunityPost
  ): Promise<void> => {
    if (!userProfile || !activeUserId) return;

    const likeId = `${post.id}_${activeUserId}`;
    const existingLike = communityLikes.find(
      (l) =>
        l.id === likeId || (l.postId === post.id && l.userId === activeUserId)
    );

    if (existingLike) {
      const targetId = existingLike.id || likeId;
      setCommunityLikes((prev) => prev.filter((l) => l.id !== targetId));
      if (firebaseUser) {
        try {
          await deleteDoc(doc(db, 'community_likes', targetId));
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.DELETE,
            `community_likes/${targetId}`
          );
        }
      }
    } else {
      const nowIso = new Date().toISOString();
      const newLike: CommunityLike = {
        id: likeId,
        postId: post.id,
        postAuthorId: post.authorId,
        userId: activeUserId,
        createdAt: nowIso,
      };
      setCommunityLikes((prev) => [
        ...prev.filter((l) => l.id !== likeId),
        newLike,
      ]);

      if (firebaseUser) {
        try {
          await setDoc(doc(db, 'community_likes', likeId), newLike);
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `community_likes/${likeId}`
          );
        }

        if (post.authorId !== activeUserId) {
          const authorName =
            userProfile.displayName || userProfile.nome || 'Leitor LIVROFLIX';
          const authorUsername = (
            userProfile.username || generateDefaultUsername(userProfile)
          )
            .replace(/^@+/, '')
            .toLowerCase();
          const authorPhotoURL = userProfile.photoURL ?? userProfile.foto ?? '';
          const notifId = `notif_like_${post.id}_${activeUserId}`;
          const notif: CommunityNotification = stripUndefined({
            id: notifId,
            recipientId: post.authorId,
            actorId: activeUserId,
            actorName: authorName,
            actorUsername: authorUsername,
            actorPhotoURL: authorPhotoURL,
            type: 'like',
            postId: post.id,
            postSnippet: (post.text || '').slice(0, 120),
            read: false,
            createdAt: nowIso,
          });
          setDoc(doc(db, 'community_notifications', notifId), notif).catch(
            () => {}
          );
        }
      }
    }
  };

  const handleCreateCommunityReply = async (
    input: CreateReplyInput
  ): Promise<void> => {
    if (!userProfile || !activeUserId) {
      throw new Error('Faça login na sua conta para responder.');
    }

    const cleanText = input.text.trim();
    if (!cleanText) {
      throw new Error('Escreva uma resposta antes de enviar.');
    }
    if (cleanText.length > REPLY_MAX_LENGTH) {
      throw new Error(
        `A resposta não pode ultrapassar ${REPLY_MAX_LENGTH} caracteres.`
      );
    }

    const nowIso = new Date().toISOString();
    const replyId = `reply_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const authorName =
      userProfile.displayName || userProfile.nome || 'Leitor LIVROFLIX';
    const authorUsername = (
      userProfile.username || generateDefaultUsername(userProfile)
    )
      .replace(/^@+/, '')
      .toLowerCase();
    const authorPhotoURL = userProfile.photoURL ?? userProfile.foto ?? '';
    const mentions = extractMentionsFromText(cleanText);

    const newReply: CommunityReply = stripUndefined({
      id: replyId,
      postId: input.postId,
      postAuthorId: input.postAuthorId,
      authorId: activeUserId,
      authorName,
      authorUsername,
      authorPhotoURL,
      text: cleanText,
      parentReplyId: input.parentReplyId || undefined,
      replyToUsername: input.replyToUsername || undefined,
      mentions,
      createdAt: nowIso,
    });

    setCommunityReplies((prev) => [
      ...prev.filter((r) => r.id !== replyId),
      newReply,
    ]);

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'community_replies', replyId), newReply);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `community_replies/${replyId}`
        );
        throw new Error('Não foi possível enviar sua resposta.');
      }

      const notifiedRecipients = new Set<string>();

      // 1. Notify post author about the reply
      if (input.postAuthorId && input.postAuthorId !== activeUserId) {
        notifiedRecipients.add(input.postAuthorId);
        const notifId = `notif_reply_${replyId}_${input.postAuthorId}`;
        const notif: CommunityNotification = stripUndefined({
          id: notifId,
          recipientId: input.postAuthorId,
          actorId: activeUserId,
          actorName: authorName,
          actorUsername: authorUsername,
          actorPhotoURL: authorPhotoURL,
          type: 'reply',
          postId: input.postId,
          replyId,
          postSnippet: cleanText.slice(0, 120),
          read: false,
          createdAt: nowIso,
        });
        setDoc(doc(db, 'community_notifications', notifId), notif).catch(
          () => {}
        );
      }

      // 2. Notify mentioned users (@username) in the reply
      for (const mentionedUsername of mentions) {
        const targetUid = await resolveUidByUsername(mentionedUsername);
        if (
          targetUid &&
          targetUid !== activeUserId &&
          !notifiedRecipients.has(targetUid)
        ) {
          notifiedRecipients.add(targetUid);
          const notifId = `notif_mention_reply_${replyId}_${targetUid}`;
          const notif: CommunityNotification = stripUndefined({
            id: notifId,
            recipientId: targetUid,
            actorId: activeUserId,
            actorName: authorName,
            actorUsername: authorUsername,
            actorPhotoURL: authorPhotoURL,
            type: 'mention',
            postId: input.postId,
            replyId,
            postSnippet: cleanText.slice(0, 120),
            read: false,
            createdAt: nowIso,
          });
          setDoc(doc(db, 'community_notifications', notifId), notif).catch(
            () => {}
          );
        }
      }
    }
  };

  const handleDeleteCommunityReply = async (replyId: string): Promise<void> => {
    if (!activeUserId) return;
    const targetReply = communityReplies.find((r) => r.id === replyId);
    if (!targetReply) return;
    if (targetReply.authorId !== activeUserId && !isAdmin) {
      throw new Error('Você só pode excluir suas próprias respostas.');
    }

    setCommunityReplies((prev) => prev.filter((r) => r.id !== replyId));
    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'community_replies', replyId));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `community_replies/${replyId}`
        );
      }
    }
  };

  const handleToggleCommunityFollow = async (
    targetUserId: string
  ): Promise<void> => {
    if (!userProfile || !activeUserId) return;
    if (targetUserId === activeUserId) {
      throw new Error('Você não pode seguir a si mesmo.');
    }

    const followId = `${activeUserId}_${targetUserId}`;
    const existingFollow = communityFollows.find(
      (f) =>
        f.id === followId ||
        (f.followerId === activeUserId && f.followingId === targetUserId)
    );

    if (existingFollow) {
      const targetDocId = existingFollow.id || followId;
      setCommunityFollows((prev) => prev.filter((f) => f.id !== targetDocId));
      if (firebaseUser) {
        try {
          await deleteDoc(doc(db, 'community_follows', targetDocId));
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.DELETE,
            `community_follows/${targetDocId}`
          );
        }
      }
    } else {
      const nowIso = new Date().toISOString();
      const newFollow: CommunityFollow = {
        id: followId,
        followerId: activeUserId,
        followingId: targetUserId,
        createdAt: nowIso,
      };
      setCommunityFollows((prev) => [
        ...prev.filter((f) => f.id !== followId),
        newFollow,
      ]);

      if (firebaseUser) {
        try {
          await setDoc(doc(db, 'community_follows', followId), newFollow);
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `community_follows/${followId}`
          );
        }

        const authorName =
          userProfile.displayName || userProfile.nome || 'Leitor LIVROFLIX';
        const authorUsername = (
          userProfile.username || generateDefaultUsername(userProfile)
        )
          .replace(/^@+/, '')
          .toLowerCase();
        const authorPhotoURL = userProfile.photoURL ?? userProfile.foto ?? '';
        const notifId = `notif_follow_${activeUserId}_${targetUserId}`;
        const notif: CommunityNotification = stripUndefined({
          id: notifId,
          recipientId: targetUserId,
          actorId: activeUserId,
          actorName: authorName,
          actorUsername: authorUsername,
          actorPhotoURL: authorPhotoURL,
          type: 'follow',
          read: false,
          createdAt: nowIso,
        });
        setDoc(doc(db, 'community_notifications', notifId), notif).catch(
          () => {}
        );
      }
    }
  };

  const handleMarkCommunityNotificationsRead = async (): Promise<void> => {
    if (!activeUserId) return;
    const unread = communityNotifications.filter(
      (n) => n.recipientId === activeUserId && !n.read
    );
    if (unread.length === 0) return;

    setCommunityNotifications((prev) =>
      prev.map((n) =>
        n.recipientId === activeUserId ? { ...n, read: true } : n
      )
    );

    if (firebaseUser) {
      for (const notif of unread) {
        setDoc(
          doc(db, 'community_notifications', notif.id),
          { read: true },
          { merge: true }
        ).catch(() => {});
      }
    }
  };

  const handleSubmitCommunityReport = async (
    input: CreateReportInput
  ): Promise<void> => {
    if (!userProfile || !activeUserId) {
      throw new Error('Faça login para enviar uma denúncia.');
    }
    const cleanReason = input.reason.trim();
    if (!cleanReason) {
      throw new Error('Selecione um motivo para a denúncia.');
    }

    const nowIso = new Date().toISOString();
    const reportId = `report_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const newReport: CommunityReport = stripUndefined({
      id: reportId,
      reporterId: activeUserId,
      reporterName:
        userProfile.displayName || userProfile.nome || 'Leitor LIVROFLIX',
      reporterUsername: (userProfile.username || 'leitor')
        .replace(/^@+/, '')
        .toLowerCase(),
      targetType: input.targetType,
      targetPostId: input.targetPostId || undefined,
      targetReviewId: input.targetReviewId || undefined,
      targetBookId: input.targetBookId || undefined,
      targetUserId: input.targetUserId,
      targetUsername: input.targetUsername || undefined,
      reason: cleanReason.slice(0, 120),
      details: input.details ? input.details.trim().slice(0, 500) : undefined,
      status: 'pending',
      createdAt: nowIso,
    });

    if (isAdmin) {
      setCommunityReports((prev) => [newReport, ...prev]);
    }

    if (firebaseUser) {
      await setDoc(doc(db, 'community_reports', reportId), newReport);
    }
  };

  const handleResolveCommunityReport = async (
    reportId: string,
    status: 'reviewed' | 'dismissed'
  ): Promise<void> => {
    if (!isAdmin) return;
    setCommunityReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status } : r))
    );
    if (firebaseUser) {
      await setDoc(
        doc(db, 'community_reports', reportId),
        { status },
        { merge: true }
      );
    }
  };

  const unreadCommunityCount = useMemo(
    () =>
      communityNotifications.filter(
        (n) => n.recipientId === activeUserId && !n.read
      ).length,
    [communityNotifications, activeUserId]
  );

  const unreadMessagesCount = useMemo(() => {
    if (!activeUserId) return 0;
    return directConversations.reduce((acc, conv) => {
      const countForMe = Number(conv.unreadCounts?.[activeUserId] || 0);
      if (countForMe > 0) return acc + countForMe;
      if (
        Array.isArray(conv.unreadBy) &&
        conv.unreadBy.includes(activeUserId)
      ) {
        return acc + 1;
      }
      return acc;
    }, 0);
  }, [directConversations, activeUserId]);

  const handleOpenDirectMessages = (recipientUserId?: string) => {
    if (recipientUserId && recipientUserId !== activeUserId) {
      setDmInitialRecipientId(recipientUserId);
    } else {
      setDmInitialRecipientId(null);
    }
    setDmModalOpen(true);
  };

  const handleSaveBookReview = async (input: {
    bookId: string;
    text: string;
    rating?: number;
  }): Promise<void> => {
    if (!userProfile || !activeUserId) {
      throw new Error('Faça login na sua conta para escrever uma review.');
    }

    const cleanText = input.text.trim();
    if (cleanText.length < 1) {
      throw new Error('Escreva sua resenha antes de publicar.');
    }
    if (cleanText.length > 500) {
      throw new Error('A resenha pode ter no máximo 500 caracteres.');
    }

    const nowIso = new Date().toISOString();
    const existingReview = bookReviews.find(
      (r) => r.bookId === input.bookId && r.userId === activeUserId
    );
    const reviewId =
      existingReview?.id || `review_${input.bookId}_${activeUserId}`;

    const authorName = (
      userProfile.displayName ||
      userProfile.nome ||
      'Leitor LIVROFLIX'
    ).slice(0, 80);
    const authorUsername = (
      userProfile.username || generateDefaultUsername(userProfile)
    )
      .replace(/^@+/, '')
      .toLowerCase()
      .slice(0, 30);
    const authorPhoto = userProfile.photoURL ?? userProfile.foto ?? '';

    const reviewDoc: BookReview = stripUndefined({
      id: reviewId,
      bookId: input.bookId,
      userId: activeUserId,
      authorName,
      authorUsername,
      authorPhoto: authorPhoto || undefined,
      text: cleanText,
      rating:
        typeof input.rating === 'number' &&
        input.rating >= 0.5 &&
        input.rating <= 5
          ? input.rating
          : undefined,
      createdAt: existingReview?.createdAt || nowIso,
      updatedAt: existingReview ? nowIso : undefined,
    });

    setBookReviews((prev) => {
      const filtered = prev.filter(
        (r) =>
          r.id !== reviewId &&
          !(r.bookId === input.bookId && r.userId === activeUserId)
      );
      return [reviewDoc, ...filtered].sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
    });

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'book_reviews', reviewId), reviewDoc);
      } catch (error) {
        handleFirestoreError(
          error,
          existingReview ? OperationType.UPDATE : OperationType.CREATE,
          `book_reviews/${reviewId}`
        );
        throw new Error(
          'Não foi possível publicar sua review agora. Tente novamente.'
        );
      }
    } else {
      setDoc(doc(db, 'book_reviews', reviewId), reviewDoc).catch(() => {});
    }
  };

  const handleDeleteBookReview = async (reviewId: string): Promise<void> => {
    if (!userProfile || !activeUserId) return;
    const targetReview = bookReviews.find((r) => r.id === reviewId);
    if (!targetReview) return;
    if (targetReview.userId !== activeUserId && !isAdmin) {
      throw new Error('Você só pode excluir a sua própria review.');
    }

    setBookReviews((prev) => prev.filter((r) => r.id !== reviewId));

    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'book_reviews', reviewId));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `book_reviews/${reviewId}`
        );
      }
    } else {
      deleteDoc(doc(db, 'book_reviews', reviewId)).catch(() => {});
    }
  };

  // Navigation Handlers
  const openBookDetail = (book: Book) => {
    if (
      activeView !== 'livro-detalhe' &&
      activeView !== 'leitor' &&
      activeView !== 'leitor-pdf'
    ) {
      setPreviousView(activeView);
    }
    setScrollToReviewsOnDetail(false);
    setSelectedBookId(book.id);
    setActiveView('livro-detalhe');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openBookDetailWithReviews = (book: Book) => {
    if (
      activeView !== 'livro-detalhe' &&
      activeView !== 'leitor' &&
      activeView !== 'leitor-pdf'
    ) {
      setPreviousView(activeView);
    }
    setScrollToReviewsOnDetail(true);
    setSelectedBookId(book.id);
    setActiveView('livro-detalhe');
  };

  /**
   * Ao clicar em [ LER LIVRO ], abre diretamente o leitor de PDF interno (provisório),
   * sem precisar escolher opção no modal.
   */
  const openBookReader = (book: Book) => {
    handleSelectReadingFormat(book, 'pdf');
  };

  /**
   * Quando o leitor escolhe o formato (ex: format = "pdf") no modal "Como você quer ler?",
   * abre a rota/componente correspondente ao formato escolhido.
   */
  const handleSelectReadingFormat = (book: Book, format: ReadingFormat) => {
    if (
      activeView !== 'livro-detalhe' &&
      activeView !== 'leitor' &&
      activeView !== 'leitor-pdf'
    ) {
      setPreviousView(activeView);
    }
    setFormatModalBookId(null);
    setSelectedBookId(book.id);
    setSelectedReadingFormat(format);
    if (format === 'pdf') {
      setActiveView('leitor-pdf');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNavigate = (view: ActiveView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCategoryFromBox = (category: string) => {
    setSelectedCategory(category);
    setActiveView('categorias');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync document title & default reader preferences when platformSettings updates from Admin
  useEffect(() => {
    if (platformSettings.siteName) {
      document.title = platformSettings.siteName;
    }
    try {
      const hasCustomLocalPrefs = localStorage.getItem(LOCAL_STORAGE_PREFS_KEY);
      if (!hasCustomLocalPrefs && !userProfile?.preferenciasLeitor) {
        setReaderPrefs((prev) => ({
          ...prev,
          theme: platformSettings.defaultReaderTheme || prev.theme,
          fontSize: platformSettings.defaultReaderFontSize || prev.fontSize,
          fontFamily:
            platformSettings.defaultReaderFontFamily || prev.fontFamily,
        }));
      }
    } catch {
      // ignore
    }
  }, [
    platformSettings.siteName,
    platformSettings.defaultReaderTheme,
    platformSettings.defaultReaderFontSize,
    platformSettings.defaultReaderFontFamily,
    userProfile?.preferenciasLeitor,
  ]);

  // Admin Handlers — Exclusively allowed for Admin, persisted to Firestore for all users & visitors
  const handleAdminSaveBook = async (bookToSave: Book) => {
    const cleanedBook = stripUndefined({
      ...bookToSave,
      createdAt:
        bookToSave.createdAt ||
        resolveBookCreatedAtIso(bookToSave) ||
        new Date().toISOString(),
    });
    setBooks((prev) => {
      const exists = prev.some((b) => b.id === cleanedBook.id);
      const next = exists
        ? prev.map((b) => (b.id === cleanedBook.id ? cleanedBook : b))
        : [...prev, cleanedBook];
      return next.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
    });
    if (isAdmin) {
      try {
        await setDoc(doc(db, 'books', cleanedBook.id), cleanedBook);

        // Automatically sync any new book genres & Hero selection to platformSettings so all users and non-users see them everywhere
        const existingHeaderCats =
          platformSettings.headerCategories &&
          platformSettings.headerCategories.length > 0
            ? platformSettings.headerCategories
            : BOOK_CATEGORIES_LIST;
        const lowerSet = new Set(
          existingHeaderCats.map((c) => c.toLowerCase())
        );
        const newGenres = (cleanedBook.generos || []).filter(
          (g) => g && !lowerSet.has(g.toLowerCase())
        );

        let nextHeroIds = platformSettings.heroBookIds || [];
        let heroChanged = false;
        if (cleanedBook.destaque && nextHeroIds.length > 0 && !nextHeroIds.includes(cleanedBook.id)) {
          nextHeroIds = [...nextHeroIds, cleanedBook.id];
          heroChanged = true;
        } else if (!cleanedBook.destaque && nextHeroIds.includes(cleanedBook.id)) {
          nextHeroIds = nextHeroIds.filter((id) => id !== cleanedBook.id);
          heroChanged = true;
        }

        if (newGenres.length > 0 || heroChanged) {
          const updatedSettings: PlatformSettings = stripUndefined({
            ...platformSettings,
            headerCategories:
              newGenres.length > 0
                ? [...existingHeaderCats, ...newGenres]
                : existingHeaderCats,
            heroBookIds: nextHeroIds,
            updatedAt: new Date().toISOString(),
          });
          setPlatformSettings(updatedSettings);
          await setDoc(doc(db, 'settings', 'platform'), updatedSettings, {
            merge: true,
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `books/${cleanedBook.id}`);
      }
    }
  };

  const handleAdminDeleteBook = async (bookId: string) => {
    const targetBook = books.find((b) => b.id === bookId);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    if (isAdmin) {
      try {
        if (targetBook?.pdfUrl || targetBook?.pdfPath) {
          await deleteBookPdfFromStorage(bookId, targetBook.pdfPath).catch(
            () => {}
          );
        }
        await deleteDoc(doc(db, 'books', bookId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `books/${bookId}`);
      }
    }
  };

  const handleAdminToggleFeatured = async (book: Book) => {
    const updated: Book = { ...book, destaque: !book.destaque };
    await handleAdminSaveBook(updated);
  };

  const handleAdminMoveOrder = async (book: Book, direction: 'up' | 'down') => {
    const sorted = [...books].sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
    const idx = sorted.findIndex((b) => b.id === book.id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const currentOrder = sorted[idx].ordem || idx + 1;
    const neighborOrder = sorted[swapIdx].ordem || swapIdx + 1;

    const updatedCurrent = { ...sorted[idx], ordem: neighborOrder };
    const updatedNeighbor = { ...sorted[swapIdx], ordem: currentOrder };

    await handleAdminSaveBook(updatedCurrent);
    await handleAdminSaveBook(updatedNeighbor);
  };

  const handleAdminAddCategory = async (category: CustomCategory) => {
    const cleanedCategory = stripUndefined(category);
    setCustomCategories((prev) => [...prev, cleanedCategory]);
    if (isAdmin) {
      try {
        await setDoc(doc(db, 'categories', cleanedCategory.id), cleanedCategory);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `categories/${cleanedCategory.id}`
        );
      }
    }
  };

  const handleAdminDeleteCategory = async (categoryId: string) => {
    setCustomCategories((prev) => prev.filter((c) => c.id !== categoryId));
    if (isAdmin) {
      try {
        await deleteDoc(doc(db, 'categories', categoryId));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `categories/${categoryId}`
        );
      }
    }
  };

  const handleAdminSaveHomeRow = async (rowToSave: HomeRow) => {
    const cleanedRow = stripUndefined(rowToSave);
    const nextRows = (() => {
      const exists = homeRows.some((r) => r.id === cleanedRow.id);
      const next = exists
        ? homeRows.map((r) => (r.id === cleanedRow.id ? cleanedRow : r))
        : [...homeRows, cleanedRow];
      return next.sort((a, b) => a.ordem - b.ordem);
    })();
    setHomeRows(nextRows);

    if (isAdmin) {
      try {
        await setDoc(doc(db, 'home_rows', cleanedRow.id), cleanedRow);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `home_rows/${cleanedRow.id}`
        );
      }
    }
  };

  const handleAdminDeleteHomeRow = async (rowId: string) => {
    setHomeRows((prev) => prev.filter((r) => r.id !== rowId));
    if (isAdmin) {
      try {
        await deleteDoc(doc(db, 'home_rows', rowId));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `home_rows/${rowId}`
        );
      }
    }
  };

  const handleAdminSavePlatformSettings = async (
    nextSettings: PlatformSettings
  ) => {
    const cleanedSettings = stripUndefined(nextSettings);
    setPlatformSettings(cleanedSettings);
    if (isAdmin) {
      try {
        await setDoc(doc(db, 'settings', 'platform'), cleanedSettings, {
          merge: true,
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          'settings/platform'
        );
      }
    }
  };

  const handleAdminUpdateUserProfile = async (updatedUser: UserProfile) => {
    const cleanedUser = stripUndefined(updatedUser);
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.uid === cleanedUser.uid ? cleanedUser : u))
    );
    if (userProfile?.uid === cleanedUser.uid) {
      saveSessionProfile(cleanedUser);
      setUserProfile(cleanedUser);
    }
    if (isAdmin) {
      try {
        await setDoc(doc(db, 'users', cleanedUser.uid), cleanedUser, {
          merge: true,
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `users/${cleanedUser.uid}`
        );
      }
    }
  };

  const handleAdminDeleteUserProfile = async (uid: string) => {
    setRegisteredUsers((prev) => prev.filter((u) => u.uid !== uid));
    if (isAdmin) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  // Computed Real Catalog Shelves
  const activeBooks = useMemo(
    () => books.filter((b) => b.status === 'ativo'),
    [books]
  );

  // Featured carousel books (combines platformSettings.heroBookIds and books marked with book.destaque)
  const featuredBooks = useMemo(() => {
    const manualHero = (platformSettings.heroBookIds || [])
      .map((id) => activeBooks.find((b) => b.id === id))
      .filter((b): b is Book => Boolean(b));

    const highlighted = activeBooks.filter(
      (b) => b.destaque && !manualHero.some((m) => m.id === b.id)
    );

    const combinedFeatured = [...manualHero, ...highlighted];
    if (combinedFeatured.length > 0) {
      return combinedFeatured.slice(0, 10);
    }

    return activeBooks.slice(0, 10);
  }, [activeBooks, platformSettings.heroBookIds]);

  // Rotate Hero automatically when on Home
  useEffect(() => {
    if (activeView !== 'home' || featuredBooks.length <= 1) return;
    const rotateMs =
      Math.max(3, platformSettings.heroAutoRotateSeconds || 9) * 1000;
    const interval = setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % featuredBooks.length);
    }, rotateMs);
    return () => clearInterval(interval);
  }, [
    activeView,
    featuredBooks.length,
    platformSettings.heroAutoRotateSeconds,
  ]);

  // Continue Reading list (only real books that exist in activeBooks)
  const continueReadingBooks = useMemo(() => {
    return activeBooks
      .filter((b) => {
        const item = userLibrary[b.id];
        return (
          item &&
          (item.status === 'lendo' || (item.progresso > 0 && item.progresso < 100))
        );
      })
      .sort((a, b) => {
        const timeA = userLibrary[a.id]?.ultimoAcesso || '';
        const timeB = userLibrary[b.id]?.ultimoAcesso || '';
        return timeB.localeCompare(timeA);
      });
  }, [activeBooks, userLibrary]);

  const activeBookIdsSet = useMemo(
    () => new Set(activeBooks.map((b) => b.id)),
    [activeBooks]
  );

  const myListCount = useMemo(
    () =>
      Object.values(userLibrary).filter(
        (i) =>
          activeBookIdsSet.has(i.bookId) &&
          (i.inMyList || i.isFavorite || i.status !== 'nenhum')
      ).length,
    [userLibrary, activeBookIdsSet]
  );

  const downloadsCount = 0;

  // Personalized Recommendations Engine based on real user library
  const personalizedRecommendationShelf = useMemo(() => {
    const genreScores: Record<string, number> = {};

    Object.values(userLibrary).forEach((item) => {
      if (item.progresso > 0 || item.isFavorite || item.inMyList) {
        const b = activeBooks.find((book) => book.id === item.bookId);
        if (b) {
          b.generos.forEach((g) => {
            genreScores[g] = (genreScores[g] || 0) + (item.isFavorite ? 3 : 2);
          });
        }
      }
    });

    const topGenre =
      Object.entries(genreScores).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    const recommended = topGenre
      ? activeBooks.filter((b) => b.generos.includes(topGenre))
      : [];

    return {
      topGenre,
      books: recommended.length > 0 ? recommended : activeBooks.slice(0, 10),
    };
  }, [activeBooks, userLibrary]);

  // Top 10 Books (supports both auto by real leiturasCount and manual list from platformSettings)
  const top10Books = useMemo(() => {
    if (
      platformSettings.top10Mode === 'manual' &&
      platformSettings.top10BookIds &&
      platformSettings.top10BookIds.length > 0
    ) {
      const manualList = platformSettings.top10BookIds
        .map((id) => activeBooks.find((b) => b.id === id))
        .filter((b): b is Book => Boolean(b));
      if (manualList.length > 0) return manualList.slice(0, 10);
    }
    return [...activeBooks]
      .sort((a, b) => (b.leiturasCount || 0) - (a.leiturasCount || 0))
      .slice(0, 10);
  }, [
    activeBooks,
    platformSettings.top10Mode,
    platformSettings.top10BookIds,
  ]);

  // Resolve books for any dynamic HomeRow
  const getBooksForHomeRow = (row: HomeRow): Book[] => {
    if (row.bookIds && row.bookIds.length > 0 && row.tipo === 'manual') {
      return row.bookIds
        .map((id) => activeBooks.find((b) => b.id === id))
        .filter((b): b is Book => Boolean(b));
    }

    switch (row.tipo) {
      case 'top10':
        return top10Books;
      case 'em_alta':
        return [...activeBooks].sort(
          (a, b) => (b.leiturasCount || 0) - (a.leiturasCount || 0)
        );
      case 'para_voce':
        return personalizedRecommendationShelf.books;
      case 'bem_avaliados':
        return [...activeBooks].sort((a, b) => b.avaliacao - a.avaliacao);
      case 'recentes':
        return [...activeBooks].reverse().slice(0, 10);
      case 'genero': {
        const targetGenre = (row.generoFiltro || row.titulo).toLowerCase();
        return activeBooks.filter((b) =>
          b.generos.some((g) => g.toLowerCase() === targetGenre)
        );
      }
      default:
        return activeBooks;
    }
  };

  const activeHomeRows = useMemo(
    () =>
      [...homeRows]
        .filter((r) => {
          if (r.ativo === false) return false;
          if (r.tipo === 'top10' && platformSettings.showTop10 === false) {
            return false;
          }
          return true;
        })
        .sort((a, b) => a.ordem - b.ordem),
    [homeRows, platformSettings.showTop10]
  );

  // Header & Categories Box List (dynamic from platformSettings + customCategories + all genres from activeBooks)
  const effectiveCategoriesList = useMemo(() => {
    const base =
      platformSettings.headerCategories &&
      platformSettings.headerCategories.length > 0
        ? platformSettings.headerCategories
        : BOOK_CATEGORIES_LIST;

    const seen = new Set(base.map((c) => c.toLowerCase()));
    const result = [...base];

    customCategories.forEach((c) => {
      const g = (c.generoFiltro || c.titulo || '').trim();
      if (g && !seen.has(g.toLowerCase())) {
        seen.add(g.toLowerCase());
        result.push(g);
      }
    });

    activeBooks.forEach((b) => {
      (b.generos || []).forEach((g) => {
        const trimmed = g.trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
          seen.add(trimmed.toLowerCase());
          result.push(trimmed);
        }
      });
    });

    return result;
  }, [platformSettings.headerCategories, customCategories, activeBooks]);

  // Extra genre shelves on Home for any book genre added in Admin that doesn't already have an explicit HomeRow or CustomCategory
  const extraBookGenreShelves = useMemo(() => {
    const coveredGenres = new Set<string>();
    activeHomeRows.forEach((r) => {
      if (r.tipo === 'genero') {
        coveredGenres.add((r.generoFiltro || r.titulo).trim().toLowerCase());
      }
    });
    customCategories.forEach((c) => {
      coveredGenres.add((c.generoFiltro || c.titulo).trim().toLowerCase());
    });

    const dynamicGenres: string[] = [];
    activeBooks.forEach((b) => {
      (b.generos || []).forEach((g) => {
        const trimmed = g.trim();
        if (
          trimmed &&
          !coveredGenres.has(trimmed.toLowerCase()) &&
          !dynamicGenres.some((dg) => dg.toLowerCase() === trimmed.toLowerCase())
        ) {
          dynamicGenres.push(trimmed);
        }
      });
    });

    return dynamicGenres.map((genre) => ({
      genre,
      books: activeBooks.filter((b) =>
        b.generos.some((g) => g.toLowerCase() === genre.toLowerCase())
      ),
    }));
  }, [activeHomeRows, customCategories, activeBooks]);

  // Books filtered by the category selected in the Categories Box
  const selectedCategoryBooks = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'Em alta') {
      return [...activeBooks].sort(
        (a, b) => (b.leiturasCount || 0) - (a.leiturasCount || 0)
      );
    }
    return activeBooks.filter((b) =>
      b.generos.some((g) => g.toLowerCase() === selectedCategory.toLowerCase())
    );
  }, [activeBooks, selectedCategory]);

  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) || books[0] || null,
    [books, selectedBookId]
  );

  const formatModalBook = useMemo(
    () =>
      formatModalBookId
        ? books.find((b) => b.id === formatModalBookId) || null
        : null,
    [books, formatModalBookId]
  );

  // Rota do Leitor de PDF interno do LIVROFLIX (format = "pdf")
  if (activeView === 'leitor-pdf' && selectedBook) {
    return (
      <PdfReaderView
        book={selectedBook}
        format={selectedReadingFormat}
        userItem={userLibrary[selectedBook.id]}
        onSaveProgress={handleSaveReadingProgress}
        onClose={() => {
          setActiveView('livro-detalhe');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  // Full-screen comfortable Reader
  if (activeView === 'leitor' && selectedBook) {
    return (
      <BookReader
        book={selectedBook}
        userItem={userLibrary[selectedBook.id]}
        preferences={readerPrefs}
        onUpdatePreferences={handleUpdateReaderPrefs}
        onSaveProgress={handleSaveReadingProgress}
        onClose={() => setActiveView(previousView)}
      />
    );
  }

  if (isCatalogLoading) {
    return (
      <div
        className="min-h-screen bg-[#040D1A] flex flex-col items-center justify-center gap-6 px-4 select-none"
        style={{
          backgroundColor: platformSettings.backgroundColor || '#040D1A',
        }}
      >
        <LivroflixLogo
          size="lg"
          logoImageUrl={platformSettings.logoImageUrl}
          logoText={platformSettings.logoText}
        />
        <div
          className="h-9 w-9 rounded-full border-3 border-blue-400/25 border-t-[#60A5FA] animate-spin"
          aria-label="Carregando"
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#040D1A] text-white flex flex-col justify-between"
      style={{
        backgroundColor: platformSettings.backgroundColor || '#040D1A',
      }}
    >
      {/* Global Streaming Header */}
      <Header
        activeView={activeView}
        selectedCategory={selectedCategory}
        onNavigate={handleNavigate}
        onSelectCategory={handleSelectCategoryFromBox}
        userProfile={userProfile}
        isAdmin={isAdmin}
        downloadsCount={downloadsCount}
        myListCount={myListCount}
        unreadCommunityCount={unreadCommunityCount}
        unreadMessagesCount={unreadMessagesCount}
        onOpenMessages={() => handleOpenDirectMessages()}
        categoriesList={effectiveCategoriesList}
        platformSettings={platformSettings}
        onOpenPremiumModal={() => setVipModalOpen(true)}
      />

      {/* Main Content View Router */}
      <main className="flex-1">
        {/* VIEW: COMUNIDADE LITERÁRIA */}
        {activeView === 'comunidade' && (
          <CommunityView
            books={activeBooks}
            posts={communityPosts}
            likes={communityLikes}
            replies={communityReplies}
            follows={communityFollows}
            notifications={communityNotifications}
            reports={communityReports}
            publicProfilesMap={publicProfilesMap}
            currentUserProfile={userProfile}
            isAuthenticated={Boolean(firebaseUser || userProfile)}
            isAdmin={isAdmin}
            unreadMessagesCount={unreadMessagesCount}
            onOpenMessages={handleOpenDirectMessages}
            onSelectBook={openBookDetail}
            onCreatePost={handleCreateCommunityPost}
            onDeletePost={handleDeleteCommunityPost}
            onToggleLike={handleToggleCommunityLike}
            onCreateReply={handleCreateCommunityReply}
            onDeleteReply={handleDeleteCommunityReply}
            onToggleFollow={handleToggleCommunityFollow}
            onMarkNotificationsRead={handleMarkCommunityNotificationsRead}
            onSubmitReport={handleSubmitCommunityReport}
            onResolveReport={handleResolveCommunityReport}
            onNavigateProfile={() => handleNavigate('perfil')}
            onRefreshFeed={handleRefreshCommunityFeed}
          />
        )}

        {/* VIEW: HOME INICIAL */}
        {activeView === 'home' && (
          <div className="pb-20">
            {activeBooks.length === 0 ? (
              <div className="min-h-[75vh] flex flex-col items-center justify-center gap-6 px-4 select-none">
                <LivroflixLogo
                  size="lg"
                  logoImageUrl={platformSettings.logoImageUrl}
                  logoText={platformSettings.logoText}
                />
                <div
                  className="h-9 w-9 rounded-full border-3 border-blue-400/25 border-t-[#60A5FA] animate-spin"
                  aria-label="Carregando"
                />
              </div>
            ) : (
              <>
                {/* HERO PRINCIPAL */}
                <HeroBanner
                  featuredBooks={featuredBooks}
                  activeHeroIndex={activeHeroIndex}
                  onSelectHeroIndex={setActiveHeroIndex}
                  onSelectBook={openBookDetail}
                  heroButtonText={platformSettings.heroButtonText}
                  platformSettings={platformSettings}
                />

                {/* CONTINUAR LENDO */}
                {continueReadingBooks.length > 0 && (
                  <div className="pt-2">
                    <BookRow
                      title={
                        platformSettings.continueReadingTitle || 'Continuar lendo'
                      }
                      books={continueReadingBooks}
                      onSelectBook={openBookDetail}
                      savedBookIds={[]}
                      onToggleSave={() => {}}
                    />
                  </div>
                )}

                {/* FILEIRAS HORIZONTAIS DINÂMICAS */}
                <div className="space-y-1 sm:space-y-3 pt-2">
                  {activeHomeRows.map((row) => (
                    <BookRow
                      key={row.id}
                      title={
                        row.tipo === 'top10' && platformSettings.top10Title
                          ? platformSettings.top10Title
                          : row.titulo
                      }
                      books={getBooksForHomeRow(row)}
                      onSelectBook={openBookDetail}
                      savedBookIds={[]}
                      onToggleSave={() => {}}
                      showRank={Boolean(row.showRank || row.tipo === 'top10')}
                      cardSize={row.cardSize || 'md'}
                    />
                  ))}

                  {customCategories.map((cat) => (
                    <BookRow
                      key={cat.id}
                      title={cat.titulo}
                      books={activeBooks.filter((b) =>
                        b.generos.some(
                          (g) =>
                            g.toLowerCase() === cat.generoFiltro.toLowerCase()
                        )
                      )}
                      onSelectBook={openBookDetail}
                      savedBookIds={[]}
                      onToggleSave={() => {}}
                    />
                  ))}

                  {extraBookGenreShelves.map((shelf) => (
                    <BookRow
                      key={`auto-genre-${shelf.genre}`}
                      title={shelf.genre}
                      books={shelf.books}
                      onSelectBook={openBookDetail}
                      savedBookIds={[]}
                      onToggleSave={() => {}}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* VIEW: CATEGORIA SELECIONADA */}
        {activeView === 'categorias' && (
          <div className="min-h-screen bg-[#040D1A] pt-28 lg:pt-24 pb-24">
            <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
              <div className="mb-8 pb-6 border-b border-blue-400/15">
                <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white">
                  {selectedCategory}
                </h1>
              </div>

              {selectedCategoryBooks.length === 0 ? (
                <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-12 text-center max-w-xl mx-auto my-8">
                  <BookOpen className="w-10 h-10 text-[#60A5FA] mx-auto mb-3 opacity-80" />
                  <h3 className="font-display text-2xl font-bold text-white">
                    Nenhum livro cadastrado em "{selectedCategory}"
                  </h3>
                  <p className="text-sm text-blue-200/75 mt-2">
                    Assim que livros reais forem adicionados a esta categoria, eles aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6 justify-items-center">
                  {selectedCategoryBooks.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onSelect={openBookDetail}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: PESQUISA */}
        {activeView === 'pesquisa' && (
          <SearchView
            books={books}
            userLibrary={userLibrary}
            onSelectBook={openBookDetail}
            onReadBook={openBookReader}
            onToggleList={handleToggleList}
            platformSettings={platformSettings}
            publicProfilesMap={publicProfilesMap}
            communityPosts={communityPosts}
            communityLikes={communityLikes}
            communityReplies={communityReplies}
            communityFollows={communityFollows}
            currentUserProfile={userProfile}
            isAuthenticated={Boolean(firebaseUser || userProfile)}
            isAdmin={isAdmin}
            onToggleFollow={handleToggleCommunityFollow}
            onOpenMessages={handleOpenDirectMessages}
            onToggleLike={handleToggleCommunityLike}
            onCreateReply={handleCreateCommunityReply}
            onDeletePost={handleDeleteCommunityPost}
            onDeleteReply={handleDeleteCommunityReply}
            onRequireAuth={() => handleNavigate('perfil')}
          />
        )}

        {/* VIEW: MINHA LISTA */}
        {activeView === 'minha-lista' && (
          <MyLibraryView
            books={books}
            userLibrary={userLibrary}
            userProfile={userProfile}
            bookReviews={bookReviews}
            initialTab="lista"
            onSelectBook={openBookDetail}
            onOpenBookReview={openBookDetailWithReviews}
            onReadBook={openBookReader}
            onChangeStatus={handleChangeStatus}
            onRemoveFromList={handleRemoveFromList}
            profileFavoriteBookIds={
              userProfile?.profileFavoriteBooks ??
              userProfile?.favoriteBooks ??
              []
            }
            onToggleProfileFavoriteBook={handleToggleProfileFavoriteBook}
            onOpenPremiumModal={() => setVipModalOpen(true)}
            platformSettings={platformSettings}
          />
        )}

        {/* VIEW: DOWNLOADS */}
        {activeView === 'downloads' && (
          <DownloadsView
            books={books}
            userLibrary={userLibrary}
            userProfile={userProfile}
            onSelectBook={openBookDetail}
            onReadBook={openBookReader}
            onToggleDownload={handleToggleDownload}
            onOpenPremiumModal={() => setVipModalOpen(true)}
            platformSettings={platformSettings}
          />
        )}

        {/* VIEW: CONTINUAR LENDO */}
        {activeView === 'continuar-lendo' && (
          <MyLibraryView
            books={books}
            userLibrary={userLibrary}
            userProfile={userProfile}
            bookReviews={bookReviews}
            initialTab="lendo"
            onSelectBook={openBookDetail}
            onOpenBookReview={openBookDetailWithReviews}
            onReadBook={openBookReader}
            onChangeStatus={handleChangeStatus}
            onRemoveFromList={handleRemoveFromList}
            onOpenPremiumModal={() => setVipModalOpen(true)}
            platformSettings={platformSettings}
          />
        )}

        {/* VIEW: PERFIL DO USUÁRIO */}
        {activeView === 'perfil' && (
          <ProfileView
            userProfile={userProfile}
            isAuthenticated={Boolean(firebaseUser || userProfile)}
            isAdmin={isAdmin}
            books={books}
            userLibrary={userLibrary}
            communityPosts={communityPosts}
            communityLikes={communityLikes}
            communityReplies={communityReplies}
            communityFollows={communityFollows}
            publicProfilesMap={publicProfilesMap}
            onSignIn={async () => {
              await signInWithGoogle();
            }}
            onDirectSignIn={handleDirectSignIn}
            onSignOut={() => {
              signOutUser();
              setUserProfile(null);
            }}
            onSelectBook={openBookDetail}
            onOpenAdmin={() => handleNavigate('admin')}
            onNavigateCommunity={() => handleNavigate('comunidade')}
            onUpdateOwnProfile={handleUpdateOwnProfile}
            onSaveProfileCustomization={handleSaveProfileCustomization}
            onToggleProfileBadge={handleToggleProfileBadge}
            onToggleCommunityLike={handleToggleCommunityLike}
            onCreateCommunityReply={handleCreateCommunityReply}
            onDeleteCommunityPost={handleDeleteCommunityPost}
            onDeleteCommunityReply={handleDeleteCommunityReply}
            onToggleCommunityFollow={handleToggleCommunityFollow}
            onOpenPremiumModal={() => setVipModalOpen(true)}
            platformSettings={platformSettings}
          />
        )}

        {/* VIEW: PÁGINA DO LIVRO */}
        {activeView === 'livro-detalhe' && selectedBook && (
          <BookDetailView
            book={selectedBook}
            allBooks={books}
            userLibrary={userLibrary}
            userProfile={userProfile}
            bookReviews={bookReviews}
            publicProfilesMap={publicProfilesMap}
            communityFollows={communityFollows}
            isAdmin={isAdmin}
            initialScrollToReviews={scrollToReviewsOnDetail}
            onClearScrollToReviews={() => setScrollToReviewsOnDetail(false)}
            onBack={() => handleNavigate(previousView)}
            onReadBook={openBookReader}
            onSelectBook={openBookDetail}
            onToggleList={handleToggleList}
            onToggleFavorite={handleToggleFavorite}
            onChangeStatus={handleChangeStatus}
            onRateBook={handleRateBook}
            onSaveBookReview={handleSaveBookReview}
            onDeleteBookReview={handleDeleteBookReview}
            onToggleCommunityFollow={handleToggleCommunityFollow}
            onOpenMessages={handleOpenDirectMessages}
            onSubmitReport={handleSubmitCommunityReport}
            onRequireAuth={() => handleNavigate('perfil')}
            onOpenPremiumModal={() => setVipModalOpen(true)}
            readButtonText={platformSettings.readButtonText}
            ratingPromptText={platformSettings.ratingPromptText}
            relatedBooksPrefix={platformSettings.relatedBooksPrefix}
          />
        )}

        {/* VIEW: ADMINISTRAÇÃO */}
        {activeView === 'admin' && isAdmin && (
          <AdminDashboard
            books={books}
            customCategories={customCategories}
            homeRows={homeRows}
            platformSettings={platformSettings}
            registeredUsers={
              registeredUsers.length > 0
                ? registeredUsers
                : userProfile
                ? [userProfile]
                : []
            }
            onSaveBook={handleAdminSaveBook}
            onDeleteBook={handleAdminDeleteBook}
            onToggleFeatured={handleAdminToggleFeatured}
            onMoveBookOrder={handleAdminMoveOrder}
            onAddCategory={handleAdminAddCategory}
            onDeleteCategory={handleAdminDeleteCategory}
            onSaveHomeRow={handleAdminSaveHomeRow}
            onDeleteHomeRow={handleAdminDeleteHomeRow}
            onSavePlatformSettings={handleAdminSavePlatformSettings}
            onUpdateUserProfile={handleAdminUpdateUserProfile}
            onDeleteUserProfile={handleAdminDeleteUserProfile}
          />
        )}
      </main>

      {/* Modal de Seleção de Formato de Leitura ("Como você quer ler?") */}
      <ReadingFormatModal
        book={formatModalBook}
        onClose={() => setFormatModalBookId(null)}
        onSelectFormat={handleSelectReadingFormat}
      />

      {/* Animação de Formação de Selo (Somente para conquistas COM selo recém-desbloqueadas) */}
      {badgeUnlockQueue.length > 0 && (
        <BadgeUnlockModal
          key={badgeUnlockQueue[0].id}
          achievement={badgeUnlockQueue[0]}
          isDisplayedOnProfile={Boolean(
            badgeUnlockQueue[0].badgeId &&
              userProfile?.profileBadges?.includes(badgeUnlockQueue[0].badgeId)
          )}
          onToggleDisplayOnProfile={handleToggleProfileBadge}
          onClose={() => setBadgeUnlockQueue((prev) => prev.slice(1))}
          customBadgeImages={platformSettings.badgeImages}
        />
      )}

      {/* Aviso discreto para conquistas SEM selo recém-concluídas */}
      {badgeUnlockQueue.length === 0 && commonAchievementQueue.length > 0 && (
        <CommonAchievementUnlockedBanner
          key={commonAchievementQueue[0].id}
          achievement={commonAchievementQueue[0]}
          onClose={() => setCommonAchievementQueue((prev) => prev.slice(1))}
        />
      )}

      {/* LIVROFLIX Premium Modal (R$ 11,00 / mês) */}
      <PremiumModal
        isOpen={vipModalOpen}
        userProfile={userProfile}
        isAuthenticated={Boolean(firebaseUser || userProfile)}
        onClose={() => setVipModalOpen(false)}
        onToggleSubscription={handleTogglePremiumSubscription}
        onOpenLogin={() => {
          setVipModalOpen(false);
          handleNavigate('perfil');
        }}
        onOpenCustomization={() => {
          setVipModalOpen(false);
          handleNavigate('perfil');
        }}
      />

      {/* Mensagens Diretas (DM) Modal */}
      <DirectMessagesModal
        isOpen={dmModalOpen}
        onClose={() => {
          setDmModalOpen(false);
          setDmInitialRecipientId(null);
        }}
        currentUserProfile={userProfile}
        isAuthenticated={Boolean(firebaseUser || userProfile)}
        conversations={directConversations}
        publicProfilesMap={publicProfilesMap}
        follows={communityFollows}
        initialRecipientId={dmInitialRecipientId}
        onClearInitialRecipient={() => setDmInitialRecipientId(null)}
        onToggleFollow={handleToggleCommunityFollow}
        onRequireAuth={() => handleNavigate('perfil')}
      />

      {/* FOOTER */}
      <footer
        className="border-t border-blue-400/15 bg-[#020813] py-12"
        style={{
          backgroundColor: platformSettings.footerBackgroundColor || '#020813',
        }}
      >
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <LivroflixLogo
              size="sm"
              variant="dark-bg"
              logoImageUrl={platformSettings.logoImageUrl}
              logoText={platformSettings.logoText}
            />
            <p className="mt-2.5 text-xs text-blue-200/70 max-w-md">
              {platformSettings.footerDescription}
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-xs font-medium text-blue-200/75">
            <button
              type="button"
              onClick={() => handleNavigate('home')}
              className="hover:text-[#60A5FA] transition-colors cursor-pointer"
            >
              {platformSettings.navHomeText || 'Início'}
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('minha-lista')}
              className="hover:text-[#60A5FA] transition-colors cursor-pointer"
            >
              {platformSettings.navMyListText || 'Minha lista'}
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('comunidade')}
              className="hover:text-[#60A5FA] transition-colors cursor-pointer"
            >
              Comunidade
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
