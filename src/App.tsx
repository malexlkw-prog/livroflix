import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
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
  OperationType,
  User,
} from './firebase';
import {
  ActiveView,
  Book,
  CustomCategory,
  HomeRow,
  PlatformSettings,
  ReaderPreferences,
  ReadingFormat,
  ReadingStatus,
  UserBookItem,
  UserProfile,
} from './types';
import {
  LEGACY_AUTO_BOOK_IDS,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_HOME_ROWS,
} from './data/catalog';
import { Header, BOOK_CATEGORIES_LIST } from './components/Header';
import { LivroflixLogo } from './components/LivroflixLogo';
import { HeroBanner } from './components/HeroBanner';
import { BookCard } from './components/BookCard';
import { BookRow } from './components/BookRow';
import { BookDetailView } from './components/BookDetailView';
import { BookReader } from './components/BookReader';
import { ReadingFormatModal } from './components/ReadingFormatModal';
import { PdfReaderView } from './components/PdfReaderView';
import { SearchView } from './components/ExploreAndSearch';
import {
  MyLibraryView,
  ProfileView,
  DownloadsView,
} from './components/MyLibraryAndProfile';
import { AdminDashboard } from './components/AdminDashboard';

const DEFAULT_READER_PREFS: ReaderPreferences = {
  fontSize: 20,
  fontFamily: 'editorial',
  lineHeight: 1.85,
  maxWidth: 'comfortable',
  theme: 'dark',
};

