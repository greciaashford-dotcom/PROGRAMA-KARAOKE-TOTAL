import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  FolderPlus,
  FileAudio,
  Trash2,
  Shuffle,
  Repeat,
  Clock,
  Music,
  PlayCircle,
} from 'lucide-react';
import { SongDTO } from '@karaoke/contracts';
import { audioMixerEngine } from '../utils/audio-mixer-engine.js';
import { cleanDisplayTitle, formatTimeMMSS } from '../utils/title-cleaner.js';

export interface AmbientColumnProps {
  /** Si el karaoke o los aplausos están sonando, el audio MP3 se detiene de golpe (SIN crossfade) */
  blockedByKaraokeOrEffects: boolean;
  /** Señal imperativa de parada total (Parada de Emergencia o paso a Karaoke) */
  forceStopSignal: number;
  /** Señal imperativa para arrancar música ambiental (por ejemplo tras finalizar Aplausos en Auto Karaoke) */
  autoStartSignal: number;
  ambientVolume: number;
  masterVolume: number;
  ambientMuted: boolean;
  masterMuted: boolean;
  refreshTrigger: number;
  onChangeAmbientVolume: (vol: number) => void;
  onToggleAmbientMute: () => void;
  onNotification: (msg: string, type?: 'info' | 'error') => void;
  onAmbientPlayingChange?: (playing: boolean) => void;
  onAutoIntervalChange?: (enabled: boolean) => void;
}

