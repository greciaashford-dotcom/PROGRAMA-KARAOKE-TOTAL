import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Play,
  Pause,
  SkipForward,
  Volume2,
  FolderPlus,
  FileAudio,
  Trash2,
  Shuffle,
  Music,
} from 'lucide-react';
import { SongDTO } from '@karaoke/contracts';

interface AmbientMusicPanelProps {
  isKaraokeActive: boolean;
  isApplauseActive: boolean;
  initialVolume?: number;
  refreshTrigger?: number;
  onVolumeSave?: (newAmbientVolume: number) => void;
  onNotification: (msg: string, type?: 'info' | 'error') => void;
  emergencyStopSignal?: number;
}

export const AmbientMusicPanel: React.FC<AmbientMusicPanelProps> = ({
  isKaraokeActive,
  isApplauseActive,
  initialVolume = 35,
  refreshTrigger = 0,
  onVolumeSave,
  onNotification,
  emergencyStopSignal = 0,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tracks, setTracks] = useState<SongDTO[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isEnabledByOperator, setIsEnabledByOperator] = useState<boolean>(false);
  const [autoIntervalMode, setAutoIntervalMode] = useState<boolean>(true);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(initialVolume);
  const [isPlayingNow, setIsPlayingNow] = useState<boolean>(false);

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
        // Garantizar que solo se incluyan archivos .mp3 disponibles
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

  // Detener inmediatamente ante parada de emergencia
  useEffect(() => {
    if (emergencyStopSignal > 0) {
      setIsEnabledByOperator(false);
      setIsPlayingNow(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [emergencyStopSignal]);

  // Sincronizar volumen del elemento <audio>
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
    }
  }, [volume]);

  const currentTrack = tracks[currentIndex] || tracks[0] || null;
  const shouldPlayInInterval =
    isEnabledByOperator &&
    tracks.length > 0 &&
    (!autoIntervalMode || (!isKaraokeActive && !isApplauseActive));

  // Control automático de reproducción en intervalos entre karaokes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (shouldPlayInInterval && currentTrack) {
      audio.volume = Math.max(0, Math.min(1, volume / 100));
      if (audio.paused) {
        audio
          .play()
          .then(() => setIsPlayingNow(true))
          .catch(() => {
            setIsPlayingNow(false);
          });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
      setIsPlayingNow(false);
    }
  }, [shouldPlayInInterval, currentTrack?.mediaAssetId, volume]);

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
        onNotification('Música de ambiente activada: sonará automáticamente al terminar el karaoke.');
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
        backgroundColor: 'var(--bg-surface-raised)',
        border: isPlayingNow
          ? '1px solid rgba(16, 185, 129, 0.45)'
          : '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginTop: '2px',
      }}
    >
      {/* Elemento de audio dedicado para música de fondo MP3 */}
      {currentTrack && (
        <audio
          ref={audioRef}
          src={`karaoke-media://asset/${currentTrack.mediaAssetId}`}
          onEnded={handleNextTrack}
          onCanPlay={() => {
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
          <Radio size={15} color="#38bdf8" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Música de Ambiente
          </span>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: 'rgba(56, 189, 248, 0.14)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            SOLO MP3
          </span>
        </div>

        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '999px',
            backgroundColor: isPlayingNow
              ? 'rgba(16, 185, 129, 0.2)'
              : isPausedByKaraoke
                ? 'rgba(245, 158, 11, 0.2)'
                : 'var(--bg-surface)',
            color: isPlayingNow
              ? 'var(--status-ready)'
              : isPausedByKaraoke
                ? 'var(--accent-warm)'
                : 'var(--text-muted)',
          }}
        >
          {isPlayingNow
            ? '● SONANDO EN INTERVALO'
            : isPausedByKaraoke
              ? '⏸ EN ESPERA (KARAOKE)'
              : `DETENIDO (${tracks.length} MP3)`}
        </span>
      </div>

      {/* Botones para subir archivos MP3 o carpeta MP3 + modo automático */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
          }}
        >
          <FileAudio size={12} color="#38bdf8" />
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
          }}
        >
          <FolderPlus size={12} color="var(--accent-warm)" />
          + Carpeta MP3
        </button>

        <label
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          title="Pausa automáticamente la música de ambiente cuando empieza un karaoke y la reanuda en los intervalos"
        >
          <input
            type="checkbox"
            checked={autoIntervalMode}
            onChange={(e) => setAutoIntervalMode(e.target.checked)}
            style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
          />
          Auto en intervalos
        </label>
      </div>

      {/* Controles de reproducción de ambiente y volumen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="btn"
          onClick={handleTogglePlayAmbient}
          style={{
            height: '28px',
            minHeight: '28px',
            padding: '0 10px',
            fontSize: '11px',
            fontWeight: 700,
            gap: '5px',
            backgroundColor: isEnabledByOperator ? 'rgba(56, 189, 248, 0.18)' : 'var(--bg-surface)',
            borderColor: isEnabledByOperator ? '#38bdf8' : 'var(--border-subtle)',
            color: isEnabledByOperator ? '#38bdf8' : 'var(--text-primary)',
          }}
        >
          {isEnabledByOperator ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
          {isEnabledByOperator ? 'Pausar Fondo' : 'Activar Fondo'}
        </button>

        <button
          type="button"
          className="btn btn-icon"
          onClick={handleNextTrack}
          disabled={tracks.length <= 1}
          title="Siguiente MP3 de ambiente"
          style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
        >
          <SkipForward size={13} />
        </button>

        <button
          type="button"
          className="btn btn-icon"
          onClick={() => setIsShuffle((s) => !s)}
          title="Orden aleatorio (Shuffle)"
          style={{
            width: '28px',
            height: '28px',
            minWidth: '28px',
            minHeight: '28px',
            borderColor: isShuffle ? '#38bdf8' : 'var(--border-subtle)',
            color: isShuffle ? '#38bdf8' : 'var(--text-muted)',
          }}
        >
          <Shuffle size={12} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: '80px' }}>
          <Volume2 size={13} color="#38bdf8" />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              onVolumeSave?.(v);
            }}
            title={`Volumen música de ambiente: ${volume}%`}
            style={{ width: '100%', cursor: 'pointer', accentColor: '#38bdf8' }}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '28px' }}>
            {volume}%
          </span>
        </div>
      </div>

      {/* Lista compacta de pistas MP3 de ambiente */}
      {tracks.length > 0 ? (
        <div
          style={{
            maxHeight: '96px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            backgroundColor: 'var(--bg-app)',
            borderRadius: '6px',
            padding: '4px',
            border: '1px solid var(--border-subtle)',
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
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'transparent',
                  color: isSelected ? '#38bdf8' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 600 : 400,
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
                    {song.title} {song.artist && song.artist !== 'Desconocido' ? `— ${song.artist}` : ''}
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
      ) : (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '6px',
            backgroundColor: 'var(--bg-app)',
            borderRadius: '6px',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          Sin pistas MP3 de fondo. Usa <strong>+ Archivos MP3</strong> o <strong>+ Carpeta MP3</strong> para sonar en los intervalos.
        </div>
      )}
    </div>
  );
};
