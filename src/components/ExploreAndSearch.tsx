import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  User,
  Tag,
  BookOpen,
} from 'lucide-react';
import { Book, PlatformSettings, UserBookItem } from '../types';
import { BookCard } from './BookCard';

interface SearchViewProps {
  books: Book[];
  userLibrary: Record<string, UserBookItem>;
  onSelectBook: (book: Book) => void;
  onReadBook: (book: Book) => void;
  onToggleList: (book: Book, e: React.MouseEvent) => void;
  platformSettings?: PlatformSettings;
}

const LEGACY_SUGGESTIONS = new Set([
  'Harry Potter',
  'Machado de Assis',
  'Capitu',
  'Anne Frank',
  'Pequeno Príncipe',
  'George Orwell',
]);

export const SearchView: React.FC<SearchViewProps> = ({
  books,
  onSelectBook,
  platformSettings,
}) => {
  const [query, setQuery] = useState<string>('');

  const activeBooks = useMemo(
    () => books.filter((b) => b.status === 'ativo'),
    [books]
  );

  // Use custom admin suggestions (filtering out old legacy demo names if any) or derive dynamically from real books
  const quickSuggestions = useMemo(() => {
    const custom = (platformSettings?.searchSuggestions || []).filter(
      (s) => !LEGACY_SUGGESTIONS.has(s)
    );
    if (custom.length > 0) return custom;

    const dynamicSet = new Set<string>();
    activeBooks.forEach((b) => {
      if (b.titulo) dynamicSet.add(b.titulo);
      if (b.autor) dynamicSet.add(b.autor);
      b.generos.forEach((g) => dynamicSet.add(g));
    });
    return Array.from(dynamicSet).slice(0, 8);
  }, [platformSettings?.searchSuggestions, activeBooks]);

  const { matchedBooks, matchedAuthors, matchedGenres, relatedBooks } = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return {
        matchedBooks: activeBooks.slice(0, 12),
        matchedAuthors: [] as string[],
        matchedGenres: [] as string[],
        relatedBooks: [] as Book[],
      };
    }

    const directMatches = activeBooks.filter((book) => {
      const inTitle = book.titulo.toLowerCase().includes(q);
      const inAuthor = book.autor.toLowerCase().includes(q);
      const inGenre = book.generos.some((g) => g.toLowerCase().includes(q));
      const inCharacters = (book.personagens || []).some((p) =>
        p.toLowerCase().includes(q)
      );
      const inKeywords = (book.palavrasChave || []).some((k) =>
        k.toLowerCase().includes(q)
      );
      const inDesc = book.descricao.toLowerCase().includes(q);

      return (
        inTitle || inAuthor || inGenre || inCharacters || inKeywords || inDesc
      );
    });

    const authors = Array.from(new Set(directMatches.map((b) => b.autor)));
    const genres = Array.from(new Set(directMatches.flatMap((b) => b.generos)));

    const directIds = new Set(directMatches.map((b) => b.id));
    const related = activeBooks
      .filter(
        (b) =>
          !directIds.has(b.id) &&
          b.generos.some((g) => genres.includes(g))
      )
      .slice(0, 6);

    return {
      matchedBooks: directMatches,
      matchedAuthors: authors,
      matchedGenres: genres.slice(0, 6),
      relatedBooks: related,
    };
  }, [activeBooks, query]);

  return (
    <div className="min-h-screen bg-[#040D1A] pt-28 lg:pt-24 pb-24">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        {/* Search Input Header */}
        <div className="max-w-3xl mx-auto mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            {platformSettings?.searchTitle || 'Pesquisa Literária'}
          </h1>

          <div className="relative">
            <Search className="w-5 h-5 text-[#60A5FA] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                platformSettings?.searchPlaceholder &&
                !platformSettings.searchPlaceholder.includes('Harry Potter')
                  ? platformSettings.searchPlaceholder
                  : 'Pesquise por título, autor, gênero, personagem ou palavra-chave...'
              }
              autoFocus
              className="w-full rounded-xl bg-[#071426] border border-blue-400/25 focus:border-[#3B82F6] pl-12 pr-12 py-4 text-base text-white placeholder:text-blue-200/45 shadow-2xl focus:outline-none transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-200/70 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Quick Search Chips (only shown when real suggestions exist) */}
          {quickSuggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-blue-200/70">Sugestões rápidas:</span>
              {quickSuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuery(item)}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                    query.toLowerCase() === item.toLowerCase()
                      ? 'bg-[#2563EB] text-white font-semibold'
                      : 'bg-blue-950/60 hover:bg-blue-900/60 text-blue-200 hover:text-white border border-blue-400/15'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Matched Authors & Genres Summary Pills */}
        {query.trim() !== '' && (matchedAuthors.length > 0 || matchedGenres.length > 0) && (
          <div className="mb-8 rounded-xl bg-[#071426]/90 border border-blue-400/20 p-4 flex flex-wrap items-center gap-6">
            {matchedAuthors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-blue-200/75 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#60A5FA]" /> Autores:
                </span>
                {matchedAuthors.map((author) => (
                  <button
                    key={author}
                    type="button"
                    onClick={() => setQuery(author)}
                    className="rounded bg-blue-900/40 hover:bg-blue-800/60 px-2.5 py-1 text-xs font-medium text-white cursor-pointer"
                  >
                    {author}
                  </button>
                ))}
              </div>
            )}

            {matchedGenres.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-blue-200/75 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-[#60A5FA]" /> Gêneros:
                </span>
                {matchedGenres.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setQuery(g)}
                    className="rounded bg-blue-500/15 border border-blue-400/30 px-2.5 py-1 text-xs font-medium text-[#60A5FA] cursor-pointer"
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Primary Search Results */}
        <div className="mb-12">
          <h2 className="font-display text-2xl font-bold text-white mb-5 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#60A5FA]" />
            <span>
              {query.trim()
                ? `Livros encontrados para "${query}" (${matchedBooks.length})`
                : 'Catálogo de Obras'}
            </span>
          </h2>

          {matchedBooks.length === 0 ? (
            <div className="rounded-xl bg-[#071426] border border-blue-400/15 p-10 text-center">
              <p className="font-display text-xl text-white">
                {query.trim()
                  ? `Nenhum livro encontrado diretamente para "${query}".`
                  : 'Nenhum livro cadastrado no catálogo ainda.'}
              </p>
              <p className="text-sm text-blue-200/70 mt-1">
                {query.trim()
                  ? 'Tente buscar por outro título, autor ou gênero.'
                  : 'Os livros adicionados no painel administrativo aparecerão aqui automaticamente.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 justify-items-center">
              {matchedBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onSelect={onSelectBook}
                />
              ))}
            </div>
          )}
        </div>

        {/* Related Results */}
        {query.trim() !== '' && relatedBooks.length > 0 && (
          <div className="pt-8 border-t border-blue-400/15">
            <h3 className="font-display text-2xl font-bold text-white mb-4">
              Resultados relacionados
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 justify-items-center">
              {relatedBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onSelect={onSelectBook}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
