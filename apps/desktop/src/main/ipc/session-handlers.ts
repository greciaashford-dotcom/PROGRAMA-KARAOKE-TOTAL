import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  ok,
  err,
  ErrorCode,
} from '@karaoke/contracts';
import { SessionRepository } from '@karaoke/database';
import { z } from 'zod';

const OpenSessionPayloadSchema = z.object({
  name: z.string().min(1, 'El nombre de la sesión es requerido'),
});

const CloseSessionPayloadSchema = z.object({
  sessionId: z.string().uuid('ID de sesión inválido'),
});

export function registerSessionHandlers(sessionRepo: SessionRepository): void {
  ipcMain.handle(IPC_CHANNELS.SESSION_GET_CURRENT, async () => {
    try {
      const session = sessionRepo.getLatestActiveSession();
      return ok(session);
    } catch (error) {
      console.error('Error al obtener sesión activa:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al consultar la sesión activa.');
    }
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_OPEN, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = OpenSessionPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(
          ErrorCode.VALIDATION_ERROR,
          'Datos de apertura de sesión inválidos.',
          parseResult.error.format(),
        );
      }

      const session = sessionRepo.openSession(parseResult.data.name);
      return ok(session);
    } catch (error) {
      console.error('Error al abrir sesión:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al abrir la sesión en base de datos.');
    }
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_PAUSE, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = CloseSessionPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'Identificador de sesión inválido.');
      }

      const updated = sessionRepo.pauseSession(parseResult.data.sessionId);
      if (!updated) {
        return err(ErrorCode.NOT_FOUND, 'Sesión no encontrada.');
      }
      return ok(updated);
    } catch (error) {
      console.error('Error al pausar sesión:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al pausar la sesión.');
    }
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_RESUME, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = CloseSessionPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'Identificador de sesión inválido.');
      }

      const updated = sessionRepo.resumeSession(parseResult.data.sessionId);
      if (!updated) {
        return err(ErrorCode.NOT_FOUND, 'Sesión no encontrada.');
      }
      return ok(updated);
    } catch (error) {
      console.error('Error al reanudar sesión:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al reanudar la sesión.');
    }
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_CLOSE, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = CloseSessionPayloadSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(
          ErrorCode.VALIDATION_ERROR,
          'Identificador de sesión inválido.',
          parseResult.error.format(),
        );
      }

      sessionRepo.closeSession(parseResult.data.sessionId);
      return ok(undefined);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al cerrar la sesión.');
    }
  });
}
