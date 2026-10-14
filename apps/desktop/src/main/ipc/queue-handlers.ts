import { ipcMain, BrowserWindow } from 'electron';
import {
  IPC_CHANNELS,
  AddToQueueSchema,
  ReorderQueueSchema,
  UndoReorderSchema,
  QueueTransitionSchema,
  CreateSingerSchema,
  ok,
  err,
  ErrorCode,
} from '@karaoke/contracts';
import { QueueRepository, SingerRepository, SessionRepository } from '@karaoke/database';
import { z } from 'zod';

const SessionIdSchema = z.object({
  sessionId: z.string().uuid(),
});

export function registerQueueHandlers(
  queueRepo: QueueRepository,
  singerRepo: SingerRepository,
  sessionRepo: SessionRepository,
  getWindow: () => BrowserWindow | null,
): void {
  const broadcastQueueUpdate = (sessionId: string) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      const items = queueRepo.getQueueForSession(sessionId);
      win.webContents.send(IPC_CHANNELS.EVENT_QUEUE_UPDATED, { sessionId, items });
    }
  };

  // 1. Obtener cola actual de la sesión
  ipcMain.handle(IPC_CHANNELS.QUEUE_GET, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = SessionIdSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'ID de sesión inválido.');
      }

      const items = queueRepo.getQueueForSession(parseResult.data.sessionId);
      return ok(items);
    } catch (error) {
      console.error('Error al obtener cola:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al consultar la cola de la sesión.');
    }
  });

  // 2. Añadir canción a la cola con cantante
  ipcMain.handle(IPC_CHANNELS.QUEUE_ADD, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = AddToQueueSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(
          ErrorCode.VALIDATION_ERROR,
          'Parámetros de inserción en cola inválidos.',
          parseResult.error.format(),
        );
      }

      const activeSession = sessionRepo.getLatestActiveSession();
      if (!activeSession || activeSession.id !== parseResult.data.sessionId) {
        return err(ErrorCode.INVALID_STATE_TRANSITION, 'No hay una sesión activa abierta para encolar.');
      }

      const item = queueRepo.addToQueue(parseResult.data);
      broadcastQueueUpdate(parseResult.data.sessionId);

      return ok(item);
    } catch (error: unknown) {
      console.error('Error al añadir a la cola:', error);
      return err(
        ErrorCode.INVALID_STATE_TRANSITION,
        error instanceof Error ? error.message : 'No se pudo añadir a la cola.',
      );
    }
  });

  // 3. Reordenar elementos de la cola
  ipcMain.handle(IPC_CHANNELS.QUEUE_REORDER, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = ReorderQueueSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'Parámetros de reordenamiento inválidos.');
      }

      const result = queueRepo.reorderQueue(
        parseResult.data.sessionId,
        parseResult.data.orderedItemIds,
      );

      broadcastQueueUpdate(parseResult.data.sessionId);
      return ok(result);
    } catch (error: unknown) {
      console.error('Error al reordenar cola:', error);
      return err(
        ErrorCode.INVALID_STATE_TRANSITION,
        error instanceof Error ? error.message : 'Error al reordenar la cola.',
      );
    }
  });

  // 4. Deshacer último reordenamiento
  ipcMain.handle(IPC_CHANNELS.QUEUE_UNDO_REORDER, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = UndoReorderSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'Parámetros de deshacer reordenamiento inválidos.');
      }

      queueRepo.undoLastReorder(
        parseResult.data.sessionId,
        parseResult.data.previousOrderedItemIds,
      );

      broadcastQueueUpdate(parseResult.data.sessionId);
      return ok(undefined);
    } catch (error: unknown) {
      console.error('Error al deshacer reordenamiento:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al restaurar el orden previo.');
    }
  });

  // 5. Transición de estado de cola (Máquina de estados formal)
  ipcMain.handle(IPC_CHANNELS.QUEUE_TRANSITION, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = QueueTransitionSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'Parámetros de transición de estado inválidos.');
      }

      const { queueItemId, nextStatus, failureReason } = parseResult.data;
      const updatedItem = queueRepo.transitionQueueItem(queueItemId, nextStatus, failureReason);

      broadcastQueueUpdate(updatedItem.sessionId);
      return ok(updatedItem);
    } catch (error: unknown) {
      console.error('Error en transición de cola:', error);
      return err(
        ErrorCode.INVALID_STATE_TRANSITION,
        error instanceof Error ? error.message : 'Transición de estado no permitida.',
      );
    }
  });

  // 6. Registrar cantante en sesión
  ipcMain.handle(IPC_CHANNELS.SINGER_CREATE, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = CreateSingerSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(
          ErrorCode.VALIDATION_ERROR,
          'Datos del cantante inválidos.',
          parseResult.error.format(),
        );
      }

      const singer = singerRepo.createSinger(parseResult.data);
      return ok(singer);
    } catch (error) {
      console.error('Error al registrar cantante:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al registrar el cantante en la sesión.');
    }
  });

  // 7. Listar cantantes registrados en la sesión
  ipcMain.handle(IPC_CHANNELS.SINGER_LIST, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = SessionIdSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'ID de sesión inválido.');
      }

      const singers = singerRepo.listSingers(parseResult.data.sessionId);
      return ok(singers);
    } catch (error) {
      console.error('Error al listar cantantes:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al consultar los cantantes.');
    }
  });
}
