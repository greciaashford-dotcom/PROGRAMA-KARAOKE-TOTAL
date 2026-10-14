import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import {
  createDatabaseConnection,
  runMigrations,
  SettingsRepository,
  SessionRepository,
  KaraokeDatabase,
} from '@karaoke/database';
import { Database as DatabaseInstance } from 'better-sqlite3';
import { registerAllIpcHandlers } from './ipc/index.js';
import { createOperatorWindow } from './windows/operator-window.js';
import { setupSecurity } from './security.js';

export class AppLifecycle {
  private static instance: AppLifecycle;
  private db: KaraokeDatabase | null = null;
  private sqlite: DatabaseInstance | null = null;
  private operatorWindow: BrowserWindow | null = null;

  public static getInstance(): AppLifecycle {
    if (!AppLifecycle.instance) {
      AppLifecycle.instance = new AppLifecycle();
    }
    return AppLifecycle.instance;
  }

  public async bootstrap(): Promise<void> {
    // 1. Bloqueo de instancia única
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

    // 2. Configurar seguridad global (CSP)
    setupSecurity();

    // 3. Inicializar base de datos local y migraciones
    this.initDatabase();

    // 4. Crear ventana principal del operador
    this.operatorWindow = createOperatorWindow();

    this.operatorWindow.on('closed', () => {
      this.operatorWindow = null;
    });

    // 5. Manejo de ciclo de vida de la aplicación
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

    // Ejecutar migraciones
    const migrationResult = runMigrations(this.sqlite, { dbPath, backupDir });
    console.log(
      `[Base de Datos] Migraciones aplicadas: ${migrationResult.applied.length > 0 ? migrationResult.applied.join(', ') : 'Ninguna nueva'}`,
    );

    // Instanciar repositorios
    const settingsRepo = new SettingsRepository(this.db);
    const sessionRepo = new SessionRepository(this.db);

    // Registrar manejadores IPC con validación
    registerAllIpcHandlers({
      settingsRepo,
      sessionRepo,
    });
  }

  public cleanup(): void {
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
