import { eq } from 'drizzle-orm';
import { KaraokeDatabase } from '../connection.js';
import { settingsTable } from '../schema.js';
import { SettingsDTO, UpdateSettingsDTO } from '@karaoke/contracts';
import { randomUUID } from 'node:crypto';

export class SettingsRepository {
  constructor(private db: KaraokeDatabase) {}

  public getOrCreateSettings(): SettingsDTO {
    const rows = this.db.select().from(settingsTable).limit(1).all();
    if (rows.length > 0 && rows[0]) {
      const row = rows[0];
      return {
        id: row.id,
        language: (row.language as 'es' | 'en') || 'es',
        theme: (row.theme as 'dark' | 'light') || 'dark',
        operatorDisplayId: row.operatorDisplayId,
        publicDisplayId: row.publicDisplayId,
        masterVolume: row.masterVolume,
        karaokeVolume: row.karaokeVolume,
        ambientVolume: row.ambientVolume,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }

    const now = new Date().toISOString();
    const defaultSettings: SettingsDTO = {
      id: randomUUID(),
      language: 'es',
      theme: 'dark',
      operatorDisplayId: null,
      publicDisplayId: null,
      masterVolume: 80,
      karaokeVolume: 100,
      ambientVolume: 30,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .insert(settingsTable)
      .values({
        id: defaultSettings.id,
        language: defaultSettings.language,
        theme: defaultSettings.theme,
        operatorDisplayId: defaultSettings.operatorDisplayId,
        publicDisplayId: defaultSettings.publicDisplayId,
        masterVolume: defaultSettings.masterVolume,
        karaokeVolume: defaultSettings.karaokeVolume,
        ambientVolume: defaultSettings.ambientVolume,
        createdAt: defaultSettings.createdAt,
        updatedAt: defaultSettings.updatedAt,
      })
      .run();

    return defaultSettings;
  }

  public updateSettings(updates: UpdateSettingsDTO): SettingsDTO {
    const current = this.getOrCreateSettings();
    const now = new Date().toISOString();

    const patch: Partial<typeof settingsTable.$inferInsert> = {
      updatedAt: now,
    };

    if (updates.language !== undefined) patch.language = updates.language;
    if (updates.theme !== undefined) patch.theme = updates.theme;
    if (updates.operatorDisplayId !== undefined)
      patch.operatorDisplayId = updates.operatorDisplayId;
    if (updates.publicDisplayId !== undefined)
      patch.publicDisplayId = updates.publicDisplayId;
    if (updates.masterVolume !== undefined) patch.masterVolume = updates.masterVolume;
    if (updates.karaokeVolume !== undefined) patch.karaokeVolume = updates.karaokeVolume;
    if (updates.ambientVolume !== undefined) patch.ambientVolume = updates.ambientVolume;

    this.db.update(settingsTable).set(patch).where(eq(settingsTable.id, current.id)).run();

    return this.getOrCreateSettings();
  }
}
