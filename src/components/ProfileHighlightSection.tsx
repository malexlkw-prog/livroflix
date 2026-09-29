import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { ProfileHighlight } from '../types';

const MAX_HIGHLIGHT_PHOTOS = 3;
const MAX_HIGHLIGHT_NAME_LENGTH = 30;
const HIGHLIGHT_DOC_ID = 'profile';
const sessionHighlightCache = new Map<string, ProfileHighlight | null>();

function getLocalHighlightCacheKey(userId: string): string {
  return `livroflix_profile_highlight_${userId}`;
}

function readCachedHighlight(userId: string): ProfileHighlight | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getLocalHighlightCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileHighlight;
    if (
      parsed &&
      typeof parsed.name === 'string' &&
      Array.isArray(parsed.photos) &&
      parsed.photos.length >= 1 &&
      parsed.photos.length <= MAX_HIGHLIGHT_PHOTOS
    ) {
      return {
        ...parsed,
        photos: parsed.photos.slice(0, MAX_HIGHLIGHT_PHOTOS),
        coverUrl: parsed.photos[0],
      };
    }
  } catch {
    // ignore localStorage errors
  }
  return null;
}

function writeCachedHighlight(
  userId: string,
  highlight: ProfileHighlight | null
): void {
  if (!userId) return;
  try {
    if (!highlight) {
      localStorage.removeItem(getLocalHighlightCacheKey(userId));
    } else {
      localStorage.setItem(
        getLocalHighlightCacheKey(userId),
        JSON.stringify(highlight)
      );
    }
  } catch {
    // ignore quota errors
  }
}

/**
 * Reutiliza a estratégia de compressão de imagens em Canvas já usada no LIVROFLIX
 * para armazenar fotos otimizadas diretamente no Firestore sem provedores pagos externos.
 */
async function compressHighlightPhotoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem válido (JPG, PNG, WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem selecionada.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        const maxDimension = 1080;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }

        ctx.fillStyle = '#040D1A';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Garante que cada foto respeite o limite das Firestore Rules (<= 320.000 caracteres)
        while (dataUrl.length > 290000 && quality > 0.42) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface ProfileHighlightSectionProps {
  userId?: string | null;
  isOwner: boolean;
  align?: 'left' | 'center-md-left' | 'center-sm-left';
}

