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
  Power,
  Disc,
} from 'lucide-react';
import { PlaybackStatus, QueueItemDTO } from '@karaoke/contracts';
import { PlayerPrepareResult, PublicOverlayStateDTO } from '../../../preload/types.js';
import { audioMixerEngine } from '../utils/audio-mixer-engine.js';
import { cleanDisplayTitle, formatTimeMMSS, formatCountdownMMSS } from '../utils/title-cleaner.js';
import { Btn09 } from './ui/button-hover.js';

export interface CenterMonitorColumnProps {
  isSessionActive: boolean;
  onStartSession: () => Promise<void>;
  preparedTrack: PlayerPrepareResult | null;
  playbackState: PlaybackStatus;
  stopSignal: number;
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
  isSessionActive,
  onStartSession,
  preparedTrack,
  playbackState,
  stopSignal,
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
  const introTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [showIntroBanner, setShowIntroBanner] = useState<boolean>(false);

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  const getEffectiveVolume = useCallback(() => {
    if (karaokeMuted || masterMuted) return 0;
    return Math.max(0, Math.min(1, (karaokeVolume / 100) * (masterVolume / 100)));
  }, [karaokeMuted, masterMuted, karaokeVolume, masterVolume]);

  // Parada física inmediata del elemento <video> cuando el administrador pulsa Stop o Emergencia
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
      lastReportedTimeRef.current = 0;
      setCurrentTimeMs(0);
      setDurationMs(0);
      setShowIntroBanner(false);
    }
  }, [stopSignal]);

  // Cargar nueva pista en el monitor solo cuando cambia la pista preparada
  useEffect(() => {
    if (introTimeoutRef.current) {
      clearTimeout(introTimeoutRef.current);
      introTimeoutRef.current = null;
    }

    if (preparedTrack) {
      setDurationMs(preparedTrack.durationMs || 0);
      setCurrentTimeMs(0);
      lastReportedTimeRef.current = 0;
      setShowIntroBanner(true);
      introTimeoutRef.current = setTimeout(() => {
        setShowIntroBanner(false);
      }, 5500);

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
      lastReportedTimeRef.current = 0;
      setCurrentTimeMs(0);
      setDurationMs(0);
      setShowIntroBanner(false);
    }

    return () => {
      if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current);
    };
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
      (videoRef.current as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch = true;
    }
  }, [playbackSpeed, preparedTrack?.mediaUrl]);

  // Sincronizar el elemento <video> únicamente con el estado maestro playbackState
  useEffect(() => {
    if (!videoRef.current) return;
    if (preparedTrack && playbackState === 'PLAYING') {
      videoRef.current.volume = getEffectiveVolume();
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    } else if (playbackState === 'PAUSED') {
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
    } else if (
      playbackState === 'STOPPED' ||
      playbackState === 'IDLE' ||
      playbackState === 'ENDED'
    ) {
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [preparedTrack, playbackState, getEffectiveVolume]);

  const handleSeek = useCallback(
    async (newMs: number) => {
      if (!window.karaokeAPI) return;
      const maxDur =
        durationMs || (videoRef.current ? videoRef.current.duration * 1000 : 0) || 100000;
      const clamped = Math.max(0, Math.min(maxDur, newMs));
      setCurrentTimeMs(clamped);
      lastReportedTimeRef.current = clamped;
      if (videoRef.current) {
        videoRef.current.currentTime = clamped / 1000;
      }
      await window.karaokeAPI.sendPlayerCommand({ command: 'SEEK', positionMs: clamped });
      await window.karaokeAPI.updatePlayerProgress(clamped, durationMs).catch(() => {});
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

  const isCountdownActive =
    publicOverlay.mode === 'COUNTDOWN' && publicOverlay.countdownSec !== null;
  const countdownSinger = publicOverlay.singerName || nextQueuedItem?.singer?.displayName || null;
  const countdownTitle = cleanDisplayTitle(
    publicOverlay.songTitle || nextQueuedItem?.song?.title || '',
  );

  const effectiveApplause = Boolean(isApplauseActive || publicOverlay.isApplauseActive);
  const effectiveSessionActive = Boolean(isSessionActive || publicOverlay.sessionActive);

  return (
    <section className="katakana-panel" aria-label="Monitor de Karaoke y Controles">
      {/* Cabecera Protagonista con Título en Oro y Cantante en Turquesa */}
      <div
        className="katakana-panel-header"
        style={{
          background:
            'radial-gradient(ellipse at 50% 100%, rgba(0, 229, 209, 0.25) 0%, transparent 65%), ' +
            'linear-gradient(90deg, #2b2318 0%, #171f2c 50%, #2b2318 100%)',
          borderBottom: '1.5px solid rgba(201, 160, 80, 0.65)',
          padding: '8px 14px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: '21px',
              fontWeight: 900,
              color: '#F3D285',
              textShadow: '0 2px 6px rgba(0,0,0,0.7)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {preparedTrack
              ? cleanActiveTitle
              : isCountdownActive && countdownTitle
                ? countdownTitle
                : effectiveSessionActive
                  ? 'SOLICITA TU CANCIÓN'
                  : 'MONITOR DE KARAOKE'}
          </span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#26F2E2' }}>
            {preparedTrack
              ? `Cantante: ${preparedTrack.singerName}`
              : isCountdownActive && countdownSinger
                ? `Próximo cantante: ${countdownSinger} (${formatCountdownMMSS(publicOverlay.countdownSec ?? 0)})`
                : effectiveSessionActive
                  ? nextQueuedItem
                    ? `En cola listo para lanzar: ${nextQueuedItem.singer?.displayName || 'Cantante'}`
                    : 'Sesión activa • Música de ambiente'
                  : 'Sesión limpia • Pulsa "Iniciar Sesión" para comenzar'}
          </span>
        </div>

        {!effectiveSessionActive ? (
          <button
            type="button"
            className="btn btn-surf btn-compact"
            onClick={onStartSession}
            style={{ fontSize: '13px', fontWeight: 900, padding: '5px 12px' }}
          >
            <Power size={15} />
            Iniciar Sesión
          </button>
        ) : (
          <span
            className="pill"
            style={{
              background:
                playbackState === 'PLAYING'
                  ? 'linear-gradient(180deg, #2ef2e2 0%, #00b8aa 100%)'
                  : playbackState === 'PAUSED' || isCountdownActive
                    ? 'linear-gradient(180deg, #ffc14d 0%, #e08b00 100%)'
                    : 'linear-gradient(180deg, #2ef2e2 0%, #00b8aa 100%)',
              color: '#12151a',
              border:
                playbackState === 'PAUSED' || isCountdownActive
                  ? '1.5px solid #ffe099'
                  : '1.5px solid #88fcf3',
              boxShadow:
                playbackState === 'PAUSED' || isCountdownActive
                  ? '0 0 12px rgba(245, 166, 35, 0.5)'
                  : '0 0 12px rgba(0, 229, 209, 0.5)',
              fontSize: '13px',
              padding: '5px 14px',
              borderRadius: '8px',
            }}
          >
            {playbackState === 'PLAYING'
              ? 'EN DIRECTO'
              : playbackState === 'PAUSED'
                ? 'PAUSADO'
                : isCountdownActive
                  ? `CONTEO ${formatCountdownMMSS(publicOverlay.countdownSec ?? 0)}`
                  : 'SESIÓN ACTIVA'}
          </span>
        )}
      </div>

      {/* Cuerpo central */}
      <div className="katakana-panel-body" style={{ padding: '10px', gap: '8px' }}>
        {/* Monitor de Vídeo Grande (Espejo 100% Sincronizado en Vivo de la Pantalla Pública) */}
        <div
          style={{
            width: '100%',
            flex: '1 1 220px',
            minHeight: '175px',
            backgroundColor: '#000000',
            borderRadius: '10px',
            border: '3px solid var(--ink-piano)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* 1. Elemento <video> principal (Única fuente de audio de Karaoke -> cero eco) */}
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
                // Latido cada 250ms para mantener la Pantalla Pública sincronizada al milisegundo
                if (Math.abs(ms - lastReportedTimeRef.current) >= 250) {
                  lastReportedTimeRef.current = ms;
                  window.karaokeAPI?.updatePlayerProgress(ms, durationMs).catch(() => {});
                }
              }}
              onSeeked={() => {
                if (!videoRef.current) return;
                const ms = Math.round(videoRef.current.currentTime * 1000);
                lastReportedTimeRef.current = ms;
                window.karaokeAPI?.updatePlayerProgress(ms, durationMs).catch(() => {});
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

          {/* Visualizador idéntico a Pantalla Pública si la pista de karaoke es solo audio */}
          {isVideoVisible && isAudioOnly && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
              <img
                src={bgUrl}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'top center',
                }}
              />
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
                  fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
                  gap: '6px',
                }}
              >
                <Disc
                  size={34}
                  color="#F5C76B"
                  className={playbackState === 'PLAYING' ? 'spin' : ''}
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.9))' }}
                />
                {preparedTrack?.singerName && (
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#F5C76B',
                      textShadow: '0 2px 10px rgba(0,0,0,0.95)',
                    }}
                  >
                    {preparedTrack.singerName}
                  </div>
                )}
                <div
                  style={{
                    fontSize: '21px',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    textShadow: '0 2px 12px rgba(0,0,0,0.95)',
                    lineHeight: 1.15,
                  }}
                >
                  {cleanActiveTitle}
                </div>
              </div>
            </div>
          )}

          {/* Aviso discreto al inicio del vídeo (5.5s) idéntico a la Pantalla Pública */}
          {isVideoVisible && !isAudioOnly && showIntroBanner && preparedTrack?.singerName && cleanActiveTitle && (
            <div
              style={{
                position: 'absolute',
                bottom: '14px',
                left: '16px',
                fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
                textShadow: '0 2px 10px rgba(0,0,0,0.98), 0 0 6px rgba(0,0,0,0.95)',
                zIndex: 15,
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: '11px', color: '#F5C76B', fontWeight: 700, letterSpacing: '0.5px' }}>
                Cantado por:
              </div>
              <div style={{ fontSize: '19px', color: '#FFFFFF', fontWeight: 800, lineHeight: 1.1 }}>
                {preparedTrack.singerName}
              </div>
              <div style={{ fontSize: '14px', color: '#FFB830', fontWeight: 700, marginTop: '2px' }}>
                {cleanActiveTitle}
              </div>
            </div>
          )}

          {/* Indicador de PAUSA idéntico a la Pantalla Pública */}
          {isVideoVisible && playbackState === 'PAUSED' && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '14px',
                color: '#F5C76B',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '14px',
                fontWeight: 800,
                fontFamily: 'Georgia, Cambria, serif',
                textShadow: '0 2px 10px rgba(0,0,0,0.98)',
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              <Pause size={15} />
              <span>PAUSA</span>
            </div>
          )}

          {/* Mensaje rápido superpuesto durante vídeo idéntico a la Pantalla Pública */}
          {isVideoVisible && publicOverlay.quickMessage && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '9%',
                width: '82%',
                textAlign: 'center',
                fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
                fontSize: '17px',
                fontWeight: 800,
                color: '#FFFFFF',
                textShadow: '0 2px 12px rgba(0,0,0,0.98), 0 0 8px rgba(0,0,0,0.95)',
                zIndex: 25,
                pointerEvents: 'none',
              }}
            >
              {publicOverlay.quickMessage}
            </div>
          )}

          {/* 2. Espejo 100% Sincronizado del Fondo General Katakana cuando no hay vídeo de karaoke activo */}
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
                  display: 'block',
                }}
              />

              {/* Zona Libre 34% - 88% (Idéntica a Pantalla Pública) */}
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
                  justifyContent: isCountdownActive ? 'space-between' : 'center',
                  textAlign: 'center',
                  fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
                  pointerEvents: 'none',
                  padding: '4px 0',
                }}
              >
                {publicOverlay.quickMessage ? (
                  <div
                    style={{
                      fontSize: '21px',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      textShadow: '0 3px 14px rgba(0,0,0,0.95)',
                      lineHeight: 1.2,
                      margin: 'auto 0',
                    }}
                  >
                    {publicOverlay.quickMessage}
                  </div>
                ) : effectiveApplause ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#F5C76B',
                      textShadow: '0 2px 10px rgba(0,0,0,0.95)',
                    }}
                  >
                    <Sparkles size={26} />
                    <span style={{ fontSize: '20px', fontWeight: 800 }}>
                      ¡APLAUSOS EN SALA!
                    </span>
                  </div>
                ) : isCountdownActive && countdownSinger && countdownTitle ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        flex: 1,
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11.5px',
                          letterSpacing: '1.5px',
                          textTransform: 'uppercase',
                          color: '#F5C76B',
                          fontWeight: 800,
                          textShadow: '0 2px 8px rgba(0,0,0,0.95)',
                        }}
                      >
                        A CONTINUACIÓN EN EL ESCENARIO
                      </div>
                      <div
                        style={{
                          fontSize: '23px',
                          fontWeight: 900,
                          color: '#FFFFFF',
                          textShadow: '0 2px 10px rgba(0,0,0,0.95)',
                          lineHeight: 1.1,
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {countdownSinger}
                      </div>
                      <div
                        style={{
                          fontSize: '16px',
                          fontWeight: 800,
                          color: '#FFB830',
                          textShadow: '0 2px 8px rgba(0,0,0,0.95)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}
                      >
                        {countdownTitle}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '25px',
                        fontWeight: 900,
                        color: '#FF9E2C',
                        fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
                        letterSpacing: '2px',
                        lineHeight: 1,
                        textShadow: '0 2px 12px rgba(0,0,0,0.98), 0 0 12px rgba(255,158,44,0.45)',
                      }}
                    >
                      {formatCountdownMMSS(publicOverlay.countdownSec ?? 0)}
                    </div>
                  </>
                ) : effectiveSessionActive ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '25px',
                        fontWeight: 900,
                        color: '#FFFFFF',
                        textShadow: '0 3px 14px rgba(0,0,0,0.96)',
                        lineHeight: 1.15,
                      }}
                    >
                      Solicita tu canción
                    </div>
                    <div
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 600,
                        color: '#F5C76B',
                        textShadow: '0 2px 10px rgba(0,0,0,0.95)',
                      }}
                    >
                      ¡El escenario de Katakana Karaoke está abierto!
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Barra de progreso del Karaoke */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '15px',
              fontWeight: 800,
              minWidth: '46px',
            }}
          >
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
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '15px',
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            -{formatTimeMMSS(Math.max(0, durationMs - currentTimeMs))} /{' '}
            {formatTimeMMSS(durationMs)}
          </span>
        </div>

        {/* Botonera grande de Transporte: Mensaje | Play/Pausa | Stop | Lanzar/Iniciar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr 0.9fr 1.3fr',
            gap: '8px',
            flexShrink: 0,
          }}
        >
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
            disabled={!preparedTrack && !nextQueuedItem}
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
            disabled={!preparedTrack && playbackState === 'IDLE' && !isCountdownActive}
            title="Detener canción actual o cancelar conteo"
            style={{ minHeight: '44px', fontSize: '16px' }}
          >
            <Square size={17} fill="currentColor" />
            Stop
          </button>

          <Btn09
            type="button"
            variant="surf"
            onClick={onLaunchNextOrPlay}
            disabled={playbackState === 'PLAYING'}
            title={
              playbackState === 'PLAYING'
                ? 'Canción en curso (pulsa Stop si deseas detenerla manualmente)'
                : isCountdownActive
                  ? 'Iniciar karaoke inmediatamente sin esperar el resto del conteo'
                  : 'Iniciar conteo regresivo para la siguiente canción de la cola'
            }
            style={{ minHeight: '44px', fontSize: '16px' }}
          >
            <Rocket size={19} />
            {isCountdownActive ? 'Iniciar Ya' : 'Lanzar / Iniciar'}
          </Btn09>
        </div>

        {/* Controles de Tono (-6 a +6) y Velocidad (1.0x) con cajitas crema como en el diseño */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.12fr 0.88fr',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {/* Cambiador de Tonos */}
          <div className="katakana-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#f3efe6' }}>
                Tono (Semitonos)
              </span>
              <span className="katakana-value-box">
                {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onChangePitch(Math.max(-6, pitchSemitones - 1))}
                disabled={pitchSemitones <= -6}
                style={{ minWidth: '34px', padding: 0 }}
                title="Bajar 1 semitono"
              >
                <Minus size={15} />
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
                style={{ minWidth: '34px', padding: 0 }}
                title="Subir 1 semitono"
              >
                <Plus size={15} />
              </button>
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onChangePitch(0)}
                disabled={pitchSemitones === 0}
                style={{ minWidth: '34px', padding: '0 8px', fontWeight: 800 }}
                title="Restablecer tono original (0)"
              >
                0
              </button>
            </div>
          </div>

          {/* Control de Velocidad */}
          <div className="katakana-card" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#f3efe6' }}>Velocidad</span>
              <span className="katakana-value-box">{playbackSpeed.toFixed(2)}X</span>
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
            borderColor: isVolumeMemorized ? '#00d8c8' : 'rgba(190, 160, 100, 0.35)',
          }}
        >
          <button
            type="button"
            className={`btn btn-compact ${karaokeMuted ? 'btn-danger' : ''}`}
            onClick={onToggleKaraokeMute}
            title="Silenciar Karaoke"
            style={{ minWidth: '38px', padding: '0 8px' }}
          >
            {karaokeMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          <span style={{ fontSize: '14.5px', fontWeight: 800, whiteSpace: 'nowrap', color: '#f3efe6' }}>
            Vol. Karaoke:
          </span>

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
              fontSize: '16px',
              fontWeight: 900,
              minWidth: '48px',
              textAlign: 'right',
              color: '#f3efe6',
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
            {isVolumeMemorized ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            Memorizar
          </button>
        </div>
      </div>
    </section>
  );
};
