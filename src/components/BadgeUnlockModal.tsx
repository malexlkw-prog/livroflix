import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  BADGE_DEFINITIONS,
  BadgeId,
  BadgeImage,
  EvaluatedAchievement,
} from '../data/badges';

export interface BadgeUnlockModalProps {
  achievement: EvaluatedAchievement;
  isDisplayedOnProfile: boolean;
  onToggleDisplayOnProfile?: (badgeId: BadgeId) => void;
  onClose: () => void;
  customBadgeImages?: Record<string, string>;
}

type FormationStage =
  | 'surgimento'
  | 'contorno'
  | 'estrutura'
  | 'detalhes'
  | 'revelacao';

const PARTICLES = [
  { angle: 18, distance: 86, size: 4, delay: 0 },
  { angle: 62, distance: 94, size: 3, delay: 70 },
  { angle: 112, distance: 84, size: 3.5, delay: 130 },
  { angle: 158, distance: 92, size: 3, delay: 40 },
  { angle: 204, distance: 88, size: 4, delay: 110 },
  { angle: 248, distance: 96, size: 3, delay: 60 },
  { angle: 296, distance: 84, size: 3.5, delay: 150 },
  { angle: 338, distance: 90, size: 3, delay: 90 },
];

export const BadgeUnlockModal: React.FC<BadgeUnlockModalProps> = ({
  achievement,
  isDisplayedOnProfile,
  onToggleDisplayOnProfile,
  onClose,
  customBadgeImages,
}) => {
  const badgeId = achievement.badgeId;
  const badgeDef = badgeId ? BADGE_DEFINITIONS[badgeId] : undefined;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [stage, setStage] = useState<FormationStage>('surgimento');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    // Safety check: if achievement does not have a badge, never run formation animation
    if (!achievement.hasBadge || !badgeDef) return;

    if (prefersReducedMotion) {
      setStage('revelacao');
      return;
    }

    setStage('surgimento');
    const t1 = window.setTimeout(() => setStage('contorno'), 420);
    const t2 = window.setTimeout(() => setStage('estrutura'), 1000);
    const t3 = window.setTimeout(() => setStage('detalhes'), 1600);
    const t4 = window.setTimeout(() => setStage('revelacao'), 2180);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [achievement.id, achievement.hasBadge, badgeDef, prefersReducedMotion]);

  // Rule guard: only render badge formation modal for achievements with hasBadge === true
  if (!achievement.hasBadge || !badgeId || !badgeDef) {
    return null;
  }

  const stageIndex = {
    surgimento: 1,
    contorno: 2,
    estrutura: 3,
    detalhes: 4,
    revelacao: 5,
  }[stage];

  const contourPath =
    badgeDef.shape === 'circle'
      ? 'M 128 16 A 112 112 0 1 1 127.99 16 Z'
      : badgeDef.shape === 'hex-shield'
      ? 'M 128 12 L 218 62 L 218 173 L 128 244 L 38 173 L 38 62 Z'
      : 'M 128 12 L 216 61 L 208 172 L 128 243 L 48 172 L 40 61 Z';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-unlock-title"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020710]/85 backdrop-blur-md p-4"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#071426] border border-blue-400/30 p-6 sm:p-8 text-center shadow-[0_24px_64px_rgba(0,0,0,0.75)]">
        {/* Subtle Ambient Literary Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-64 rounded-full opacity-30 blur-3xl transition-opacity duration-700"
          style={{
            background: `radial-gradient(circle, ${badgeDef.accentColor}, transparent 70%)`,
          }}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 rounded-lg p-1.5 text-blue-200/60 hover:text-white hover:bg-blue-500/15 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Kicker */}
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#60A5FA]">
          Conquista desbloqueada!
        </p>

        {/* Achievement Title & Confirmation */}
        <h2
          id="badge-unlock-title"
          className="mt-2 font-display text-2xl sm:text-3xl font-bold text-white"
        >
          {achievement.title}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-blue-200/80">
          Você concluiu esta conquista.
        </p>

        {/* Divider & Reward Label */}
        <div className="mt-5 mb-2 flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-blue-400/20" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300/90">
            Recompensa desbloqueada
          </span>
          <span className="h-px w-10 bg-blue-400/20" />
        </div>

        {/* 5-Stage Badge Formation Stage */}
        <div className="relative mx-auto my-4 flex h-48 w-48 items-center justify-center">
          {/* 1. Surgimento: Central Energy Core */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full transition-all duration-500"
            style={{
              width: stageIndex === 1 ? '44px' : stageIndex >= 3 ? '156px' : '92px',
              height: stageIndex === 1 ? '44px' : stageIndex >= 3 ? '156px' : '92px',
              opacity: stageIndex === 1 ? 0.95 : stageIndex === 5 ? 0.28 : 0.65,
              background: `radial-gradient(circle, #FFF3C4 0%, ${badgeDef.accentColor} 45%, transparent 72%)`,
              filter: 'blur(10px)',
              transform: `scale(${stageIndex === 1 ? 0.85 : 1})`,
            }}
          />

          {/* 2. Contorno: Progressive Outer Contour Drawing */}
          {!prefersReducedMotion && stageIndex >= 2 && (
            <svg
              aria-hidden="true"
              viewBox="0 0 256 256"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <path
                d={contourPath}
                fill="none"
                stroke={badgeDef.accentColor}
                strokeWidth={stageIndex >= 5 ? '2' : '3.5'}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 820,
                  strokeDashoffset: stageIndex >= 3 ? 0 : 180,
                  opacity: stageIndex >= 5 ? 0 : 0.9,
                  transition:
                    'stroke-dashoffset 650ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease',
                }}
              />
            </svg>
          )}

          {/* 3 & 4 & 5. Estrutura -> Detalhes -> Revelação of the Real Badge Asset */}
          <div
            className="relative flex items-center justify-center transition-all"
            style={{
              width: '164px',
              height: '164px',
              opacity: stageIndex === 1 ? 0 : stageIndex === 2 ? 0.22 : 1,
              transform: prefersReducedMotion
                ? 'scale(1)'
                : stageIndex === 1
                ? 'scale(0.45)'
                : stageIndex === 2
                ? 'scale(0.76)'
                : stageIndex === 3
                ? 'scale(0.92)'
                : stageIndex === 4
                ? 'scale(0.98)'
                : 'scale(1.04)',
              clipPath: prefersReducedMotion
                ? 'circle(75% at 50% 50%)'
                : stageIndex <= 2
                ? 'circle(24% at 50% 50%)'
                : stageIndex === 3
                ? 'circle(44% at 50% 50%)'
                : 'circle(75% at 50% 50%)',
              filter: prefersReducedMotion
                ? 'none'
                : stageIndex <= 3
                ? 'brightness(1.55) contrast(0.82) saturate(0.35) blur(2.5px)'
                : stageIndex === 4
                ? 'brightness(1.15) contrast(0.96) saturate(0.88) blur(0.4px)'
                : 'brightness(1) contrast(1) saturate(1) blur(0px)',
              transition: prefersReducedMotion
                ? 'opacity 220ms ease-out'
                : 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 420ms ease, clip-path 540ms cubic-bezier(0.22, 1, 0.36, 1), filter 480ms ease',
            }}
          >
            <BadgeImage
              badgeId={badgeId}
              customBadgeImages={customBadgeImages}
              className="w-40 h-40"
            />

            {/* 5. Revelação: Subtle Sheen Sweep Across the Real Badge */}
            {!prefersReducedMotion && stage === 'revelacao' && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
              >
                <div
                  className="h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                  style={{
                    animation: 'livroflixBadgeSheen 900ms ease-out forwards',
                  }}
                />
              </div>
            )}
          </div>

          {/* 5. Revelação: Discreet Literary Particles */}
          {!prefersReducedMotion &&
            stage === 'revelacao' &&
            PARTICLES.map((p, idx) => {
              const rad = (p.angle * Math.PI) / 180;
              const tx = Math.cos(rad) * p.distance;
              const ty = Math.sin(rad) * p.distance;
              return (
                <span
                  key={idx}
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    backgroundColor: '#F6E29F',
                    boxShadow: '0 0 8px rgba(246, 226, 159, 0.85)',
                    transform: `translate(${tx}px, ${ty}px) scale(1)`,
                    opacity: 0,
                    animation: `livroflixBadgeParticle 950ms cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}ms forwards`,
                    ['--tx' as string]: `${tx}px`,
                    ['--ty' as string]: `${ty}px`,
                  }}
                />
              );
            })}
        </div>

        {/* Revealed Badge Name */}
        <div
          className={`transition-all duration-500 ${
            stageIndex >= 4
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-1'
          }`}
        >
          <p className="font-display text-lg sm:text-xl font-bold text-amber-200">
            Selo: {badgeDef.name}
          </p>
          <p className="mt-1 text-xs text-blue-200/70">
            O selo foi salvo na sua coleção e pode decorar o seu perfil.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          {onToggleDisplayOnProfile && (
            <button
              type="button"
              onClick={() => onToggleDisplayOnProfile(badgeId)}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                isDisplayedOnProfile
                  ? 'bg-[#2563EB]/25 border-[#60A5FA] text-white'
                  : 'bg-[#040D1A] hover:bg-blue-500/15 border-blue-400/30 text-blue-100'
              }`}
            >
              {isDisplayedOnProfile ? (
                <>
                  <Check className="w-4 h-4 text-[#60A5FA]" />
                  <span>Exibido no perfil</span>
                </>
              ) : (
                <span>Exibir no perfil</span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer"
          >
            Continuar
          </button>
        </div>

        <style>{`
          @keyframes livroflixBadgeSheen {
            0% { transform: translateX(-180%) skewX(-18deg); opacity: 0; }
            30% { opacity: 1; }
            100% { transform: translateX(260%) skewX(-18deg); opacity: 0; }
          }
          @keyframes livroflixBadgeParticle {
            0% { transform: translate(0px, 0px) scale(0.3); opacity: 0.95; }
            70% { opacity: 0.75; }
            100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
};

/**
 * Simple notification banner for achievements WITHOUT a badge (hasBadge: false).
 * Shows normal completion feedback without any badge or formation animation.
 */
export const CommonAchievementUnlockedBanner: React.FC<{
  achievement: EvaluatedAchievement;
  onClose: () => void;
}> = ({ achievement, onClose }) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timer);
  }, [achievement.id, onClose]);

  if (achievement.hasBadge) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[115] max-w-sm rounded-xl bg-[#071426] border border-blue-400/35 p-4 shadow-2xl flex items-start gap-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-950 text-xl">
        {achievement.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
          Conquista concluída
        </p>
        <h4 className="font-display text-base font-bold text-white truncate">
          {achievement.title}
        </h4>
        <p className="text-xs text-blue-200/75 mt-0.5">
          {achievement.description}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar aviso"
        className="text-blue-200/50 hover:text-white p-1 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
