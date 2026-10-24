import Database, { Database as DatabaseInstance } from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type KaraokeDatabase = BetterSQLite3Database<typeof schema>;

export interface DatabaseConnectionOptions {
  filename: string;
  readonly?: boolean;
}

export function createDatabaseConnection(options: DatabaseConnectionOptions): {
  db: KaraokeDatabase;
  sqlite: DatabaseInstance;
} {
  // Asegurar que el directorio contenedor exista si no es en memoria
  if (options.filename !== ':memory:') {
    const dir = path.dirname(options.filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const electronNativeBinding = path.join(__dirname, 'better_sqlite3.node');
  const useElectronNativeBinding =
    Boolean(process.versions?.electron) && fs.existsSync(electronNativeBinding);

  const sqlite = new Database(options.filename, {
    readonly: options.readonly ?? false,
    fileMustExist: false,
    timeout: 5000,
    ...(useElectronNativeBinding ? { nativeBinding: electronNativeBinding } : {}),
  });

  // Optimizaciones y restricciones innegociables para SQLite
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');

  const db = drizzle(sqlite, { schema });

  return { db, sqlite };
}

/**
 * Realiza una copia de seguridad segura de la base de datos SQLite antes de migraciones
 * y mantiene un historial rotativo limitado.
 */
export function backupDatabase(
  sourceDbPath: string,
  backupDir: string,
  maxBackups: number = 5,
): string | null {
  if (sourceDbPath === ':memory:' || !fs.existsSync(sourceDbPath)) {
    return null;
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${timestamp}.sqlite`;
  const backupPath = path.join(backupDir, backupFileName);

  // Copia segura de archivo SQLite
  fs.copyFileSync(sourceDbPath, backupPath);

  // Rotación de copias antiguas
  try {
    const files = fs
      .readdirSync(backupDir)
      .filter((file) => file.startsWith('backup-') && file.endsWith('.sqlite'))
      .map((file) => ({
        file,
        fullPath: path.join(backupDir, file),
        time: fs.statSync(path.join(backupDir, file)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > maxBackups) {
      const toRemove = files.slice(maxBackups);
      for (const item of toRemove) {
        fs.unlinkSync(item.fullPath);
      }
    }
  } catch (err) {
    console.error('Error rotando copias de seguridad de base de datos:', err);
  }

  return backupPath;
}
