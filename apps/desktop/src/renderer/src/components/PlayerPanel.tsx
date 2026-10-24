import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  AlertOctagon,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Music2,
  User,
  Film,
  Headphones,
} from 'lucide-react';
import {
  QueueItemDTO,
  PlaybackSnapshotDTO,
  PlaybackStatus,
} from '@karaoke/contracts';
import { PlayerPrepareResult } from '../../../preload/types.js';

interface PlayerPanelProps {
  queue: QueueItemDTO[];
  onRefreshQueue: () => Promise<void>;
  onNotification: (msg: string) => void;
  preparedTrack: PlayerPrepareResult | null;
  onSetPreparedTrack: (track: PlayerPrepareResult | null) => void;
  onSkipTrack?: () => Promise<void>;
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
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackStatus>('IDLE');
  const playbackStateRef = useRef<PlaybackStatus>('IDLE');
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const lastReportedTimeRef = useRef<number>(0);

  const updatePlaybackStateLocal = (nextState: PlaybackStatus) => {
    playbackStateRef.current = nextState;
    setPlaybackState(nextState);
  };

  // Sincronizar estado inicial y suscribirse a eventos globales del reproductor
  useEffect(() => {
    const fetchInitialState = async () => {
      if (!window.karaokeAPI) return;
      const res = await window.karaokeAPI.getPlayerState();
      if (res.success && res.data) {
        updatePlaybackStateLocal(res.data.state);
        setVolume(res.data.volume);
        if (res.data.durationMs) {
          setDurationMs(res.data.durationMs);
        }
      }
    };
    fetchInitialState();

    const unsubscribe = window.karaokeAPI.onPlayerStateChanged((snapshot: PlaybackSnapshotDTO) => {
      updatePlaybackStateLocal(snapshot.state);
      setVolume(snapshot.volume);
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
    };
  }, []);

  // Cuando cambia la pista cargada, reiniciar posición sin sobrescribir un estado PLAYING recién emitido
  useEffect(() => {
    if (preparedTrack) {
      setDurationMs(preparedTrack.durationMs || 0);
      setCurrentTimeMs(0);
      if (playbackStateRef.current !== 'PLAYING') {
        updatePlaybackStateLocal(preparedTrack.snapshot?.state || 'READY');
      }
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.load();
      }
    } else {
      setCurrentTimeMs(0);
      setDurationMs(0);
    }
  }, [preparedTrack?.mediaUrl, preparedTrack?.queueItemId]);

  // Sincronizar volumen y silencio de cabina de forma independiente (sin reiniciar vídeo)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [isMuted, volume]);

