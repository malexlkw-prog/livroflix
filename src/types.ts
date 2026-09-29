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

export interface BookPdfReadingOption {
  url: string;
  fileName: string;
  size: number;
  uploadedAt: string;
  assetId?: number;
  releaseId?: number;
  releaseTag?: string;
}

export interface BookReadingOptions {
  pdf?: BookPdfReadingOption;
  [key: string]: unknown;
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
  readingOptions?: BookReadingOptions;
  pdfUrl?: string;
  pdfPath?: string;
  pdfFileName?: string;
  pdfSize?: number;
  pdfUpdatedAt?: string;
  allowDownload?: boolean;
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

export type ProfileBackgroundType = 'default' | 'solid' | 'gradient' | 'preset-image' | 'custom-image';

export interface ProfileBackgroundConfig {
  type: ProfileBackgroundType;
  value: string; // CSS color, CSS gradient, preset image URL, or custom dataURL/URL
  presetId?: string;
}

export type ProfileBannerType = 'none' | 'preset' | 'custom';

export interface ProfileBannerConfig {
  type: ProfileBannerType;
  value: string; // Preset banner URL or custom dataURL/URL
  presetId?: string;
  positionY?: number; // 0 to 100 (default 50)
}

export type ProfileEffectId =
  | 'none'
  | 'subtle-glow'
  | 'starlight-particles'
  | 'paper-texture'
  | 'geometric-grid'
  | 'literary-vignette'
  | 'warm-sepia-mist'
  | 'golden-aura'
  | 'royal-constellation';

export interface ProfileCustomization {
  background?: ProfileBackgroundConfig;
  banner?: ProfileBannerConfig;
  effects?: ProfileEffectId;
  theme?: string; // e.g., 'biblioteca' | 'noite' | 'oceano' | 'vintage' | 'fantasia' | 'papel-antigo' | 'minimalista' | 'floresta' | 'ceu-estrelado' | 'custom'
  usernameColor?: string;
  updatedAt?: string;
}

export interface ProfileHighlight {
  name: string;
  photos: string[];
  coverUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  nome: string;
  displayName?: string;
  username?: string;
  usernameChangeHistory?: string[];
  bio?: string;
  email: string;
  foto: string;
  photoURL?: string;
  role: 'user' | 'admin';
  premium?: boolean;
  usernameColor?: string;
  streakDays: number;
  totalMinutesRead: number;
  preferenciasLeitor?: ReaderPreferences;
  profileCustomization?: ProfileCustomization;
  favoriteBooks?: string[];
  profileFavoriteBooks?: string[];
  unlockedBadges?: string[];
  profileBadges?: string[];
  nightReadingsCount?: number;
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
  badgeImages?: Record<string, string>;

  // Controle de Migração
  catalogSeeded: boolean;
  updatedAt: string;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  username: string;
  bio?: string;
  photoURL?: string;
  role?: 'user' | 'admin';
  isAdmin?: boolean;
  premium?: boolean;
  usernameColor?: string;
  profileCustomization?: ProfileCustomization;
  favoriteBooks?: string[];
  profileFavoriteBooks?: string[];
  unlockedBadges?: string[];
  profileBadges?: string[];
  updatedAt: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhoto?: string;
  text: string;
  imageUrl?: string;
  bookId?: string;
  mentions?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface CommunityLike {
  id: string;
  postId: string;
  userId: string;
  postAuthorId: string;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  postAuthorId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhoto?: string;
  text: string;
  parentReplyId?: string;
  replyToUsername?: string;
  createdAt: string;
}

export interface CommunityFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export type CommunityNotificationType = 'follow' | 'like' | 'reply' | 'mention';

export interface CommunityNotification {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorPhoto?: string;
  actorPhotoURL?: string;
  type: CommunityNotificationType;
  postId?: string;
  replyId?: string;
  snippet?: string;
  postSnippet?: string;
  read: boolean;
  createdAt: string;
}

export interface CommunityReport {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'post' | 'user' | 'review';
  targetPostId?: string;
  targetReviewId?: string;
  targetBookId?: string;
  targetUserId: string;
  targetUsername?: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
}

export interface BookReview {
  id: string;
  bookId: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorPhoto?: string;
  text: string;
  rating?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface DirectConversationParticipantMeta {
  displayName: string;
  username: string;
  photoURL?: string;
}

export interface DirectConversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId?: string;
  unreadBy?: string[];
  unreadCounts?: Record<string, number>;
  participantProfiles?: Record<string, DirectConversationParticipantMeta>;
  typingAt?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
  read: boolean;
  deleted?: boolean;
  hiddenFor?: string[];
}

export type ActiveView =
  | 'home'
  | 'comunidade'
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