export const ProfileHighlightSection: React.FC<ProfileHighlightSectionProps> = ({
  userId,
  isOwner,
  align = 'center-md-left',
}) => {
  const [highlight, setHighlight] = useState<ProfileHighlight | null>(() =>
    userId ? readCachedHighlight(userId) : null
  );
  const [loading, setLoading] = useState<boolean>(Boolean(userId));

  // Viewer Modal State
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Editor Modal State (Create / Edit)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPhotos, setDraftPhotos] = useState<string[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!userId) {
      setHighlight(null);
      setLoading(false);
      return;
    }

    if (sessionHighlightCache.has(userId)) {
      const memCached = sessionHighlightCache.get(userId) ?? null;
      setHighlight(memCached);
      setLoading(false);
      return;
    }

    const cached = readCachedHighlight(userId);
    if (cached) {
      setHighlight(cached);
    }

    let cancelled = false;
    const highlightRef = doc(db, 'users', userId, 'highlights', HIGHLIGHT_DOC_ID);
    getDoc(highlightRef)
      .then((snapshot) => {
        if (cancelled) return;
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<ProfileHighlight>;
          const rawPhotos = Array.isArray(data.photos)
            ? data.photos
                .filter((p): p is string => typeof p === 'string' && p.length > 0)
                .slice(0, MAX_HIGHLIGHT_PHOTOS)
            : [];

          if (rawPhotos.length >= 1) {
            const normalized: ProfileHighlight = {
              name:
                typeof data.name === 'string' && data.name.trim()
                  ? data.name.trim().slice(0, MAX_HIGHLIGHT_NAME_LENGTH)
                  : 'Destaque',
              photos: rawPhotos,
              coverUrl: rawPhotos[0],
              createdAt:
                typeof data.createdAt === 'string'
                  ? data.createdAt
                  : new Date().toISOString(),
              updatedAt:
                typeof data.updatedAt === 'string'
                  ? data.updatedAt
                  : new Date().toISOString(),
            };
            sessionHighlightCache.set(userId, normalized);
            setHighlight(normalized);
            writeCachedHighlight(userId, normalized);
          } else {
            sessionHighlightCache.set(userId, null);
            setHighlight(null);
            writeCachedHighlight(userId, null);
          }
        } else {
          sessionHighlightCache.set(userId, null);
          setHighlight(null);
          writeCachedHighlight(userId, null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Navegação por teclado no visualizador de destaque
  useEffect(() => {
    if (!isViewerOpen || !highlight) return;
    const total = highlight.photos.length;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsViewerOpen(false);
      } else if (total > 1 && e.key === 'ArrowRight') {
        setActivePhotoIndex((prev) => (prev < total - 1 ? prev + 1 : prev));
      } else if (total > 1 && e.key === 'ArrowLeft') {
        setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerOpen, highlight]);

  const openCreateModal = () => {
    if (!isOwner) return;
    setDraftName(highlight?.name || 'Destaque');
    setDraftPhotos(highlight?.photos ? [...highlight.photos] : []);
    setEditorError(null);
    setShowDeleteConfirm(false);
    setIsEditorOpen(true);
  };

  const openEditModal = () => {
    if (!isOwner || !highlight) return;
    setDraftName(highlight.name);
    setDraftPhotos([...highlight.photos]);
    setEditorError(null);
    setShowDeleteConfirm(false);
    setIsViewerOpen(false);
    setIsEditorOpen(true);
  };

  const openViewerModal = () => {
    if (!highlight || highlight.photos.length === 0) return;
    setActivePhotoIndex(0);
    setIsViewerOpen(true);
  };

  const handleSelectFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setEditorError(null);
    const remainingSlots = MAX_HIGHLIGHT_PHOTOS - draftPhotos.length;
    if (remainingSlots <= 0) {
      setEditorError('Limite absoluto atingido: máximo de 3 fotos por destaque.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const filesToProcess: File[] = Array.from(fileList).slice(0, remainingSlots);
    if (fileList.length > remainingSlots) {
      setEditorError(
        `Limite máximo de ${MAX_HIGHLIGHT_PHOTOS} fotos. Apenas ${
          remainingSlots === 1 ? '1 foto foi adicionada' : `${remainingSlots} fotos foram adicionadas`
        }.`
      );
    }

    setIsProcessingImages(true);
    try {
      const compressedList: string[] = [];
      for (const file of filesToProcess) {
        const dataUrl = await compressHighlightPhotoToDataUrl(file);
        compressedList.push(dataUrl);
      }

      setDraftPhotos((prev) =>
        [...prev, ...compressedList].slice(0, MAX_HIGHLIGHT_PHOTOS)
      );
    } catch (err: unknown) {
      setEditorError(
        err instanceof Error ? err.message : 'Erro ao processar as fotos.'
      );
    } finally {
      setIsProcessingImages(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveDraftPhoto = (indexToRemove: number) => {
    setDraftPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setEditorError(null);
  };

  const handleMoveDraftPhoto = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= draftPhotos.length) return;
    setDraftPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleSaveHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !userId) return;

    const cleanName = draftName.trim().slice(0, MAX_HIGHLIGHT_NAME_LENGTH);
    if (!cleanName) {
      setEditorError('Escolha um nome para o seu destaque.');
      return;
    }

    if (draftPhotos.length === 0) {
      setEditorError('Adicione pelo menos 1 foto ao destaque.');
      return;
    }

    const boundedPhotos = draftPhotos.slice(0, MAX_HIGHLIGHT_PHOTOS);
    const nowIso = new Date().toISOString();

    const payload: ProfileHighlight = {
      name: cleanName,
      photos: boundedPhotos,
      coverUrl: boundedPhotos[0], // 1ª foto é automaticamente a capa da bolinha
      createdAt: highlight?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    setIsSaving(true);
    setEditorError(null);

    try {
      const highlightRef = doc(
        db,
        'users',
        userId,
        'highlights',
        HIGHLIGHT_DOC_ID
      );
      await setDoc(highlightRef, payload);
      sessionHighlightCache.set(userId, payload);
      setHighlight(payload);
      writeCachedHighlight(userId, payload);
      setIsEditorOpen(false);
    } catch (err: unknown) {
      try {
        handleFirestoreError(
          err,
          highlight ? OperationType.UPDATE : OperationType.CREATE,
          `users/${userId}/highlights/${HIGHLIGHT_DOC_ID}`
        );
      } catch {
        // tratado abaixo para exibir feedback amigável
      }
      setEditorError(
        'Não foi possível salvar o destaque no momento. Tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteHighlight = async () => {
    if (!isOwner || !userId) return;
    setIsSaving(true);
    setEditorError(null);

    try {
      const highlightRef = doc(
        db,
        'users',
        userId,
        'highlights',
        HIGHLIGHT_DOC_ID
      );
      await deleteDoc(highlightRef);
      sessionHighlightCache.set(userId, null);
      setHighlight(null);
      writeCachedHighlight(userId, null);
      setShowDeleteConfirm(false);
      setIsEditorOpen(false);
      setIsViewerOpen(false);
    } catch (err: unknown) {
      try {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `users/${userId}/highlights/${HIGHLIGHT_DOC_ID}`
        );
      } catch {
        // tratado abaixo
      }
      setEditorError('Não foi possível excluir o destaque. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Se for visitante de outro perfil e não houver destaque ativo, não exibe nada
  if (!isOwner && !highlight) {
    return null;
  }

  if (loading && !highlight && !isOwner) {
    return null;
  }

  const alignmentClasses =
    align === 'left'
      ? 'justify-start'
      : align === 'center-sm-left'
      ? 'justify-center sm:justify-start'
      : 'justify-center md:justify-start';

  const coverPhotoUrl = highlight?.photos?.[0] || highlight?.coverUrl || '';

  return (
    <>
      {/* Seção compacta abaixo da bio: apenas 1 bolinha circular (ou botão + Novo destaque para o dono) */}
      <div className={`mt-4 flex items-center ${alignmentClasses} gap-3.5`}>
        {highlight && coverPhotoUrl ? (
          <div className="flex items-center gap-3.5">
            {/* Única bolinha circular do destaque */}
            <button
              type="button"
              onClick={openViewerModal}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
              title={`Ver destaque: ${highlight.name}`}
            >
              <div className="relative h-16 w-16 rounded-full p-[2.5px] bg-gradient-to-tr from-[#2563EB] via-[#60A5FA] to-sky-300 shadow-[0_0_18px_rgba(37,99,235,0.3)] group-hover:scale-105 transition-transform duration-200">
                <div className="h-full w-full rounded-full overflow-hidden bg-[#040D1A] p-[2px]">
                  <img
                    src={coverPhotoUrl}
                    alt={highlight.name}
                    className="h-full w-full rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              <span className="max-w-[80px] truncate text-[11px] font-semibold text-blue-100/95 group-hover:text-white transition-colors">
                {highlight.name}
              </span>
            </button>

            {/* Se o usuário for dono e já tiver destaque, não mostra "+ Novo destaque", mostra "Editar destaque" */}
            {isOwner && (
              <button
                type="button"
                onClick={openEditModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#040D1A]/80 hover:bg-blue-500/20 border border-blue-400/30 hover:border-[#60A5FA]/60 px-3 py-1.5 text-[11px] font-semibold text-blue-200/90 hover:text-white transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Editar destaque</span>
              </button>
            )}
          </div>
        ) : isOwner ? (
          /* Estado sem destaque (apenas para o dono do perfil): + Novo destaque */
          <button
            type="button"
            onClick={openCreateModal}
            className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            title="Adicionar destaque ao perfil"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#040D1A]/85 border-2 border-dashed border-blue-400/45 group-hover:border-[#60A5FA] group-hover:bg-blue-500/15 text-[#60A5FA] shadow-md group-hover:scale-105 transition-all duration-200">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-semibold text-blue-200/90 group-hover:text-white transition-colors">
              + Novo destaque
            </span>
          </button>
        ) : null}
      </div>

      {/* ===================================================================== */}
      {/* VISUALIZADOR ESTILO STORIES / DESTAQUES DO INSTAGRAM                  */}
      {/* ===================================================================== */}
      {isViewerOpen &&
        highlight &&
        highlight.photos.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4"
            onClick={() => setIsViewerOpen(false)}
          >
            <div
              className="relative flex flex-col w-full h-full sm:h-[86vh] sm:max-h-[760px] sm:max-w-[430px] sm:rounded-3xl bg-[#040D1A] sm:border sm:border-blue-400/25 shadow-2xl overflow-hidden select-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Barras superiores estilo Stories (quando houver mais de 1 foto ou barra única) */}
              <div className="absolute top-0 inset-x-0 z-20 p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                <div className="flex items-center gap-1.5 mb-3">
                  {highlight.photos.map((_, idx) => (
                    <div
                      key={idx}
                      className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          idx <= activePhotoIndex ? 'w-full bg-white' : 'w-0'
                        }`}
                      />
                    </div>
                  ))}
                </div>

                {/* Cabeçalho do Visualizador: Capa, Nome, Indicador 1/3, Editar (se dono) e Fechar */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={highlight.photos[0]}
                      alt={highlight.name}
                      className="h-8 w-8 rounded-full object-cover ring-1 ring-[#60A5FA] shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <span className="font-display text-sm font-bold text-white truncate">
                      {highlight.name}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-black/55 border border-white/15 px-2 py-0.5 text-[11px] font-mono-num font-bold text-blue-100 shrink-0">
                      {activePhotoIndex + 1}/{MAX_HIGHLIGHT_PHOTOS}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isOwner && (
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="inline-flex items-center gap-1 rounded-lg bg-black/50 hover:bg-blue-500/30 border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer"
                        title="Editar destaque"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#60A5FA]" />
                        <span>Editar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsViewerOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      aria-label="Fechar destaque"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Área Principal da Foto */}
              <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
                <img
                  src={
                    highlight.photos[activePhotoIndex] || highlight.photos[0]
                  }
                  alt={`${highlight.name} - Foto ${activePhotoIndex + 1}`}
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />

                {/* Navegação: só exibe botões se houver mais de 1 foto */}
                {highlight.photos.length > 1 && (
                  <>
                    {activePhotoIndex > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setActivePhotoIndex((prev) => Math.max(0, prev - 1))
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white shadow-lg transition-all cursor-pointer"
                        aria-label="Foto anterior"
                        title="Foto anterior"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}

                    {activePhotoIndex < highlight.photos.length - 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setActivePhotoIndex((prev) =>
                            Math.min(highlight.photos.length - 1, prev + 1)
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white shadow-lg transition-all cursor-pointer"
                        aria-label="Próxima foto"
                        title="Próxima foto"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Rodapé compacto quando há mais de 1 foto */}
              {highlight.photos.length > 1 && (
                <div className="px-4 py-3 bg-[#040D1A] border-t border-blue-400/15 flex items-center justify-between text-xs text-blue-200/80">
                  <button
                    type="button"
                    disabled={activePhotoIndex === 0}
                    onClick={() =>
                      setActivePhotoIndex((prev) => Math.max(0, prev - 1))
                    }
                    className="inline-flex items-center gap-1 font-semibold text-blue-200 hover:text-white disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Foto anterior</span>
                  </button>

                  <span className="font-mono-num text-[11px] font-bold text-blue-200/90">
                    {activePhotoIndex + 1}/{MAX_HIGHLIGHT_PHOTOS}
                  </span>

                  <button
                    type="button"
                    disabled={activePhotoIndex === highlight.photos.length - 1}
                    onClick={() =>
                      setActivePhotoIndex((prev) =>
                        Math.min(highlight.photos.length - 1, prev + 1)
                      )
                    }
                    className="inline-flex items-center gap-1 font-semibold text-blue-200 hover:text-white disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                  >
                    <span>Próxima foto</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================================== */}
      {/* MODAL CRIAR / EDITAR DESTAQUE (SOMENTE DONO DO PERFIL)                */}
      {/* ===================================================================== */}
      {isEditorOpen &&
        isOwner &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => {
              if (!isSaving) setIsEditorOpen(false);
            }}
          >
            <div
              className="relative w-full max-w-md rounded-2xl bg-[#071426] border border-blue-400/30 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-blue-400/15 bg-[#040D1A]/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#60A5FA]" />
                  <h3 className="font-display text-lg font-bold text-white">
                    {highlight ? 'Editar destaque' : 'Novo destaque'}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsEditorOpen(false)}
                  className="text-blue-200/70 hover:text-white transition-colors cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveHighlight} className="p-5 space-y-5">
                {editorError && (
                  <div className="rounded-xl bg-rose-500/15 border border-rose-400/35 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                    {editorError}
                  </div>
                )}

                {/* Prévia da bolinha circular com a 1ª foto como capa automática */}
                <div className="flex items-center gap-4 rounded-xl bg-[#040D1A]/70 border border-blue-400/15 p-3.5">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="h-14 w-14 rounded-full p-[2px] bg-gradient-to-tr from-[#2563EB] via-[#60A5FA] to-sky-300">
                      <div className="h-full w-full rounded-full overflow-hidden bg-[#040D1A] flex items-center justify-center">
                        {draftPhotos[0] ? (
                          <img
                            src={draftPhotos[0]}
                            alt="Capa do destaque"
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ImagePlus className="w-5 h-5 text-blue-300/50" />
                        )}
                      </div>
                    </div>
                    <span className="max-w-[72px] truncate text-[10px] font-semibold text-blue-100">
                      {draftName.trim() || 'Destaque'}
                    </span>
                  </div>

                  <div className="text-xs text-blue-200/80 space-y-1">
                    <p className="font-semibold text-white">
                      Prévia no seu perfil
                    </p>
                    <p className="text-[11px] text-blue-200/70 leading-relaxed">
                      A <strong className="text-white">1ª foto</strong> é
                      automaticamente a capa da bolinha. Reorganize a ordem se
                      quiser mudar a capa.
                    </p>
                  </div>
                </div>

                {/* Campo: Nome do destaque */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="highlight-name-input"
                      className="text-xs font-semibold text-blue-100"
                    >
                      Nome do destaque
                    </label>
                    <span className="text-[11px] font-mono-num text-blue-300/70">
                      {draftName.length}/{MAX_HIGHLIGHT_NAME_LENGTH}
                    </span>
                  </div>
                  <input
                    id="highlight-name-input"
                    type="text"
                    maxLength={MAX_HIGHLIGHT_NAME_LENGTH}
                    value={draftName}
                    onChange={(e) =>
                      setDraftName(
                        e.target.value.slice(0, MAX_HIGHLIGHT_NAME_LENGTH)
                      )
                    }
                    placeholder="Ex: Livros, Leituras, Estante..."
                    className="w-full rounded-xl bg-[#040D1A] border border-blue-400/25 focus:border-[#60A5FA] px-3.5 py-2.5 text-sm text-white placeholder-blue-300/40 focus:outline-none"
                  />
                </div>

                {/* Campo: Fotos (Limite absoluto de 3 fotos) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-blue-100">
                      Fotos do destaque
                    </span>
                    <span className="inline-flex items-center rounded-md bg-blue-500/15 border border-blue-400/30 px-2 py-0.5 text-xs font-mono-num font-bold text-[#60A5FA]">
                      {draftPhotos.length}/{MAX_HIGHLIGHT_PHOTOS}
                    </span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleSelectFiles}
                    className="hidden"
                  />

                  <div className="grid grid-cols-3 gap-3">
                    {draftPhotos.map((photoUrl, idx) => (
                      <div
                        key={idx}
                        className="relative group aspect-[3/4] rounded-xl overflow-hidden bg-[#040D1A] border border-blue-400/30 shadow-md"
                      >
                        <img
                          src={photoUrl}
                          alt={`Foto ${idx + 1}`}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />

                        {/* Badge de Capa na 1ª foto */}
                        <div className="absolute top-1.5 left-1.5 z-10">
                          {idx === 0 ? (
                            <span className="inline-block rounded-md bg-[#2563EB] px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                              Capa (1/{MAX_HIGHLIGHT_PHOTOS})
                            </span>
                          ) : (
                            <span className="inline-block rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-mono-num font-bold text-blue-100">
                              {idx + 1}/{MAX_HIGHLIGHT_PHOTOS}
                            </span>
                          )}
                        </div>

                        {/* Botão Remover foto */}
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftPhoto(idx)}
                          className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                          title="Remover foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>

                        {/* Controles para reorganizar fotos (quando há 2 ou 3 fotos) */}
                        {draftPhotos.length > 1 && (
                          <div className="absolute bottom-1.5 inset-x-1.5 z-10 flex items-center justify-between gap-1 bg-black/75 backdrop-blur-xs rounded-lg px-1.5 py-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveDraftPhoto(idx, idx - 1)}
                              className="p-0.5 text-blue-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                              title="Mover para a esquerda"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] font-semibold text-blue-100/90">
                              Ordem
                            </span>
                            <button
                              type="button"
                              disabled={idx === draftPhotos.length - 1}
                              onClick={() => handleMoveDraftPhoto(idx, idx + 1)}
                              className="p-0.5 text-blue-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                              title="Mover para a direita"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Botão para adicionar foto — só aparece enquanto tiver menos de 3 fotos */}
                    {draftPhotos.length < MAX_HIGHLIGHT_PHOTOS && (
                      <button
                        type="button"
                        disabled={isProcessingImages || isSaving}
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[3/4] rounded-xl border-2 border-dashed border-blue-400/35 hover:border-[#60A5FA] bg-[#040D1A]/60 hover:bg-blue-500/10 flex flex-col items-center justify-center gap-1.5 text-blue-200/80 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isProcessingImages ? (
                          <Loader2 className="w-5 h-5 text-[#60A5FA] animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-6 h-6 text-[#60A5FA]" />
                            <span className="text-[11px] font-semibold">
                              Adicionar
                            </span>
                            <span className="text-[10px] font-mono-num text-blue-300/70">
                              {draftPhotos.length}/{MAX_HIGHLIGHT_PHOTOS}
                            </span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Confirmação de Exclusão (quando o dono clica em Excluir) */}
                {highlight && showDeleteConfirm && (
                  <div className="rounded-xl bg-rose-950/40 border border-rose-400/35 p-3.5 space-y-3">
                    <p className="text-xs font-bold text-white text-center">
                      Excluir destaque?
                    </p>
                    <div className="flex items-center justify-center gap-2.5">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 rounded-lg bg-[#040D1A] hover:bg-blue-950 border border-blue-400/25 py-2 text-xs font-semibold text-blue-100 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleConfirmDeleteHighlight}
                        className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                      >
                        {isSaving ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-blue-400/15">
                  {highlight && !showDeleteConfirm ? (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/30 px-3.5 py-2.5 text-xs font-bold text-rose-300 hover:text-rose-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setIsEditorOpen(false)}
                      className="rounded-xl bg-[#040D1A] hover:bg-blue-950/80 border border-blue-400/25 px-4 py-2.5 text-xs font-semibold text-blue-200 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isSaving ||
                        isProcessingImages ||
                        draftPhotos.length === 0
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-all cursor-pointer"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <span>Salvar destaque</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
