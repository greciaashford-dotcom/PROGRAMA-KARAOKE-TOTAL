import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Music2,
  User,
  Film,
  Sparkles,
  Music,
} from 'lucide-react';
import {
  QueueItemDTO,
  PlaybackSnapshotDTO,
  PlaybackStatus,
} from '@karaoke/contracts';
import { PlayerPrepareResult } from '../../../preload/types.js';
import { playApplause, stopApplause } from '../utils/applause.js';
import { audioMixerEngine } from '../utils/audio-mixer-engine.js';
import { AmbientMusicPanel } from './AmbientMusicPanel.js';

interface PlayerPanelProps {
  queue: QueueItemDTO[];
  onRefreshQueue: () => Promise<void>;
  onNotification: (msg: string, type?: 'info' | 'error') => void;
  preparedTrack: PlayerPrepareResult | null;
  onSetPreparedTrack: (track: PlayerPrepareResult | null) => void;
  onSkipTrack?: () => Promise<void>;
  karaokeVolume: number;
  ambientVolume: number;
  masterVolume: number;
  karaokeMuted: boolean;
  ambientMuted: boolean;
  masterMuted: boolean;
  crossfadeEnabled: boolean;
  crossfadeDurationSec: number;
  onChangeAmbientVolume: (vol: number) => void;
  onToggleAmbientMute: () => void;
  onCrossfadeStateChange?: (isCrossfading: boolean) => void;
  catalogRefreshTrigger?: number;
  emergencyStopSignal?: number;
}

