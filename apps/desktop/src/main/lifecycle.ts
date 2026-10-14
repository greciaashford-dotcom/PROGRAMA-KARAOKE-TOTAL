import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import {
  createDatabaseConnection,
  runMigrations,
  SettingsRepository,
  SessionRepository,
  MediaRepository,
  KaraokeDatabase,
} from '@karaoke/database';
import { MediaFolderWatcher } from '@karaoke/media-indexer';
import { Database as DatabaseInstance } from 'better-sqlite3';
import { registerAllIpcHandlers } from './ipc/index.js';
import { createOperatorWindow } from './windows/operator-window.js';
import { setupSecurity } from './security.js';
import { IPC_CHANNELS } from '@karaoke/contracts';

export class AppLifecycle {
  private static instance: AppLifecycle;
  private db: KaraokeDatabase | null = null;
  private sqlite: DatabaseInstance | null = null;
  private operatorWindow: BrowserWindow | null = null;
  private watcher: MediaFolderWatcher = new MediaFolderWatcher();

  public static getInstance(): AppLifecycle {
    if (!AppLifecycle.instance) {
      AppLifecycle.instance = new AppLifecycle();
    }
    return AppLifecycle.instance;
  }

  public async bootstrap(): Promise<void> {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      console.warn('Ya existe otra instancia en ejecución. Cerrando esta instancia.');
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      if (this.operatorWindow) {
        if (this.operatorWindow.isMinimized()) this.operatorWindow.restore();
        this.operatorWindow.focus();
      }
    });

    setupSecurity();
    this.initDatabase();

    this.operatorWindow = createOperatorWindow();

    this.operatorWindow.on('closed', () => {
      this.operatorWindow = null;
    });

    app.on('window-all-closed', () => {
      this.cleanup();
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }

  private initDatabase(): void {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'karaoke_total.sqlite');
    const backupDir = path.join(userDataPath, 'backups');

    console.log(`[Base de Datos] Conectando a SQLite en: ${dbPath}`);

    const conn = createDatabaseConnection({ filename: dbPath });
    this.sqlite = conn.sqlite;
    this.db = conn.db;

    const migrationResult = runMigrations(this.sqlite, { dbPath, backupDir });
    console.log(
      `[Base de Datos] Migraciones aplicadas: ${migrationResult.applied.length > 0 ? migrationResult.applied.join(', ') : 'Ninguna nueva'}`,
    );

    const settingsRepo = new SettingsRepository(this.db);
    const sessionRepo = new SessionRepository(this.db);
    const mediaRepo = new MediaRepository(this.db);

    // Reconstruir watchers para todas las carpetas autorizadas y habilitadas
    const folders = mediaRepo.listFolders();
    for (const folder of folders) {
      if (folder.enabled) {
        const fullFolder = mediaRepo.getFolderById(folder.id);
        if (fullFolder?.absolutePath) {
          this.watcher.watchFolder(folder.id, fullFolder.absolutePath, (event) => {
            if (this.operatorWindow && !this.operatorWindow.isDestroyed()) {
              this.operatorWindow.webContents.send(IPC_CHANNELS.EVENT_SCAN_PROGRESS, {
                folderId: event.folderId,
                type: event.type,
                status: 'COMPLETED',
              });
            }
          });
        }
      }
    }

    registerAllIpcHandlers({
      settingsRepo,
      sessionRepo,
      mediaRepo,
      watcher: this.watcher,
      getWindow: () => this.operatorWindow,
    });
  }

  public cleanup(): void {
    this.watcher.closeAll();

    if (this.sqlite) {
      try {
        console.log('[Base de Datos] Cerrando conexión SQLite de forma segura.');
        this.sqlite.close();
      } catch (err) {
        console.error('Error al cerrar base de datos:', err);
      } finally {
        this.sqlite = null;
        this.db = null;
      }
    }
  }
}
