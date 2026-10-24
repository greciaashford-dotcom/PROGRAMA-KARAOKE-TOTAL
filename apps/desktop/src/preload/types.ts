import {
  Result,
  SettingsDTO,
  UpdateSettingsDTO,
  SessionDTO,
  MediaFolderDTO,
  CatalogQuery,
  SongDTO,
  UpdateSongDTO,
  QueueItemDTO,
  QueueEventDTO,
  AddToQueueDTO,
  ReorderQueueDTO,
  UndoReorderDTO,
  QueueTransitionDTO,
  SingerDTO,
  CreateSingerDTO,
  PlaybackSnapshotDTO,
  PlayerCommandDTO,
  DisplayInfo,
  AssignDisplaysDTO,
} from '@karaoke/contracts';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PlayerPrepareResult {
  mediaUrl: string;
  queueItemId: string | null;
  title: string;
  artist: string;
  singerName: string;
  durationMs: number;
  keyShift: number;
  extension?: string;
  snapshot: PlaybackSnapshotDTO;
}

export interface KaraokeAPI {
  // Configuración
  getSettings: () => Promise<Result<SettingsDTO>>;
  updateSettings: (updates: UpdateSettingsDTO) => Promise<Result<SettingsDTO>>;

  // Sesión
  getCurrentSession: () => Promise<Result<SessionDTO | null>>;
  openSession: (name: string) => Promise<Result<SessionDTO>>;
  pauseSession: (sessionId: string) => Promise<Result<SessionDTO>>;
  resumeSession: (sessionId: string) => Promise<Result<SessionDTO>>;
  closeSession: (sessionId: string) => Promise<Result<void>>;

  // Biblioteca y Carpetas
  selectFolder: () => Promise<Result<MediaFolderDTO | null>>;
  selectAmbientFolder: () => Promise<Result<MediaFolderDTO | null>>;
  selectAmbientFiles: () => Promise<Result<{ addedCount: number; folderId?: string }>>;
  listFolders: () => Promise<Result<MediaFolderDTO[]>>;
  removeFolder: (folderId: string) => Promise<Result<void>>;
  removeAsset: (mediaAssetId: string) => Promise<Result<void>>;
  toggleFolder: (folderId: string, enabled: boolean) => Promise<Result<MediaFolderDTO>>;
  scanFolder: (folderId: string) => Promise<Result<{ scanId: string }>>;
  cancelScan: (folderId: string) => Promise<Result<void>>;
  listAssets: (query: CatalogQuery) => Promise<Result<PaginatedResult<SongDTO>>>;
  updateSong: (updates: UpdateSongDTO) => Promise<Result<SongDTO>>;
  locateInExplorer: (mediaAssetId: string) => Promise<Result<void>>;
  reanalyzeAsset: (mediaAssetId: string) => Promise<Result<void>>;

  // Cantantes
  createSinger: (payload: CreateSingerDTO) => Promise<Result<SingerDTO>>;
  listSingers: (sessionId: string) => Promise<Result<SingerDTO[]>>;

  // Cola de Reproducción
  getQueue: (sessionId: string) => Promise<Result<QueueItemDTO[]>>;
  addToQueue: (payload: AddToQueueDTO) => Promise<Result<QueueItemDTO>>;
  reorderQueue: (payload: ReorderQueueDTO) => Promise<Result<{ success: boolean; previousOrder: string[] }>>;
  undoReorder: (payload: UndoReorderDTO) => Promise<Result<void>>;
  transitionQueue: (payload: QueueTransitionDTO) => Promise<Result<QueueItemDTO>>;
  listQueueEvents: (sessionId: string) => Promise<Result<QueueEventDTO[]>>;

  // Reproductor multimedia y control en vivo
  preparePlayer: (payload: { sessionId: string; queueItemId: string }) => Promise<Result<PlayerPrepareResult>>;
  previewAsset: (payload: { mediaAssetId: string; sessionId?: string | null }) => Promise<Result<PlayerPrepareResult>>;
  sendPlayerCommand: (command: PlayerCommandDTO) => Promise<Result<PlaybackSnapshotDTO>>;
  emergencyStop: () => Promise<Result<PlaybackSnapshotDTO>>;
  getPlayerState: () => Promise<Result<PlaybackSnapshotDTO>>;
  reportPlayerEnded: (queueItemId: string | null) => Promise<Result<PlaybackSnapshotDTO>>;
  updatePlayerProgress: (positionMs: number, durationMs?: number) => Promise<Result<PlaybackSnapshotDTO>>;

  // Gestión de Pantallas y Monitores
  getMonitors: () => Promise<Result<DisplayInfo[]>>;
  assignDisplays: (payload: AssignDisplaysDTO) => Promise<Result<void>>;
  togglePublicWindow: () => Promise<Result<{ isOpen: boolean }>>;
  getPublicWindowStatus: () => Promise<Result<{ isOpen: boolean }>>;
  rescuePublicWindow: () => Promise<Result<{ success: boolean; rescued: boolean }>>;

  // Suscripciones a eventos seguros
  onScanProgress: (callback: (payload: unknown) => void) => () => void;
  onQueueUpdated: (callback: (payload: { sessionId: string; items: QueueItemDTO[] }) => void) => () => void;
  onPlayerStateChanged: (callback: (snapshot: PlaybackSnapshotDTO) => void) => () => void;
  onMonitorsChanged: (callback: (payload: { monitors: DisplayInfo[] }) => void) => () => void;
}

declare global {
  interface Window {
    karaokeAPI: KaraokeAPI;
  }
}
