import { BrowserWindow } from 'electron';
import {
  SettingsRepository,
  SessionRepository,
  MediaRepository,
  SingerRepository,
  QueueRepository,
} from '@karaoke/database';
import { MediaFolderWatcher } from '@karaoke/media-indexer';
import { registerSettingsHandlers } from './settings-handlers.js';
import { registerSessionHandlers } from './session-handlers.js';
import { registerLibraryHandlers } from './library-handlers.js';
import { registerQueueHandlers } from './queue-handlers.js';

export interface IpcRepositories {
  settingsRepo: SettingsRepository;
  sessionRepo: SessionRepository;
  mediaRepo: MediaRepository;
  singerRepo: SingerRepository;
  queueRepo: QueueRepository;
  watcher: MediaFolderWatcher;
  getWindow: () => BrowserWindow | null;
}

export function registerAllIpcHandlers(repos: IpcRepositories): void {
  registerSettingsHandlers(repos.settingsRepo);
  registerSessionHandlers(repos.sessionRepo);
  registerLibraryHandlers(repos.mediaRepo, repos.watcher, repos.getWindow);
  registerQueueHandlers(repos.queueRepo, repos.singerRepo, repos.sessionRepo, repos.getWindow);
}
