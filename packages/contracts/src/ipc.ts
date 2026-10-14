export const IPC_CHANNELS = {
  // Configuración
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Biblioteca y Carpetas
  LIBRARY_SELECT_FOLDER: 'library:selectFolder',
  LIBRARY_LIST_FOLDERS: 'library:listFolders',
  LIBRARY_REMOVE_FOLDER: 'library:removeFolder',
  LIBRARY_SCAN_FOLDER: 'library:scanFolder',
  LIBRARY_CANCEL_SCAN: 'library:cancelScan',
  LIBRARY_LIST_ASSETS: 'library:listAssets',
  LIBRARY_UPDATE_SONG: 'library:updateSong',
  LIBRARY_LOCATE_IN_EXPLORER: 'library:locateInExplorer',
  LIBRARY_REANALYZE_ASSET: 'library:reanalyzeAsset',

  // Sesión y Cantantes
  SESSION_GET_CURRENT: 'session:getCurrent',
  SESSION_OPEN: 'session:open',
  SESSION_CLOSE: 'session:close',
  SINGER_CREATE: 'singer:create',
  SINGER_LIST: 'singer:list',

  // Cola
  QUEUE_ADD: 'queue:add',
  QUEUE_REORDER: 'queue:reorder',
  QUEUE_TRANSITION: 'queue:transition',

  // Reproductor
  PLAYER_PREPARE: 'player:prepare',
  PLAYER_COMMAND: 'player:command',
  PLAYER_EMERGENCY_STOP: 'player:emergencyStop',

  // Pantallas
  DISPLAY_GET_MONITORS: 'display:getMonitors',
  DISPLAY_ASSIGN: 'display:assign',
  DISPLAY_RESCUE_PUBLIC_WINDOW: 'display:rescuePublicWindow',

  // Eventos Unidireccionales
  EVENT_SCAN_PROGRESS: 'event:library:scanProgress',
  EVENT_QUEUE_UPDATED: 'event:queue:updated',
  EVENT_PLAYER_STATE_CHANGED: 'event:player:stateChanged',
  EVENT_MONITORS_CHANGED: 'event:display:monitorsChanged',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
