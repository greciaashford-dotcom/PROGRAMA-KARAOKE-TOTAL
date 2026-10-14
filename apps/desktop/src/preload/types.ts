import {
  Result,
  SettingsDTO,
  UpdateSettingsDTO,
  SessionDTO,
} from '@karaoke/contracts';

export interface KaraokeAPI {
  // Configuración
  getSettings: () => Promise<Result<SettingsDTO>>;
  updateSettings: (updates: UpdateSettingsDTO) => Promise<Result<SettingsDTO>>;

  // Sesión
  getCurrentSession: () => Promise<Result<SessionDTO | null>>;
  openSession: (name: string) => Promise<Result<SessionDTO>>;
  closeSession: (sessionId: string) => Promise<Result<void>>;

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
