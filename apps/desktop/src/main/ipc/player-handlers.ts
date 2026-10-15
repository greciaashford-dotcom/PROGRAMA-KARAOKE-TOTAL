import { ipcMain, BrowserWindow } from 'electron';
import {
  IPC_CHANNELS,
  PlayerCommandSchema,
  PlaybackSnapshotDTO,
} from '@karaoke/contracts';
import {
  PlaybackRepository,
  QueueRepository,
  MediaRepository,
} from '@karaoke/database';

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

  // 1. Obtener estado actual del reproductor
  ipcMain.handle(IPC_CHANNELS.PLAYER_GET_STATE, async () => {
    return playbackRepo.getPlaybackState();
  });

  // 2. Preparar canción para reproducción
  ipcMain.handle(
    IPC_CHANNELS.PLAYER_PREPARE,
    async (
      _event,
      payload: { sessionId: string; queueItemId: string },
    ): Promise<{
      success: boolean;
      mediaUrl: string;
      queueItemId: string;
      title: string;
      artist: string;
      singerName: string;
      durationMs: number;
      keyShift: number;
      snapshot: PlaybackSnapshotDTO;
    }> => {
      const items = queueRepo.getQueueForSession(payload.sessionId);
      const targetItem = items.find((i) => i.id === payload.queueItemId);

      if (!targetItem) {
        throw new Error('Elemento de cola no encontrado para preparación.');
      }

      if (!targetItem.song || !targetItem.song.asset || !targetItem.singer) {
        throw new Error('Metadatos de canción o cantante incompletos para el elemento de cola.');
      }

      // Si está en QUEUED o CALLED, transicionar a PREPARING y luego READY
      if (targetItem.status === 'QUEUED' || targetItem.status === 'CALLED') {
        queueRepo.transitionQueueItem(targetItem.id, 'PREPARING');
        queueRepo.transitionQueueItem(targetItem.id, 'READY');
      } else if (targetItem.status === 'PREPARING') {
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

      broadcast(IPC_CHANNELS.EVENT_QUEUE_UPDATED, { sessionId: payload.sessionId });
      broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);

      return {
        success: true,
        mediaUrl,
        queueItemId: targetItem.id,
        title: targetItem.song.title,
        artist: targetItem.song.artist,
        singerName: targetItem.singer.displayName,
        durationMs,
        keyShift: targetItem.keyShift,
        snapshot,
      };
    },
  );

  // 3. Comandos de control (PLAY, PAUSE, STOP, SEEK, SET_VOLUME)
  ipcMain.handle(IPC_CHANNELS.PLAYER_COMMAND, async (_event, rawCommand: unknown) => {
    const parseRes = PlayerCommandSchema.safeParse(rawCommand);
    if (!parseRes.success) {
      throw new Error(`Comando de reproducción inválido: ${parseRes.error.message}`);
    }

    const cmd = parseRes.data;
    const currentState = playbackRepo.getPlaybackState();

    switch (cmd.command) {
      case 'PLAY': {
        if (currentState.queueItemId) {
          const items = currentState.sessionId ? queueRepo.getQueueForSession(currentState.sessionId) : [];
          const currentItem = items.find((i) => i.id === currentState.queueItemId);

          if (currentItem && currentItem.status !== 'PLAYING') {
            queueRepo.transitionQueueItem(currentItem.id, 'PLAYING');
            if (currentState.sessionId) {
              broadcast(IPC_CHANNELS.EVENT_QUEUE_UPDATED, { sessionId: currentState.sessionId });
            }
          }
        }

        const snapshot = playbackRepo.updatePlaybackState({ state: 'PLAYING' });
        broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
        return snapshot;
      }

      case 'PAUSE': {
        if (currentState.queueItemId && currentState.sessionId) {
          const items = queueRepo.getQueueForSession(currentState.sessionId);
          const currentItem = items.find((i) => i.id === currentState.queueItemId);
          if (currentItem && currentItem.status === 'PLAYING') {
            queueRepo.transitionQueueItem(currentItem.id, 'PAUSED');
            broadcast(IPC_CHANNELS.EVENT_QUEUE_UPDATED, { sessionId: currentState.sessionId });
          }
        }

        const snapshot = playbackRepo.updatePlaybackState({ state: 'PAUSED' });
        broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
        return snapshot;
      }

      case 'STOP': {
        const snapshot = playbackRepo.updatePlaybackState({
          state: 'STOPPED',
          positionMs: 0,
        });
        broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
        return snapshot;
      }

      case 'SEEK': {
        const snapshot = playbackRepo.updatePlaybackState({
          positionMs: cmd.positionMs,
        });
        broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
        return snapshot;
      }

      case 'SET_VOLUME': {
        const snapshot = playbackRepo.updatePlaybackState({
          volume: cmd.volume,
        });
        broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
        return snapshot;
      }
    }
  });

  // 4. Parada de emergencia instantánea (1-clic o atajo de teclado)
  ipcMain.handle(IPC_CHANNELS.PLAYER_EMERGENCY_STOP, async () => {
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
          broadcast(IPC_CHANNELS.EVENT_QUEUE_UPDATED, { sessionId: currentState.sessionId });
        }
      } catch (err) {
        console.warn('[Parada de Emergencia] Advertencia al transicionar elemento de cola:', err);
      }
    }

    const snapshot = playbackRepo.emergencyStop();
    broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
    return snapshot;
  });

  // 5. Notificación nativa de finalización de pista (HTML5 ended event)
  ipcMain.handle(
    IPC_CHANNELS.PLAYER_REPORT_ENDED,
    async (_event, payload: { queueItemId: string }) => {
      const currentState = playbackRepo.getPlaybackState();

      if (currentState.sessionId && payload.queueItemId) {
        const items = queueRepo.getQueueForSession(currentState.sessionId);
        const currentItem = items.find((i) => i.id === payload.queueItemId);
        if (currentItem && (currentItem.status === 'PLAYING' || currentItem.status === 'PAUSED')) {
          queueRepo.transitionQueueItem(currentItem.id, 'COMPLETED');
          broadcast(IPC_CHANNELS.EVENT_QUEUE_UPDATED, { sessionId: currentState.sessionId });
        }
      }

      const snapshot = playbackRepo.updatePlaybackState({
        state: 'ENDED',
        positionMs: 0,
      });

      broadcast(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, snapshot);
      return snapshot;
    },
  );

  // 6. Actualización periódica de progreso/tiempo desde el motor de reproducción
  ipcMain.handle(
    IPC_CHANNELS.PLAYER_UPDATE_PROGRESS,
    async (_event, payload: { positionMs: number; durationMs?: number }) => {
      return playbackRepo.updatePlaybackState({
        positionMs: payload.positionMs,
        durationMs: payload.durationMs,
      });
    },
  );
}
