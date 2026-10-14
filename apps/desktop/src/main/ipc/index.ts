import { BrowserWindow } from 'electron';
import {
  SettingsRepository,
  SessionRepository,
  MediaRepository,
} from '@karaoke/database';
import { MediaFolderWatcher } from '@karaoke/media-indexer';
import { registerSettingsHandlers } from './settings-handlers.js';
import { registerSessionHandlers } from './session-handlers.js';
import { registerLibraryHandlers } from './library-handlers.js';

export interface IpcRepositories {
  settingsRepo: SettingsRepository;
  sessionRepo: SessionRepository;
  mediaRepo: MediaRepository;
  watcher: MediaFolderWatcher;
  getWindow: () => BrowserWindow | null;
}

export function registerAllIpcHandlers(repos: IpcRepositories): void {
  registerSettingsHandlers(repos.settingsRepo);
  registerSessionHandlers(repos.sessionRepo);
  registerLibraryHandlers(repos.mediaRepo, repos.watcher, repos.getWindow);
}
