import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface VolumesStoreData {
  songs: Record<string, number>;
  ambientVolume: number;
  applauseVolume: number;
  karaokeDefaultVolume: number;
  masterVolume: number;
  autoSaveSongVolume: boolean;
  autoKaraokeEnabled: boolean;
  autoKaraokeDelaySec: number;
  publicBackgroundPath: string | null;
}

const DEFAULT_VOLUMES: VolumesStoreData = {
  songs: {},
  ambientVolume: 35,
  applauseVolume: 80,
  karaokeDefaultVolume: 85,
  masterVolume: 100,
  autoSaveSongVolume: false,
  autoKaraokeEnabled: false,
  autoKaraokeDelaySec: 20,
  publicBackgroundPath: null,
};

export class VolumesStore {
  private filePath: string;
  private cache: VolumesStoreData;

  constructor(customDir?: string) {
    const dir = customDir || app.getPath('userData');
    this.filePath = path.join(dir, 'volumes.json');
    this.cache = this.loadFromDisk();
  }

  private loadFromDisk(): VolumesStoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<VolumesStoreData>;
        return {
          songs: parsed.songs && typeof parsed.songs === 'object' ? { ...parsed.songs } : {},
          ambientVolume: clampVolume(parsed.ambientVolume ?? DEFAULT_VOLUMES.ambientVolume),
          applauseVolume: clampVolume(parsed.applauseVolume ?? DEFAULT_VOLUMES.applauseVolume),
          karaokeDefaultVolume: clampVolume(
            parsed.karaokeDefaultVolume ?? DEFAULT_VOLUMES.karaokeDefaultVolume,
          ),
          masterVolume: clampVolume(parsed.masterVolume ?? DEFAULT_VOLUMES.masterVolume),
          autoSaveSongVolume: Boolean(parsed.autoSaveSongVolume),
          autoKaraokeEnabled: Boolean(parsed.autoKaraokeEnabled),
          autoKaraokeDelaySec: clampDelay(
            parsed.autoKaraokeDelaySec ?? DEFAULT_VOLUMES.autoKaraokeDelaySec,
          ),
          publicBackgroundPath:
            typeof parsed.publicBackgroundPath === 'string' && parsed.publicBackgroundPath.trim()
              ? parsed.publicBackgroundPath
              : null,
        };
      }
    } catch (err) {
      console.warn('[VolumesStore] Error leyendo volumes.json, usando valores por defecto:', err);
    }
    return { ...DEFAULT_VOLUMES, songs: {} };
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (err) {
      console.error('[VolumesStore] Error guardando volumes.json:', err);
    }
  }

  public getAll(): VolumesStoreData {
    return {
      ...this.cache,
      songs: { ...this.cache.songs },
    };
  }

  public saveSongVolume(songKey: string, volume: number): VolumesStoreData {
    if (songKey && songKey.trim()) {
      this.cache.songs[songKey.trim()] = clampVolume(volume);
      this.persist();
    }
    return this.getAll();
  }

  public saveGlobal(updates: Partial<Omit<VolumesStoreData, 'songs'>>): VolumesStoreData {
    if (updates.ambientVolume !== undefined) {
      this.cache.ambientVolume = clampVolume(updates.ambientVolume);
    }
    if (updates.applauseVolume !== undefined) {
      this.cache.applauseVolume = clampVolume(updates.applauseVolume);
    }
    if (updates.karaokeDefaultVolume !== undefined) {
      this.cache.karaokeDefaultVolume = clampVolume(updates.karaokeDefaultVolume);
    }
    if (updates.masterVolume !== undefined) {
      this.cache.masterVolume = clampVolume(updates.masterVolume);
    }
    if (updates.autoSaveSongVolume !== undefined) {
      this.cache.autoSaveSongVolume = Boolean(updates.autoSaveSongVolume);
    }
    if (updates.autoKaraokeEnabled !== undefined) {
      this.cache.autoKaraokeEnabled = Boolean(updates.autoKaraokeEnabled);
    }
    if (updates.autoKaraokeDelaySec !== undefined) {
      this.cache.autoKaraokeDelaySec = clampDelay(updates.autoKaraokeDelaySec);
    }
    if (updates.publicBackgroundPath !== undefined) {
      this.cache.publicBackgroundPath = updates.publicBackgroundPath;
    }
    this.persist();
    return this.getAll();
  }
}

function clampVolume(val: number): number {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n)) return 80;
  return Math.max(0, Math.min(100, n));
}

function clampDelay(val: number): number {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n)) return 20;
  return Math.max(0, Math.min(120, n));
}
