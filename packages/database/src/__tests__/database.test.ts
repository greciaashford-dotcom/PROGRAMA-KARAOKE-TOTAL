import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabaseConnection } from '../connection.js';
import { runMigrations } from '../migrator.js';
import { SettingsRepository } from '../repositories/settings-repository.js';
import { SessionRepository } from '../repositories/session-repository.js';
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

    // Verificar que las tablas existen
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

    // Re-lectura
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
});
