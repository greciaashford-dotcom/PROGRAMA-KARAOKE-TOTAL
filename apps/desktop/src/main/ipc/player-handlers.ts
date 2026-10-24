import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'node:fs';
import {
  IPC_CHANNELS,
  PlayerCommandSchema,
  ok,
  err,
  ErrorCode,
} from '@karaoke/contracts';
import {
  PlaybackRepository,
  QueueRepository,
  MediaRepository,
} from '@karaoke/database';
import { assertSafePath } from '@karaoke/media-indexer';

export function registerPlayerHandlers(
  playbackRepo: PlaybackRepository,
  queueRepo: QueueRepository,
  mediaRepo: MediaRepository,
  getAllWindows: () => BrowserWindow[],
): void {
  const broadcast = (channel: string, data: unknown) => {
    const windows = getAllWindows();
    for (const win of windows) {
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  };

  const broadcastQueue = (sessionId: string) => {
    const items = queueRepo.getQueueForSession(sessionId);
    broadcast(IPC_CHANNELS.EVENT_QUEUE_UPDATED, { sessionId, items });
  };

  // 1. Obtener estado actual del reproductor
  ipcMain.handle(IPC_CHANNELS.PLAYER_GET_STATE, async () => {
    try {
      return ok(playbackRepo.getPlaybackState());
    } catch (error) {
      console.error('Error al obtener estado del reproductor:', error);
      return err(ErrorCode.DATABASE_ERROR, 'No se pudo consultar el estado del reproductor.');
    }
  });

  // 2. Preparar canción de la cola para reproducción
  ipcMain.handle(
    IPC_CHANNELS.PLAYER_PREPARE,
    async (
      _event,
      payload: { sessionId: string; queueItemId: string },
    ) => {
      try {
        const items = queueRepo.getQueueForSession(payload.sessionId);
        const targetItem = items.find((i) => i.id === payload.queueItemId);

        if (!targetItem) {
          return err(ErrorCode.NOT_FOUND, 'Elemento de cola no encontrado para preparación.');
        }

        if (!targetItem.song || !targetItem.song.asset || !targetItem.singer) {
          return err(
            ErrorCode.VALIDATION_ERROR,
            'Metadatos de canción o cantante incompletos para el elemento de cola.',
          );
        }

        // Comprobar existencia física del archivo en disco antes de preparar
        const fileDetails = mediaRepo.getAssetFileDetails(targetItem.song.mediaAssetId);
        if (!fileDetails) {
          return err(ErrorCode.NOT_FOUND, 'Archivo multimedia no encontrado en el catálogo.');
        }

        let safePath: string;
        try {
          safePath = await assertSafePath(fileDetails.folderAbsolutePath, fileDetails.absolutePath);
        } catch {
          return err(ErrorCode.UNAUTHORIZED_PATH, 'Ruta de archivo fuera de la carpeta autorizada.');
        }

        if (!fs.existsSync(safePath)) {
          mediaRepo.updateAssetStatus(targetItem.song.mediaAssetId, 'MISSING');
          try {
            if (targetItem.status === 'QUEUED' || targetItem.status === 'CALLED') {
              queueRepo.transitionQueueItem(targetItem.id, 'PREPARING');
            }
            queueRepo.transitionQueueItem(
              targetItem.id,
              'FAILED',
              'El archivo ya no se encuentra físicamente en el disco.',
            );
          } catch {
            // Ignorar si ya estaba en estado terminal
          }
          const errSnap = playbackRepo.updatePlaybackState({
            sessionId: payload.sessionId,
            queueItemId: targetItem.id,
            mediaAssetId: targetItem.song.mediaAssetId,
            state: 'ERROR',
            lastErrorCode: 'FILE_MISSING',
          });
          broadcastQueue(payload.sessionId);
          broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, errSnap);
          return err(
            ErrorCode.NOT_FOUND,
            `El archivo "${targetItem.song.asset.filename}" no existe en disco. Se ha marcado como no disponible.`,
          );
        }

        // Si había otro elemento en PLAYING en la sesión, pausarlo primero para evitar conflicto
        for (const item of items) {
          if (item.id !== targetItem.id && item.status === 'PLAYING') {
            try {
              queueRepo.transitionQueueItem(item.id, 'PAUSED');
            } catch {
              // Ignorar
            }
          }
        }

        // Transicionar el elemento objetivo a READY según la máquina de estados
        if (targetItem.status === 'QUEUED') {
          queueRepo.transitionQueueItem(targetItem.id, 'PREPARING');
          queueRepo.transitionQueueItem(targetItem.id, 'READY');
        } else if (targetItem.status === 'CALLED' || targetItem.status === 'PREPARING' || targetItem.status === 'FAILED') {
          queueRepo.transitionQueueItem(targetItem.id, 'READY');
        }

        const mediaUrl = `karaoke-media://asset/${targetItem.song.mediaAssetId}`;
        const durationMs = targetItem.song.asset.durationMs ?? 0;

        const snapshot = playbackRepo.updatePlaybackState({
          sessionId: payload.sessionId,
          queueItemId: targetItem.id,
          mediaAssetId: targetItem.song.mediaAssetId,
          state: 'READY',
          positionMs: 0,
          durationMs,
          lastErrorCode: null,
        });

        broadcastQueue(payload.sessionId);
        broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);

        return ok({
          mediaUrl,
          queueItemId: targetItem.id,
          title: targetItem.song.title,
          artist: targetItem.song.artist,
          singerName: targetItem.singer.displayName,
          durationMs,
          keyShift: targetItem.keyShift,
          extension: targetItem.song.asset.extension,
          snapshot,
        });
      } catch (error: unknown) {
        console.error('Error al preparar pista:', error);
        return err(
          ErrorCode.PLAYBACK_ERROR,
          error instanceof Error ? error.message : 'No se pudo preparar la pista.',
        );
      }
    },
  );

  // 2b. Reproducir / Previsualizar directamente un archivo del catálogo sin requerir cola
  ipcMain.handle(
    IPC_CHANNELS.PLAYER_PREVIEW_ASSET,
    async (_event, payload: { mediaAssetId: string; sessionId?: string | null }) => {
      try {
        const song = mediaRepo.getSongByAssetId(payload.mediaAssetId);
        const fileDetails = mediaRepo.getAssetFileDetails(payload.mediaAssetId);

        if (!song || !fileDetails) {
          return err(ErrorCode.NOT_FOUND, 'Canción o archivo no encontrado en el catálogo.');
        }

        let safePath: string;
        try {
          safePath = await assertSafePath(fileDetails.folderAbsolutePath, fileDetails.absolutePath);
        } catch {
          return err(ErrorCode.UNAUTHORIZED_PATH, 'Ruta fuera de carpeta autorizada.');
        }

        if (!fs.existsSync(safePath)) {
          mediaRepo.updateAssetStatus(payload.mediaAssetId, 'MISSING');
          return err(
            ErrorCode.NOT_FOUND,
            `El archivo "${fileDetails.asset.filename}" ya no se encuentra físicamente en el disco.`,
          );
        }

        // Si había alguna canción de la cola en PLAYING, pausarla limpiamente
        const currentState = playbackRepo.getPlaybackState();
        const activeSessionId = payload.sessionId ?? currentState.sessionId;
        if (activeSessionId) {
          const items = queueRepo.getQueueForSession(activeSessionId);
          let changed = false;
          for (const item of items) {
            if (item.status === 'PLAYING') {
              try {
                queueRepo.transitionQueueItem(item.id, 'PAUSED');
                changed = true;
              } catch {
                // Ignorar
              }
            }
          }
          if (changed) {
            broadcastQueue(activeSessionId);
          }
        }

        const mediaUrl = `karaoke-media://asset/${payload.mediaAssetId}`;
        const durationMs = fileDetails.asset.durationMs ?? 0;

        const snapshot = playbackRepo.updatePlaybackState({
          sessionId: activeSessionId ?? null,
          queueItemId: null,
          mediaAssetId: payload.mediaAssetId,
          state: 'READY',
          positionMs: 0,
          durationMs,
          lastErrorCode: null,
        });

        broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);

        return ok({
          mediaUrl,
          queueItemId: null,
          title: song.title,
          artist: song.artist,
          singerName: 'Reproducción Directa',
          durationMs,
          keyShift: 0,
          extension: fileDetails.asset.extension,
          snapshot,
        });
      } catch (error: unknown) {
        console.error('Error en reproducción directa del catálogo:', error);
        return err(
          ErrorCode.PLAYBACK_ERROR,
          error instanceof Error ? error.message : 'No se pudo cargar el archivo multimedia.',
        );
      }
    },
  );

  // 3. Comandos de control (PLAY, PAUSE, STOP, SEEK, SET_VOLUME)
  ipcMain.handle(IPC_CHANNELS.PLAYER_COMMAND, async (_event, rawCommand: unknown) => {
    try {
      const parseRes = PlayerCommandSchema.safeParse(rawCommand);
      if (!parseRes.success) {
        return err(ErrorCode.VALIDATION_ERROR, `Comando de reproducción inválido: ${parseRes.error.message}`);
      }

      const cmd = parseRes.data;
      const currentState = playbackRepo.getPlaybackState();

      switch (cmd.command) {
        case 'PLAY': {
          if (currentState.queueItemId && currentState.sessionId) {
            const items = queueRepo.getQueueForSession(currentState.sessionId);
            const currentItem = items.find((i) => i.id === currentState.queueItemId);

            // Pausar cualquier otro elemento que pudiera estar PLAYING
            for (const item of items) {
              if (item.id !== currentState.queueItemId && item.status === 'PLAYING') {
                try {
                  queueRepo.transitionQueueItem(item.id, 'PAUSED');
                } catch {
                  // Ignorar
                }
              }
            }

            if (currentItem && currentItem.status !== 'PLAYING') {
              if (currentItem.status === 'QUEUED') {
                queueRepo.transitionQueueItem(currentItem.id, 'PREPARING');
                queueRepo.transitionQueueItem(currentItem.id, 'READY');
              } else if (currentItem.status === 'CALLED') {
                queueRepo.transitionQueueItem(currentItem.id, 'READY');
              }
              queueRepo.transitionQueueItem(currentItem.id, 'PLAYING');
              broadcastQueue(currentState.sessionId);
            }
          }

          const snapshot = playbackRepo.updatePlaybackState({ state: 'PLAYING' });
          broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
          return ok(snapshot);
        }

        case 'PAUSE': {
          if (currentState.queueItemId && currentState.sessionId) {
            const items = queueRepo.getQueueForSession(currentState.sessionId);
            const currentItem = items.find((i) => i.id === currentState.queueItemId);
            if (currentItem && currentItem.status === 'PLAYING') {
              queueRepo.transitionQueueItem(currentItem.id, 'PAUSED');
              broadcastQueue(currentState.sessionId);
            }
          }

          const snapshot = playbackRepo.updatePlaybackState({ state: 'PAUSED' });
          broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
          return ok(snapshot);
        }

        case 'STOP': {
          const snapshot = playbackRepo.updatePlaybackState({
            state: 'STOPPED',
            positionMs: 0,
          });
          broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
          return ok(snapshot);
        }

        case 'SEEK': {
          const snapshot = playbackRepo.updatePlaybackState({
            positionMs: cmd.positionMs,
          });
          broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
          return ok(snapshot);
        }

        case 'SET_VOLUME': {
          const snapshot = playbackRepo.updatePlaybackState({
            volume: cmd.volume,
          });
          broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
          return ok(snapshot);
        }
      }
    } catch (error: unknown) {
      console.error('Error ejecutando comando de reproductor:', error);
      return err(
        ErrorCode.PLAYBACK_ERROR,
        error instanceof Error ? error.message : 'Error al ejecutar comando de reproducción.',
      );
    }
  });

  // 4. Parada de emergencia instantánea (1-clic o atajo de teclado)
  ipcMain.handle(IPC_CHANNELS.PLAYER_EMERGENCY_STOP, async () => {
    try {
      const currentState = playbackRepo.getPlaybackState();

      if (currentState.queueItemId && currentState.sessionId) {
        try {
          const items = queueRepo.getQueueForSession(currentState.sessionId);
          const currentItem = items.find((i) => i.id === currentState.queueItemId);
          if (currentItem && (currentItem.status === 'PLAYING' || currentItem.status === 'PAUSED')) {
            queueRepo.transitionQueueItem(
              currentItem.id,
              'SKIPPED',
              'Parada de emergencia ejecutada por el operador',
            );
            broadcastQueue(currentState.sessionId);
          }
        } catch (warnErr) {
          console.warn('[Parada de Emergencia] Advertencia al transicionar elemento de cola:', warnErr);
        }
      }

      const snapshot = playbackRepo.emergencyStop();
      broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
      return ok(snapshot);
    } catch (error: unknown) {
      console.error('Error en parada de emergencia:', error);
      return err(ErrorCode.PLAYBACK_ERROR, 'Error al ejecutar la parada de emergencia.');
    }
  });

  // 5. Notificación nativa de finalización de pista (HTML5 ended event)
  ipcMain.handle(
    IPC_CHANNELS.PLAYER_REPORT_ENDED,
    async (_event, payload: { queueItemId: string | null }) => {
      try {
        const currentState = playbackRepo.getPlaybackState();

        if (currentState.sessionId && payload.queueItemId) {
          const items = queueRepo.getQueueForSession(currentState.sessionId);
          const currentItem = items.find((i) => i.id === payload.queueItemId);
          if (currentItem && (currentItem.status === 'PLAYING' || currentItem.status === 'PAUSED')) {
            queueRepo.transitionQueueItem(currentItem.id, 'COMPLETED');
            broadcastQueue(currentState.sessionId);
          }
        }

        const snapshot = playbackRepo.updatePlaybackState({
          state: 'ENDED',
          positionMs: 0,
        });

        broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
        return ok(snapshot);
      } catch (error: unknown) {
        console.error('Error reportando fin de pista:', error);
        return err(ErrorCode.PLAYBACK_ERROR, 'Error al registrar la finalización de la pista.');
      }
    },
  );

  // 6. Actualización periódica de progreso/tiempo desde el motor de reproducción
  ipcMain.handle(
    IPC_CHANNELS.PLAYER_UPDATE_PROGRESS,
    async (_event, payload: { positionMs: number; durationMs?: number }) => {
      try {
        return ok(
          playbackRepo.updatePlaybackState({
            positionMs: payload.positionMs,
            durationMs: payload.durationMs,
          }),
        );
      } catch (error) {
        console.error('Error actualizando progreso de reproducción:', error);
        return err(ErrorCode.DATABASE_ERROR, 'Error actualizando progreso.');
      }
    },
  );
}
