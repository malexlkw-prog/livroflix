import { Book, HomeRow, PlatformSettings, UserBookItem } from '../types';

/**
 * IDs of legacy automatically seeded demo books.
 * Used to purge any auto-created books from Firestore and localStorage
 * so the platform operates strictly with real books registered by the Admin.
 */
export const LEGACY_AUTO_BOOK_IDS: string[] = [
  'diario-anne-frank',
  'o-pequeno-principe',
  'dom-casmurro',
  '1984-george-orwell',
  'harry-potter-pedra-filosofal',
  'senhor-dos-aneis-sociedade',
  'a-hora-da-estrela',
  'orgulho-e-preconceito',
  'assassinato-expresso-oriente',
  'o-iluminado',
  'torto-arado',
  'sapiens-breve-historia',
  'grande-sertao-veredas',
  'dracula-bram-stoker',
  'o-nome-do-vento',
  'meditacoes-marco-aurelio',
  'memorias-postumas-bras-cubas',
  'o-morro-dos-ventos-uivantes',
  'cosmos-carl-sagan',
  'capitaes-da-areia',
  'frankenstein-mary-shelley',
  'silencio-dos-inocentes',
];

export const INITIAL_BOOKS: Book[] = [];

export const DEFAULT_USER_LIBRARY: Record<string, UserBookItem> = {};

/**
 * Returns strictly the real content registered for the book's chapters and pages.
 * Does not generate any synthetic or superficial text.
 */
