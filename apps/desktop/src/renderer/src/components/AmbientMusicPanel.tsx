import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  FolderPlus,
  FileAudio,
  Trash2,
  Shuffle,
  Music,
} from 'lucide-react';
import { SongDTO } from '@karaoke/contracts';
import { audioMixerEngine } from '../utils/audio-mixer-engine.js';

interface AmbientMusicPanelProps {
  isKaraokeActive: boolean;
  isApplauseActive: boolean;
  ambientVolume: number;
  masterVolume: number;
  ambientMuted: boolean;
  masterMuted: boolean;
  crossfadeEnabled: boolean;
  crossfadeDurationSec: number;
  refreshTrigger?: number;
  onChangeAmbientVolume: (newAmbientVolume: number) => void;
  onToggleAmbientMute?: () => void;
  onCrossfadeStateChange?: (isCrossfading: boolean) => void;
  onNotification: (msg: string, type?: 'info' | 'error') => void;
  emergencyStopSignal?: number;
}

export const AmbientMusicPanel: React.FC<AmbientMusicPanelProps> = ({
  isKaraokeActive,
  isApplauseActive,
  ambientVolume,
  masterVolume,
  ambientMuted,
  masterMuted,
  crossfadeEnabled,
  crossfadeDurationSec,
  refreshTrigger = 0,
  onChangeAmbientVolume,
  onToggleAmbientMute,
  onCrossfadeStateChange,
  onNotification,
  emergencyStopSignal = 0,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [fadeMultiplier, setFadeMultiplier] = useState<number>(1);
  const fadeMultiplierRef = useRef<number>(1);

  const [tracks, setTracks] = useState<SongDTO[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isEnabledByOperator, setIsEnabledByOperator] = useState<boolean>(false);
  const [autoIntervalMode, setAutoIntervalMode] = useState<boolean>(true);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isPlayingNow, setIsPlayingNow] = useState<boolean>(false);

  const clearFadeTimer = useCallback(() => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    onCrossfadeStateChange?.(false);
  }, [onCrossfadeStateChange]);

  const setFade = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    fadeMultiplierRef.current = clamped;
    setFadeMultiplier(clamped);
  }, []);

  const getEffectiveTargetVolume = useCallback(() => {
    if (ambientMuted || masterMuted) return 0;
    return Math.max(0, Math.min(1, (ambientVolume / 100) * (masterVolume / 100)));
  }, [ambientMuted, masterMuted, ambientVolume, masterVolume]);

  const fetchAmbientTracks = useCallback(async () => {
    if (!window.karaokeAPI) return;
    try {
      const res = await window.karaokeAPI.listAssets({
        page: 1,
        pageSize: 200,
        category: 'AMBIENT',
        extension: '.mp3',
        sortBy: 'title',
        sortOrder: 'asc',
      });
      if (res.success) {
        const mp3Only = res.data.items.filter(
          (item) =>
            (!item.asset?.extension || item.asset.extension.toLowerCase() === '.mp3') &&
            item.asset?.status !== 'MISSING',
        );
        setTracks(mp3Only);
      }
    } catch (err) {
      console.error('Error cargando pistas MP3 de ambiente:', err);
    }
  }, []);

  useEffect(() => {
    fetchAmbientTracks();
  }, [fetchAmbientTracks, refreshTrigger]);

  // Enlazar elemento <audio> al motor de vúmetros Web Audio
  useEffect(() => {
    if (audioRef.current) {
      audioMixerEngine.registerAmbientElement(audioRef.current);
    }
  }, [tracks.length, currentIndex]);

  // Detener inmediatamente ante parada de emergencia
  useEffect(() => {
    if (emergencyStopSignal > 0) {
      clearFadeTimer();
      setFade(0);
      setIsEnabledByOperator(false);
      setIsPlayingNow(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [emergencyStopSignal, clearFadeTimer, setFade]);

  // Actualizar el volumen real del elemento <audio> combinando fader Ambiente, fader Master, Mute y Crossfade
  useEffect(() => {
    if (audioRef.current) {
      const baseVol = getEffectiveTargetVolume();
      audioRef.current.volume = Math.max(0, Math.min(1, baseVol * fadeMultiplier));
    }
  }, [getEffectiveTargetVolume, fadeMultiplier]);

  const currentTrack = tracks[currentIndex] || tracks[0] || null;
  const shouldPlayInInterval =
    isEnabledByOperator &&
    tracks.length > 0 &&
    (!autoIntervalMode || (!isKaraokeActive && !isApplauseActive));

  // Transiciones con Crossfade Automático entre Karaoke y Música de Ambiente
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    clearFadeTimer();

    if (shouldPlayInInterval && currentTrack) {
      audioMixerEngine.registerAmbientElement(audio);
      const durationMs = Math.max(500, crossfadeDurationSec * 1000);

      if (crossfadeEnabled && audio.paused) {
        setFade(0.05);
        audio.volume = getEffectiveTargetVolume() * 0.05;
        audio
          .play()
          .then(() => {
            setIsPlayingNow(true);
            onCrossfadeStateChange?.(true);
            const steps = Math.max(10, Math.floor(durationMs / 50));
            let currentStep = 0;
            fadeTimerRef.current = setInterval(() => {
              currentStep++;
              const ratio = Math.min(1, currentStep / steps);
              setFade(ratio);
              if (currentStep >= steps) {
                clearFadeTimer();
              }
            }, 50);
          })
          .catch(() => {
            setIsPlayingNow(false);
          });
      } else {
        setFade(1);
        audio.volume = getEffectiveTargetVolume();
        if (audio.paused) {
          audio
            .play()
            .then(() => setIsPlayingNow(true))
            .catch(() => setIsPlayingNow(false));
        } else {
          setIsPlayingNow(true);
        }
      }
    } else {
      // Debe detenerse o atenuarse porque comenzó un karaoke o el operador pausó
      if (!audio.paused) {
        if (crossfadeEnabled && isKaraokeActive && isEnabledByOperator) {
          const durationMs = Math.max(500, crossfadeDurationSec * 1000);
          const startFade = fadeMultiplierRef.current;
          const steps = Math.max(10, Math.floor(durationMs / 50));
          let currentStep = 0;
          onCrossfadeStateChange?.(true);
          fadeTimerRef.current = setInterval(() => {
            currentStep++;
            const ratio = Math.max(0, startFade * (1 - currentStep / steps));
            setFade(ratio);
            if (currentStep >= steps || ratio <= 0.01) {
              clearFadeTimer();
              audio.pause();
              setIsPlayingNow(false);
            }
          }, 50);
        } else {
          audio.pause();
          setIsPlayingNow(false);
        }
      } else {
        setIsPlayingNow(false);
      }
    }

    return () => {
      clearFadeTimer();
    };
  }, [
    shouldPlayInInterval,
    currentTrack?.mediaAssetId,
    crossfadeEnabled,
    crossfadeDurationSec,
    isKaraokeActive,
    isEnabledByOperator,
    clearFadeTimer,
    getEffectiveTargetVolume,
    onCrossfadeStateChange,
    setFade,
  ]);

  const handleNextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    if (isShuffle && tracks.length > 1) {
      let nextIdx = Math.floor(Math.random() * tracks.length);
      if (nextIdx === currentIndex) {
        nextIdx = (currentIndex + 1) % tracks.length;
      }
      setCurrentIndex(nextIdx);
    } else {
      setCurrentIndex((prev) => (prev + 1) % tracks.length);
    }
  }, [tracks.length, isShuffle, currentIndex]);

  const handleSelectFiles = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.selectAmbientFiles();
    if (res.success) {
      if (res.data.addedCount > 0) {
        onNotification(`Se añadieron ${res.data.addedCount} archivo(s) MP3 a Música de Ambiente.`);
        setTimeout(() => fetchAmbientTracks(), 500);
      }
    } else {
      onNotification(res.error.message, 'error');
    }
  };

  const handleSelectFolder = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.selectAmbientFolder();
    if (res.success && res.data) {
      onNotification(`Carpeta MP3 "${res.data.displayName}" vinculada a Música de Ambiente.`);
      setTimeout(() => fetchAmbientTracks(), 700);
    } else if (!res.success) {
      onNotification(res.error.message, 'error');
    }
  };

  const handleRemoveTrack = async (e: React.MouseEvent, song: SongDTO) => {
    e.stopPropagation();
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.removeAsset(song.mediaAssetId);
    if (res.success) {
      onNotification(`MP3 quitado de ambiente: ${song.title}`);
      await fetchAmbientTracks();
    }
  };

  const handleTogglePlayAmbient = () => {
    if (tracks.length === 0) {
      onNotification('Sube primero archivos o una carpeta MP3 para la música de ambiente.', 'error');
      return;
    }
    const nextState = !isEnabledByOperator;
    setIsEnabledByOperator(nextState);
    if (nextState) {
      if (isKaraokeActive || isApplauseActive) {
        onNotification('Música de ambiente activada: sonará automáticamente en el intervalo.');
      } else {
        onNotification(`Música de ambiente en reproducción: ${currentTrack?.title ?? ''}`);
      }
    } else {
      onNotification('Música de ambiente detenida.');
    }
  };

  const isPausedByKaraoke =
    isEnabledByOperator && autoIntervalMode && (isKaraokeActive || isApplauseActive);

  return (
    <div
      style={{
        backgroundColor: '#131924',
        border: isPlayingNow
          ? '1px solid rgba(41, 199, 255, 0.55)'
          : '1px solid #232b3a',
        borderRadius: '8px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginTop: 'auto',
      }}
    >
      {/* Elemento de audio dedicado para música de fondo MP3 */}
      {currentTrack && (
        <audio
          ref={audioRef}
          crossOrigin="anonymous"
          src={`karaoke-media://asset/${currentTrack.mediaAssetId}`}
          onEnded={handleNextTrack}
          onCanPlay={() => {
            if (audioRef.current) {
              audioMixerEngine.registerAmbientElement(audioRef.current);
            }
            if (shouldPlayInInterval && audioRef.current?.paused) {
              audioRef.current
                .play()
                .then(() => setIsPlayingNow(true))
                .catch(() => {});
            }
          }}
        />
      )}

      {/* Cabecera del apartado de Música de Ambiente */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Music size={15} color="#29C7FF" />
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
            MÚSICA DE AMBIENTE
          </span>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(41, 199, 255, 0.16)',
              color: '#29C7FF',
              border: '1px solid rgba(41, 199, 255, 0.35)',
            }}
          >
            SOLO MP3
          </span>
        </div>

        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: isPlayingNow
              ? 'rgba(41, 199, 255, 0.2)'
              : isPausedByKaraoke
                ? 'rgba(255, 177, 0, 0.2)'
                : '#192130',
            color: isPlayingNow
              ? '#29C7FF'
              : isPausedByKaraoke
                ? '#FFB100'
                : 'var(--text-muted)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {isPlayingNow
            ? '● SONANDO EN INTERVALO'
            : isPausedByKaraoke
              ? '⏸ PAUSADO POR KARAOKE'
              : `DETENIDO (${tracks.length} MP3)`}
        </span>
      </div>

      {/* Botones para subir archivos MP3, carpeta MP3, aleatorio y modo automático */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn"
          onClick={handleSelectFiles}
          title="Subir uno o varios archivos .mp3 como música de fondo"
          style={{
            height: '26px',
            minHeight: '26px',
            padding: '0 8px',
            fontSize: '11px',
            gap: '4px',
            backgroundColor: '#192130',
          }}
        >
          <FileAudio size={12} color="#29C7FF" />
          + Archivos MP3
        </button>

        <button
          type="button"
          className="btn"
          onClick={handleSelectFolder}
          title="Subir carpeta con canciones .mp3 de fondo"
          style={{
            height: '26px',
            minHeight: '26px',
            padding: '0 8px',
            fontSize: '11px',
            gap: '4px',
            backgroundColor: '#192130',
          }}
        >
          <FolderPlus size={12} color="#FFB100" />
          + Carpeta MP3
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => setIsShuffle((s) => !s)}
          title="Activar reproducción aleatoria de música de ambiente"
          style={{
            height: '26px',
            minHeight: '26px',
            padding: '0 8px',
            fontSize: '11px',
            gap: '4px',
            backgroundColor: isShuffle ? 'rgba(41, 199, 255, 0.18)' : '#192130',
            borderColor: isShuffle ? '#29C7FF' : 'var(--border-subtle)',
            color: isShuffle ? '#29C7FF' : 'var(--text-secondary)',
          }}
        >
          <Shuffle size={11} />
          Aleatorio
        </button>

        <label
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          title="Reproduce automáticamente la música MP3 en los intervalos y la atenúa al iniciar un karaoke"
        >
          <input
            type="checkbox"
            checked={autoIntervalMode}
            onChange={(e) => setAutoIntervalMode(e.target.checked)}
            style={{ accentColor: '#29C7FF', cursor: 'pointer' }}
          />
          Auto en intervalos
        </label>
      </div>

      {/* Controles de reproducción de ambiente y barra de volumen cian */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="btn btn-icon"
          onClick={handleTogglePlayAmbient}
          title={isEnabledByOperator ? 'Pausar música de ambiente' : 'Reproducir música de ambiente'}
          style={{
            width: '30px',
            height: '28px',
            minWidth: '30px',
            minHeight: '28px',
            backgroundColor: isEnabledByOperator ? 'rgba(41, 199, 255, 0.22)' : '#192130',
            borderColor: isEnabledByOperator ? '#29C7FF' : 'var(--border-subtle)',
            color: isEnabledByOperator ? '#29C7FF' : 'var(--text-primary)',
          }}
        >
          {isEnabledByOperator ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
        </button>

        {tracks.length > 1 && (
          <button
            type="button"
            className="btn btn-icon"
            onClick={handleNextTrack}
            title="Siguiente canción ambiental"
            style={{
              width: '28px',
              height: '28px',
              minWidth: '28px',
              minHeight: '28px',
              backgroundColor: '#192130',
            }}
          >
            <SkipForward size={12} />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleAmbientMute}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px',
            cursor: 'pointer',
            color: ambientMuted ? 'var(--status-error)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
          title={ambientMuted ? 'Reactivar canal Ambiente' : 'Silenciar canal Ambiente'}
        >
          {ambientMuted ? <VolumeX size={15} /> : <Volume2 size={15} color="#29C7FF" />}
        </button>

        <input
          type="range"
          min={0}
          max={100}
          value={ambientMuted ? 0 : ambientVolume}
          onChange={(e) => onChangeAmbientVolume(Number(e.target.value))}
          title={`Volumen música ambiental: ${ambientVolume}%`}
          style={{ width: '100%', cursor: 'pointer', accentColor: '#29C7FF' }}
        />

        <span
          style={{
            fontSize: '11px',
            color: ambientMuted ? 'var(--status-error)' : 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            minWidth: '32px',
            textAlign: 'right',
          }}
        >
          {ambientMuted ? 'MUTE' : `${ambientVolume}%`}
        </span>
      </div>

      {/* Lista compacta de pistas MP3 de ambiente (cuando hay archivos cargados) */}
      {tracks.length > 0 && (
        <div
          style={{
            maxHeight: '68px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            backgroundColor: '#0c1017',
            borderRadius: '6px',
            padding: '4px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {tracks.map((song, idx) => {
            const isSelected = idx === currentIndex;
            return (
              <div
                key={song.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setIsEnabledByOperator(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(41, 199, 255, 0.14)' : 'transparent',
                  color: isSelected ? '#29C7FF' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 700 : 400,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Music size={11} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {song.title}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={(e) => handleRemoveTrack(e, song)}
                  title="Quitar este MP3 de ambiente"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
