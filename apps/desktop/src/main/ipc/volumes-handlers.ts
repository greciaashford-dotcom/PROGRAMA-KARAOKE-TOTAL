import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS, ok, err, ErrorCode } from '@karaoke/contracts';
import { VolumesStore, VolumesStoreData } from '../storage/volumes-store.js';

export interface PublicOverlayState {
  mode: 'IDLE' | 'REQUEST_SONG' | 'COUNTDOWN' | 'READY';
  sessionActive?: boolean;
  countdownSec: number | null;
  singerName: string | null;
  songTitle: string | null;
  quickMessage: string | null;
  isApplauseActive?: boolean;
  playbackSpeed?: number;
  hasCustomBackground: boolean;
  backgroundVersion: number;
}

export function registerVolumesHandlers(
  volumesStore: VolumesStore,
  getOperatorWindow: () => BrowserWindow | null,
  getAllWindows: () => BrowserWindow[],
): void {
  let latestOverlay: PublicOverlayState = {
    mode: 'IDLE',
    sessionActive: false,
    countdownSec: null,
    singerName: null,
    songTitle: null,
    quickMessage: null,
    isApplauseActive: false,
    playbackSpeed: 1,
    hasCustomBackground: Boolean(volumesStore.getAll().publicBackgroundPath),
    backgroundVersion: Date.now(),
  };

  const broadcastOverlay = (overlay: PublicOverlayState) => {
    latestOverlay = overlay;
    for (const win of getAllWindows()) {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.EVENT_PUBLIC_OVERLAY_CHANGED, latestOverlay);
      }
    }
  };

  ipcMain.handle(IPC_CHANNELS.VOLUMES_GET_ALL, async () => {
    try {
      return ok(volumesStore.getAll());
    } catch (error) {
      console.error('Error leyendo volumes.json:', error);
      return err(ErrorCode.INTERNAL_ERROR, 'No se pudieron leer los volúmenes memorizados.');
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.VOLUMES_SAVE_SONG,
    async (_event, payload: { songKey: string; volume: number }) => {
      try {
        if (!payload?.songKey) {
          return err(ErrorCode.VALIDATION_ERROR, 'Identificador de canción requerido.');
        }
        const updated = volumesStore.saveSongVolume(payload.songKey, payload.volume);
        return ok(updated);
      } catch (error) {
        console.error('Error guardando volumen de canción:', error);
        return err(ErrorCode.INTERNAL_ERROR, 'No se pudo memorizar el volumen de la canción.');
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.VOLUMES_SAVE_GLOBAL,
    async (_event, payload: Partial<Omit<VolumesStoreData, 'songs'>>) => {
      try {
        const updated = volumesStore.saveGlobal(payload || {});
        return ok(updated);
      } catch (error) {
        console.error('Error guardando volúmenes globales:', error);
        return err(ErrorCode.INTERNAL_ERROR, 'No se pudieron guardar los ajustes de volumen.');
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.PUBLIC_SELECT_BACKGROUND, async () => {
    try {
      const win = getOperatorWindow();
      const opts: Electron.OpenDialogOptions = {
        title: 'Seleccionar Imagen de Fondo para Pantalla Pública',
        properties: ['openFile'],
        filters: [{ name: 'Imágenes (*.png, *.jpg, *.jpeg, *.webp)', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      };
      const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
      if (res.canceled || res.filePaths.length === 0) {
        return ok(volumesStore.getAll());
      }
      const chosen = res.filePaths[0]!;
      const updated = volumesStore.saveGlobal({ publicBackgroundPath: chosen });
      broadcastOverlay({
        ...latestOverlay,
        hasCustomBackground: true,
        backgroundVersion: Date.now(),
      });
      return ok(updated);
    } catch (error) {
      console.error('Error seleccionando imagen de fondo:', error);
      return err(ErrorCode.INTERNAL_ERROR, 'No se pudo seleccionar la imagen de fondo.');
    }
  });

  ipcMain.handle(IPC_CHANNELS.PUBLIC_RESET_BACKGROUND, async () => {
    try {
      const updated = volumesStore.saveGlobal({ publicBackgroundPath: null });
      broadcastOverlay({
        ...latestOverlay,
        hasCustomBackground: false,
        backgroundVersion: Date.now(),
      });
      return ok(updated);
    } catch (error) {
      console.error('Error restaurando imagen de fondo:', error);
      return err(ErrorCode.INTERNAL_ERROR, 'No se pudo restaurar el fondo oficial Katakana.');
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.PUBLIC_BROADCAST_OVERLAY,
    async (_event, partial: Partial<PublicOverlayState>) => {
      try {
        const merged: PublicOverlayState = {
          ...latestOverlay,
          ...partial,
          hasCustomBackground: Boolean(volumesStore.getAll().publicBackgroundPath),
        };
        broadcastOverlay(merged);
        return ok(merged);
      } catch (error) {
        console.error('Error enviando estado a Pantalla Pública:', error);
        return err(ErrorCode.INTERNAL_ERROR, 'No se pudo actualizar la Pantalla Pública.');
      }
    },
  );
}
