import { eq } from 'drizzle-orm';
import { KaraokeDatabase } from '../connection.js';
import { playbackStateTable } from '../schema.js';
import { PlaybackSnapshotDTO, PlaybackStatus } from '@karaoke/contracts';

export const PLAYBACK_STATE_SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

export class PlaybackRepository {
  constructor(private db: KaraokeDatabase) {}

  public getPlaybackState(): PlaybackSnapshotDTO {
    let row = this.db
      .select()
      .from(playbackStateTable)
      .where(eq(playbackStateTable.id, PLAYBACK_STATE_SINGLETON_ID))
      .get();

    if (!row) {
      const now = new Date().toISOString();
      this.db
        .insert(playbackStateTable)
        .values({
          id: PLAYBACK_STATE_SINGLETON_ID,
          sessionId: null,
          queueItemId: null,
          mediaAssetId: null,
          state: 'IDLE',
          positionMs: 0,
          durationMs: 0,
          volume: 100,
          lastErrorCode: null,
          updatedAt: now,
        })
        .run();

      row = this.db
        .select()
        .from(playbackStateTable)
        .where(eq(playbackStateTable.id, PLAYBACK_STATE_SINGLETON_ID))
        .get();
    }

    return {
      id: row!.id,
      sessionId: row!.sessionId,
      queueItemId: row!.queueItemId,
      mediaAssetId: row!.mediaAssetId,
      state: row!.state as PlaybackStatus,
      positionMs: row!.positionMs,
      durationMs: row!.durationMs,
      volume: row!.volume,
      lastErrorCode: row!.lastErrorCode,
      updatedAt: row!.updatedAt,
    };
  }

  public updatePlaybackState(
    patch: Partial<{
      sessionId: string | null;
      queueItemId: string | null;
      mediaAssetId: string | null;
      state: PlaybackStatus;
      positionMs: number;
      durationMs: number;
      volume: number;
      lastErrorCode: string | null;
    }>,
  ): PlaybackSnapshotDTO {
    // Asegurar que exista la fila singleton
    this.getPlaybackState();

    const now = new Date().toISOString();
    const updateValues: Record<string, unknown> = {
      updatedAt: now,
    };

    if (patch.sessionId !== undefined) updateValues.sessionId = patch.sessionId;
    if (patch.queueItemId !== undefined) updateValues.queueItemId = patch.queueItemId;
    if (patch.mediaAssetId !== undefined) updateValues.mediaAssetId = patch.mediaAssetId;
    if (patch.state !== undefined) updateValues.state = patch.state;
    if (patch.positionMs !== undefined) updateValues.positionMs = Math.max(0, Math.floor(patch.positionMs));
    if (patch.durationMs !== undefined) updateValues.durationMs = Math.max(0, Math.floor(patch.durationMs));
    if (patch.volume !== undefined) updateValues.volume = Math.max(0, Math.min(100, Math.floor(patch.volume)));
    if (patch.lastErrorCode !== undefined) updateValues.lastErrorCode = patch.lastErrorCode;

    this.db
      .update(playbackStateTable)
      .set(updateValues)
      .where(eq(playbackStateTable.id, PLAYBACK_STATE_SINGLETON_ID))
      .run();

    return this.getPlaybackState();
  }

  public resetPlaybackState(): PlaybackSnapshotDTO {
    return this.updatePlaybackState({
      queueItemId: null,
      mediaAssetId: null,
      state: 'IDLE',
      positionMs: 0,
      durationMs: 0,
      lastErrorCode: null,
    });
  }

  public emergencyStop(): PlaybackSnapshotDTO {
    return this.updatePlaybackState({
      state: 'STOPPED',
      positionMs: 0,
    });
  }

  /**
   * Reconciliación al iniciar:
   * Si la aplicación se cerró abruptamente mientras el reproductor estaba en 'PLAYING' o 'PREPARING',
   * se restablece a 'READY' o 'IDLE' para nunca disparar reproducción automática indeseada.
   */
  public reconcileStartup(): void {
    const current = this.getPlaybackState();
    if (current.state === 'PLAYING' || current.state === 'PREPARING') {
      this.updatePlaybackState({
        state: current.queueItemId ? 'READY' : 'IDLE',
        positionMs: 0,
      });
    }
  }
}
