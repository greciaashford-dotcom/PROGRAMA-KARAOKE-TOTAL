import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabaseConnection } from '../connection.js';
import { runMigrations } from '../migrator.js';
import { SessionRepository } from '../repositories/session-repository.js';
import { MediaRepository } from '../repositories/media-repository.js';
import { SingerRepository } from '../repositories/singer-repository.js';
import { QueueRepository, QueueError } from '../repositories/queue-repository.js';
import { isValidQueueTransition } from '@karaoke/contracts';
import { Database as DatabaseInstance } from 'better-sqlite3';
import { KaraokeDatabase } from '../connection.js';

describe('Gestión de Cantantes, Cola de Reproducción y Máquina de Estados', () => {
  let sqlite: DatabaseInstance;
  let db: KaraokeDatabase;
  let sessionRepo: SessionRepository;
  let mediaRepo: MediaRepository;
  let singerRepo: SingerRepository;
  let queueRepo: QueueRepository;

  let sessionId: string;
  let songId1: string;
  let songId2: string;
  let singerId1: string;
  let singerId2: string;

  beforeEach(() => {
    const conn = createDatabaseConnection({ filename: ':memory:' });
    sqlite = conn.sqlite;
    db = conn.db;
    runMigrations(sqlite);

    sessionRepo = new SessionRepository(db);
    mediaRepo = new MediaRepository(db);
    singerRepo = new SingerRepository(db);
    queueRepo = new QueueRepository(db);

    // Configurar datos base
    const session = sessionRepo.openSession('Noche de Karaoke');
    sessionId = session.id;

    const folder = mediaRepo.addFolder('C:\\Karaoke', 'Archivos');
    mediaRepo.syncScannedBatch(folder.id, [
      {
        relativePath: 'Queen - Bohemian Rhapsody.mp4',
        filename: 'Queen - Bohemian Rhapsody.mp4',
        extension: '.mp4',
        sizeBytes: 1000,
        modifiedAt: new Date().toISOString(),
        fingerprint: 'fp1',
        durationMs: 200000,
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1920,
        height: 1080,
        audioChannels: 2,
        status: 'AVAILABLE',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        searchTextNormalized: 'queen bohemian rhapsody',
      },
      {
        relativePath: 'ABBA - Dancing Queen.mp4',
        filename: 'ABBA - Dancing Queen.mp4',
        extension: '.mp4',
        sizeBytes: 1000,
        modifiedAt: new Date().toISOString(),
        fingerprint: 'fp2',
        durationMs: 180000,
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1920,
        height: 1080,
        audioChannels: 2,
        status: 'AVAILABLE',
        title: 'Dancing Queen',
        artist: 'ABBA',
        searchTextNormalized: 'abba dancing queen',
      },
    ]);

    const catalog = mediaRepo.queryCatalog({ page: 1, pageSize: 10, sortBy: 'title', sortOrder: 'asc' });
    songId1 = catalog.items[0]!.id;
    songId2 = catalog.items[1]!.id;

    const s1 = singerRepo.createSinger({ sessionId, displayName: 'Carlos', tableOrLocation: 'Mesa 4' });
    const s2 = singerRepo.createSinger({ sessionId, displayName: 'Laura', tableOrLocation: 'Barra' });
    singerId1 = s1.id;
    singerId2 = s2.id;
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('Máquina de Estados Formal (isValidQueueTransition)', () => {
    it('debe admitir las transiciones del flujo principal', () => {
      expect(isValidQueueTransition('QUEUED', 'CALLED')).toBe(true);
      expect(isValidQueueTransition('CALLED', 'PREPARING')).toBe(true);
      expect(isValidQueueTransition('PREPARING', 'READY')).toBe(true);
      expect(isValidQueueTransition('READY', 'PLAYING')).toBe(true);
      expect(isValidQueueTransition('PLAYING', 'COMPLETED')).toBe(true);
    });

    it('debe admitir transiciones alternativas controladas', () => {
      expect(isValidQueueTransition('QUEUED', 'CANCELLED')).toBe(true);
      expect(isValidQueueTransition('QUEUED', 'SKIPPED')).toBe(true);
      expect(isValidQueueTransition('CALLED', 'SKIPPED')).toBe(true);
      expect(isValidQueueTransition('PREPARING', 'FAILED')).toBe(true);
      expect(isValidQueueTransition('READY', 'FAILED')).toBe(true);
      expect(isValidQueueTransition('PLAYING', 'PAUSED')).toBe(true);
      expect(isValidQueueTransition('PAUSED', 'PLAYING')).toBe(true);
      expect(isValidQueueTransition('PLAYING', 'SKIPPED')).toBe(true);
      expect(isValidQueueTransition('PLAYING', 'FAILED')).toBe(true);
    });

    it('debe rechazar saltos arbitrarios o inválidos', () => {
      expect(isValidQueueTransition('QUEUED', 'PLAYING')).toBe(false);
      expect(isValidQueueTransition('QUEUED', 'COMPLETED')).toBe(false);
      expect(isValidQueueTransition('COMPLETED', 'PLAYING')).toBe(false);
      expect(isValidQueueTransition('CALLED', 'COMPLETED')).toBe(false);
    });
  });

  describe('Repositorio de Cantantes', () => {
    it('debe registrar y listar cantantes de la sesión', () => {
      const singers = singerRepo.listSingers(sessionId);
      expect(singers.length).toBe(2);
      expect(singers.map((s) => s.displayName)).toContain('Carlos');
      expect(singers.map((s) => s.displayName)).toContain('Laura');
    });
  });

  describe('Repositorio de Cola (QueueRepository)', () => {
    it('debe encolar canciones asignando posición incremental y cálculo de espera estimada', () => {
      const item1 = queueRepo.addToQueue({
        sessionId,
        songId: songId1,
        singerId: singerId1,
        keyShift: 0,
        tempoPercent: 100,
      });

      expect(item1.position).toBe(1);
      expect(item1.status).toBe('QUEUED');
      expect(item1.singer?.displayName).toBe('Carlos');

      const item2 = queueRepo.addToQueue({
        sessionId,
        songId: songId2,
        singerId: singerId2,
        keyShift: 2,
        tempoPercent: 100,
      });

      expect(item2.position).toBe(2);
      expect(item2.keyShift).toBe(2);

      const queue = queueRepo.getQueueForSession(sessionId);
      expect(queue.length).toBe(2);
      expect(queue[0]?.position).toBe(1);
      expect(queue[0]?.estimatedWaitMs).toBe(0); // Primero no espera
      expect(queue[1]?.position).toBe(2);
      expect(queue[1]?.estimatedWaitMs).toBeGreaterThan(0); // Segundo espera la duración de la canción 1
    });

    it('debe rechazar doble clic accidental con error claro', () => {
      queueRepo.addToQueue({
        sessionId,
        songId: songId1,
        singerId: singerId1,
        keyShift: 0,
        tempoPercent: 100,
      });

      expect(() => {
        queueRepo.addToQueue({
          sessionId,
          songId: songId1,
          singerId: singerId1,
          keyShift: 0,
          tempoPercent: 100,
        });
      }).toThrow(QueueError);
    });

    it('debe reordenar la cola y permitir deshacer el cambio', () => {
      const item1 = queueRepo.addToQueue({ sessionId, songId: songId1, singerId: singerId1, keyShift: 0, tempoPercent: 100 });
      const item2 = queueRepo.addToQueue({ sessionId, songId: songId2, singerId: singerId2, keyShift: 0, tempoPercent: 100 });

      // Invertir orden
      const reorderResult = queueRepo.reorderQueue(sessionId, [item2.id, item1.id]);
      expect(reorderResult.success).toBe(true);

      let queue = queueRepo.getQueueForSession(sessionId);
      expect(queue[0]?.id).toBe(item2.id);
      expect(queue[1]?.id).toBe(item1.id);

      // Deshacer orden
      queueRepo.undoLastReorder(sessionId, reorderResult.previousOrder);
      queue = queueRepo.getQueueForSession(sessionId);
      expect(queue[0]?.id).toBe(item1.id);
      expect(queue[1]?.id).toBe(item2.id);
    });

    it('debe ejecutar transiciones de estado válidas y registrar eventos en queue_events', () => {
      const item = queueRepo.addToQueue({ sessionId, songId: songId1, singerId: singerId1, keyShift: 0, tempoPercent: 100 });

      // QUEUED -> CALLED
      const called = queueRepo.transitionQueueItem(item.id, 'CALLED');
      expect(called.status).toBe('CALLED');

      // CALLED -> PREPARING
      const preparing = queueRepo.transitionQueueItem(item.id, 'PREPARING');
      expect(preparing.status).toBe('PREPARING');

      // PREPARING -> READY
      const ready = queueRepo.transitionQueueItem(item.id, 'READY');
      expect(ready.status).toBe('READY');

      // READY -> PLAYING
      const playing = queueRepo.transitionQueueItem(item.id, 'PLAYING');
      expect(playing.status).toBe('PLAYING');
      expect(playing.startedAt).toBeDefined();

      // PLAYING -> COMPLETED
      const completed = queueRepo.transitionQueueItem(item.id, 'COMPLETED');
      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).toBeDefined();

      // Comprobar eventos registrados en historial SQLite
      const events = sqlite
        .prepare('SELECT * FROM queue_events WHERE queue_item_id = ? ORDER BY created_at ASC')
        .all(item.id) as { event_type: string; next_state: string }[];

      expect(events.length).toBe(6); // ENQUEUED + 5 transiciones
      expect(events[events.length - 1]?.next_state).toBe('COMPLETED');
    });

    it('debe rechazar que dos elementos estén en PLAYING simultáneamente', () => {
      const item1 = queueRepo.addToQueue({ sessionId, songId: songId1, singerId: singerId1, keyShift: 0, tempoPercent: 100 });
      const item2 = queueRepo.addToQueue({ sessionId, songId: songId2, singerId: singerId2, keyShift: 0, tempoPercent: 100 });

      queueRepo.transitionQueueItem(item1.id, 'CALLED');
      queueRepo.transitionQueueItem(item1.id, 'PREPARING');
      queueRepo.transitionQueueItem(item1.id, 'READY');
      queueRepo.transitionQueueItem(item1.id, 'PLAYING');

      queueRepo.transitionQueueItem(item2.id, 'CALLED');
      queueRepo.transitionQueueItem(item2.id, 'PREPARING');
      queueRepo.transitionQueueItem(item2.id, 'READY');

      // Intentar poner item2 en PLAYING debe fallar
      expect(() => {
        queueRepo.transitionQueueItem(item2.id, 'PLAYING');
      }).toThrow(QueueError);
    });

    it('debe recuperar elementos PLAYING tras reinicio forzado a READY', () => {
      const item = queueRepo.addToQueue({ sessionId, songId: songId1, singerId: singerId1, keyShift: 0, tempoPercent: 100 });
      queueRepo.transitionQueueItem(item.id, 'CALLED');
      queueRepo.transitionQueueItem(item.id, 'PREPARING');
      queueRepo.transitionQueueItem(item.id, 'READY');
      queueRepo.transitionQueueItem(item.id, 'PLAYING');

      const recovery = queueRepo.recoverSessionQueue(sessionId);
      expect(recovery.recoveredCount).toBe(1);

      const reloaded = queueRepo.getQueueForSession(sessionId);
      expect(reloaded[0]?.status).toBe('READY'); // Ya no está PLAYING tras recuperarse
    });
  });
});
