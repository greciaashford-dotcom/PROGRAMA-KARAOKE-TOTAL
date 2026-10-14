import chokidar, { FSWatcher } from 'chokidar';
import { ALLOWED_MEDIA_EXTENSIONS } from './constants.js';
import * as path from 'node:path';

export interface WatcherEvent {
  type: 'add' | 'change' | 'unlink';
  folderId: string;
  filePath: string;
}

export type WatcherCallback = (event: WatcherEvent) => void;

export class MediaFolderWatcher {
  private watchers = new Map<string, FSWatcher>();

  public watchFolder(folderId: string, rootPath: string, callback: WatcherCallback): void {
    // Si ya existe un watcher previo para esta carpeta, cerrarlo
    this.unwatchFolder(folderId);

    const watcher = chokidar.watch(rootPath, {
      ignored: (filePath) => {
        // Ignorar archivos ocultos
        const base = path.basename(filePath);
        if (base.startsWith('.')) return true;

        // Si es archivo, validar extensión
        const ext = path.extname(filePath).toLowerCase();
        if (ext && !ALLOWED_MEDIA_EXTENSIONS.has(ext)) return true;

        return false;
      },
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1500,
        pollInterval: 100,
      },
    });

    watcher.on('add', (filePath) => {
      callback({ type: 'add', folderId, filePath });
    });

    watcher.on('change', (filePath) => {
      callback({ type: 'change', folderId, filePath });
    });

    watcher.on('unlink', (filePath) => {
      callback({ type: 'unlink', folderId, filePath });
    });

    this.watchers.set(folderId, watcher);
  }

  public unwatchFolder(folderId: string): void {
    const existing = this.watchers.get(folderId);
    if (existing) {
      existing.close();
      this.watchers.delete(folderId);
    }
  }

  public closeAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
