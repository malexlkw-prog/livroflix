import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Star,
  ArrowUp,
  ArrowDown,
  Users,
  BarChart3,
  Layers,
  BookOpen,
  Sparkles,
  Check,
  X,
  ShieldCheck,
  Palette,
  Type,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  History,
  FileText,
  Upload,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import {
  db,
  uploadBookPdfToBackend,
  formatPdfFileSize,
} from '../firebase';
import {
  Book,
  BookChapter,
  BookStatus,
  CustomCategory,
  HomeRow,
  HomeRowType,
  PlatformSettings,
  UserBookItem,
  UserProfile,
} from '../types';
import {
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_HOME_ROWS,
} from '../data/catalog';
import { BookCover } from './BookCover';
import { ImagePickerField } from './ImagePickerField';

interface AdminDashboardProps {
  books: Book[];
  customCategories: CustomCategory[];
  homeRows: HomeRow[];
  platformSettings: PlatformSettings;
  registeredUsers: UserProfile[];
  onSaveBook: (book: Book) => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
  onToggleFeatured: (book: Book) => Promise<void>;
  onMoveBookOrder: (book: Book, direction: 'up' | 'down') => Promise<void>;
  onAddCategory: (category: CustomCategory) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onSaveHomeRow: (row: HomeRow) => Promise<void>;
  onDeleteHomeRow: (rowId: string) => Promise<void>;
  onSavePlatformSettings: (settings: PlatformSettings) => Promise<void>;
  onUpdateUserProfile: (user: UserProfile) => Promise<void>;
  onDeleteUserProfile: (uid: string) => Promise<void>;
}

