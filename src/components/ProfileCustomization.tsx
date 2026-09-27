import React, { useState, useRef } from 'react';
import {
  X,
  Check,
  Image as ImageIcon,
  Palette,
  Layout,
  Upload,
  RotateCcw,
  Loader2,
  Trash2,
  Crown,
  Lock,
} from 'lucide-react';
import {
  ProfileBackgroundConfig,
  ProfileBannerConfig,
  ProfileCustomization,
  ProfileEffectId,
  UserProfile,
} from '../types';
import {
  isUserPremium,
  isValidHexColor,
  USERNAME_COLOR_PRESETS,
} from '../utils/premiumUtils';

export const DEFAULT_PROFILE_CUSTOMIZATION: ProfileCustomization = {
  background: {
    type: 'default',
    value: '#040D1A',
    presetId: 'default',
  },
  banner: {
    type: 'none',
    value: '',
    presetId: 'none',
    positionY: 50,
  },
  effects: 'none',
  theme: 'default',
};

export interface SolidColorPreset {
  id: string;
  label: string;
  color: string;
  isPremium?: boolean;
}

export const SOLID_BACKGROUND_PRESETS: SolidColorPreset[] = [
  { id: 'default', label: 'Azul LIVROFLIX (Padrão)', color: '#040D1A' },
  { id: 'obsidian', label: 'Obsidiana Noturna', color: '#08090E' },
  { id: 'slate-dark', label: 'Grafite Editorial', color: '#0E131B' },
  { id: 'library-green', label: 'Verde Biblioteca', color: '#071512' },
  { id: 'espresso', label: 'Café Expresso', color: '#130D0A' },
  { id: 'burgundy', label: 'Borgonha Clássico', color: '#17090F' },
  { id: 'royal-indigo', label: 'Índigo Estelar', color: '#090C22' },
  { id: 'parchment-dark', label: 'Papiro Escuro', color: '#16120D' },
  {
    id: 'velvet-crimson',
    label: 'Veludo Carmesim',
    color: '#1F0812',
    isPremium: true,
  },
  {
    id: 'imperial-gold-dark',
    label: 'Ébano & Ouro Real',
    color: '#181206',
    isPremium: true,
  },
  {
    id: 'midnight-amethyst',
    label: 'Ametista da Meia-Noite',
    color: '#140924',
    isPremium: true,
  },
  {
    id: 'abyssal-teal',
    label: 'Azul Abissal Real',
    color: '#041920',
    isPremium: true,
  },
];

export interface GradientPreset {
  id: string;
  label: string;
  css: string;
  isPremium?: boolean;
}

export const GRADIENT_BACKGROUND_PRESETS: GradientPreset[] = [
  {
    id: 'midnight-blue',
    label: 'Meia-Noite Literária',
    css: 'linear-gradient(135deg, #040D1A 0%, #0A1E3C 50%, #030914 100%)',
    isPremium: true,
  },
  {
    id: 'ocean-depth',
    label: 'Abismo do Oceano',
    css: 'linear-gradient(135deg, #03111E 0%, #072A40 50%, #041523 100%)',
    isPremium: true,
  },
  {
    id: 'ancient-library',
    label: 'Biblioteca Antiga',
    css: 'linear-gradient(135deg, #120C08 0%, #1E140E 55%, #0A0806 100%)',
    isPremium: true,
  },
  {
    id: 'mystic-forest',
    label: 'Floresta Silenciosa',
    css: 'linear-gradient(135deg, #05130F 0%, #0C261E 50%, #040E0B 100%)',
    isPremium: true,
  },
  {
    id: 'fantasy-twilight',
    label: 'Crepúsculo de Fantasia',
    css: 'linear-gradient(135deg, #0D081D 0%, #1D1138 50%, #080716 100%)',
    isPremium: true,
  },
  {
    id: 'vintage-sepia',
    label: 'Papel Antigo & Âmbar',
    css: 'linear-gradient(135deg, #17120C 0%, #261D13 50%, #0E0B08 100%)',
    isPremium: true,
  },
  {
    id: 'royal-gold-velvet',
    label: 'Ouro Imperial & Obsidiana',
    css: 'linear-gradient(135deg, #1A1305 0%, #2B1E08 50%, #090703 100%)',
    isPremium: true,
  },
  {
    id: 'crimson-manuscript',
    label: 'Manuscrito Carmesim',
    css: 'linear-gradient(135deg, #1D0710 0%, #310C1B 50%, #0C0407 100%)',
    isPremium: true,
  },
];

export interface ImagePreset {
  id: string;
  label: string;
  subtitle: string;
  url: string;
  isPremium?: boolean;
}

