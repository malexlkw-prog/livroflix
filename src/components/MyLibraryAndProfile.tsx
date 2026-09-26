import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Heart,
  Play,
  Trash2,
  Trophy,
  Flame,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  Download,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { Book, PlatformSettings, ReadingStatus, UserBookItem, UserProfile } from '../types';
import { BookCover } from './BookCover';
import { downloadBookPdf } from '../utils/pdfUtils';

interface DownloadsViewProps {
  books: Book[];
  userLibrary: Record<string, UserBookItem>;
  onSelectBook: (book: Book) => void;
  onReadBook: (book: Book) => void;
  onToggleDownload: (book: Book) => void;
  platformSettings?: PlatformSettings;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({
  books,
  onSelectBook,
  platformSettings,
}) => {
  const activeBooks = books.filter((b) => b.status === 'ativo');
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(
    null
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDirectPdfDownload = async (book: Book) => {
    setDownloadError(null);
    setDownloadingBookId(book.id);
    try {
      await downloadBookPdf(book);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : 'Não foi possível baixar o PDF deste livro.'
      );
    } finally {
      setDownloadingBookId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#040D1A] pt-28 lg:pt-24 pb-24">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 space-y-10">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-blue-400/15">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#60A5FA] mb-2">
              <Download className="w-3.5 h-3.5" />
              <span>Download Direto em PDF</span>
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white">
              {platformSettings?.downloadsTitle || 'Downloads'}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-blue-200/75">
              {platformSettings?.downloadsSubtitle ||
                'Clique em baixar em qualquer livro abaixo para fazer o download automático do arquivo PDF original.'}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-[#071426] border border-blue-400/20 px-4 py-3">
            <HardDrive className="w-5 h-5 text-[#60A5FA]" />
            <div>
              <span className="text-[11px] uppercase tracking-wider text-blue-200/70 block">
                Catálogo disponível
              </span>
              <span className="font-mono-num text-sm font-bold text-white">
                {activeBooks.length}{' '}
                {activeBooks.length === 1
                  ? 'livro para baixar'
                  : 'livros para baixar'}
              </span>
            </div>
          </div>
        </div>

        {downloadError && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs sm:text-sm text-rose-200">
            {downloadError}
          </div>
        )}

        {/* Books Grid for Direct PDF Download */}
        {activeBooks.length === 0 ? (
          <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-10 text-center max-w-xl mx-auto">
            <Download className="w-10 h-10 text-[#60A5FA] mx-auto mb-3 opacity-80" />
            <h3 className="font-display text-xl font-bold text-white">
              Nenhum livro disponível no catálogo
            </h3>
            <p className="text-sm text-blue-200/75 mt-1">
              Assim que livros forem cadastrados na plataforma, você poderá baixar o PDF diretamente por aqui.
            </p>
          </div>
        ) : (
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white mb-4">
              Disponíveis para Download em PDF
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {activeBooks.map((book) => {
                const isDownloading = downloadingBookId === book.id;
                return (
                  <div
                    key={book.id}
                    className="rounded-xl bg-[#071426] border border-blue-400/20 p-3 flex flex-col justify-between gap-3"
                  >
                    <div
                      onClick={() => onSelectBook(book)}
                      className="cursor-pointer"
                    >
                      <BookCover book={book} />
                      <h4 className="font-display text-sm font-bold text-white truncate mt-2">
                        {book.titulo}
                      </h4>
                      <p className="text-[11px] text-blue-200/70 truncate">
                        {book.autor}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={() => handleDirectPdfDownload(book)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-60 text-white py-2 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Baixando...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface MyLibraryViewProps {
  books: Book[];
  userLibrary: Record<string, UserBookItem>;
  initialTab?: 'lista' | 'lendo' | 'concluido' | 'favoritos';
  onSelectBook: (book: Book) => void;
  onReadBook: (book: Book) => void;
  onChangeStatus?: (book: Book, status: ReadingStatus) => void;
  onRemoveFromList: (book: Book) => void;
  platformSettings?: PlatformSettings;
}

export const MyLibraryView: React.FC<MyLibraryViewProps> = ({
  books,
  userLibrary,
  initialTab = 'lista',
  onSelectBook,
  onReadBook,
  onRemoveFromList,
  platformSettings,
}) => {
  const [activeTab, setActiveTab] = useState<
    'lista' | 'lendo' | 'concluido' | 'favoritos'
  >(initialTab);

  const libraryEntries = Object.values(userLibrary);

  const completedCount = libraryEntries.filter((i) => i.status === 'concluido').length;
  const readingCount = libraryEntries.filter((i) => i.status === 'lendo').length;
  const favoritesCount = libraryEntries.filter(
    (i) => i.isFavorite || i.status === 'quero_ler'
  ).length;

  const totalPagesRead = libraryEntries.reduce((acc, item) => {
    if (item.status === 'concluido') return acc + item.totalPaginas;
    return acc + (item.paginaAtual > 1 ? item.paginaAtual : 0);
  }, 0);

  const displayedBooks = books.filter((book) => {
    const item = userLibrary[book.id];
    if (!item) return false;
    if (activeTab === 'lista')
      return item.inMyList || item.isFavorite || item.status !== 'nenhum';
    if (activeTab === 'lendo') return item.status === 'lendo';
    if (activeTab === 'concluido') return item.status === 'concluido';
    if (activeTab === 'favoritos')
      return item.isFavorite || item.status === 'quero_ler';
    return false;
  });

  const statusLabel: Record<ReadingStatus, string> = {
    nenhum: 'Favorito',
    quero_ler: 'Favorito',
    lendo: 'Lendo',
    concluido: 'Concluído',
  };

  return (
    <div className="min-h-screen bg-[#040D1A] pt-28 lg:pt-24 pb-24">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        {/* Top Header & Reading Metrics Banner */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 pb-8 border-b border-blue-400/15">
          <div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold text-white">
              {platformSettings?.myListTitle || 'Minha lista'}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-blue-200/75">
              {platformSettings?.myListSubtitle ||
                'Acompanhe seus livros em leitura, favoritos e leituras concluídas.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl bg-[#071426] border border-blue-400/20 px-4 py-3.5">
              <span className="text-[11px] uppercase tracking-wider text-blue-200/70 block">
                Livros lidos
              </span>
              <p className="font-mono-num text-xl sm:text-2xl font-bold text-[#60A5FA] mt-1">
                {completedCount}
              </p>
            </div>
            <div className="rounded-xl bg-[#071426] border border-blue-400/20 px-4 py-3.5">
              <span className="text-[11px] uppercase tracking-wider text-blue-200/70 block">
                Páginas lidas
              </span>
              <p className="font-mono-num text-xl sm:text-2xl font-bold text-white mt-1">
                {totalPagesRead.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Sem "Quero ler", deixando "Favoritos") */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {(
            [
              { id: 'lista', label: 'Minha Lista Completa' },
              { id: 'lendo', label: `Lendo (${readingCount})` },
              { id: 'concluido', label: `Concluídos (${completedCount})` },
              { id: 'favoritos', label: `Favoritos (${favoritesCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#2563EB] text-white shadow-lg'
                  : 'bg-[#071426] text-blue-200/80 hover:text-white border border-blue-400/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Library Items Grid */}
        {displayedBooks.length === 0 ? (
          <div className="rounded-2xl bg-[#071426]/80 border border-blue-400/20 p-12 text-center max-w-xl mx-auto my-8">
            <BookOpen className="w-10 h-10 text-[#60A5FA] mx-auto mb-3 opacity-80" />
            <h3 className="font-display text-2xl font-bold text-white">
              Nenhum livro nesta seção ainda
            </h3>
            <p className="text-sm text-blue-200/75 mt-2">
              Explore o catálogo da LIVROFLIX e adicione histórias aos seus favoritos para ler quando quiser.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayedBooks.map((book) => {
              const item = userLibrary[book.id];
              return (
                <div
                  key={book.id}
                  className="flex gap-4 rounded-xl bg-[#071426] border border-blue-400/20 hover:border-[#60A5FA]/50 p-4 transition-all"
                >
                  {/* Cover */}
                  <div
                    onClick={() => onSelectBook(book)}
                    className="w-24 sm:w-28 flex-shrink-0 cursor-pointer"
                  >
                    <BookCover book={book} />
                  </div>

                  {/* Book Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'concluido'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : item.status === 'lendo'
                              ? 'bg-blue-500/20 text-[#60A5FA] border border-blue-400/30'
                              : 'bg-blue-950 text-blue-100 border border-blue-400/20'
                          }`}
                        >
                          {statusLabel[item.status]}
                        </span>

                        {/* Exclusão disponível apenas na aba de Favoritos */}
                        {activeTab === 'favoritos' && (
                          <button
                            type="button"
                            onClick={() => onRemoveFromList(book)}
                            title="Excluir livro dos Favoritos"
                            className="text-blue-300/60 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <h3
                        onClick={() => onSelectBook(book)}
                        className="font-display text-xl font-bold text-white hover:text-[#60A5FA] cursor-pointer truncate mt-1"
                      >
                        {book.titulo}
                      </h3>
                      <p className="text-xs text-blue-200/70 truncate">{book.autor}</p>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] font-mono-num text-blue-200/75 mb-1">
                          <span>
                            Pág. {item.paginaAtual} de {book.paginas}
                          </span>
                          <span className="text-[#60A5FA] font-bold">
                            {item.progresso}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-blue-950 overflow-hidden">
                          <div
                            className="h-full bg-[#3B82F6]"
                            style={{ width: `${item.progresso}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Controls — Sem opção de mudar status */}
                    <div className="mt-4 pt-3 border-t border-blue-400/15 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onReadBook(book)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-4 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {item.progresso > 0 && item.progresso < 100
                            ? 'Continuar'
                            : 'Ler'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface ProfileViewProps {
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  books: Book[];
  userLibrary: Record<string, UserBookItem>;
  onSignIn: () => Promise<void> | void;
  onDirectSignIn?: (email: string, nome?: string) => Promise<void> | void;
  onSignOut: () => void;
  onSelectBook: (book: Book) => void;
  onOpenAdmin: () => void;
  platformSettings?: PlatformSettings;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userProfile,
  isAuthenticated,
  isAdmin,
  books,
  userLibrary,
  onSignIn,
  onDirectSignIn,
  onSignOut,
  onSelectBook,
  onOpenAdmin,
  platformSettings,
}) => {
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [directEmail, setDirectEmail] = React.useState('');
  const [directName, setDirectName] = React.useState('');

  const handleGoogleLoginClick = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await onSignIn();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `O domínio atual (${window.location.hostname}) ainda não foi adicionado em Firebase Console → Authentication → Settings → Authorized domains. Você pode entrar imediatamente usando seu e-mail abaixo.`
        );
      } else if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user'
      ) {
        setAuthError(
          'A janela de login do Google foi bloqueada ou fechada. Tente novamente ou entre diretamente com seu e-mail abaixo.'
        );
      } else {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Não foi possível concluir o login com Google. Use o acesso por e-mail abaixo.'
        );
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDirectEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = directEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !onDirectSignIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await onDirectSignIn(cleanEmail, directName.trim() || undefined);
      setDirectEmail('');
      setDirectName('');
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'Erro ao acessar a conta.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const entries = Object.values(userLibrary);
  const completedBooksCount = entries.filter((i) => i.status === 'concluido').length;
  const currentlyReadingCount = entries.filter((i) => i.status === 'lendo').length;
  const favoritesCount = entries.filter(
    (i) => i.isFavorite || i.status === 'quero_ler'
  ).length;
  const totalPagesRead = entries.reduce((acc, item) => {
    if (item.status === 'concluido') return acc + item.totalPaginas;
    return acc + (item.paginaAtual > 1 ? item.paginaAtual : 0);
  }, 0);

  const favoriteBooks = books.filter(
    (b) =>
      userLibrary[b.id]?.isFavorite || userLibrary[b.id]?.status === 'quero_ler'
  );

  const achievements = [
    {
      id: 'first-book',
      icon: '🏆',
      title: 'Primeiro livro concluído',
      description: 'Concluiu sua primeira obra completa na LIVROFLIX.',
      unlocked: completedBooksCount >= 1,
      progressText: `${Math.min(1, completedBooksCount)}/1 livro`,
    },
    {
      id: 'five-books',
      icon: '📚',
      title: '5 livros lidos',
      description: 'Construiu o hábito literário completando cinco obras.',
      unlocked: completedBooksCount >= 5,
      progressText: `${Math.min(5, completedBooksCount)}/5 livros`,
    },
    {
      id: 'seven-days',
      icon: '🔥',
      title: '7 dias seguidos lendo',
      description: 'Manteve uma sequência diária de imersão na leitura.',
      unlocked: (userProfile?.streakDays || 0) >= 7,
      progressText: `${Math.min(7, userProfile?.streakDays || 0)}/7 dias`,
    },
    {
      id: 'ten-books',
      icon: '🌟',
      title: '10 livros concluídos',
      description: 'Mestre leitor com dez grandes histórias finalizadas.',
      unlocked: completedBooksCount >= 10,
      progressText: `${Math.min(10, completedBooksCount)}/10 livros`,
    },
  ];

  return (
    <div className="min-h-screen bg-[#040D1A] pt-28 lg:pt-24 pb-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-8 space-y-10">
        {/* Profile Header Card */}
        <div className="rounded-2xl bg-gradient-to-br from-[#071426] to-[#0B1E36] border border-blue-400/25 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {userProfile?.foto ? (
              <img
                src={userProfile.foto}
                alt={userProfile.nome}
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover ring-2 ring-[#60A5FA] shadow-xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl bg-[#040D1A] border border-blue-400/50 text-[#60A5FA] font-display text-4xl font-bold">
                {(userProfile?.nome || 'L')[0]}
              </div>
            )}

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/15 border border-blue-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-[#60A5FA] mb-2">
                <Sparkles className="w-3 h-3" />
                <span>
                  {isAuthenticated
                    ? 'Conta Sincronizada na Nuvem (Firebase)'
                    : 'Leitor Visitante'}
                </span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
                {userProfile?.nome || 'Leitor LIVROFLIX'}
              </h1>
              {userProfile?.email && (
                <p className="text-xs sm:text-sm text-blue-200/75 mt-0.5">
                  {userProfile.email}
                </p>
              )}
              <p className="text-xs text-blue-300/60 mt-1">
                Seus favoritos, lista e progresso de leitura são privados e isolados na sua conta.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#60A5FA] transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Painel Admin</span>
              </button>
            )}

            {isAuthenticated ? (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-950/60 hover:bg-rose-500/20 border border-blue-400/20 hover:border-rose-500/40 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da conta</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSigningIn}
                onClick={handleGoogleLoginClick}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-60 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSigningIn ? 'Conectando...' : 'Entrar com Google'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Direct Email / Admin Login Card (works even when Google Popup is blocked on Render) */}
        {!isAuthenticated && onDirectSignIn && (
          <div className="rounded-2xl bg-[#071426] border border-blue-400/25 p-6 sm:p-8 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  Acesso Rápido por E-mail (Leitor ou Administrador)
                </h2>
                <p className="text-xs sm:text-sm text-blue-200/75 mt-1">
                  Entre com seu e-mail para sincronizar sua biblioteca no Firebase ou acessar o Painel Admin imediatamente.
                </p>
              </div>

              <button
                type="button"
                disabled={isSigningIn}
                onClick={() =>
                  onDirectSignIn('malexlkw@gmail.com', 'Marcos Leandro (Admin)')
                }
                className="inline-flex items-center gap-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 px-4 py-2.5 text-xs sm:text-sm font-bold text-[#60A5FA] transition-colors cursor-pointer shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Entrar como Admin (malexlkw@gmail.com)</span>
              </button>
            </div>

            {authError && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 p-3.5 text-xs sm:text-sm text-amber-200">
                {authError}
              </div>
            )}

            <form
              onSubmit={handleDirectEmailSubmit}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3"
            >
              <input
                type="text"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                placeholder="Seu nome (opcional)"
                className="sm:col-span-4 rounded-xl bg-[#040D1A] border border-blue-400/20 px-4 py-3 text-sm text-white focus:border-[#60A5FA] focus:outline-none"
              />
              <input
                type="email"
                required
                value={directEmail}
                onChange={(e) => setDirectEmail(e.target.value)}
                placeholder="Digite seu e-mail (ex: malexlkw@gmail.com)"
                className="sm:col-span-5 rounded-xl bg-[#040D1A] border border-blue-400/20 px-4 py-3 text-sm text-white focus:border-[#60A5FA] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSigningIn}
                className="sm:col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#3B82F6] disabled:opacity-50 px-5 py-3 text-sm font-bold text-white shadow-lg transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Entrar</span>
              </button>
            </form>
          </div>
        )}

        {/* Reading Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl bg-[#071426] border border-blue-400/20 p-5">
            <span className="text-xs text-blue-200/75 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#60A5FA]" /> Livros lidos
            </span>
            <p className="font-mono-num text-3xl font-bold text-white mt-2">
              {completedBooksCount}
            </p>
          </div>

          <div className="rounded-xl bg-[#071426] border border-blue-400/20 p-5">
            <span className="text-xs text-blue-200/75 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#60A5FA]" /> Atualmente lendo
            </span>
            <p className="font-mono-num text-3xl font-bold text-white mt-2">
              {currentlyReadingCount}
            </p>
          </div>

          <div className="rounded-xl bg-[#071426] border border-blue-400/20 p-5">
            <span className="text-xs text-blue-200/75 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#60A5FA]" /> Páginas lidas
            </span>
            <p className="font-mono-num text-3xl font-bold text-white mt-2">
              {totalPagesRead.toLocaleString('pt-BR')}
            </p>
          </div>

          <div className="rounded-xl bg-[#071426] border border-blue-400/20 p-5">
            <span className="text-xs text-blue-200/75 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-500" /> Favoritos
            </span>
            <p className="font-mono-num text-3xl font-bold text-white mt-2">
              {favoritesCount}
            </p>
          </div>
        </div>

        {/* Achievements */}
        {platformSettings?.showProfileAchievements !== false && (
          <div className="rounded-2xl bg-[#071426] border border-blue-400/20 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#60A5FA]" />
                <span>Conquistas Literárias</span>
              </h2>
              <p className="text-xs sm:text-sm text-blue-200/75 mt-0.5">
                Marcos alcançados ao longo da sua jornada de leitura
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`flex items-start gap-4 rounded-xl border p-4 transition-all ${
                  ach.unlocked
                    ? 'bg-[#0B1E36]/90 border-blue-400/40 shadow-[0_8px_24px_-8px_rgba(37,99,235,0.3)]'
                    : 'bg-[#040D1A]/60 border-blue-400/10 opacity-60'
                }`}
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-950/70 text-2xl">
                  {ach.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-white">
                      {ach.title}
                    </h3>
                    <span className="text-[11px] font-mono-num text-[#60A5FA]">
                      {ach.progressText}
                    </span>
                  </div>
                  <p className="text-xs text-blue-200/75 mt-1">{ach.description}</p>
                </div>
              </div>
              ))}
            </div>
          </div>
        )}

        {/* Favorite Books Showcase */}
        {favoriteBooks.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              <span>Meus Livros Favoritos</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {favoriteBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => onSelectBook(book)}
                  className="cursor-pointer group"
                >
                  <BookCover
                    book={book}
                    className="group-hover:scale-[1.03] transition-transform"
                  />
                  <p className="mt-2 text-xs font-semibold text-white truncate">
                    {book.titulo}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
