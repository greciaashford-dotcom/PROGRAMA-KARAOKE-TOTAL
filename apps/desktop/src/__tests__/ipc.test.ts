import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabaseConnection,
  runMigrations,
  SettingsRepository,
  SessionRepository,
  KaraokeDatabase,
} from '@karaoke/database';
import { Database as DatabaseInstance } from 'better-sqlite3';
import {
  UpdateSettingsSchema,
  AssignDisplaysSchema,
  DisplayInfoSchema,
  DisplayInfo,
  ok,
  err,
  ErrorCode,
} from '@karaoke/contracts';

describe('Pruebas de Lógica IPC y Repositorios en Fase 1', () => {
  let sqlite: DatabaseInstance;
  let db: KaraokeDatabase;
  let settingsRepo: SettingsRepository;
  let sessionRepo: SessionRepository;

  beforeEach(() => {
    const conn = createDatabaseConnection({ filename: ':memory:' });
    sqlite = conn.sqlite;
    db = conn.db;
    runMigrations(sqlite);
    settingsRepo = new SettingsRepository(db);
    sessionRepo = new SessionRepository(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('debe obtener la configuración por defecto y validar tipos con Zod', () => {
    const settings = settingsRepo.getOrCreateSettings();
    expect(settings.id).toBeDefined();
    expect(settings.language).toBe('es');
    expect(settings.masterVolume).toBe(80);
    expect(settings.karaokeVolume).toBe(100);
    expect(settings.ambientVolume).toBe(30);
  });

  it('debe rechazar actualizaciones con volumen fuera de rango (mayor a 100 o negativo)', () => {
    const invalidPayloadHigh = { masterVolume: 150 };
    const parseResultHigh = UpdateSettingsSchema.safeParse(invalidPayloadHigh);
    expect(parseResultHigh.success).toBe(false);

    const invalidPayloadNeg = { masterVolume: -10 };
    const parseResultNeg = UpdateSettingsSchema.safeParse(invalidPayloadNeg);
    expect(parseResultNeg.success).toBe(false);
  });

  it('debe validar y aplicar actualizaciones de configuración válidas', () => {
    const validPayload = {
      masterVolume: 75,
      karaokeVolume: 90,
      language: 'en' as const,
    };
    const parseResult = UpdateSettingsSchema.safeParse(validPayload);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const updated = settingsRepo.updateSettings(parseResult.data);
      expect(updated.masterVolume).toBe(75);
      expect(updated.karaokeVolume).toBe(90);
      expect(updated.language).toBe('en');

      const resultWrapper = ok(updated);
      expect(resultWrapper.success).toBe(true);
      expect(resultWrapper.data.masterVolume).toBe(75);
    }
  });

  it('debe abrir una sesión, obtenerla como activa y cerrarla limpiamente', () => {
    expect(sessionRepo.getLatestActiveSession()).toBeNull();

    const session = sessionRepo.openSession('Sesión Inaugural');
    expect(session.name).toBe('Sesión Inaugural');
    expect(session.status).toBe('OPEN');

    const current = sessionRepo.getLatestActiveSession();
    expect(current?.id).toBe(session.id);
    expect(current?.name).toBe('Sesión Inaugural');

    sessionRepo.closeSession(session.id);
    expect(sessionRepo.getLatestActiveSession()).toBeNull();
  });

  it('debe generar errores estructurados con AppError y Result pattern', () => {
    const failureResult = err(ErrorCode.VALIDATION_ERROR, 'Carga útil corrupta', {
      field: 'volume',
    });
    expect(failureResult.success).toBe(false);
    expect(failureResult.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(failureResult.error.message).toBe('Carga útil corrupta');
  });

  it('debe validar y persistir la asignación de monitores con AssignDisplaysSchema', () => {
    const payload = {
      operatorDisplayId: '12345',
      publicDisplayId: '67890',
    };
    const parseResult = AssignDisplaysSchema.safeParse(payload);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      settingsRepo.updateSettings({
        operatorDisplayId: parseResult.data.operatorDisplayId || undefined,
        publicDisplayId: parseResult.data.publicDisplayId || undefined,
      });

      const updated = settingsRepo.getOrCreateSettings();
      expect(updated.operatorDisplayId).toBe('12345');
      expect(updated.publicDisplayId).toBe('67890');
    }
  });

  it('debe validar la estructura de metadatos de monitor con DisplayInfoSchema', () => {
    const monitorData: DisplayInfo = {
      id: '25489',
      label: 'Pantalla 2 (1920x1080 — Secundaria)',
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      isPrimary: false,
      scaleFactor: 1,
    };
    const parseResult = DisplayInfoSchema.safeParse(monitorData);
    expect(parseResult.success).toBe(true);
  });
});
