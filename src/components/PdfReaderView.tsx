import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { Book, ReadingFormat } from '../types';

interface PdfReaderViewProps {
  book: Book;
  format?: ReadingFormat;
  onClose: () => void;
}

/**
 * Rota/Componente preparado para o Leitor de PDF do LIVROFLIX (format = "pdf").
 * Recebe o livro com pdfUrl associado no Firestore/Firebase Storage.
 * Os recursos avançados do leitor (paginação personalizada, progresso, favoritos no PDF)
 * serão desenvolvidos na etapa dedicada ao leitor.
 */
export const PdfReaderView: React.FC<PdfReaderViewProps> = ({
  book,
  format = 'pdf',
  onClose,
}) => {
  return (
    <div className="min-h-screen bg-[#040D1A] text-white flex flex-col">
      {/* Barra Superior do Leitor PDF */}
      <header className="sticky top-0 z-40 border-b border-blue-400/20 bg-[#071426]/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-950/70 hover:bg-blue-900/70 border border-blue-400/25 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-[#60A5FA]" />
              <span>Voltar ao livro</span>
            </button>

            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold text-white truncate">
                {book.titulo}
              </h1>
              <p className="text-xs text-blue-200/70 truncate">
                {book.autor} · Formato: {format.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-blue-200/80 shrink-0">
            <FileText className="w-4 h-4 text-[#60A5FA]" />
            <span>📄 PDF</span>
          </div>
        </div>
      </header>

      {/* Área Principal do Leitor de PDF */}
      <main className="flex-1 flex flex-col">
        {book.pdfUrl ? (
          <div className="flex-1 flex flex-col bg-[#020813]">
            <iframe
              src={book.pdfUrl}
              title={`Leitor PDF - ${book.titulo}`}
              className="w-full flex-1 min-h-[calc(100vh-65px)] border-0"
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl bg-[#071426] border border-blue-400/20 p-8 text-center space-y-4">
              <FileText className="w-10 h-10 text-[#60A5FA] mx-auto opacity-80" />
              <h2 className="font-display text-xl font-bold text-white">
                PDF não disponível para este livro
              </h2>
              <p className="text-xs sm:text-sm text-blue-200/75">
                O arquivo PDF ainda não foi associado a esta obra no painel administrativo.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para a página do livro</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