export const THEMATIC_BACKGROUND_PRESETS: ImagePreset[] = [
  {
    id: 'bg-library',
    label: 'Biblioteca Clássica',
    subtitle: 'Estantes de madeira e luz acolhedora',
    url: 'https://images.unsplash.com/photo-1507842229356-51c61504d3ab?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'bg-night',
    label: 'Noite Silenciosa',
    subtitle: 'Atmosfera noturna calma e profunda',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'bg-ocean',
    label: 'Oceano Profundo',
    subtitle: 'Ondas serenas ao entardecer',
    url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'bg-vintage',
    label: 'Escritório Vintage',
    subtitle: 'Livros encadernados e estética clássica',
    url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'bg-fantasy',
    label: 'Horizonte de Fantasia',
    subtitle: 'Montanhas nebulosas e luz etérea',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'bg-old-paper',
    label: 'Páginas & Manuscritos',
    subtitle: 'Textura literária de livros abertos',
    url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'bg-forest',
    label: 'Floresta de Neblina',
    subtitle: 'Pinheiros sob a bruma da manhã',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'bg-starry-sky',
    label: 'Céu Estrelado',
    subtitle: 'Constelações e via láctea',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'bg-palace-library',
    label: 'Salão Real de Leitura',
    subtitle: 'Arquitetura palaciana e galerias históricas',
    url: 'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=1600&q=80',
    isPremium: true,
  },
  {
    id: 'bg-astronomy-tower',
    label: 'Observatório Astral',
    subtitle: 'Cúpula celeste e mapas estelares',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80',
    isPremium: true,
  },
  {
    id: 'bg-candlelight-study',
    label: 'Gabinete à Luz de Velas',
    subtitle: 'Obras raras e atmosfera intimista dourada',
    url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1600&q=80',
    isPremium: true,
  },
  {
    id: 'bg-velvet-archive',
    label: 'Arquivo Secreto',
    subtitle: 'Corredores profundos de coleção literária',
    url: 'https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=1600&q=80',
    isPremium: true,
  },
];

export const BANNER_PRESETS: ImagePreset[] = [
  {
    id: 'banner-library',
    label: 'Salão de Leitura',
    subtitle: 'Prateleiras clássicas de biblioteca',
    url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'banner-night',
    label: 'Noite sob as Montanhas',
    subtitle: 'Céu azul-escuro com horizonte sereno',
    url: 'https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'banner-ocean',
    label: 'Maré Azul',
    subtitle: 'Águas calmas em tom azul profundo',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'banner-vintage',
    label: 'Coleção Rara',
    subtitle: 'Obras antigas e iluminação quente',
    url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'banner-fantasy',
    label: 'Vale Encantado',
    subtitle: 'Paisagem épica de fantasia',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'banner-paper',
    label: 'Páginas Abertas',
    subtitle: 'Foco artístico em folhas de livro',
    url: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'banner-minimal',
    label: 'Arquitetura Minimalista',
    subtitle: 'Geometria limpa em tons escuros',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'banner-forest',
    label: 'Bosque de Outono & Bruma',
    subtitle: 'Natureza silenciosa para leitura',
    url: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'banner-stars',
    label: 'Nebulosa & Estrelas',
    subtitle: 'Imensidão cósmico noturna',
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'banner-royal-archive',
    label: 'Galeria Imperial',
    subtitle: 'Abóbadas clássicas e acervo real',
    url: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=1400&q=80',
    isPremium: true,
  },
  {
    id: 'banner-golden-hour',
    label: 'Luz Dourada Editorial',
    subtitle: 'Sol poente sobre páginas abertas',
    url: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=1400&q=80',
    isPremium: true,
  },
  {
    id: 'banner-astral-dome',
    label: 'Horizonte Astral',
    subtitle: 'Constelações douradas no firmamento',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1400&q=80',
    isPremium: true,
  },
  {
    id: 'banner-velvet-sanctuary',
    label: 'Refúgio de Veludo',
    subtitle: 'Estética noturna para colecionadores',
    url: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1400&q=80',
    isPremium: true,
  },
  {
    id: 'banner-illuminated-codex',
    label: 'Códice Iluminado',
    subtitle: 'Encadernações clássicas em couro e ouro',
    url: 'https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=1400&q=80',
    isPremium: true,
  },
  {
    id: 'banner-gothic-cathedral',
    label: 'Arcos Literários',
    subtitle: 'Arquitetura monumental e vitrais',
    url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1400&q=80',
    isPremium: true,
  },
];

export interface DecorativeEffectPreset {
  id: ProfileEffectId;
  label: string;
  description: string;
  isPremium?: boolean;
}

export const DECORATIVE_EFFECT_PRESETS: DecorativeEffectPreset[] = [
  {
    id: 'none',
    label: 'Sem efeito',
    description: 'Visual limpo padrão da plataforma.',
  },
  {
    id: 'subtle-glow',
    label: 'Brilho Sutil',
    description: 'Luz atmosférica suave no topo e contornos do perfil.',
  },
  {
    id: 'literary-vignette',
    label: 'Vinheta Literária',
    description: 'Sombreado periférico elegante que destaca o centro do perfil.',
  },
  {
    id: 'starlight-particles',
    label: 'Poeira Estelar Discreta',
    description: 'Pontos luminosos delicados e discretos ao fundo.',
    isPremium: true,
  },
  {
    id: 'paper-texture',
    label: 'Textura Editorial',
    description: 'Granulação fina inspirada em papel de livro clássico.',
    isPremium: true,
  },
  {
    id: 'geometric-grid',
    label: 'Trama Arquitetônica',
    description: 'Malha geométrica sutil de linhas finas.',
    isPremium: true,
  },
  {
    id: 'warm-sepia-mist',
    label: 'Bruma de Leitura',
    description: 'Reflexo âmbar acolhedor de lâmpada de leitura.',
    isPremium: true,
  },
  {
    id: 'golden-aura',
    label: 'Aura Dourada Real',
    description: 'Resplendor dourado premium nas bordas superiores do perfil.',
    isPremium: true,
  },
  {
    id: 'royal-constellation',
    label: 'Constelação Literária',
    description: 'Brilho estelar profundo com linhas celestes discretas.',
    isPremium: true,
  },
];

