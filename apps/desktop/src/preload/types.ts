import {
  Result,
  SettingsDTO,
  UpdateSettingsDTO,
  SessionDTO,
  MediaFolderDTO,
  CatalogQuery,
  SongDTO,
  UpdateSongDTO,
} from '@karaoke/contracts';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KaraokeAPI {
  // Configuración
  getSettings: () => Promise<Result<SettingsDTO>>;
  updateSettings: (updates: UpdateSettingsDTO) => Promise<Result<SettingsDTO>>;

  // Sesión
  getCurrentSession: () => Promise<Result<SessionDTO | null>>;
  openSession: (name: string) => Promise<Result<SessionDTO>>;
  closeSession: (sessionId: string) => Promise<Result<void>>;

  // Biblioteca y Carpetas
  selectFolder: () => Promise<Result<MediaFolderDTO | null>>;
  listFolders: () => Promise<Result<MediaFolderDTO[]>>;
  removeFolder: (folderId: string) => Promise<Result<void>>;
  scanFolder: (folderId: string) => Promise<Result<{ scanId: string }>>;
  cancelScan: (folderId: string) => Promise<Result<void>>;
  listAssets: (query: CatalogQuery) => Promise<Result<PaginatedResult<SongDTO>>>;
  updateSong: (updates: UpdateSongDTO) => Promise<Result<SongDTO>>;
  locateInExplorer: (mediaAssetId: string) => Promise<Result<void>>;
  reanalyzeAsset: (mediaAssetId: string) => Promise<Result<void>>;

  // Suscripciones a eventos seguros
  onScanProgress: (callback: (payload: unknown) => void) => () => void;
  onPlayerStateChanged: (callback: (payload: unknown) => void) => () => void;
  onMonitorsChanged: (callback: (payload: unknown) => void) => () => void;
}

declare global {
  interface Window {
    karaokeAPI: KaraokeAPI;
  }
}
