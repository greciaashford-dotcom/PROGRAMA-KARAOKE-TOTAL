import { Database as DatabaseInstance } from 'better-sqlite3';
import { backupDatabase } from './connection.js';

export interface Migration {
  id: string;
  name: string;
  up: (sqlite: DatabaseInstance) => void;
}

export const initialMigration: Migration = {
  id: '0001_initial_schema',
  name: 'Creación de esquema inicial del MVP local',
  up: (sqlite: DatabaseInstance) => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY NOT NULL,
        language TEXT NOT NULL DEFAULT 'es',
        theme TEXT NOT NULL DEFAULT 'dark',
        operator_display_id TEXT,
        public_display_id TEXT,
        master_volume INTEGER NOT NULL DEFAULT 80,
        karaoke_volume INTEGER NOT NULL DEFAULT 100,
        ambient_volume INTEGER NOT NULL DEFAULT 30,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media_folders (
        id TEXT PRIMARY KEY NOT NULL,
        display_name TEXT NOT NULL,
        absolute_path_encrypted_or_local_only TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'KARAOKE',
        enabled INTEGER NOT NULL DEFAULT 1,
        last_scan_started_at TEXT,
        last_scan_completed_at TEXT,
        scan_status TEXT NOT NULL DEFAULT 'IDLE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY NOT NULL,
        folder_id TEXT NOT NULL REFERENCES media_folders(id) ON DELETE CASCADE,
        relative_path TEXT NOT NULL,
        filename TEXT NOT NULL,
        extension TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        modified_at TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        duration_ms INTEGER,
        container TEXT,
        video_codec TEXT,
        audio_codec TEXT,
        width INTEGER,
        height INTEGER,
        audio_channels INTEGER,
        status TEXT NOT NULL DEFAULT 'PENDING_ANALYSIS',
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_folder_relative ON media_assets (folder_id, relative_path);
      CREATE INDEX IF NOT EXISTS idx_media_assets_fingerprint ON media_assets (fingerprint);
      CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets (status);

      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY NOT NULL,
        media_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        language TEXT,
        genre TEXT,
        collection TEXT,
        disc TEXT,
        track TEXT,
        search_text_normalized TEXT NOT NULL,
        metadata_source TEXT NOT NULL DEFAULT 'FILENAME',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_songs_search ON songs (search_text_normalized);
      CREATE INDEX IF NOT EXISTS idx_songs_asset ON songs (media_asset_id);

      CREATE TABLE IF NOT EXISTS karaoke_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS singers (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES karaoke_sessions(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        table_or_location TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_singers_session ON singers (session_id);

      CREATE TABLE IF NOT EXISTS queue_items (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES karaoke_sessions(id) ON DELETE CASCADE,
        song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE RESTRICT,
        singer_id TEXT NOT NULL REFERENCES singers(id) ON DELETE RESTRICT,
        position INTEGER NOT NULL,
        key_shift INTEGER NOT NULL DEFAULT 0,
        tempo_percent INTEGER NOT NULL DEFAULT 100,
        status TEXT NOT NULL DEFAULT 'QUEUED',
        failure_reason TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_queue_items_session_pos ON queue_items (session_id, position);
      CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items (status);

      CREATE TABLE IF NOT EXISTS queue_events (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES karaoke_sessions(id) ON DELETE CASCADE,
        queue_item_id TEXT NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        previous_state TEXT,
        next_state TEXT NOT NULL,
        payload_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_queue_events_item ON queue_events (queue_item_id);
      CREATE INDEX IF NOT EXISTS idx_queue_events_session ON queue_events (session_id);

      CREATE TABLE IF NOT EXISTS playback_state (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT REFERENCES karaoke_sessions(id) ON DELETE SET NULL,
        queue_item_id TEXT REFERENCES queue_items(id) ON DELETE SET NULL,
        media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
        state TEXT NOT NULL DEFAULT 'IDLE',
        position_ms INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        volume INTEGER NOT NULL DEFAULT 100,
        last_error_code TEXT,
        updated_at TEXT NOT NULL
      );
    `);
  },
};

export const MIGRATIONS: Migration[] = [initialMigration];

export function runMigrations(
  sqlite: DatabaseInstance,
  options?: { dbPath?: string; backupDir?: string },
): { applied: string[]; alreadyApplied: string[] } {
  // Crear tabla de control de migraciones
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = sqlite.prepare('SELECT id FROM __migrations').all() as { id: string }[];
  const appliedSet = new Set(appliedRows.map((r) => r.id));

  const pendingMigrations = MIGRATIONS.filter((m) => !appliedSet.has(m.id));

  if (pendingMigrations.length === 0) {
    return {
      applied: [],
      alreadyApplied: Array.from(appliedSet),
    };
  }

  // Si hay migraciones pendientes y se proporcionó ruta de archivo, crear copia de respaldo
  if (options?.dbPath && options?.backupDir) {
    backupDatabase(options.dbPath, options.backupDir);
  }

  const newlyApplied: string[] = [];

  // Ejecutar migraciones en una transacción atómica
  const runBatch = sqlite.transaction(() => {
    const insertMigration = sqlite.prepare(`
      INSERT INTO __migrations (id, name, applied_at)
      VALUES (?, ?, ?)
    `);

    for (const migration of pendingMigrations) {
      migration.up(sqlite);
      insertMigration.run(migration.id, migration.name, new Date().toISOString());
      newlyApplied.push(migration.id);
    }
  });

  runBatch();

  return {
    applied: newlyApplied,
    alreadyApplied: Array.from(appliedSet),
  };
}