const LOCAL_STORAGE_LIB_KEY = 'livroflix_user_library_v1';
const LOCAL_STORAGE_PREFS_KEY = 'livroflix_reader_prefs_v1';
const LEGACY_AUTO_SET = new Set(LEGACY_AUTO_BOOK_IDS);

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
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [homeRows, setHomeRows] = useState<HomeRow[]>(DEFAULT_HOME_ROWS);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(
    DEFAULT_PLATFORM_SETTINGS
  );
  const cleanupExecutedRef = useRef<boolean>(false);

  // Auth & Isolated Real User State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
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
      userProfile?.role === 'admin'
  );

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

            const updatedProfile: UserProfile = {
              ...existingData,
              uid: user.uid,
              nome:
                existingData.nome ||
                user.displayName ||
                user.email?.split('@')[0] ||
                'Leitor LIVROFLIX',
              email: user.email || existingData.email || '',
              foto: existingData.foto || user.photoURL || '',
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
              updatedAt: new Date().toISOString(),
            };
            setUserProfile(updatedProfile);
            if (existingData.preferenciasLeitor) {
              setReaderPrefs(existingData.preferenciasLeitor);
            }
            await setDoc(userRef, updatedProfile, { merge: true });
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              nome:
                user.displayName ||
                user.email?.split('@')[0] ||
                'Leitor LIVROFLIX',
              email: user.email || '',
              foto: user.photoURL || '',
              role: isOwnerAdmin ? 'admin' : 'user',
              streakDays: 0,
              totalMinutesRead: 0,
              preferenciasLeitor: readerPrefs,
              updatedAt: new Date().toISOString(),
            };
            setUserProfile(newProfile);
            await setDoc(userRef, newProfile, { merge: true });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        setUserProfile(null);
        try {
          const saved = localStorage.getItem(LOCAL_STORAGE_LIB_KEY);
          setUserLibrary(saved ? sanitizeLibraryRecord(JSON.parse(saved)) : {});
        } catch {
          setUserLibrary({});
        }
      }
    });
    return () => unsubscribe();
  }, []);

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
    const unsubscribe = onSnapshot(
      collection(db, 'books'),
      (snapshot) => {
        const realBooks: Book[] = [];
        snapshot.forEach((docSnap) => {
          if (!LEGACY_AUTO_SET.has(docSnap.id)) {
            realBooks.push(docSnap.data() as Book);
          }
        });
        realBooks.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        setBooks(realBooks);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'books');
      }
    );
    return () => unsubscribe();
  }, []);

  // 5. Purge Legacy Auto-Created Books from Firestore (/books) when Admin is authenticated
  useEffect(() => {
    if (!isAdmin || !firebaseUser || cleanupExecutedRef.current) return;
    cleanupExecutedRef.current = true;

    const purgeAutoCreatedBooksAndSeedStructure = async () => {
      try {
        // Delete any legacy auto-seeded books from /books in Firestore
        const booksSnap = await getDocs(collection(db, 'books'));
        for (const docSnap of booksSnap.docs) {
          if (LEGACY_AUTO_SET.has(docSnap.id)) {
            await deleteDoc(doc(db, 'books', docSnap.id));
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
    if (!firebaseUser) return;
    const userId = firebaseUser.uid;
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
  }, [firebaseUser]);

  // 8. Load Registered Users for Admin Panel when user is Admin
  useEffect(() => {
    if (!isAdmin || !firebaseUser) return;
    getDocs(collection(db, 'users'))
      .then((snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => list.push(d.data() as UserProfile));
        setRegisteredUsers(list);
      })
      .catch((error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
  }, [isAdmin, firebaseUser, activeView]);

  // Helper to persist a single UserBookItem
  const saveUserBookItem = async (updatedItem: UserBookItem) => {
    const nextLibrary = {
      ...userLibrary,
      [updatedItem.bookId]: updatedItem,
    };
    setUserLibrary(nextLibrary);

    if (!firebaseUser) {
      try {
        localStorage.setItem(LOCAL_STORAGE_LIB_KEY, JSON.stringify(nextLibrary));
      } catch {
        // ignore
      }
      return;
    }

    const path = `users/${firebaseUser.uid}/library/${updatedItem.bookId}`;
    try {
      await setDoc(
        doc(db, 'users', firebaseUser.uid, 'library', updatedItem.bookId),
        stripUndefined({
          ...updatedItem,
          userId: firebaseUser.uid,
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
      userId: firebaseUser?.uid || 'local',
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

  // User Actions on Books
  const handleToggleList = (book: Book, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const current = getOrInitUserItem(book);
    const nextInList = !current.inMyList;

    saveUserBookItem({
      ...current,
      inMyList: nextInList,
      isFavorite: nextInList ? true : current.isFavorite,
      ultimoAcesso: new Date().toISOString(),
    });
  };

  const handleToggleFavorite = (book: Book) => {
    const current = getOrInitUserItem(book);
    const nextFav = !current.isFavorite;
    saveUserBookItem({
      ...current,
      isFavorite: nextFav,
      inMyList: nextFav ? true : current.inMyList,
      status: !nextFav && current.status === 'quero_ler' ? 'nenhum' : current.status,
      ultimoAcesso: new Date().toISOString(),
    });
  };

  const handleToggleDownload = (book: Book) => {
    const current = getOrInitUserItem(book);
    saveUserBookItem({
      ...current,
      isDownloaded: !current.isDownloaded,
      ultimoAcesso: new Date().toISOString(),
    });
  };

  const handleChangeStatus = (book: Book, status: ReadingStatus) => {
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
  };

  const handleSaveReadingProgress = (book: Book, paginaAtual: number) => {
    const current = getOrInitUserItem(book);
    const progresso = Math.min(
      100,
      Math.max(1, Math.round((paginaAtual / Math.max(1, book.paginas)) * 100))
    );
    const isFinished = paginaAtual >= book.paginas;
    const nextMinutes = (current.minutosLidos || 0) + 1;

    saveUserBookItem({
      ...current,
      inMyList: true,
      status: isFinished ? 'concluido' : 'lendo',
      paginaAtual,
      totalPaginas: book.paginas,
      progresso: isFinished ? 100 : progresso,
      minutosLidos: nextMinutes,
      ultimoAcesso: new Date().toISOString(),
    });

    // Update real user reading metrics in profile
    if (firebaseUser && userProfile) {
      const nextTotalMinutes = (userProfile.totalMinutesRead || 0) + 1;
      const nextStreak = Math.max(1, userProfile.streakDays || 0);
      const updatedProfile: UserProfile = {
        ...userProfile,
        totalMinutesRead: nextTotalMinutes,
        streakDays: nextStreak,
        updatedAt: new Date().toISOString(),
      };
      setUserProfile(updatedProfile);
      setDoc(doc(db, 'users', firebaseUser.uid), updatedProfile, {
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

  // Navigation Handlers
  const openBookDetail = (book: Book) => {
    if (
      activeView !== 'livro-detalhe' &&
      activeView !== 'leitor' &&
      activeView !== 'leitor-pdf'
    ) {
      setPreviousView(activeView);
    }
    setSelectedBookId(book.id);
    setActiveView('livro-detalhe');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Ao clicar em [ LER LIVRO ], abre a seleção de formato ("Como você quer ler?")
   * sem abrir o PDF imediatamente.
   */
  const openBookReader = (book: Book) => {
    setSelectedBookId(book.id);
    setFormatModalBookId(book.id);
  };

  /**
   * Quando o leitor escolhe o formato (ex: format = "pdf") no modal "Como você quer ler?",
   * abre a rota/componente correspondente ao formato escolhido.
   */
  const handleSelectReadingFormat = (book: Book, format: ReadingFormat) => {
    setFormatModalBookId(null);
    if (activeView !== 'leitor' && activeView !== 'leitor-pdf') {
      setPreviousView(activeView);
    }
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
    const cleanedBook = stripUndefined(bookToSave);
    setBooks((prev) => {
      const exists = prev.some((b) => b.id === cleanedBook.id);
      const next = exists
        ? prev.map((b) => (b.id === cleanedBook.id ? cleanedBook : b))
        : [...prev, cleanedBook];
      return next.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
    });
    if (firebaseUser && isAdmin) {
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
    if (firebaseUser && isAdmin) {
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
    if (firebaseUser && isAdmin) {
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
    if (firebaseUser && isAdmin) {
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

    if (firebaseUser && isAdmin) {
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
    if (firebaseUser && isAdmin) {
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
    if (firebaseUser && isAdmin) {
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
      setUserProfile(cleanedUser);
    }
    if (firebaseUser && isAdmin) {
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
    if (firebaseUser && isAdmin) {
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

  const downloadsCount = useMemo(
    () =>
      Object.values(userLibrary).filter(
        (i) => activeBookIdsSet.has(i.bookId) && i.isDownloaded
      ).length,
    [userLibrary, activeBookIdsSet]
  );

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

  // Rota preparada para o Leitor de PDF (format = "pdf")
  if (activeView === 'leitor-pdf' && selectedBook) {
    return (
      <PdfReaderView
        book={selectedBook}
        format={selectedReadingFormat}
        onClose={() => setActiveView(previousView)}
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
        categoriesList={effectiveCategoriesList}
        platformSettings={platformSettings}
      />

      {/* Main Content View Router */}
      <main className="flex-1">
        {/* VIEW: HOME INICIAL */}
        {activeView === 'home' && (
          <div className="pb-20">
            {activeBooks.length === 0 ? (
              <div className="pt-36 pb-24 px-4 sm:px-8 mx-auto max-w-2xl text-center">
                <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-10 sm:p-12 shadow-2xl space-y-4">
                  <BookOpen className="w-12 h-12 text-[#60A5FA] mx-auto opacity-85" />
                  <h1 className="font-display text-2xl sm:text-4xl font-bold text-white">
                    Catálogo pronto para livros reais
                  </h1>
                  <p className="text-sm sm:text-base text-blue-200/75 leading-relaxed">
                    Todos os livros automáticos e dados superficiais foram removidos.
                    Adicione os livros reais da plataforma pelo painel administrativo para exibi-los aqui.
                  </p>
                  {isAdmin && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleNavigate('admin')}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Abrir Painel Admin e Cadastrar Livros</span>
                      </button>
                    </div>
                  )}
                </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-blue-400/15">
                <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white">
                  {selectedCategory}
                </h1>

                {/* Quick Switcher for other categories */}
                <div className="flex flex-wrap items-center gap-2">
                  {effectiveCategoriesList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-[#2563EB] text-white font-bold shadow-md'
                          : 'bg-[#071426] text-blue-200/80 hover:text-white border border-blue-400/20'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
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
          />
        )}

        {/* VIEW: MINHA LISTA */}
        {activeView === 'minha-lista' && (
          <MyLibraryView
            books={books}
            userLibrary={userLibrary}
            initialTab="lista"
            onSelectBook={openBookDetail}
            onReadBook={openBookReader}
            onChangeStatus={handleChangeStatus}
            onRemoveFromList={handleRemoveFromList}
            platformSettings={platformSettings}
          />
        )}

        {/* VIEW: DOWNLOADS */}
        {activeView === 'downloads' && (
          <DownloadsView
            books={books}
            userLibrary={userLibrary}
            onSelectBook={openBookDetail}
            onReadBook={openBookReader}
            onToggleDownload={handleToggleDownload}
            platformSettings={platformSettings}
          />
        )}

        {/* VIEW: CONTINUAR LENDO */}
        {activeView === 'continuar-lendo' && (
          <MyLibraryView
            books={books}
            userLibrary={userLibrary}
            initialTab="lendo"
            onSelectBook={openBookDetail}
            onReadBook={openBookReader}
            onChangeStatus={handleChangeStatus}
            onRemoveFromList={handleRemoveFromList}
            platformSettings={platformSettings}
          />
        )}

        {/* VIEW: PERFIL DO USUÁRIO */}
        {activeView === 'perfil' && (
          <ProfileView
            userProfile={userProfile}
            isAuthenticated={Boolean(firebaseUser)}
            isAdmin={isAdmin}
            books={books}
            userLibrary={userLibrary}
            onSignIn={() => signInWithGoogle()}
            onSignOut={() => signOutUser()}
            onSelectBook={openBookDetail}
            onOpenAdmin={() => handleNavigate('admin')}
            platformSettings={platformSettings}
          />
        )}

        {/* VIEW: PÁGINA DO LIVRO */}
        {activeView === 'livro-detalhe' && selectedBook && (
          <BookDetailView
            book={selectedBook}
            allBooks={books}
            userLibrary={userLibrary}
            onBack={() => handleNavigate(previousView)}
            onReadBook={openBookReader}
            onSelectBook={openBookDetail}
            onToggleList={handleToggleList}
            onToggleFavorite={handleToggleFavorite}
            onChangeStatus={handleChangeStatus}
            onRateBook={handleRateBook}
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

      {/* VIP Modal */}
      {vipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-[#FFB800]/30 bg-gradient-to-b from-[#1A1409] to-[#0D0D11] p-6 sm:p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setVipModalOpen(false)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFB800] text-black shadow-lg mb-5">
              <Crown className="w-7 h-7 stroke-[2.2]" />
            </div>

            <div className="inline-flex items-center gap-1 rounded-full border border-[#FFB800]/40 bg-[#FFB800]/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#FFB800] mb-2">
              <Sparkles className="w-3 h-3" /> Oferta Especial SÓ HOJE
            </div>

            <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Livroflix VIP
            </h3>
            <p className="mt-1 text-sm text-zinc-300">
              Acesso total e irrestrito a toda a biblioteca digital por apenas{' '}
              <strong className="text-[#FFB800]">R$ 11,90/mês</strong>.
            </p>

            <ul className="mt-5 space-y-2.5 text-xs sm:text-sm text-zinc-200">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#FFB800] flex-shrink-0" />
                <span>Leitura digital ilimitada de todos os livros do catálogo</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#FFB800] flex-shrink-0" />
                <span>Downloads offline e sincronização automática na nuvem</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#FFB800] flex-shrink-0" />
                <span>Modos de leitura avançados (Claro, Sépia e Noturno) sem anúncios</span>
              </li>
            </ul>

            <button
              type="button"
              onClick={() => {
                setVipSubscribed(true);
                setTimeout(() => setVipModalOpen(false), 1200);
              }}
              className="mt-6 w-full rounded-xl bg-[#FFB800] hover:bg-[#FFA000] py-3.5 text-sm font-extrabold text-black shadow-lg transition-transform hover:scale-[1.01] cursor-pointer"
            >
              {vipSubscribed ? '✓ Assinatura VIP Ativada!' : 'Ativar Acesso VIP Agora'}
            </button>
          </div>
        </div>
      )}

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
            {platformSettings.showDownloadsTab !== false && (
              <button
                type="button"
                onClick={() => handleNavigate('downloads')}
                className="hover:text-[#60A5FA] transition-colors cursor-pointer"
              >
                {platformSettings.navDownloadsText || 'Downloads'}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
