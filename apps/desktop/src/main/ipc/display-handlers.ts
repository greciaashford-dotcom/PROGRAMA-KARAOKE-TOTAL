import { ipcMain, BrowserWindow, screen, Display } from 'electron';
import {
  IPC_CHANNELS,
  AssignDisplaysSchema,
  DisplayInfo,
} from '@karaoke/contracts';
import { SettingsRepository } from '@karaoke/database';
import { createPublicWindow } from '../windows/public-window.js';

export function registerDisplayHandlers(
  settingsRepo: SettingsRepository,
  getOperatorWindow: () => BrowserWindow | null,
  getPublicWindow: () => BrowserWindow | null,
  setPublicWindow: (win: BrowserWindow | null) => void,
): void {
  const getDisplayInfoList = (): DisplayInfo[] => {
    const displays = screen.getAllDisplays();
    const primaryId = screen.getPrimaryDisplay().id;

    return displays.map((d, index) => ({
      id: String(d.id),
      label: d.label || `Pantalla ${index + 1} (${d.bounds.width}x${d.bounds.height}${d.id === primaryId ? ' — Principal' : ''})`,
      bounds: {
        x: d.bounds.x,
        y: d.bounds.y,
        width: d.bounds.width,
        height: d.bounds.height,
      },
      isPrimary: d.id === primaryId,
      scaleFactor: d.scaleFactor,
    }));
  };

  const broadcastMonitorsChanged = () => {
    const opWin = getOperatorWindow();
    if (opWin && !opWin.isDestroyed()) {
      opWin.webContents.send(IPC_CHANNELS.EVENT_MONITORS_CHANGED, {
        monitors: getDisplayInfoList(),
      });
    }
  };

  // 1. Obtener lista de monitores físicos conectados
  ipcMain.handle(IPC_CHANNELS.DISPLAY_GET_MONITORS, async () => {
    return getDisplayInfoList();
  });

  // 2. Asignar pantallas para Operador y Pantalla Pública
  ipcMain.handle(IPC_CHANNELS.DISPLAY_ASSIGN, async (_event, payload: unknown) => {
    const parsed = AssignDisplaysSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(`Configuración de pantallas inválida: ${parsed.error.message}`);
    }

    settingsRepo.updateSettings({
      operatorDisplayId: parsed.data.operatorDisplayId || undefined,
      publicDisplayId: parsed.data.publicDisplayId || undefined,
    });

    // Si la pantalla pública está abierta y se reasignó a otro monitor, moverla
    const pubWin = getPublicWindow();
    if (pubWin && !pubWin.isDestroyed() && parsed.data.publicDisplayId) {
      const displays = screen.getAllDisplays();
      const targetDisplay = displays.find((d) => String(d.id) === parsed.data.publicDisplayId);
      if (targetDisplay) {
        pubWin.setFullScreen(false);
        pubWin.setBounds(targetDisplay.bounds);
        if (targetDisplay.id !== screen.getPrimaryDisplay().id) {
          pubWin.setFullScreen(true);
        }
      }
    }

    return { success: true };
  });

  // 3. Abrir o Cerrar la Pantalla Pública
  ipcMain.handle(IPC_CHANNELS.DISPLAY_TOGGLE_PUBLIC_WINDOW, async () => {
    let pubWin = getPublicWindow();
    if (pubWin && !pubWin.isDestroyed()) {
      pubWin.close();
      setPublicWindow(null);
      return { isOpen: false };
    }

    const settings = settingsRepo.getOrCreateSettings();
    let targetDisplay: Display | undefined;
    if (settings.publicDisplayId) {
      targetDisplay = screen.getAllDisplays().find((d) => String(d.id) === settings.publicDisplayId);
    }

    pubWin = createPublicWindow(targetDisplay);
    setPublicWindow(pubWin);

    pubWin.on('closed', () => {
      setPublicWindow(null);
    });

    return { isOpen: true };
  });

  // 4. Estado actual de la pantalla pública
  ipcMain.handle(IPC_CHANNELS.DISPLAY_GET_PUBLIC_WINDOW_STATUS, async () => {
    const pubWin = getPublicWindow();
    return { isOpen: !!pubWin && !pubWin.isDestroyed() };
  });

  // 5. Rescatar la Pantalla Pública (traerla a la pantalla del operador si se pierde)
  ipcMain.handle(IPC_CHANNELS.DISPLAY_RESCUE_PUBLIC_WINDOW, async () => {
    let pubWin = getPublicWindow();
    const primary = screen.getPrimaryDisplay();

    if (!pubWin || pubWin.isDestroyed()) {
      pubWin = createPublicWindow(primary);
      setPublicWindow(pubWin);
      pubWin.on('closed', () => {
        setPublicWindow(null);
      });
    }

    // Desactivar pantalla completa y centrar en el monitor principal del operador
    pubWin.setFullScreen(false);
    pubWin.setBounds({
      x: primary.bounds.x + 80,
      y: primary.bounds.y + 80,
      width: Math.min(1024, primary.bounds.width - 160),
      height: Math.min(576, primary.bounds.height - 160),
    });
    pubWin.show();
    pubWin.focus();

    return { success: true, rescued: true };
  });

  // Monitorización reactiva de pantallas conectadas/desconectadas en caliente
  screen.on('display-added', () => {
    console.log('[Pantallas] Nuevo monitor detectado en caliente.');
    broadcastMonitorsChanged();
  });

  screen.on('display-removed', (_event, oldDisplay) => {
    console.warn(`[Pantallas] Monitor desconectado: ID ${oldDisplay.id}`);
    const pubWin = getPublicWindow();
    if (pubWin && !pubWin.isDestroyed()) {
      const currentBounds = pubWin.getBounds();
      // Si la ventana pública estaba en la zona del monitor eliminado, rescatarla
      if (
        currentBounds.x >= oldDisplay.bounds.x &&
        currentBounds.x < oldDisplay.bounds.x + oldDisplay.bounds.width
      ) {
        console.warn('[Pantallas] Rescatando pantalla pública tras desconexión física del monitor.');
        const primary = screen.getPrimaryDisplay();
        pubWin.setFullScreen(false);
        pubWin.setBounds({
          x: primary.bounds.x + 80,
          y: primary.bounds.y + 80,
          width: 960,
          height: 540,
        });
        pubWin.show();
      }
    }
    broadcastMonitorsChanged();
  });

  screen.on('display-metrics-changed', () => {
    broadcastMonitorsChanged();
  });
}
