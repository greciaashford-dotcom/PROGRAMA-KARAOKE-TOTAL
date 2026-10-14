import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  IPC_CHANNELS,
  UpdateSettingsDTO,
  CatalogQuery,
  UpdateSongDTO,
} from '@karaoke/contracts';
import { KaraokeAPI } from './types.js';

const api: KaraokeAPI = {
  // Configuración
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  updateSettings: (updates: UpdateSettingsDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, updates),

  // Sesión
  getCurrentSession: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET_CURRENT),
  openSession: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_OPEN, { name }),
  closeSession: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_CLOSE, { sessionId }),

  // Biblioteca y Carpetas
  selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_SELECT_FOLDER),
  listFolders: () => ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_LIST_FOLDERS),
  removeFolder: (folderId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_REMOVE_FOLDER, { folderId }),
  scanFolder: (folderId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_SCAN_FOLDER, { folderId }),
  cancelScan: (folderId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_CANCEL_SCAN, { folderId }),
  listAssets: (query: CatalogQuery) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_LIST_ASSETS, query),
  updateSong: (updates: UpdateSongDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_UPDATE_SONG, updates),
  locateInExplorer: (mediaAssetId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_LOCATE_IN_EXPLORER, { mediaAssetId }),
  reanalyzeAsset: (mediaAssetId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_REANALYZE_ASSET, { mediaAssetId }),

  // Suscripciones a eventos seguros
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
