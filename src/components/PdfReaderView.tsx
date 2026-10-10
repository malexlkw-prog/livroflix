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
  BookOpen,
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
const DESKTOP_MIN_WIDTH = 960;
const FLIP_DURATION_MS = 420;

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

interface FlipState {
  direction: 'next' | 'prev';
  frontImg: string;
  backImg: string;
  underneathLeftImg?: string | null;
  underneathRightImg?: string | null;
  phase: 'start' | 'animating';
}

export const PdfReaderView: React.FC<PdfReaderViewProps> = ({
  book,
  userItem,
  onSaveProgress,
  onClose,
}) => {
  // Prioriza readingOptions.pdf.url salvo no documento do livro
  const pdfUrl = book.readingOptions?.pdf?.url || book.pdfUrl || '';

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Modo de visualização: 'single' (Uma página) ou 'double' (Duas páginas lado a lado)
  const [viewMode, setViewMode] = useState<'single' | 'double'>(() => {
    try {
      const saved = localStorage.getItem('livroflix_pdf_view_mode');
      if (saved === 'single' || saved === 'double') return saved;
    } catch {
      // ignore
    }
    return 'single';
  });

  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(Boolean(pdfUrl));
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const [containerHeight, setContainerHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight - 130 : 700
  );

  // Estado da animação 3D de virada de página
  const [flipState, setFlipState] = useState<FlipState | null>(null);
  const [isFlipping, setIsFlipping] = useState<boolean>(false);

  // Dimensões calculadas de cada página para manter proporção física de livro
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({
    width: 600,
    height: 850,
  });

  const readerRootRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  // Canvas único para modo de uma página
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  // Dois canvases para modo de duas páginas (página esquerda e direita)
  const canvasLeftRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRightRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskLeftRef = useRef<RenderTask | null>(null);
  const renderTaskRightRef = useRef<RenderTask | null>(null);

  // Cache em memória para snapshots de páginas (acelera a virada para 60fps instantâneos)
  const pageCacheRef = useRef<Map<number, string>>(new Map());

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Em telas menores que 960px, força visualização de 1 página
  const isDesktop = containerWidth >= DESKTOP_MIN_WIDTH;
  const effectiveViewMode: 'single' | 'double' = isDesktop ? viewMode : 'single';

  // No modo de duas páginas, calcula o par (ex: 1+2, 3+4, 5+6, 7+8...)
  const leftPageNum =
    effectiveViewMode === 'double'
      ? currentPage % 2 === 1
        ? currentPage
        : Math.max(1, currentPage - 1)
      : currentPage;

  const rightPageNum =
    effectiveViewMode === 'double' && leftPageNum + 1 <= totalPages
      ? leftPageNum + 1
      : null;

  // Atualiza as dimensões do viewport no resize
  useEffect(() => {
    const updateDimensions = () => {
      if (scrollViewportRef.current) {
        setContainerWidth(scrollViewportRef.current.clientWidth);
        setContainerHeight(scrollViewportRef.current.clientHeight);
      } else {
        setContainerWidth(window.innerWidth);
        setContainerHeight(window.innerHeight - 130);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
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

  // Alterna o modo de visualização salvando preferência
  const handleSetViewMode = (mode: 'single' | 'double') => {
    setViewMode(mode);
    try {
      localStorage.setItem('livroflix_pdf_view_mode', mode);
    } catch {
      // ignore
    }
  };

  // Carrega o documento PDF
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
    pageCacheRef.current.clear();

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
      if (renderTaskLeftRef.current) {
        try {
          renderTaskLeftRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (renderTaskRightRef.current) {
        try {
          renderTaskRightRef.current.cancel();
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

  // Função auxiliar para renderizar uma página PDF em um elemento canvas
  const renderPdfPageToCanvas = useCallback(
    async (
      pageNumber: number,
      canvas: HTMLCanvasElement,
      width: number,
      height: number
    ): Promise<RenderTask | null> => {
      if (!pdfDoc) return null;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scaleW = width / Math.max(1, unscaledViewport.width);
        const scaleH = height / Math.max(1, unscaledViewport.height);
        const scale = Math.min(scaleW, scaleH);
        const viewport = page.getViewport({ scale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2.5);

        const context = canvas.getContext('2d');
        if (!context) return null;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        // Preenche com papel branco puro para evitar transparência ou pixels pretos no JPEG
        context.save();
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.restore();

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

        await renderTask.promise;
        return renderTask;
      } catch (err: unknown) {
        const errName =
          err && typeof err === 'object' && 'name' in err
            ? String((err as { name?: unknown }).name)
            : '';
        if (errName !== 'RenderingCancelledException') {
          // ignore
        }
        return null;
      }
    },
    [pdfDoc]
  );

  // Renderiza uma página offscreen para obter DataURL (usado no efeito 3D de virada)
  const getPageDataUrl = useCallback(
    async (
      pageNumber: number,
      width: number,
      height: number
    ): Promise<string> => {
      if (!pdfDoc || pageNumber < 1 || pageNumber > totalPages) return '';
      if (pageCacheRef.current.has(pageNumber)) {
        return pageCacheRef.current.get(pageNumber)!;
      }

      const offscreen = document.createElement('canvas');
      await renderPdfPageToCanvas(pageNumber, offscreen, width, height);
      try {
        const url = offscreen.toDataURL('image/jpeg', 0.92);
        pageCacheRef.current.set(pageNumber, url);
        return url;
      } catch {
        return '';
      }
    },
    [pdfDoc, totalPages, renderPdfPageToCanvas]
  );

  // Efeito principal de renderização das páginas (Uma Página vs Duas Páginas)
  useEffect(() => {
    if (!pdfDoc || totalPages < 1) return;

    let isCancelled = false;

    const renderReader = async () => {
      setIsRenderingPage(true);

      // Cancela tarefas anteriores
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
      if (renderTaskLeftRef.current) {
        try {
          renderTaskLeftRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskLeftRef.current = null;
      }
      if (renderTaskRightRef.current) {
        try {
          renderTaskRightRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRightRef.current = null;
      }

      try {
        const samplePage = await pdfDoc.getPage(leftPageNum);
        if (isCancelled) return;
        const unscaledViewport = samplePage.getViewport({ scale: 1 });
        const viewportHeight = Math.max(300, containerHeight - 32);

        if (effectiveViewMode === 'single') {
          // ================= MODO UMA PÁGINA (Padrão e Mobile) =================
          if (!canvasRef.current) return;
          const horizontalPadding = containerWidth < 640 ? 20 : 56;
          const availableWidth = Math.max(260, containerWidth - horizontalPadding);
          const targetBaseWidth = Math.min(availableWidth, 820);
          const baseScale = targetBaseWidth / Math.max(1, unscaledViewport.width);
          const effectiveScale = baseScale * (zoomPercent / 100);

          const calcWidth = Math.floor(unscaledViewport.width * effectiveScale);
          const calcHeight = Math.floor(unscaledViewport.height * effectiveScale);
          setPageSize({ width: calcWidth, height: calcHeight });

          const task = await renderPdfPageToCanvas(
            currentPage,
            canvasRef.current,
            calcWidth,
            calcHeight
          );
          if (task && !isCancelled) {
            renderTaskRef.current = task;
          }
        } else {
          // ================= MODO DUAS PÁGINAS (Desktop / Livro Aberto) =================
          const horizontalPadding = 56;
          const availableWidth = Math.max(400, containerWidth - horizontalPadding);

          // Em duas páginas, cada página tem metade da largura do livro aberto
          const maxPageWidth = Math.min((availableWidth - 16) / 2, 720);
          const scaleFromWidth = maxPageWidth / unscaledViewport.width;
          const scaleFromHeight = viewportHeight / unscaledViewport.height;

          // Encaixa confortavelmente na tela sem barra vertical desnecessária em 100% zoom
          const baseScale = Math.min(scaleFromWidth, scaleFromHeight);
          const effectiveScale = baseScale * (zoomPercent / 100);

          const calcWidth = Math.floor(unscaledViewport.width * effectiveScale);
          const calcHeight = Math.floor(unscaledViewport.height * effectiveScale);
          setPageSize({ width: calcWidth, height: calcHeight });

          // Renderiza página esquerda
          if (canvasLeftRef.current) {
            const taskLeft = await renderPdfPageToCanvas(
              leftPageNum,
              canvasLeftRef.current,
              calcWidth,
              calcHeight
            );
            if (taskLeft && !isCancelled) {
              renderTaskLeftRef.current = taskLeft;
            }
          }

          // Renderiza página direita (se existir)
          if (canvasRightRef.current && rightPageNum) {
            const taskRight = await renderPdfPageToCanvas(
              rightPageNum,
              canvasRightRef.current,
              calcWidth,
              calcHeight
            );
            if (taskRight && !isCancelled) {
              renderTaskRightRef.current = taskRight;
            }
          }

          // Pré-carrega snapshots das próximas e anteriores em background para virada instantânea
          setTimeout(() => {
            if (!isCancelled) {
              if (leftPageNum + 2 <= totalPages) {
                void getPageDataUrl(leftPageNum + 2, calcWidth, calcHeight);
              }
              if (leftPageNum + 3 <= totalPages) {
                void getPageDataUrl(leftPageNum + 3, calcWidth, calcHeight);
              }
              if (leftPageNum - 2 >= 1) {
                void getPageDataUrl(leftPageNum - 2, calcWidth, calcHeight);
              }
              if (leftPageNum - 1 >= 1) {
                void getPageDataUrl(leftPageNum - 1, calcWidth, calcHeight);
              }
            }
          }, 80);
        }

        if (!isCancelled) {
          setIsRenderingPage(false);
        }
      } catch (err) {
        // ignore
      } finally {
        if (!isCancelled) {
          setIsRenderingPage(false);
        }
      }
    };

    renderReader();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (renderTaskLeftRef.current) {
        try {
          renderTaskLeftRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (renderTaskRightRef.current) {
        try {
          renderTaskRightRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [
    pdfDoc,
    currentPage,
    leftPageNum,
    rightPageNum,
    totalPages,
    zoomPercent,
    containerWidth,
    containerHeight,
    effectiveViewMode,
    renderPdfPageToCanvas,
    getPageDataUrl,
  ]);

  // Sincroniza o campo de página do rodapé com a página atual
  useEffect(() => {
    if (effectiveViewMode === 'double') {
      setPageInput(String(leftPageNum));
    } else {
      setPageInput(String(currentPage));
    }
  }, [effectiveViewMode, leftPageNum, currentPage]);

  // Navega diretamente para uma página específica
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

  // Navegação: Avançar (Página Única avança 1; Duas Páginas avança par com efeito de virada 3D)
  const handleNextPage = useCallback(async () => {
    if (isFlipping) return;

    if (effectiveViewMode === 'single') {
      if (currentPage < totalPages) {
        goToPage(currentPage + 1);
      }
      return;
    }

    // Modo Duas Páginas: Avança para o próximo par (ex: 1+2 -> 3+4 -> 5+6)
    const nextLeft = leftPageNum + 2;
    if (leftPageNum >= totalPages || (rightPageNum === null && leftPageNum >= totalPages)) {
      return;
    }

    // Se a próxima página ultrapassar o total, não avança
    if (nextLeft > totalPages && rightPageNum !== null && rightPageNum >= totalPages) {
      return;
    }

    const { width: pWidth, height: pHeight } = pageSize;

    // Obtém imagens para a virada física
    const frontImg =
      canvasRightRef.current?.toDataURL() ||
      (rightPageNum ? await getPageDataUrl(rightPageNum, pWidth, pHeight) : '');

    const backImg = await getPageDataUrl(nextLeft, pWidth, pHeight);
    const underneathRightImg =
      nextLeft + 1 <= totalPages
        ? await getPageDataUrl(nextLeft + 1, pWidth, pHeight)
        : null;

    if (!frontImg || !backImg) {
      goToPage(nextLeft);
      return;
    }

    setIsFlipping(true);
    setFlipState({
      direction: 'next',
      frontImg,
      backImg,
      underneathRightImg,
      phase: 'start',
    });

    // Dispara a rotação 3D no frame seguinte
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlipState((prev) => (prev ? { ...prev, phase: 'animating' } : null));
      });
    });

    // Ao completar a virada, pinta os snapshots nas telas antes de remover a folha 3D
    setTimeout(() => {
      if (canvasLeftRef.current && backImg) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvasLeftRef.current?.getContext('2d');
          if (ctx && canvasLeftRef.current) {
            ctx.drawImage(
              img,
              0,
              0,
              canvasLeftRef.current.width,
              canvasLeftRef.current.height
            );
          }
        };
        img.src = backImg;
      }
      if (canvasRightRef.current && underneathRightImg) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvasRightRef.current?.getContext('2d');
          if (ctx && canvasRightRef.current) {
            ctx.drawImage(
              img,
              0,
              0,
              canvasRightRef.current.width,
              canvasRightRef.current.height
            );
          }
        };
        img.src = underneathRightImg;
      }

      goToPage(nextLeft);

      requestAnimationFrame(() => {
        setFlipState(null);
        setIsFlipping(false);
      });
    }, FLIP_DURATION_MS);
  }, [
    isFlipping,
    effectiveViewMode,
    currentPage,
    totalPages,
    leftPageNum,
    rightPageNum,
    pageSize,
    getPageDataUrl,
    goToPage,
  ]);

  // Navegação: Voltar (Página Única recua 1; Duas Páginas recua par com efeito de virada 3D)
  const handlePrevPage = useCallback(async () => {
    if (isFlipping) return;

    if (effectiveViewMode === 'single') {
      if (currentPage > 1) {
        goToPage(currentPage - 1);
      }
      return;
    }

    // Modo Duas Páginas: Recua para o par anterior
    const prevLeft = Math.max(1, leftPageNum - 2);
    if (leftPageNum <= 1) return;

    const { width: pWidth, height: pHeight } = pageSize;

    const frontImg =
      canvasLeftRef.current?.toDataURL() ||
      (await getPageDataUrl(leftPageNum, pWidth, pHeight));

    const backImg = await getPageDataUrl(prevLeft + 1, pWidth, pHeight);
    const underneathLeftImg = await getPageDataUrl(prevLeft, pWidth, pHeight);

    if (!frontImg || !backImg) {
      goToPage(prevLeft);
      return;
    }

    setIsFlipping(true);
    setFlipState({
      direction: 'prev',
      frontImg,
      backImg,
      underneathLeftImg,
      phase: 'start',
    });

    // Dispara a rotação 3D no frame seguinte
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlipState((prev) => (prev ? { ...prev, phase: 'animating' } : null));
      });
    });

    // Ao completar a virada, pinta os snapshots nas telas antes de remover a folha 3D
    setTimeout(() => {
      if (canvasLeftRef.current && underneathLeftImg) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvasLeftRef.current?.getContext('2d');
          if (ctx && canvasLeftRef.current) {
            ctx.drawImage(
              img,
              0,
              0,
              canvasLeftRef.current.width,
              canvasLeftRef.current.height
            );
          }
        };
        img.src = underneathLeftImg;
      }
      if (canvasRightRef.current && backImg) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvasRightRef.current?.getContext('2d');
          if (ctx && canvasRightRef.current) {
            ctx.drawImage(
              img,
              0,
              0,
              canvasRightRef.current.width,
              canvasRightRef.current.height
            );
          }
        };
        img.src = backImg;
      }

      goToPage(prevLeft);

      requestAnimationFrame(() => {
        setFlipState(null);
        setIsFlipping(false);
      });
    }, FLIP_DURATION_MS);
  }, [
    isFlipping,
    effectiveViewMode,
    currentPage,
    leftPageNum,
    pageSize,
    getPageDataUrl,
    goToPage,
  ]);

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

  // Atalhos de teclado (Setas Esquerda/Direita, Zoom, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        void handleNextPage();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void handlePrevPage();
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
        void handleCloseReader();
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
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      if (effectiveViewMode === 'double') {
        const aligned = parsed % 2 === 1 ? parsed : Math.max(1, parsed - 1);
        goToPage(aligned);
      } else {
        goToPage(parsed);
      }
    } else {
      setPageInput(
        String(effectiveViewMode === 'double' ? leftPageNum : currentPage)
      );
    }
  };

  // Suporte a gesto de deslizar (swipe) no mobile
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
        void handleNextPage();
      } else {
        void handlePrevPage();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Progresso relativo da leitura
  const progressPercent =
    totalPages > 0
      ? Math.min(
          100,
          Math.max(
            1,
            Math.round(
              ((effectiveViewMode === 'double' && rightPageNum
                ? rightPageNum
                : leftPageNum) /
                totalPages) *
                100
            )
          )
        )
      : 0;

  // Botões de navegação desabilitados
  const canGoPrev =
    effectiveViewMode === 'single' ? currentPage > 1 : leftPageNum > 1;

  const canGoNext =
    effectiveViewMode === 'single'
      ? currentPage < totalPages
      : (rightPageNum !== null && rightPageNum < totalPages) ||
        (rightPageNum === null && leftPageNum < totalPages);

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

          {/* Centro/Direita: Seletor Uma Página / Duas Páginas (Computador) + Zoom + Fullscreen + Fechar */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Seletor de Modo de Visualização: Uma página / Duas páginas (Exibido no Computador) */}
            {pdfDoc && !loadError && isDesktop && (
              <div className="flex items-center rounded-lg bg-[#040D1A] border border-blue-400/25 p-0.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => handleSetViewMode('single')}
                  aria-label="Exibir uma página"
                  title="Modo uma página"
                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    effectiveViewMode === 'single'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-blue-200/75 hover:text-white hover:bg-[#0B1E36]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Uma página</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetViewMode('double')}
                  aria-label="Exibir duas páginas lado a lado"
                  title="Modo duas páginas (livro aberto)"
                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    effectiveViewMode === 'double'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-blue-200/75 hover:text-white hover:bg-[#0B1E36]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Duas páginas</span>
                </button>
              </div>
            )}

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
              disabled={!canGoPrev || isFlipping}
              aria-label="Página anterior"
              title="Página anterior (←)"
              className="hidden lg:flex fixed left-5 top-1/2 -translate-y-1/2 z-40 h-12 w-12 items-center justify-center rounded-full bg-[#071426]/90 hover:bg-[#2563EB] border border-blue-400/30 text-white shadow-2xl disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={handleNextPage}
              disabled={!canGoNext || isFlipping}
              aria-label="Próxima página"
              title="Próxima página (→)"
              className="hidden lg:flex fixed right-5 top-1/2 -translate-y-1/2 z-40 h-12 w-12 items-center justify-center rounded-full bg-[#071426]/90 hover:bg-[#2563EB] border border-blue-400/30 text-white shadow-2xl disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Viewport Rolável do Canvas PDF */}
            <div
              ref={scrollViewportRef}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="flex-1 overflow-auto px-2.5 sm:px-6 py-4 sm:py-6 flex justify-center items-center"
            >
              {effectiveViewMode === 'single' ? (
                // ================= VISUALIZAÇÃO: UMA PÁGINA =================
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
              ) : (
                // ================= VISUALIZAÇÃO: DUAS PÁGINAS (LIVRO ABERTO) =================
                <div
                  className="relative inline-flex items-center justify-center"
                  style={{
                    perspective: '2200px',
                    WebkitPerspective: '2200px',
                  }}
                >
                  {/* Livro Aberto com Lombada Central e Páginas Duplas */}
                  <div
                    className="relative flex items-stretch rounded-lg shadow-[0_25px_80px_-10px_rgba(0,0,0,0.95),_0_0_40px_rgba(2,6,23,0.85)] ring-1 ring-white/10 bg-[#071426]"
                    style={{
                      width: `${pageSize.width * 2}px`,
                      minHeight: `${pageSize.height}px`,
                    }}
                  >
                    {/* Página Esquerda */}
                    <div
                      onClick={canGoPrev ? handlePrevPage : undefined}
                      className={`relative rounded-l-lg overflow-hidden bg-white flex items-center justify-center ${
                        canGoPrev ? 'cursor-pointer' : ''
                      }`}
                      style={{
                        width: `${pageSize.width}px`,
                        height: `${pageSize.height}px`,
                        boxShadow:
                          '-8px 0 16px -4px rgba(0,0,0,0.45), inset -15px 0 25px -10px rgba(0,0,0,0.18)',
                      }}
                      title={canGoPrev ? 'Página anterior' : ''}
                    >
                      <canvas
                        ref={canvasLeftRef}
                        className="block max-w-full max-h-full"
                      />

                      {/* Sombra de curvatura do papel na lombada direita */}
                      <div
                        className="absolute inset-y-0 right-0 w-8 pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(to right, transparent, rgba(0,0,0,0.14))',
                        }}
                      />

                      {/* Borda externa de corte de páginas empilhadas */}
                      <div
                        className="absolute inset-y-0 left-0 w-2 pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(to right, rgba(0,0,0,0.12), transparent)',
                        }}
                      />

                      {/* Número sutil de página na parte inferior */}
                      <span className="absolute bottom-2.5 left-4 text-[10px] font-mono font-medium text-slate-500/80 pointer-events-none">
                        {leftPageNum}
                      </span>
                    </div>

                    {/* Lombada / Vinco Central Realista do Livro */}
                    <div
                      className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] z-10 pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(to right, rgba(0,0,0,0.5), rgba(0,0,0,0.8), rgba(0,0,0,0.5))',
                        boxShadow: '0 0 4px rgba(0,0,0,0.6)',
                      }}
                    />

                    {/* Página Direita */}
                    <div
                      onClick={canGoNext ? handleNextPage : undefined}
                      className={`relative rounded-r-lg overflow-hidden bg-white flex items-center justify-center ${
                        canGoNext ? 'cursor-pointer' : ''
                      }`}
                      style={{
                        width: `${pageSize.width}px`,
                        height: `${pageSize.height}px`,
                        boxShadow:
                          '8px 0 16px -4px rgba(0,0,0,0.45), inset 15px 0 25px -10px rgba(0,0,0,0.18)',
                      }}
                      title={canGoNext ? 'Próxima página' : ''}
                    >
                      {rightPageNum ? (
                        <>
                          <canvas
                            ref={canvasRightRef}
                            className="block max-w-full max-h-full"
                          />

                          {/* Sombra de curvatura do papel na lombada esquerda */}
                          <div
                            className="absolute inset-y-0 left-0 w-8 pointer-events-none"
                            style={{
                              background:
                                'linear-gradient(to left, transparent, rgba(0,0,0,0.14))',
                            }}
                          />

                          {/* Borda externa de corte de páginas empilhadas */}
                          <div
                            className="absolute inset-y-0 right-0 w-2 pointer-events-none"
                            style={{
                              background:
                                'linear-gradient(to left, rgba(0,0,0,0.12), transparent)',
                            }}
                          />

                          {/* Número sutil de página na parte inferior */}
                          <span className="absolute bottom-2.5 right-4 text-[10px] font-mono font-medium text-slate-500/80 pointer-events-none">
                            {rightPageNum}
                          </span>
                        </>
                      ) : (
                        // Contracapa / Fim da obra se o livro terminar em página ímpar
                        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#071426] text-blue-200/60 select-none">
                          <BookOpen className="w-12 h-12 text-[#60A5FA]/40 mb-3" />
                          <h3 className="font-display text-base font-bold text-white/80">
                            Fim da Obra
                          </h3>
                          <p className="text-xs text-blue-200/50 mt-1 max-w-xs leading-relaxed">
                            Você concluiu a leitura de {book.titulo}.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Indicador discreto de renderização */}
                    {isRenderingPage && (
                      <div className="absolute top-3 right-3 z-30 rounded-md bg-[#071426]/90 border border-blue-400/30 px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-blue-200 shadow-lg pointer-events-none">
                        <Loader2 className="w-3.5 h-3.5 text-[#60A5FA] animate-spin" />
                        <span>Renderizando páginas...</span>
                      </div>
                    )}

                    {/* ================= CAMADA DE ANIMAÇÃO 3D DE VIRADA DE PÁGINA ================= */}
                    {flipState && (
                      <div
                        className="absolute inset-0 z-30 pointer-events-none"
                        style={{
                          perspective: '2200px',
                          WebkitPerspective: '2200px',
                        }}
                      >
                        {/* Imagem de fundo temporária revelada sob a página que está virando */}
                        {flipState.direction === 'next' &&
                          flipState.underneathRightImg && (
                            <div
                              className="absolute top-0 overflow-hidden bg-white rounded-r-lg"
                              style={{
                                left: `${pageSize.width}px`,
                                width: `${pageSize.width}px`,
                                height: `${pageSize.height}px`,
                                zIndex: 1,
                              }}
                            >
                              <img
                                src={flipState.underneathRightImg}
                                alt="Próxima página"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}

                        {flipState.direction === 'prev' &&
                          flipState.underneathLeftImg && (
                            <div
                              className="absolute top-0 left-0 overflow-hidden bg-white rounded-l-lg"
                              style={{
                                width: `${pageSize.width}px`,
                                height: `${pageSize.height}px`,
                                zIndex: 1,
                              }}
                            >
                              <img
                                src={flipState.underneathLeftImg}
                                alt="Página anterior"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}

                        {/* Folha 3D em movimento de rotação (Flipping Leaf) */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left:
                              flipState.direction === 'next'
                                ? `${pageSize.width}px`
                                : 0,
                            width: `${pageSize.width}px`,
                            height: `${pageSize.height}px`,
                            transformOrigin:
                              flipState.direction === 'next'
                                ? 'left center'
                                : 'right center',
                            transformStyle: 'preserve-3d',
                            WebkitTransformStyle: 'preserve-3d',
                            transform:
                              flipState.phase === 'start'
                                ? 'rotateY(0deg)'
                                : flipState.direction === 'next'
                                ? 'rotateY(-180deg)'
                                : 'rotateY(180deg)',
                            transition:
                              flipState.phase === 'start'
                                ? 'none'
                                : `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
                            zIndex: 20,
                          }}
                        >
                          {/* Frente da folha que vira */}
                          <div
                            className="absolute inset-0 overflow-hidden bg-white"
                            style={{
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              borderRadius:
                                flipState.direction === 'next'
                                  ? '0 6px 6px 0'
                                  : '6px 0 0 6px',
                              boxShadow:
                                flipState.phase === 'animating'
                                  ? flipState.direction === 'next'
                                    ? '-12px 10px 30px rgba(0,0,0,0.5)'
                                    : '12px 10px 30px rgba(0,0,0,0.5)'
                                  : 'none',
                            }}
                          >
                            <img
                              src={flipState.frontImg}
                              alt="Página virando"
                              className="w-full h-full object-contain"
                            />
                            {/* Gradiente dinâmico de sombra na frente durante a dobra */}
                            <div
                              className="absolute inset-0 pointer-events-none transition-opacity duration-200"
                              style={{
                                background:
                                  flipState.direction === 'next'
                                    ? 'linear-gradient(to right, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.08) 30%, transparent 70%)'
                                    : 'linear-gradient(to left, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.08) 30%, transparent 70%)',
                                opacity: flipState.phase === 'animating' ? 0.65 : 0,
                              }}
                            />
                          </div>

                          {/* Verso da folha que pousa do outro lado */}
                          <div
                            className="absolute inset-0 overflow-hidden bg-white"
                            style={{
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)',
                              WebkitTransform: 'rotateY(180deg)',
                              borderRadius:
                                flipState.direction === 'next'
                                  ? '6px 0 0 6px'
                                  : '0 6px 6px 0',
                              boxShadow:
                                flipState.phase === 'animating'
                                  ? flipState.direction === 'next'
                                    ? '12px 10px 30px rgba(0,0,0,0.5)'
                                    : '-12px 10px 30px rgba(0,0,0,0.5)'
                                  : 'none',
                            }}
                          >
                            <img
                              src={flipState.backImg}
                              alt="Verso da página virando"
                              className="w-full h-full object-contain"
                            />
                            {/* Gradiente dinâmico de iluminação no verso */}
                            <div
                              className="absolute inset-0 pointer-events-none transition-opacity duration-200"
                              style={{
                                background:
                                  flipState.direction === 'next'
                                    ? 'linear-gradient(to left, rgba(0,0,0,0.25) 0%, transparent 60%)'
                                    : 'linear-gradient(to right, rgba(0,0,0,0.25) 0%, transparent 60%)',
                                opacity: flipState.phase === 'animating' ? 0.5 : 0,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
              disabled={!canGoPrev || isFlipping}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-[#040D1A] hover:bg-[#0B1E36] border border-blue-400/25 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4 text-[#60A5FA]" />
              <span className="hidden sm:inline">Página anterior</span>
              <span className="sm:hidden">Anterior</span>
            </button>

            {/* Indicador de Páginas / Ir para Página */}
            <form
              onSubmit={handlePageInputSubmit}
              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-mono tabular-nums"
            >
              <span className="text-blue-200/75 hidden xs:inline">
                {effectiveViewMode === 'double' && rightPageNum
                  ? 'Páginas'
                  : 'Página'}
              </span>

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
                {effectiveViewMode === 'double' && rightPageNum && (
                  <>
                    e <strong className="text-white">{rightPageNum}</strong>{' '}
                  </>
                )}
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
              disabled={!canGoNext || isFlipping}
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
