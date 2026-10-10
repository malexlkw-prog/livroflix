import {
  Book,
  ProfileCustomization,
  PublicProfile,
  UserProfile,
} from '../types';

export const PREMIUM_PRICE_DISPLAY = 'R$ 11,00 / mês';
export const PREMIUM_PRICE_SHORT = 'R$ 11/mês';

export const FREE_MAX_PROFILE_FAVORITES = 3;
export const PREMIUM_MAX_PROFILE_FAVORITES = 5;

export interface UsernameColorPreset {
  id: string;
  label: string;
  color: string;
}

export const USERNAME_COLOR_PRESETS: UsernameColorPreset[] = [
  { id: 'default', label: 'Padrão (Branco)', color: '#FFFFFF' },
  { id: 'royal-gold', label: 'Dourado Real', color: '#FBBF24' },
  { id: 'celestial-blue', label: 'Azul Celeste', color: '#60A5FA' },
  { id: 'emerald-ink', label: 'Esmeralda Literário', color: '#34D399' },
  { id: 'ruby-rose', label: 'Rosa Rubi', color: '#FB7185' },
  { id: 'imperial-violet', label: 'Lavanda Real', color: '#C084FC' },
  { id: 'classic-amber', label: 'Âmbar Clássico', color: '#FB923C' },
  { id: 'ocean-turquoise', label: 'Turquesa Oceano', color: '#2DD4BF' },
  { id: 'crimson-velvet', label: 'Carmesim Imperial', color: '#F43F5E' },
  { id: 'lunar-silver', label: 'Prata Lunar', color: '#E2E8F0' },
];

export const PREMIUM_SOLID_BG_IDS = new Set<string>([
  'velvet-crimson',
  'imperial-gold-dark',
  'midnight-amethyst',
  'abyssal-teal',
]);

export const PREMIUM_GRADIENT_BG_IDS = new Set<string>([
  'midnight-blue',
  'ocean-depth',
  'ancient-library',
  'mystic-forest',
  'fantasy-twilight',
  'vintage-sepia',
  'starry-cosmos',
  'minimal-slate',
  'royal-gold-velvet',
  'aurora-literaria',
  'crimson-manuscript',
  'celestial-palace',
]);

export const PREMIUM_THEMATIC_BG_IDS = new Set<string>([
  'bg-palace-library',
  'bg-astronomy-tower',
  'bg-candlelight-study',
  'bg-velvet-archive',
]);

export const PREMIUM_BANNER_IDS = new Set<string>([
  'banner-royal-archive',
  'banner-golden-hour',
  'banner-astral-dome',
  'banner-velvet-sanctuary',
  'banner-illuminated-codex',
  'banner-gothic-cathedral',
]);

export const PREMIUM_EFFECT_IDS = new Set<string>([
  'starlight-particles',
  'paper-texture',
  'geometric-grid',
  'warm-sepia-mist',
  'golden-aura',
  'royal-constellation',
]);

export const PREMIUM_THEME_IDS = new Set<string>([
  'colecionador-real',
  'salao-imperial',
  'observatorio-astral',
  'manuscrito-iluminado',
]);

/**
 * Verificação centralizada de assinatura LIVROFLIX Premium.
 */
export function isUserPremium(
  user?: Pick<UserProfile | PublicProfile, 'premium'> | null
): boolean {
  return Boolean(user && user.premium === true);
}

/**
 * Retorna o limite público de livros favoritos no perfil (5 para Premium, 3 para gratuito).
 */
export function getMaxProfileFavoriteBooks(
  user?: Pick<UserProfile | PublicProfile, 'premium'> | null
): number {
  return isUserPremium(user)
    ? PREMIUM_MAX_PROFILE_FAVORITES
    : FREE_MAX_PROFILE_FAVORITES;
}

/**
 * Valida se uma string é uma cor hexadecimal segura (#RRGGBB).
 */
export function isValidHexColor(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

/**
 * Retorna a cor personalizada do @username.
 */
export function getEffectiveUsernameColor(
  user?:
    | (Pick<UserProfile | PublicProfile, 'premium' | 'usernameColor'> & {
        profileCustomization?: ProfileCustomization;
      })
    | null
): string | undefined {
  const candidate =
    user?.usernameColor || user?.profileCustomization?.usernameColor;
  if (!candidate || !isValidHexColor(candidate)) return undefined;
  if (candidate.toUpperCase() === '#FFFFFF') return undefined;
  return candidate.trim();
}

/**
 * Retorna a personalização do perfil do usuário.
 */
export function getEffectiveProfileCustomization(
  _user?: Pick<UserProfile | PublicProfile, 'premium'> | null,
  customization?: ProfileCustomization
): ProfileCustomization | undefined {
  if (!customization) return undefined;
  return customization;
}

/**
 * Verifica se o livro possui arquivo PDF válido e permissão/licenciamento para download.
 */
export function canBookBeDownloaded(book?: Book | null): boolean {
  if (!book || book.status !== 'ativo') return false;
  if (book.allowDownload === false) return false;
  const pdfUrl = (book.readingOptions?.pdf?.url || book.pdfUrl || '').trim();
  return pdfUrl.length > 0;
}

/**
 * Verifica se o usuário tem permissão para baixar o livro (exige Premium + livro disponível para download).
 */
export function canUserDownloadBook(
  user?: Pick<UserProfile, 'premium'> | null,
  book?: Book | null
): boolean {
  return isUserPremium(user) && canBookBeDownloaded(book);
}