export interface ReadyThemePreset {
  id: string;
  label: string;
  description: string;
  previewColor: string;
  background: ProfileBackgroundConfig;
  banner: ProfileBannerConfig;
  effects: ProfileEffectId;
  isPremium?: boolean;
}

export const READY_VISUAL_THEMES: ReadyThemePreset[] = [
  {
    id: 'biblioteca',
    label: 'Biblioteca',
    description: 'Estantes clássicas, tons de madeira escura e vinheta literária.',
    previewColor: '#130D0A',
    background: {
      type: 'solid',
      value: '#130D0A',
      presetId: 'espresso',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-library',
      positionY: 50,
    },
    effects: 'literary-vignette',
  },
  {
    id: 'noite',
    label: 'Noite',
    description: 'Azul profundo da meia-noite com horizonte noturno e brilho sutil.',
    previewColor: '#040D1A',
    background: {
      type: 'default',
      value: '#040D1A',
      presetId: 'default',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-night',
      positionY: 50,
    },
    effects: 'subtle-glow',
  },
  {
    id: 'oceano',
    label: 'Oceano',
    description: 'Tons marinhos profundos, capa de mar sereno e luz suave.',
    previewColor: '#040D1A',
    background: {
      type: 'default',
      value: '#040D1A',
      presetId: 'default',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-ocean',
      positionY: 55,
    },
    effects: 'subtle-glow',
  },
  {
    id: 'vintage',
    label: 'Vintage',
    description: 'Café expresso, obras raras encadernadas e bruma âmbar de leitura.',
    previewColor: '#130D0A',
    background: {
      type: 'solid',
      value: '#130D0A',
      presetId: 'espresso',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-vintage',
      positionY: 50,
    },
    effects: 'warm-sepia-mist',
  },
  {
    id: 'fantasia',
    label: 'Fantasia',
    description: 'Crepúsculo místico, paisagem épica e poeira estelar discreta.',
    previewColor: '#090C22',
    background: {
      type: 'solid',
      value: '#090C22',
      presetId: 'royal-indigo',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-fantasy',
      positionY: 45,
    },
    effects: 'starlight-particles',
  },
  {
    id: 'papel-antigo',
    label: 'Papel Antigo',
    description: 'Papiro escuro, páginas abertas e textura editorial sutil.',
    previewColor: '#16120D',
    background: {
      type: 'solid',
      value: '#16120D',
      presetId: 'parchment-dark',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-paper',
      positionY: 50,
    },
    effects: 'paper-texture',
  },
  {
    id: 'minimalista',
    label: 'Minimalista',
    description: 'Grafite contemporâneo com trama arquitetônica discreta.',
    previewColor: '#0E131B',
    background: {
      type: 'solid',
      value: '#0E131B',
      presetId: 'slate-dark',
    },
    banner: {
      type: 'none',
      value: '',
      presetId: 'none',
      positionY: 50,
    },
    effects: 'geometric-grid',
  },
  {
    id: 'floresta',
    label: 'Floresta',
    description: 'Verde profundo de bosque silencioso com bruma natural.',
    previewColor: '#071512',
    background: {
      type: 'solid',
      value: '#071512',
      presetId: 'library-green',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-forest',
      positionY: 50,
    },
    effects: 'literary-vignette',
  },
  {
    id: 'ceu-estrelado',
    label: 'Céu Estrelado',
    description: 'Índigo cósmico, nebulosa noturna e poeira estelar.',
    previewColor: '#090C22',
    background: {
      type: 'solid',
      value: '#090C22',
      presetId: 'royal-indigo',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-stars',
      positionY: 50,
    },
    effects: 'literary-vignette',
  },
  {
    id: 'colecionador-real',
    label: 'Edição de Colecionador',
    description: 'Ouro imperial, galeria palaciana e aura dourada exclusiva.',
    previewColor: '#181206',
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #1A1305 0%, #2B1E08 50%, #090703 100%)',
      presetId: 'royal-gold-velvet',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-royal-archive',
      positionY: 50,
    },
    effects: 'golden-aura',
    isPremium: true,
  },
  {
    id: 'salao-imperial',
    label: 'Salão Imperial',
    description: 'Veludo carmesim profundo com iluminação clássica.',
    previewColor: '#1F0812',
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #1D0710 0%, #310C1B 50%, #0C0407 100%)',
      presetId: 'crimson-manuscript',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-velvet-sanctuary',
      positionY: 50,
    },
    effects: 'warm-sepia-mist',
    isPremium: true,
  },
  {
    id: 'observatorio-astral',
    label: 'Observatório Astral',
    description: 'Ametista da meia-noite, cúpula celeste e constelação literária.',
    previewColor: '#140924',
    background: {
      type: 'solid',
      value: '#140924',
      presetId: 'midnight-amethyst',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-astral-dome',
      positionY: 50,
    },
    effects: 'royal-constellation',
    isPremium: true,
  },
  {
    id: 'manuscrito-iluminado',
    label: 'Manuscrito Iluminado',
    description: 'Papiro antigo, luz dourada editorial e textura literária.',
    previewColor: '#17120C',
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #17120C 0%, #261D13 50%, #0E0B08 100%)',
      presetId: 'vintage-sepia',
    },
    banner: {
      type: 'preset',
      value: 'https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=1400&q=80',
      presetId: 'banner-illuminated-codex',
      positionY: 50,
    },
    effects: 'paper-texture',
    isPremium: true,
  },
];

