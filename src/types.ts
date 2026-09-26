export type BookStatus = 'ativo' | 'oculto' | 'rascunho';

export type ReadingStatus = 'nenhum' | 'quero_ler' | 'lendo' | 'concluido';

export type ReadingFormat = 'pdf';

export interface ReadingFormatOption {
  format: ReadingFormat;
  icon: string;
  title: string;
  subtitle: string;
}

export interface BookChapter {
  numero: number;
  titulo: string;
  paginaInicial: number;
  conteudo: string;
}

export interface Book {
  id: string;
  titulo: string;
  autor: string;
  capa: string;
  bannerUrl?: string;
  corTema?: string;
  descricao: string;
  generos: string[];
  personagens?: string[];
  palavrasChave?: string[];
  ano: number;
  paginas: number;
  idioma: string;
  editora: string;
  avaliacao: number;
  totalAvaliacoes?: number;
  recomendacoesPositivas?: number;
  leiturasCount?: number;
  arquivo: string;
  // Dados do formato de leitura PDF (Firebase Storage: books/{bookId}/book.pdf)
  pdfUrl?: string;
  pdfPath?: string;
  pdfFileName?: string;
  pdfSize?: number;
  pdfUpdatedAt?: string;
  capitulos?: BookChapter[];
  status: BookStatus;
  destaque: boolean;
  ordem?: number;
  createdAt?: string;
}

export interface ReaderPreferences {
  fontSize: number; // 16 to 26
  fontFamily: 'editorial' | 'classic' | 'modern';
  lineHeight: number; // 1.5, 1.8, 2.1
  maxWidth: 'narrow' | 'comfortable' | 'wide';
  theme: 'dark' | 'sepia' | 'light';
}

export interface UserBookItem {
  bookId: string;
  userId: string;
  inMyList: boolean;
  isFavorite: boolean;
  isDownloaded?: boolean;
  status: ReadingStatus;
  paginaAtual: number;
  totalPaginas: number;
  progresso: number; // 0 to 100
  avaliacaoUsuario?: number; // 1 to 5
  recomendaria?: boolean;
  minutosLidos: number;
  ultimoAcesso: string;
}

export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  foto: string;
  role: 'user' | 'admin';
  streakDays: number;
  totalMinutesRead: number;
  preferenciasLeitor?: ReaderPreferences;
  updatedAt: string;
}

export interface CustomCategory {
  id: string;
  titulo: string;
  icone: string;
  generoFiltro: string;
  ordem: number;
}

export type HomeRowType =
  | 'top10'
  | 'em_alta'
  | 'para_voce'
  | 'bem_avaliados'
  | 'genero'
  | 'recentes'
  | 'manual';

export interface HomeRow {
  id: string;
  titulo: string;
  ordem: number;
  ativo: boolean;
  tipo: HomeRowType;
  generoFiltro?: string;
  bookIds?: string[];
  showRank?: boolean;
  cardSize?: 'sm' | 'md' | 'lg';
}

export interface PlatformSettings {
  id: string;
  // Identidade & Marca
  siteName: string;
  logoText: string;
  logoImageUrl?: string;
  footerDescription: string;
  footerCopyright?: string;

  // Cores & Aparência Global
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardBackgroundColor: string;
  footerBackgroundColor?: string;

  // Textos de Navegação e Visibilidade do Topo
  navHomeText?: string;
  navMyListText?: string;
  navDownloadsText?: string;
  navCategoriesText?: string;
  showDownloadsTab?: boolean;
  showCategoriesTab?: boolean;
  showSearchButton?: boolean;

  // Hero / Destaques
  heroMode?: 'auto' | 'manual';
  heroBookIds: string[];
  heroAutoRotateSeconds: number;
  heroButtonText: string;
  showHeroRating?: boolean;
  showHeroSynopsis?: boolean;
  showHeroCover?: boolean;

  // Top 10
  showTop10?: boolean;
  top10Title?: string;
  top10Mode: 'auto' | 'manual';
  top10BookIds: string[];

  // Textos das Páginas Internas
  readButtonText: string;
  continueReadingTitle?: string;
  ratingPromptText?: string;
  relatedBooksPrefix?: string;
  myListTitle?: string;
  myListSubtitle?: string;
  downloadsTitle?: string;
  downloadsSubtitle?: string;
  searchTitle?: string;
  searchPlaceholder?: string;
  searchSuggestions?: string[];

  // Menu de Categorias e Leitor Padrão
  headerCategories: string[];
  defaultReaderTheme?: 'dark' | 'sepia' | 'light';
  defaultReaderFontSize?: number;
  defaultReaderFontFamily?: 'editorial' | 'classic' | 'modern';
  showProfileAchievements?: boolean;

  // Controle de Migração
  catalogSeeded: boolean;
  updatedAt: string;
}

export type ActiveView =
  | 'home'
  | 'categorias'
  | 'minha-lista'
  | 'downloads'
  | 'continuar-lendo'
  | 'pesquisa'
  | 'perfil'
  | 'admin'
  | 'livro-detalhe'
  | 'leitor'
  | 'leitor-pdf';

