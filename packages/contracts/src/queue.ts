import { z } from 'zod';
import { SongDTOSchema } from './library.js';

export const SessionStatusSchema = z.enum(['OPEN', 'PAUSED', 'CLOSED', 'RECOVERING']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const QueueStatusSchema = z.enum([
  'QUEUED',
  'CALLED',
  'PREPARING',
  'READY',
  'PLAYING',
  'PAUSED',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED',
  'FAILED',
]);
export type QueueStatus = z.infer<typeof QueueStatusSchema>;

export const ALLOWED_QUEUE_TRANSITIONS: Record<QueueStatus, readonly QueueStatus[]> = {
  QUEUED: ['CALLED', 'PREPARING', 'CANCELLED', 'SKIPPED'] as const,
  CALLED: ['PREPARING', 'READY', 'SKIPPED', 'CANCELLED'] as const,
  PREPARING: ['READY', 'PLAYING', 'FAILED', 'CANCELLED'] as const,
  READY: ['PLAYING', 'FAILED', 'CANCELLED', 'SKIPPED'] as const,
  PLAYING: ['PAUSED', 'COMPLETED', 'SKIPPED', 'FAILED'] as const,
  PAUSED: ['PLAYING', 'COMPLETED', 'SKIPPED', 'FAILED'] as const,
  COMPLETED: [] as const,
  SKIPPED: ['QUEUED'] as const, // Permite reincorporar a la cola si el cliente regresa
  CANCELLED: ['QUEUED'] as const,
  FAILED: ['READY', 'QUEUED'] as const, // Permite reintentar si se resuelve el archivo
};

export function isValidQueueTransition(current: QueueStatus, next: QueueStatus): boolean {
  if (current === next) return true;
  const allowed = ALLOWED_QUEUE_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export const SessionDTOSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: SessionStatusSchema,
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SessionDTO = z.infer<typeof SessionDTOSchema>;

export const SingerDTOSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  displayName: z.string().min(1),
  tableOrLocation: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SingerDTO = z.infer<typeof SingerDTOSchema>;

export const QueueItemDTOSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  songId: z.string().uuid(),
  singerId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  keyShift: z.number().int().min(-6).max(6).default(0),
  tempoPercent: z.number().int().min(50).max(150).default(100),
  status: QueueStatusSchema,
  failureReason: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  estimatedWaitMs: z.number().int().nonnegative().optional(),
  song: SongDTOSchema.optional(),
  singer: SingerDTOSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type QueueItemDTO = z.infer<typeof QueueItemDTOSchema>;

export const CreateSingerSchema = z.object({
  sessionId: z.string().uuid(),
  displayName: z.string().min(1, 'El nombre o alias del cantante es obligatorio'),
  tableOrLocation: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateSingerDTO = z.infer<typeof CreateSingerSchema>;

export const AddToQueueSchema = z.object({
  sessionId: z.string().uuid(),
  songId: z.string().uuid(),
  singerId: z.string().uuid(),
  keyShift: z.number().int().min(-6).max(6).default(0),
  tempoPercent: z.number().int().min(50).max(150).default(100),
});
export type AddToQueueDTO = z.infer<typeof AddToQueueSchema>;

export const ReorderQueueSchema = z.object({
  sessionId: z.string().uuid(),
  orderedItemIds: z.array(z.string().uuid()).min(1),
});
export type ReorderQueueDTO = z.infer<typeof ReorderQueueSchema>;

export const UndoReorderSchema = z.object({
  sessionId: z.string().uuid(),
  previousOrderedItemIds: z.array(z.string().uuid()).min(1),
});
export type UndoReorderDTO = z.infer<typeof UndoReorderSchema>;

export const QueueTransitionSchema = z.object({
  queueItemId: z.string().uuid(),
  nextStatus: QueueStatusSchema,
  failureReason: z.string().optional(),
});
export type QueueTransitionDTO = z.infer<typeof QueueTransitionSchema>;

export const QueueEventDTOSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  queueItemId: z.string().uuid(),
  eventType: z.string(),
  previousState: z.string().nullable(),
  nextState: z.string(),
  payloadJson: z.string().nullable(),
  createdAt: z.string(),
});
export type QueueEventDTO = z.infer<typeof QueueEventDTOSchema>;
