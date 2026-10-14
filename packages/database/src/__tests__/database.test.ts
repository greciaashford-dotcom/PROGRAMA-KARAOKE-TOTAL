import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabaseConnection } from '../connection.js';
import { runMigrations } from '../migrator.js';
import { SettingsRepository } from '../repositories/settings-repository.js';
import { SessionRepository } from '../repositories/session-repository.js';
import { MediaRepository } from '../repositories/media-repository.js';
import { Database as DatabaseInstance } from 'better-sqlite3';
import { KaraokeDatabase } from '../connection.js';

describe('Capa de Base de Datos SQLite y Migraciones', () => {
  let sqlite: DatabaseInstance;
  let db: KaraokeDatabase;

  beforeEach(() => {
    const conn = createDatabaseConnection({ filename: ':memory:' });
    sqlite = conn.sqlite;
    db = conn.db;
  });

  afterEach(() => {
    sqlite.close();
  });

  it('debe ejecutar las migraciones iniciales exitosamente', () => {
    const result = runMigrations(sqlite);
    expect(result.applied).toContain('0001_initial_schema');

    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('media_folders');
    expect(tableNames).toContain('media_assets');
    expect(tableNames).toContain('songs');
    expect(tableNames).toContain('karaoke_sessions');
    expect(tableNames).toContain('singers');
    expect(tableNames).toContain('queue_items');
    expect(tableNames).toContain('queue_events');
    expect(tableNames).toContain('playback_state');
    expect(tableNames).toContain('__migrations');
  });

  it('debe ser idempotente: no aplicar migraciones duplicadas', () => {
    const firstRun = runMigrations(sqlite);
    expect(firstRun.applied.length).toBe(1);

    const secondRun = runMigrations(sqlite);
    expect(secondRun.applied.length).toBe(0);
    expect(secondRun.alreadyApplied).toContain('0001_initial_schema');
  });

  it('SettingsRepository debe crear valores por defecto y permitir actualizarlos', () => {
    runMigrations(sqlite);
    const repo = new SettingsRepository(db);

    const initial = repo.getOrCreateSettings();
    expect(initial.language).toBe('es');
    expect(initial.theme).toBe('dark');
    expect(initial.masterVolume).toBe(80);

    const updated = repo.updateSettings({
      masterVolume: 95,
      language: 'en',
    });

    expect(updated.masterVolume).toBe(95);
    expect(updated.language).toBe('en');

    const reloaded = repo.getOrCreateSettings();
    expect(reloaded.masterVolume).toBe(95);
    expect(reloaded.language).toBe('en');
  });

  it('SessionRepository debe abrir y cerrar sesiones de karaoke', () => {
    runMigrations(sqlite);
    const repo = new SessionRepository(db);

    expect(repo.getLatestActiveSession()).toBeNull();

    const session = repo.openSession('Sesión Viernes Noche');
    expect(session.name).toBe('Sesión Viernes Noche');
    expect(session.status).toBe('OPEN');

    const active = repo.getLatestActiveSession();
    expect(active?.id).toBe(session.id);

    repo.closeSession(session.id);
    expect(repo.getLatestActiveSession()).toBeNull();
  });

  it('MediaRepository debe registrar carpetas, sincronizar lotes y consultar catálogo', () => {
    runMigrations(sqlite);
    const repo = new MediaRepository(db);

    // 1. Añadir carpeta
    const folder = repo.addFolder('C:\\KaraokeFiles', 'Carpeta Principal');
    expect(folder.id).toBeDefined();
    expect(folder.displayName).toBe('Carpeta Principal');

    // 2. Sincronizar lote
    repo.syncScannedBatch(folder.id, [
      {
        relativePath: 'Queen - Bohemian Rhapsody.mp4',
        filename: 'Queen - Bohemian Rhapsody.mp4',
        extension: '.mp4',
        sizeBytes: 45000000,
        modifiedAt: new Date().toISOString(),
        fingerprint: 'dummyfp1',
        durationMs: 354000,
        container: 'mov,mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1920,
        height: 1080,
        audioChannels: 2,
        status: 'AVAILABLE',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        searchTextNormalized: 'queen bohemian rhapsody',
      },
      {
        relativePath: 'ABBA - Waterloo.mp4',
        filename: 'ABBA - Waterloo.mp4',
        extension: '.mp4',
        sizeBytes: 32000000,
        modifiedAt: new Date().toISOString(),
        fingerprint: 'dummyfp2',
        durationMs: 165000,
        container: 'mov,mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1920,
        height: 1080,
        audioChannels: 2,
        status: 'AVAILABLE',
        title: 'Waterloo',
        artist: 'ABBA',
        searchTextNormalized: 'abba waterloo',
      },
    ]);

    // 3. Consulta paginada
    const res = repo.queryCatalog({ page: 1, pageSize: 10, sortBy: 'title', sortOrder: 'asc' });
    expect(res.total).toBe(2);
    expect(res.items.length).toBe(2);
    expect(res.items[0]?.title).toBe('Bohemian Rhapsody');

    // 4. Búsqueda normalizada
    const searchRes = repo.queryCatalog({ search: 'waterloo', page: 1, pageSize: 10, sortBy: 'title', sortOrder: 'asc' });
    expect(searchRes.total).toBe(1);
    expect(searchRes.items[0]?.artist).toBe('ABBA');

    // 5. Edición manual y preservación
    const songId = res.items[0]!.id;
    const edited = repo.updateSongMetadata({
      songId,
      title: 'Bohemian Rhapsody (Live Aid Edit)',
      artist: 'Queen Official',
    });
    expect(edited?.title).toBe('Bohemian Rhapsody (Live Aid Edit)');
    expect(edited?.metadataSource).toBe('MANUAL');

    // Re-sincronización: no debe sobrescribir edición manual
    repo.syncScannedBatch(folder.id, [
      {
        relativePath: 'Queen - Bohemian Rhapsody.mp4',
        filename: 'Queen - Bohemian Rhapsody.mp4',
        extension: '.mp4',
        sizeBytes: 45000000,
        modifiedAt: new Date().toISOString(),
        fingerprint: 'dummyfp1',
        durationMs: 354000,
        container: 'mov,mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1920,
        height: 1080,
        audioChannels: 2,
        status: 'AVAILABLE',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        searchTextNormalized: 'queen bohemian rhapsody',
      },
    ]);

    const checkSong = repo.queryCatalog({ search: 'Live Aid', page: 1, pageSize: 10, sortBy: 'title', sortOrder: 'asc' });
    expect(checkSong.total).toBe(1);
    expect(checkSong.items[0]?.title).toBe('Bohemian Rhapsody (Live Aid Edit)');

    // 6. Reconciliación de ausentes
    const missing = repo.reconcileMissingAssets(folder.id, new Set(['Queen - Bohemian Rhapsody.mp4']));
    expect(missing).toBe(1); // ABBA - Waterloo no estaba en el conjunto visto

    const abbaCheck = repo.queryCatalog({ search: 'waterloo', page: 1, pageSize: 10, sortBy: 'title', sortOrder: 'asc' });
    expect(abbaCheck.items[0]?.asset?.status).toBe('MISSING');
  });
});
