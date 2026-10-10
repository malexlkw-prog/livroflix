import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  MessageSquare,
  Copy,
  Check,
  Trash2,
  Sun,
  Moon,
  BookOpen,
  Bookmark,
  X,
  Send,
  Loader2,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Book,
  ReaderPreferences,
  UserBookItem,
  UserProfile,
  BookAnnotation,
  BookParagraphComment,
  HighlightColor,
} from '../types';
import { getPageContentForBook } from '../data/catalog';
import { fetchPdfBinaryData } from '../utils/pdfUtils';
import * as pdfjsLib from 'pdfjs-dist';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

export const PASTEL_COLORS: Record<
  HighlightColor,
  {
    id: HighlightColor;
    name: string;
    bgLight: string;
    bgDark: string;
    borderLight: string;
    borderDark: string;
    textLight: string;
    textDark: string;
    pillBg: string;
  }
> = {
  yellow: {
    id: 'yellow',
    name: 'Amarelo pastel',
    bgLight: '#FEF08A',
    bgDark: 'rgba(254, 240, 138, 0.40)',
    borderLight: '#FACC15',
    borderDark: '#FEF08A',
    textLight: '#713F12',
    textDark: '#FEF08A',
    pillBg: 'bg-[#FEF08A] text-[#713F12]',
  },
  pink: {
    id: 'pink',
    name: 'Rosa pastel',
    bgLight: '#FBCFE8',
    bgDark: 'rgba(251, 207, 232, 0.40)',
    borderLight: '#F472B6',
    borderDark: '#FBCFE8',
    textLight: '#831843',
    textDark: '#FBCFE8',
    pillBg: 'bg-[#FBCFE8] text-[#831843]',
  },
  blue: {
    id: 'blue',
    name: 'Azul pastel',
    bgLight: '#BAE6FD',
    bgDark: 'rgba(186, 230, 253, 0.40)',
    borderLight: '#38BDF8',
    borderDark: '#BAE6FD',
    textLight: '#0C4A6E',
    textDark: '#BAE6FD',
    pillBg: 'bg-[#BAE6FD] text-[#0C4A6E]',
  },
  green: {
    id: 'green',
    name: 'Verde pastel',
    bgLight: '#BBF7D0',
    bgDark: 'rgba(187, 247, 208, 0.40)',
    borderLight: '#4ADE80',
    borderDark: '#BBF7D0',
    textLight: '#14532D',
    textDark: '#BBF7D0',
    pillBg: 'bg-[#BBF7D0] text-[#14532D]',
  },
  purple: {
    id: 'purple',
    name: 'Roxo pastel',
    bgLight: '#E9D5FF',
    bgDark: 'rgba(233, 213, 255, 0.40)',
    borderLight: '#C084FC',
    borderDark: '#E9D5FF',
    textLight: '#581C87',
    textDark: '#E9D5FF',
    pillBg: 'bg-[#E9D5FF] text-[#581C87]',
  },
};

interface FloatingMenuState {
  visible: boolean;
  x: number;
  y: number;
  selectedText: string;
  paragraphIndex: number;
}

interface BookReaderProps {
  book: Book;
  userItem?: UserBookItem;
  userProfile?: UserProfile | null;
  preferences: ReaderPreferences;
  onUpdatePreferences: (prefs: ReaderPreferences) => void;
  onSaveProgress: (
    book: Book,
    paginaAtual: number,
    totalPaginasOverride?: number
  ) => void;
  onClose: () => void;
}

