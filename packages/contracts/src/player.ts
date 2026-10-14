import { z } from 'zod';

export const PlaybackStatusSchema = z.enum([
  'IDLE',
  'PREPARING',
  'READY',
  'PLAYING',
  'PAUSED',
  'STOPPED',
  'ENDED',
  'ERROR',
]);
export type PlaybackStatus = z.infer<typeof PlaybackStatusSchema>;

export const PlaybackSnapshotSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  queueItemId: z.string().uuid().nullable(),
  mediaAssetId: z.string().uuid().nullable(),
  state: PlaybackStatusSchema,
  positionMs: z.number().int().nonnegative().default(0),
  durationMs: z.number().int().nonnegative().default(0),
  volume: z.number().int().min(0).max(100).default(100),
  lastErrorCode: z.string().nullable(),
  updatedAt: z.string(),
});
export type PlaybackSnapshotDTO = z.infer<typeof PlaybackSnapshotSchema>;

export const PlayerCommandSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('PLAY') }),
  z.object({ command: z.literal('PAUSE') }),
  z.object({ command: z.literal('STOP') }),
  z.object({ command: z.literal('SEEK'), positionMs: z.number().int().nonnegative() }),
  z.object({ command: z.literal('SET_VOLUME'), volume: z.number().int().min(0).max(100) }),
]);
export type PlayerCommandDTO = z.infer<typeof PlayerCommandSchema>;
