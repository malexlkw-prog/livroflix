import React, { useState, useEffect } from 'react';
import { Book, UserBookItem, UserProfile } from '../types';

export type BadgeId =
  | 'primeiras_paginas'
  | 'leitor_incansavel'
  | 'leitor_monstruoso'
  | 'biblioteca_ambulante'
  | 'mestre_da_leitura'
  | 'leitor_noturno'
  | 'explorador_literario'
  | 'colecionador'
  | 'maratonista'
  | 'apaixonado_por_livros';

export type BadgeContourShape = 'circle' | 'hex-shield' | 'crest-shield';

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  achievementId: string;
  achievementTitle: string;
  achievementDescription: string;
  defaultImageUrl: string;
  shape: BadgeContourShape;
  accentColor: string;
}

export const ALL_BADGE_IDS: BadgeId[] = [
  'primeiras_paginas',
  'leitor_incansavel',
  'leitor_monstruoso',
  'biblioteca_ambulante',
  'mestre_da_leitura',
  'leitor_noturno',
  'explorador_literario',
  'colecionador',
  'maratonista',
  'apaixonado_por_livros',
];

export const BADGE_DEFINITIONS: Record<BadgeId, BadgeDefinition> = {
  primeiras_paginas: {
    id: 'primeiras_paginas',
    name: 'Primeiras Páginas',
    achievementId: 'ach_primeiras_paginas',
    achievementTitle: 'Primeiras Páginas',
    achievementDescription: 'Leia 5 livros para concluir esta conquista.',
    defaultImageUrl: '/badges/primeiras_paginas.svg',
    shape: 'circle',
    accentColor: '#E5C168',
  },
  leitor_incansavel: {
    id: 'leitor_incansavel',
    name: 'Leitor Incansável',
    achievementId: 'ach_leitor_incansavel',
    achievementTitle: 'Leitor Incansável',
    achievementDescription: 'Leia 25 livros para concluir esta conquista.',
    defaultImageUrl: '/badges/leitor_incansavel.svg',
    shape: 'circle',
    accentColor: '#E5C168',
  },
  leitor_monstruoso: {
    id: 'leitor_monstruoso',
    name: 'Leitor Monstruoso',
    achievementId: 'ach_leitor_monstruoso',
    achievementTitle: 'Leitor Monstruoso',
    achievementDescription: 'Leia 50 livros para concluir esta conquista.',
    defaultImageUrl: '/badges/leitor_monstruoso.svg',
    shape: 'hex-shield',
    accentColor: '#60A5FA',
  },
  biblioteca_ambulante: {
    id: 'biblioteca_ambulante',
    name: 'Biblioteca Ambulante',
    achievementId: 'ach_biblioteca_ambulante',
    achievementTitle: 'Biblioteca Ambulante',
    achievementDescription: 'Leia 100 livros para concluir esta conquista.',
    defaultImageUrl: '/badges/biblioteca_ambulante.svg',
    shape: 'hex-shield',
    accentColor: '#E5C168',
  },
  mestre_da_leitura: {
    id: 'mestre_da_leitura',
    name: 'Mestre da Leitura',
    achievementId: 'ach_mestre_da_leitura',
    achievementTitle: 'Mestre da Leitura',
    achievementDescription: 'Leia 150 livros para concluir esta conquista.',
    defaultImageUrl: '/badges/mestre_da_leitura.svg',
    shape: 'crest-shield',
    accentColor: '#CBD5E1',
  },
  leitor_noturno: {
    id: 'leitor_noturno',
    name: 'Leitor Noturno',
    achievementId: 'ach_leitor_noturno',
    achievementTitle: 'Leitor Noturno',
    achievementDescription:
      'Realize 10 leituras em período noturno (entre 20h e 6h).',
    defaultImageUrl: '/badges/leitor_noturno.svg',
    shape: 'circle',
    accentColor: '#CBD5E1',
  },
  explorador_literario: {
    id: 'explorador_literario',
    name: 'Explorador Literário',
    achievementId: 'ach_explorador_literario',
    achievementTitle: 'Explorador Literário',
    achievementDescription:
      'Leia livros concluídos de pelo menos 5 gêneros diferentes.',
    defaultImageUrl: '/badges/explorador_literario.svg',
    shape: 'hex-shield',
    accentColor: '#E5C168',
  },
  colecionador: {
    id: 'colecionador',
    name: 'Colecionador',
    achievementId: 'ach_colecionador',
    achievementTitle: 'Colecionador',
    achievementDescription: 'Adicione 25 livros à Minha Lista.',
    defaultImageUrl: '/badges/colecionador.svg',
    shape: 'crest-shield',
    accentColor: '#E5C168',
  },
  maratonista: {
    id: 'maratonista',
    name: 'Maratonista',
    achievementId: 'ach_maratonista',
    achievementTitle: 'Maratonista',
    achievementDescription:
      'Conclua 5 livros em um período curto (dentro de 30 dias).',
    defaultImageUrl: '/badges/maratonista.svg',
    shape: 'circle',
    accentColor: '#94A3B8',
  },
  apaixonado_por_livros: {
    id: 'apaixonado_por_livros',
    name: 'Apaixonado por Livros',
    achievementId: 'ach_apaixonado_por_livros',
    achievementTitle: 'Apaixonado por Livros',
    achievementDescription: 'Favorite 20 livros no catálogo do LIVROFLIX.',
    defaultImageUrl: '/badges/apaixonado_por_livros.svg',
    shape: 'circle',
    accentColor: '#F43F5E',
  },
};