export const BookReader: React.FC<BookReaderProps> = ({
  book,
  userItem,
  userProfile,
  preferences,
  onUpdatePreferences,
  onSaveProgress,
  onClose,
}) => {
  const initialPage =
    userItem && userItem.paginaAtual >= 1 && userItem.paginaAtual <= (book.paginas || 1)
      ? userItem.paginaAtual
      : 1;

  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageInput, setPageInput] = useState<string>(String(initialPage));
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(false);
  const [savedIndicator, setSavedIndicator] = useState<boolean>(false);

  // Anotações e Marca-texto do usuário neste livro
  const [annotations, setAnnotations] = useState<BookAnnotation[]>([]);
  const [isLoadingAnnotations, setIsLoadingAnnotations] = useState<boolean>(false);

  // Comentários por parágrafo deste livro
  const [paragraphComments, setParagraphComments] = useState<BookParagraphComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
  const [activeCommentParagraphIdx, setActiveCommentParagraphIdx] = useState<number | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);

  // Modal de Comentário em Trecho Selecionado
  const [snippetCommentModal, setSnippetCommentModal] = useState<{
    open: boolean;
    selectedText: string;
    paragraphIndex: number;
    color: HighlightColor;
    comment: string;
  } | null>(null);

  // Popover Flutuante de Seleção de Texto
  const [floatingMenu, setFloatingMenu] = useState<FloatingMenuState | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // Textos extraídos do PDF sob demanda (se o livro não possuir capítulos cadastrados no catálogo)
  const [pdfParagraphsMap, setPdfParagraphsMap] = useState<Record<number, string[]>>({});
  const [isLoadingPdfPage, setIsLoadingPdfPage] = useState<boolean>(false);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const readingAreaRef = useRef<HTMLDivElement | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveTotalPages = Math.max(1, book.paginas || 1);

  // 1. Debounced save reading progress
  const triggerSaveProgress = useCallback(
    (page: number) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setSavedIndicator(true);
      saveTimeoutRef.current = setTimeout(() => {
        onSaveProgress(book, page, effectiveTotalPages);
        setSavedIndicator(false);
      }, 700);
    },
    [book, effectiveTotalPages, onSaveProgress]
  );

  const goToPage = useCallback(
    (targetPage: number) => {
      const clamped = Math.max(1, Math.min(effectiveTotalPages, targetPage));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      triggerSaveProgress(clamped);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [effectiveTotalPages, triggerSaveProgress]
  );

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Garante que o progresso inicial seja registrado
  useEffect(() => {
    onSaveProgress(book, currentPage, effectiveTotalPages);
  }, []);

  // 2. Atalhos de Teclado (Setas Esquerda/Direita para avançar páginas, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentPage < effectiveTotalPages) goToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentPage > 1) goToPage(currentPage - 1);
      } else if (e.key === 'Escape') {
        if (activeCommentParagraphIdx !== null) {
          setActiveCommentParagraphIdx(null);
        } else if (showNotesDrawer) {
          setShowNotesDrawer(false);
        } else if (showSettingsDrawer) {
          setShowSettingsDrawer(false);
        } else if (snippetCommentModal) {
          setSnippetCommentModal(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentPage,
    effectiveTotalPages,
    goToPage,
    onClose,
    activeCommentParagraphIdx,
    showNotesDrawer,
    showSettingsDrawer,
    snippetCommentModal,
  ]);

  // 3. Carregamento de Marcações (isolado para este usuário e livro)
  useEffect(() => {
    const userId = userProfile?.uid;
    if (!userId || !book.id) return;

    let isMounted = true;
    setIsLoadingAnnotations(true);

    const annotationsCol = collection(db, 'users', userId, 'book_annotations');
    getDocs(annotationsCol)
      .then((snapshot) => {
        if (!isMounted) return;
        const list: BookAnnotation[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as BookAnnotation;
          if (data.bookId === book.id) {
            list.push({ ...data, id: d.id });
          }
        });
        setAnnotations(list);
        setIsLoadingAnnotations(false);
      })
      .catch(() => {
        if (isMounted) setIsLoadingAnnotations(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userProfile?.uid, book.id]);

  // 4. Carregamento de Comentários nos Parágrafos (somente para este livro)
  useEffect(() => {
    if (!book.id) return;

    let isMounted = true;
    setIsLoadingComments(true);

    const commentsCol = collection(db, 'book_paragraph_comments');
    const q = query(commentsCol, where('bookId', '==', book.id));

    getDocs(q)
      .then((snapshot) => {
        if (!isMounted) return;
        const list: BookParagraphComment[] = [];
        snapshot.forEach((d) => {
          list.push({ ...(d.data() as BookParagraphComment), id: d.id });
        });
        // Ordena por data de criação
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setParagraphComments(list);
        setIsLoadingComments(false);
      })
      .catch(() => {
        if (isMounted) setIsLoadingComments(false);
      });

    return () => {
      isMounted = false;
    };
  }, [book.id]);

  // 5. Suporte a extração de texto real do PDF caso o livro não possua capítulos cadastrados
  const hasRegisteredChapters = Boolean(
    book.capitulos && book.capitulos.length > 0
  );
  const pdfUrl = book.readingOptions?.pdf?.url || book.pdfUrl || '';

  useEffect(() => {
    if (hasRegisteredChapters || !pdfUrl) return;

    let isMounted = true;

    const loadPdfDoc = async () => {
      if (pdfDocRef.current) return;
      try {
        const bytes = await fetchPdfBinaryData(pdfUrl);
        if (!isMounted) return;
        const docProxy = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (!isMounted) return;
        pdfDocRef.current = docProxy;
      } catch {
        // ignora
      }
    };

    void loadPdfDoc();
  }, [hasRegisteredChapters, pdfUrl]);

  // Extrai texto real da página atual caso venha do PDF
  useEffect(() => {
    if (hasRegisteredChapters || !pdfUrl || pdfParagraphsMap[currentPage]) {
      return;
    }

    let isMounted = true;
    setIsLoadingPdfPage(true);

    const extractText = async () => {
      try {
        if (!pdfDocRef.current) {
          const bytes = await fetchPdfBinaryData(pdfUrl);
          if (!isMounted) return;
          pdfDocRef.current = await pdfjsLib.getDocument({ data: bytes }).promise;
        }

        if (!pdfDocRef.current) return;
        const page = await pdfDocRef.current.getPage(currentPage);
        const textContent = await page.getTextContent();

        const items = textContent.items as Array<{
          str: string;
          transform: number[];
        }>;

        const lines: string[] = [];
        let currentLine = '';
        let lastY: number | null = null;

        for (const item of items) {
          const y = Math.round(item.transform[5]);
          if (lastY === null || Math.abs(y - lastY) <= 3) {
            currentLine += (currentLine ? ' ' : '') + item.str;
          } else {
            if (currentLine.trim()) lines.push(currentLine.trim());
            currentLine = item.str;
          }
          lastY = y;
        }
        if (currentLine.trim()) lines.push(currentLine.trim());

        // Agrupa em parágrafos reais
        const paragraphs: string[] = [];
        let currentP = '';
        for (const line of lines) {
          if (!line) {
            if (currentP.trim()) {
              paragraphs.push(currentP.trim());
              currentP = '';
            }
          } else {
            currentP += (currentP ? ' ' : '') + line;
          }
        }
        if (currentP.trim()) paragraphs.push(currentP.trim());

        if (isMounted) {
          setPdfParagraphsMap((prev) => ({
            ...prev,
            [currentPage]:
              paragraphs.length > 0
                ? paragraphs
                : book.descricao
                ? [book.descricao]
                : ['Texto desta página indisponível para exibição contínua.'],
          }));
          setIsLoadingPdfPage(false);
        }
      } catch {
        if (isMounted) {
          setPdfParagraphsMap((prev) => ({
            ...prev,
            [currentPage]: book.descricao ? [book.descricao] : [],
          }));
          setIsLoadingPdfPage(false);
        }
      }
    };

    void extractText();

    return () => {
      isMounted = false;
    };
  }, [hasRegisteredChapters, pdfUrl, currentPage, pdfParagraphsMap, book.descricao]);

  // Obtém o conteúdo real da página
  const pageContent = hasRegisteredChapters
    ? getPageContentForBook(book, currentPage)
    : {
        chapterNumber: 1,
        chapterTitle: book.titulo,
        paragraphs:
          pdfParagraphsMap[currentPage] ||
          (book.descricao ? [book.descricao] : []),
      };

  // 6. Manipulação de Seleção de Texto e Marca-texto Flutuante
  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setFloatingMenu(null);
      return;
    }

    const selectedText = sel.toString().trim();
    if (selectedText.length === 0) {
      setFloatingMenu(null);
      return;
    }

    // Identifica o índice do parágrafo onde ocorreu a seleção
    let anchorNode: Node | null = sel.anchorNode;
    let paragraphIndex = 0;

    while (anchorNode && anchorNode !== readingAreaRef.current) {
      if (
        anchorNode instanceof HTMLElement &&
        anchorNode.hasAttribute('data-paragraph-index')
      ) {
        paragraphIndex = Number(anchorNode.getAttribute('data-paragraph-index') || 0);
        break;
      }
      anchorNode = anchorNode.parentNode;
    }

    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const menuWidth = 280;
      const x = Math.max(
        12,
        Math.min(window.innerWidth - menuWidth - 12, rect.left + rect.width / 2 - menuWidth / 2)
      );
      const y = Math.max(12, rect.top + window.scrollY - 58);

      setFloatingMenu({
        visible: true,
        x,
        y,
        selectedText,
        paragraphIndex,
      });
    } catch {
      setFloatingMenu(null);
    }
  }, []);

  // Salva marcação com uma cor pastel
  const handleApplyHighlight = async (color: HighlightColor) => {
    if (!floatingMenu || !userProfile?.uid) return;
    const { selectedText, paragraphIndex } = floatingMenu;

    const newId = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAnnotation: BookAnnotation = {
      id: newId,
      bookId: book.id,
      userId: userProfile.uid,
      userDisplayName: userProfile.nome || userProfile.displayName || 'Leitor',
      userUsername: userProfile.username,
      paragraphIndex,
      selectedText,
      color,
      page: currentPage,
      createdAt: new Date().toISOString(),
    };

    // Atualização otimista imediata na interface
    setAnnotations((prev) => [newAnnotation, ...prev]);
    setFloatingMenu(null);
    window.getSelection()?.removeAllRanges();

    // Persiste no Firestore
    try {
      await setDoc(
        doc(db, 'users', userProfile.uid, 'book_annotations', newId),
        newAnnotation
      );
    } catch {
      // ignore
    }
  };

  // Remove uma marcação
  const handleRemoveAnnotation = async (annotationId: string) => {
    if (!userProfile?.uid) return;
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    try {
      await deleteDoc(
        doc(db, 'users', userProfile.uid, 'book_annotations', annotationId)
      );
    } catch {
      // ignore
    }
  };

  // Copia trecho selecionado para a área de transferência
  const handleCopySelectedText = async () => {
    if (!floatingMenu?.selectedText) return;
    try {
      await navigator.clipboard.writeText(floatingMenu.selectedText);
      setCopyFeedback(true);
      setTimeout(() => {
        setCopyFeedback(false);
        setFloatingMenu(null);
        window.getSelection()?.removeAllRanges();
      }, 1200);
    } catch {
      // fallback
    }
  };

  // Salva comentário em trecho selecionado
  const handleSaveSnippetComment = async () => {
    if (
      !snippetCommentModal ||
      !snippetCommentModal.comment.trim() ||
      !userProfile?.uid
    ) {
      return;
    }

    const { selectedText, paragraphIndex, color, comment } = snippetCommentModal;
    const newAnnId = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newCommentId = `pcomm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newAnnotation: BookAnnotation = {
      id: newAnnId,
      bookId: book.id,
      userId: userProfile.uid,
      userDisplayName: userProfile.nome || userProfile.displayName || 'Leitor',
      userUsername: userProfile.username,
      paragraphIndex,
      selectedText,
      color,
      comment: comment.trim(),
      page: currentPage,
      createdAt: new Date().toISOString(),
    };

    const newParagraphComment: BookParagraphComment = {
      id: newCommentId,
      bookId: book.id,
      paragraphIndex,
      paragraphSnippet: selectedText,
      selectedText,
      userId: userProfile.uid,
      userName: userProfile.nome || userProfile.displayName || 'Leitor',
      userUsername: userProfile.username,
      userPhoto: userProfile.foto || userProfile.photoURL,
      userColor: userProfile.usernameColor,
      text: comment.trim(),
      page: currentPage,
      createdAt: new Date().toISOString(),
    };

    // Atualização otimista imediata
    setAnnotations((prev) => [newAnnotation, ...prev]);
    setParagraphComments((prev) => [...prev, newParagraphComment]);
    setSnippetCommentModal(null);
    setFloatingMenu(null);
    window.getSelection()?.removeAllRanges();

    // Persistência em Firestore
    try {
      await Promise.all([
        setDoc(
          doc(db, 'users', userProfile.uid, 'book_annotations', newAnnId),
          newAnnotation
        ),
        setDoc(
          doc(db, 'book_paragraph_comments', newCommentId),
          newParagraphComment
        ),
      ]);
    } catch {
      // ignore
    }
  };

  // Envia comentário geral em um parágrafo
  const handlePostParagraphComment = async () => {
    if (
      activeCommentParagraphIdx === null ||
      !newCommentText.trim() ||
      !userProfile?.uid ||
      isSubmittingComment
    ) {
      return;
    }

    setIsSubmittingComment(true);
    const newId = `pcomm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const paragraphText =
      pageContent.paragraphs[activeCommentParagraphIdx] || '';

    const newComment: BookParagraphComment = {
      id: newId,
      bookId: book.id,
      paragraphIndex: activeCommentParagraphIdx,
      paragraphSnippet:
        paragraphText.length > 120
          ? `${paragraphText.slice(0, 120)}...`
          : paragraphText,
      userId: userProfile.uid,
      userName: userProfile.nome || userProfile.displayName || 'Leitor',
      userUsername: userProfile.username,
      userPhoto: userProfile.foto || userProfile.photoURL,
      userColor: userProfile.usernameColor,
      text: newCommentText.trim(),
      page: currentPage,
      createdAt: new Date().toISOString(),
    };

    // Otimista
    setParagraphComments((prev) => [...prev, newComment]);
    setNewCommentText('');

    try {
      await setDoc(doc(db, 'book_paragraph_comments', newId), newComment);
    } catch {
      // ignore
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Exclui comentário de parágrafo
  const handleDeleteParagraphComment = async (commentId: string) => {
    setParagraphComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await deleteDoc(doc(db, 'book_paragraph_comments', commentId));
    } catch {
      // ignore
    }
  };

  // 7. Mapeamento dos 3 Temas Oficiais (Claro, Creme, Escuro)
  const effectiveTheme: 'claro' | 'creme' | 'escuro' =
    preferences.theme === 'light'
      ? 'claro'
      : preferences.theme === 'sepia'
      ? 'creme'
      : 'escuro';

  const themeConfig = {
    claro: {
      bg: 'bg-[#F8F6F0]',
      paper:
        'bg-white text-[#1C1917] border-stone-200/90 shadow-[0_12px_45px_-8px_rgba(0,0,0,0.06)]',
      header: 'bg-white/95 border-stone-200/80 text-stone-900',
      muted: 'text-stone-500',
      border: 'border-stone-200',
      accent: 'text-[#2563EB]',
      drawer: 'bg-white border-stone-200 text-stone-900',
      drawerInput: 'bg-stone-50 border-stone-200 text-stone-900',
      pageBtn: 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-200',
      footer: 'bg-white/95 border-stone-200/90 text-stone-900',
    },
    creme: {
      bg: 'bg-[#F4ECD8]',
      paper:
        'bg-[#FAF3E3] text-[#34291E] border-[#E5D7BF] shadow-[0_12px_45px_-8px_rgba(60,45,30,0.08)]',
      header: 'bg-[#FAF3E3]/95 border-[#E5D7BF] text-[#34291E]',
      muted: 'text-[#7C6953]',
      border: 'border-[#E5D7BF]',
      accent: 'text-[#B45309]',
      drawer: 'bg-[#FAF3E3] border-[#E5D7BF] text-[#34291E]',
      drawerInput: 'bg-[#F4ECD8] border-[#E5D7BF] text-[#34291E]',
      pageBtn: 'bg-[#EDE2CA] hover:bg-[#E2D5BA] text-[#34291E] border-[#DACBaf]',
      footer: 'bg-[#FAF3E3]/95 border-[#E5D7BF] text-[#34291E]',
    },
    escuro: {
      bg: 'bg-[#0B0E14]',
      paper:
        'bg-[#111622] text-[#E5E2DC] border-white/10 shadow-[0_15px_50px_-10px_rgba(0,0,0,0.65)]',
      header: 'bg-[#111622]/95 border-white/10 text-white',
      muted: 'text-[#8B93A4]',
      border: 'border-white/10',
      accent: 'text-[#60A5FA]',
      drawer: 'bg-[#111622] border-white/10 text-white',
      drawerInput: 'bg-[#0B0E14] border-white/10 text-white',
      pageBtn: 'bg-[#182030] hover:bg-[#202B40] text-white border-white/10',
      footer: 'bg-[#111622]/95 border-white/10 text-white',
    },
  }[effectiveTheme];

  const handleSetTheme = (theme: 'claro' | 'creme' | 'escuro') => {
    const mapped =
      theme === 'claro' ? 'light' : theme === 'creme' ? 'sepia' : 'dark';
    onUpdatePreferences({ ...preferences, theme: mapped });
  };

  const handleFontSizeChange = (delta: number) => {
    const currentSize = preferences.fontSize || 18;
    const newSize = Math.max(15, Math.min(28, currentSize + delta));
    onUpdatePreferences({ ...preferences, fontSize: newSize });
  };

  const progressPercent = Math.min(
    100,
    Math.max(1, Math.round((currentPage / effectiveTotalPages) * 100))
  );

  // 8. Renderizador de Parágrafo com Marcações Sobrepostas
  const renderParagraphWithHighlights = (
    text: string,
    paragraphIndex: number
  ) => {
    const paraAnnotations = annotations.filter(
      (a) => a.paragraphIndex === paragraphIndex
    );

    if (paraAnnotations.length === 0) {
      return <span>{text}</span>;
    }

    // Localiza ocorrências para fatiamento limpo
    const segments: Array<{
      text: string;
      isHighlighted: boolean;
      annotation?: BookAnnotation;
    }> = [];

    let cursor = 0;
    // Ordena por posição de início no parágrafo
    const matched = paraAnnotations
      .map((ann) => ({
        ann,
        idx: text.indexOf(ann.selectedText),
      }))
      .filter((m) => m.idx !== -1)
      .sort((a, b) => a.idx - b.idx);

    for (const { ann, idx } of matched) {
      if (idx > cursor) {
        segments.push({
          text: text.slice(cursor, idx),
          isHighlighted: false,
        });
      }
      if (idx >= cursor) {
        segments.push({
          text: ann.selectedText,
          isHighlighted: true,
          annotation: ann,
        });
        cursor = idx + ann.selectedText.length;
      }
    }

    if (cursor < text.length) {
      segments.push({
        text: text.slice(cursor),
        isHighlighted: false,
      });
    }

    return (
      <>
        {segments.map((seg, sIdx) => {
          if (!seg.isHighlighted || !seg.annotation) {
            return <span key={sIdx}>{seg.text}</span>;
          }

          const col = PASTEL_COLORS[seg.annotation.color] || PASTEL_COLORS.yellow;
          const isDark = effectiveTheme === 'escuro';

          return (
            <mark
              key={sIdx}
              onClick={(e) => {
                e.stopPropagation();
                if (
                  confirm(
                    `Remover esta marcação "${seg.annotation?.selectedText.slice(
                      0,
                      30
                    )}..."?`
                  )
                ) {
                  void handleRemoveAnnotation(seg.annotation!.id);
                }
              }}
              title={
                seg.annotation.comment
                  ? `Comentário: ${seg.annotation.comment} (Clique para remover)`
                  : 'Trecho marcado (Clique para remover)'
              }
              className="rounded px-0.5 py-0.5 cursor-pointer transition-all hover:opacity-85 select-text"
              style={{
                backgroundColor: isDark ? col.bgDark : col.bgLight,
                color: isDark ? col.textDark : col.textLight,
                boxShadow: `inset 0 -2px 0 ${isDark ? col.borderDark : col.borderLight}`,
              }}
            >
              {seg.text}
              {seg.annotation.comment && (
                <span className="inline-block ml-1 text-[11px] align-top select-none opacity-85">
                  💬
                </span>
              )}
            </mark>
          );
        })}
      </>
    );
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed)) {
      goToPage(parsed);
    } else {
      setPageInput(String(currentPage));
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 flex flex-col justify-between ${themeConfig.bg}`}
    >
      {/* Barra Superior Minimalista do Leitor LIVROFLIX */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${themeConfig.header}`}
      >
        <div className="mx-auto max-w-5xl px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          {/* Esquerda: Sair da Leitura + Título da Obra */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold border border-current/20 hover:bg-current/10 transition-colors cursor-pointer shrink-0"
              title="Voltar ao livro"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar ao livro</span>
            </button>

            <div className="min-w-0">
              <h1 className="font-display text-sm sm:text-base font-bold truncate leading-tight">
                {book.titulo}
              </h1>
              <p className={`text-[11px] truncate ${themeConfig.muted}`}>
                {book.autor} · Leitor LIVROFLIX
              </p>
            </div>
          </div>

          {/* Direita: Controles de Tamanho (A- / A+), Temas (Claro, Creme, Escuro) e Minhas Marcações */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Indicador sutil de salvamento automático */}
            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono">
              <span
                className={`transition-opacity duration-300 ${
                  savedIndicator ? 'opacity-100 text-emerald-500' : 'opacity-40'
                }`}
              >
                ●
              </span>
              <span className={`text-[11px] ${themeConfig.muted}`}>
                Pág. {currentPage} ({progressPercent}%)
              </span>
            </div>

            {/* Controle de Tamanho de Texto: A- / A+ */}
            <div
              className={`flex items-center rounded-lg border p-0.5 ${themeConfig.border}`}
              title="Ajustar tamanho da fonte"
            >
              <button
                type="button"
                onClick={() => handleFontSizeChange(-1)}
                disabled={(preferences.fontSize || 18) <= 15}
                aria-label="Diminuir tamanho do texto"
                className="px-2 py-1 text-xs font-bold hover:bg-current/10 rounded disabled:opacity-35 cursor-pointer"
              >
                A−
              </button>
              <span className="px-1 text-[11px] font-mono opacity-80 select-none">
                {preferences.fontSize || 18}
              </span>
              <button
                type="button"
                onClick={() => handleFontSizeChange(1)}
                disabled={(preferences.fontSize || 18) >= 28}
                aria-label="Aumentar tamanho do texto"
                className="px-2 py-1 text-xs font-bold hover:bg-current/10 rounded disabled:opacity-35 cursor-pointer"
              >
                A+
              </button>
            </div>

            {/* Alternador de Temas Visuais: Claro / Creme / Escuro */}
            <div
              className={`hidden sm:flex items-center rounded-lg border p-0.5 ${themeConfig.border}`}
            >
              <button
                type="button"
                onClick={() => handleSetTheme('claro')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  effectiveTheme === 'claro'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-current/75 hover:bg-current/10'
                }`}
              >
                Claro
              </button>
              <button
                type="button"
                onClick={() => handleSetTheme('creme')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  effectiveTheme === 'creme'
                    ? 'bg-[#B45309] text-white shadow-sm'
                    : 'text-current/75 hover:bg-current/10'
                }`}
              >
                Creme
              </button>
              <button
                type="button"
                onClick={() => handleSetTheme('escuro')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  effectiveTheme === 'escuro'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-current/75 hover:bg-current/10'
                }`}
              >
                Escuro
              </button>
            </div>

            {/* Botão Minhas Marcações */}
            <button
              type="button"
              onClick={() => setShowNotesDrawer(true)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${themeConfig.border} hover:bg-current/10`}
              title="Acessar minhas marcações neste livro"
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Marcações</span>
              {annotations.length > 0 && (
                <span className="rounded-full bg-amber-500 text-white font-mono text-[10px] px-1.5 py-0.2">
                  {annotations.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Linha Fina Contínua de Progresso */}
        <div className="h-0.5 w-full bg-current/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-amber-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Área Central de Leitura Estilo Livro Digital Confortável */}
      <main
        className="flex-1 flex justify-center px-3 sm:px-8 py-6 sm:py-12"
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        <div
          ref={readingAreaRef}
          className={`w-full max-w-2xl sm:max-w-3xl rounded-xl p-6 sm:p-12 transition-all font-serif ${themeConfig.paper}`}
          style={{
            fontSize: `${preferences.fontSize || 18}px`,
            lineHeight: preferences.lineHeight || 1.85,
          }}
        >
          {/* Cabeçalho Literário Discreto */}
          <header className="mb-8 pb-5 border-b border-current/10 text-center select-none">
            <p className="text-[11px] uppercase tracking-widest opacity-60 font-sans font-semibold mb-1.5">
              Página {currentPage} de {effectiveTotalPages}
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
              {pageContent.chapterTitle}
            </h2>
          </header>

          {/* Corpo do Texto Literário */}
          {isLoadingPdfPage && !pageContent.paragraphs.length ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
              <p className={`text-xs ${themeConfig.muted}`}>
                Carregando texto da página...
              </p>
            </div>
          ) : (
            <div className="space-y-6 text-left selection:bg-amber-200 selection:text-stone-900">
              {pageContent.paragraphs.map((paragraph, pIdx) => {
                const commentsCount = paragraphComments.filter(
                  (c) => c.paragraphIndex === pIdx
                ).length;

                return (
                  <div
                    key={pIdx}
                    data-paragraph-index={pIdx}
                    className="relative group rounded p-1 -m-1 transition-colors hover:bg-current/3"
                  >
                    <p className="leading-relaxed">
                      {renderParagraphWithHighlights(paragraph, pIdx)}
                    </p>

                    {/* Botão / Indicador de Comentários no Parágrafo */}
                    <div className="mt-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setActiveCommentParagraphIdx(pIdx)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-sans font-medium transition-all cursor-pointer ${
                          commentsCount > 0
                            ? 'bg-blue-500/15 text-blue-500 border border-blue-400/30 opacity-100'
                            : 'opacity-0 group-hover:opacity-80 hover:bg-current/10 border border-current/15 text-[11px]'
                        }`}
                        title={
                          commentsCount > 0
                            ? `${commentsCount} comentário(s) neste parágrafo`
                            : 'Comentar neste parágrafo'
                        }
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>
                          {commentsCount > 0 ? commentsCount : 'Comentar'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Menu Flutuante ao Selecionar Texto (Cores Pastéis + Comentar + Copiar) */}
      {floatingMenu?.visible && (
        <div
          className="fixed z-50 rounded-xl bg-[#071426] border border-blue-400/30 p-2 shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150 select-none text-white"
          style={{
            left: `${floatingMenu.x}px`,
            top: `${floatingMenu.y}px`,
          }}
        >
          {/* Cores Pastéis do Marca-texto */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-white/15">
            {(Object.keys(PASTEL_COLORS) as HighlightColor[]).map((cKey) => {
              const c = PASTEL_COLORS[cKey];
              return (
                <button
                  key={cKey}
                  type="button"
                  onClick={() => void handleApplyHighlight(cKey)}
                  className="w-5 h-5 rounded-full border border-black/20 hover:scale-125 transition-transform cursor-pointer"
                  style={{ backgroundColor: c.bgLight }}
                  title={c.name}
                  aria-label={c.name}
                />
              );
            })}
          </div>

          {/* Botão Comentar no Trecho */}
          <button
            type="button"
            onClick={() => {
              setSnippetCommentModal({
                open: true,
                selectedText: floatingMenu.selectedText,
                paragraphIndex: floatingMenu.paragraphIndex,
                color: 'yellow',
                comment: '',
              });
              setFloatingMenu(null);
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded hover:bg-white/10 transition-colors cursor-pointer text-blue-200"
            title="Comentar sobre este trecho"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            <span>Comentar</span>
          </button>

          {/* Botão Copiar */}
          <button
            type="button"
            onClick={() => void handleCopySelectedText()}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded hover:bg-white/10 transition-colors cursor-pointer text-slate-200"
            title="Copiar texto"
          >
            {copyFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Barra Inferior de Navegação e Contador de Páginas */}
      <footer
        className={`sticky bottom-0 z-30 border-t backdrop-blur-md transition-colors ${themeConfig.footer}`}
      >
        <div className="mx-auto max-w-4xl px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
          {/* Botão Página Anterior */}
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${themeConfig.pageBtn}`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Página anterior</span>
            <span className="sm:hidden">Anterior</span>
          </button>

          {/* Campo Numérico de Ir para Página */}
          <form
            onSubmit={handlePageInputSubmit}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-mono tabular-nums"
          >
            <span className={`hidden sm:inline ${themeConfig.muted}`}>
              Página
            </span>
            <input
              type="number"
              min={1}
              max={effectiveTotalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageInputSubmit}
              className={`w-14 sm:w-16 rounded-md border px-2 py-1 text-center font-bold focus:outline-none ${themeConfig.border} ${themeConfig.bg}`}
              aria-label="Número da página atual"
            />
            <span className={themeConfig.muted}>
              de {effectiveTotalPages} ·{' '}
              <strong className={themeConfig.accent}>{progressPercent}%</strong>
            </span>
          </form>

          {/* Botão Próxima Página */}
          <button
            type="button"
            disabled={currentPage >= effectiveTotalPages}
            onClick={() => goToPage(currentPage + 1)}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition-colors cursor-pointer disabled:opacity-35 disabled:pointer-events-none"
          >
            <span className="hidden sm:inline">Próxima página</span>
            <span className="sm:hidden">Próxima</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* GAVETA LATERAL: Comentários do Parágrafo */}
      {activeCommentParagraphIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveCommentParagraphIdx(null)}
        >
          <div
            className={`w-full max-w-md h-full flex flex-col p-5 sm:p-6 shadow-2xl border-l animate-in slide-in-from-right duration-200 ${themeConfig.drawer}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Topo do Drawer */}
            <div className="flex items-center justify-between pb-4 border-b border-current/10">
              <div>
                <h3 className="font-display text-lg font-bold">
                  Comentários no Parágrafo
                </h3>
                <p className={`text-xs ${themeConfig.muted}`}>
                  Parágrafo {activeCommentParagraphIdx + 1} · Página {currentPage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCommentParagraphIdx(null)}
                className="p-1 rounded-lg hover:bg-current/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trecho do Parágrafo Real */}
            <div className={`my-4 p-3 rounded-lg border text-xs italic ${themeConfig.border} bg-current/5 leading-relaxed`}>
              “
              {pageContent.paragraphs[activeCommentParagraphIdx]?.slice(0, 180)}
              {(pageContent.paragraphs[activeCommentParagraphIdx]?.length || 0) > 180
                ? '...'
                : ''}
              ”
            </div>

            {/* Lista de Comentários */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1">
              {paragraphComments.filter(
                (c) => c.paragraphIndex === activeCommentParagraphIdx
              ).length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
                  <p className="text-xs opacity-60">
                    Ainda não há comentários neste parágrafo.
                  </p>
                  <p className="text-[11px] opacity-40">
                    Compartilhe sua reflexão abaixo.
                  </p>
                </div>
              ) : (
                paragraphComments
                  .filter((c) => c.paragraphIndex === activeCommentParagraphIdx)
                  .map((comment) => (
                    <div
                      key={comment.id}
                      className={`p-3.5 rounded-xl border ${themeConfig.border} bg-current/3 space-y-1.5`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {comment.userPhoto ? (
                            <img
                              src={comment.userPhoto}
                              alt={comment.userName}
                              className="w-6 h-6 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 font-bold text-xs flex items-center justify-center shrink-0">
                              {comment.userName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className="font-bold text-xs truncate"
                            style={{
                              color: comment.userColor || undefined,
                            }}
                          >
                            {comment.userName}
                          </span>
                          {comment.userUsername && (
                            <span className={`text-[10px] truncate ${themeConfig.muted}`}>
                              @{comment.userUsername}
                            </span>
                          )}
                        </div>

                        {/* Botão de Excluir seu próprio comentário */}
                        {userProfile?.uid &&
                          comment.userId === userProfile.uid && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteParagraphComment(comment.id)
                              }
                              className="p-1 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                              title="Excluir meu comentário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                      </div>

                      {/* Se o comentário foi feito sobre um trecho específico */}
                      {comment.selectedText && (
                        <div className="text-[11px] italic pl-2 border-l-2 border-amber-400/60 opacity-80 my-1">
                          “{comment.selectedText}”
                        </div>
                      )}

                      <p className="text-xs leading-relaxed break-words">
                        {comment.text}
                      </p>
                    </div>
                  ))
              )}
            </div>

            {/* Campo de Envio de Novo Comentário */}
            <div className="pt-3 border-t border-current/10 space-y-2">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Escreva sua reflexão sobre este parágrafo..."
                rows={3}
                maxLength={1000}
                className={`w-full rounded-lg border p-2.5 text-xs focus:outline-none resize-none ${themeConfig.drawerInput}`}
              />
              <div className="flex items-center justify-between">
                <span className={`text-[10px] ${themeConfig.muted}`}>
                  {newCommentText.length}/1000
                </span>
                <button
                  type="button"
                  disabled={!newCommentText.trim() || isSubmittingComment}
                  onClick={() => void handlePostParagraphComment()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-4 py-2 text-xs font-bold text-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  {isSubmittingComment ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Publicar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GAVETA LATERAL: Minhas Marcações e Notas neste Livro */}
      {showNotesDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowNotesDrawer(false)}
        >
          <div
            className={`w-full max-w-md h-full flex flex-col p-5 sm:p-6 shadow-2xl border-l animate-in slide-in-from-right duration-200 ${themeConfig.drawer}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Topo do Drawer de Marcações */}
            <div className="flex items-center justify-between pb-4 border-b border-current/10">
              <div className="flex items-center gap-2">
                <Highlighter className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-display text-lg font-bold">
                    Minhas Marcações
                  </h3>
                  <p className={`text-xs ${themeConfig.muted}`}>
                    {annotations.length} destaque(s) salvo(s) neste livro
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotesDrawer(false)}
                className="p-1 rounded-lg hover:bg-current/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de Marcações */}
            <div className="flex-1 overflow-y-auto space-y-3.5 py-4 pr-1">
              {isLoadingAnnotations ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                </div>
              ) : annotations.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <Bookmark className="w-10 h-10 mx-auto opacity-25 text-amber-500" />
                  <p className="text-sm font-bold">
                    Nenhuma marcação neste livro
                  </p>
                  <p className={`text-xs max-w-xs mx-auto leading-relaxed ${themeConfig.muted}`}>
                    Selecione qualquer trecho do texto durante a leitura para destacar com cores pastéis ou adicionar anotações.
                  </p>
                </div>
              ) : (
                annotations.map((ann) => {
                  const col = PASTEL_COLORS[ann.color] || PASTEL_COLORS.yellow;
                  const isDark = effectiveTheme === 'escuro';

                  return (
                    <div
                      key={ann.id}
                      className={`p-3.5 rounded-xl border ${themeConfig.border} bg-current/3 space-y-2`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: col.bgLight }}
                          />
                          <span className="font-medium">
                            Pág. {ann.page || 1} · Parágrafo{' '}
                            {(ann.paragraphIndex || 0) + 1}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRemoveAnnotation(ann.id)}
                          className="text-rose-400 hover:text-rose-500 p-1 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remover marcação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Trecho Marcado */}
                      <div
                        onClick={() => {
                          if (ann.page) goToPage(ann.page);
                          setShowNotesDrawer(false);
                        }}
                        className="p-2.5 rounded text-xs italic leading-relaxed cursor-pointer hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: isDark ? col.bgDark : col.bgLight,
                          color: isDark ? col.textDark : col.textLight,
                        }}
                        title="Clique para ir até este trecho"
                      >
                        “{ann.selectedText}”
                      </div>

                      {/* Comentário da anotação, se houver */}
                      {ann.comment && (
                        <div className="text-xs p-2 rounded bg-current/5 border border-current/10 flex items-start gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{ann.comment}</span>
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (ann.page) goToPage(ann.page);
                            setShowNotesDrawer(false);
                          }}
                          className="text-[11px] font-semibold text-blue-500 hover:underline cursor-pointer"
                        >
                          Ir para o trecho →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Comentário em Trecho Específico */}
      {snippetCommentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setSnippetCommentModal(null)}
        >
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border text-left space-y-4 ${themeConfig.drawer}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                <h3 className="font-display text-lg font-bold">
                  Comentar no Trecho
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSnippetCommentModal(null)}
                className="p-1 rounded-lg hover:bg-current/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trecho Quitado */}
            <div className="p-3 rounded-lg border text-xs italic bg-current/5 border-current/10 leading-relaxed">
              “{snippetCommentModal.selectedText}”
            </div>

            {/* Escolha da Cor Pastel para o Destaque do Trecho */}
            <div>
              <label className={`block text-xs font-semibold mb-2 ${themeConfig.muted}`}>
                Cor do Marca-texto para este trecho:
              </label>
              <div className="flex items-center gap-2">
                {(Object.keys(PASTEL_COLORS) as HighlightColor[]).map((cKey) => {
                  const c = PASTEL_COLORS[cKey];
                  const isSelected = snippetCommentModal.color === cKey;
                  return (
                    <button
                      key={cKey}
                      type="button"
                      onClick={() =>
                        setSnippetCommentModal((prev) =>
                          prev ? { ...prev, color: cKey } : null
                        )
                      }
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 scale-110 shadow-md ring-2 ring-blue-400/40'
                          : 'border-black/20 hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.bgLight }}
                      title={c.name}
                    />
                  );
                })}
              </div>
            </div>

            {/* Campo de Texto para o Comentário */}
            <div className="space-y-1">
              <label className={`block text-xs font-semibold ${themeConfig.muted}`}>
                Seu comentário:
              </label>
              <textarea
                value={snippetCommentModal.comment}
                onChange={(e) =>
                  setSnippetCommentModal((prev) =>
                    prev ? { ...prev, comment: e.target.value } : null
                  )
                }
                placeholder="Escreva sua reflexão ou anotação sobre este trecho..."
                rows={4}
                maxLength={1000}
                className={`w-full rounded-lg border p-3 text-xs focus:outline-none resize-none ${themeConfig.drawerInput}`}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSnippetCommentModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-current/10 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!snippetCommentModal.comment.trim()}
                onClick={() => void handleSaveSnippetComment()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-5 py-2 text-xs font-bold text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Salvar Comentário</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