/**
 * Compresses an uploaded image (for custom background or banner) into an optimized DataURL
 * so it stays fast and well within Firestore document size limits.
 */
export async function compressCustomizationImageToDataUrl(
  file: File,
  maxWidth = 1280,
  maxHeight = 720
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('A imagem deve ter no máximo 12 MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem selecionada.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Computes inline style for a profile container based on ProfileCustomization.
 */
export function getProfileBackgroundStyle(
  customization?: ProfileCustomization
): React.CSSProperties {
  const bg = customization?.background;
  if (!bg || bg.type === 'default' || !bg.value) {
    return { backgroundColor: '#040D1A' };
  }
  if (bg.type === 'solid') {
    return { backgroundColor: bg.value };
  }
  if (bg.type === 'gradient') {
    return { backgroundImage: bg.value, backgroundColor: '#040D1A' };
  }
  if (bg.type === 'preset-image' || bg.type === 'custom-image') {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(4, 13, 26, 0.76) 0%, rgba(4, 13, 26, 0.88) 100%), url("${bg.value}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundAttachment: 'fixed',
      backgroundColor: '#040D1A',
    };
  }
  return { backgroundColor: '#040D1A' };
}

/**
 * Renders subtle, optional decorative effects over the profile background
 * without interfering with text legibility or click interactions.
 */
export const ProfileDecorativeEffectLayer: React.FC<{
  effect?: ProfileEffectId;
}> = ({ effect }) => {
  if (!effect || effect === 'none') return null;

  if (effect === 'subtle-glow') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[520px] rounded-full bg-blue-500/12 blur-3xl" />
      </div>
    );
  }

  if (effect === 'literary-vignette') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at center, transparent 45%, rgba(2, 6, 23, 0.65) 100%)',
        }}
        aria-hidden="true"
      />
    );
  }

  if (effect === 'starlight-particles') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(1.5px 1.5px at 20% 30%, rgba(147,197,253,0.8), transparent), radial-gradient(1px 1px at 75% 20%, rgba(255,255,255,0.7), transparent), radial-gradient(1.5px 1.5px at 45% 70%, rgba(96,165,250,0.6), transparent), radial-gradient(1px 1px at 85% 65%, rgba(251,191,36,0.6), transparent)',
          backgroundSize: '240px 240px',
        }}
        aria-hidden="true"
      />
    );
  }

  if (effect === 'paper-texture') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,248,231,0.03) 0px, rgba(255,248,231,0.03) 1px, transparent 1px, transparent 3px)',
        }}
        aria-hidden="true"
      />
    );
  }

  if (effect === 'geometric-grid') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(96,165,250,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(96,165,250,0.18) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />
    );
  }

  if (effect === 'warm-sepia-mist') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-20 right-1/4 h-72 w-96 rounded-full bg-amber-500/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-64 w-80 rounded-full bg-orange-500/10 blur-3xl" />
      </div>
    );
  }

  if (effect === 'golden-aura') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-28 left-1/2 -translate-x-1/2 h-72 w-[600px] rounded-full bg-amber-400/18 blur-3xl" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, rgba(251,191,36,0.14) 0%, transparent 60%)',
          }}
        />
      </div>
    );
  }

  if (effect === 'royal-constellation') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(2px 2px at 15% 25%, rgba(251,191,36,0.85), transparent), radial-gradient(1.5px 1.5px at 65% 15%, rgba(192,132,252,0.8), transparent), radial-gradient(2px 2px at 82% 55%, rgba(251,191,36,0.75), transparent), radial-gradient(1.5px 1.5px at 35% 80%, rgba(147,197,253,0.75), transparent)',
          backgroundSize: '200px 200px',
        }}
        aria-hidden="true"
      />
    );
  }

  return null;
};

/**
 * Renders the integrated banner/cover filling the entire background of the Profile Header Card
 * (where @username, bio, and publicações/seguidores/seguindo are located).
 */
