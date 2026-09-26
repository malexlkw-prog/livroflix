import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings,
  BookOpen,
  Sun,
  Moon,
  Sparkles,
  CheckCircle2,
  Bookmark,
} from 'lucide-react';
import { Book, ReaderPreferences, UserBookItem } from '../types';
import { getPageContentForBook } from '../data/catalog';

interface BookReaderProps {
  book: Book;
  userItem?: UserBookItem;
  preferences: ReaderPreferences;
  onUpdatePreferences: (prefs: ReaderPreferences) => void;
  onSaveProgress: (book: Book, paginaAtual: number) => void;
  onClose: () => void;
}

export const BookReader: React.FC<BookReaderProps> = ({
  book,
  userItem,
  preferences,
  onUpdatePreferences,
  onSaveProgress,
  onClose,
}) => {
  const initialPage =
    userItem && userItem.paginaAtual >= 1 && userItem.paginaAtual <= book.paginas
      ? userItem.paginaAtual
      : 1;

  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [pageInput, setPageInput] = useState<string>(String(initialPage));
  const [savedIndicator, setSavedIndicator] = useState<boolean>(false);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Save reading progress automatically whenever page changes
  const goToPage = (targetPage: number) => {
    const clamped = Math.max(1, Math.min(book.paginas, targetPage));
    setCurrentPage(clamped);
    onSaveProgress(book, clamped);
    setSavedIndicator(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = setTimeout(() => setSavedIndicator(false), 1800);
    return () => clearTimeout(timer);
  }, [currentPage]);

  // Ensure initial open registers the book in "Continue reading"
  useEffect(() => {
    onSaveProgress(book, currentPage);
  }, []);

  // Keyboard navigation support (Left/Right arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') {
        if (currentPage < book.paginas) goToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft') {
        if (currentPage > 1) goToPage(currentPage - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, book.paginas]);

  const progressPercent = Math.min(
    100,
    Math.max(1, Math.round((currentPage / book.paginas) * 100))
  );

  const pageContent = getPageContentForBook(book, currentPage);

  // Theme styles (#7: modo claro, modo escuro, modo sépia)
  const themeStyles = {
    dark: {
      bg: 'bg-[#0F1117]',
      headerBg: 'bg-[#0B0C10]/95 border-white/10',
      text: 'text-[#E5E2DC]',
      muted: 'text-[#9A968E]',
      accent: 'text-[#D99B26]',
      cardBg: 'bg-[#171A24] border-white/10',
    },
    sepia: {
      bg: 'bg-[#F4ECD8]',
      headerBg: 'bg-[#EAE0C8]/95 border-[#3E3227]/15',
      text: 'text-[#34291E]',
      muted: 'text-[#73604C]',
      accent: 'text-[#9A4E1C]',
      cardBg: 'bg-[#EAE0C8] border-[#3E3227]/15',
    },
    light: {
      bg: 'bg-[#FAF8F5]',
      headerBg: 'bg-[#F2EFE9]/95 border-stone-300',
      text: 'text-[#1C1917]',
      muted: 'text-[#68625B]',
      accent: 'text-[#B45309]',
      cardBg: 'bg-white border-stone-200',
    },
  }[preferences.theme];

  const fontFamilyClass =
    preferences.fontFamily === 'editorial'
      ? 'font-reader'
      : preferences.fontFamily === 'classic'
      ? 'font-display'
      : 'font-sans-ui';

  const maxWidthClass =
    preferences.maxWidth === 'narrow'
      ? 'max-w-[54ch]'
      : preferences.maxWidth === 'comfortable'
      ? 'max-w-[66ch]'
      : 'max-w-[80ch]';

  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed)) {
      goToPage(parsed);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 flex flex-col justify-between ${themeStyles.bg} ${themeStyles.text}`}
    >
      {/* Top Reader Bar */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${themeStyles.headerBg}`}
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Left: Exit Reader + Book Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold border border-current/15 hover:bg-current/5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Sair da leitura</span>
            </button>

            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold truncate leading-tight">
                {book.titulo}
              </h1>
              <p className={`text-[11px] truncate ${themeStyles.muted}`}>
                {book.autor} • {pageContent.chapterTitle}
              </p>
            </div>
          </div>

          {/* Right: Auto-save status, Page indicator & Settings button */}
          <div className="flex items-center gap-2.5 sm:gap-4 flex-shrink-0">
            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono-num">
              <CheckCircle2
                className={`w-3.5 h-3.5 transition-opacity ${
                  savedIndicator ? 'opacity-100 text-emerald-500' : 'opacity-50'
                }`}
              />
              <span className={themeStyles.muted}>
                Salvo na pág. {currentPage} ({progressPercent}%)
              </span>
            </div>

            {/* Chapter Quick Selector */}
            {book.capitulos && book.capitulos.length > 1 && (
              <select
                value={
                  book.capitulos
                    .slice()
                    .reverse()
                    .find((c) => currentPage >= c.paginaInicial)?.paginaInicial || 1
                }
                onChange={(e) => goToPage(Number(e.target.value))}
                className={`hidden sm:block rounded-lg border px-2.5 py-1.5 text-xs font-medium bg-transparent cursor-pointer ${themeStyles.cardBg}`}
              >
                {book.capitulos.map((cap) => (
                  <option
                    key={cap.numero}
                    value={cap.paginaInicial}
                    className="bg-[#12141C] text-[#F4F1EA]"
                  >
                    Cap. {cap.numero} (Pág. {cap.paginaInicial})
                  </option>
                ))}
              </select>
            )}

            {/* Settings Toggle (Aa) */}
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                showSettings
                  ? 'bg-[#D99B26] text-[#0B0C10] border-[#D99B26]'
                  : 'border-current/20 hover:bg-current/5'
              }`}
              title="Configurações de leitura"
            >
              <Settings className="w-4 h-4" />
              <span>Aa</span>
            </button>
          </div>
        </div>

        {/* Continuous Subtle Progress Line */}
        <div className="h-1 w-full bg-current/10 overflow-hidden">
          <div
            className="h-full bg-[#D99B26] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Settings Drawer / Popover */}
        {showSettings && (
          <div
            className={`border-b shadow-2xl transition-all ${themeStyles.cardBg}`}
          >
            <div className="mx-auto max-w-4xl px-4 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 text-xs">
              {/* 1. Tema (Modo Claro, Sépia, Escuro) */}
              <div className="space-y-2">
                <label className={`font-semibold uppercase tracking-wider block ${themeStyles.muted}`}>
                  Tema de Leitura
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({ ...preferences, theme: 'light' })
                    }
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 font-medium cursor-pointer ${
                      preferences.theme === 'light'
                        ? 'border-[#D99B26] ring-2 ring-[#D99B26]/40 bg-[#FAF8F5] text-[#1C1917]'
                        : 'border-current/15 bg-[#FAF8F5] text-[#1C1917]'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>Claro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({ ...preferences, theme: 'sepia' })
                    }
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 font-medium cursor-pointer ${
                      preferences.theme === 'sepia'
                        ? 'border-[#D99B26] ring-2 ring-[#D99B26]/40 bg-[#F4ECD8] text-[#34291E]'
                        : 'border-current/15 bg-[#F4ECD8] text-[#34291E]'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Sépia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({ ...preferences, theme: 'dark' })
                    }
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 font-medium cursor-pointer ${
                      preferences.theme === 'dark'
                        ? 'border-[#D99B26] ring-2 ring-[#D99B26]/40 bg-[#0F1117] text-[#F4F1EA]'
                        : 'border-current/15 bg-[#0F1117] text-[#F4F1EA]'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>Escuro</span>
                  </button>
                </div>
              </div>

              {/* 2. Tamanho da Fonte */}
              <div className="space-y-2">
                <label className={`font-semibold uppercase tracking-wider block ${themeStyles.muted}`}>
                  Tamanho da Fonte ({preferences.fontSize}px)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({
                        ...preferences,
                        fontSize: Math.max(15, preferences.fontSize - 2),
                      })
                    }
                    className="flex-1 rounded-lg border border-current/20 py-2 font-bold hover:bg-current/5 cursor-pointer"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({
                        ...preferences,
                        fontSize: Math.min(28, preferences.fontSize + 2),
                      })
                    }
                    className="flex-1 rounded-lg border border-current/20 py-2 font-bold hover:bg-current/5 cursor-pointer"
                  >
                    A+
                  </button>
                </div>
              </div>

              {/* 3. Tipo de Fonte */}
              <div className="space-y-2">
                <label className={`font-semibold uppercase tracking-wider block ${themeStyles.muted}`}>
                  Tipografia
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'editorial', label: 'Editorial' },
                      { id: 'classic', label: 'Clássica' },
                      { id: 'modern', label: 'Moderna' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        onUpdatePreferences({ ...preferences, fontFamily: f.id })
                      }
                      className={`rounded-lg border py-2 px-1.5 font-medium cursor-pointer ${
                        preferences.fontFamily === f.id
                          ? 'bg-[#D99B26] text-[#0B0C10] border-[#D99B26] font-semibold'
                          : 'border-current/20 hover:bg-current/5'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Espaçamento */}
              <div className="space-y-2">
                <label className={`font-semibold uppercase tracking-wider block ${themeStyles.muted}`}>
                  Espaçamento
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { val: 1.5, label: 'Compacto' },
                    { val: 1.85, label: 'Ideal' },
                    { val: 2.2, label: 'Amplo' },
                  ].map((lh) => (
                    <button
                      key={lh.val}
                      type="button"
                      onClick={() =>
                        onUpdatePreferences({ ...preferences, lineHeight: lh.val })
                      }
                      className={`rounded-lg border py-2 px-1.5 font-medium cursor-pointer ${
                        preferences.lineHeight === lh.val
                          ? 'bg-[#D99B26] text-[#0B0C10] border-[#D99B26] font-semibold'
                          : 'border-current/20 hover:bg-current/5'
                      }`}
                    >
                      {lh.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Largura do Texto */}
              <div className="space-y-2">
                <label className={`font-semibold uppercase tracking-wider block ${themeStyles.muted}`}>
                  Largura da Página
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'narrow', label: 'Estreita' },
                      { id: 'comfortable', label: 'Média' },
                      { id: 'wide', label: 'Ampla' },
                    ] as const
                  ).map((mw) => (
                    <button
                      key={mw.id}
                      type="button"
                      onClick={() =>
                        onUpdatePreferences({ ...preferences, maxWidth: mw.id })
                      }
                      className={`rounded-lg border py-2 px-1.5 font-medium cursor-pointer ${
                        preferences.maxWidth === mw.id
                          ? 'bg-[#D99B26] text-[#0B0C10] border-[#D99B26] font-semibold'
                          : 'border-current/20 hover:bg-current/5'
                      }`}
                    >
                      {mw.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Centered Reading Canvas */}
      <main className="flex-1 flex justify-center px-5 sm:px-10 py-10 sm:py-16">
        <article className={`w-full ${maxWidthClass} ${fontFamilyClass} transition-all`}>
          {/* Chapter Heading */}
          <header className="mb-10 pb-6 border-b border-current/10 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono-num uppercase tracking-[0.2em] opacity-70 mb-2">
              <Bookmark className="w-3.5 h-3.5 text-[#D99B26]" />
              <span>
                Capítulo {pageContent.chapterNumber} • Página {currentPage} de{' '}
                {book.paginas}
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold leading-snug">
              {pageContent.chapterTitle}
            </h2>
          </header>

          {/* Literary Text Body */}
          <div
            className="space-y-6 text-justify sm:text-left"
            style={{
              fontSize: `${preferences.fontSize}px`,
              lineHeight: preferences.lineHeight,
            }}
          >
            {pageContent.paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className={
                  index === 0
                    ? 'first-letter:float-left first-letter:font-display first-letter:text-5xl first-letter:font-bold first-letter:pr-3 first-letter:leading-none first-letter:text-[#D99B26]'
                    : ''
                }
              >
                {paragraph}
              </p>
            ))}
          </div>
        </article>
      </main>

      {/* Bottom Page Navigation & Progress Bar */}
      <footer
        className={`sticky bottom-0 z-30 border-t backdrop-blur-md transition-colors ${themeStyles.headerBg}`}
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Previous Page Button */}
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-current/20 px-4 py-2 text-xs sm:text-sm font-semibold disabled:opacity-35 hover:bg-current/5 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Página anterior</span>
          </button>

          {/* Center Page Counter & Direct Page Jump (e.g. jump to page 127) */}
          <form
            onSubmit={handlePageJumpSubmit}
            className="flex items-center gap-2 text-xs sm:text-sm font-mono-num"
          >
            <span className={themeStyles.muted}>Página</span>
            <input
              type="number"
              min={1}
              max={book.paginas}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageJumpSubmit}
              className="w-16 rounded-md border border-current/25 bg-transparent px-2 py-1 text-center font-bold focus:border-[#D99B26] focus:outline-none"
              aria-label="Ir para a página"
            />
            <span className={themeStyles.muted}>
              de {book.paginas} •{' '}
              <strong className={themeStyles.accent}>{progressPercent}%</strong>
            </span>
          </form>

          {/* Next Page Button */}
          <button
            type="button"
            disabled={currentPage >= book.paginas}
            onClick={() => goToPage(currentPage + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#D99B26] hover:bg-[#e5a832] px-4 py-2 text-xs sm:text-sm font-bold text-[#0B0C10] disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Próxima página</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
};
