import React from 'react';
import { X, BookOpen } from 'lucide-react';
import { Book, ReadingFormat, ReadingFormatOption } from '../types';

/**
 * Retorna os formatos de leitura reais disponíveis para um livro.
 * Estruturado para suportar novos formatos futuramente (EPUB, Áudio, etc.)
 * sem precisar refazer o sistema de seleção.
 * Nesta etapa, apenas format = "pdf" está implementado e só aparece se o livro possuir PDF cadastrado.
 */
export function getAvailableReadingFormats(book: Book): ReadingFormatOption[] {
  const formats: ReadingFormatOption[] = [];
  const pdfUrl = book.readingOptions?.pdf?.url || book.pdfUrl;

  if (pdfUrl && pdfUrl.trim() !== '') {
    formats.push({
      format: 'pdf',
      icon: '📄',
      title: 'PDF',
      subtitle: 'Ler no leitor do LIVROFLIX',
    });
  }

  return formats;
}

interface ReadingFormatModalProps {
  book: Book | null;
  onClose: () => void;
  onSelectFormat: (book: Book, format: ReadingFormat) => void;
}

export const ReadingFormatModal: React.FC<ReadingFormatModalProps> = ({
  book,
  onClose,
  onSelectFormat,
}) => {
  if (!book) return null;

  const availableFormats = getAvailableReadingFormats(book);
  const pdfUrl = book.readingOptions?.pdf?.url || book.pdfUrl || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-[#071426] border border-blue-400/25 p-6 sm:p-8 shadow-2xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar seleção de formato"
          className="absolute top-4 right-4 rounded-lg p-1.5 text-blue-200/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho do Modal */}
        <div className="mb-6">
          <p className="text-xs font-medium text-[#60A5FA] truncate mb-1">
            {book.titulo}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Como você quer ler?
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-blue-200/75">
            Escolha um dos formatos de leitura disponíveis para esta obra.
          </p>
        </div>

        {/* Lista de Formatos Disponíveis */}
        {availableFormats.length > 0 ? (
          <div className="space-y-3">
            {availableFormats.map((option) =>
              option.format === 'pdf' && pdfUrl ? (
                <a
                  key={option.format}
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onSelectFormat(book, option.format)}
                  className="w-full flex items-center gap-4 rounded-xl bg-[#040D1A] hover:bg-[#0B1E36] border border-blue-400/25 hover:border-[#60A5FA] p-4 sm:p-5 text-left transition-all cursor-pointer group"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-400/30 text-2xl">
                    <span role="img" aria-label={option.title}>
                      {option.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg font-bold text-white group-hover:text-[#60A5FA] transition-colors">
                      {option.icon} {option.title}
                    </p>
                    <p className="text-xs sm:text-sm text-blue-200/75 mt-0.5">
                      {option.subtitle}
                    </p>
                  </div>
                </a>
              ) : (
                <button
                  key={option.format}
                  type="button"
                  onClick={() => onSelectFormat(book, option.format)}
                  className="w-full flex items-center gap-4 rounded-xl bg-[#040D1A] hover:bg-[#0B1E36] border border-blue-400/25 hover:border-[#60A5FA] p-4 sm:p-5 text-left transition-all cursor-pointer group"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-400/30 text-2xl">
                    <span role="img" aria-label={option.title}>
                      {option.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg font-bold text-white group-hover:text-[#60A5FA] transition-colors">
                      {option.icon} {option.title}
                    </p>
                    <p className="text-xs sm:text-sm text-blue-200/75 mt-0.5">
                      {option.subtitle}
                    </p>
                  </div>
                </button>
              )
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-[#040D1A] border border-blue-400/15 p-6 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-blue-300/60 mx-auto" />
            <p className="font-display text-base font-bold text-white">
              Nenhum formato de leitura disponível
            </p>
            <p className="text-xs text-blue-200/70 leading-relaxed">
              Este livro ainda não possui um arquivo de leitura cadastrado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