  // Asegurar que si el estado pasa a PLAYING cuando ya hay pista, el elemento <video> reproduzca
  useEffect(() => {
    if (preparedTrack && playbackState === 'PLAYING' && videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {
        // Se reintentará en onCanPlay cuando termine de cargar el buffer inicial
      });
    }
  }, [preparedTrack, playbackState]);

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
          onNotification(prepRes.error.message);
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
          onNotification('Error al iniciar vídeo. Verifica el archivo multimedia.');
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
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setCurrentTimeMs(0);
    updatePlaybackStateLocal('STOPPED');
    await window.karaokeAPI.sendPlayerCommand({ command: 'STOP' });
    onNotification('Reproducción detenida.');
    await onRefreshQueue();
  }, [onNotification, onRefreshQueue]);

  const handleEmergencyStop = useCallback(async () => {
    if (!window.karaokeAPI) return;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setCurrentTimeMs(0);
    updatePlaybackStateLocal('STOPPED');
    await window.karaokeAPI.emergencyStop();
    onNotification('¡PARADA DE EMERGENCIA ACTIVADA! Vídeo y audio cortados.');
    await onRefreshQueue();
  }, [onNotification, onRefreshQueue]);

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

  const handleVolumeChange = useCallback(
    async (newVol: number) => {
      if (!window.karaokeAPI) return;
      const clamped = Math.max(0, Math.min(100, newVol));
      setVolume(clamped);
      if (videoRef.current) {
        videoRef.current.volume = isMuted ? 0 : clamped / 100;
      }
      await window.karaokeAPI.sendPlayerCommand({ command: 'SET_VOLUME', volume: clamped });
    },
    [isMuted],
  );

  const handleToggleMute = useCallback(() => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (videoRef.current) {
      videoRef.current.volume = nextMute ? 0 : volume / 100;
    }
  }, [isMuted, volume]);

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
      videoRef.current.volume = isMuted ? 0 : volume / 100;
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
      videoRef.current.volume = isMuted ? 0 : volume / 100;
      if (playbackStateRef.current === 'PLAYING' && videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      }
    }
  };

  /**
   * INNEGOCIABLE: La finalización solo se procesa mediante el evento nativo 'ended' del elemento <video>.
   * Queda terminantemente prohibido simular eventos con temporizadores artificiales.
   */
  const handleNativeEnded = async () => {
    if (!preparedTrack || !window.karaokeAPI) return;
    console.log(`[Reproductor] Evento nativo 'ended' detectado para pista: ${preparedTrack.title}`);

    await window.karaokeAPI.reportPlayerEnded(preparedTrack.queueItemId);
    onNotification(`Actuación finalizada: ${preparedTrack.title} (${preparedTrack.singerName})`);
    onSetPreparedTrack(null);
    setCurrentTimeMs(0);
    updatePlaybackStateLocal('ENDED');
    await onRefreshQueue();
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('[Reproductor] Error en elemento de video HTML5:', e);
    onNotification('Error al decodificar el flujo multimedia local. Comprueba el códec del archivo.');
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
          <Film size={18} color="var(--accent-warm)" />
          Monitor de Reproducción
        </span>

        <span
          className="pill"
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            backgroundColor:
              playbackState === 'PLAYING'
                ? 'var(--status-ready)'
                : playbackState === 'PAUSED'
                  ? 'var(--accent-warm)'
                  : playbackState === 'READY'
                    ? '#38bdf8'
                    : 'var(--bg-surface-hover)',
            color:
              playbackState === 'PLAYING' || playbackState === 'PAUSED' || playbackState === 'READY'
                ? '#18181b'
                : 'var(--text-secondary)',
          }}
        >
          {playbackState === 'PLAYING'
            ? '● EN DIRECTO'
            : playbackState === 'PAUSED'
              ? '⏸ PAUSADO'
              : playbackState === 'READY'
                ? 'LISTO'
                : 'EN ESPERA'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', overflowY: 'auto', flex: 1 }}>
        {/* Vista previa de vídeo 16:9 */}
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            minHeight: '190px',
            maxHeight: '240px',
            backgroundColor: '#000000',
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: playbackState === 'PLAYING' ? '1px solid var(--status-ready)' : '1px solid var(--border-strong)',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.45)',
          }}
        >
          {preparedTrack ? (
            <>
              <video
                ref={videoRef}
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
                    gap: '10px',
                    background: 'radial-gradient(circle, rgba(32,32,38,0.92) 0%, rgba(10,10,14,0.98) 100%)',
                    padding: '16px',
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
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                    {preparedTrack.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--accent-warm)' }}>
                    Pista de Audio ({preparedTrack.extension?.toUpperCase()})
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-muted)',
                fontSize: '13px',
                textAlign: 'center',
                padding: '16px',
              }}
            >
              <Film size={32} style={{ opacity: 0.4 }} />
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                Monitor listo para reproducir
              </span>
              <span style={{ fontSize: '12px' }}>
                Pulsa el botón <strong>Play</strong> en cualquier canción del Catálogo o de la Cola.
              </span>
            </div>
          )}

          {/* Badge flotante de atajo de emergencia */}
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(0,0,0,0.75)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              pointerEvents: 'none',
            }}
          >
            Espacio: Play/Pausa • Esc: Parada
          </div>
        </div>

        {/* Metadatos de la Pista Actual */}
        {preparedTrack ? (
          <div
            style={{
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ minWidth: 0 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {preparedTrack.title}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {preparedTrack.artist}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--accent-warm)',
                  border: '1px solid var(--border-subtle)',
                  whiteSpace: 'nowrap',
                }}
                title="Ajuste de semitonos"
              >
                <Music2 size={12} />
                <span>
                  {preparedTrack.keyShift > 0 ? `+${preparedTrack.keyShift}` : preparedTrack.keyShift} st
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <User size={13} color="var(--accent-warm)" />
                <strong style={{ color: 'var(--text-secondary)' }}>Intérprete:</strong> {preparedTrack.singerName}
              </span>
              {preparedTrack.extension && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', textTransform: 'uppercase' }}>
                  {preparedTrack.extension.replace('.', '')}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px dashed var(--border-subtle)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            Sin pista cargada actualmente.
          </div>
        )}

        {/* Barra de Progreso y Tiempo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>{formatTime(currentTimeMs)}</span>
            <span>-{formatTime(Math.max(0, durationMs - currentTimeMs))} / {formatTime(durationMs)}</span>
          </div>

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
              width: '100%',
              cursor: preparedTrack ? 'pointer' : 'not-allowed',
              accentColor: 'var(--accent-warm)',
            }}
          />
        </div>

        {/* Botonera de Transporte Completo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <button
            className="btn btn-icon"
            onClick={handleRestartTrack}
            disabled={!preparedTrack}
            title="Repetir / Reiniciar pista desde 0:00"
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
          >
            <SkipBack size={16} />
          </button>

          <button
            className="btn btn-icon"
            onClick={() => handleSeek(currentTimeMs - 5000)}
            disabled={!preparedTrack}
            title="Retroceder 5 segundos (Flecha Izq)"
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
          >
            <RotateCcw size={16} />
          </button>

          <button
            className="btn btn-primary"
            onClick={handleTogglePlay}
            title={playbackState === 'PLAYING' ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
            style={{
              height: '42px',
              minHeight: '42px',
              padding: '0 20px',
              fontSize: '14px',
              fontWeight: 700,
              gap: '6px',
            }}
          >
            {playbackState === 'PLAYING' ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
            {playbackState === 'PLAYING' ? 'Pausar' : 'Reproducir'}
          </button>

          <button
            className="btn btn-icon"
            onClick={() => handleSeek(currentTimeMs + 5000)}
            disabled={!preparedTrack}
            title="Avanzar 5 segundos (Flecha Der)"
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
          >
            <RotateCw size={16} />
          </button>

          {onSkipTrack && (
            <button
              className="btn btn-icon"
              onClick={onSkipTrack}
              title="Saltar a la siguiente canción de la cola"
              style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
            >
              <SkipForward size={16} />
            </button>
          )}

          <button
            className="btn btn-icon"
            onClick={handleStop}
            disabled={!preparedTrack || playbackState === 'IDLE'}
            title="Detener pista"
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
          >
            <Square size={16} />
          </button>
        </div>

        {/* Control de Volumen Sala y Audio de Cabina */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: 'var(--bg-surface-raised)',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Volume2 size={14} color="var(--accent-warm)" />
              Volumen General ({volume}%)
            </span>

            <button
              type="button"
              className="btn"
              onClick={handleToggleMute}
              title="Silenciar únicamente el audio de esta ventana de cabina sin afectar la Pantalla Pública"
              style={{
                height: '26px',
                minHeight: '26px',
                padding: '0 8px',
                fontSize: '11px',
                gap: '4px',
                backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface)',
                color: isMuted ? 'var(--status-error)' : 'var(--text-secondary)',
                borderColor: isMuted ? 'var(--status-error)' : 'var(--border-subtle)',
              }}
            >
              {isMuted ? <VolumeX size={12} /> : <Headphones size={12} />}
              {isMuted ? 'Cabina Silenciada' : 'Audio Cabina: Activo'}
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            style={{
              width: '100%',
              cursor: 'pointer',
              accentColor: 'var(--accent-warm)',
            }}
          />
        </div>

        {/* Botón de Parada de Emergencia Permanente */}
        <button
          className="btn btn-emergency"
          onClick={handleEmergencyStop}
          title="Parada inmediata de sonido y vídeo (Esc / F12)"
          style={{
            width: '100%',
            height: '40px',
            minHeight: '40px',
            fontSize: '13px',
            fontWeight: 800,
            gap: '8px',
            marginTop: 'auto',
          }}
        >
          <AlertOctagon size={17} />
          PARADA DE EMERGENCIA (ESC)
        </button>
      </div>
    </section>
  );
};