export function isValidBadgeId(id: unknown): id is BadgeId {
  return typeof id === 'string' && ALL_BADGE_IDS.includes(id as BadgeId);
}

export interface EvaluatedAchievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  progressText: string;
  currentValue: number;
  targetValue: number;
  isInitial?: boolean;
  hasBadge: boolean;
  badgeId?: BadgeId;
  rewardBadge?: BadgeDefinition;
}

export function isNightHour(date: Date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= 20 || hour < 6;
}

/**
 * Evaluates all literary achievements and determines which badges are unlocked
 * strictly from real reading data in LIVROFLIX.
 * Explicitly distinguishes between the 4 initial achievements (isInitial: true, hasBadge: false)
 * and the additional missions with a badge reward (isInitial: false, hasBadge: true, badgeId).
 */
export function evaluateLiteraryAchievementsAndBadges(
  books: Book[],
  userLibrary: Record<string, UserBookItem>,
  userProfile: UserProfile | null
): {
  achievements: EvaluatedAchievement[];
  computedUnlockedBadgeIds: BadgeId[];
} {
  const entries = Object.values(userLibrary);
  const completedItems = entries.filter((item) => item.status === 'concluido');
  const completedBooksCount = completedItems.length;

  // Minha Lista count
  const myListCount = entries.filter(
    (item) => item.inMyList || item.isFavorite || item.status !== 'nenhum'
  ).length;

  // Favorited books count (❤️)
  const favoritesCount = entries.filter(
    (item) =>
      item.isFavorite || item.inMyList || item.status === 'quero_ler'
  ).length;

  // Unique genres among completed books
  const booksById = new Map(books.map((b) => [b.id, b]));
  const completedGenres = new Set<string>();
  for (const item of completedItems) {
    const book = booksById.get(item.bookId);
    if (book && Array.isArray(book.generos)) {
      for (const g of book.generos) {
        const clean = g.trim().toLowerCase();
        if (clean) completedGenres.add(clean);
      }
    }
  }
  const completedGenresCount = completedGenres.size;

  // Night readings count (between 20:00 and 05:59)
  let libraryNightItemsCount = 0;
  for (const item of entries) {
    if (
      (item.paginaAtual > 1 ||
        item.status === 'concluido' ||
        item.minutosLidos > 0) &&
      item.ultimoAcesso
    ) {
      const parsed = new Date(item.ultimoAcesso);
      if (!Number.isNaN(parsed.getTime()) && isNightHour(parsed)) {
        libraryNightItemsCount += 1;
      }
    }
  }
  const nightReadingsCount = Math.max(
    userProfile?.nightReadingsCount || 0,
    libraryNightItemsCount
  );

  // Marathon count: max books concluded within a 30-day window
  const completedTimestamps = completedItems
    .map((item) => new Date(item.ultimoAcesso).getTime())
    .filter((ts) => !Number.isNaN(ts))
    .sort((a, b) => a - b);

  let maxBooksInShortPeriod = 0;
  const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  for (let i = 0; i < completedTimestamps.length; i++) {
    let countInWindow = 1;
    for (let j = i + 1; j < completedTimestamps.length; j++) {
      if (completedTimestamps[j] - completedTimestamps[i] <= WINDOW_MS) {
        countInWindow++;
      } else {
        break;
      }
    }
    if (countInWindow > maxBooksInShortPeriod) {
      maxBooksInShortPeriod = countInWindow;
    }
  }
  if (completedBooksCount > 0 && maxBooksInShortPeriod === 0) {
    maxBooksInShortPeriod = Math.min(5, completedBooksCount);
  }

  const streakDays = userProfile?.streakDays || 0;
  const previouslyUnlocked = new Set<BadgeId>(
    (userProfile?.unlockedBadges || []).filter(isValidBadgeId)
  );

  const achievements: EvaluatedAchievement[] = [
    // As 4 conquistas atuais (exibidas inicialmente, sem selo)
    {
      id: 'first-book',
      icon: '🏆',
      title: 'Primeiro livro concluído',
      description: 'Concluiu sua primeira obra completa na LIVROFLIX.',
      unlocked: completedBooksCount >= 1,
      progressText: `${Math.min(1, completedBooksCount)}/1 livro`,
      currentValue: Math.min(1, completedBooksCount),
      targetValue: 1,
      isInitial: true,
      hasBadge: false,
    },
    {
      id: 'five-books',
      icon: '📚',
      title: '5 livros lidos',
      description: 'Construiu o hábito literário completando cinco obras.',
      unlocked: completedBooksCount >= 5,
      progressText: `${Math.min(5, completedBooksCount)}/5 livros`,
      currentValue: Math.min(5, completedBooksCount),
      targetValue: 5,
      isInitial: true,
      hasBadge: false,
    },
    {
      id: 'seven-days',
      icon: '🔥',
      title: '7 dias seguidos lendo',
      description: 'Manteve uma sequência diária de imersão na leitura.',
      unlocked: streakDays >= 7,
      progressText: `${Math.min(7, streakDays)}/7 dias`,
      currentValue: Math.min(7, streakDays),
      targetValue: 7,
      isInitial: true,
      hasBadge: false,
    },
    {
      id: 'ten-books',
      icon: '🌟',
      title: '10 livros concluídos',
      description: 'Mestre leitor com dez grandes histórias finalizadas.',
      unlocked: completedBooksCount >= 10,
      progressText: `${Math.min(10, completedBooksCount)}/10 livros`,
      currentValue: Math.min(10, completedBooksCount),
      targetValue: 10,
      isInitial: true,
      hasBadge: false,
    },

    // Outras missões literárias (exibidas ao clicar em "Ver mais", com selos de recompensa)
    {
      id: 'ach_primeiras_paginas',
      icon: '📖',
      title: 'Primeiras Páginas',
      description: 'Leia 5 livros.',
      unlocked:
        completedBooksCount >= 5 ||
        previouslyUnlocked.has('primeiras_paginas'),
      progressText: `${Math.min(5, completedBooksCount)}/5 livros`,
      currentValue: Math.min(5, completedBooksCount),
      targetValue: 5,
      isInitial: false,
      hasBadge: true,
      badgeId: 'primeiras_paginas',
      rewardBadge: BADGE_DEFINITIONS.primeiras_paginas,
    },
    {
      id: 'ach_leitor_incansavel',
      icon: '⚡',
      title: 'Leitor Incansável',
      description: 'Leia 25 livros.',
      unlocked:
        completedBooksCount >= 25 ||
        previouslyUnlocked.has('leitor_incansavel'),
      progressText: `${Math.min(25, completedBooksCount)}/25 livros`,
      currentValue: Math.min(25, completedBooksCount),
      targetValue: 25,
      isInitial: false,
      hasBadge: true,
      badgeId: 'leitor_incansavel',
      rewardBadge: BADGE_DEFINITIONS.leitor_incansavel,
    },
    {
      id: 'ach_leitor_monstruoso',
      icon: '🐉',
      title: 'Leitor Monstruoso',
      description: 'Leia 50 livros.',
      unlocked:
        completedBooksCount >= 50 ||
        previouslyUnlocked.has('leitor_monstruoso'),
      progressText: `${Math.min(50, completedBooksCount)}/50 livros`,
      currentValue: Math.min(50, completedBooksCount),
      targetValue: 50,
      isInitial: false,
      hasBadge: true,
      badgeId: 'leitor_monstruoso',
      rewardBadge: BADGE_DEFINITIONS.leitor_monstruoso,
    },
    {
      id: 'ach_biblioteca_ambulante',
      icon: '🏛️',
      title: 'Biblioteca Ambulante',
      description: 'Leia 100 livros.',
      unlocked:
        completedBooksCount >= 100 ||
        previouslyUnlocked.has('biblioteca_ambulante'),
      progressText: `${Math.min(100, completedBooksCount)}/100 livros`,
      currentValue: Math.min(100, completedBooksCount),
      targetValue: 100,
      isInitial: false,
      hasBadge: true,
      badgeId: 'biblioteca_ambulante',
      rewardBadge: BADGE_DEFINITIONS.biblioteca_ambulante,
    },
    {
      id: 'ach_mestre_da_leitura',
      icon: '👑',
      title: 'Mestre da Leitura',
      description: 'Leia 150 livros.',
      unlocked:
        completedBooksCount >= 150 ||
        previouslyUnlocked.has('mestre_da_leitura'),
      progressText: `${Math.min(150, completedBooksCount)}/150 livros`,
      currentValue: Math.min(150, completedBooksCount),
      targetValue: 150,
      isInitial: false,
      hasBadge: true,
      badgeId: 'mestre_da_leitura',
      rewardBadge: BADGE_DEFINITIONS.mestre_da_leitura,
    },
    {
      id: 'ach_leitor_noturno',
      icon: '🌙',
      title: 'Leitor Noturno',
      description: 'Complete 10 leituras durante o período noturno.',
      unlocked:
        nightReadingsCount >= 10 || previouslyUnlocked.has('leitor_noturno'),
      progressText: `${Math.min(10, nightReadingsCount)}/10 leituras`,
      currentValue: Math.min(10, nightReadingsCount),
      targetValue: 10,
      isInitial: false,
      hasBadge: true,
      badgeId: 'leitor_noturno',
      rewardBadge: BADGE_DEFINITIONS.leitor_noturno,
    },
    {
      id: 'ach_explorador_literario',
      icon: '🧭',
      title: 'Explorador Literário',
      description: 'Leia livros de pelo menos 5 gêneros diferentes.',
      unlocked:
        completedGenresCount >= 5 ||
        previouslyUnlocked.has('explorador_literario'),
      progressText: `${Math.min(5, completedGenresCount)}/5 gêneros`,
      currentValue: Math.min(5, completedGenresCount),
      targetValue: 5,
      isInitial: false,
      hasBadge: true,
      badgeId: 'explorador_literario',
      rewardBadge: BADGE_DEFINITIONS.explorador_literario,
    },
    {
      id: 'ach_colecionador',
      icon: '📚',
      title: 'Colecionador',
      description: 'Adicione 25 livros à Minha Lista.',
      unlocked:
        myListCount >= 25 || previouslyUnlocked.has('colecionador'),
      progressText: `${Math.min(25, myListCount)}/25 na lista`,
      currentValue: Math.min(25, myListCount),
      targetValue: 25,
      isInitial: false,
      hasBadge: true,
      badgeId: 'colecionador',
      rewardBadge: BADGE_DEFINITIONS.colecionador,
    },
    {
      id: 'ach_maratonista',
      icon: '⏱️',
      title: 'Maratonista',
      description: 'Conclua 5 livros em um período curto de tempo.',
      unlocked:
        maxBooksInShortPeriod >= 5 || previouslyUnlocked.has('maratonista'),
      progressText: `${Math.min(5, maxBooksInShortPeriod)}/5 livros`,
      currentValue: Math.min(5, maxBooksInShortPeriod),
      targetValue: 5,
      isInitial: false,
      hasBadge: true,
      badgeId: 'maratonista',
      rewardBadge: BADGE_DEFINITIONS.maratonista,
    },
    {
      id: 'ach_apaixonado_por_livros',
      icon: '❤️',
      title: 'Apaixonado por Livros',
      description: 'Favorite 20 livros.',
      unlocked:
        favoritesCount >= 20 ||
        previouslyUnlocked.has('apaixonado_por_livros'),
      progressText: `${Math.min(20, favoritesCount)}/20 favoritos`,
      currentValue: Math.min(20, favoritesCount),
      targetValue: 20,
      isInitial: false,
      hasBadge: true,
      badgeId: 'apaixonado_por_livros',
      rewardBadge: BADGE_DEFINITIONS.apaixonado_por_livros,
    },
  ];

  const computedUnlockedBadgeIds: BadgeId[] = [];
  for (const ach of achievements) {
    if (ach.unlocked && ach.hasBadge && ach.badgeId) {
      computedUnlockedBadgeIds.push(ach.badgeId);
    }
  }

  return {
    achievements,
    computedUnlockedBadgeIds,
  };
}

