import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  MessageSquare,
  Volume2,
  VolumeX,
  BookmarkCheck,
  Bookmark,
  RotateCcw,
  Rocket,
  Sparkles,
  Minus,
  Plus,
} from 'lucide-react';
import { PlaybackSnapshotDTO, PlaybackStatus, QueueItemDTO } from '@karaoke/contracts';
import { PlayerPrepareResult, PublicOverlayStateDTO } from '../../../preload/types.js';
import { audioMixerEngine } from '../utils/audio-mixer-engine.js';
import { cleanDisplayTitle, formatTimeMMSS, formatCountdownMMSS } from '../utils/title-cleaner.js';
import { Btn09 } from './ui/button-hover.js';

export interface CenterMonitorColumnProps {
  preparedTrack: PlayerPrepareResult | null;
  playbackState: PlaybackStatus;
  stopSignal: number;
  onPlaybackStateChange: (state: PlaybackStatus) => void;
  onNativeTrackEnded: (finishedTrack: PlayerPrepareResult) => Promise<void>;
  onLaunchNextOrPlay: () => Promise<void>;
  onTogglePlayPause: () => Promise<void>;
  onStopKaraoke: () => Promise<void>;
  onOpenQuickMessage: () => void;
  karaokeVolume: number;
  masterVolume: number;
  karaokeMuted: boolean;
  masterMuted: boolean;
  isVolumeMemorized: boolean;
  memorizedVolumeValue: number | null;
  pitchSemitones: number;
  playbackSpeed: number;
  isApplauseActive: boolean;
  publicOverlay: PublicOverlayStateDTO;
  nextQueuedItem: QueueItemDTO | null;
  onChangeKaraokeVolume: (vol: number) => void;
  onToggleKaraokeMute: () => void;
  onMemorizeCurrentVolume: () => Promise<void>;
  onChangePitch: (semitones: number) => void;
  onChangeSpeed: (speed: number) => void;
  onNotification: (msg: string, type?: 'info' | 'error') => void;
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

export const CenterMonitorColumn: React.FC<CenterMonitorColumnProps> = ({
  preparedTrack,
  playbackState,
  stopSignal,
  onPlaybackStateChange,
  onNativeTrackEnded,
  onLaunchNextOrPlay,
  onTogglePlayPause,
  onStopKaraoke,
  onOpenQuickMessage,
  karaokeVolume,
  masterVolume,
  karaokeMuted,
  masterMuted,
  isVolumeMemorized,
  memorizedVolumeValue,
  pitchSemitones,
  playbackSpeed,
  isApplauseActive,
  publicOverlay,
  nextQueuedItem,
  onChangeKaraokeVolume,
  onToggleKaraokeMute,
  onMemorizeCurrentVolume,
  onChangePitch,
  onChangeSpeed,
  onNotification,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackStateRef = useRef<PlaybackStatus>(playbackState);
  const lastReportedTimeRef = useRef<number>(0);

  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  const getEffectiveVolume = useCallback(() => {
    if (karaokeMuted || masterMuted) return 0;
    return Math.max(0, Math.min(1, (karaokeVolume / 100) * (masterVolume / 100)));
  }, [karaokeMuted, masterMuted, karaokeVolume, masterVolume]);

  // Escuchar eventos globales de estado de reproducción (ej. STOP, PAUSE, PLAY, SEEK)
  useEffect(() => {
    if (!window.karaokeAPI) return;
    const unsub = window.karaokeAPI.onPlayerStateChanged((snapshot: PlaybackSnapshotDTO) => {
      onPlaybackStateChange(snapshot.state);
      if (snapshot.durationMs) {
        setDurationMs(snapshot.durationMs);
      }
      if (videoRef.current) {
        if (snapshot.state === 'PLAYING' && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        } else if (snapshot.state === 'PAUSED' && !videoRef.current.paused) {
          videoRef.current.pause();
        } else if (snapshot.state === 'STOPPED' || snapshot.state === 'IDLE' || snapshot.state === 'ENDED') {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
          setCurrentTimeMs(0);
        }
      }
    });
    return unsub;
  }, [onPlaybackStateChange]);

  // Parada física inmediata del elemento <video> (garantiza que JAMÁS siga sonando tras pulsar Stop/Emergencia)
  useEffect(() => {
    if (stopSignal > 0 && videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch {
        // Ignorar
      }
      setCurrentTimeMs(0);
      setDurationMs(0);
    }
  }, [stopSignal]);

  // Cargar nueva pista en el monitor
  useEffect(() => {
    if (preparedTrack) {
      setDurationMs(preparedTrack.durationMs || 0);
      setCurrentTimeMs(0);
      if (videoRef.current) {
        audioMixerEngine.registerKaraokeElement(videoRef.current);
        videoRef.current.currentTime = 0;
      }
    } else {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      setCurrentTimeMs(0);
      setDurationMs(0);
    }
  }, [preparedTrack?.mediaUrl, preparedTrack?.queueItemId]);

  // Aplicar volumen, pitch y velocidad en tiempo real (audio limpio y directo, SIN crossfade)
  useEffect(() => {
    const eff = getEffectiveVolume();
    if (videoRef.current) {
      videoRef.current.volume = eff;
    }
    window.karaokeAPI
      ?.sendPlayerCommand({ command: 'SET_VOLUME', volume: Math.round(eff * 100) })
      .catch(() => {});
  }, [getEffectiveVolume]);

  useEffect(() => {
    audioMixerEngine.setKaraokePitchSemitones(pitchSemitones);
  }, [pitchSemitones]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      // Preservar el pitch nativo al cambiar velocidad para que Tono y Velocidad sean 100% independientes
      (videoRef.current as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch = true;
    }
  }, [playbackSpeed, preparedTrack?.mediaUrl]);

  // Arrancar reproducción cuando pasa a PLAYING
  useEffect(() => {
    if (preparedTrack && playbackState === 'PLAYING' && videoRef.current && videoRef.current.paused) {
      videoRef.current.volume = getEffectiveVolume();
      videoRef.current.play().catch(() => {});
    }
  }, [preparedTrack, playbackState, getEffectiveVolume]);

  const handleSeek = useCallback(
    async (newMs: number) => {
      if (!window.karaokeAPI) return;
      const maxDur = durationMs || (videoRef.current ? videoRef.current.duration * 1000 : 0) || 100000;
      const clamped = Math.max(0, Math.min(maxDur, newMs));
      setCurrentTimeMs(clamped);
      if (videoRef.current) {
        videoRef.current.currentTime = clamped / 1000;
      }
      await window.karaokeAPI.sendPlayerCommand({ command: 'SEEK', positionMs: clamped });
    },
    [durationMs],
  );

  // Atajos de flechas para avanzar/retroceder 5s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'ArrowLeft' && preparedTrack) {
        e.preventDefault();
        handleSeek(currentTimeMs - 5000);
      } else if (e.code === 'ArrowRight' && preparedTrack) {
        e.preventDefault();
        handleSeek(currentTimeMs + 5000);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSeek, currentTimeMs, preparedTrack]);

  const isVideoVisible =
    !!preparedTrack && (playbackState === 'PLAYING' || playbackState === 'PAUSED');
  const isAudioOnly =
    preparedTrack?.extension && AUDIO_ONLY_EXTENSIONS.has(preparedTrack.extension.toLowerCase());

  const cleanActiveTitle = cleanDisplayTitle(preparedTrack?.title);
  const bgUrl = publicOverlay.hasCustomBackground
    ? `karaoke-media://background?v=${publicOverlay.backgroundVersion}`
    : './assets/fondo_katakana.png';

  const previewSinger =
    publicOverlay.singerName ||
    nextQueuedItem?.singer?.displayName ||
    null;
  const previewTitle = cleanDisplayTitle(
    publicOverlay.songTitle || nextQueuedItem?.song?.title || '',
  );

  return (
    <section className="katakana-panel" aria-label="Monitor de Karaoke y Controles">
      {/* Cabecera Protagonista */}
      <div
        className="katakana-panel-header"
        style={{
          backgroundColor: 'var(--ink-piano)',
          color: '#f6efe0',
          borderBottom: '2px solid var(--accent-surf)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 900,
              color: '#f6efe0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {preparedTrack ? cleanActiveTitle : 'MONITOR DE KARAOKE'}
          </span>
          {preparedTrack && (
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-surf)' }}>
              Cantante: {preparedTrack.singerName}
            </span>
          )}
        </div>

        <span
          className="pill"
          style={{
            backgroundColor:
              playbackState === 'PLAYING'
                ? 'var(--accent-surf)'
                : playbackState === 'PAUSED'
                  ? '#f59e0b'
                  : '#2e2e2e',
            color: playbackState === 'PLAYING' || playbackState === 'PAUSED' ? '#151515' : '#f6efe0',
            fontSize: '13px',
            padding: '4px 10px',
          }}
        >
          {playbackState === 'PLAYING'
            ? 'EN DIRECTO'
            : playbackState === 'PAUSED'
              ? 'PAUSADO'
              : isApplauseActive
                ? 'APLAUSOS'
                : 'EN ESPERA'}
        </span>
      </div>

      {/* Cuerpo central */}
      <div className="katakana-panel-body" style={{ padding: '10px', gap: '8px' }}>
        {/* Monitor de Vídeo Grande (Espejo en vivo de la Pantalla Pública) */}
        <div
          style={{
            width: '100%',
            flex: '1 1 220px',
            minHeight: '175px',
            backgroundColor: '#151515',
            borderRadius: '10px',
            border: '3px solid var(--ink-piano)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Elemento <video> principal (Única fuente de audio de Karaoke -> cero eco) */}
          {preparedTrack && (
            <video
              ref={videoRef}
              crossOrigin="anonymous"
              src={preparedTrack.mediaUrl}
              playsInline
              onTimeUpdate={() => {
                if (!videoRef.current || isSeeking) return;
                const ms = Math.round(videoRef.current.currentTime * 1000);
                setCurrentTimeMs(ms);
                if (Math.abs(ms - lastReportedTimeRef.current) > 1000) {
                  lastReportedTimeRef.current = ms;
                  window.karaokeAPI?.updatePlayerProgress(ms, durationMs).catch(() => {});
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  audioMixerEngine.registerKaraokeElement(videoRef.current);
                  videoRef.current.volume = getEffectiveVolume();
                  videoRef.current.playbackRate = playbackSpeed;
                  (videoRef.current as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch =
                    true;
                  if (Number.isFinite(videoRef.current.duration)) {
                    const durMs = Math.round(videoRef.current.duration * 1000);
                    setDurationMs(durMs);
                    window.karaokeAPI?.updatePlayerProgress(0, durMs).catch(() => {});
                  }
                  if (playbackStateRef.current === 'PLAYING' && videoRef.current.paused) {
                    videoRef.current.play().catch(() => {});
                  }
                }
              }}
              onCanPlay={() => {
                if (videoRef.current) {
                  audioMixerEngine.registerKaraokeElement(videoRef.current);
                  videoRef.current.volume = getEffectiveVolume();
                  if (playbackStateRef.current === 'PLAYING' && videoRef.current.paused) {
                    videoRef.current.play().catch(() => {});
                  }
                }
              }}
              onEnded={() => {
                if (preparedTrack) {
                  onNativeTrackEnded(preparedTrack);
                }
              }}
              onError={() => {
                onNotification(
                  'No se pudo decodificar este archivo. Si es .DAT/.AVI espera un instante o verifica el archivo.',
                  'error',
                );
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: isVideoVisible ? 'block' : 'none',
              }}
            />
          )}

          {/* Espejo en vivo del Fondo Katakana cuando no hay vídeo activo */}
          {!isVideoVisible && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <img
                src={bgUrl}
                alt="Vista previa Pantalla Pública Katakana"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'top center',
                }}
              />

              {/* Zona Libre 34% - 88% (Respetando Zona Prohibida 0% - 32% del logo Katakana) */}
              <div
                style={{
                  position: 'absolute',
                  top: '34%',
                  height: '54%',
                  left: '9%',
                  width: '82%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  fontFamily: 'Georgia, Cambria, serif',
                  pointerEvents: 'none',
                  gap: '4px',
                }}
              >
                {publicOverlay.quickMessage ? (
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      textShadow: '0 2px 10px rgba(0,0,0,0.95)',
                    }}
                  >
                    {publicOverlay.quickMessage}
                  </div>
                ) : isApplauseActive ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#F5C76B',
                      textShadow: '0 2px 10px rgba(0,0,0,0.95)',
                    }}
                  >
                    <Sparkles size={26} />
                    <span style={{ fontSize: '19px', fontWeight: 700 }}>
                      ¡APLAUSOS EN SALA!
                    </span>
                  </div>
                ) : previewSinger && previewTitle ? (
                  <>
                    <div
                      style={{
                        fontSize: '11px',
                        letterSpacing: '1.2px',
                        textTransform: 'uppercase',
                        color: '#F5C76B',
                        fontWeight: 700,
                        textShadow: '0 2px 8px rgba(0,0,0,0.95)',
                      }}
                    >
                      A CONTINUACIÓN EN EL ESCENARIO
                    </div>
                    <div
                      style={{
                        fontSize: '21px',
                        fontWeight: 800,
                        color: '#FFFFFF',
                        textShadow: '0 2px 10px rgba(0,0,0,0.95)',
                        lineHeight: 1.1,
                      }}
                    >
                      {previewSinger}
                    </div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#FFB830',
                        textShadow: '0 2px 8px rgba(0,0,0,0.95)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}
                    >
                      {previewTitle}
                    </div>
                    {publicOverlay.mode === 'COUNTDOWN' && publicOverlay.countdownSec !== null && (
                      <div
                        style={{
                          fontSize: '20px',
                          fontWeight: 900,
                          color: '#FF9E2C',
                          fontFamily: 'var(--font-mono)',
                          textShadow: '0 2px 10px rgba(0,0,0,0.95)',
                        }}
                      >
                        {formatCountdownMMSS(publicOverlay.countdownSec)}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* Indicador para pistas de solo audio */}
          {isVideoVisible && isAudioOnly && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(21, 21, 21, 0.92)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f6efe0',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-surf)' }}>
                {cleanActiveTitle}
              </div>
              <div style={{ fontSize: '15px', marginTop: '4px', opacity: 0.85 }}>
                Pista de Audio ({preparedTrack?.extension?.toUpperCase()})
              </div>
            </div>
          )}

          {/* Mensaje rápido superpuesto también en vídeo activo */}
          {isVideoVisible && publicOverlay.quickMessage && (
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                right: '10px',
                backgroundColor: 'rgba(21, 21, 21, 0.86)',
                border: '2px solid var(--accent-surf)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              {publicOverlay.quickMessage}
            </div>
          )}
        </div>

        {/* Barra de progreso del Karaoke */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 800, minWidth: '46px' }}>
            {formatTimeMMSS(currentTimeMs)}
          </span>
          <input
            type="range"
            min={0}
            max={durationMs || 100}
            value={currentTimeMs}
            disabled={!preparedTrack}
            onMouseDown={() => setIsSeeking(true)}
            onChange={(e) => setCurrentTimeMs(Number(e.target.value))}
            onMouseUp={(e) => {
              setIsSeeking(false);
              handleSeek(Number((e.target as HTMLInputElement).value));
            }}
            style={{ flex: 1 }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 800, whiteSpace: 'nowrap' }}>
            -{formatTimeMMSS(Math.max(0, durationMs - currentTimeMs))} / {formatTimeMMSS(durationMs)}
          </span>
        </div>

        {/* Botonera grande de Transporte: Mensaje | Play/Pausa | Stop | Lanzar/Iniciar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.9fr 1.3fr', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            className={`btn ${publicOverlay.quickMessage ? 'btn-toggle-active' : ''}`}
            onClick={onOpenQuickMessage}
            title="Enviar o quitar un mensaje rápido en la Pantalla Pública"
            style={{ minHeight: '44px', fontSize: '15px' }}
          >
            <MessageSquare size={18} />
            Mensaje
          </button>

          <button
            type="button"
            className="btn btn-dark"
            onClick={onTogglePlayPause}
            title="Reproducir o Pausar (Espacio)"
            style={{ minHeight: '44px', fontSize: '16px' }}
          >
            {playbackState === 'PLAYING' ? (
              <Pause size={19} />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
            {playbackState === 'PLAYING' ? 'Pausa' : 'Play'}
          </button>

          <button
            type="button"
            className="btn btn-danger"
            onClick={onStopKaraoke}
            disabled={!preparedTrack && playbackState === 'IDLE'}
            title="Detener canción actual"
            style={{ minHeight: '44px', fontSize: '16px' }}
          >
            <Square size={17} fill="currentColor" />
            Stop
          </button>

          <Btn09
            type="button"
            variant="surf"
            onClick={onLaunchNextOrPlay}
            title="Lanzar / Iniciar siguiente turno de la cola"
            style={{ minHeight: '44px', fontSize: '16px' }}
          >
            <Rocket size={19} />
            Lanzar / Iniciar
          </Btn09>
        </div>

        {/* Controles de Tono (-6 a +6) y Velocidad (1.0x) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 0.85fr',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {/* Cambiador de Tonos */}
          <div className="katakana-card" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>Tono (Semitonos)</span>
              <span
                className="pill"
                style={{
                  backgroundColor: pitchSemitones !== 0 ? 'var(--accent-surf)' : 'var(--bg-surface-warm)',
                  color: 'var(--ink-piano)',
                  border: '1.5px solid var(--ink-piano)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onChangePitch(Math.max(-6, pitchSemitones - 1))}
                disabled={pitchSemitones <= -6}
                style={{ minWidth: '36px', padding: 0 }}
                title="Bajar 1 semitono"
              >
                <Minus size={16} />
              </button>
              <input
                type="range"
                min={-6}
                max={6}
                step={1}
                value={pitchSemitones}
                onChange={(e) => onChangePitch(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onChangePitch(Math.min(6, pitchSemitones + 1))}
                disabled={pitchSemitones >= 6}
                style={{ minWidth: '36px', padding: 0 }}
                title="Subir 1 semitono"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onChangePitch(0)}
                disabled={pitchSemitones === 0}
                style={{ minWidth: '36px', padding: '0 8px', fontWeight: 800 }}
                title="Restablecer tono original (0)"
              >
                0
              </button>
            </div>
          </div>

          {/* Control de Velocidad */}
          <div className="katakana-card" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>Velocidad</span>
              <span
                className="pill"
                style={{
                  backgroundColor: playbackSpeed !== 1 ? 'var(--accent-surf)' : 'var(--bg-surface-warm)',
                  color: 'var(--ink-piano)',
                  border: '1.5px solid var(--ink-piano)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {playbackSpeed.toFixed(2)}x
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="range"
                min={0.75}
                max={1.25}
                step={0.05}
                value={playbackSpeed}
                onChange={(e) => onChangeSpeed(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onChangeSpeed(1)}
                disabled={playbackSpeed === 1}
                title="Restablecer velocidad a 1.0x"
              >
                <RotateCcw size={14} />
                1.0x
              </button>
            </div>
          </div>
        </div>

        {/* Control de Volumen del Karaoke + Botón Memorizar Volumen */}
        <div
          className="katakana-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            backgroundColor: isVolumeMemorized ? 'rgba(0, 194, 181, 0.14)' : 'var(--bg-surface-raised)',
            borderColor: isVolumeMemorized ? 'var(--accent-surf-dark)' : 'var(--border-subtle)',
          }}
        >
          <button
            type="button"
            className={`btn btn-compact ${karaokeMuted ? 'btn-danger' : ''}`}
            onClick={onToggleKaraokeMute}
            title="Silenciar Karaoke"
            style={{ minWidth: '40px', padding: '0 8px' }}
          >
            {karaokeMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <span style={{ fontSize: '15px', fontWeight: 800, whiteSpace: 'nowrap' }}>Vol. Karaoke:</span>

          <input
            type="range"
            min={0}
            max={100}
            value={karaokeMuted ? 0 : karaokeVolume}
            onChange={(e) => onChangeKaraokeVolume(Number(e.target.value))}
            style={{ flex: 1 }}
          />

          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '17px',
              fontWeight: 900,
              minWidth: '50px',
              textAlign: 'right',
            }}
          >
            {karaokeMuted ? 'MUTE' : `${karaokeVolume}%`}
          </span>

          <button
            type="button"
            className="btn btn-surf btn-compact"
            onClick={onMemorizeCurrentVolume}
            disabled={!preparedTrack}
            title={
              memorizedVolumeValue !== null
                ? `Volumen memorizado actual: ${memorizedVolumeValue}%. Pulsa para actualizar con ${karaokeVolume}%.`
                : 'Guardar este volumen para esta canción automáticamente en futuras reproducciones'
            }
          >
            {isVolumeMemorized ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
            Memorizar Volumen
          </button>
        </div>
      </div>
    </section>
  );
};
