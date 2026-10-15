import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabaseConnection, KaraokeDatabase } from '../connection.js';
import { runMigrations } from '../migrator.js';
import { PlaybackRepository } from '../repositories/playback-repository.js';
import { SessionRepository } from '../repositories/session-repository.js';
import { MediaRepository } from '../repositories/media-repository.js';
import { SingerRepository } from '../repositories/singer-repository.js';
import { QueueRepository } from '../repositories/queue-repository.js';
import { Database as DatabaseInstance } from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('PlaybackRepository', () => {
  let tmpDir: string;
  let dbPath: string;
  let sqlite: DatabaseInstance;
  let db: KaraokeDatabase;
  let playbackRepo: PlaybackRepository;
  let sessionRepo: SessionRepository;
  let mediaRepo: MediaRepository;
  let singerRepo: SingerRepository;
  let queueRepo: QueueRepository;
  let sessionId: string;
  let queueItemId: string;
  let mediaAssetId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'karaoke-playback-test-'));
    dbPath = path.join(tmpDir, 'test.sqlite');
    const conn = createDatabaseConnection({ filename: dbPath });
    sqlite = conn.sqlite;
    db = conn.db;
    runMigrations(sqlite);

    playbackRepo = new PlaybackRepository(db);
    sessionRepo = new SessionRepository(db);
    mediaRepo = new MediaRepository(db);
    singerRepo = new SingerRepository(db);
    queueRepo = new QueueRepository(db);

    const session = sessionRepo.openSession('Sesion Test');
    sessionId = session.id;

    const folder = mediaRepo.addFolder('C:\\Karaoke', 'Test Folder');
    mediaRepo.syncScannedBatch(folder.id, [
      {
        relativePath: 'Test Song.mp4',
        filename: 'Test Song.mp4',
        extension: '.mp4',
        sizeBytes: 1000,
        modifiedAt: new Date().toISOString(),
        fingerprint: 'fp_test',
        durationMs: 180000,
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1920,
        height: 1080,
        audioChannels: 2,
        status: 'AVAILABLE',
        title: 'Test Song',
        artist: 'Test Artist',
        searchTextNormalized: 'test artist test song',
      },
    ]);

    const catalog = mediaRepo.queryCatalog({
      page: 1,
      pageSize: 10,
      sortBy: 'title',
      sortOrder: 'asc',
    });
    const song = catalog.items[0]!;
    mediaAssetId = song.mediaAssetId;

    const singer = singerRepo.createSinger({ sessionId, displayName: 'Cantante Test' });
    const queueItem = queueRepo.addToQueue({
      sessionId,
      songId: song.id,
      singerId: singer.id,
      keyShift: 0,
      tempoPercent: 100,
    });
    queueItemId = queueItem.id;
  });

  afterEach(() => {
    sqlite.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes default singleton state with IDLE and volume 100', () => {
    const state = playbackRepo.getPlaybackState();
    expect(state.state).toBe('IDLE');
    expect(state.volume).toBe(100);
    expect(state.positionMs).toBe(0);
    expect(state.durationMs).toBe(0);
    expect(state.queueItemId).toBeNull();
  });

  it('updates state and clamps volume correctly', () => {
    const updated = playbackRepo.updatePlaybackState({
      state: 'PLAYING',
      volume: 150, // Should be clamped to 100
      positionMs: 5000,
      durationMs: 180000,
    });

    expect(updated.state).toBe('PLAYING');
    expect(updated.volume).toBe(100);
    expect(updated.positionMs).toBe(5000);
    expect(updated.durationMs).toBe(180000);

    const clampedLow = playbackRepo.updatePlaybackState({
      volume: -20, // Should be clamped to 0
    });
    expect(clampedLow.volume).toBe(0);
  });

  it('emergencyStop resets positionMs to 0 and state to STOPPED', () => {
    playbackRepo.updatePlaybackState({
      state: 'PLAYING',
      positionMs: 45000,
      durationMs: 180000,
    });

    const stopped = playbackRepo.emergencyStop();
    expect(stopped.state).toBe('STOPPED');
    expect(stopped.positionMs).toBe(0);
  });

  it('reconciles startup: resets lingering PLAYING to READY or IDLE to prevent auto-play', () => {
    playbackRepo.updatePlaybackState({
      sessionId,
      queueItemId,
      mediaAssetId,
      state: 'PLAYING',
      positionMs: 60000,
    });

    playbackRepo.reconcileStartup();

    const recovered = playbackRepo.getPlaybackState();
    expect(recovered.state).toBe('READY');
    expect(recovered.positionMs).toBe(0);
    expect(recovered.queueItemId).toBe(queueItemId);
  });

  it('resetPlaybackState clears track references and returns to IDLE', () => {
    playbackRepo.updatePlaybackState({
      sessionId,
      queueItemId,
      mediaAssetId,
      state: 'PLAYING',
      positionMs: 30000,
    });

    const resetState = playbackRepo.resetPlaybackState();
    expect(resetState.state).toBe('IDLE');
    expect(resetState.queueItemId).toBeNull();
    expect(resetState.mediaAssetId).toBeNull();
    expect(resetState.positionMs).toBe(0);
  });
});