/**
 * Renders the real badge image asset for a given BadgeId.
 * Automatically supports custom uploaded asset URLs (e.g. PNGs in platformSettings.badgeImages),
 * project files in /badges/{id}.png, /selos/{id}.png, or /badges/{id}.svg.
 */
export const BadgeImage: React.FC<{
  badgeId: BadgeId;
  customBadgeImages?: Record<string, string>;
  locked?: boolean;
  className?: string;
}> = ({
  badgeId,
  customBadgeImages,
  locked = false,
  className = 'w-10 h-10',
}) => {
  const def = BADGE_DEFINITIONS[badgeId];
  const customUrl = customBadgeImages?.[badgeId];

  const candidateUrls = React.useMemo(() => {
    const list: string[] = [];
    if (customUrl && customUrl.trim()) {
      list.push(customUrl.trim());
    }
    list.push(`/badges/${badgeId}.svg`);
    list.push(`/badges/${badgeId}.png`);
    list.push(`/selos/${badgeId}.png`);
    list.push(`/selos/${badgeId}.svg`);
    return list;
  }, [badgeId, customUrl]);

  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
  }, [badgeId, customUrl]);

  if (!def) return null;

  const activeSrc = candidateUrls[urlIndex] || def.defaultImageUrl;

  return React.createElement('img', {
    src: activeSrc,
    alt: `Selo ${def.name}`,
    referrerPolicy: 'no-referrer',
    onError: () => {
      if (urlIndex + 1 < candidateUrls.length) {
        setUrlIndex((prev) => prev + 1);
      }
    },
    className: `object-contain select-none transition-all duration-300 ${
      locked
        ? 'grayscale brightness-50 opacity-50'
        : 'drop-shadow-[0_4px_10px_rgba(37,99,235,0.35)]'
    } ${className}`,
  });
};