export const ProfileIntegratedBanner: React.FC<{
  banner?: ProfileBannerConfig;
  heightClassName?: string;
}> = ({ banner }) => {
  if (!banner || banner.type === 'none' || !banner.value) return null;
  const posY = typeof banner.positionY === 'number' ? banner.positionY : 50;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl"
      aria-hidden="true"
    >
      <img
        src={banner.value}
        alt="Capa do perfil"
        className="w-full h-full object-cover transition-all duration-300"
        style={{ objectPosition: `50% ${posY}%` }}
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#040D1A]/80 via-[#071426]/65 to-[#040D1A]/80" />
    </div>
  );
};

interface ProfileCustomizationModalProps {
  isOpen: boolean;
  userProfile: UserProfile;
  draft: ProfileCustomization;
  onChangeDraft: (next: ProfileCustomization) => void;
  onSave: (finalCustomization: ProfileCustomization) => Promise<void>;
  onCancel: () => void;
  onOpenPremiumModal?: () => void;
  mode?: 'modal' | 'inline';
}

type CustomizerTab = 'fundo' | 'banner' | 'temas';

export const ProfileCustomizationModal: React.FC<
  ProfileCustomizationModalProps
> = ({
  isOpen,
  userProfile,
  draft,
  onChangeDraft,
  onSave,
  onCancel,
  onOpenPremiumModal,
  mode = 'modal',
}) => {
  const [activeTab, setActiveTab] = useState<CustomizerTab>('temas');
  const [isProcessingBgImage, setIsProcessingBgImage] = useState(false);
  const [isProcessingBannerImage, setIsProcessingBannerImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const isPremium = isUserPremium(userProfile);
  const currentBg = draft.background || DEFAULT_PROFILE_CUSTOMIZATION.background!;
  const currentBanner = draft.banner || DEFAULT_PROFILE_CUSTOMIZATION.banner!;
  const currentTheme = draft.theme || 'default';
  const currentUsernameColor =
    draft.usernameColor || userProfile.usernameColor || '#FFFFFF';

  const displayUsername = (userProfile.username || 'leitor').replace(/^@+/, '');
  const displayPhoto = userProfile.photoURL ?? userProfile.foto ?? '';

  const requirePremiumOrRun = (
    needsPremium: boolean | undefined,
    action: () => void
  ) => {
    if (needsPremium && !isPremium) {
      if (onOpenPremiumModal) {
        onOpenPremiumModal();
      } else {
        setErrorMsg(
          'Este recurso é exclusivo para assinantes do LIVROFLIX Premium (R$ 11,00/mês).'
        );
      }
      return;
    }
    action();
  };

  const handleSelectUsernameColor = (color: string) => {
    requirePremiumOrRun(color.toUpperCase() !== '#FFFFFF', () => {
      setErrorMsg(null);
      if (!isValidHexColor(color)) return;
      onChangeDraft({
        ...draft,
        usernameColor: color.toUpperCase() === '#FFFFFF' ? '' : color,
      });
    });
  };

  const handleSelectSolidColor = (preset: SolidColorPreset) => {
    requirePremiumOrRun(preset.isPremium, () => {
      setErrorMsg(null);
      onChangeDraft({
        ...draft,
        theme: 'custom',
        background: {
          type: preset.id === 'default' ? 'default' : 'solid',
          value: preset.color,
          presetId: preset.id,
        },
      });
    });
  };

  const handleSelectGradient = (preset: GradientPreset) => {
    requirePremiumOrRun(preset.isPremium, () => {
      setErrorMsg(null);
      onChangeDraft({
        ...draft,
        theme: 'custom',
        background: {
          type: 'gradient',
          value: preset.css,
          presetId: preset.id,
        },
      });
    });
  };

  const handleSelectThematicBackground = (preset: ImagePreset) => {
    requirePremiumOrRun(preset.isPremium, () => {
      setErrorMsg(null);
      onChangeDraft({
        ...draft,
        theme: 'custom',
        background: {
          type: 'preset-image',
          value: preset.url,
          presetId: preset.id,
        },
      });
    });
  };

  const handleCustomBgFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsProcessingBgImage(true);
    try {
      const dataUrl = await compressCustomizationImageToDataUrl(file, 1280, 800);
      onChangeDraft({
        ...draft,
        theme: 'custom',
        background: {
          type: 'custom-image',
          value: dataUrl,
          presetId: 'custom',
        },
      });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível processar a imagem de fundo.'
      );
    } finally {
      setIsProcessingBgImage(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = '';
    }
  };

  const handleResetBackground = () => {
    setErrorMsg(null);
    onChangeDraft({
      ...draft,
      theme: 'custom',
      background: {
        type: 'default',
        value: '#040D1A',
        presetId: 'default',
      },
    });
  };

  const handleSelectPresetBanner = (preset: ImagePreset) => {
    requirePremiumOrRun(preset.isPremium, () => {
      setErrorMsg(null);
      onChangeDraft({
        ...draft,
        theme: 'custom',
        banner: {
          type: 'preset',
          value: preset.url,
          presetId: preset.id,
          positionY: currentBanner.positionY ?? 50,
        },
      });
    });
  };

  const handleCustomBannerFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setIsProcessingBannerImage(true);
    try {
      const dataUrl = await compressCustomizationImageToDataUrl(file, 1280, 480);
      onChangeDraft({
        ...draft,
        theme: 'custom',
        banner: {
          type: 'custom',
          value: dataUrl,
          presetId: 'custom',
          positionY: 50,
        },
      });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível processar a imagem da capa.'
      );
    } finally {
      setIsProcessingBannerImage(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
    }
  };

  const handleBannerPositionChange = (posY: number) => {
    onChangeDraft({
      ...draft,
      banner: {
        ...currentBanner,
        positionY: posY,
      },
    });
  };

  const handleRemoveBanner = () => {
    setErrorMsg(null);
    onChangeDraft({
      ...draft,
      theme: 'custom',
      banner: {
        type: 'none',
        value: '',
        presetId: 'none',
        positionY: 50,
      },
    });
  };

  const handleSelectReadyTheme = (themePreset: ReadyThemePreset) => {
    requirePremiumOrRun(themePreset.isPremium, () => {
      setErrorMsg(null);
      onChangeDraft({
        ...draft,
        theme: themePreset.id,
        background: { ...themePreset.background },
        banner: { ...themePreset.banner },
        effects: 'none',
      });
    });
  };

  const handleRestoreAllDefaults = () => {
    setErrorMsg(null);
    onChangeDraft({
      ...DEFAULT_PROFILE_CUSTOMIZATION,
      usernameColor: '',
    });
  };

  const handleSaveClick = async () => {
    setErrorMsg(null);
    setIsSaving(true);
    try {
      await onSave({
        ...draft,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar a personalização.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const isInline = mode === 'inline';

  const contentInner = (
    <div
      onClick={(e) => {
        if (!isInline) e.stopPropagation();
      }}
      className={
        isInline
          ? 'w-full rounded-2xl bg-[#071426] border border-blue-400/25 shadow-2xl overflow-hidden flex flex-col'
          : 'w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl bg-[#071426] border border-blue-400/30 shadow-[0_25px_70px_rgba(2,6,23,0.95)] overflow-hidden max-h-[92vh] flex flex-col'
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-blue-400/15 bg-[#040D1A]/70">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Personalizar perfil
          </h2>
          <p className="text-xs sm:text-sm text-blue-200/75 mt-0.5">
            Escolha um tema visual completo ou personalize o fundo e o banner do perfil
          </p>
        </div>
        {!isInline && (
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="rounded-full p-2 text-blue-200/70 hover:bg-blue-500/15 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Live Preview */}
      <div className="px-6 py-5 bg-[#040D1A]/40 border-b border-blue-400/15">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-200/80">
            Prévia do seu perfil
          </span>
        </div>

        <div
          className="relative rounded-2xl border border-blue-400/25 p-5 sm:p-7 overflow-hidden transition-all"
          style={getProfileBackgroundStyle(draft)}
        >
          <div className="relative z-10 rounded-2xl bg-[#071426]/90 border border-blue-400/25 overflow-hidden shadow-xl p-5 sm:p-6">
            <ProfileIntegratedBanner banner={currentBanner} />

            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              {displayPhoto ? (
                <img
                  src={displayPhoto}
                  alt={`@${displayUsername}`}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover ring-2 ring-[#60A5FA] shrink-0 shadow-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-full bg-[#040D1A] border-2 border-[#60A5FA]/60 text-[#60A5FA] font-display text-2xl sm:text-3xl font-bold shadow-lg">
                  {(displayUsername || 'L')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p
                  className="font-display text-xl sm:text-2xl font-bold text-white truncate"
                  style={
                    isPremium &&
                    currentUsernameColor &&
                    currentUsernameColor.toUpperCase() !== '#FFFFFF'
                      ? { color: currentUsernameColor }
                      : undefined
                  }
                >
                  @{displayUsername}
                </p>
                {userProfile.bio && (
                  <p className="mt-1 text-xs sm:text-sm text-blue-100/90 line-clamp-2 max-w-xl">
                    {userProfile.bio}
                  </p>
                )}
                <div className="mt-2.5 flex items-center justify-center sm:justify-start gap-4 text-xs text-blue-200/85">
                  <span>
                    <strong className="font-mono-num text-white">0</strong> publicações
                  </span>
                  <span>
                    <strong className="font-mono-num text-white">0</strong> seguidores
                  </span>
                  <span>
                    <strong className="font-mono-num text-white">0</strong> seguindo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs: Fundo | Banner | Temas */}
      <div className="flex items-center gap-2 px-6 pt-3 border-b border-blue-400/15 bg-[#071426] overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('fundo')}
          className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'fundo'
              ? 'border-[#60A5FA] text-[#60A5FA]'
              : 'border-transparent text-blue-200/75 hover:text-white'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Fundo & Cor do Nome</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('banner')}
          className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'banner'
              ? 'border-[#60A5FA] text-[#60A5FA]'
              : 'border-transparent text-blue-200/75 hover:text-white'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Banner</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('temas')}
          className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'temas'
              ? 'border-[#60A5FA] text-[#60A5FA]'
              : 'border-transparent text-blue-200/75 hover:text-white'
          }`}
        >
          <Layout className="w-4 h-4" />
          <span>Temas</span>
        </button>
      </div>

      {/* Tab Content */}
      <div
        className={
          isInline
            ? 'p-6 sm:p-8 space-y-6'
            : 'p-6 overflow-y-auto space-y-6 flex-1'
        }
      >
          {errorMsg && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-3.5 text-xs sm:text-sm text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* TAB 1: FUNDO & COR DO NOME */}
          {activeTab === 'fundo' && (
            <div className="space-y-6">
              {/* Cor personalizada do Nome de Usuário (@username) — Recurso Premium */}
              <div className="rounded-xl bg-[#040D1A]/80 border border-amber-400/25 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <h3 className="font-display text-lg font-bold text-white">
                      Cor do Nome de Usuário (@{displayUsername})
                    </h3>
                  </div>
                  {!isPremium && onOpenPremiumModal && (
                    <button
                      type="button"
                      onClick={onOpenPremiumModal}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 px-2.5 py-1 text-xs font-bold text-amber-300 transition-colors cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Liberar com Premium</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-blue-200/75">
                  Escolha uma cor para destacar seu @username no perfil e na comunidade:
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  {USERNAME_COLOR_PRESETS.map((preset) => {
                    const isSelected =
                      currentUsernameColor.toUpperCase() ===
                      preset.color.toUpperCase();
                    const locked = !isPremium && preset.id !== 'default';
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectUsernameColor(preset.color)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#60A5FA] bg-blue-500/15 text-white shadow-md'
                            : 'border-blue-400/20 bg-[#071426] hover:border-blue-400/40 text-blue-100'
                        }`}
                      >
                        <span
                          className="h-4 w-4 rounded-full border border-white/30 shrink-0"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span>{preset.label}</span>
                        {locked && (
                          <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}

                  {/* Seletor de cor livre */}
                  <label
                    onClick={(e) => {
                      if (!isPremium) {
                        e.preventDefault();
                        onOpenPremiumModal?.();
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold border border-amber-400/35 bg-[#071426] hover:border-amber-400 text-amber-200 cursor-pointer"
                  >
                    <input
                      type="color"
                      disabled={!isPremium}
                      value={
                        isValidHexColor(currentUsernameColor)
                          ? currentUsernameColor
                          : '#60A5FA'
                      }
                      onChange={(e) => handleSelectUsernameColor(e.target.value)}
                      className="h-5 w-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span>Seletor de cor</span>
                    {!isPremium && (
                      <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Cores de Fundo
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SOLID_BACKGROUND_PRESETS.map((preset) => {
                  const isSelected =
                    (currentBg.type === 'default' && preset.id === 'default') ||
                    (currentBg.type === 'solid' &&
                      currentBg.presetId === preset.id);
                  const locked = Boolean(preset.isPremium && !isPremium);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectSolidColor(preset)}
                      className={`flex items-center justify-between gap-2 rounded-xl p-3 border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#60A5FA] bg-blue-500/15 shadow-md'
                          : 'border-blue-400/20 bg-[#040D1A]/70 hover:border-blue-400/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-7 w-7 rounded-lg border border-white/20 shrink-0"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span className="text-xs font-semibold text-white truncate">
                          {preset.label}
                        </span>
                      </div>
                      {preset.isPremium && (
                        <Crown
                          className={`w-3.5 h-3.5 shrink-0 ${
                            locked ? 'text-amber-400' : 'text-amber-300/70'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Gradientes Exclusivos Premium */}
              <div className="pt-2 border-t border-blue-400/15 space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <h3 className="font-display text-lg font-bold text-white">
                    Gradientes Premium
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {GRADIENT_BACKGROUND_PRESETS.map((preset) => {
                    const isSelected =
                      currentBg.type === 'gradient' &&
                      currentBg.presetId === preset.id;
                    const locked = Boolean(preset.isPremium && !isPremium);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectGradient(preset)}
                        className={`flex items-center justify-between gap-2 rounded-xl p-3 border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#60A5FA] bg-blue-500/15 shadow-md'
                            : 'border-blue-400/20 bg-[#040D1A]/70 hover:border-blue-400/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="h-7 w-7 rounded-lg border border-white/20 shrink-0"
                            style={{ backgroundImage: preset.css }}
                          />
                          <span className="text-xs font-semibold text-white truncate">
                            {preset.label}
                          </span>
                        </div>
                        {locked && (
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fundos Temáticos */}
              <div className="pt-2 border-t border-blue-400/15 space-y-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Fundos Temáticos
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {THEMATIC_BACKGROUND_PRESETS.map((preset) => {
                    const isSelected =
                      currentBg.type === 'preset-image' &&
                      currentBg.presetId === preset.id;
                    const locked = Boolean(preset.isPremium && !isPremium);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectThematicBackground(preset)}
                        className={`group rounded-xl overflow-hidden border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#60A5FA] ring-1 ring-[#60A5FA] shadow-md'
                            : 'border-blue-400/20 bg-[#040D1A]/70 hover:border-blue-400/40'
                        }`}
                      >
                        <div className="relative h-16 w-full overflow-hidden">
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/35" />
                          {preset.isPremium && (
                            <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded bg-black/75 border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              <Crown className="w-3 h-3" />
                              {locked ? 'Premium' : ''}
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-bold text-white truncate">
                            {preset.label}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Imagem Própria de Fundo */}
              <div className="pt-2 border-t border-blue-400/15 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      Imagem Própria de Fundo
                    </h3>
                    <p className="text-xs text-blue-200/70">
                      Envie uma imagem do seu dispositivo para personalizar o fundo
                    </p>
                  </div>

                  <input
                    ref={bgFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCustomBgFileUpload}
                    className="hidden"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isProcessingBgImage}
                      onClick={() => bgFileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 px-4 py-2.5 text-xs font-bold text-[#60A5FA] transition-colors cursor-pointer"
                    >
                      {isProcessingBgImage ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Escolher imagem própria</span>
                        </>
                      )}
                    </button>

                    {currentBg.type === 'custom-image' && (
                      <button
                        type="button"
                        onClick={handleResetBackground}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 px-3 py-2.5 text-xs font-semibold text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BANNER / CAPA */}
          {activeTab === 'banner' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Banners
                  </h3>
                </div>

                {currentBanner.type !== 'none' && (
                  <button
                    type="button"
                    onClick={handleRemoveBanner}
                    className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 px-3.5 py-2 text-xs font-semibold text-rose-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover capa</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {BANNER_PRESETS.map((preset) => {
                  const isSelected =
                    currentBanner.type === 'preset' &&
                    currentBanner.presetId === preset.id;
                  const locked = Boolean(preset.isPremium && !isPremium);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPresetBanner(preset)}
                      className={`group rounded-xl overflow-hidden border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#60A5FA] ring-1 ring-[#60A5FA] shadow-md'
                          : 'border-blue-400/20 bg-[#040D1A]/70 hover:border-blue-400/40'
                      }`}
                    >
                      <div className="relative h-20 w-full overflow-hidden">
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                        {preset.isPremium && (
                          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded bg-black/75 border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                            <Crown className="w-3 h-3" />
                            {locked ? 'Premium' : ''}
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-bold text-white truncate">
                          {preset.label}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Upload de Capa Própria */}
              <div className="pt-3 border-t border-blue-400/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Usar Imagem Própria como Capa
                  </h3>
                  <p className="text-xs text-blue-200/70">
                    Envie uma foto ou arte horizontal do seu dispositivo
                  </p>
                </div>

                <input
                  ref={bannerFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomBannerFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={isProcessingBannerImage}
                  onClick={() => bannerFileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 px-4 py-2.5 text-xs font-bold text-[#60A5FA] transition-colors cursor-pointer shrink-0"
                >
                  {isProcessingBannerImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Escolher imagem própria</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: TEMAS PRONTO */}
          {activeTab === 'temas' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Temas Visuais
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {READY_VISUAL_THEMES.map((theme) => {
                  const isSelected = currentTheme === theme.id;
                  const locked = Boolean(theme.isPremium && !isPremium);
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleSelectReadyTheme(theme)}
                      className={`group rounded-xl overflow-hidden border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#60A5FA] ring-1 ring-[#60A5FA] bg-blue-500/15 shadow-lg'
                          : 'border-blue-400/20 bg-[#040D1A]/70 hover:border-blue-400/45'
                      }`}
                    >
                      <div>
                        <div
                          className="relative h-20 w-full overflow-hidden border-b border-blue-400/15"
                          style={{ backgroundColor: theme.previewColor }}
                        >
                          {theme.banner.value ? (
                            <img
                              src={theme.banner.value}
                              alt={theme.label}
                              className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{
                                backgroundImage: theme.background.value,
                              }}
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#040D1A] via-transparent to-transparent" />
                          {theme.isPremium && (
                            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded bg-black/80 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              <Crown className="w-3 h-3" />
                              <span>Premium</span>
                            </span>
                          )}
                          {isSelected ? (
                            <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-white shadow">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : locked ? (
                            <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-amber-400 shadow">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : null}
                        </div>

                        <div className="p-3">
                          <p className="font-display text-base font-bold text-white">
                            {theme.label}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Restaurar padrão | Cancelar | Salvar alterações */}
        <div className="px-6 py-4 border-t border-blue-400/15 bg-[#040D1A]/80 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleRestoreAllDefaults}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-400/20 bg-[#071426] hover:bg-blue-950/60 px-4 py-2.5 text-xs sm:text-sm font-semibold text-blue-200 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restaurar padrão</span>
          </button>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              disabled={isSaving}
              onClick={onCancel}
              className="rounded-xl border border-blue-400/25 bg-blue-950/40 hover:bg-blue-950/80 px-5 py-2.5 text-xs sm:text-sm font-semibold text-blue-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={isSaving || isProcessingBgImage || isProcessingBannerImage}
              onClick={handleSaveClick}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-60 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar alterações</span>
              )}
            </button>
          </div>
        </div>
    </div>
  );

  if (isInline) {
    return contentInner;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4"
      onClick={() => {
        if (!isSaving) onCancel();
      }}
    >
      {contentInner}
    </div>
  );
};
