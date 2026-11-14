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
        karaokeMuted: Boolean(row.karaokeMuted),
        ambientMuted: Boolean(row.ambientMuted),
        masterMuted: Boolean(row.masterMuted),
        crossfadeEnabled: row.crossfadeEnabled !== undefined ? Boolean(row.crossfadeEnabled) : true,
        crossfadeDurationSec: row.crossfadeDurationSec ?? 3,
        mixerExpanded: Boolean(row.mixerExpanded),
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
      karaokeMuted: false,
      ambientMuted: false,
      masterMuted: false,
      crossfadeEnabled: true,
      crossfadeDurationSec: 3,
      mixerExpanded: false,
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
        karaokeMuted: defaultSettings.karaokeMuted,
        ambientMuted: defaultSettings.ambientMuted,
        masterMuted: defaultSettings.masterMuted,
        crossfadeEnabled: defaultSettings.crossfadeEnabled,
        crossfadeDurationSec: defaultSettings.crossfadeDurationSec,
        mixerExpanded: defaultSettings.mixerExpanded,
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
    if (updates.karaokeMuted !== undefined) patch.karaokeMuted = updates.karaokeMuted;
    if (updates.ambientMuted !== undefined) patch.ambientMuted = updates.ambientMuted;
    if (updates.masterMuted !== undefined) patch.masterMuted = updates.masterMuted;
    if (updates.crossfadeEnabled !== undefined) patch.crossfadeEnabled = updates.crossfadeEnabled;
    if (updates.crossfadeDurationSec !== undefined)
      patch.crossfadeDurationSec = updates.crossfadeDurationSec;
    if (updates.mixerExpanded !== undefined) patch.mixerExpanded = updates.mixerExpanded;

    this.db.update(settingsTable).set(patch).where(eq(settingsTable.id, current.id)).run();

    return this.getOrCreateSettings();
  }
}