const AUDIO_ONLY_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.wav',
  '.wave',
  '.ogg',
  '.oga',
  '.aac',
  '.flac',
]);

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  queue,
  onRefreshQueue,
  onNotification,
  preparedTrack,
  onSetPreparedTrack,
  onSkipTrack,
  karaokeVolume,
  ambientVolume,
  masterVolume,
  karaokeMuted,
  ambientMuted,
  masterMuted,
  crossfadeEnabled,
  crossfadeDurationSec,
  onChangeAmbientVolume,
  onToggleAmbientMute,
  onCrossfadeStateChange,
  catalogRefreshTrigger = 0,
  emergencyStopSignal = 0,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fadeInTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [karaokeFadeMultiplier, setKaraokeFadeMultiplier] = useState<number>(1);
  const [playbackState, setPlaybackState] = useState<PlaybackStatus>('IDLE');
  const playbackStateRef = useRef<PlaybackStatus>('IDLE');
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [isApplauseActive, setIsApplauseActive] = useState<boolean>(false);
  const lastReportedTimeRef = useRef<number>(0);

  const updatePlaybackStateLocal = (nextState: PlaybackStatus) => {
    playbackStateRef.current = nextState;
    setPlaybackState(nextState);
  };

  const clearFadeInTimer = useCallback(() => {
    if (fadeInTimerRef.current) {
      clearInterval(fadeInTimerRef.current);
      fadeInTimerRef.current = null;
    }
  }, []);

  // Calcular ganancia efectiva real del canal Karaoke combinada con Master, Mute y Crossfade
  const getEffectiveKaraokeScalar = useCallback(() => {
    if (karaokeMuted || masterMuted) return 0;
    const base = (karaokeVolume / 100) * (masterVolume / 100);
    return Math.max(0, Math.min(1, base * karaokeFadeMultiplier));
  }, [karaokeMuted, masterMuted, karaokeVolume, masterVolume, karaokeFadeMultiplier]);

  // Sincronizar estado inicial y suscribirse a eventos globales del reproductor
  useEffect(() => {
    const fetchInitialState = async () => {
      if (!window.karaokeAPI) return;
      const res = await window.karaokeAPI.getPlayerState();
      if (res.success && res.data) {
        updatePlaybackStateLocal(res.data.state);
        if (res.data.durationMs) {
          setDurationMs(res.data.durationMs);
        }
      }
    };
    fetchInitialState();

    const unsubscribe = window.karaokeAPI.onPlayerStateChanged((snapshot: PlaybackSnapshotDTO) => {
      updatePlaybackStateLocal(snapshot.state);
      if (snapshot.durationMs) {
        setDurationMs(snapshot.durationMs);
      }

      if (videoRef.current) {
        if (snapshot.state === 'PLAYING' && videoRef.current.paused) {
          videoRef.current.play().catch((err) => {
            console.warn('[Reproductor] Autoplay pendiente de carga del medio:', err);
          });
        } else if (snapshot.state === 'PAUSED' && !videoRef.current.paused) {
          videoRef.current.pause();
        } else if (snapshot.state === 'STOPPED') {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
          setCurrentTimeMs(0);
        }
      }
    });

    return () => {
      unsubscribe();
      clearFadeInTimer();
    };
  }, [clearFadeInTimer]);

  // Cuando cambia la pista cargada, reiniciar posición y registrar en el analizador Web Audio
  useEffect(() => {
    if (preparedTrack) {
      setDurationMs(preparedTrack.durationMs || 0);
      setCurrentTimeMs(0);
      if (playbackStateRef.current !== 'PLAYING') {
        updatePlaybackStateLocal(preparedTrack.snapshot?.state || 'READY');
      }
      if (videoRef.current) {
        audioMixerEngine.registerKaraokeElement(videoRef.current);
        videoRef.current.currentTime = 0;
        videoRef.current.load();
      }
    } else {
      setCurrentTimeMs(0);
      setDurationMs(0);
    }
  }, [preparedTrack?.mediaUrl, preparedTrack?.queueItemId]);

  // Aplicar volumen efectivo al elemento <video> y sincronizar con la Pantalla Pública
  useEffect(() => {
    const effectiveScalar = getEffectiveKaraokeScalar();
    if (videoRef.current) {
      videoRef.current.volume = effectiveScalar;
    }
    const publicVol = Math.round(effectiveScalar * 100);
    window.karaokeAPI?.sendPlayerCommand({ command: 'SET_VOLUME', volume: publicVol }).catch(() => {});
  }, [getEffectiveKaraokeScalar]);

  // Al pasar a PLAYING: detener aplausos, activar rampa de entrada si Crossfade está ON y reproducir <video>
  useEffect(() => {
    if (playbackState === 'PLAYING') {
      stopApplause();
      setIsApplauseActive(false);

      clearFadeInTimer();
      if (crossfadeEnabled) {
        const durationMs = Math.max(500, crossfadeDurationSec * 1000);
        const steps = Math.max(10, Math.floor(durationMs / 50));
        let step = 0;
        setKaraokeFadeMultiplier(0.35);
        fadeInTimerRef.current = setInterval(() => {
          step++;
          const nextMult = Math.min(1, 0.35 + 0.65 * (step / steps));
          setKaraokeFadeMultiplier(nextMult);
          if (step >= steps) {
            clearFadeInTimer();
          }
        }, 50);
      } else {
        setKaraokeFadeMultiplier(1);
      }
    } else {
      clearFadeInTimer();
      setKaraokeFadeMultiplier(1);
    }

    if (preparedTrack && playbackState === 'PLAYING' && videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {
        // Se reintentará en onCanPlay cuando termine de cargar el buffer inicial
      });
    }
  }, [preparedTrack, playbackState, crossfadeEnabled, crossfadeDurationSec, clearFadeInTimer]);

  useEffect(() => {
    if (emergencyStopSignal > 0) {
      clearFadeInTimer();
      stopApplause();
      setIsApplauseActive(false);
    }
  }, [emergencyStopSignal, clearFadeInTimer]);

  // Manejo de Comandos
  const handleTogglePlay = useCallback(async () => {
    if (!window.karaokeAPI) return;

    if (!preparedTrack) {
      const safeQueue = Array.isArray(queue) ? queue : [];
      const nextSong = safeQueue.find(
        (i) => !['COMPLETED', 'CANCELLED', 'SKIPPED', 'FAILED'].includes(i.status),
      );
      if (nextSong) {
        const prepRes = await window.karaokeAPI.preparePlayer({
          sessionId: nextSong.sessionId,
          queueItemId: nextSong.id,
        });
        if (prepRes.success) {
          onSetPreparedTrack(prepRes.data);
          updatePlaybackStateLocal('PLAYING');
          await window.karaokeAPI.sendPlayerCommand({ command: 'PLAY' });
          onNotification(`En directo: ${prepRes.data.title}`);
          await onRefreshQueue();
        } else {
          onNotification(prepRes.error.message, 'error');
        }
      } else {
        onNotification('Selecciona una canción del Catálogo (Play) o añade una a la Cola.');
      }
      return;
    }

    if (playbackState === 'PLAYING') {
      if (videoRef.current) videoRef.current.pause();
      updatePlaybackStateLocal('PAUSED');
      await window.karaokeAPI.sendPlayerCommand({ command: 'PAUSE' });
      onNotification('Reproducción pausada.');
    } else {
      updatePlaybackStateLocal('PLAYING');
      await window.karaokeAPI.sendPlayerCommand({ command: 'PLAY' });
      if (videoRef.current) {
        videoRef.current.play().catch((err) => {
          console.error('[Reproductor] Error al iniciar video:', err);
          onNotification('Error al iniciar vídeo. Verifica el archivo multimedia.', 'error');
        });
      }
      onNotification(`En directo: ${preparedTrack.title}`);
    }
    await onRefreshQueue();
  }, [preparedTrack, playbackState, queue, onSetPreparedTrack, onNotification, onRefreshQueue]);

  const handleRestartTrack = useCallback(async () => {
    if (!preparedTrack || !window.karaokeAPI) return;
    setCurrentTimeMs(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(console.error);
    }
    updatePlaybackStateLocal('PLAYING');
    await window.karaokeAPI.sendPlayerCommand({ command: 'SEEK', positionMs: 0 });
    await window.karaokeAPI.sendPlayerCommand({ command: 'PLAY' });
    onNotification(`Pista reiniciada desde el principio: ${preparedTrack.title}`);
  }, [preparedTrack, onNotification]);

  const handleStop = useCallback(async () => {
    if (!window.karaokeAPI) return;
    clearFadeInTimer();
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setCurrentTimeMs(0);
    updatePlaybackStateLocal('STOPPED');
    await window.karaokeAPI.sendPlayerCommand({ command: 'STOP' });
    onNotification('Reproducción detenida.');
    await onRefreshQueue();
  }, [onNotification, onRefreshQueue, clearFadeInTimer]);

  const handleEmergencyStop = useCallback(async () => {
    if (!window.karaokeAPI) return;
    clearFadeInTimer();
    stopApplause();
    setIsApplauseActive(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setCurrentTimeMs(0);
    updatePlaybackStateLocal('STOPPED');
    await window.karaokeAPI.emergencyStop();
    onNotification('¡PARADA DE EMERGENCIA ACTIVADA! Vídeo y audio cortados.', 'error');
    await onRefreshQueue();
  }, [onNotification, onRefreshQueue, clearFadeInTimer]);

  const handleSeek = useCallback(
    async (newTimeMs: number) => {
      if (!window.karaokeAPI) return;
      const maxDur = durationMs || (videoRef.current ? videoRef.current.duration * 1000 : 0) || 100000;
      const clampedMs = Math.max(0, Math.min(maxDur, newTimeMs));
      setCurrentTimeMs(clampedMs);
      if (videoRef.current) {
        videoRef.current.currentTime = clampedMs / 1000;
      }
      await window.karaokeAPI.sendPlayerCommand({ command: 'SEEK', positionMs: clampedMs });
    },
    [durationMs],
  );

  // Eventos nativos HTML5 del elemento <video>
  const handleTimeUpdate = () => {
    if (!videoRef.current || isSeeking) return;
    const currentMs = Math.round(videoRef.current.currentTime * 1000);
    setCurrentTimeMs(currentMs);

    if (Math.abs(currentMs - lastReportedTimeRef.current) > 1000) {
      lastReportedTimeRef.current = currentMs;
      window.karaokeAPI?.updatePlayerProgress(currentMs, durationMs).catch(() => {});
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      audioMixerEngine.registerKaraokeElement(videoRef.current);
      videoRef.current.volume = getEffectiveKaraokeScalar();
      if (videoRef.current.duration && Number.isFinite(videoRef.current.duration)) {
        const durMs = Math.round(videoRef.current.duration * 1000);
        setDurationMs(durMs);
        window.karaokeAPI?.updatePlayerProgress(0, durMs).catch(() => {});
      }
      if (playbackStateRef.current === 'PLAYING' && videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      }
    }
  };

  const handleCanPlay = () => {
    if (videoRef.current) {
      audioMixerEngine.registerKaraokeElement(videoRef.current);
      videoRef.current.volume = getEffectiveKaraokeScalar();
      if (playbackStateRef.current === 'PLAYING' && videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      }
    }
  };

  /**
   * INNEGOCIABLE: La finalización solo se procesa mediante el evento nativo 'ended' del elemento <video>.
   * Al finalizar una reproducción de karaoke, suena automáticamente un aplauso de 6 segundos.
   */
  const handleNativeEnded = async () => {
    if (!preparedTrack || !window.karaokeAPI) return;
    const finishedTitle = preparedTrack.title;
    const finishedSinger = preparedTrack.singerName;
    console.log(`[Reproductor] Evento nativo 'ended' detectado para pista: ${finishedTitle}`);

    await window.karaokeAPI.reportPlayerEnded(preparedTrack.queueItemId);
    onSetPreparedTrack(null);
    setCurrentTimeMs(0);
    updatePlaybackStateLocal('ENDED');

    // Reproducir sonido de aplausos automáticamente durante 6 segundos respetando niveles
    const applauseGain =
      karaokeMuted || masterMuted
        ? 0
        : Math.max(0.35, (karaokeVolume / 100) * (masterVolume / 100));
    setIsApplauseActive(true);
    playApplause(6000, applauseGain, () => {
      setIsApplauseActive(false);
    });

    onNotification(`👏 ¡Actuación finalizada! Aplausos (6s) para ${finishedSinger} — ${finishedTitle}`);
    await onRefreshQueue();
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('[Reproductor] Error en elemento de video HTML5:', e);
    onNotification('Error al decodificar el flujo multimedia local. Comprueba el códec del archivo.', 'error');
  };

  // Atajos de teclado para el operador en directo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'Escape' || e.code === 'F12') {
        e.preventDefault();
        handleEmergencyStop();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(currentTimeMs - 5000);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(currentTimeMs + 5000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleTogglePlay, handleEmergencyStop, handleSeek, currentTimeMs]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const isAudioOnly =
    preparedTrack?.extension && AUDIO_ONLY_EXTENSIONS.has(preparedTrack.extension.toLowerCase());

  return (
    <section className="panel" aria-label="Reproductor y control en directo" style={{ flex: '1 1 360px' }}>
      <div className="panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Film size={17} color="#FFB100" />
          MONITOR DE REPRODUCCIÓN
        </span>

        <span
          className="pill"
          style={{
            fontSize: '10px',
            fontWeight: 800,
            padding: '3px 9px',
            borderRadius: '5px',
            backgroundColor:
              playbackState === 'PLAYING'
                ? '#FFB100'
                : playbackState === 'PAUSED'
                  ? 'rgba(255, 177, 0, 0.25)'
                  : playbackState === 'READY'
                    ? '#29C7FF'
                    : '#1c2333',
            color:
              playbackState === 'PLAYING' || playbackState === 'READY'
                ? '#0C1017'
                : playbackState === 'PAUSED'
                  ? '#FFB100'
                  : 'var(--text-secondary)',
          }}
        >
          {playbackState === 'PLAYING'
            ? '▣ REPRODUCIENDO'
            : playbackState === 'PAUSED'
              ? '⏸ PAUSADO'
              : playbackState === 'READY'
                ? '● LISTO'
                : 'EN ESPERA'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 12px', overflowY: 'auto', flex: 1 }}>
        {/* Vista previa de vídeo 16:9 con estética de escenario */}
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            minHeight: '148px',
            maxHeight: '190px',
            backgroundColor: '#07090e',
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: playbackState === 'PLAYING' ? '1px solid #FFB100' : '1px solid #242d3f',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.55)',
          }}
        >
          {isApplauseActive && !preparedTrack && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                background: 'radial-gradient(circle, rgba(255,177,0,0.22) 0%, rgba(7,9,14,0.96) 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                textAlign: 'center',
                padding: '14px',
              }}
            >
              <Sparkles size={32} color="#FFB100" />
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#FFB100' }}>
                👏 ¡APLAUSOS EN SALA! (6s)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Celebrando la actuación antes del intervalo...
              </div>
            </div>
          )}

          {preparedTrack ? (
            <>
              <video
                ref={videoRef}
                crossOrigin="anonymous"
                src={preparedTrack.mediaUrl}
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={handleCanPlay}
                onEnded={handleNativeEnded}
                onError={handleVideoError}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />

              {isAudioOnly && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'radial-gradient(circle, rgba(22,30,48,0.94) 0%, rgba(8,11,18,0.98) 100%)',
                    padding: '14px',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <div className="audio-eq">
                    <span className={playbackState === 'PLAYING' ? 'bar active' : 'bar'} />
                    <span className={playbackState === 'PLAYING' ? 'bar active' : 'bar'} />
                    <span className={playbackState === 'PLAYING' ? 'bar active' : 'bar'} />
                    <span className={playbackState === 'PLAYING' ? 'bar active' : 'bar'} />
                    <span className={playbackState === 'PLAYING' ? 'bar active' : 'bar'} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {preparedTrack.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#FFB100' }}>
                    Pista de Audio ({preparedTrack.extension?.toUpperCase()})
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background:
                  'radial-gradient(ellipse at 25% 0%, rgba(41, 199, 255, 0.22) 0%, transparent 55%), ' +
                  'radial-gradient(ellipse at 75% 0%, rgba(59, 130, 246, 0.22) 0%, transparent 55%), ' +
                  'linear-gradient(180deg, #0b101b 0%, #06080d 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                textAlign: 'center',
                padding: '16px',
              }}
            >
              <Music size={36} color="#60a5fa" style={{ filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.6))' }} />
              <span style={{ fontWeight: 600, color: '#cbd5e1', fontSize: '13px' }}>
                Monitor de Reproducción
              </span>
            </div>
          )}
        </div>

        {/* Metadatos compactos cuando hay pista cargada */}
        {preparedTrack && (
          <div
            style={{
              backgroundColor: '#131924',
              border: '1px solid #232b3a',
              borderRadius: '6px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {preparedTrack.title} — <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{preparedTrack.artist}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <User size={11} color="#FFB100" />
                <span>{preparedTrack.singerName}</span>
              </div>
            </div>

            {preparedTrack.keyShift !== 0 && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  backgroundColor: 'rgba(255, 177, 0, 0.14)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#FFB100',
                }}
              >
                <Music2 size={10} />
                {preparedTrack.keyShift > 0 ? `+${preparedTrack.keyShift}` : preparedTrack.keyShift} st
              </span>
            )}
          </div>
        )}

        {/* Barra de Progreso y Tiempo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              minWidth: '32px',
            }}
          >
            {formatTime(currentTimeMs)}
          </span>

          <input
            type="range"
            min={0}
            max={durationMs || 100}
            value={currentTimeMs}
            disabled={!preparedTrack}
            onMouseDown={() => setIsSeeking(true)}
            onChange={(e) => {
              const val = Number(e.target.value);
              setCurrentTimeMs(val);
            }}
            onMouseUp={(e) => {
              setIsSeeking(false);
              handleSeek(Number((e.target as HTMLInputElement).value));
            }}
            style={{
              flex: 1,
              cursor: preparedTrack ? 'pointer' : 'not-allowed',
              accentColor: '#FFB100',
            }}
          />

          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}
          >
            -{formatTime(Math.max(0, durationMs - currentTimeMs))} / {formatTime(durationMs)}
          </span>
        </div>

        {/* Botonera de Transporte Completo (Estilo Pro Studio DJ) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <button
            className="btn btn-icon"
            onClick={handleRestartTrack}
            disabled={!preparedTrack}
            title="Repetir / Reiniciar pista desde 0:00"
            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px', backgroundColor: '#171e2c' }}
          >
            <SkipBack size={15} />
          </button>

          <button
            className="btn btn-icon"
            onClick={() => handleSeek(currentTimeMs - 5000)}
            disabled={!preparedTrack}
            title="Retroceder 5 segundos (Flecha Izq)"
            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px', backgroundColor: '#171e2c' }}
          >
            <RotateCcw size={15} />
          </button>

          <button
            className="btn btn-primary"
            onClick={handleTogglePlay}
            title={playbackState === 'PLAYING' ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
            style={{
              height: '36px',
              minHeight: '36px',
              padding: '0 20px',
              fontSize: '13px',
              fontWeight: 800,
              gap: '6px',
              backgroundColor: '#FFB100',
              borderColor: '#FFB100',
              color: '#0C1017',
              boxShadow: '0 2px 10px rgba(255, 177, 0, 0.3)',
            }}
          >
            {playbackState === 'PLAYING' ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
            {playbackState === 'PLAYING' ? 'Pausar' : 'Reproducir'}
          </button>

          <button
            className="btn btn-icon"
            onClick={() => handleSeek(currentTimeMs + 5000)}
            disabled={!preparedTrack}
            title="Avanzar 5 segundos (Flecha Der)"
            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px', backgroundColor: '#171e2c' }}
          >
            <RotateCw size={15} />
          </button>

          {onSkipTrack && (
            <button
              className="btn btn-icon"
              onClick={onSkipTrack}
              title="Saltar a la siguiente canción de la cola"
              style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px', backgroundColor: '#171e2c' }}
            >
              <SkipForward size={15} />
            </button>
          )}

          <button
            className="btn btn-icon"
            onClick={handleStop}
            disabled={!preparedTrack || playbackState === 'IDLE'}
            title="Detener pista"
            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px', backgroundColor: '#171e2c' }}
          >
            <Square size={15} />
          </button>
        </div>

        {/* Apartado de Música de Ambiente (Solo MP3) en la pantalla principal */}
        <AmbientMusicPanel
          isKaraokeActive={playbackState === 'PLAYING'}
          isApplauseActive={isApplauseActive}
          ambientVolume={ambientVolume}
          masterVolume={masterVolume}
          ambientMuted={ambientMuted}
          masterMuted={masterMuted}
          crossfadeEnabled={crossfadeEnabled}
          crossfadeDurationSec={crossfadeDurationSec}
          refreshTrigger={catalogRefreshTrigger}
          onChangeAmbientVolume={onChangeAmbientVolume}
          onToggleAmbientMute={onToggleAmbientMute}
          onCrossfadeStateChange={onCrossfadeStateChange}
          onNotification={onNotification}
          emergencyStopSignal={emergencyStopSignal}
        />
      </div>
    </section>
  );
};
