import { PlaybackStatus } from '@karaoke/contracts';

export interface MediaEngineEvents {
  stateChanged: (state: PlaybackStatus) => void;
  timeUpdate: (positionMs: number, durationMs: number) => void;
  ended: () => void;
  error: (errorMessage: string) => void;
}

/**
 * Contrato formal para el motor de reproducción multimedia.
 * Permite desacoplar el reproductor HTML5 actual de futuras implementaciones (como mpv o VLC).
 */
export interface IMediaEngine {
  prepare(mediaUrl: string, options?: { keyShift?: number }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): void;
  getState(): PlaybackStatus;
  getCurrentTimeMs(): number;
  getDurationMs(): number;
  destroy(): void;

  on<K extends keyof MediaEngineEvents>(event: K, listener: MediaEngineEvents[K]): void;
  off<K extends keyof MediaEngineEvents>(event: K, listener: MediaEngineEvents[K]): void;
}
