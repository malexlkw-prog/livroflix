import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Clock,
  MicOff,
  Loader2,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { ref, getBlob, deleteObject } from 'firebase/storage';
import { doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { DirectMessage } from '../types';

interface AudioMessagePlayerProps {
  message: DirectMessage;
  isMine: boolean;
  onAudioExpired?: (messageId: string) => void;
}

function formatAudioTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatTimeRemaining(expiresAtIso?: string): {
  isExpired: boolean;
  label: string;
} {
  if (!expiresAtIso) {
    return { isExpired: false, label: 'Áudio temporário' };
  }
  const expiresMs = new Date(expiresAtIso).getTime();
  if (Number.isNaN(expiresMs)) {
    return { isExpired: false, label: 'Áudio temporário' };
  }

  const nowMs = Date.now();
  const diffMs = expiresMs - nowMs;

  if (diffMs <= 0) {
    return { isExpired: true, label: 'Áudio expirado' };
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMins = diffMinutes % 60;

  if (diffHours > 0) {
    return {
      isExpired: false,
      label: `Expira em ${diffHours}h ${remainingMins > 0 ? `${remainingMins}m` : ''}`.trim(),
    };
  }

  if (diffMinutes > 1) {
    return {
      isExpired: false,
      label: `Expira em ${diffMinutes} min`,
    };
  }

  return {
    isExpired: false,
    label: 'Expira em menos de 1 min',
  };
}

export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({
  message,
  isMine,
  onAudioExpired,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(message.audioDuration || 0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const initialExpiry = useMemo(
    () => formatTimeRemaining(message.expiresAt),
    [message.expiresAt]
  );
  const [isExpired, setIsExpired] = useState(
    message.status === 'expired' || initialExpiry.isExpired
  );
  const [expiryLabel, setExpiryLabel] = useState(initialExpiry.label);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const cleaningUpRef = useRef(false);

  // Monitor 20-hour expiration countdown
  useEffect(() => {
    if (isExpired || message.status === 'expired') {
      setIsExpired(true);
      return;
    }

    const checkExpiration = () => {
      const result = formatTimeRemaining(message.expiresAt);
      setExpiryLabel(result.label);

      if (result.isExpired && !isExpired) {
        setIsExpired(true);
        // Stop audio immediately
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);

        // Revoke memory blob URL immediately
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }

        // Trigger physical deletion of audio file and update Firestore document
        if (!cleaningUpRef.current && message.audioPath) {
          cleaningUpRef.current = true;
          try {
            if (message.audioPath.startsWith('firestore:') || message.audioId) {
              const audioId = message.audioId || message.audioPath.split('/').pop() || '';
              if (audioId) {
                deleteDoc(
                  doc(
                    db,
                    'conversations',
                    message.conversationId,
                    'audios',
                    audioId
                  )
                ).catch(() => {});
              }
            }
            if (!message.audioPath.startsWith('firestore:')) {
              const storageRef = ref(storage, message.audioPath);
              deleteObject(storageRef).catch(() => {});
            }
          } catch {
            // ignore
          }

          try {
            const msgDocRef = doc(
              db,
              'conversations',
              message.conversationId,
              'messages',
              message.id
            );
            updateDoc(msgDocRef, {
              status: 'expired',
              text: 'Áudio expirado',
              audioPath: '',
            }).catch(() => {});
          } catch {
            // ignore
          }
        }

        onAudioExpired?.(message.id);
      }
    };

    checkExpiration();
    const timer = setInterval(checkExpiration, 10000);
    return () => clearInterval(timer);
  }, [message, isExpired, onAudioExpired]);

  // Clean up object URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const handleTogglePlay = async () => {
    if (isExpired) return;

    // Check expiration one more time right at the moment of user click
    const expiryCheck = formatTimeRemaining(message.expiresAt);
    if (expiryCheck.isExpired) {
      setIsExpired(true);
      return;
    }

    setLoadError(null);

    // If audio is already loaded in memory
    if (audioRef.current && blobUrlRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      }
      return;
    }

    // Audio needs to be downloaded into memory
    if (!message.audioPath) {
      setLoadError('Arquivo de áudio não encontrado.');
      return;
    }

    setIsLoadingAudio(true);
    try {
      let blob: Blob;

      if (message.audioPath.startsWith('firestore:')) {
        const audioId =
          message.audioId || message.audioPath.split('/').pop() || '';
        const audioDocRef = doc(
          db,
          'conversations',
          message.conversationId,
          'audios',
          audioId
        );
        const audioSnap = await getDoc(audioDocRef);
        if (!audioSnap.exists()) {
          setIsExpired(true);
          setIsLoadingAudio(false);
          return;
        }
        const data = audioSnap.data();
        const base64 = data?.data || '';
        const mimeType = data?.mimeType || 'audio/webm';
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: mimeType });
      } else {
        const storageRef = ref(storage, message.audioPath);
        blob = await getBlob(storageRef, 10 * 1024 * 1024);
      }

      // Verify expiration again
      if (
        message.expiresAt &&
        Date.now() >= new Date(message.expiresAt).getTime()
      ) {
        setIsExpired(true);
        setIsLoadingAudio(false);
        return;
      }

      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        if (audio.duration && !Number.isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoadingAudio(false);
        setLoadError('Não foi possível reproduzir este áudio.');
      };

      await audio.play();
      setIsPlaying(true);
    } catch {
      setLoadError('Erro ao carregar o áudio.');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || isExpired) return;
    const nextTime = Number(e.target.value);
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  // If the audio expired, show the clean expired state
  if (isExpired) {
    return (
      <div className="flex flex-col gap-1 py-1 max-w-xs">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
              isMine
                ? 'bg-blue-400/25 text-blue-100'
                : 'bg-rose-500/15 text-rose-300'
            }`}
          >
            <MicOff className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-rose-200 block truncate">
              Áudio expirado
            </span>
            <span className="text-[11px] text-blue-200/70 block leading-tight">
              Disponível por 20h • Arquivo excluído
            </span>
          </div>
        </div>
      </div>
    );
  }

  const effectiveDuration = duration > 0 ? duration : message.audioDuration || 0;
  const progressPercent =
    effectiveDuration > 0
      ? Math.min(100, (currentTime / effectiveDuration) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-2 py-0.5 select-none min-w-[220px] sm:min-w-[260px]">
      {/* Header tag: audio indicator and countdown */}
      <div className="flex items-center justify-between gap-2 text-[10px] text-blue-100/75">
        <span className="inline-flex items-center gap-1 font-medium">
          <Volume2 className="w-3 h-3 text-[#60A5FA]" />
          <span>Mensagem de voz</span>
        </span>
        <span
          className="inline-flex items-center gap-1 font-mono-num text-[10px] rounded-full px-2 py-0.5 bg-black/25 text-blue-100"
          title="Este áudio expira e é excluído do servidor após 20 horas"
        >
          <Clock className="w-3 h-3 text-amber-300" />
          <span>{expiryLabel}</span>
        </span>
      </div>

      {/* Player row: Play Button + Waveform/Seeker + Time */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void handleTogglePlay()}
          disabled={isLoadingAudio}
          aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer shadow-md ${
            isMine
              ? 'bg-white text-[#2563EB] hover:bg-blue-50'
              : 'bg-[#2563EB] text-white hover:bg-[#3B82F6]'
          }`}
        >
          {isLoadingAudio ? (
            <Loader2 className="w-4 h-4 animate-spin text-current" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Seeker slider & visual waveform bar */}
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div className="relative flex items-center h-4">
            <input
              type="range"
              min={0}
              max={effectiveDuration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              disabled={!blobUrlRef.current}
              aria-label="Progresso do áudio"
              className="w-full h-1.5 rounded-full appearance-none bg-black/30 cursor-pointer accent-white"
              style={{
                background: `linear-gradient(to right, ${
                  isMine ? '#FFFFFF' : '#60A5FA'
                } ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)`,
              }}
            />
          </div>

          <div
            className={`flex items-center justify-between text-[11px] font-mono-num ${
              isMine ? 'text-blue-100' : 'text-blue-200/80'
            }`}
          >
            <span>{formatAudioTime(currentTime)}</span>
            <span>{formatAudioTime(effectiveDuration)}</span>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-1.5 text-[11px] text-rose-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}
    </div>
  );
};
