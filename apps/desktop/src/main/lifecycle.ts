import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import {
  createDatabaseConnection,
  runMigrations,
  SettingsRepository,
  SessionRepository,
  MediaRepository,
  SingerRepository,
  QueueRepository,
  PlaybackRepository,
  KaraokeDatabase,
} from '@karaoke/database';
import { MediaFolderWatcher } from '@karaoke/media-indexer';
import { Database as DatabaseInstance } from 'better-sqlite3';
import { registerAllIpcHandlers } from './ipc/index.js';
import { registerMediaProtocol } from './protocols/media-protocol.js';
import { createOperatorWindow } from './windows/operator-window.js';
import { setupSecurity } from './security.js';
import { IPC_CHANNELS } from '@karaoke/contracts';

export class AppLifecycle {
  private static instance: AppLifecycle;
  private db: KaraokeDatabase | null = null;
  private sqlite: DatabaseInstance | null = null;
  private operatorWindow: BrowserWindow | null = null;
  private publicWindow: BrowserWindow | null = null;
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
    const singerRepo = new SingerRepository(this.db);
    const queueRepo = new QueueRepository(this.db);
    const playbackRepo = new PlaybackRepository(this.db);

    // Registrar protocolo seguro 'karaoke-media://'
    registerMediaProtocol(mediaRepo);

    // Reconciliación resiliente al iniciar:
    // 1. Cola de sesión: reconciliar estados PLAYING a READY
    const latestActiveSession = sessionRepo.getLatestActiveSession();
    if (latestActiveSession) {
      const { recoveredCount } = queueRepo.recoverSessionQueue(latestActiveSession.id);
      if (recoveredCount > 0) {
        console.log(`[Recuperación] Se reconciliaron ${recoveredCount} canciones interrumpidas en la cola.`);
      }
    }

    // 2. Estado de reproducción: nunca iniciar reproducción automática tras un reinicio
    playbackRepo.reconcileStartup();

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
      singerRepo,
      queueRepo,
      playbackRepo,
      watcher: this.watcher,
      getOperatorWindow: () => this.operatorWindow,
      getPublicWindow: () => this.publicWindow,
      setPublicWindow: (win) => {
        this.publicWindow = win;
      },
      getAllWindows: () =>
        [this.operatorWindow, this.publicWindow].filter(
          (w): w is BrowserWindow => w !== null && !w.isDestroyed(),
        ),
    });
  }

  public cleanup(): void {
    this.watcher.closeAll();

    if (this.publicWindow && !this.publicWindow.isDestroyed()) {
      try {
        this.publicWindow.close();
      } catch {
        // Ignorar si ya estaba cerrada
      }
      this.publicWindow = null;
    }

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