export function getPageContentForBook(
  book: Book,
  pageNumber: number
): { chapterNumber: number; chapterTitle: string; paragraphs: string[] } {
  const chapters =
    book.capitulos && book.capitulos.length > 0
      ? [...book.capitulos].sort((a, b) => a.paginaInicial - b.paginaInicial)
      : [
          {
            numero: 1,
            titulo: book.titulo,
            paginaInicial: 1,
            conteudo: book.descricao || '',
          },
        ];

  // Find active chapter and next chapter to determine page range
  let activeIndex = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (pageNumber >= chapters[i].paginaInicial) {
      activeIndex = i;
    }
  }

  const activeChapter = chapters[activeIndex];
  const nextChapter = chapters[activeIndex + 1];

  const chapterStartPage = Math.max(1, activeChapter.paginaInicial || 1);
  const chapterEndPage = nextChapter
    ? Math.max(chapterStartPage, nextChapter.paginaInicial - 1)
    : Math.max(chapterStartPage, book.paginas || 1);

  const totalChapterPages = Math.max(1, chapterEndPage - chapterStartPage + 1);
  const offsetInChapter = Math.max(0, pageNumber - chapterStartPage);

  const allParagraphs = (activeChapter.conteudo || '')
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (allParagraphs.length === 0) {
    return {
      chapterNumber: activeChapter.numero,
      chapterTitle: activeChapter.titulo,
      paragraphs: book.descricao ? [book.descricao] : [],
    };
  }

  // If the chapter spans multiple pages and has enough paragraphs, distribute real paragraphs across the chapter's pages
  if (totalChapterPages > 1 && allParagraphs.length >= totalChapterPages) {
    const perPage = Math.ceil(allParagraphs.length / totalChapterPages);
    const startIdx = offsetInChapter * perPage;
    const pageSlice = allParagraphs.slice(startIdx, startIdx + perPage);

    return {
      chapterNumber: activeChapter.numero,
      chapterTitle: activeChapter.titulo,
      paragraphs:
        pageSlice.length > 0
          ? pageSlice
          : [allParagraphs[allParagraphs.length - 1]],
    };
  }

  return {
    chapterNumber: activeChapter.numero,
    chapterTitle: activeChapter.titulo,
    paragraphs: allParagraphs,
  };
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  id: 'platform',
  siteName: 'LIVROFLIX',
  logoText: 'LIVROFLIX',
  logoImageUrl: '',
  footerDescription:
    'Sua plataforma de streaming literário. Descubra obras, organize sua biblioteca e continue sua leitura de onde parou em qualquer dispositivo.',
  footerCopyright: '© LIVROFLIX • Todos os direitos reservados.',
  primaryColor: '#2563EB',
  accentColor: '#60A5FA',
  backgroundColor: '#040D1A',
  cardBackgroundColor: '#071426',
  footerBackgroundColor: '#020813',
  navHomeText: 'Início',
  navMyListText: 'Minha lista',
  navDownloadsText: 'Downloads',
  navCategoriesText: 'Categorias',
  showDownloadsTab: true,
  showCategoriesTab: true,
  showSearchButton: true,
  heroMode: 'auto',
  heroBookIds: [],
  heroAutoRotateSeconds: 9,
  heroButtonText: 'Ver livro',
  showHeroRating: true,
  showHeroSynopsis: true,
  showHeroCover: true,
  showTop10: true,
  top10Title: 'Top 10 livros mais lidos',
  top10Mode: 'auto',
  top10BookIds: [],
  readButtonText: 'LER LIVRO',
  continueReadingTitle: 'Continuar lendo',
  ratingPromptText: 'Avalie esta obra',
  relatedBooksPrefix: 'Se você gostou de',
  myListTitle: 'Minha lista',
  myListSubtitle:
    'Acompanhe seus livros em leitura, favoritos e leituras concluídas.',
  downloadsTitle: 'Meus Downloads',
  downloadsSubtitle:
    'Acesse os livros salvos para leitura offline imediata ou baixe o arquivo digital no seu dispositivo.',
  searchTitle: 'Pesquisa Literária',
  searchPlaceholder:
    'Pesquise por título, autor, gênero, personagem ou palavra-chave...',
  searchSuggestions: [],
  headerCategories: [
    'Em alta',
    'Clássicos',
    'Fantasia',
    'Romance',
    'Mistério',
    'Terror',
    'Ficção',
    'Literatura brasileira',
    'Literatura mundial',
    'Para aprender',
    'Filosofia',
    'História',
    'Biografia',
    'Ciência',
  ],
  defaultReaderTheme: 'dark',
  defaultReaderFontSize: 20,
  defaultReaderFontFamily: 'editorial',
  showProfileAchievements: true,
  catalogSeeded: true,
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_HOME_ROWS: HomeRow[] = [
  {
    id: 'row-top10',
    titulo: 'Top 10 livros mais lidos',
    ordem: 1,
    ativo: true,
    tipo: 'top10',
    showRank: true,
  },
  {
    id: 'row-em-alta',
    titulo: 'Em alta',
    ordem: 2,
    ativo: true,
    tipo: 'em_alta',
  },
  {
    id: 'row-para-voce',
    titulo: 'Para você',
    ordem: 3,
    ativo: true,
    tipo: 'para_voce',
  },
  {
    id: 'row-bem-avaliados',
    titulo: 'Mais bem avaliados',
    ordem: 4,
    ativo: true,
    tipo: 'bem_avaliados',
  },
  {
    id: 'row-classicos',
    titulo: 'Clássicos',
    ordem: 5,
    ativo: true,
    tipo: 'genero',
    generoFiltro: 'Clássicos',
  },
  {
    id: 'row-literatura-brasileira',
    titulo: 'Literatura brasileira',
    ordem: 6,
    ativo: true,
    tipo: 'genero',
    generoFiltro: 'Literatura brasileira',
  },
  {
    id: 'row-fantasia',
    titulo: 'Fantasia',
    ordem: 7,
    ativo: true,
    tipo: 'genero',
    generoFiltro: 'Fantasia',
  },
  {
    id: 'row-romance',
    titulo: 'Romance',
    ordem: 8,
    ativo: true,
    tipo: 'genero',
    generoFiltro: 'Romance',
  },
  {
    id: 'row-misterio',
    titulo: 'Mistério',
    ordem: 9,
    ativo: true,
    tipo: 'genero',
    generoFiltro: 'Mistério',
  },
  {
    id: 'row-terror',
    titulo: 'Terror',
    ordem: 10,
    ativo: true,
    tipo: 'genero',
    generoFiltro: 'Terror',
  },
  {
    id: 'row-para-aprender',
    titulo: 'Para aprender',
    ordem: 11,
    ativo: true,
    tipo: 'genero',
    generoFiltro: 'Para aprender',
  },
  {
    id: 'row-literatura-mundial',
    titulo: 'Literatura mundial',
    ordem: 12,
    ativo: true,
    tipo: 'genero',
    generoFiltro: 'Literatura mundial',
  },
  {
    id: 'row-recentes',
    titulo: 'Adicionados recentemente',
    ordem: 13,
    ativo: true,
    tipo: 'recentes',
  },
];
