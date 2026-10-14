import { SettingsRepository, SessionRepository } from '@karaoke/database';
import { registerSettingsHandlers } from './settings-handlers.js';
import { registerSessionHandlers } from './session-handlers.js';

export interface IpcRepositories {
  settingsRepo: SettingsRepository;
  sessionRepo: SessionRepository;
}

export function registerAllIpcHandlers(repos: IpcRepositories): void {
  registerSettingsHandlers(repos.settingsRepo);
  registerSessionHandlers(repos.sessionRepo);
}
