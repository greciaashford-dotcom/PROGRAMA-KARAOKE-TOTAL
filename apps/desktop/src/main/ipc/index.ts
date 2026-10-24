import { BrowserWindow } from 'electron';
import {
  SettingsRepository,
  SessionRepository,
  MediaRepository,
  SingerRepository,
  QueueRepository,
  PlaybackRepository,
} from '@karaoke/database';
import { MediaFolderWatcher } from '@karaoke/media-indexer';
import { registerSettingsHandlers } from './settings-handlers.js';
import { registerSessionHandlers } from './session-handlers.js';
import { registerLibraryHandlers } from './library-handlers.js';
import { registerQueueHandlers } from './queue-handlers.js';
import { registerPlayerHandlers } from './player-handlers.js';
import { registerDisplayHandlers } from './display-handlers.js';

export interface IpcRepositories {
  settingsRepo: SettingsRepository;
  sessionRepo: SessionRepository;
  mediaRepo: MediaRepository;
  singerRepo: SingerRepository;
  queueRepo: QueueRepository;
  playbackRepo: PlaybackRepository;
  watcher: MediaFolderWatcher;
  getOperatorWindow: () => BrowserWindow | null;
  getPublicWindow: () => BrowserWindow | null;
  setPublicWindow: (win: BrowserWindow | null) => void;
  getAllWindows: () => BrowserWindow[];
}

export function registerAllIpcHandlers(repos: IpcRepositories): void {
  registerSettingsHandlers(repos.settingsRepo);
  registerSessionHandlers(repos.sessionRepo);
  registerLibraryHandlers(repos.mediaRepo, repos.watcher, repos.getOperatorWindow);
  registerQueueHandlers(repos.queueRepo, repos.singerRepo, repos.sessionRepo, repos.getAllWindows);
  registerPlayerHandlers(repos.playbackRepo, repos.queueRepo, repos.mediaRepo, repos.getAllWindows);
  registerDisplayHandlers(
    repos.settingsRepo,
    repos.getOperatorWindow,
    repos.getPublicWindow,
    repos.setPublicWindow,
  );
}