export const AmbientColumn: React.FC<AmbientColumnProps> = ({
  blockedByKaraokeOrEffects,
  forceStopSignal,
  autoStartSignal,
  ambientVolume,
  masterVolume,
  ambientMuted,
  masterMuted,
  refreshTrigger,
  onChangeAmbientVolume,
  onToggleAmbientMute,
  onNotification,
  onAmbientPlayingChange,
  onAutoIntervalChange,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<SongDTO[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Modos solicitados: Al Azar / Continua / Auto intervalo
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isContinuous, setIsContinuous] = useState<boolean>(true);
  const [autoIntervalMode, setAutoIntervalMode] = useState<boolean>(true);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [wantsToPlay, setWantsToPlay] = useState<boolean>(false);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);

  const fetchAmbientTracks = useCallback(async () => {
    if (!window.karaokeAPI) return;
    try {
      const res = await window.karaokeAPI.listAssets({
        page: 1,
        pageSize: 500,
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
        if (mp3Only.length > 0 && currentIndex >= mp3Only.length) {
          setCurrentIndex(0);
        }
      }
    } catch (err) {
      console.error('Error cargando pistas MP3 de ambiente:', err);
    }
  }, [currentIndex]);

  useEffect(() => {
    fetchAmbientTracks();
  }, [fetchAmbientTracks, refreshTrigger]);

  useEffect(() => {
    onAutoIntervalChange?.(autoIntervalMode);
  }, [autoIntervalMode, onAutoIntervalChange]);

  useEffect(() => {
    onAmbientPlayingChange?.(isPlaying);
  }, [isPlaying, onAmbientPlayingChange]);

  // Calcular volumen efectivo de golpe (SIN crossfade)
  const getEffectiveVolume = useCallback(() => {
    if (ambientMuted || masterMuted) return 0;
    return Math.max(0, Math.min(1, (ambientVolume / 100) * (masterVolume / 100)));
  }, [ambientMuted, masterMuted, ambientVolume, masterVolume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = getEffectiveVolume();
    }
  }, [getEffectiveVolume]);

  const currentTrack = tracks[currentIndex] || tracks[0] || null;

  // Enlazar al analizador Web Audio para VU meters reales
  useEffect(() => {
    if (audioRef.current) {
      audioMixerEngine.registerAmbientElement(audioRef.current);
      audioRef.current.volume = getEffectiveVolume();
    }
  }, [currentTrack?.mediaAssetId, getEffectiveVolume]);

  // Parada inmediata (Emergencia o inicio de Karaoke -> Audio estrictamente secuencial, SIN solapamiento)
  useEffect(() => {
    if (forceStopSignal > 0) {
      setWantsToPlay(false);
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setCurrentTimeMs(0);
    }
  }, [forceStopSignal]);

  // Inicio automático al terminar aplausos (Audio secuencial: Aplausos paran -> MP3 entra de golpe a su volumen memorizado)
  useEffect(() => {
    if (autoStartSignal > 0 && autoIntervalMode && tracks.length > 0) {
      setWantsToPlay(true);
    }
  }, [autoStartSignal, autoIntervalMode, tracks.length]);

  // Control estricto secuencial: si suena Karaoke o Aplausos, el MP3 se detiene de golpe
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (blockedByKaraokeOrEffects) {
      if (!audio.paused) {
        audio.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (wantsToPlay && currentTrack) {
      audioMixerEngine.registerAmbientElement(audio);
      audio.volume = getEffectiveVolume();
      if (audio.paused) {
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
      setIsPlaying(false);
    }
  }, [blockedByKaraokeOrEffects, wantsToPlay, currentTrack?.mediaAssetId, getEffectiveVolume]);

  const selectNextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    if (!isContinuous) {
      setWantsToPlay(false);
      setIsPlaying(false);
      setCurrentTimeMs(0);
      return;
    }
    if (isShuffle && tracks.length > 1) {
      let nextIdx = Math.floor(Math.random() * tracks.length);
      if (nextIdx === currentIndex) {
        nextIdx = (currentIndex + 1) % tracks.length;
      }
      setCurrentIndex(nextIdx);
    } else {
      setCurrentIndex((prev) => (prev + 1) % tracks.length);
    }
  }, [tracks.length, isContinuous, isShuffle, currentIndex]);

  const handlePlayPause = () => {
    if (tracks.length === 0) {
      onNotification('Agrega archivos o una carpeta MP3 en Música de Ambiente primero.', 'error');
      return;
    }
    if (blockedByKaraokeOrEffects) {
      onNotification('Detén el Karaoke actual antes de reproducir Música de Ambiente.', 'error');
      return;
    }
    if (isPlaying) {
      setWantsToPlay(false);
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      setWantsToPlay(true);
    }
  };

  const handleStop = () => {
    setWantsToPlay(false);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentTimeMs(0);
  };

  const handleStartFromBeginning = () => {
    if (tracks.length === 0) {
      onNotification('No hay canciones MP3 cargadas en Música de Ambiente.', 'error');
      return;
    }
    if (blockedByKaraokeOrEffects) {
      onNotification('Espera a que termine el Karaoke o pulsa Stop primero.', 'error');
      return;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = getEffectiveVolume();
      audioRef.current
        .play()
        .then(() => {
          setWantsToPlay(true);
          setIsPlaying(true);
        })
        .catch(() => {});
    } else {
      setWantsToPlay(true);
    }
  };

  const handleSelectFiles = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.selectAmbientFiles();
    if (res.success) {
      if (res.data.addedCount > 0) {
        await fetchAmbientTracks();
        onNotification(`Se añadieron ${res.data.addedCount} archivo(s) MP3 de ambiente.`);
      }
    } else {
      onNotification(res.error.message, 'error');
    }
  };

  const handleSelectFolder = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.selectAmbientFolder();
    if (res.success && res.data) {
      await fetchAmbientTracks();
      onNotification(`Carpeta MP3 "${res.data.displayName}" vinculada.`);
    } else if (!res.success) {
      onNotification(res.error.message, 'error');
    }
  };

  const handleRemoveTrack = async (e: React.MouseEvent, song: SongDTO) => {
    e.stopPropagation();
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.removeAsset(song.mediaAssetId);
    if (res.success) {
      onNotification(`MP3 quitado: ${cleanDisplayTitle(song.title)}`);
      await fetchAmbientTracks();
    }
  };

  return (
    <section className="katakana-panel" aria-label="Música de Ambiente MP3">
      {currentTrack && (
        <audio
          ref={audioRef}
          crossOrigin="anonymous"
          src={`karaoke-media://asset/${currentTrack.mediaAssetId}`}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTimeMs(Math.round(audioRef.current.currentTime * 1000));
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
              setDurationMs(Math.round(audioRef.current.duration * 1000));
            }
          }}
          onCanPlay={() => {
            if (audioRef.current) {
              audioMixerEngine.registerAmbientElement(audioRef.current);
              audioRef.current.volume = getEffectiveVolume();
              if (wantsToPlay && !blockedByKaraokeOrEffects && audioRef.current.paused) {
                audioRef.current
                  .play()
                  .then(() => setIsPlaying(true))
                  .catch(() => {});
              }
            }
          }}
          onEnded={selectNextTrack}
        />
      )}

      {/* Cabecera */}
      <div className="katakana-panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Music size={20} />
          MÚSICA AMBIENTE (MP3)
        </span>
        <span
          className="pill"
          style={{
            backgroundColor: isPlaying ? 'var(--accent-surf)' : 'var(--ink-piano)',
            color: isPlaying ? 'var(--ink-piano)' : '#f6efe0',
          }}
        >
          {isPlaying ? 'SONANDO' : `${tracks.length} MP3`}
        </span>
      </div>

      {/* Controles superiores: Al Azar / Continua / Auto intervalo + Subir MP3 */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1.5px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface-raised)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          <button
            type="button"
            className={`btn btn-compact ${isShuffle ? 'btn-toggle-active' : ''}`}
            onClick={() => setIsShuffle((v) => !v)}
            title="Reproducir pistas MP3 en orden aleatorio"
          >
            <Shuffle size={15} />
            Al Azar
          </button>

          <button
            type="button"
            className={`btn btn-compact ${isContinuous ? 'btn-toggle-active' : ''}`}
            onClick={() => setIsContinuous((v) => !v)}
            title="Seguir automáticamente a la siguiente canción MP3"
          >
            <Repeat size={15} />
            Continua
          </button>

          <button
            type="button"
            className={`btn btn-compact ${autoIntervalMode ? 'btn-toggle-active' : ''}`}
            onClick={() => setAutoIntervalMode((v) => !v)}
            title="Sonar automáticamente en los intervalos entre karaokes"
          >
            <Clock size={15} />
            Auto int.
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button type="button" className="btn btn-compact" onClick={handleSelectFiles}>
            <FileAudio size={16} />
            + Archivos MP3
          </button>
          <button type="button" className="btn btn-compact" onClick={handleSelectFolder}>
            <FolderPlus size={16} />
            + Carpeta MP3
          </button>
        </div>
      </div>

      {/* Lista completa y grande de MP3 (17px-18px) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px' }}>
        {tracks.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '18px',
              color: 'var(--ink-muted)',
              gap: '8px',
            }}
          >
            <Music size={34} />
            <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink-piano)' }}>
              Sin música de ambiente
            </div>
            <div style={{ fontSize: '15px' }}>
              Pulsa <strong>+ Archivos MP3</strong> o <strong>+ Carpeta MP3</strong> para cargar música de fondo.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {tracks.map((song, idx) => {
              const isSelected = idx === currentIndex;
              const cleanName = cleanDisplayTitle(song.title);
              return (
                <div
                  key={song.id}
                  onClick={() => {
                    setCurrentIndex(idx);
                    if (!blockedByKaraokeOrEffects) {
                      setWantsToPlay(true);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--accent-surf)' : 'var(--bg-surface-raised)',
                    border: isSelected ? '2px solid var(--ink-piano)' : '1.5px solid var(--border-subtle)',
                    color: 'var(--ink-piano)',
                    fontSize: '17px',
                    fontWeight: isSelected ? 800 : 600,
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                    title={cleanName}
                  >
                    {idx + 1}. {cleanName}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handleRemoveTrack(e, song)}
                    title="Quitar MP3 de la lista"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--ink-piano)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.75,
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Controles inferiores: Progreso, Mute, Play/Pausa, Stop, Iniciar y Volumen */}
      <div
        style={{
          padding: '8px 10px',
          borderTop: '2px solid var(--ink-piano)',
          backgroundColor: 'var(--bg-surface-warm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '7px',
          flexShrink: 0,
        }}
      >
        {/* Barra de progreso MP3 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, minWidth: '40px' }}>
            {formatTimeMMSS(currentTimeMs)}
          </span>
          <input
            type="range"
            min={0}
            max={durationMs || 100}
            value={currentTimeMs}
            disabled={!currentTrack}
            onChange={(e) => {
              const val = Number(e.target.value);
              setCurrentTimeMs(val);
              if (audioRef.current) {
                audioRef.current.currentTime = val / 1000;
              }
            }}
            style={{ flex: 1 }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>
            {formatTimeMMSS(durationMs)}
          </span>
        </div>

        {/* Botonera: Mute, Play/Pausa, Stop, Iniciar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '6px' }}>
          <button
            type="button"
            className={`btn btn-compact ${ambientMuted ? 'btn-danger' : ''}`}
            onClick={onToggleAmbientMute}
            title="Silenciar música de ambiente"
          >
            {ambientMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            Mute
          </button>

          <button
            type="button"
            className={`btn btn-compact ${isPlaying ? 'btn-surf' : ''}`}
            onClick={handlePlayPause}
            title="Reproducir o pausar música de ambiente"
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
            {isPlaying ? 'Pausa' : 'Play'}
          </button>

          <button
            type="button"
            className="btn btn-compact"
            onClick={handleStop}
            title="Detener música de ambiente"
          >
            <Square size={16} fill="currentColor" />
            Stop
          </button>

          <button
            type="button"
            className="btn btn-compact btn-dark"
            onClick={handleStartFromBeginning}
            title="Iniciar canción MP3 seleccionada desde el principio"
          >
            <PlayCircle size={17} />
            Iniciar
          </button>
        </div>

        {/* Deslizador de volumen de ambiente */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, whiteSpace: 'nowrap' }}>Vol. MP3:</span>
          <input
            type="range"
            min={0}
            max={100}
            value={ambientMuted ? 0 : ambientVolume}
            onChange={(e) => onChangeAmbientVolume(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '16px',
              fontWeight: 800,
              minWidth: '48px',
              textAlign: 'right',
              color: ambientMuted ? 'var(--status-error)' : 'var(--ink-piano)',
            }}
          >
            {ambientMuted ? 'MUTE' : `${ambientVolume}%`}
          </span>
        </div>
      </div>
    </section>
  );
};
