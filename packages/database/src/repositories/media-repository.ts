import { eq, and, like, desc, asc, sql } from 'drizzle-orm';
import { KaraokeDatabase } from '../connection.js';
import {
  mediaFoldersTable,
  mediaAssetsTable,
  songsTable,
} from '../schema.js';
import {
  MediaFolderDTO,
  FolderCategory,
  ScanStatus,
  MediaStatus,
  CatalogQuery,
  SongDTO,
  UpdateSongDTO,
} from '@karaoke/contracts';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

export interface BatchItemInput {
  relativePath: string;
  filename: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  fingerprint: string;
  durationMs: number | null;
  container: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
  audioChannels: number | null;
  status: MediaStatus;
  title: string;
  artist: string;
  searchTextNormalized: string;
}

export function normalizeSearchString(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class MediaRepository {
  constructor(private db: KaraokeDatabase) {}

  public addFolder(
    absolutePath: string,
    displayName: string,
    category: FolderCategory = 'KARAOKE',
  ): MediaFolderDTO {
    const now = new Date().toISOString();
    const folder: MediaFolderDTO = {
      id: randomUUID(),
      displayName,
      category,
      enabled: true,
      lastScanStartedAt: null,
      lastScanCompletedAt: null,
      scanStatus: 'IDLE',
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .insert(mediaFoldersTable)
      .values({
        id: folder.id,
        displayName: folder.displayName,
        absolutePath,
        category: folder.category,
        enabled: folder.enabled,
        scanStatus: folder.scanStatus,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      })
      .run();

    return folder;
  }

  public listFolders(): MediaFolderDTO[] {
    const rows = this.db.select().from(mediaFoldersTable).all();
    return rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      category: r.category as FolderCategory,
      enabled: r.enabled,
      lastScanStartedAt: r.lastScanStartedAt,
      lastScanCompletedAt: r.lastScanCompletedAt,
      scanStatus: r.scanStatus as ScanStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  public getFolderById(folderId: string): (MediaFolderDTO & { absolutePath: string }) | null {
    const row = this.db
      .select()
      .from(mediaFoldersTable)
      .where(eq(mediaFoldersTable.id, folderId))
      .get();

    if (!row) return null;

    return {
      id: row.id,
      displayName: row.displayName,
      absolutePath: row.absolutePath,
      category: row.category as FolderCategory,
      enabled: row.enabled,
      lastScanStartedAt: row.lastScanStartedAt,
      lastScanCompletedAt: row.lastScanCompletedAt,
      scanStatus: row.scanStatus as ScanStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  public updateFolderScanStatus(
    folderId: string,
    status: ScanStatus,
    scanStartedAt?: string | null,
    scanCompletedAt?: string | null,
  ): void {
    const now = new Date().toISOString();
    const patch: Partial<typeof mediaFoldersTable.$inferInsert> = {
      scanStatus: status,
      updatedAt: now,
    };
    if (scanStartedAt !== undefined) patch.lastScanStartedAt = scanStartedAt;
    if (scanCompletedAt !== undefined) patch.lastScanCompletedAt = scanCompletedAt;

    this.db.update(mediaFoldersTable).set(patch).where(eq(mediaFoldersTable.id, folderId)).run();
  }

  public removeFolder(folderId: string): void {
    // Al eliminar la carpeta, la restricción ON DELETE CASCADE de SQLite limpia automáticamente los activos asociados
    this.db.delete(mediaFoldersTable).where(eq(mediaFoldersTable.id, folderId)).run();
  }

  public toggleFolder(folderId: string, enabled: boolean): MediaFolderDTO | null {
    const now = new Date().toISOString();
    this.db
      .update(mediaFoldersTable)
      .set({ enabled, updatedAt: now })
      .where(eq(mediaFoldersTable.id, folderId))
      .run();

    return this.listFolders().find((f) => f.id === folderId) || null;
  }

  public updateAssetStatus(assetId: string, status: MediaStatus): void {
    const now = new Date().toISOString();
    this.db
      .update(mediaAssetsTable)
      .set({ status, updatedAt: now })
      .where(eq(mediaAssetsTable.id, assetId))
      .run();
  }

  /**
   * Reconcilia activos que pudieron marcarse como INCOMPATIBLE o CORRUPT por portadas incrustadas (mjpeg/png)
   * o fallos de ejecución de ffprobe en versiones previas.
   */
  public healFalseIncompatibleAssets(): number {
    const rows = this.db
      .select()
      .from(mediaAssetsTable)
      .where(sql`${mediaAssetsTable.status} IN ('INCOMPATIBLE', 'CORRUPT')`)
      .all();

    let healed = 0;
    const now = new Date().toISOString();
    const recoverableVideoCodecs = new Set(['mjpeg', 'png', 'bmp', 'webp', 'gif', 'hevc', 'h265', 'mpeg4', 'theora']);

    this.db.transaction(() => {
      for (const row of rows) {
        const vCodec = (row.videoCodec || '').toLowerCase();
        if (!row.videoCodec || recoverableVideoCodecs.has(vCodec)) {
          this.db
            .update(mediaAssetsTable)
            .set({
              status: 'AVAILABLE',
              videoCodec: ['mjpeg', 'png', 'bmp', 'webp', 'gif'].includes(vCodec) ? null : row.videoCodec,
              updatedAt: now,
            })
            .where(eq(mediaAssetsTable.id, row.id))
            .run();
          healed++;
        }
      }
    });

    return healed;
  }

  /**
   * Sincroniza un lote de elementos escaneados en una transacción atómica.
   * Si el activo ya existe, actualiza metadatos técnicos.
   * Si la canción tiene metadataSource === 'MANUAL', preserva las correcciones del operador.
   */
  public syncScannedBatch(folderId: string, items: BatchItemInput[]): void {
    if (items.length === 0) return;

    const now = new Date().toISOString();

    this.db.transaction(() => {
      for (const item of items) {
        // 1. Buscar si ya existe el activo por (folder_id, relative_path)
        const existingAsset = this.db
          .select()
          .from(mediaAssetsTable)
          .where(
            and(
              eq(mediaAssetsTable.folderId, folderId),
              eq(mediaAssetsTable.relativePath, item.relativePath),
            ),
          )
          .get();

        let assetId: string;

        if (existingAsset) {
          assetId = existingAsset.id;
          this.db
            .update(mediaAssetsTable)
            .set({
              filename: item.filename,
              extension: item.extension,
              sizeBytes: item.sizeBytes,
              modifiedAt: item.modifiedAt,
              fingerprint: item.fingerprint,
              durationMs: item.durationMs,
              container: item.container,
              videoCodec: item.videoCodec,
              audioCodec: item.audioCodec,
              width: item.width,
              height: item.height,
              audioChannels: item.audioChannels,
              status: item.status,
              lastSeenAt: now,
              updatedAt: now,
            })
            .where(eq(mediaAssetsTable.id, assetId))
            .run();
        } else {
          assetId = randomUUID();
          this.db
            .insert(mediaAssetsTable)
            .values({
              id: assetId,
              folderId,
              relativePath: item.relativePath,
              filename: item.filename,
              extension: item.extension,
              sizeBytes: item.sizeBytes,
              modifiedAt: item.modifiedAt,
              fingerprint: item.fingerprint,
              durationMs: item.durationMs,
              container: item.container,
              videoCodec: item.videoCodec,
              audioCodec: item.audioCodec,
              width: item.width,
              height: item.height,
              audioChannels: item.audioChannels,
              status: item.status,
              lastSeenAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .run();
        }

        // 2. Gestionar la canción asociada
        const existingSong = this.db
          .select()
          .from(songsTable)
          .where(eq(songsTable.mediaAssetId, assetId))
          .get();

        if (existingSong) {
          // Si el operador corrigió manualmente el título o artista, no sobrescribirlos
          if (existingSong.metadataSource !== 'MANUAL') {
            this.db
              .update(songsTable)
              .set({
                title: item.title,
                artist: item.artist,
                searchTextNormalized: item.searchTextNormalized,
                updatedAt: now,
              })
              .where(eq(songsTable.id, existingSong.id))
              .run();
          }
        } else {
          this.db
            .insert(songsTable)
            .values({
              id: randomUUID(),
              mediaAssetId: assetId,
              title: item.title,
              artist: item.artist,
              searchTextNormalized: item.searchTextNormalized,
              metadataSource: 'FILENAME',
              createdAt: now,
              updatedAt: now,
            })
            .run();
        }
      }
    });
  }

  /**
   * Marca como 'MISSING' los archivos de la carpeta que no fueron observados en el último escaneo.
   * No los elimina de la base para preservar historiales de cola y correcciones manuales.
   */
  public reconcileMissingAssets(folderId: string, seenRelativePaths: Set<string>): number {
    const assets = this.db
      .select({ id: mediaAssetsTable.id, relativePath: mediaAssetsTable.relativePath })
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.folderId, folderId))
      .all();

    let missingCount = 0;
    const now = new Date().toISOString();

    this.db.transaction(() => {
      for (const asset of assets) {
        if (!seenRelativePaths.has(asset.relativePath)) {
          this.db
            .update(mediaAssetsTable)
            .set({
              status: 'MISSING',
              updatedAt: now,
            })
            .where(eq(mediaAssetsTable.id, asset.id))
            .run();
          missingCount++;
        }
      }
    });

    return missingCount;
  }

  /**
   * Consulta paginada y optimizada para catálogo grande (hasta 100.000 archivos).
   */
  public queryCatalog(query: CatalogQuery): {
    items: SongDTO[];
    total: number;
    page: number;
    pageSize: number;
  } {
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const offset = (page - 1) * pageSize;

    // Construcción de condiciones WHERE
    const conditions = [];

    if (query.folderId) {
      conditions.push(eq(mediaAssetsTable.folderId, query.folderId));
    } else {
      conditions.push(eq(mediaFoldersTable.enabled, true));
    }

    if (query.status) {
      conditions.push(eq(mediaAssetsTable.status, query.status));
    }

    if (query.extension && query.extension.trim()) {
      const ext = query.extension.trim().toLowerCase().startsWith('.')
        ? query.extension.trim().toLowerCase()
        : `.${query.extension.trim().toLowerCase()}`;
      conditions.push(eq(mediaAssetsTable.extension, ext));
    }

    if (query.language && query.language.trim()) {
      conditions.push(like(songsTable.language, `%${query.language.trim()}%`));
    }

    if (query.search && query.search.trim()) {
      const cleanTerm = normalizeSearchString(query.search);
      if (cleanTerm) {
        const tokens = cleanTerm.split(' ').filter(Boolean);
        for (const token of tokens) {
          conditions.push(like(songsTable.searchTextNormalized, `%${token}%`));
        }
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total de registros coincidentes
    const countResult = this.db
      .select({ count: sql<number>`count(*)` })
      .from(songsTable)
      .innerJoin(mediaAssetsTable, eq(songsTable.mediaAssetId, mediaAssetsTable.id))
      .innerJoin(mediaFoldersTable, eq(mediaAssetsTable.folderId, mediaFoldersTable.id))
      .where(whereClause)
      .get();

    const total = countResult?.count ?? 0;

    // Ordenación
    let orderExpr = asc(songsTable.title);
    if (query.sortBy === 'artist') {
      orderExpr = query.sortOrder === 'desc' ? desc(songsTable.artist) : asc(songsTable.artist);
    } else if (query.sortBy === 'createdAt') {
      orderExpr = query.sortOrder === 'desc' ? desc(songsTable.createdAt) : asc(songsTable.createdAt);
    } else {
      orderExpr = query.sortOrder === 'desc' ? desc(songsTable.title) : asc(songsTable.title);
    }

    // Registros paginados
    const rows = this.db
      .select({
        song: songsTable,
        asset: mediaAssetsTable,
      })
      .from(songsTable)
      .innerJoin(mediaAssetsTable, eq(songsTable.mediaAssetId, mediaAssetsTable.id))
      .innerJoin(mediaFoldersTable, eq(mediaAssetsTable.folderId, mediaFoldersTable.id))
      .where(whereClause)
      .orderBy(orderExpr)
      .limit(pageSize)
      .offset(offset)
      .all();

    const items: SongDTO[] = rows.map(({ song, asset }) => ({
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
    }));

    return { items, total, page, pageSize };
  }

  public updateSongMetadata(updates: UpdateSongDTO): SongDTO | null {
    const existing = this.db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, updates.songId))
      .get();

    if (!existing) return null;

    const now = new Date().toISOString();
    const cleanSearch = normalizeSearchString(`${updates.artist} ${updates.title}`);

    this.db
      .update(songsTable)
      .set({
        title: updates.title,
        artist: updates.artist,
        language: updates.language !== undefined ? updates.language : existing.language,
        genre: updates.genre !== undefined ? updates.genre : existing.genre,
        collection: updates.collection !== undefined ? updates.collection : existing.collection,
        searchTextNormalized: cleanSearch,
        metadataSource: 'MANUAL',
        updatedAt: now,
      })
      .where(eq(songsTable.id, updates.songId))
      .run();

    return this.getSongById(updates.songId);
  }

  public getSongById(songId: string): SongDTO | null {
    const row = this.db
      .select({
        song: songsTable,
        asset: mediaAssetsTable,
      })
      .from(songsTable)
      .innerJoin(mediaAssetsTable, eq(songsTable.mediaAssetId, mediaAssetsTable.id))
      .where(eq(songsTable.id, songId))
      .get();

    if (!row) return null;
    const { song, asset } = row;
    return {
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
    };
  }

  public getSongByAssetId(assetId: string): SongDTO | null {
    const row = this.db
      .select({ id: songsTable.id })
      .from(songsTable)
      .where(eq(songsTable.mediaAssetId, assetId))
      .get();
    if (!row) return null;
    return this.getSongById(row.id);
  }

  public getAssetById(assetId: string) {
    return this.db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, assetId)).get();
  }

  public getAssetFileDetails(assetId: string): {
    folderAbsolutePath: string;
    relativePath: string;
    absolutePath: string;
    asset: typeof mediaAssetsTable.$inferSelect;
  } | null {
    const asset = this.getAssetById(assetId);
    if (!asset) return null;
    const folder = this.getFolderById(asset.folderId);
    if (!folder || !folder.absolutePath) return null;
    const absolutePath = path.join(folder.absolutePath, asset.relativePath);
    return {
      folderAbsolutePath: folder.absolutePath,
      relativePath: asset.relativePath,
      absolutePath,
      asset,
    };
  }

  public getAssetFileDetailsBySongId(songId: string): {
    folderAbsolutePath: string;
    relativePath: string;
    absolutePath: string;
    asset: typeof mediaAssetsTable.$inferSelect;
  } | null {
    const song = this.db.select().from(songsTable).where(eq(songsTable.id, songId)).get();
    if (!song) return null;
    return this.getAssetFileDetails(song.mediaAssetId);
  }
}
