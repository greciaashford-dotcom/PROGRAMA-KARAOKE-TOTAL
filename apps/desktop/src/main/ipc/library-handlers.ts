import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import * as path from 'node:path';
import {
  IPC_CHANNELS,
  CatalogQuerySchema,
  UpdateSongSchema,
  ok,
  err,
  ErrorCode,
} from '@karaoke/contracts';
import { MediaRepository } from '@karaoke/database';
import {
  scanAuthorizedFolder,
  MediaFolderWatcher,
  assertSafePath,
  analyzeMediaFile,
} from '@karaoke/media-indexer';
import { z } from 'zod';

const FolderIdSchema = z.object({
  folderId: z.string().uuid(),
});

const MediaAssetIdSchema = z.object({
  mediaAssetId: z.string().uuid(),
});

export function registerLibraryHandlers(
  mediaRepo: MediaRepository,
  watcher: MediaFolderWatcher,
  getWindow: () => BrowserWindow | null,
): void {
  const activeScans = new Map<string, AbortController>();

  // 1. Selector de carpeta nativo
  ipcMain.handle(IPC_CHANNELS.LIBRARY_SELECT_FOLDER, async () => {
    try {
      const win = getWindow();
      const dialogResult = win
        ? await dialog.showOpenDialog(win, {
            title: 'Seleccionar Carpeta con Vídeos de Karaoke',
            properties: ['openDirectory'],
          })
        : await dialog.showOpenDialog({
            title: 'Seleccionar Carpeta con Vídeos de Karaoke',
            properties: ['openDirectory'],
          });

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return ok(null);
      }

      const selectedPath = dialogResult.filePaths[0];
      if (!selectedPath) return ok(null);

      // Verificar si ya existe registrada
      const existing = mediaRepo
        .listFolders()
        .find((f) => path.resolve(mediaRepo.getFolderById(f.id)?.absolutePath || '') === path.resolve(selectedPath));

      if (existing) {
        return ok(existing);
      }

      const displayName = path.basename(selectedPath) || selectedPath;
      const folder = mediaRepo.addFolder(selectedPath, displayName, 'KARAOKE');

      // Configurar watcher para la nueva carpeta
      watcher.watchFolder(folder.id, selectedPath, (event) => {
        const currentWin = getWindow();
        if (currentWin && !currentWin.isDestroyed()) {
          // Si hay cambio detectado por el watcher, notificar a la interfaz
          currentWin.webContents.send(IPC_CHANNELS.EVENT_SCAN_PROGRESS, {
            folderId: event.folderId,
            type: event.type,
            status: 'COMPLETED',
          });
        }
      });

      return ok(folder);
    } catch (error) {
      console.error('Error seleccionando carpeta:', error);
      return err(ErrorCode.SCANNER_ERROR, 'No se pudo autorizar la carpeta seleccionada.');
    }
  });

  // 2. Listar carpetas autorizadas
  ipcMain.handle(IPC_CHANNELS.LIBRARY_LIST_FOLDERS, async () => {
    try {
      const folders = mediaRepo.listFolders();
      return ok(folders);
    } catch (error) {
      console.error('Error listando carpetas:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al consultar las carpetas autorizadas.');
    }
  });

  // 3. Quitar carpeta autorizada
  ipcMain.handle(IPC_CHANNELS.LIBRARY_REMOVE_FOLDER, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = FolderIdSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'ID de carpeta inválido.');
      }

      const { folderId } = parseResult.data;
      watcher.unwatchFolder(folderId);
      mediaRepo.removeFolder(folderId);

      return ok(undefined);
    } catch (error) {
      console.error('Error quitando carpeta:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al desautorizar la carpeta.');
    }
  });

  // 4. Escaneo manual o inicial de una carpeta
  ipcMain.handle(IPC_CHANNELS.LIBRARY_SCAN_FOLDER, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = FolderIdSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'ID de carpeta inválido.');
      }

      const { folderId } = parseResult.data;
      const folder = mediaRepo.getFolderById(folderId);
      if (!folder) {
        return err(ErrorCode.NOT_FOUND, 'La carpeta no existe en la base de datos.');
      }

      // Si ya hay un escaneo activo para esta carpeta, cancelarlo antes de iniciar otro
      if (activeScans.has(folderId)) {
        activeScans.get(folderId)?.abort();
      }

      const abortController = new AbortController();
      activeScans.set(folderId, abortController);

      const startTime = new Date().toISOString();
      mediaRepo.updateFolderScanStatus(folderId, 'SCANNING', startTime, null);

      // Lanzar escaneo asíncrono
      scanAuthorizedFolder(
        folderId,
        folder.absolutePath,
        (progress) => {
          const win = getWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.EVENT_SCAN_PROGRESS, progress);
          }
        },
        abortController.signal,
      )
        .then(({ items, cancelled }) => {
          activeScans.delete(folderId);
          const endTime = new Date().toISOString();

          if (cancelled) {
            mediaRepo.updateFolderScanStatus(folderId, 'CANCELLED', startTime, endTime);
          } else {
            // Sincronizar lote con SQLite
            const batchInputs = items.map((i) => ({
              relativePath: i.relativePath,
              filename: i.filename,
              extension: i.extension,
              sizeBytes: i.sizeBytes,
              modifiedAt: i.modifiedAt,
              fingerprint: i.fingerprint,
              durationMs: i.technical.durationMs,
              container: i.technical.container,
              videoCodec: i.technical.videoCodec,
              audioCodec: i.technical.audioCodec,
              width: i.technical.width,
              height: i.technical.height,
              audioChannels: i.technical.audioChannels,
              status: i.technical.status,
              title: i.title,
              artist: i.artist,
              searchTextNormalized: i.searchTextNormalized,
            }));

            mediaRepo.syncScannedBatch(folderId, batchInputs);

            // Reconciliar archivos eliminados
            const seenPaths = new Set(items.map((i) => i.relativePath));
            mediaRepo.reconcileMissingAssets(folderId, seenPaths);

            mediaRepo.updateFolderScanStatus(folderId, 'COMPLETED', startTime, endTime);
          }
        })
        .catch((scanErr) => {
          activeScans.delete(folderId);
          console.error(`Fallo en escaneo de carpeta ${folderId}:`, scanErr);
          mediaRepo.updateFolderScanStatus(folderId, 'FAILED', startTime, new Date().toISOString());
        });

      return ok({ scanId: folderId });
    } catch (error) {
      console.error('Error al iniciar escaneo:', error);
      return err(ErrorCode.SCANNER_ERROR, 'No se pudo iniciar el escaneo de la carpeta.');
    }
  });

  // 5. Cancelar escaneo en curso
  ipcMain.handle(IPC_CHANNELS.LIBRARY_CANCEL_SCAN, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = FolderIdSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'ID de carpeta inválido.');
      }

      const { folderId } = parseResult.data;
      const controller = activeScans.get(folderId);
      if (controller) {
        controller.abort();
        activeScans.delete(folderId);
      }

      mediaRepo.updateFolderScanStatus(folderId, 'CANCELLED');
      return ok(undefined);
    } catch (error) {
      console.error('Error al cancelar escaneo:', error);
      return err(ErrorCode.SCANNER_ERROR, 'Error al cancelar el escaneo.');
    }
  });

  // 6. Consultar catálogo paginado y filtrado
  ipcMain.handle(IPC_CHANNELS.LIBRARY_LIST_ASSETS, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = CatalogQuerySchema.safeParse(rawPayload || {});
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'Parámetros de consulta de catálogo inválidos.');
      }

      const result = mediaRepo.queryCatalog(parseResult.data);
      return ok(result);
    } catch (error) {
      console.error('Error al consultar catálogo:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al consultar la biblioteca multimedia.');
    }
  });

  // 7. Actualizar metadatos de canción (corrección manual de artista/título)
  ipcMain.handle(IPC_CHANNELS.LIBRARY_UPDATE_SONG, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = UpdateSongSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(
          ErrorCode.VALIDATION_ERROR,
          'Datos de canción inválidos.',
          parseResult.error.format(),
        );
      }

      const updated = mediaRepo.updateSongMetadata(parseResult.data);
      if (!updated) {
        return err(ErrorCode.NOT_FOUND, 'La canción especificada no fue encontrada.');
      }

      return ok(updated);
    } catch (error) {
      console.error('Error actualizando canción:', error);
      return err(ErrorCode.DATABASE_ERROR, 'No se pudo guardar la modificación de la canción.');
    }
  });

  // 8. Localizar en el Explorador de Windows (seguro, sin exponer la ruta al renderer)
  ipcMain.handle(IPC_CHANNELS.LIBRARY_LOCATE_IN_EXPLORER, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = MediaAssetIdSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'ID de activo inválido.');
      }

      const asset = mediaRepo.getAssetById(parseResult.data.mediaAssetId);
      if (!asset) {
        return err(ErrorCode.NOT_FOUND, 'Activo multimedia no encontrado.');
      }

      const folder = mediaRepo.getFolderById(asset.folderId);
      if (!folder) {
        return err(ErrorCode.NOT_FOUND, 'Carpeta contenedora no encontrada.');
      }

      const fullPath = path.join(folder.absolutePath, asset.relativePath);
      const safePath = await assertSafePath(folder.absolutePath, fullPath);

      shell.showItemInFolder(safePath);
      return ok(undefined);
    } catch (error) {
      console.error('Error al localizar archivo en explorador:', error);
      return err(ErrorCode.INTERNAL_ERROR, 'No se pudo abrir el Explorador de Windows.');
    }
  });

  // 9. Volver a analizar un archivo específico con ffprobe
  ipcMain.handle(IPC_CHANNELS.LIBRARY_REANALYZE_ASSET, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = MediaAssetIdSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'ID de activo inválido.');
      }

      const asset = mediaRepo.getAssetById(parseResult.data.mediaAssetId);
      if (!asset) {
        return err(ErrorCode.NOT_FOUND, 'Activo multimedia no encontrado.');
      }

      const folder = mediaRepo.getFolderById(asset.folderId);
      if (!folder) {
        return err(ErrorCode.NOT_FOUND, 'Carpeta no encontrada.');
      }

      const fullPath = path.join(folder.absolutePath, asset.relativePath);
      const safePath = await assertSafePath(folder.absolutePath, fullPath);

      const technical = await analyzeMediaFile(safePath);

      mediaRepo.syncScannedBatch(folder.id, [
        {
          relativePath: asset.relativePath,
          filename: asset.filename,
          extension: asset.extension,
          sizeBytes: asset.sizeBytes,
          modifiedAt: asset.modifiedAt,
          fingerprint: asset.fingerprint,
          durationMs: technical.durationMs,
          container: technical.container,
          videoCodec: technical.videoCodec,
          audioCodec: technical.audioCodec,
          width: technical.width,
          height: technical.height,
          audioChannels: technical.audioChannels,
          status: technical.status,
          title: '', // Preserva la existente
          artist: '',
          searchTextNormalized: '',
        },
      ]);

      return ok(undefined);
    } catch (error) {
      console.error('Error reanalizando activo:', error);
      return err(ErrorCode.PROBE_ERROR, 'Fallo al reanalizar metadatos técnicos con ffprobe.');
    }
  });
}
