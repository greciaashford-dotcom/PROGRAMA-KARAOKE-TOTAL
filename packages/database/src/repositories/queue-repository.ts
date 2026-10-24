import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { KaraokeDatabase } from '../connection.js';
import {
  queueItemsTable,
  queueEventsTable,
  songsTable,
  mediaAssetsTable,
  singersTable,
} from '../schema.js';
import {
  QueueItemDTO,
  AddToQueueDTO,
  QueueStatus,
  QueueEventDTO,
  isValidQueueTransition,
  MediaStatus,
} from '@karaoke/contracts';
import { randomUUID } from 'node:crypto';

export class QueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueError';
  }
}

export class QueueRepository {
  constructor(private db: KaraokeDatabase) {}

  public getQueueForSession(sessionId: string): QueueItemDTO[] {
    const rows = this.db
      .select({
        item: queueItemsTable,
        song: songsTable,
        asset: mediaAssetsTable,
        singer: singersTable,
      })
      .from(queueItemsTable)
      .innerJoin(songsTable, eq(queueItemsTable.songId, songsTable.id))
      .innerJoin(mediaAssetsTable, eq(songsTable.mediaAssetId, mediaAssetsTable.id))
      .innerJoin(singersTable, eq(queueItemsTable.singerId, singersTable.id))
      .where(eq(queueItemsTable.sessionId, sessionId))
      .orderBy(asc(queueItemsTable.position))
      .all();

    // Calcular tiempos estimados de espera sumando duraciones precedentes
    let accumulatedWaitMs = 0;

    return rows.map(({ item, song, asset, singer }) => {
      const isPending = ['PLAYING', 'READY', 'PREPARING', 'CALLED', 'QUEUED'].includes(item.status);
      const estimatedWait = isPending ? accumulatedWaitMs : 0;

      if (isPending && asset.durationMs) {
        accumulatedWaitMs += asset.durationMs;
      }

      return {
        id: item.id,
        sessionId: item.sessionId,
        songId: item.songId,
        singerId: item.singerId,
        position: item.position,
        keyShift: item.keyShift,
        tempoPercent: item.tempoPercent,
        status: item.status as QueueStatus,
        failureReason: item.failureReason,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        estimatedWaitMs: estimatedWait,
        song: {
          id: song.id,
          mediaAssetId: song.mediaAssetId,
          title: song.title,
          artist: song.artist,
          language: song.language,
          genre: song.genre,
          collection: song.collection,
          disc: song.disc,
          track: song.track,
          metadataSource: song.metadataSource as 'FILENAME' | 'MANUAL',
          asset: {
            id: asset.id,
            folderId: asset.folderId,
            filename: asset.filename,
            extension: asset.extension,
            sizeBytes: asset.sizeBytes,
            durationMs: asset.durationMs,
            container: asset.container,
            videoCodec: asset.videoCodec,
            audioCodec: asset.audioCodec,
            width: asset.width,
            height: asset.height,
            audioChannels: asset.audioChannels,
            status: asset.status as MediaStatus,
            lastSeenAt: asset.lastSeenAt,
            createdAt: asset.createdAt,
            updatedAt: asset.updatedAt,
          },
          createdAt: song.createdAt,
          updatedAt: song.updatedAt,
        },
        singer: {
          id: singer.id,
          sessionId: singer.sessionId,
          displayName: singer.displayName,
          tableOrLocation: singer.tableOrLocation,
          notes: singer.notes,
          createdAt: singer.createdAt,
          updatedAt: singer.updatedAt,
        },
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
  }

  public addToQueue(data: AddToQueueDTO): QueueItemDTO {
    const now = new Date().toISOString();

    // 1. Protección contra inserción accidental duplicada (doble clic)
    // Comprobar si en los últimos 2 segundos se insertó exactamente la misma combinación cantante+canción
    const recentDuplicate = this.db
      .select({ id: queueItemsTable.id, createdAt: queueItemsTable.createdAt })
      .from(queueItemsTable)
      .where(
        and(
          eq(queueItemsTable.sessionId, data.sessionId),
          eq(queueItemsTable.songId, data.songId),
          eq(queueItemsTable.singerId, data.singerId),
        ),
      )
      .all()
      .find((r) => {
        const diffMs = Math.abs(new Date(now).getTime() - new Date(r.createdAt).getTime());
        return diffMs < 1500;
      });

    if (recentDuplicate) {
      throw new QueueError('Petición duplicada ignorada: la canción ya fue añadida hace un instante.');
    }

    // 2. Determinar la siguiente posición en la cola
    const maxPosRow = this.db
      .select({ maxPos: sql<number>`max(${queueItemsTable.position})` })
      .from(queueItemsTable)
      .where(eq(queueItemsTable.sessionId, data.sessionId))
      .get();

    const nextPosition = (maxPosRow?.maxPos ?? 0) + 1;
    const itemId = randomUUID();

    // 3. Inserción atómica en SQLite con evento en historial
    this.db.transaction(() => {
      this.db
        .insert(queueItemsTable)
        .values({
          id: itemId,
          sessionId: data.sessionId,
          songId: data.songId,
          singerId: data.singerId,
          position: nextPosition,
          keyShift: data.keyShift ?? 0,
          tempoPercent: data.tempoPercent ?? 100,
          status: 'QUEUED',
          failureReason: null,
          startedAt: null,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      this.db
        .insert(queueEventsTable)
        .values({
          id: randomUUID(),
          sessionId: data.sessionId,
          queueItemId: itemId,
          eventType: 'ENQUEUED',
          previousState: null,
          nextState: 'QUEUED',
          payloadJson: JSON.stringify({ position: nextPosition, keyShift: data.keyShift }),
          createdAt: now,
        })
        .run();
    });

    const items = this.getQueueForSession(data.sessionId);
    const added = items.find((i) => i.id === itemId);
    if (!added) {
      throw new QueueError('No se pudo recuperar el elemento insertado.');
    }
    return added;
  }

  public reorderQueue(
    sessionId: string,
    orderedItemIds: string[],
  ): { success: boolean; previousOrder: string[] } {
    const currentItems = this.getQueueForSession(sessionId);
    const previousOrder = currentItems.map((i) => i.id);

    // No permitir reordenar el elemento que actualmente está en reproducción activa
    const playingItem = currentItems.find((i) => i.status === 'PLAYING');
    if (playingItem && orderedItemIds[0] !== playingItem.id) {
      // Si hay uno sonando, debe permanecer en la primera posición de la lista
      const filtered = orderedItemIds.filter((id) => id !== playingItem.id);
      orderedItemIds = [playingItem.id, ...filtered];
    }

    const now = new Date().toISOString();

    this.db.transaction(() => {
      orderedItemIds.forEach((id, index) => {
        this.db
          .update(queueItemsTable)
          .set({
            position: index + 1,
            updatedAt: now,
          })
          .where(and(eq(queueItemsTable.id, id), eq(queueItemsTable.sessionId, sessionId)))
          .run();
      });

      this.db
        .insert(queueEventsTable)
        .values({
          id: randomUUID(),
          sessionId,
          queueItemId: orderedItemIds[0] || sessionId,
          eventType: 'REORDERED',
          previousState: null,
          nextState: 'REORDERED',
          payloadJson: JSON.stringify({ newOrder: orderedItemIds }),
          createdAt: now,
        })
        .run();
    });

    return { success: true, previousOrder };
  }

  public undoLastReorder(sessionId: string, previousOrderedItemIds: string[]): void {
    this.reorderQueue(sessionId, previousOrderedItemIds);
  }

  public transitionQueueItem(
    queueItemId: string,
    nextStatus: QueueStatus,
    failureReason?: string,
  ): QueueItemDTO {
    const existing = this.db
      .select()
      .from(queueItemsTable)
      .where(eq(queueItemsTable.id, queueItemId))
      .get();

    if (!existing) {
      throw new QueueError('El elemento de cola no existe.');
    }

    const currentStatus = existing.status as QueueStatus;

    // 1. Validar máquina de estados formal
    if (!isValidQueueTransition(currentStatus, nextStatus)) {
      throw new QueueError(
        `Transición de estado inválida: no se puede pasar de '${currentStatus}' a '${nextStatus}'.`,
      );
    }

    // 2. Regla innegociable: no permitir dos elementos 'PLAYING' simultáneamente
    if (nextStatus === 'PLAYING') {
      const activePlaying = this.db
        .select({ id: queueItemsTable.id })
        .from(queueItemsTable)
        .where(
          and(
            eq(queueItemsTable.sessionId, existing.sessionId),
            eq(queueItemsTable.status, 'PLAYING'),
          ),
        )
        .all();

      const otherPlaying = activePlaying.filter((r) => r.id !== queueItemId);
      if (otherPlaying.length > 0) {
        throw new QueueError(
          'Conflicto de reproducción: Ya existe una canción reproduciéndose actualmente. Detenla o complétala antes de iniciar otra.',
        );
      }
    }

    const now = new Date().toISOString();
    const patch: Partial<typeof queueItemsTable.$inferInsert> = {
      status: nextStatus,
      updatedAt: now,
    };

    if (nextStatus === 'PLAYING') {
      patch.startedAt = now;
    } else if (['COMPLETED', 'SKIPPED', 'CANCELLED', 'FAILED'].includes(nextStatus)) {
      patch.completedAt = now;
    }

    if (failureReason !== undefined) {
      patch.failureReason = failureReason;
    }

    // 3. Transacción atómica en SQLite con logging en queue_events
    this.db.transaction(() => {
      this.db
        .update(queueItemsTable)
        .set(patch)
        .where(eq(queueItemsTable.id, queueItemId))
        .run();

      this.db
        .insert(queueEventsTable)
        .values({
          id: randomUUID(),
          sessionId: existing.sessionId,
          queueItemId,
          eventType: `STATE_${nextStatus}`,
          previousState: currentStatus,
          nextState: nextStatus,
          payloadJson: failureReason ? JSON.stringify({ failureReason }) : null,
          createdAt: now,
        })
        .run();
    });

    const items = this.getQueueForSession(existing.sessionId);
    const updated = items.find((i) => i.id === queueItemId);
    if (!updated) {
      throw new QueueError('Error al recuperar elemento actualizado.');
    }
    return updated;
  }

  /**
   * Recupera la cola al iniciar la aplicación si hubo un reinicio abrupto:
   * Ningún elemento debe quedar marcado falsamente como PLAYING; se reconcilian a READY o QUEUED.
   */
  public recoverSessionQueue(sessionId: string): { recoveredCount: number } {
    const lingeringPlaying = this.db
      .select({ id: queueItemsTable.id })
      .from(queueItemsTable)
      .where(
        and(
          eq(queueItemsTable.sessionId, sessionId),
          eq(queueItemsTable.status, 'PLAYING'),
        ),
      )
      .all();

    let recoveredCount = 0;
    const now = new Date().toISOString();

    this.db.transaction(() => {
      for (const item of lingeringPlaying) {
        this.db
          .update(queueItemsTable)
          .set({
            status: 'READY',
            updatedAt: now,
          })
          .where(eq(queueItemsTable.id, item.id))
          .run();

        this.db
          .insert(queueEventsTable)
          .values({
            id: randomUUID(),
            sessionId,
            queueItemId: item.id,
            eventType: 'RECOVERED_AFTER_RESTART',
            previousState: 'PLAYING',
            nextState: 'READY',
            payloadJson: JSON.stringify({ note: 'Reconciliado de PLAYING a READY tras reinicio' }),
            createdAt: now,
          })
        .run();

        recoveredCount++;
      }
    });

    return { recoveredCount };
  }

  public listSessionEvents(sessionId: string, limit = 100): QueueEventDTO[] {
    const rows = this.db
      .select()
      .from(queueEventsTable)
      .where(eq(queueEventsTable.sessionId, sessionId))
      .orderBy(desc(queueEventsTable.createdAt))
      .limit(limit)
      .all();

    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      queueItemId: r.queueItemId,
      eventType: r.eventType,
      previousState: r.previousState,
      nextState: r.nextState,
      payloadJson: r.payloadJson,
      createdAt: r.createdAt,
    }));
  }
}
