import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Settings,
  ChevronRight,
  ArrowLeft,
  Clock,
  ShieldCheck,
  User,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ProfileViewRecord, PublicProfile, UserProfile } from '../types';
import { getEffectiveUsernameColor } from '../utils/premiumUtils';

interface ProfileViewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile | null;
  onToggleProfileViews: (enabled: boolean) => Promise<void>;
  onSelectUser: (userId: string) => void;
  publicProfilesMap?: Record<string, PublicProfile>;
  onEnsurePublicProfileLoaded?: (userId: string) => void;
}

function formatRelativeTime(isoString: string): string {
  try {
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return 'Recentemente';

    const diffMs = Date.now() - timestamp;
    if (diffMs < 0) return 'Agora mesmo';

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Há ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;

    return 'Há mais de 7 dias';
  } catch {
    return 'Recentemente';
  }
}

export const ProfileViewsModal: React.FC<ProfileViewsModalProps> = ({
  isOpen,
  onClose,
  currentUserProfile,
  onToggleProfileViews,
  onSelectUser,
  publicProfilesMap = {},
  onEnsurePublicProfileLoaded,
}) => {
  const [loading, setLoading] = useState(false);
  const [views, setViews] = useState<ProfileViewRecord[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEnabled = Boolean(currentUserProfile?.profileViewsEnabled);

  const loadViews = useCallback(async () => {
    if (!currentUserProfile?.uid || !isEnabled) {
      setViews([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const sevenDaysAgoIso = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const path = `users/${currentUserProfile.uid}/profile_views`;

    try {
      let fetched: ProfileViewRecord[] = [];
      try {
        // Optimized query with server filter and ordering
        const q = query(
          collection(db, 'users', currentUserProfile.uid, 'profile_views'),
          where('visitedAt', '>=', sevenDaysAgoIso),
          orderBy('visitedAt', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        fetched = snap.docs.map((docSnap) => docSnap.data() as ProfileViewRecord);
      } catch {
        // Fallback in case composite index is still propagating
        const fallbackQ = query(
          collection(db, 'users', currentUserProfile.uid, 'profile_views'),
          limit(100)
        );
        const snap = await getDocs(fallbackQ);
        fetched = snap.docs
          .map((docSnap) => docSnap.data() as ProfileViewRecord)
          .filter((v) => v.visitedAt >= sevenDaysAgoIso)
          .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));
      }

      // Filter: never display self, and do not display visitors who disabled the feature
      const sanitized = fetched.filter((v) => {
        if (!v.visitorId || v.visitorId === currentUserProfile.uid) return false;
        const pub = publicProfilesMap[v.visitorId];
        // If the visitor explicitly disabled profile views, do not display them
        if (pub && pub.profileViewsEnabled === false) return false;
        return true;
      });

      setViews(sanitized);

      // Pre-warm public profiles for visitors to show fresh avatar/name
      sanitized.forEach((v) => {
        if (v.visitorId && onEnsurePublicProfileLoaded) {
          onEnsurePublicProfileLoaded(v.visitorId);
        }
      });
    } catch (err: unknown) {
      console.warn('Erro ao carregar visualizações do perfil:', err);
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch {
        // Ignore JSON error throw from handler
      }
      setError('Não foi possível carregar as visualizações agora.');
    } finally {
      setLoading(false);
    }
  }, [currentUserProfile?.uid, isEnabled, publicProfilesMap, onEnsurePublicProfileLoaded]);

  useEffect(() => {
    if (isOpen) {
      setShowSettings(false);
      if (isEnabled) {
        void loadViews();
      }

      // Trava rolagem do fundo enquanto a opção estiver aberta
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, isEnabled, loadViews, onClose]);

  if (!isOpen) return null;

  const handleToggle = async (targetValue: boolean) => {
    setIsToggling(true);
    setError(null);
    try {
      await onToggleProfileViews(targetValue);
      if (targetValue) {
        setShowSettings(false);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao alterar configuração de privacidade.'
      );
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#071326] border border-blue-400/25 shadow-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile top pull indicator */}
        <div
          onClick={onClose}
          className="w-12 h-1.5 rounded-full bg-blue-400/35 hover:bg-blue-300 mx-auto mt-2.5 mb-0.5 sm:hidden cursor-pointer"
          title="Fechar"
        />

        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-blue-400/15 bg-blue-950/40">
          <div className="flex items-center gap-2.5">
            {showSettings ? (
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-blue-200 hover:text-white hover:bg-blue-500/15 transition-colors cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-[#60A5FA]">
                <Eye className="w-4 h-4" />
              </div>
            )}
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
              {showSettings ? 'Configurações de Visitas' : 'Visualizações do perfil'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {!showSettings && isEnabled && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                title="Configurações de privacidade"
                className="flex h-9 w-9 items-center justify-center rounded-full text-blue-200 hover:text-white hover:bg-blue-500/20 transition-colors cursor-pointer"
              >
                <Settings className="w-4.5 h-4.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/90 hover:bg-rose-600 border border-blue-400/40 hover:border-rose-400 text-white transition-all cursor-pointer shadow-md active:scale-90"
              title="Fechar (X)"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 no-scrollbar">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-200">
              {error}
            </div>
          )}

          {/* Subview: Settings */}
          {showSettings ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-400/20 bg-blue-950/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Histórico de visualizações do perfil
                    </h3>
                    <p className="text-xs text-blue-200/70 mt-1 leading-relaxed">
                      Permite que você veja quem visualizou o seu perfil nos últimos 7 dias e permite que outras pessoas vejam quando você visualizou o delas.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggle(!isEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isEnabled ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-400/10 bg-slate-900/40 p-4 text-xs text-blue-200/70 space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Apenas você pode ver quem visualizou o seu perfil.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Quando esta opção estiver desativada, você não aparecerá nas listas de visualizações de outros leitores.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    O histórico registra apenas visitas dos últimos 7 dias.
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="w-full py-2.5 rounded-xl border border-blue-400/30 bg-blue-600/30 hover:bg-blue-600/50 text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  Concluído
                </button>
              </div>
            </div>
          ) : !isEnabled ? (
            /* TikTok-Style Opt-In Activation Screen */
            <div className="flex flex-col items-center text-center py-4 px-2">
              <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/30 border border-blue-400/40 shadow-[0_0_25px_rgba(59,130,246,0.3)]">
                <Eye className="w-10 h-10 text-[#60A5FA]" />
                <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shadow">
                  7d
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2">
                Ativar visualizações do perfil
              </h3>

              <p className="text-xs sm:text-sm text-blue-100/80 max-w-sm mb-6 leading-relaxed">
                Veja quem visualizou seu perfil nos últimos 7 dias e permita que outras pessoas vejam quando você visualizou o delas.
              </p>

              <div className="w-full rounded-2xl border border-blue-400/15 bg-blue-950/30 p-4 text-left text-xs text-blue-200/80 space-y-2.5 mb-6">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-4 w-4 rounded-full bg-blue-500/20 items-center justify-center text-blue-300 shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span>
                    Apenas você pode ver quem visualizou o seu perfil.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-4 w-4 rounded-full bg-blue-500/20 items-center justify-center text-blue-300 shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span>
                    Apenas pessoas que também ativaram essa opção serão exibidas.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-4 w-4 rounded-full bg-blue-500/20 items-center justify-center text-blue-300 shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span>
                    Você pode desativar essa função a qualquer momento nas configurações.
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isToggling}
                onClick={() => handleToggle(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-[#2563EB] hover:bg-blue-600 active:scale-[0.99] text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isToggling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Ativando...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Ativar visualizações do perfil</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full mt-2.5 py-2.5 rounded-xl border border-blue-400/20 bg-blue-950/40 hover:bg-blue-900/40 text-blue-200 hover:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Fechar</span>
              </button>
            </div>
          ) : (
            /* Views List Screen */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 text-xs text-blue-200/70 border-b border-blue-400/10">
                <span>Pessoas que visitaram seu perfil nos últimos 7 dias</span>
                <button
                  type="button"
                  onClick={loadViews}
                  disabled={loading}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  title="Atualizar"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Atualizar</span>
                </button>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-blue-300">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <span className="text-xs">Carregando visitantes...</span>
                </div>
              ) : views.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-blue-400 mb-3">
                    <Eye className="w-6 h-6 opacity-60" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">
                    Nenhuma visualização recente
                  </h4>
                  <p className="text-xs text-blue-200/60 max-w-xs leading-relaxed">
                    Quando outros leitores que ativaram as visualizações visitarem seu perfil nos últimos 7 dias, eles aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {views.map((item) => {
                    const pub = publicProfilesMap[item.visitorId];
                    const effectiveName =
                      pub?.displayName || item.visitorName || 'Leitor LIVROFLIX';
                    const rawUsername =
                      pub?.username || item.visitorUsername || '';
                    const effectiveUsername = rawUsername
                      ? `@${rawUsername.replace(/^@+/, '')}`
                      : '';
                    const effectivePhoto =
                      pub?.photoURL || item.visitorPhoto || '';
                    const usernameColor = pub
                      ? getEffectiveUsernameColor(pub)
                      : undefined;

                    return (
                      <div
                        key={item.visitorId}
                        onClick={() => {
                          onClose();
                          onSelectUser(item.visitorId);
                        }}
                        className="group flex items-center justify-between gap-3 p-2.5 rounded-xl border border-blue-400/10 hover:border-blue-400/30 bg-blue-950/20 hover:bg-blue-900/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            {effectivePhoto ? (
                              <img
                                src={effectivePhoto}
                                alt={effectiveName}
                                className="w-11 h-11 rounded-full object-cover ring-1 ring-blue-400/40 group-hover:ring-blue-400 transition-all"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center text-white font-bold text-base ring-1 ring-blue-400/40">
                                {(effectiveName || 'L')[0].toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-white truncate max-w-[170px] sm:max-w-[220px]">
                                {effectiveName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-blue-200/70">
                              {effectiveUsername && (
                                <span
                                  className="truncate font-medium"
                                  style={usernameColor ? { color: usernameColor } : undefined}
                                >
                                  {effectiveUsername}
                                </span>
                              )}
                              {effectiveUsername && (
                                <span className="opacity-40">•</span>
                              )}
                              <span className="text-[11px] text-blue-300/60 shrink-0">
                                {formatRelativeTime(item.visitedAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right Action */}
                        <div className="shrink-0 flex items-center text-blue-300/50 group-hover:text-blue-200 group-hover:translate-x-0.5 transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Clear Fechar Button */}
        {isEnabled && !showSettings && (
          <div className="p-3 border-t border-blue-400/15 bg-blue-950/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-blue-400/30 bg-blue-600/20 hover:bg-blue-600/35 text-blue-100 hover:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4 stroke-[2.2]" />
              <span>Fechar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
