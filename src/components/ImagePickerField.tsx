import React, { useRef, useState } from 'react';
import { Upload, ClipboardPaste, Image as ImageIcon, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ImagePickerFieldProps {
  label: string;
  value: string;
  onChange: (newUrl: string) => void;
  placeholder?: string;
  aspectRatio?: 'cover' | 'banner' | 'square' | 'logo';
  helperText?: string;
  required?: boolean;
}

/**
 * Compresses and resizes an image File/Blob into an optimized Data URL
 * so it can be stored directly in Firestore documents without exceeding the 1MB limit.
 */
async function compressImageBlobToDataUrl(
  blob: Blob,
  maxWidth = 540,
  maxHeight = 810,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let compressed = canvas.toDataURL('image/jpeg', quality);
        // If still large (>300KB in base64), step down quality so Firestore doc never exceeds 1MB
        if (compressed.length > 300000) {
          compressed = canvas.toDataURL('image/jpeg', 0.62);
        }
        resolve(compressed);
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

export const ImagePickerField: React.FC<ImagePickerFieldProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Cole uma imagem (Ctrl+V), carregue do dispositivo ou insira a URL...',
  aspectRatio = 'cover',
  helperText,
  required = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const showTempMessage = (type: 'ok' | 'err', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => {
      setStatusMsg(null);
    }, 3200);
  };

  const handleFileProcess = async (file: File | Blob) => {
    try {
      const maxW = aspectRatio === 'banner' ? 1200 : aspectRatio === 'cover' ? 700 : 500;
      const maxH = aspectRatio === 'banner' ? 680 : aspectRatio === 'cover' ? 1050 : 500;
      const dataUrl = await compressImageBlobToDataUrl(file, maxW, maxH, 0.82);
      onChange(dataUrl);
      showTempMessage('ok', 'Imagem carregada e otimizada com sucesso!');
    } catch {
      showTempMessage('err', 'Não foi possível processar o arquivo de imagem.');
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileProcess(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handles native paste event (Ctrl+V / Cmd+V) inside the input or dropzone
  const handlePasteEvent = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            await handleFileProcess(blob);
            return;
          }
        }
      }
    }

    const pastedText = e.clipboardData?.getData('text/plain')?.trim();
    if (
      pastedText &&
      (pastedText.startsWith('http://') ||
        pastedText.startsWith('https://') ||
        pastedText.startsWith('data:image/'))
    ) {
      e.preventDefault();
      onChange(pastedText);
      showTempMessage('ok', 'Link da imagem colado com sucesso!');
    }
  };

  // Handles clicking the "Colar Imagem" button using Clipboard API
  const handlePasteButtonClick = async () => {
    try {
      if (navigator.clipboard && 'read' in navigator.clipboard) {
        try {
          const clipboardItems = await navigator.clipboard.read();
          for (const item of clipboardItems) {
            const imageType = item.types.find((t) => t.startsWith('image/'));
            if (imageType) {
              const blob = await item.getType(imageType);
              await handleFileProcess(blob);
              return;
            }
          }
        } catch {
          // Fallback to readText below if image read permission is not available
        }
      }

      if (navigator.clipboard && 'readText' in navigator.clipboard) {
        const text = (await navigator.clipboard.readText()).trim();
        if (text) {
          onChange(text);
          showTempMessage('ok', 'Imagem/URL colada da área de transferência!');
          return;
        }
      }

      showTempMessage(
        'err',
        'Clique no campo abaixo e pressione Ctrl+V (ou Cmd+V) para colar a imagem.'
      );
    } catch {
      showTempMessage(
        'err',
        'Pressione Ctrl+V (ou Cmd+V) diretamente no campo abaixo para colar.'
      );
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleFileProcess(file);
    }
  };

  const previewDimensions = {
    cover: 'w-20 h-28 rounded-lg',
    banner: 'w-36 h-20 rounded-lg',
    square: 'w-20 h-20 rounded-xl',
    logo: 'w-28 h-16 rounded-lg',
  }[aspectRatio];

  return (
    <div
      onPaste={handlePasteEvent}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`rounded-xl border p-3.5 transition-all ${
        isDragging
          ? 'border-[#3B82F6] bg-blue-500/10'
          : 'border-white/15 bg-[#0B0C10]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#A39E93]">
          {label} {required && <span className="text-[#60A5FA]">*</span>}
        </label>

        {/* Action Buttons: Carregar Imagem | Colar Imagem */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#3B82F6] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Carregar imagem</span>
          </button>

          <button
            type="button"
            onClick={handlePasteButtonClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#F4F1EA] transition-colors cursor-pointer"
            title="Colar imagem copiada ou URL da área de transferência (ou use Ctrl+V)"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span>Colar imagem</span>
          </button>

          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition-colors cursor-pointer"
              title="Remover imagem"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Live Preview + URL/Paste Input */}
      <div className="flex items-center gap-3.5">
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`${previewDimensions} flex-shrink-0 overflow-hidden border border-white/15 bg-[#12141C] flex items-center justify-center cursor-pointer group relative`}
          title="Clique para carregar uma imagem do dispositivo"
        >
          {value ? (
            <img
              src={value}
              alt="Preview"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-[#A39E93] p-2 text-center">
              <ImageIcon className="w-5 h-5 mb-1 opacity-60" />
              <span className="text-[10px] leading-tight">Sem imagem</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <input
            type="text"
            required={required}
            value={value.startsWith('data:image/') ? '[Imagem carregada na memória — pronta para salvar]' : value}
            onChange={(e) => {
              const val = e.target.value;
              if (!val.startsWith('[Imagem carregada')) {
                onChange(val);
              }
            }}
            onPaste={handlePasteEvent}
            placeholder={placeholder}
            className="w-full rounded-lg bg-[#12141C] border border-white/15 px-3 py-2 text-xs sm:text-sm text-[#F4F1EA] focus:border-[#60A5FA] focus:outline-none"
          />

          <p className="text-[11px] text-[#A39E93]">
            {helperText ||
              'Dica: Clique em "Carregar imagem" para escolher do seu computador/celular, clique em "Colar imagem" (ou pressione Ctrl+V aqui) para colar um print/imagem copiada, ou cole um link.'}
          </p>

          {statusMsg && (
            <div
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                statusMsg.type === 'ok' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {statusMsg.type === 'ok' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
