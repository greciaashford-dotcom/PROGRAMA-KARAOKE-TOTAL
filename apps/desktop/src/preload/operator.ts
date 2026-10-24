import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  IPC_CHANNELS as IpcChannelsType,
  UpdateSettingsDTO,
  CatalogQuery,
  UpdateSongDTO,
  AddToQueueDTO,
  ReorderQueueDTO,
  UndoReorderDTO,
  QueueTransitionDTO,
  CreateSingerDTO,
  QueueItemDTO,
  PlayerCommandDTO,
  PlaybackSnapshotDTO,
  AssignDisplaysDTO,
  DisplayInfo,
} from '@karaoke/contracts';
import type { KaraokeAPI } from './types.js';

// Constantes de canales IPC autocontenidas para compatibilidad estricta con sandbox: true en Electron
const IPC_CHANNELS: typeof IpcChannelsType = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  LIBRARY_SELECT_FOLDER: 'library:selectFolder',
  LIBRARY_LIST_FOLDERS: 'library:listFolders',
  LIBRARY_REMOVE_FOLDER: 'library:removeFolder',
  LIBRARY_TOGGLE_FOLDER: 'library:toggleFolder',
  LIBRARY_SCAN_FOLDER: 'library:scanFolder',
  LIBRARY_CANCEL_SCAN: 'library:cancelScan',
  LIBRARY_LIST_ASSETS: 'library:listAssets',
  LIBRARY_UPDATE_SONG: 'library:updateSong',
  LIBRARY_LOCATE_IN_EXPLORER: 'library:locateInExplorer',
  LIBRARY_REANALYZE_ASSET: 'library:reanalyzeAsset',

  SESSION_GET_CURRENT: 'session:getCurrent',
  SESSION_OPEN: 'session:open',
  SESSION_PAUSE: 'session:pause',
  SESSION_RESUME: 'session:resume',
  SESSION_CLOSE: 'session:close',
  SINGER_CREATE: 'singer:create',
  SINGER_LIST: 'singer:list',

  QUEUE_GET: 'queue:get',
  QUEUE_ADD: 'queue:add',
  QUEUE_REORDER: 'queue:reorder',
  QUEUE_UNDO_REORDER: 'queue:undoReorder',
  QUEUE_TRANSITION: 'queue:transition',
  QUEUE_LIST_EVENTS: 'queue:listEvents',

  PLAYER_PREPARE: 'player:prepare',
  PLAYER_PREVIEW_ASSET: 'player:previewAsset',
  PLAYER_COMMAND: 'player:command',
  PLAYER_EMERGENCY_STOP: 'player:emergencyStop',
  PLAYER_GET_STATE: 'player:getState',
  PLAYER_REPORT_ENDED: 'player:reportEnded',
  PLAYER_UPDATE_PROGRESS: 'player:updateProgress',

  DISPLAY_GET_MONITORS: 'display:getMonitors',
  DISPLAY_ASSIGN: 'display:assign',
  DISPLAY_RESCUE_PUBLIC_WINDOW: 'display:rescuePublicWindow',
  DISPLAY_TOGGLE_PUBLIC_WINDOW: 'display:togglePublicWindow',
  DISPLAY_GET_PUBLIC_WINDOW_STATUS: 'display:getPublicWindowStatus',

  EVENT_SCAN_PROGRESS: 'event:library:scanProgress',
  EVENT_QUEUE_UPDATED: 'event:queue:updated',
  EVENT_PLAYER_STATE_CHANGED: 'event:player:stateChanged',
  EVENT_MONITORS_CHANGED: 'event:display:monitorsChanged',
};

const api: KaraokeAPI = {
  // Configuración
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  updateSettings: (updates: UpdateSettingsDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, updates),

  // Sesión
  getCurrentSession: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET_CURRENT),
  openSession: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_OPEN, { name }),
  pauseSession: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_PAUSE, { sessionId }),
  resumeSession: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_RESUME, { sessionId }),
  closeSession: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_CLOSE, { sessionId }),

  // Biblioteca y Carpetas
  selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_SELECT_FOLDER),
  listFolders: () => ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_LIST_FOLDERS),
  removeFolder: (folderId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_REMOVE_FOLDER, { folderId }),
  toggleFolder: (folderId: string, enabled: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_TOGGLE_FOLDER, { folderId, enabled }),
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

  // Cantantes
  createSinger: (payload: CreateSingerDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.SINGER_CREATE, payload),
  listSingers: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SINGER_LIST, { sessionId }),

  // Cola de Reproducción
  getQueue: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_GET, { sessionId }),
  addToQueue: (payload: AddToQueueDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_ADD, payload),
  reorderQueue: (payload: ReorderQueueDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_REORDER, payload),
  undoReorder: (payload: UndoReorderDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_UNDO_REORDER, payload),
  transitionQueue: (payload: QueueTransitionDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_TRANSITION, payload),
  listQueueEvents: (sessionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUEUE_LIST_EVENTS, { sessionId }),

  // Reproductor multimedia
  preparePlayer: (payload: { sessionId: string; queueItemId: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLAYER_PREPARE, payload),
  previewAsset: (payload: { mediaAssetId: string; sessionId?: string | null }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLAYER_PREVIEW_ASSET, payload),
  sendPlayerCommand: (command: PlayerCommandDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLAYER_COMMAND, command),
  emergencyStop: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PLAYER_EMERGENCY_STOP),
  getPlayerState: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PLAYER_GET_STATE),
  reportPlayerEnded: (queueItemId: string | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLAYER_REPORT_ENDED, { queueItemId }),
  updatePlayerProgress: (positionMs: number, durationMs?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.PLAYER_UPDATE_PROGRESS, { positionMs, durationMs }),

  // Gestión de Pantallas y Monitores
  getMonitors: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DISPLAY_GET_MONITORS),
  assignDisplays: (payload: AssignDisplaysDTO) =>
    ipcRenderer.invoke(IPC_CHANNELS.DISPLAY_ASSIGN, payload),
  togglePublicWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DISPLAY_TOGGLE_PUBLIC_WINDOW),
  getPublicWindowStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DISPLAY_GET_PUBLIC_WINDOW_STATUS),
  rescuePublicWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DISPLAY_RESCUE_PUBLIC_WINDOW),

  // Suscripciones a eventos seguros
  onScanProgress: (callback: (payload: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on(IPC_CHANNELS.EVENT_SCAN_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SCAN_PROGRESS, handler);
    };
  },

  onQueueUpdated: (callback: (payload: { sessionId: string; items: QueueItemDTO[] }) => void) => {
    const handler = (_event: IpcRendererEvent, payload: { sessionId: string; items: QueueItemDTO[] }) =>
      callback(payload);
    ipcRenderer.on(IPC_CHANNELS.EVENT_QUEUE_UPDATED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_QUEUE_UPDATED, handler);
    };
  },

  onPlayerStateChanged: (callback: (snapshot: PlaybackSnapshotDTO) => void) => {
    const handler = (_event: IpcRendererEvent, payload: PlaybackSnapshotDTO) => callback(payload);
    ipcRenderer.on(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_PLAYER_STATE_CHANGED, handler);
    };
  },

  onMonitorsChanged: (callback: (payload: { monitors: DisplayInfo[] }) => void) => {
    const handler = (_event: IpcRendererEvent, payload: { monitors: DisplayInfo[] }) => callback(payload);
    ipcRenderer.on(IPC_CHANNELS.EVENT_MONITORS_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_MONITORS_CHANGED, handler);
    };
  },
};

contextBridge.exposeInMainWorld('karaokeAPI', api);
