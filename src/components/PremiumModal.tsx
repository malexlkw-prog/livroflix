import React, { useState } from 'react';
import {
  Crown,
  X,
  Check,
  Palette,
  Download,
  Sparkles,
  Heart,
  Loader2,
} from 'lucide-react';
import { UserProfile } from '../types';
import { isUserPremium } from '../utils/premiumUtils';

interface PremiumModalProps {
  isOpen: boolean;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  onClose: () => void;
  onTogglePremium: (nextPremium: boolean) => Promise<void>;
  onOpenCustomizeProfile?: () => void;
  onRequireAuth?: () => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({
  isOpen,
  userProfile,
  isAuthenticated,
  onClose,
  onTogglePremium,
  onOpenCustomizeProfile,
  onRequireAuth,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPremium = isUserPremium(userProfile);

  const handleActivatePremium = async () => {
    if (!isAuthenticated || !userProfile) {
      onClose();
      onRequireAuth?.();
      return;
    }
    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      await onTogglePremium(true);
      setFeedbackMsg('Bem-vindo ao LIVROFLIX Premium! Todos os benefícios foram liberados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPremium = async () => {
    if (!isAuthenticated || !userProfile) return;
    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      await onTogglePremium(false);
      setFeedbackMsg(
        'Assinatura encerrada. Seus dados e favoritos foram preservados no seu perfil.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl border border-amber-400/30 bg-gradient-to-b from-[#0B192E] via-[#071426] to-[#040D1A] p-6 sm:p-8 shadow-[0_25px_70px_rgba(2,6,23,0.95)] overflow-hidden my-auto"
      >
        {/* Subtle Ambient Gold Highlight */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-amber-400/10 blur-3xl"
          aria-hidden="true"
        />

        {/* Close Button */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-blue-200/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer z-10"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Presentation */}
        <div className="relative z-10 flex flex-col items-start">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 text-[#040D1A] shadow-[0_8px_25px_rgba(245,158,11,0.35)]">
              <Crown className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  LIVROFLIX Premium
                </h2>
                {isPremium && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 border border-amber-400/40 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                    <Check className="w-3 h-3" />
                    <span>Ativo</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-amber-300/90 font-semibold">
                R$ 11/mês <span className="text-blue-200/60 font-normal">(R$ 11,00 / mês)</span>
              </p>
            </div>
          </div>

          <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
            Tenha mais liberdade para personalizar seu perfil e acessar recursos exclusivos.
          </p>
        </div>

        {/* Price Highlight Box */}
        <div className="relative z-10 mt-5 rounded-xl bg-[#040D1A]/80 border border-amber-400/25 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <span className="text-xs text-blue-200/75 block">
              Assinatura mensal
            </span>
            <span className="font-display text-2xl sm:text-3xl font-bold text-white">
              R$ 11,00 <span className="text-sm font-normal text-blue-200/75">/ mês</span>
            </span>
          </div>
          <div className="text-right text-xs text-amber-300/90 font-medium">
            Acesso imediato a todos os benefícios
          </div>
        </div>

        {/* Benefits List */}
        <div className="relative z-10 mt-6 space-y-3">
          <div className="flex items-start gap-3.5 rounded-xl bg-[#040D1A]/60 border border-blue-400/15 p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
              <Palette className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">
                Nome de usuário personalizado
              </h3>
              <p className="text-xs text-blue-200/75 mt-0.5 leading-relaxed">
                Escolha uma cor personalizada ou use o seletor de cores para destacar seu @username no perfil e na comunidade.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-xl bg-[#040D1A]/60 border border-blue-400/15 p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
              <Download className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">
                Download de livros
              </h3>
              <p className="text-xs text-blue-200/75 mt-0.5 leading-relaxed">
                Baixe livros disponíveis para download em PDF diretamente do catálogo, mantendo o leitor online sempre disponível.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-xl bg-[#040D1A]/60 border border-blue-400/15 p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">
                Personalização de perfil expandida
              </h3>
              <p className="text-xs text-blue-200/75 mt-0.5 leading-relaxed">
                Desbloqueie mais opções de fundos, banners/capas, efeitos decorativos e temas visuais exclusivos no seu perfil.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-xl bg-[#040D1A]/60 border border-blue-400/15 p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
              <Heart className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">
                5 livros favoritos no perfil
              </h3>
              <p className="text-xs text-blue-200/75 mt-0.5 leading-relaxed">
                Aumente de 3 para até 5 livros favoritos exibidos publicamente no seu perfil literário.
              </p>
            </div>
          </div>
        </div>

        {feedbackMsg && (
          <div className="relative z-10 mt-4 rounded-xl bg-emerald-500/15 border border-emerald-400/30 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="relative z-10 mt-6 space-y-3">
          {!isPremium ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleActivatePremium}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 disabled:opacity-60 py-3.5 px-6 text-sm font-extrabold text-[#040D1A] shadow-[0_10px_30px_-5px_rgba(245,158,11,0.45)] transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Ativando LIVROFLIX Premium...</span>
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4 stroke-[2.4]" />
                  <span>
                    {isAuthenticated
                      ? 'Assinar LIVROFLIX Premium — R$ 11/mês'
                      : 'Entrar na conta para assinar — R$ 11/mês'}
                  </span>
                </>
              )}
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {onOpenCustomizeProfile && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCustomizeProfile();
                  }}
                  className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 py-3 px-5 text-xs sm:text-sm font-extrabold text-[#040D1A] shadow-lg transition-all cursor-pointer"
                >
                  <Palette className="w-4 h-4" />
                  <span>Personalizar meu perfil</span>
                </button>
              )}

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCancelPremium}
                className="w-full sm:w-auto rounded-xl border border-blue-400/20 bg-[#040D1A]/80 hover:bg-rose-500/15 hover:border-rose-400/30 py-3 px-4 text-xs font-semibold text-blue-200/75 hover:text-rose-200 transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Atualizando...' : 'Encerrar assinatura'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