const EMPTY_BOOK_FORM: Omit<Book, 'id'> = {
  titulo: '',
  autor: '',
  capa: '',
  bannerUrl: '',
  corTema: '#2563EB',
  descricao: '',
  generos: [],
  personagens: [],
  palavrasChave: [],
  ano: new Date().getFullYear(),
  paginas: 1,
  idioma: 'Português',
  editora: '',
  avaliacao: 0,
  totalAvaliacoes: 0,
  leiturasCount: 0,
  arquivo: '',
  readingOptions: {},
  pdfUrl: '',
  pdfPath: '',
  pdfFileName: '',
  pdfSize: 0,
  pdfUpdatedAt: '',
  status: 'ativo',
  destaque: false,
  ordem: 1,
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  books,
  customCategories,
  homeRows,
  platformSettings,
  registeredUsers,
  onSaveBook,
  onDeleteBook,
  onToggleFeatured,
  onMoveBookOrder,
  onAddCategory,
  onDeleteCategory,
  onSaveHomeRow,
  onDeleteHomeRow,
  onSavePlatformSettings,
  onUpdateUserProfile,
  onDeleteUserProfile,
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'catalogo'
    | 'formulario'
    | 'fileiras'
    | 'hero-top10'
    | 'identidade'
    | 'textos-menus'
    | 'usuarios'
  >('catalogo');

  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const notifySaved = (msg: string) => {
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 3000);
  };

  // --- TAB 1 & 2: BOOK CATALOG & MULTI-CHAPTER FORM ---
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogStatusFilter, setCatalogStatusFilter] = useState<string>('todos');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftBookId, setDraftBookId] = useState<string>(
    () => 'livro-' + Date.now()
  );
  const [formState, setFormState] = useState<Omit<Book, 'id'>>(EMPTY_BOOK_FORM);
  const [genresInput, setGenresInput] = useState<string>('');
  const [charactersInput, setCharactersInput] = useState<string>('');
  const [keywordsInput, setKeywordsInput] = useState<string>('');
  const [chaptersList, setChaptersList] = useState<BookChapter[]>([
    {
      numero: 1,
      titulo: 'Capítulo I — Abertura',
      paginaInicial: 1,
      conteudo: '',
    },
  ]);

  // Estados do Upload de PDF ("OPÇÕES DE LEITURA")
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [pdfBookIdLocked, setPdfBookIdLocked] = useState<boolean>(false);
  const [pdfUploadStatus, setPdfUploadStatus] = useState<
    'idle' | 'uploading' | 'available' | 'error'
  >('idle');
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);

  // --- TAB 3: HOME ROWS & CUSTOM CATEGORIES ---
  const [editingRow, setEditingRow] = useState<HomeRow | null>(null);
  const [rowTitle, setRowTitle] = useState<string>('');
  const [rowType, setRowType] = useState<HomeRowType>('genero');
  const [rowGenre, setRowGenre] = useState<string>('Fantasia');
  const [rowCardSize, setRowCardSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [rowShowRank, setRowShowRank] = useState<boolean>(false);
  const [rowManualBookIds, setRowManualBookIds] = useState<string[]>([]);

  const [catTitle, setCatTitle] = useState<string>('');
  const [catIcon, setCatIcon] = useState<string>('✨');
  const [catGenre, setCatGenre] = useState<string>('Fantasia');

  // --- TAB 4, 5, 6: LOCAL SETTINGS DRAFT ---
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings>(
    platformSettings
  );
  const [newHeaderCatInput, setNewHeaderCatInput] = useState<string>('');
  const [suggestionsInput, setSuggestionsInput] = useState<string>(
    (platformSettings.searchSuggestions || []).join(', ')
  );

  useEffect(() => {
    setSettingsDraft(platformSettings);
    setSuggestionsInput((platformSettings.searchSuggestions || []).join(', '));
  }, [platformSettings]);

  // --- TAB 7: USERS & READING HISTORY ---
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [inspectingUser, setInspectingUser] = useState<UserProfile | null>(null);
  const [inspectedLibrary, setInspectedLibrary] = useState<UserBookItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const sortedBooks = [...books].sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
  const filteredCatalogBooks = sortedBooks.filter((b) => {
    const matchesStatus =
      catalogStatusFilter === 'todos' || b.status === catalogStatusFilter;
    const q = catalogSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      b.titulo.toLowerCase().includes(q) ||
      b.autor.toLowerCase().includes(q) ||
      b.generos.some((g) => g.toLowerCase().includes(q));
    return matchesStatus && matchesQuery;
  });

  const sortedHomeRows = [...homeRows].sort((a, b) => a.ordem - b.ordem);
  const mostReadBooks = [...books].sort(
    (a, b) => (b.leiturasCount || 0) - (a.leiturasCount || 0)
  );

  // Book Form Helpers
  const resolveCurrentBookId = (): string => {
    if (editingId) return editingId;
    if (pdfBookIdLocked || formState.readingOptions?.pdf?.url) return draftBookId;
    if (formState.titulo.trim()) {
      const slug =
        formState.titulo
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') +
        '-' +
        Date.now().toString().slice(-4);
      setDraftBookId(slug);
      setPdfBookIdLocked(true);
      return slug;
    }
    setPdfBookIdLocked(true);
    return draftBookId;
  };

  const startNewBook = () => {
    setEditingId(null);
    setDraftBookId('livro-' + Date.now());
    setPdfBookIdLocked(false);
    setSelectedPdfFile(null);
    setFormState({ ...EMPTY_BOOK_FORM, readingOptions: {}, ordem: books.length + 1 });
    setGenresInput('');
    setCharactersInput('');
    setKeywordsInput('');
    setPdfUploadStatus('idle');
    setPdfErrorMessage(null);
    setChaptersList([
      {
        numero: 1,
        titulo: 'Capítulo 1',
        paginaInicial: 1,
        conteudo: '',
      },
    ]);
    setActiveTab('formulario');
  };

  const startEditBook = (book: Book) => {
    setEditingId(book.id);
    setDraftBookId(book.id);
    setPdfBookIdLocked(true);
    setSelectedPdfFile(null);

    const existingPdfOption = book.readingOptions?.pdf?.url
      ? book.readingOptions.pdf
      : book.pdfUrl
      ? {
          url: book.pdfUrl,
          fileName: book.pdfFileName || 'livro.pdf',
          size: book.pdfSize || 0,
          uploadedAt: book.pdfUpdatedAt || new Date().toISOString(),
        }
      : undefined;

    setFormState({
      titulo: book.titulo,
      autor: book.autor,
      capa: book.capa,
      bannerUrl: book.bannerUrl || '',
      corTema: book.corTema || '#2563EB',
      descricao: book.descricao,
      generos: book.generos,
      personagens: book.personagens || [],
      palavrasChave: book.palavrasChave || [],
      ano: book.ano,
      paginas: book.paginas,
      idioma: book.idioma,
      editora: book.editora,
      avaliacao: book.avaliacao || 0,
      totalAvaliacoes: book.totalAvaliacoes || 0,
      leiturasCount: book.leiturasCount || 0,
      arquivo: book.arquivo,
      readingOptions: {
        ...(book.readingOptions || {}),
        ...(existingPdfOption ? { pdf: existingPdfOption } : {}),
      },
      pdfUrl: existingPdfOption?.url || '',
      pdfPath: book.pdfPath || '',
      pdfFileName: existingPdfOption?.fileName || '',
      pdfSize: existingPdfOption?.size || 0,
      pdfUpdatedAt: existingPdfOption?.uploadedAt || '',
      status: book.status,
      destaque: book.destaque,
      ordem: book.ordem || 1,
      ...(book.capitulos ? { capitulos: book.capitulos } : {}),
    });
    setPdfUploadStatus(existingPdfOption ? 'available' : 'idle');
    setPdfErrorMessage(null);
    setGenresInput(book.generos.join(', '));
    setCharactersInput((book.personagens || []).join(', '));
    setKeywordsInput((book.palavrasChave || []).join(', '));
    setChaptersList(
      book.capitulos && book.capitulos.length > 0
        ? book.capitulos
        : [
            {
              numero: 1,
              titulo: `Capítulo I — ${book.titulo}`,
              paginaInicial: 1,
              conteudo: book.descricao,
            },
          ]
    );
    setActiveTab('formulario');
  };

  // Seleção do arquivo PDF no input ("Selecionar PDF" ou "Substituir PDF")
  const handlePdfFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    const file =
      selectedFiles && selectedFiles.length > 0 ? selectedFiles[0] : null;

    if (!file) return;

    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      e.target.value = '';
      setSelectedPdfFile(null);
      setPdfUploadStatus('error');
      setPdfErrorMessage(
        'Arquivo inválido. Selecione somente arquivos no formato PDF (.pdf).'
      );
      return;
    }

    setSelectedPdfFile(file);
    setPdfErrorMessage(null);
    if (pdfUploadStatus === 'error') {
      setPdfUploadStatus(
        formState.readingOptions?.pdf?.url ? 'available' : 'idle'
      );
    }

    if (pdfFileInputRef.current) {
      pdfFileInputRef.current.value = '';
    }
  };

  // Envio do PDF selecionado para POST https://livroflix-api.onrender.com/api/github/upload-pdf
  const handleUploadSelectedPdf = async () => {
    if (!selectedPdfFile) return;

    const targetBookId = resolveCurrentBookId();
    setPdfUploadStatus('uploading');
    setPdfErrorMessage(null);

    try {
      const uploadedPdf = await uploadBookPdfToBackend(
        targetBookId,
        selectedPdfFile
      );

      const nextReadingOptions = {
        ...(formState.readingOptions || {}),
        pdf: {
          url: uploadedPdf.url,
          fileName: uploadedPdf.fileName,
          size: uploadedPdf.size,
          uploadedAt: uploadedPdf.uploadedAt,
          ...(uploadedPdf.assetId !== undefined
            ? { assetId: uploadedPdf.assetId }
            : {}),
          ...(uploadedPdf.releaseId !== undefined
            ? { releaseId: uploadedPdf.releaseId }
            : {}),
          ...(uploadedPdf.releaseTag !== undefined
            ? { releaseTag: uploadedPdf.releaseTag }
            : {}),
        },
      };

      const updatedForm: Omit<Book, 'id'> = {
        ...formState,
        readingOptions: nextReadingOptions,
        pdfUrl: uploadedPdf.url,
        pdfFileName: uploadedPdf.fileName,
        pdfSize: uploadedPdf.size,
        pdfUpdatedAt: uploadedPdf.uploadedAt,
      };

      setFormState(updatedForm);
      setSelectedPdfFile(null);
      setPdfUploadStatus('available');

      // Se o livro já existe no catálogo (/books/{bookId}), salva imediatamente no Firestore
      const existingBook = books.find((b) => b.id === targetBookId);
      if (editingId && existingBook) {
        await onSaveBook({
          ...existingBook,
          ...updatedForm,
          id: targetBookId,
        });
      }

      notifySaved(`PDF "${uploadedPdf.fileName}" enviado com sucesso!`);
    } catch (error: unknown) {
      setPdfUploadStatus('error');
      setPdfErrorMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao enviar o PDF. Tente novamente.'
      );
    }
  };

  // Remoção dos dados de PDF do Firestore (sem apagar o asset do GitHub nesta versão)
  const handleRemovePdf = async () => {
    try {
      const preservedReadingOptions = { ...(formState.readingOptions || {}) };
      delete preservedReadingOptions.pdf;

      const clearedForm: Omit<Book, 'id'> = {
        ...formState,
        readingOptions: preservedReadingOptions,
        pdfUrl: '',
        pdfPath: '',
        pdfFileName: '',
        pdfSize: 0,
        pdfUpdatedAt: '',
      };

      setFormState(clearedForm);
      setSelectedPdfFile(null);
      setPdfUploadStatus('idle');
      setPdfErrorMessage(null);

      if (editingId) {
        const existingBook = books.find((b) => b.id === editingId);
        if (existingBook) {
          await onSaveBook({
            ...existingBook,
            ...clearedForm,
            id: editingId,
          });
        }
      }

      notifySaved('PDF removido das opções de leitura deste livro.');
    } catch (error: unknown) {
      setPdfUploadStatus('error');
      setPdfErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível remover o PDF.'
      );
    }
  };

  const handleAddChapter = () => {
    const nextNum = chaptersList.length + 1;
    const lastPage =
      chaptersList[chaptersList.length - 1]?.paginaInicial || 1;
    setChaptersList([
      ...chaptersList,
      {
        numero: nextNum,
        titulo: `Capítulo ${nextNum}`,
        paginaInicial: lastPage + 15,
        conteudo: '',
      },
    ]);
  };

  const handleRemoveChapter = (index: number) => {
    if (chaptersList.length <= 1) return;
    const next = chaptersList
      .filter((_, idx) => idx !== index)
      .map((c, idx) => ({ ...c, numero: idx + 1 }));
    setChaptersList(next);
  };

  const handleUpdateChapter = (
    index: number,
    field: keyof BookChapter,
    val: string | number
  ) => {
    setChaptersList((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: val } : c))
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.titulo.trim() || !formState.autor.trim()) return;

    const id =
      editingId ||
      (pdfBookIdLocked || formState.readingOptions?.pdf?.url
        ? draftBookId
        : formState.titulo
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') +
          '-' +
          Date.now().toString().slice(-4));

    const parsedGenres = genresInput
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    const parsedCharacters = charactersInput
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const parsedKeywords = keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const sanitizedChapters: BookChapter[] = chaptersList.map((ch, idx) => ({
      numero: idx + 1,
      titulo: ch.titulo.trim() || `Capítulo ${idx + 1}`,
      paginaInicial: Math.max(1, Number(ch.paginaInicial) || 1),
      conteudo: ch.conteudo.trim() || formState.descricao,
    }));

    const bookToSave: Book = {
      ...formState,
      id,
      generos: parsedGenres.length > 0 ? parsedGenres : ['Literatura'],
      personagens: parsedCharacters,
      palavrasChave: parsedKeywords,
      capitulos: sanitizedChapters,
    };

    await onSaveBook(bookToSave);
    notifySaved(`Livro "${bookToSave.titulo}" salvo no Firestore!`);
    setActiveTab('catalogo');
  };

  // Home Row Helpers
  const startNewHomeRow = () => {
    setEditingRow(null);
    setRowTitle('');
    setRowType('genero');
    setRowGenre('Fantasia');
    setRowCardSize('md');
    setRowShowRank(false);
    setRowManualBookIds([]);
  };

  const startEditHomeRow = (row: HomeRow) => {
    setEditingRow(row);
    setRowTitle(row.titulo);
    setRowType(row.tipo);
    setRowGenre(row.generoFiltro || 'Fantasia');
    setRowCardSize(row.cardSize || 'md');
    setRowShowRank(Boolean(row.showRank));
    setRowManualBookIds(row.bookIds || []);
  };

  const handleSaveRowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rowTitle.trim()) return;

    const rowToSave: HomeRow = {
      id: editingRow ? editingRow.id : 'row-' + Date.now(),
      titulo: rowTitle.trim(),
      ordem: editingRow ? editingRow.ordem : sortedHomeRows.length + 1,
      ativo: editingRow ? editingRow.ativo : true,
      tipo: rowType,
      ...(rowType === 'genero' ? { generoFiltro: rowGenre.trim() } : {}),
      ...(rowType === 'manual' ? { bookIds: rowManualBookIds } : {}),
      showRank: rowShowRank,
      cardSize: rowCardSize,
    };

    await onSaveHomeRow(rowToSave);
    notifySaved(`Fileira "${rowToSave.titulo}" salva com sucesso!`);
    startNewHomeRow();
  };

  const handleMoveHomeRowOrder = async (
    row: HomeRow,
    direction: 'up' | 'down'
  ) => {
    const idx = sortedHomeRows.findIndex((r) => r.id === row.id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedHomeRows.length) return;

    const currentOrder = sortedHomeRows[idx].ordem;
    const neighborOrder = sortedHomeRows[swapIdx].ordem;

    await onSaveHomeRow({ ...sortedHomeRows[idx], ordem: neighborOrder });
    await onSaveHomeRow({ ...sortedHomeRows[swapIdx], ordem: currentOrder });
  };

  const handleToggleHomeRowActive = async (row: HomeRow) => {
    await onSaveHomeRow({ ...row, ativo: !row.ativo });
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catTitle.trim()) return;
    const newCat: CustomCategory = {
      id: 'cat-' + Date.now(),
      titulo: catTitle.trim(),
      icone: catIcon.trim() || '📚',
      generoFiltro: catGenre,
      ordem: customCategories.length + 1,
    };
    await onAddCategory(newCat);
    setCatTitle('');
    notifySaved('Categoria extra adicionada!');
  };

  // Save Platform Settings Helper
  const handlePersistSettings = async (customNext?: PlatformSettings) => {
    const parsedSuggestions = suggestionsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: PlatformSettings = {
      ...(customNext || settingsDraft),
      searchSuggestions:
        parsedSuggestions.length > 0
          ? parsedSuggestions
          : DEFAULT_PLATFORM_SETTINGS.searchSuggestions,
      updatedAt: new Date().toISOString(),
    };

    await onSavePlatformSettings(payload);
    notifySaved('Configurações da LIVROFLIX salvas no Firestore em tempo real!');
  };

  // Inspect User Library History
  const handleInspectUserHistory = async (u: UserProfile) => {
    setInspectingUser(u);
    setLoadingHistory(true);
    try {
      const snap = await getDocs(collection(db, 'users', u.uid, 'library'));
      const items: UserBookItem[] = [];
      snap.forEach((d) => items.push(d.data() as UserBookItem));
      items.sort((a, b) =>
        (b.ultimoAcesso || '').localeCompare(a.ultimoAcesso || '')
      );
      setInspectedLibrary(items);
    } catch {
      setInspectedLibrary([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040D1A] pt-24 pb-24 text-white">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        {/* Floating Save Confirmation */}
        {savedBanner && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-[#2563EB] border border-blue-300/40 px-5 py-3.5 text-sm font-bold text-white shadow-2xl">
            <Check className="w-4 h-4" />
            <span>{savedBanner}</span>
          </div>
        )}

        {/* Admin Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-blue-400/15">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#60A5FA] mb-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Centro de Controle Total • Firebase Sincronizado</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Administração LIVROFLIX
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/75 mt-1">
              Controle livros, múltiplos capítulos, capas (carregar ou colar imagem), fileiras da Home, Hero, Top 10, cores, textos e usuários.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startNewBook}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-5 py-3 text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Adicionar Novo Livro</span>
            </button>
          </div>
        </div>

        {/* Admin Navigation Tabs (7 Complete Control Areas) */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {(
            [
              {
                id: 'catalogo',
                label: `1. Livros & Catálogo (${books.length})`,
                icon: BookOpen,
              },
              {
                id: 'formulario',
                label: editingId ? '2. Editar Livro & Capítulos' : '2. Novo Livro & Capítulos',
                icon: Plus,
              },
              {
                id: 'fileiras',
                label: `3. Fileiras da Home (${homeRows.length})`,
                icon: Layers,
              },
              {
                id: 'hero-top10',
                label: '4. Destaques (Hero) & Top 10',
                icon: Sparkles,
              },
              {
                id: 'identidade',
                label: '5. Identidade, Logo & Cores',
                icon: Palette,
              },
              {
                id: 'textos-menus',
                label: '6. Textos, Menus & Categorias',
                icon: Type,
              },
              {
                id: 'usuarios',
                label: `7. Usuários & Histórico (${registeredUsers.length})`,
                icon: Users,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#2563EB] text-white shadow-md'
                    : 'bg-[#071426] text-blue-200/80 hover:text-white border border-blue-400/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ===================================================================
            TAB 1: CATÁLOGO, BUSCA, DESTAQUES E POSIÇÕES
           =================================================================== */}
        {activeTab === 'catalogo' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-[#071426] border border-blue-400/20 p-4">
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Buscar livro por título, autor ou gênero..."
                className="w-full sm:max-w-md rounded-xl bg-[#040D1A] border border-blue-400/20 px-4 py-2.5 text-sm text-white focus:border-[#60A5FA] focus:outline-none"
              />

              <div className="flex flex-wrap items-center gap-2">
                {(['todos', 'ativo', 'oculto', 'rascunho'] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCatalogStatusFilter(st)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase cursor-pointer ${
                        catalogStatusFilter === st
                          ? 'bg-[#2563EB] text-white'
                          : 'bg-[#040D1A] text-blue-200/70 border border-blue-400/15'
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-[#071426] border border-blue-400/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-blue-400/15 text-[11px] uppercase tracking-wider text-blue-200/70 bg-black/20">
                      <th className="py-3.5 px-4">Posição</th>
                      <th className="py-3.5 px-4">Livro / Capa</th>
                      <th className="py-3.5 px-4">Autor & Capítulos</th>
                      <th className="py-3.5 px-4">Gêneros</th>
                      <th className="py-3.5 px-4">Destaque Hero</th>
                      <th className="py-3.5 px-4">Status Rápido</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-400/10 text-sm">
                    {filteredCatalogBooks.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-12 px-4 text-center text-blue-200/75"
                        >
                          <p className="font-display text-lg font-bold text-white">
                            Nenhum livro cadastrado neste filtro
                          </p>
                          <p className="text-xs mt-1">
                            Clique em "Adicionar Novo Livro" no topo para cadastrar obras reais no catálogo.
                          </p>
                        </td>
                      </tr>
                    ) : null}
                    {filteredCatalogBooks.map((book, idx) => (
                      <tr
                        key={book.id}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono-num text-xs text-blue-200/70">
                          <div className="flex items-center gap-1.5">
                            <span className="w-6 font-bold text-white">
                              #{book.ordem || idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => onMoveBookOrder(book, 'up')}
                              className="p-1 rounded hover:bg-white/10 text-blue-200 hover:text-white cursor-pointer"
                              title="Subir posição"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveBookOrder(book, 'down')}
                              className="p-1 rounded hover:bg-white/10 text-blue-200 hover:text-white cursor-pointer"
                              title="Descer posição"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 flex-shrink-0">
                              <BookCover book={book} size="sm" />
                            </div>
                            <div>
                              <p className="font-display font-bold text-base text-white">
                                {book.titulo}
                              </p>
                              <p className="text-xs font-mono-num text-blue-200/60">
                                {book.paginas} págs • {book.ano} • ★{' '}
                                {book.avaliacao.toFixed(1)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <p className="font-medium text-white">{book.autor}</p>
                          <p className="text-xs text-blue-200/70">
                            {book.editora} • {(book.capitulos || []).length}{' '}
                            capítulo(s)
                            {book.pdfUrl ? ' • 📄 PDF disponível' : ''}
                          </p>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {book.generos.slice(0, 3).map((g) => (
                              <span
                                key={g}
                                className="rounded bg-blue-500/15 border border-blue-400/20 px-2 py-0.5 text-[10px] text-blue-200"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => onToggleFeatured(book)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                              book.destaque
                                ? 'bg-[#2563EB]/30 border border-[#60A5FA] text-[#60A5FA]'
                                : 'bg-white/[0.04] border border-white/10 text-blue-200/70 hover:text-white'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              {book.destaque ? 'No Hero' : 'Destacar'}
                            </span>
                          </button>
                        </td>

                        <td className="py-3 px-4">
                          <select
                            value={book.status}
                            onChange={(e) =>
                              onSaveBook({
                                ...book,
                                status: e.target.value as BookStatus,
                              })
                            }
                            className="rounded-lg bg-[#040D1A] border border-blue-400/25 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
                          >
                            <option value="ativo">Ativo</option>
                            <option value="oculto">Oculto</option>
                            <option value="rascunho">Rascunho</option>
                          </select>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditBook(book)}
                              className="rounded-lg bg-blue-500/15 hover:bg-blue-500/30 p-2 text-[#60A5FA] transition-colors cursor-pointer"
                              title="Editar livro e capítulos"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteBook(book.id)}
                              className="rounded-lg bg-rose-500/10 hover:bg-rose-500/25 p-2 text-rose-400 transition-colors cursor-pointer"
                              title="Excluir livro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: FORMULÁRIO ADICIONAR / EDITAR LIVRO + CAPÍTULOS + IMAGENS
           =================================================================== */}
        {activeTab === 'formulario' && (
          <form
            onSubmit={handleFormSubmit}
            className="rounded-2xl bg-[#071426] border border-blue-400/20 p-6 sm:p-8 max-w-5xl mx-auto space-y-6"
          >
            <div className="flex items-center justify-between border-b border-blue-400/15 pb-4">
              <h2 className="font-display text-2xl font-bold text-white">
                {editingId
                  ? `Editar Livro: ${formState.titulo}`
                  : 'Adicionar Novo Livro ao Catálogo'}
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('catalogo')}
                className="text-xs text-blue-200/70 hover:text-white cursor-pointer"
              >
                Voltar ao catálogo
              </button>
            </div>

            {/* Imagens do Livro: Capa + Banner Opcional (com Carregar Imagem ou Colar) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ImagePickerField
                label="Capa do Livro (Proporção 2:3)"
                value={formState.capa}
                onChange={(url) => setFormState({ ...formState, capa: url })}
                aspectRatio="cover"
                required
              />

              <ImagePickerField
                label="Imagem de Fundo do Hero (Opcional)"
                value={formState.bannerUrl || ''}
                onChange={(url) =>
                  setFormState({ ...formState, bannerUrl: url })
                }
                aspectRatio="banner"
                helperText="Se deixado em branco, o Hero usará a própria capa do livro desfocada ao fundo."
              />
            </div>

            {/* Metadados Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                  Título da Obra *
                </label>
                <input
                  type="text"
                  required
                  value={formState.titulo}
                  onChange={(e) =>
                    setFormState({ ...formState, titulo: e.target.value })
                  }
                  placeholder="Ex: A Metamorfose"
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2.5 text-sm text-white focus:border-[#60A5FA] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                  Autor(a) *
                </label>
                <input
                  type="text"
                  required
                  value={formState.autor}
                  onChange={(e) =>
                    setFormState({ ...formState, autor: e.target.value })
                  }
                  placeholder="Ex: Franz Kafka"
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2.5 text-sm text-white focus:border-[#60A5FA] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                  Editora & Idioma
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formState.editora}
                    onChange={(e) =>
                      setFormState({ ...formState, editora: e.target.value })
                    }
                    placeholder="Editora"
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  />
                  <input
                    type="text"
                    value={formState.idioma}
                    onChange={(e) =>
                      setFormState({ ...formState, idioma: e.target.value })
                    }
                    placeholder="Português"
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                  Gêneros / Categorias (separados por vírgula)
                </label>
                <input
                  type="text"
                  value={genresInput}
                  onChange={(e) => setGenresInput(e.target.value)}
                  placeholder="Clássicos, Fantasia, Romance, Mistério..."
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2.5 text-sm text-white"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(platformSettings.headerCategories || []).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        const current = genresInput
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean);
                        if (!current.includes(cat)) {
                          setGenresInput([...current, cat].join(', '));
                        }
                      }}
                      className="rounded bg-blue-500/15 hover:bg-blue-500/30 border border-blue-400/25 px-2 py-0.5 text-[11px] text-blue-200 cursor-pointer"
                    >
                      + {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                  Personagens (para busca)
                </label>
                <input
                  type="text"
                  value={charactersInput}
                  onChange={(e) => setCharactersInput(e.target.value)}
                  placeholder="Ex: Capitu, Bentinho"
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                  Palavras-Chave (para busca)
                </label>
                <input
                  type="text"
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  placeholder="Ex: magia, guerra, filosofia"
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-4 gap-2 sm:col-span-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                    Ano
                  </label>
                  <input
                    type="number"
                    value={formState.ano}
                    onChange={(e) =>
                      setFormState({ ...formState, ano: Number(e.target.value) })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                    Páginas
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formState.paginas}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        paginas: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                    Avaliação (★)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={5}
                    value={formState.avaliacao}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        avaliacao: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                    Leituras (Top 10)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formState.leiturasCount || 0}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        leiturasCount: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                    Status
                  </label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        status: e.target.value as BookStatus,
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="oculto">Oculto</option>
                    <option value="rascunho">Rascunho</option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.destaque}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          destaque: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[#2563EB]"
                    />
                    <span className="text-sm font-medium text-white">
                      Destacar no Hero
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Sinopse */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                Sinopse da Obra *
              </label>
              <textarea
                rows={3}
                required
                value={formState.descricao}
                onChange={(e) =>
                  setFormState({ ...formState, descricao: e.target.value })
                }
                className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 p-3.5 text-sm text-white focus:border-[#60A5FA] focus:outline-none"
              />
            </div>

            {/* ===================================================================
                OPÇÕES DE LEITURA (📄 PDF)
               =================================================================== */}
            <div className="space-y-4 pt-4 border-t border-blue-400/15">
              <div>
                <h3 className="font-display text-xl font-bold text-white uppercase tracking-wide">
                  OPÇÕES DE LEITURA
                </h3>
                <p className="text-xs text-blue-200/70">
                  Gerencie o arquivo PDF vinculado ao livro (<code className="text-[#60A5FA] font-mono">{editingId || draftBookId}</code>).
                </p>
              </div>

              <div className="rounded-xl bg-[#040D1A] border border-blue-400/25 p-5 space-y-4">
                {/* Input oculto aceitando somente PDF */}
                <input
                  ref={pdfFileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfFileSelect}
                  className="hidden"
                />

                {(() => {
                  const registeredPdf = formState.readingOptions?.pdf?.url
                    ? formState.readingOptions.pdf
                    : formState.pdfUrl
                    ? {
                        url: formState.pdfUrl,
                        fileName: formState.pdfFileName || 'livro.pdf',
                        size: formState.pdfSize || 0,
                        uploadedAt: formState.pdfUpdatedAt || '',
                      }
                    : null;

                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-400/30 text-2xl">
                          <span role="img" aria-label="PDF">
                            📄
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-display text-lg font-bold text-white">
                              📄 PDF
                            </span>

                            {pdfUploadStatus === 'uploading' && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Enviando PDF...</span>
                              </span>
                            )}

                            {!selectedPdfFile &&
                              pdfUploadStatus !== 'uploading' &&
                              registeredPdf && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>PDF disponível</span>
                                </span>
                              )}

                            {selectedPdfFile &&
                              pdfUploadStatus !== 'uploading' && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#60A5FA]">
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>PDF selecionado</span>
                                </span>
                              )}

                            {!selectedPdfFile &&
                              !registeredPdf &&
                              pdfUploadStatus !== 'uploading' && (
                                <span className="text-xs text-blue-200/60">
                                  Nenhum PDF cadastrado
                                </span>
                              )}
                          </div>

                          {/* Estado 2: PDF selecionado (aguardando envio) */}
                          {selectedPdfFile ? (
                            <div className="text-xs text-blue-200/85 space-y-0.5 font-mono-num">
                              <p>
                                Arquivo:{' '}
                                <strong className="text-white">
                                  {selectedPdfFile.name}
                                </strong>
                              </p>
                              <p>
                                Tamanho:{' '}
                                <strong className="text-[#60A5FA]">
                                  {formatPdfFileSize(selectedPdfFile.size)}
                                </strong>
                              </p>
                            </div>
                          ) : registeredPdf ? (
                            /* Estado 3: PDF já cadastrado */
                            <div className="text-xs text-blue-200/85 space-y-0.5 font-mono-num">
                              <p>
                                Arquivo:{' '}
                                <strong className="text-white">
                                  {registeredPdf.fileName}
                                </strong>
                                {registeredPdf.size > 0 && (
                                  <>
                                    {' '}
                                    · Tamanho:{' '}
                                    <strong className="text-[#60A5FA]">
                                      {formatPdfFileSize(registeredPdf.size)}
                                    </strong>
                                  </>
                                )}
                              </p>
                            </div>
                          ) : (
                            /* Estado 1: Nenhum PDF cadastrado */
                            <p className="text-xs text-blue-200/65">
                              Selecione um arquivo PDF para habilitar a leitura em PDF na página pública do livro.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botões de Ação conforme os 3 Estados */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* Estado 1: Nenhum PDF cadastrado -> botão "Selecionar PDF" */}
                        {!selectedPdfFile && !registeredPdf && (
                          <button
                            type="button"
                            disabled={pdfUploadStatus === 'uploading'}
                            onClick={() => pdfFileInputRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition-colors cursor-pointer disabled:cursor-not-allowed"
                          >
                            <FileText className="w-4 h-4" />
                            <span>Selecionar PDF</span>
                          </button>
                        )}

                        {/* Estado 2: PDF selecionado -> botão "Enviar PDF" */}
                        {selectedPdfFile && (
                          <>
                            <button
                              type="button"
                              disabled={pdfUploadStatus === 'uploading'}
                              onClick={handleUploadSelectedPdf}
                              className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              {pdfUploadStatus === 'uploading' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              <span>
                                {pdfUploadStatus === 'uploading'
                                  ? 'Enviando...'
                                  : 'Enviar PDF'}
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={pdfUploadStatus === 'uploading'}
                              onClick={() => pdfFileInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#071426] hover:bg-[#0B1E36] border border-blue-400/25 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-blue-200 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <span>Selecionar outro</span>
                            </button>
                          </>
                        )}

                        {/* Estado 3: PDF já cadastrado -> botões "Substituir PDF" e "Remover PDF" */}
                        {!selectedPdfFile && registeredPdf && (
                          <>
                            <button
                              type="button"
                              disabled={pdfUploadStatus === 'uploading'}
                              onClick={() => pdfFileInputRef.current?.click()}
                              className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Upload className="w-4 h-4" />
                              <span>Substituir PDF</span>
                            </button>

                            <button
                              type="button"
                              disabled={pdfUploadStatus === 'uploading'}
                              onClick={handleRemovePdf}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-rose-300 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Remover PDF</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Mensagem de Erro no Upload */}
                {pdfErrorMessage && (
                  <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{pdfErrorMessage}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Editor Completo de Múltiplos Capítulos */}
            <div className="space-y-4 pt-4 border-t border-blue-400/15">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-xl font-bold text-white">
                    Capítulos e Textos do Livro ({chaptersList.length})
                  </h3>
                  <p className="text-xs text-blue-200/70">
                    Adicione quantos capítulos desejar e defina a página inicial e o texto completo de cada um.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddChapter}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-3.5 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Capítulo</span>
                </button>
              </div>

              <div className="space-y-4">
                {chaptersList.map((ch, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-[#040D1A] border border-blue-400/20 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-md bg-blue-500/20 border border-blue-400/30 px-2.5 py-1 text-xs font-bold text-[#60A5FA]">
                        Capítulo #{idx + 1}
                      </span>

                      <div className="flex items-center gap-3 flex-1 max-w-xl">
                        <input
                          type="text"
                          value={ch.titulo}
                          onChange={(e) =>
                            handleUpdateChapter(idx, 'titulo', e.target.value)
                          }
                          placeholder="Título do capítulo"
                          className="flex-1 rounded-lg bg-[#071426] border border-blue-400/20 px-3 py-1.5 text-xs sm:text-sm text-white"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-blue-200/70">
                            Pág. inicial:
                          </span>
                          <input
                            type="number"
                            min={1}
                            value={ch.paginaInicial}
                            onChange={(e) =>
                              handleUpdateChapter(
                                idx,
                                'paginaInicial',
                                Number(e.target.value)
                              )
                            }
                            className="w-20 rounded-lg bg-[#071426] border border-blue-400/20 px-2.5 py-1.5 text-xs font-mono-num text-white"
                          />
                        </div>
                      </div>

                      {chaptersList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChapter(idx)}
                          className="text-rose-400 hover:text-rose-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={5}
                      value={ch.conteudo}
                      onChange={(e) =>
                        handleUpdateChapter(idx, 'conteudo', e.target.value)
                      }
                      placeholder="Cole ou digite o texto completo deste capítulo (separe parágrafos com uma linha em branco)..."
                      className="w-full rounded-lg bg-[#071426] border border-blue-400/20 p-3 text-sm text-white font-reader focus:border-[#60A5FA] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-blue-400/15">
              <button
                type="button"
                onClick={() => setActiveTab('catalogo')}
                className="rounded-lg border border-blue-400/20 px-5 py-2.5 text-sm font-medium text-blue-200 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-6 py-2.5 text-sm font-bold text-white shadow-lg cursor-pointer"
              >
                {editingId
                  ? 'Salvar Alterações no Livro'
                  : 'Publicar Livro no Catálogo'}
              </button>
            </div>
          </form>
        )}

        {/* ===================================================================
            TAB 3: FILEIRAS DA PÁGINA INICIAL & ORDEM DAS FILEIRAS
           =================================================================== */}
        {activeTab === 'fileiras' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Formulário Criar/Editar Fileira */}
            <form
              onSubmit={handleSaveRowSubmit}
              className="lg:col-span-5 rounded-2xl bg-[#071426] border border-blue-400/20 p-6 space-y-4 h-fit"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-white">
                  {editingRow
                    ? `Editar Fileira: ${editingRow.titulo}`
                    : 'Criar Nova Fileira na Home'}
                </h3>
                {editingRow && (
                  <button
                    type="button"
                    onClick={startNewHomeRow}
                    className="text-xs text-blue-300 hover:text-white cursor-pointer"
                  >
                    Cancelar edição
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs text-blue-200/75 mb-1">
                  Título da Fileira *
                </label>
                <input
                  type="text"
                  required
                  value={rowTitle}
                  onChange={(e) => setRowTitle(e.target.value)}
                  placeholder="Ex: Clássicos Imperdíveis"
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Tipo de Conteúdo
                  </label>
                  <select
                    value={rowType}
                    onChange={(e) => setRowType(e.target.value as HomeRowType)}
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="genero">Filtrar por Gênero</option>
                    <option value="manual">Seleção Manual de Livros</option>
                    <option value="top10">Top 10 Mais Lidos</option>
                    <option value="em_alta">Em Alta (Mais Lidos)</option>
                    <option value="bem_avaliados">Mais Bem Avaliados</option>
                    <option value="para_voce">Recomendações (Para Você)</option>
                    <option value="recentes">Adicionados Recentemente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Tamanho das Capas
                  </label>
                  <select
                    value={rowCardSize}
                    onChange={(e) =>
                      setRowCardSize(e.target.value as 'sm' | 'md' | 'lg')
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="sm">Pequeno (Compacto)</option>
                    <option value="md">Médio (Padrão)</option>
                    <option value="lg">Grande (Destaque)</option>
                  </select>
                </div>
              </div>

              {rowType === 'genero' && (
                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Gênero Filtrado
                  </label>
                  <input
                    type="text"
                    value={rowGenre}
                    onChange={(e) => setRowGenre(e.target.value)}
                    placeholder="Ex: Fantasia, Romance, Terror..."
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2.5 text-sm text-white"
                  />
                </div>
              )}

              {rowType === 'manual' && (
                <div className="space-y-2">
                  <label className="block text-xs text-blue-200/75">
                    Escolha os Livros desta Fileira ({rowManualBookIds.length}{' '}
                    selecionados)
                  </label>
                  <div className="max-h-56 overflow-y-auto rounded-xl bg-[#040D1A] border border-blue-400/20 p-2.5 space-y-1.5">
                    {books.map((b) => {
                      const selected = rowManualBookIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setRowManualBookIds((prev) =>
                              prev.includes(b.id)
                                ? prev.filter((id) => id !== b.id)
                                : [...prev, b.id]
                            );
                          }}
                          className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                            selected
                              ? 'bg-[#2563EB] text-white font-bold'
                              : 'hover:bg-white/5 text-blue-100'
                          }`}
                        >
                          <span className="truncate">
                            {b.titulo} — {b.autor}
                          </span>
                          {selected && (
                            <span className="ml-2 font-mono-num">
                              #{rowManualBookIds.indexOf(b.id) + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={rowShowRank}
                  onChange={(e) => setRowShowRank(e.target.checked)}
                  className="h-4 w-4 accent-[#2563EB]"
                />
                <span className="text-xs sm:text-sm text-blue-100">
                  Exibir números gigantes de Ranking (estilo Top 10) ao lado das capas
                </span>
              </label>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] py-3 text-sm font-bold text-white shadow-lg cursor-pointer"
              >
                {editingRow
                  ? 'Salvar Alterações da Fileira'
                  : 'Adicionar Fileira à Página Inicial'}
              </button>
            </form>

            {/* Lista de Fileiras da Home */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display text-xl font-bold text-white">
                      Ordem e Visibilidade das Fileiras da Home
                    </h3>
                    <p className="text-xs text-blue-200/70">
                      Use as setas para mudar a ordem na tela inicial, oculte ou edite qualquer fileira.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {sortedHomeRows.map((row, index) => (
                    <div
                      key={row.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all ${
                        row.ativo !== false
                          ? 'bg-[#040D1A] border-blue-400/20'
                          : 'bg-[#040D1A]/40 border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="w-6 font-mono-num text-xs font-bold text-[#60A5FA]">
                            #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMoveHomeRowOrder(row, 'up')}
                            className="p-1 rounded hover:bg-white/10 text-blue-200 cursor-pointer"
                            title="Subir fileira"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveHomeRowOrder(row, 'down')}
                            className="p-1 rounded hover:bg-white/10 text-blue-200 cursor-pointer"
                            title="Descer fileira"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">
                            {row.titulo}
                          </p>
                          <p className="text-[11px] text-blue-200/60">
                            Tipo: <strong className="uppercase">{row.tipo}</strong>
                            {row.generoFiltro ? ` (${row.generoFiltro})` : ''}
                            {row.bookIds ? ` (${row.bookIds.length} livros)` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleHomeRowActive(row)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                            row.ativo !== false
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {row.ativo !== false ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Visível</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Oculta</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => startEditHomeRow(row)}
                          className="rounded-lg bg-blue-500/15 hover:bg-blue-500/30 p-2 text-[#60A5FA] cursor-pointer"
                          title="Editar fileira"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteHomeRow(row.id)}
                          className="rounded-lg bg-rose-500/10 hover:bg-rose-500/25 p-2 text-rose-400 cursor-pointer"
                          title="Excluir fileira"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categorias Personalizadas da Home & Menu */}
              <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-6 space-y-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-white">
                    Categorias Extras (Home & Menu de Categorias)
                  </h3>
                  <p className="text-xs text-blue-200/70">
                    Adicione categorias extras sincronizadas em tempo real para todos os usuários e visitantes.
                  </p>
                </div>

                <form
                  onSubmit={handleCreateCategory}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3"
                >
                  <input
                    type="text"
                    value={catIcon}
                    onChange={(e) => setCatIcon(e.target.value)}
                    placeholder="📚"
                    className="sm:col-span-2 rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2 text-sm text-white text-center"
                  />
                  <input
                    type="text"
                    required
                    value={catTitle}
                    onChange={(e) => {
                      setCatTitle(e.target.value);
                      setCatGenre(e.target.value);
                    }}
                    placeholder="Nome da categoria (ex: Suspense, Poesia)..."
                    className="sm:col-span-7 rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2 text-sm text-white"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-3 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    + Adicionar Categoria
                  </button>
                </form>

                {customCategories.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {customCategories.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#040D1A] border border-blue-400/25 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <span>
                          {c.icone} {c.titulo}
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteCategory(c.id)}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                          title="Excluir categoria"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: DESTAQUES (HERO) & TOP 10 LIVROS MAIS LIDOS
           =================================================================== */}
        {activeTab === 'hero-top10' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Controle do Hero Banner */}
            <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-blue-400/15 pb-4">
                <div>
                  <h3 className="font-display text-2xl font-bold text-white">
                    Configuração dos Destaques (Hero)
                  </h3>
                  <p className="text-xs text-blue-200/70">
                    Controle quais livros aparecem no topo, tempo de transição e elementos visíveis.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePersistSettings()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-4 py-2.5 text-xs font-bold text-white cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Hero</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Texto do Botão do Hero
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.heroButtonText}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        heroButtonText: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Tempo de Rotação (segundos)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={settingsDraft.heroAutoRotateSeconds}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        heroAutoRotateSeconds: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={settingsDraft.showHeroRating !== false}
                    onChange={(e) => {
                      const next = {
                        ...settingsDraft,
                        showHeroRating: e.target.checked,
                      };
                      setSettingsDraft(next);
                      handlePersistSettings(next);
                    }}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  <span>Mostrar Avaliação (★)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={settingsDraft.showHeroSynopsis !== false}
                    onChange={(e) => {
                      const next = {
                        ...settingsDraft,
                        showHeroSynopsis: e.target.checked,
                      };
                      setSettingsDraft(next);
                      handlePersistSettings(next);
                    }}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  <span>Mostrar Sinopse</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={settingsDraft.showHeroCover !== false}
                    onChange={(e) => {
                      const next = {
                        ...settingsDraft,
                        showHeroCover: e.target.checked,
                      };
                      setSettingsDraft(next);
                      handlePersistSettings(next);
                    }}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  <span>Mostrar Capa Lateral</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-2">
                  Seleção Manual de Livros do Hero ({settingsDraft.heroBookIds.length}{' '}
                  fixados)
                </label>
                <p className="text-[11px] text-blue-200/60 mb-2">
                  Clique nos livros abaixo para definir uma lista e ordem exata para o Hero (se nenhum estiver marcado aqui, o site usa os livros marcados como "No Hero" na aba Catálogo).
                </p>
                <div className="max-h-64 overflow-y-auto rounded-xl bg-[#040D1A] border border-blue-400/20 p-2.5 space-y-1.5">
                  {books.map((b) => {
                    const idx = settingsDraft.heroBookIds.indexOf(b.id);
                    const isSelected = idx !== -1;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          const nextIds = isSelected
                            ? settingsDraft.heroBookIds.filter(
                                (id) => id !== b.id
                              )
                            : [...settingsDraft.heroBookIds, b.id];
                          const next = {
                            ...settingsDraft,
                            heroBookIds: nextIds,
                          };
                          setSettingsDraft(next);
                          handlePersistSettings(next);
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#2563EB] text-white font-bold'
                            : 'hover:bg-white/5 text-blue-100'
                        }`}
                      >
                        <span className="truncate">
                          {b.titulo} — {b.autor}
                        </span>
                        {isSelected && (
                          <span className="font-mono-num">Slide #{idx + 1}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Controle do Top 10 */}
            <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-blue-400/15 pb-4">
                <div>
                  <h3 className="font-display text-2xl font-bold text-white">
                    Controle do Top 10
                  </h3>
                  <p className="text-xs text-blue-200/70">
                    Escolha entre ranking automático por leituras ou escolha manual do 1º ao 10º lugar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePersistSettings()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-4 py-2.5 text-xs font-bold text-white cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Top 10</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Modo de Seleção do Top 10
                  </label>
                  <select
                    value={settingsDraft.top10Mode}
                    onChange={(e) => {
                      const next = {
                        ...settingsDraft,
                        top10Mode: e.target.value as 'auto' | 'manual',
                      };
                      setSettingsDraft(next);
                      handlePersistSettings(next);
                    }}
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2 text-sm text-white"
                  >
                    <option value="auto">
                      Automático (Pelos Livros Mais Lidos)
                    </option>
                    <option value="manual">
                      Manual (Escolher 1º ao 10º Lugar)
                    </option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                    <input
                      type="checkbox"
                      checked={settingsDraft.showTop10 !== false}
                      onChange={(e) => {
                        const next = {
                          ...settingsDraft,
                          showTop10: e.target.checked,
                        };
                        setSettingsDraft(next);
                        handlePersistSettings(next);
                      }}
                      className="h-4 w-4 accent-[#2563EB]"
                    />
                    <span>Exibir Top 10 na Página Inicial</span>
                  </label>
                </div>
              </div>

              {settingsDraft.top10Mode === 'manual' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#60A5FA]">
                    Clique nos livros na ordem do 1º ao 10º lugar (
                    {settingsDraft.top10BookIds.length}/10):
                  </label>
                  <div className="max-h-72 overflow-y-auto rounded-xl bg-[#040D1A] border border-blue-400/20 p-2.5 space-y-1.5">
                    {books.map((b) => {
                      const pos = settingsDraft.top10BookIds.indexOf(b.id);
                      const isPicked = pos !== -1;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            let nextTop10 = settingsDraft.top10BookIds;
                            if (isPicked) {
                              nextTop10 = settingsDraft.top10BookIds.filter(
                                (id) => id !== b.id
                              );
                            } else if (settingsDraft.top10BookIds.length < 10) {
                              nextTop10 = [
                                ...settingsDraft.top10BookIds,
                                b.id,
                              ];
                            }
                            const next = {
                              ...settingsDraft,
                              top10BookIds: nextTop10,
                            };
                            setSettingsDraft(next);
                            handlePersistSettings(next);
                          }}
                          className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                            isPicked
                              ? 'bg-[#2563EB] text-white font-bold'
                              : 'hover:bg-white/5 text-blue-100'
                          }`}
                        >
                          <span className="truncate">
                            {b.titulo} — {b.autor}
                          </span>
                          {isPicked && (
                            <span className="rounded bg-black/30 px-2 py-0.5 font-mono-num">
                              #{pos + 1}º Lugar
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {mostReadBooks.slice(0, 10).map((book, index) => (
                    <div
                      key={book.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[#040D1A] border border-blue-400/15 px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono-num text-sm font-bold text-[#60A5FA] w-6">
                          #{index + 1}
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-white truncate">
                          {book.titulo}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={book.leiturasCount || 0}
                          onChange={(e) =>
                            onSaveBook({
                              ...book,
                              leiturasCount: Number(e.target.value),
                            })
                          }
                          className="w-24 rounded-lg bg-[#071426] border border-blue-400/25 px-2.5 py-1 text-xs font-mono-num text-white text-right"
                        />
                        <span className="text-[11px] text-blue-200/60">
                          leituras
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 5: IDENTIDADE VISUAL, LOGO (IMAGEM OU TEXTO) & CORES
           =================================================================== */}
        {activeTab === 'identidade' && (
          <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-6 sm:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-400/15 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Identidade Visual, Logo, Cores & Padrões do Leitor
                </h2>
                <p className="text-xs text-blue-200/70">
                  Personalize o nome da marca, carregue ou cole uma imagem de logo e ajuste as cores do site.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const reset: PlatformSettings = {
                      ...settingsDraft,
                      siteName: DEFAULT_PLATFORM_SETTINGS.siteName,
                      logoText: DEFAULT_PLATFORM_SETTINGS.logoText,
                      logoImageUrl: '',
                      primaryColor: DEFAULT_PLATFORM_SETTINGS.primaryColor,
                      accentColor: DEFAULT_PLATFORM_SETTINGS.accentColor,
                      backgroundColor: DEFAULT_PLATFORM_SETTINGS.backgroundColor,
                      cardBackgroundColor:
                        DEFAULT_PLATFORM_SETTINGS.cardBackgroundColor,
                      footerBackgroundColor:
                        DEFAULT_PLATFORM_SETTINGS.footerBackgroundColor,
                    };
                    setSettingsDraft(reset);
                    handlePersistSettings(reset);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-400/25 px-4 py-2.5 text-xs font-semibold text-blue-200 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Padrão Azul</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePersistSettings()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Identidade & Cores</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                    Nome do Site / Plataforma
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.siteName}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        siteName: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2.5 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-blue-200/75 mb-1.5">
                    Texto da Logo (Deixe "LIVROFLIX" para usar a logo vetorial oficial)
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.logoText}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        logoText: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2.5 text-sm text-white"
                  />
                </div>
              </div>

              <ImagePickerField
                label="Imagem de Logo Personalizada (Opcional)"
                value={settingsDraft.logoImageUrl || ''}
                onChange={(url) =>
                  setSettingsDraft({ ...settingsDraft, logoImageUrl: url })
                }
                aspectRatio="logo"
                helperText="Carregue ou cole uma imagem PNG/SVG se quiser substituir a logo padrão no cabeçalho e rodapé."
              />
            </div>

            {/* Seletores de Cores */}
            <div className="pt-4 border-t border-blue-400/15">
              <h3 className="font-display text-lg font-bold text-white mb-3">
                Cores Globais da Plataforma
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs text-blue-200/75 mb-1.5">
                    Cor Primária (Botões)
                  </label>
                  <div className="flex items-center gap-2 rounded-lg bg-[#040D1A] border border-blue-400/20 p-2">
                    <input
                      type="color"
                      value={settingsDraft.primaryColor || '#2563EB'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          primaryColor: e.target.value,
                        })
                      }
                      className="h-8 w-10 rounded cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={settingsDraft.primaryColor || '#2563EB'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          primaryColor: e.target.value,
                        })
                      }
                      className="w-full bg-transparent text-xs font-mono-num text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-blue-200/75 mb-1.5">
                    Cor de Destaque (Acentos)
                  </label>
                  <div className="flex items-center gap-2 rounded-lg bg-[#040D1A] border border-blue-400/20 p-2">
                    <input
                      type="color"
                      value={settingsDraft.accentColor || '#60A5FA'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          accentColor: e.target.value,
                        })
                      }
                      className="h-8 w-10 rounded cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={settingsDraft.accentColor || '#60A5FA'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          accentColor: e.target.value,
                        })
                      }
                      className="w-full bg-transparent text-xs font-mono-num text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-blue-200/75 mb-1.5">
                    Fundo Principal
                  </label>
                  <div className="flex items-center gap-2 rounded-lg bg-[#040D1A] border border-blue-400/20 p-2">
                    <input
                      type="color"
                      value={settingsDraft.backgroundColor || '#040D1A'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          backgroundColor: e.target.value,
                        })
                      }
                      className="h-8 w-10 rounded cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={settingsDraft.backgroundColor || '#040D1A'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-full bg-transparent text-xs font-mono-num text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-blue-200/75 mb-1.5">
                    Fundo dos Cards
                  </label>
                  <div className="flex items-center gap-2 rounded-lg bg-[#040D1A] border border-blue-400/20 p-2">
                    <input
                      type="color"
                      value={settingsDraft.cardBackgroundColor || '#071426'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          cardBackgroundColor: e.target.value,
                        })
                      }
                      className="h-8 w-10 rounded cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={settingsDraft.cardBackgroundColor || '#071426'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          cardBackgroundColor: e.target.value,
                        })
                      }
                      className="w-full bg-transparent text-xs font-mono-num text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-blue-200/75 mb-1.5">
                    Fundo do Rodapé
                  </label>
                  <div className="flex items-center gap-2 rounded-lg bg-[#040D1A] border border-blue-400/20 p-2">
                    <input
                      type="color"
                      value={settingsDraft.footerBackgroundColor || '#020813'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          footerBackgroundColor: e.target.value,
                        })
                      }
                      className="h-8 w-10 rounded cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={settingsDraft.footerBackgroundColor || '#020813'}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          footerBackgroundColor: e.target.value,
                        })
                      }
                      className="w-full bg-transparent text-xs font-mono-num text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Padrões do Leitor */}
            <div className="pt-4 border-t border-blue-400/15">
              <h3 className="font-display text-lg font-bold text-white mb-3">
                Configurações Padrão do Leitor de Livros
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Tema Inicial do Leitor
                  </label>
                  <select
                    value={settingsDraft.defaultReaderTheme || 'dark'}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        defaultReaderTheme: e.target.value as
                          | 'dark'
                          | 'sepia'
                          | 'light',
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="dark">Modo Escuro (Noturno)</option>
                    <option value="sepia">Modo Sépia (Conforto)</option>
                    <option value="light">Modo Claro (Papel)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Tamanho de Fonte Padrão (px)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={28}
                    value={settingsDraft.defaultReaderFontSize || 20}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        defaultReaderFontSize: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2.5 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Tipografia Padrão do Leitor
                  </label>
                  <select
                    value={settingsDraft.defaultReaderFontFamily || 'editorial'}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        defaultReaderFontFamily: e.target.value as
                          | 'editorial'
                          | 'classic'
                          | 'modern',
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="editorial">Editorial (Literária)</option>
                    <option value="classic">Clássica (Serifada)</option>
                    <option value="modern">Moderna (Sem Serifa)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 6: TEXTOS GERAIS, MENUS DE NAVEGAÇÃO & CAIXA DE CATEGORIAS
           =================================================================== */}
        {activeTab === 'textos-menus' && (
          <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-6 sm:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-blue-400/15 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Textos Gerais, Menu Superior & Caixa de Categorias
                </h2>
                <p className="text-xs text-blue-200/70">
                  Altere qualquer texto da interface, oculte abas do menu ou edite as categorias do topo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePersistSettings()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Todos os Textos & Menus</span>
              </button>
            </div>

            {/* Nomes das Abas do Cabeçalho & Visibilidade */}
            <div className="space-y-3">
              <h3 className="font-display text-lg font-bold text-white">
                Menu Superior de Navegação
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Aba Início
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.navHomeText || 'Início'}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        navHomeText: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Aba Minha Lista
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.navMyListText || 'Minha lista'}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        navMyListText: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Aba Downloads
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.navDownloadsText || 'Downloads'}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        navDownloadsText: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-blue-200/75 mb-1">
                    Aba Categorias
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.navCategoriesText || 'Categorias'}
                    onChange={(e) =>
                      setSettingsDraft({
                        ...settingsDraft,
                        navCategoriesText: e.target.value,
                      })
                    }
                    className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-5 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={settingsDraft.showDownloadsTab !== false}
                    onChange={(e) => {
                      const next = {
                        ...settingsDraft,
                        showDownloadsTab: e.target.checked,
                      };
                      setSettingsDraft(next);
                      handlePersistSettings(next);
                    }}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  <span>Mostrar aba "Downloads" no menu</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={settingsDraft.showCategoriesTab !== false}
                    onChange={(e) => {
                      const next = {
                        ...settingsDraft,
                        showCategoriesTab: e.target.checked,
                      };
                      setSettingsDraft(next);
                      handlePersistSettings(next);
                    }}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  <span>Mostrar aba "Categorias" no menu</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={settingsDraft.showSearchButton !== false}
                    onChange={(e) => {
                      const next = {
                        ...settingsDraft,
                        showSearchButton: e.target.checked,
                      };
                      setSettingsDraft(next);
                      handlePersistSettings(next);
                    }}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  <span>Mostrar botão de Pesquisa (Lupa)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={settingsDraft.showProfileAchievements !== false}
                    onChange={(e) => {
                      const next = {
                        ...settingsDraft,
                        showProfileAchievements: e.target.checked,
                      };
                      setSettingsDraft(next);
                      handlePersistSettings(next);
                    }}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  <span>Mostrar Conquistas Literárias no Perfil</span>
                </label>
              </div>
            </div>

            {/* Categorias da Caixa Suspensa do Cabeçalho */}
            <div className="pt-4 border-t border-blue-400/15 space-y-3">
              <h3 className="font-display text-lg font-bold text-white">
                Categorias do Menu Superior ("Escolha uma categoria de livros")
              </h3>
              <div className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={newHeaderCatInput}
                  onChange={(e) => setNewHeaderCatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = newHeaderCatInput.trim();
                      if (
                        trimmed &&
                        !settingsDraft.headerCategories.includes(trimmed)
                      ) {
                        const next = {
                          ...settingsDraft,
                          headerCategories: [
                            ...settingsDraft.headerCategories,
                            trimmed,
                          ],
                        };
                        setSettingsDraft(next);
                        setNewHeaderCatInput('');
                        handlePersistSettings(next);
                      }
                    }
                  }}
                  placeholder="Nova categoria (ex: Suspense, Poesia)..."
                  className="flex-1 rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newHeaderCatInput.trim();
                    if (
                      trimmed &&
                      !settingsDraft.headerCategories.includes(trimmed)
                    ) {
                      const next = {
                        ...settingsDraft,
                        headerCategories: [
                          ...settingsDraft.headerCategories,
                          trimmed,
                        ],
                      };
                      setSettingsDraft(next);
                      setNewHeaderCatInput('');
                      handlePersistSettings(next);
                    }
                  }}
                  className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  Adicionar
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {settingsDraft.headerCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#040D1A] border border-blue-400/25 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = {
                          ...settingsDraft,
                          headerCategories:
                            settingsDraft.headerCategories.filter(
                              (c) => c !== cat
                            ),
                        };
                        setSettingsDraft(next);
                        handlePersistSettings(next);
                      }}
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                      title="Remover categoria do menu"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Textos de Botões, Páginas e Rodapé */}
            <div className="pt-4 border-t border-blue-400/15 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-blue-200/75 mb-1">
                  Texto do Botão de Leitura (Página do Livro)
                </label>
                <input
                  type="text"
                  value={settingsDraft.readButtonText}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      readButtonText: e.target.value,
                    })
                  }
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-blue-200/75 mb-1">
                  Título da Seção de Avaliação
                </label>
                <input
                  type="text"
                  value={settingsDraft.ratingPromptText || 'Avalie esta obra'}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      ratingPromptText: e.target.value,
                    })
                  }
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-blue-200/75 mb-1">
                  Título da Aba Minha Lista
                </label>
                <input
                  type="text"
                  value={settingsDraft.myListTitle || 'Minha lista'}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      myListTitle: e.target.value,
                    })
                  }
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-blue-200/75 mb-1">
                  Título da Aba Downloads
                </label>
                <input
                  type="text"
                  value={settingsDraft.downloadsTitle || 'Meus Downloads'}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      downloadsTitle: e.target.value,
                    })
                  }
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-blue-200/75 mb-1">
                  Sugestões Rápidas da Página de Pesquisa (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={suggestionsInput}
                  onChange={(e) => setSuggestionsInput(e.target.value)}
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-blue-200/75 mb-1">
                  Descrição do Rodapé
                </label>
                <textarea
                  rows={2}
                  value={settingsDraft.footerDescription}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      footerDescription: e.target.value,
                    })
                  }
                  className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 p-3 text-sm text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 7: USUÁRIOS, CARGOS & HISTÓRICO DE LEITURA
           =================================================================== */}
        {activeTab === 'usuarios' && (
          <div className="space-y-6">
            {/* Modal / Painel de Edição de Usuário (com Upload/Colar Foto) */}
            {editingUser && (
              <div className="rounded-2xl bg-[#071426] border border-[#60A5FA]/40 p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-blue-400/15 pb-3">
                  <h3 className="font-display text-xl font-bold text-white">
                    Editar Usuário: {editingUser.nome}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="text-xs text-blue-200/70 hover:text-white cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-blue-200/75 mb-1">
                        Nome do Leitor
                      </label>
                      <input
                        type="text"
                        value={editingUser.nome}
                        onChange={(e) =>
                          setEditingUser({
                            ...editingUser,
                            nome: e.target.value,
                          })
                        }
                        className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3.5 py-2 text-sm text-white"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-blue-200/75 mb-1">
                          Permissão (Role)
                        </label>
                        <select
                          value={editingUser.role}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              role: e.target.value as 'user' | 'admin',
                            })
                          }
                          className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2 text-sm text-white"
                        >
                          <option value="user">Leitor (user)</option>
                          <option value="admin">Admin (admin)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-blue-200/75 mb-1">
                          Dias Seguidos
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editingUser.streakDays || 0}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              streakDays: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2 text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-blue-200/75 mb-1">
                          Minutos Lidos
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editingUser.totalMinutesRead || 0}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              totalMinutesRead: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-lg bg-[#040D1A] border border-blue-400/20 px-3 py-2 text-sm text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <ImagePickerField
                    label="Foto de Perfil do Usuário"
                    value={editingUser.foto || ''}
                    onChange={(url) =>
                      setEditingUser({ ...editingUser, foto: url })
                    }
                    aspectRatio="square"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="rounded-lg border border-blue-400/20 px-4 py-2 text-xs text-blue-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onUpdateUserProfile(editingUser);
                      notifySaved(`Perfil de "${editingUser.nome}" atualizado!`);
                      setEditingUser(null);
                    }}
                    className="rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-5 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    Salvar Usuário
                  </button>
                </div>
              </div>
            )}

            {/* Painel de Inspeção de Histórico de Leitura do Usuário */}
            {inspectingUser && (
              <div className="rounded-2xl bg-[#071426] border border-[#60A5FA]/40 p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-blue-400/15 pb-3">
                  <div>
                    <h3 className="font-display text-xl font-bold text-white">
                      Histórico de Leitura & Favoritos de {inspectingUser.nome}
                    </h3>
                    <p className="text-xs text-blue-200/70">
                      {inspectingUser.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectingUser(null)}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white cursor-pointer"
                  >
                    Fechar Histórico
                  </button>
                </div>

                {loadingHistory ? (
                  <p className="text-sm text-blue-200/70">
                    Carregando biblioteca do usuário...
                  </p>
                ) : inspectedLibrary.length === 0 ? (
                  <p className="text-sm text-blue-200/70">
                    Este usuário ainda não possui livros registrados na biblioteca.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {inspectedLibrary.map((item) => {
                      const b = books.find((bk) => bk.id === item.bookId);
                      return (
                        <div
                          key={item.bookId}
                          className="rounded-xl bg-[#040D1A] border border-blue-400/20 p-3.5 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <p className="font-bold text-sm text-white truncate">
                              {b ? b.titulo : item.bookId}
                            </p>
                            <p className="text-xs text-blue-200/70">
                              Status: <strong className="uppercase">{item.status}</strong>{' '}
                              {item.isFavorite ? '• ❤️ Favorito' : ''}
                            </p>
                          </div>
                          <div className="text-xs font-mono-num text-[#60A5FA]">
                            Página {item.paginaAtual} de {item.totalPaginas} (
                            {item.progresso}%)
                            {item.avaliacaoUsuario
                              ? ` • Nota: ${item.avaliacaoUsuario}★`
                              : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Lista de Usuários */}
            <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-6">
              <h3 className="font-display text-2xl font-bold text-white mb-4">
                Leitores Registrados ({registeredUsers.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {registeredUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-[#040D1A] border border-blue-400/20 p-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {u.foto ? (
                        <img
                          src={u.foto}
                          alt={u.nome}
                          className="h-12 w-12 rounded-xl object-cover flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#071426] border border-blue-400/30 text-[#60A5FA] font-bold">
                          {u.nome[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">
                          {u.nome}
                        </p>
                        <p className="text-xs text-blue-200/70 truncate">
                          {u.email}
                        </p>
                        <span className="inline-block mt-1 rounded bg-blue-500/15 border border-blue-400/30 px-2 py-0.5 text-[10px] font-mono-num uppercase text-[#60A5FA]">
                          {u.role} • {u.streakDays || 1} dias seguidos
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleInspectUserHistory(u)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/30 px-3 py-1.5 text-xs font-semibold text-[#60A5FA] cursor-pointer"
                        title="Ver histórico de leitura e favoritos"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Histórico</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingUser(u)}
                        className="rounded-lg bg-white/10 hover:bg-white/20 p-2 text-white cursor-pointer"
                        title="Editar usuário"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteUserProfile(u.uid)}
                        className="rounded-lg bg-rose-500/10 hover:bg-rose-500/25 p-2 text-rose-400 cursor-pointer"
                        title="Excluir perfil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
