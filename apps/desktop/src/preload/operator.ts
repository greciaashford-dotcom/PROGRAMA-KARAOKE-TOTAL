import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS, UpdateSettingsDTO } from '@karaoke/contracts';
import { KaraokeAPI } from './types.js';

const api: KaraokeAPI = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  updateSettings: (updates: UpdateSettingsDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, updates),

  getCurrentSession: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET_CURRENT),
  openSession: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_OPEN, { name }),
  closeSession: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_CLOSE, { sessionId }),

  onScanProgress: (callback: (payload: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(IPC_CHANNELS.EVENT_SCAN_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SCAN_PROGRESS, handler);
    };
  },

  onPlayerStateChanged: (callback: (payload: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, handler);
    };
  },

  onMonitorsChanged: (callback: (payload: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(IPC_CHANNELS.EVENT_MONITORS_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_MONITORS_CHANGED, handler);
    };
  },
};

contextBridge.exposeInMainWorld('karaokeAPI', api);
