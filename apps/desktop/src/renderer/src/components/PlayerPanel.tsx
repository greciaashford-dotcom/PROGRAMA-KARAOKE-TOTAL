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
  Music2,
  User,
  Film,
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
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  queue,
  onRefreshQueue,
  onNotification,
  preparedTrack,
  onSetPreparedTrack,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackStatus>('IDLE');
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const lastReportedTimeRef = useRef<number>(0);

  // Sincronizar estado inicial desde el proceso principal
  useEffect(() => {
    const fetchInitialState = async () => {
      if (!window.karaokeAPI) return;
      const res = await window.karaokeAPI.getPlayerState();
      if (res.success && res.data) {
        setPlaybackState(res.data.state);
        setVolume(res.data.volume);
        if (res.data.durationMs) {
          setDurationMs(res.data.durationMs);
        }
      }
    };
    fetchInitialState();

    // Escuchar eventos globales del reproductor
    const unsubscribe = window.karaokeAPI.onPlayerStateChanged((snapshot: PlaybackSnapshotDTO) => {
      setPlaybackState(snapshot.state);
      setVolume(snapshot.volume);
      if (snapshot.durationMs) {
        setDurationMs(snapshot.durationMs);
      }

      if (videoRef.current) {
        if (snapshot.state === 'PLAYING' && videoRef.current.paused) {
          videoRef.current.play().catch((err) => {
            console.warn('[Reproductor] Autoplay bloqueado por el navegador:', err);
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

  // Sincronizar duración y volumen cuando se prepara una nueva pista
  useEffect(() => {
    if (preparedTrack) {
      setDurationMs(preparedTrack.durationMs);
      setCurrentTimeMs(0);
      setPlaybackState('READY');
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.volume = isMuted ? 0 : volume / 100;
      }
    }
  }, [preparedTrack, isMuted, volume]);

  // Manejo de Comandos
  const handleTogglePlay = useCallback(async () => {
    if (!preparedTrack) {
      // Si no hay pista cargada, intentar preparar la primera canción en cola (READY o QUEUED)
      const nextSong = queue.find(
        (i) => !['COMPLETED', 'CANCELLED', 'SKIPPED'].includes(i.status),
      );
      if (nextSong && window.karaokeAPI) {
        const prepRes = await window.karaokeAPI.preparePlayer({
          sessionId: nextSong.sessionId,
          queueItemId: nextSong.id,
        });
        if (prepRes.success) {
          onSetPreparedTrack(prepRes.data);
          onNotification(`Pista cargada: ${prepRes.data.title}`);
          await window.karaokeAPI.sendPlayerCommand({ command: 'PLAY' });
          if (videoRef.current) {
            videoRef.current.play().catch(console.error);
          }
          await onRefreshQueue();
        }
      } else {
        onNotification('No hay canciones disponibles en la cola para reproducir.');
      }
      return;
    }

    if (playbackState === 'PLAYING') {
      if (videoRef.current) videoRef.current.pause();
      await window.karaokeAPI.sendPlayerCommand({ command: 'PAUSE' });
      onNotification('Reproducción pausada.');
    } else {
      if (videoRef.current) {
        videoRef.current.play().catch((err) => {
          console.error('[Reproductor] Error al iniciar video:', err);
          onNotification('Error al iniciar vídeo. Verifica códec y formato.');
        });
      }
      await window.karaokeAPI.sendPlayerCommand({ command: 'PLAY' });
      onNotification(`En directo: ${preparedTrack.title}`);
    }
    await onRefreshQueue();
  }, [preparedTrack, playbackState, queue, onSetPreparedTrack, onNotification, onRefreshQueue]);

  const handleStop = useCallback(async () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setCurrentTimeMs(0);
    await window.karaokeAPI.sendPlayerCommand({ command: 'STOP' });
    onNotification('Reproducción detenida.');
    await onRefreshQueue();
  }, [onNotification, onRefreshQueue]);

  const handleEmergencyStop = useCallback(async () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setCurrentTimeMs(0);
    await window.karaokeAPI.emergencyStop();
    onNotification('¡PARADA DE EMERGENCIA ACTIVADA! Vídeo y audio cortados.');
    await onRefreshQueue();
  }, [onNotification, onRefreshQueue]);

  const handleSeek = useCallback(async (newTimeMs: number) => {
    const clampedMs = Math.max(0, Math.min(durationMs, newTimeMs));
    setCurrentTimeMs(clampedMs);
    if (videoRef.current) {
      videoRef.current.currentTime = clampedMs / 1000;
    }
    await window.karaokeAPI.sendPlayerCommand({ command: 'SEEK', positionMs: clampedMs });
  }, [durationMs]);

  const handleVolumeChange = useCallback(async (newVol: number) => {
    const clamped = Math.max(0, Math.min(100, newVol));
    setVolume(clamped);
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : clamped / 100;
    }
    await window.karaokeAPI.sendPlayerCommand({ command: 'SET_VOLUME', volume: clamped });
  }, [isMuted]);

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

    // Notificar al backend de forma dosificada (cada 1s) para persistencia sin saturar SQLite
    if (Math.abs(currentMs - lastReportedTimeRef.current) > 1000) {
      lastReportedTimeRef.current = currentMs;
      window.karaokeAPI.updatePlayerProgress(currentMs, durationMs).catch(() => {});
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      const durMs = Math.round(videoRef.current.duration * 1000);
      setDurationMs(durMs);
    }
  };

  /**
   * INNEGOCIABLE: La finalización solo se procesa mediante el evento nativo 'ended' del elemento <video>.
   * Queda terminantemente prohibido simular eventos con temporizadores artificiales.
   */
  const handleNativeEnded = async () => {
    if (!preparedTrack) return;
    console.log(`[Reproductor] Evento nativo 'ended' detectado para pista: ${preparedTrack.title}`);

    await window.karaokeAPI.reportPlayerEnded(preparedTrack.queueItemId);
    onNotification(`Actuación finalizada: ${preparedTrack.title} (${preparedTrack.singerName})`);
    onSetPreparedTrack(null);
    setCurrentTimeMs(0);
    await onRefreshQueue();
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('[Reproductor] Error en elemento de video HTML5:', e);
    onNotification('Error de reproducción en el archivo multimedia local.');
  };

  // Atajos de teclado para el operador en directo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el foco está en un campo de texto o modal
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

  // Formato de tiempo mm:ss
  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <section className="panel" aria-label="Reproductor y control en directo" style={{ flex: '1 1 360px' }}>
      <div className="panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Film size={18} color="var(--accent-blue)" />
          Reproductor y Directo
        </span>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor:
              playbackState === 'PLAYING'
                ? 'var(--status-ready)'
                : playbackState === 'PAUSED'
                  ? 'var(--accent-warm)'
                  : 'var(--bg-surface-hover)',
            color: playbackState === 'PLAYING' || playbackState === 'PAUSED' ? '#18181b' : 'var(--text-secondary)',
          }}
        >
          {playbackState === 'PLAYING'
            ? 'EN DIRECTO'
            : playbackState === 'PAUSED'
              ? 'PAUSADO'
              : playbackState === 'READY'
                ? 'PREPARADO'
                : 'EN ESPERA'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Vista previa de vídeo con proporción 16:9 */}
        <div
          style={{
            width: '100%',
            height: '200px',
            backgroundColor: '#000000',
            borderRadius: '6px',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {preparedTrack ? (
            <video
              ref={videoRef}
              src={preparedTrack.mediaUrl}
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleNativeEnded}
              onError={handleVideoError}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
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
              <span>Sin pista cargada en el reproductor.</span>
              <span style={{ fontSize: '11px' }}>Selecciona una canción de la cola para prepararla.</span>
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
              borderRadius: '3px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            Esc / F12: Parada
          </div>
        </div>

        {/* Metadatos de la Pista Actual */}
        {preparedTrack ? (
          <div
            style={{
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {preparedTrack.title}
                </h3>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {preparedTrack.artist}
                </div>
              </div>

              {/* Tono / Key Shift */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--accent-warm)',
                  border: '1px solid var(--border-subtle)',
                }}
                title="Ajuste de semitonos"
              >
                <Music2 size={13} />
                <span>
                  {preparedTrack.keyShift > 0 ? `+${preparedTrack.keyShift}` : preparedTrack.keyShift} semitonos
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={13} color="var(--accent-blue)" />
                <strong style={{ color: 'var(--text-secondary)' }}>Cantante:</strong> {preparedTrack.singerName}
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px dashed var(--border-subtle)',
              fontSize: '13px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            Esperando orden de salida de la cola...
          </div>
        )}

        {/* Barra de Progreso y Tiempo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            <span>{formatTime(currentTimeMs)}</span>
            <span>{formatTime(durationMs)}</span>
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
              accentColor: 'var(--accent-blue)',
            }}
          />
        </div>

        {/* Botonera de Control de Reproducción */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <button
            className="btn btn-icon"
            onClick={() => handleSeek(currentTimeMs - 5000)}
            disabled={!preparedTrack}
            title="Retroceder 5 segundos (Flecha Izq)"
            style={{ width: '38px', height: '38px' }}
          >
            <RotateCcw size={18} />
          </button>

          <button
            className="btn btn-primary"
            onClick={handleTogglePlay}
            title={playbackState === 'PLAYING' ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
            style={{
              height: '46px',
              padding: '0 24px',
              fontSize: '15px',
              fontWeight: 700,
              gap: '8px',
            }}
          >
            {playbackState === 'PLAYING' ? <Pause size={20} /> : <Play size={20} />}
            {playbackState === 'PLAYING' ? 'Pausar' : 'Reproducir'}
          </button>

          <button
            className="btn btn-icon"
            onClick={() => handleSeek(currentTimeMs + 5000)}
            disabled={!preparedTrack}
            title="Avanzar 5 segundos (Flecha Der)"
            style={{ width: '38px', height: '38px' }}
          >
            <RotateCw size={18} />
          </button>

          <button
            className="btn btn-icon"
            onClick={handleStop}
            disabled={!preparedTrack || playbackState === 'IDLE'}
            title="Detener pista"
            style={{ width: '38px', height: '38px' }}
          >
            <Square size={18} />
          </button>
        </div>

        {/* Control de Volumen y Silencio */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--bg-surface-raised)',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            className="btn btn-icon"
            onClick={handleToggleMute}
            title={isMuted ? 'Activar sonido' : 'Silenciar'}
            style={{ width: '32px', height: '32px' }}
          >
            {isMuted || volume === 0 ? <VolumeX size={16} color="var(--status-error)" /> : <Volume2 size={16} />}
          </button>

          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            style={{
              flex: 1,
              cursor: 'pointer',
              accentColor: 'var(--accent-blue)',
            }}
          />

          <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '32px', textAlign: 'right' }}>
            {isMuted ? '0%' : `${volume}%`}
          </span>
        </div>

        {/* Botón de Parada de Emergencia Permanente */}
        <button
          className="btn btn-emergency"
          onClick={handleEmergencyStop}
          title="Parada inmediata de sonido y vídeo (Esc / F12)"
          style={{
            width: '100%',
            height: '42px',
            fontSize: '14px',
            fontWeight: 800,
            gap: '8px',
          }}
        >
          <AlertOctagon size={18} />
          PARADA DE EMERGENCIA
        </button>
      </div>
    </section>
  );
};
