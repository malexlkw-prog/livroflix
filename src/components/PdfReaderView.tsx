import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  FileText,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Book, ReadingFormat, UserBookItem } from '../types';
import { fetchPdfBinaryData } from '../utils/pdfUtils';

// Configura o Web Worker oficial do PDF.js via bundle do Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const MIN_ZOOM = 50;
const MAX_ZOOM = 250;
const ZOOM_STEP = 25;

interface PdfReaderViewProps {
  book: Book;
  format?: ReadingFormat;
  userItem?: UserBookItem;
  onSaveProgress?: (
    book: Book,
    paginaAtual: number,
    totalPaginasOverride?: number
  ) => void;
  onClose: () => void;
}

export const PdfReaderView: React.FC<PdfReaderViewProps> = ({
  book,
  userItem,
  onSaveProgress,
  onClose,
}) => {
  // Prioriza obrigatoriamente readingOptions.pdf.url salvo no documento do livro
  const pdfUrl = book.readingOptions?.pdf?.url || book.pdfUrl || '';

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(Boolean(pdfUrl));
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  const readerRootRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Observa o tamanho do container para ajustar a largura base no celular e desktop
  useEffect(() => {
    const updateWidth = () => {
      if (scrollViewportRef.current) {
        setContainerWidth(scrollViewportRef.current.clientWidth);
      } else {
        setContainerWidth(window.innerWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Sincroniza estado de Tela Cheia (Fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Carrega o documento PDF a partir de readingOptions.pdf.url
  useEffect(() => {
    if (!pdfUrl) {
      setPdfDoc(null);
      setTotalPages(0);
      setIsLoadingDoc(false);
      setLoadError(null);
      return;
    }

    const abortController = new AbortController();
    let activeLoadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let loadedDocument: PDFDocumentProxy | null = null;

    setIsLoadingDoc(true);
    setLoadError(null);

    (async () => {
      try {
        const pdfBytes = await fetchPdfBinaryData(
          pdfUrl,
          abortController.signal
        );

        if (abortController.signal.aborted) return;

        activeLoadingTask = pdfjsLib.getDocument({
          data: pdfBytes,
        });

        const docProxy = await activeLoadingTask.promise;
        if (abortController.signal.aborted) {
          await docProxy.cleanup();
          return;
        }

        loadedDocument = docProxy;
        const numPages = docProxy.numPages || 1;

        const savedPage =
          userItem?.paginaAtual &&
          userItem.paginaAtual >= 1 &&
          userItem.paginaAtual <= numPages
            ? userItem.paginaAtual
            : 1;

        setPdfDoc(docProxy);
        setTotalPages(numPages);
        setCurrentPage(savedPage);
        setPageInput(String(savedPage));
        setIsLoadingDoc(false);

        if (onSaveProgress) {
          onSaveProgress(book, savedPage, numPages);
        }
      } catch (err) {
        if (
          abortController.signal.aborted ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          return;
        }
        setIsLoadingDoc(false);
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Não foi possível abrir o PDF deste livro.'
        );
      }
    })();

    return () => {
      abortController.abort();
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (loadedDocument) {
        try {
          loadedDocument.cleanup();
        } catch {
          // ignore
        }
      }
      if (activeLoadingTask) {
        try {
          activeLoadingTask.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfUrl, book.id, reloadCounter]);

  // Renderiza a página atual no <canvas> com suporte a alta densidade (Retina/Mobile/Desktop)
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || currentPage < 1 || currentPage > totalPages) {
      return;
    }

    let isCancelled = false;

    const renderCurrentPage = async () => {
      setIsRenderingPage(true);

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }

      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled || !canvasRef.current) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const horizontalPadding = containerWidth < 640 ? 20 : 56;
        const availableWidth = Math.max(
          260,
          containerWidth - horizontalPadding
        );

        // Largura confortável máxima em 100% no desktop (~820px) ou ajustada à tela no mobile
        const targetBaseWidth = Math.min(availableWidth, 820);
        const baseScale = targetBaseWidth / Math.max(1, unscaledViewport.width);
        const effectiveScale = baseScale * (zoomPercent / 100);

        const viewport = page.getViewport({ scale: effectiveScale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2.5);

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform =
          outputScale !== 1
            ? [outputScale, 0, 0, outputScale, 0, 0]
            : undefined;

        const renderTask = page.render({
          canvasContext: context,
          canvas,
          viewport,
          transform,
        });

        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (!isCancelled) {
          setIsRenderingPage(false);
        }
      } catch (err: unknown) {
        const errName =
          err && typeof err === 'object' && 'name' in err
            ? String((err as { name?: unknown }).name)
            : '';
        if (errName === 'RenderingCancelledException' || isCancelled) {
          return;
        }
        if (!isCancelled) {
          setIsRenderingPage(false);
        }
      }
    };

    renderCurrentPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, totalPages, zoomPercent, containerWidth]);

  const goToPage = useCallback(
    (target: number) => {
      if (totalPages < 1) return;
      const clamped = Math.max(1, Math.min(totalPages, target));
      setCurrentPage(clamped);
      setPageInput(String(clamped));
      if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (onSaveProgress) {
        onSaveProgress(book, clamped, totalPages);
      }
    },
    [totalPages, book, onSaveProgress]
  );

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const handleZoomIn = useCallback(() => {
    setZoomPercent((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomPercent((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomPercent(100);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (readerRootRef.current?.requestFullscreen) {
          await readerRootRef.current.requestFullscreen();
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignora restrições de fullscreen do navegador/iframe
    }
  }, []);

  const handleCloseReader = useCallback(async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
    onClose();
  }, [onClose]);

  // Atalhos de teclado (Setas, Zoom, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      } else if (e.key === 'Escape' && !document.fullscreenElement) {
        handleCloseReader();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleNextPage,
    handlePrevPage,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleCloseReader,
  ]);

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed)) {
      goToPage(parsed);
    } else {
      setPageInput(String(currentPage));
    }
  };

  // Suporte a gesto de deslizar (swipe) no celular quando o zoom está em <= 100%
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomPercent > 100 || e.touches.length !== 1) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (
      zoomPercent > 100 ||
      touchStartXRef.current === null ||
      touchStartYRef.current === null ||
      e.changedTouches.length !== 1
    ) {
      return;
    }

    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;

    if (Math.abs(deltaX) > 65 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      if (deltaX < 0) {
        handleNextPage();
      } else {
        handlePrevPage();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const progressPercent =
    totalPages > 0
      ? Math.min(100, Math.max(1, Math.round((currentPage / totalPages) * 100)))
      : 0;

  return (
    <div
      ref={readerRootRef}
      className="fixed inset-0 z-50 bg-[#040D1A] text-white flex flex-col select-none"
    >
      {/* Barra Superior do Leitor PDF */}
      <header className="relative z-30 border-b border-blue-400/20 bg-[#071426]/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Esquerda: Voltar ao livro + Título da Obra */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <button
              type="button"
              onClick={handleCloseReader}
              className="inline-flex items-center gap-2 rounded-lg bg-[#040D1A] hover:bg-[#0B1E36] border border-blue-400/25 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="Fechar leitor e voltar para a página do livro"
            >
              <ArrowLeft className="w-4 h-4 text-[#60A5FA]" />
              <span className="hidden xs:inline sm:inline">Voltar ao livro</span>
            </button>

            <div className="min-w-0">
              <h1 className="font-display text-sm sm:text-base md:text-lg font-bold text-white truncate leading-tight">
                {book.titulo}
              </h1>
              <p className="text-[11px] sm:text-xs text-blue-200/70 truncate">
                {book.autor} · Leitor PDF
              </p>
            </div>
          </div>

          {/* Direita: Controles de Zoom, Tela Cheia e Fechar */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Controles de Zoom */}
            {pdfDoc && !loadError && (
              <div className="flex items-center rounded-lg bg-[#040D1A] border border-blue-400/25 p-0.5">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomPercent <= MIN_ZOOM}
                  aria-label="Diminuir zoom"
                  title="Diminuir zoom (-)"
                  className="p-1.5 sm:p-2 rounded-md text-blue-100 hover:bg-[#0B1E36] hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleZoomReset}
                  title="Redefinir zoom para 100%"
                  className="px-2 sm:px-2.5 py-1 text-xs font-mono tabular-nums font-semibold text-[#60A5FA] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  {zoomPercent}%
                </button>

                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomPercent >= MAX_ZOOM}
                  aria-label="Aumentar zoom"
                  title="Aumentar zoom (+)"
                  className="p-1.5 sm:p-2 rounded-md text-blue-100 hover:bg-[#0B1E36] hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Botão Tela Cheia */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#040D1A] hover:bg-[#0B1E36] border border-blue-400/25 px-2.5 sm:px-3 py-2 text-xs font-semibold text-blue-100 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-[#60A5FA]" />
                  <span className="hidden md:inline">Sair da tela cheia</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-[#60A5FA]" />
                  <span className="hidden md:inline">Tela cheia</span>
                </>
              )}
            </button>

            {/* Botão Fechar (X) */}
            <button
              type="button"
              onClick={handleCloseReader}
              aria-label="Fechar leitor de PDF"
              title="Fechar leitor"
              className="rounded-lg bg-[#040D1A] hover:bg-rose-500/20 border border-blue-400/25 hover:border-rose-400/40 p-2 text-blue-200/80 hover:text-rose-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra de Progresso de Leitura */}
        {totalPages > 0 && (
          <div className="h-1 w-full bg-[#040D1A] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </header>

      {/* Área Central de Leitura Focado no Conteúdo */}
      <main className="relative flex-1 flex overflow-hidden bg-[#020813]">
        {!pdfUrl ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl bg-[#071426] border border-blue-400/20 p-8 text-center space-y-4 shadow-2xl">
              <FileText className="w-10 h-10 text-[#60A5FA] mx-auto opacity-85" />
              <h2 className="font-display text-xl font-bold text-white">
                PDF não disponível para este livro
              </h2>
              <p className="text-xs sm:text-sm text-blue-200/75 leading-relaxed">
                O arquivo PDF ainda não foi associado a esta obra no painel administrativo.
              </p>
              <button
                type="button"
                onClick={handleCloseReader}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para a página do livro</span>
              </button>
            </div>
          </div>
        ) : isLoadingDoc ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="rounded-2xl bg-[#071426]/90 border border-blue-400/20 px-8 py-10 max-w-sm w-full space-y-4 shadow-2xl">
              <Loader2 className="w-10 h-10 text-[#60A5FA] animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="font-display text-lg font-bold text-white">
                  Preparando sua leitura...
                </p>
                <p className="text-xs text-blue-200/70">
                  Carregando páginas do PDF no leitor LIVROFLIX
                </p>
              </div>
            </div>
          </div>
        ) : loadError ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl bg-[#071426] border border-rose-500/30 p-8 text-center space-y-4 shadow-2xl">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
              <h2 className="font-display text-xl font-bold text-white">
                Não foi possível abrir o PDF
              </h2>
              <p className="text-xs sm:text-sm text-blue-200/75 leading-relaxed">
                {loadError}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReloadCounter((c) => c + 1)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Tentar novamente</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseReader}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#040D1A] hover:bg-[#0B1E36] border border-blue-400/25 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-[#60A5FA]" />
                  <span>Voltar ao livro</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Botões Laterais de Navegação Rápida (Desktop) */}
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              aria-label="Página anterior"
              title="Página anterior (←)"
              className="hidden lg:flex fixed left-5 top-1/2 -translate-y-1/2 z-20 h-12 w-12 items-center justify-center rounded-full bg-[#071426]/85 hover:bg-[#2563EB] border border-blue-400/25 text-white shadow-xl disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              aria-label="Próxima página"
              title="Próxima página (→)"
              className="hidden lg:flex fixed right-5 top-1/2 -translate-y-1/2 z-20 h-12 w-12 items-center justify-center rounded-full bg-[#071426]/85 hover:bg-[#2563EB] border border-blue-400/25 text-white shadow-xl disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Viewport Rolável do Canvas PDF */}
            <div
              ref={scrollViewportRef}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="flex-1 overflow-auto px-2.5 sm:px-6 py-4 sm:py-8 flex justify-center items-start"
            >
              <div className="relative inline-flex items-center justify-center rounded-lg bg-[#040D1A] p-1 sm:p-2 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.95)] ring-1 ring-white/10">
                <canvas
                  ref={canvasRef}
                  className="block rounded bg-white max-w-full"
                />

                {isRenderingPage && (
                  <div className="absolute top-3 right-3 rounded-md bg-[#071426]/90 border border-blue-400/30 px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-blue-200 shadow-lg pointer-events-none">
                    <Loader2 className="w-3.5 h-3.5 text-[#60A5FA] animate-spin" />
                    <span>Renderizando...</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Barra Inferior: Navegação de Páginas e Contador */}
      {pdfDoc && !loadError && totalPages > 0 && (
        <footer className="relative z-30 border-t border-blue-400/20 bg-[#071426]/95 backdrop-blur-md">
          <div className="mx-auto max-w-5xl px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
            {/* Botão Página Anterior */}
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-[#040D1A] hover:bg-[#0B1E36] border border-blue-400/25 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4 text-[#60A5FA]" />
              <span className="hidden sm:inline">Página anterior</span>
              <span className="sm:hidden">Anterior</span>
            </button>

            {/* Indicador de Página Atual / Total com Ir para Página */}
            <form
              onSubmit={handlePageInputSubmit}
              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-mono tabular-nums"
            >
              <span className="text-blue-200/75 hidden xs:inline">Página</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={handlePageInputSubmit}
                aria-label="Número da página atual"
                className="w-12 sm:w-16 rounded-md bg-[#040D1A] border border-blue-400/30 px-2 py-1 text-center font-bold text-white focus:border-[#60A5FA] focus:outline-none"
              />
              <span className="text-blue-200/80 whitespace-nowrap">
                de <strong className="text-white">{totalPages}</strong>
              </span>
              <span className="hidden md:inline text-blue-200/60">
                · <strong className="text-[#60A5FA]">{progressPercent}%</strong>
              </span>
            </form>

            {/* Botão Próxima Página */}
            <button
              type="button"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white disabled:opacity-40 disabled:pointer-events-none shadow-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="hidden sm:inline">Próxima página</span>
              <span className="sm:hidden">Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};
