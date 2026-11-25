import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import {
  IPC_CHANNELS,
  CatalogQuerySchema,
  UpdateSongSchema,
  ToggleFolderSchema,
  ok,
  err,
  ErrorCode,
} from '@karaoke/contracts';
import { MediaRepository, BatchItemInput } from '@karaoke/database';
import {
  scanAuthorizedFolder,
  MediaFolderWatcher,
  assertSafePath,
  analyzeMediaFile,
  calculateFastFingerprint,
  parseSongMetadata,
  normalizeSearchText,
  getSafeRelativePath,
} from '@karaoke/media-indexer';
import { z } from 'zod';

const FolderIdSchema = z.object({
  folderId: z.string().uuid(),
});

const MediaAssetIdSchema = z.object({
  mediaAssetId: z.string().uuid(),
});

async function collectMp3FilesRecursive(dir: string, acc: string[] = []): Promise<string[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectMp3FilesRecursive(full, acc);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.mp3') {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Indexa de forma inmediata y directa todos los archivos .mp3 de una carpeta de Música de Ambiente
 * sin bloquearse esperando a ffprobe, garantizando disponibilidad instantánea en la lista MP3.
 */
async function indexAmbientMp3DirectoryImmediate(
  mediaRepo: MediaRepository,
  folderId: string,
  rootPath: string,
): Promise<number> {
  const startTime = new Date().toISOString();
  mediaRepo.updateFolderScanStatus(folderId, 'SCANNING', startTime, null);

  const mp3Paths = await collectMp3FilesRecursive(rootPath);
  const batchInputs: BatchItemInput[] = [];

  for (const fullPath of mp3Paths) {
    try {
      const safePath = await assertSafePath(rootPath, fullPath);
      const stats = await fsp.stat(safePath);
      const relativePath = getSafeRelativePath(rootPath, safePath);
      const filename = path.basename(safePath);
      const fingerprint = await calculateFastFingerprint(safePath, stats.size, stats.mtimeMs);
      const parsed = parseSongMetadata(filename);
      const searchTextNormalized = normalizeSearchText(`${parsed.artist} ${parsed.title} ${filename}`);

      batchInputs.push({
        relativePath,
        filename,
        extension: '.mp3',
        sizeBytes: stats.size,
        modifiedAt: new Date(stats.mtimeMs).toISOString(),
        fingerprint,
        durationMs: null,
        container: 'mp3',
        videoCodec: null,
        audioCodec: 'mp3',
        width: null,
        height: null,
        audioChannels: 2,
        status: 'AVAILABLE',
        title: parsed.title,
        artist: parsed.artist,
        searchTextNormalized,
      });
    } catch (err) {
      console.warn(`[Ambiente MP3] Omitiendo archivo ${fullPath}:`, err);
    }
  }

  mediaRepo.syncScannedBatch(folderId, batchInputs);
  const seenPaths = new Set(batchInputs.map((b) => b.relativePath));
  mediaRepo.reconcileMissingAssets(folderId, seenPaths);
  mediaRepo.updateFolderScanStatus(folderId, 'COMPLETED', startTime, new Date().toISOString());

  return batchInputs.length;
}

export function registerLibraryHandlers(
  mediaRepo: MediaRepository,
  watcher: MediaFolderWatcher,
  getWindow: () => BrowserWindow | null,
): void {
  const activeScans = new Map<string, AbortController>();

  const sendScanProgress = (progress: unknown) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.EVENT_SCAN_PROGRESS, progress);
    }
  };

  const triggerFolderScan = (folderId: string): boolean => {
    const folder = mediaRepo.getFolderById(folderId);
    if (!folder || !folder.enabled) return false;

    if (activeScans.has(folderId)) {
      activeScans.get(folderId)?.abort();
    }

    const abortController = new AbortController();
    activeScans.set(folderId, abortController);

    const startTime = new Date().toISOString();
    mediaRepo.updateFolderScanStatus(folderId, 'SCANNING', startTime, null);

    scanAuthorizedFolder(
      folderId,
      folder.absolutePath,
      (progress) => {
        // No emitir COMPLETED prematuramente antes de que syncScannedBatch escriba en SQLite
        if (progress.status !== 'COMPLETED') {
          sendScanProgress(progress);
        }
      },
      abortController.signal,
    )
      .then(({ items, cancelled }) => {
        activeScans.delete(folderId);
        const endTime = new Date().toISOString();

        if (cancelled) {
          mediaRepo.updateFolderScanStatus(folderId, 'CANCELLED', startTime, endTime);
          sendScanProgress({
            folderId,
            discovered: items.length,
            processed: items.length,
            errors: 0,
            status: 'CANCELLED',
          });
        } else {
          const filteredItems =
            folder.category === 'AMBIENT'
              ? items.filter((i) => i.extension.toLowerCase() === '.mp3')
              : items;

          const batchInputs = filteredItems.map((i) => ({
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

          const seenPaths = new Set(filteredItems.map((i) => i.relativePath));
          mediaRepo.reconcileMissingAssets(folderId, seenPaths);

          mediaRepo.updateFolderScanStatus(folderId, 'COMPLETED', startTime, endTime);

          // Ahora SÍ emitir COMPLETED con los registros ya guardados en SQLite
          sendScanProgress({
            folderId,
            discovered: filteredItems.length,
            processed: filteredItems.length,
            errors: 0,
            status: 'COMPLETED',
          });
        }
      })
      .catch((scanErr) => {
        activeScans.delete(folderId);
        console.error(`Fallo en escaneo de carpeta ${folderId}:`, scanErr);
        mediaRepo.updateFolderScanStatus(folderId, 'FAILED', startTime, new Date().toISOString());
        sendScanProgress({
          folderId,
          discovered: 0,
          processed: 0,
          errors: 1,
          status: 'FAILED',
        });
      });

    return true;
  };

  // 1. Selector de carpeta nativo para Catálogo Karaoke
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

      // Verificar si ya existe registrada en categoría KARAOKE
      const existing = mediaRepo
        .listFolders()
        .find(
          (f) =>
            f.category === 'KARAOKE' &&
            path.resolve(mediaRepo.getFolderById(f.id)?.absolutePath || '') ===
              path.resolve(selectedPath),
        );

      if (existing) {
        if (!existing.enabled) {
          mediaRepo.toggleFolder(existing.id, true);
        }
        return ok(existing);
      }

      const displayName = path.basename(selectedPath) || selectedPath;
      const folder = mediaRepo.addFolder(selectedPath, displayName, 'KARAOKE');

      watcher.watchFolder(folder.id, selectedPath, (event) => {
        if (!activeScans.has(event.folderId)) {
          triggerFolderScan(event.folderId);
        }
      });

      return ok(folder);
    } catch (error) {
      console.error('Error seleccionando carpeta:', error);
      return err(ErrorCode.SCANNER_ERROR, 'No se pudo autorizar la carpeta seleccionada.');
    }
  });

  // 1b. Selector de carpeta de música de ambiente (exclusivamente MP3, indexación inmediata)
  ipcMain.handle(IPC_CHANNELS.LIBRARY_SELECT_AMBIENT_FOLDER, async () => {
    try {
      const win = getWindow();
      const dialogResult = win
        ? await dialog.showOpenDialog(win, {
            title: 'Seleccionar Carpeta de Música de Ambiente (Solo MP3)',
            properties: ['openDirectory'],
          })
        : await dialog.showOpenDialog({
            title: 'Seleccionar Carpeta de Música de Ambiente (Solo MP3)',
            properties: ['openDirectory'],
          });

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return ok(null);
      }

      const selectedPath = dialogResult.filePaths[0];
      if (!selectedPath) return ok(null);

      // Buscar solo en categoría AMBIENT para no colisionar con carpetas KARAOKE
      let folder = mediaRepo
        .listFolders()
        .find(
          (f) =>
            f.category === 'AMBIENT' &&
            path.resolve(mediaRepo.getFolderById(f.id)?.absolutePath || '') ===
              path.resolve(selectedPath),
        );

      if (!folder) {
        const displayName = `${path.basename(selectedPath) || selectedPath} (Ambiente MP3)`;
        folder = mediaRepo.addFolder(selectedPath, displayName, 'AMBIENT');
      } else if (!folder.enabled) {
        mediaRepo.toggleFolder(folder.id, true);
      }

      const count = await indexAmbientMp3DirectoryImmediate(mediaRepo, folder.id, selectedPath);

      watcher.watchFolder(folder.id, selectedPath, (event) => {
        indexAmbientMp3DirectoryImmediate(mediaRepo, event.folderId, selectedPath).catch(() => {});
      });

      sendScanProgress({
        folderId: folder.id,
        discovered: count,
        processed: count,
        errors: 0,
        status: 'COMPLETED',
      });

      return ok(folder);
    } catch (error) {
      console.error('Error seleccionando carpeta de ambiente:', error);
      return err(ErrorCode.SCANNER_ERROR, 'No se pudo cargar la carpeta de música de ambiente.');
    }
  });

  // 1c. Selector de archivos individuales MP3 para música de ambiente (indexación inmediata)
  ipcMain.handle(IPC_CHANNELS.LIBRARY_SELECT_AMBIENT_FILES, async () => {
    try {
      const win = getWindow();
      const dialogOptions: Electron.OpenDialogOptions = {
        title: 'Seleccionar Archivos MP3 de Música de Ambiente',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Archivos de Audio MP3 (*.mp3)', extensions: ['mp3'] }],
      };

      const dialogResult = win
        ? await dialog.showOpenDialog(win, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return ok({ addedCount: 0 });
      }

      const mp3Files = dialogResult.filePaths.filter(
        (fp) => path.extname(fp).toLowerCase() === '.mp3' && fs.existsSync(fp),
      );
      if (mp3Files.length === 0) {
        return err(
          ErrorCode.VALIDATION_ERROR,
          'Solo se permiten archivos en formato .mp3 para música de ambiente.',
        );
      }

      const ambientDir = path.join(app.getPath('userData'), 'ambient-mp3');
      if (!fs.existsSync(ambientDir)) {
        fs.mkdirSync(ambientDir, { recursive: true });
      }

      let ambientFolder = mediaRepo
        .listFolders()
        .find(
          (f) =>
            f.category === 'AMBIENT' &&
            path.resolve(mediaRepo.getFolderById(f.id)?.absolutePath || '') ===
              path.resolve(ambientDir),
        );

      if (!ambientFolder) {
        ambientFolder = mediaRepo.addFolder(ambientDir, 'Archivos MP3 de Ambiente', 'AMBIENT');
      } else if (!ambientFolder.enabled) {
        mediaRepo.toggleFolder(ambientFolder.id, true);
      }

      for (const srcFile of mp3Files) {
        const destFile = path.join(ambientDir, path.basename(srcFile));
        if (path.resolve(srcFile) !== path.resolve(destFile)) {
          await fsp.copyFile(srcFile, destFile);
        }
      }

      await indexAmbientMp3DirectoryImmediate(mediaRepo, ambientFolder.id, ambientDir);

      sendScanProgress({
        folderId: ambientFolder.id,
        discovered: mp3Files.length,
        processed: mp3Files.length,
        errors: 0,
        status: 'COMPLETED',
      });

      return ok({ addedCount: mp3Files.length, folderId: ambientFolder.id });
    } catch (error) {
      console.error('Error importando archivos MP3 de ambiente:', error);
      return err(
        ErrorCode.SCANNER_ERROR,
        'No se pudieron importar los archivos MP3 seleccionados.',
      );
    }
  });

  // 1d. Quitar un archivo individual (activo multimedia)
  ipcMain.handle(IPC_CHANNELS.LIBRARY_REMOVE_ASSET, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = MediaAssetIdSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'ID de activo inválido.');
      }

      // Si el archivo estaba en la carpeta interna ambient-mp3, borrar la copia interna para que no reaparezca
      const details = mediaRepo.getAssetFileDetails(parseResult.data.mediaAssetId);
      const internalAmbientDir = path.resolve(path.join(app.getPath('userData'), 'ambient-mp3'));
      if (details && path.resolve(details.folderAbsolutePath) === internalAmbientDir) {
        try {
          if (fs.existsSync(details.absolutePath)) {
            fs.unlinkSync(details.absolutePath);
          }
        } catch {
          // Ignorar si está en uso
        }
      }

      mediaRepo.removeAsset(parseResult.data.mediaAssetId);
      return ok(undefined);
    } catch (error) {
      console.error('Error eliminando activo:', error);
      return err(ErrorCode.DATABASE_ERROR, 'No se pudo quitar el archivo.');
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

  // 3. Quitar carpeta autorizada (limpia referencias de cola sin borrar archivos del disco)
  ipcMain.handle(IPC_CHANNELS.LIBRARY_REMOVE_FOLDER, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = FolderIdSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(ErrorCode.VALIDATION_ERROR, 'ID de carpeta inválido.');
      }

      const { folderId } = parseResult.data;
      if (activeScans.has(folderId)) {
        activeScans.get(folderId)?.abort();
        activeScans.delete(folderId);
      }
      watcher.unwatchFolder(folderId);
      mediaRepo.removeFolder(folderId);

      return ok(undefined);
    } catch (error) {
      console.error('Error quitando carpeta:', error);
      return err(ErrorCode.DATABASE_ERROR, 'Error al quitar la carpeta del catálogo.');
    }
  });

  // 3b. Habilitar o deshabilitar carpeta autorizada sin desautorizarla
  ipcMain.handle(IPC_CHANNELS.LIBRARY_TOGGLE_FOLDER, async (_event, rawPayload: unknown) => {
    try {
      const parseResult = ToggleFolderSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return err(
          ErrorCode.VALIDATION_ERROR,
          'Parámetros inválidos para cambiar estado de carpeta.',
        );
      }

      const { folderId, enabled } = parseResult.data;
      const updated = mediaRepo.toggleFolder(folderId, enabled);
      if (!updated) {
        return err(ErrorCode.NOT_FOUND, 'Carpeta no encontrada.');
      }

      const full = mediaRepo.getFolderById(folderId);
      if (enabled && full?.absolutePath) {
        watcher.watchFolder(folderId, full.absolutePath, (event) => {
          if (!activeScans.has(event.folderId)) {
            triggerFolderScan(event.folderId);
          }
        });
      } else {
        watcher.unwatchFolder(folderId);
      }

      return ok(updated);
    } catch (error) {
      console.error('Error cambiando estado de carpeta:', error);
      return err(ErrorCode.DATABASE_ERROR, 'No se pudo actualizar el estado de la carpeta.');
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

      if (!folder.enabled) {
        mediaRepo.toggleFolder(folderId, true);
      }

      if (folder.category === 'AMBIENT') {
        const count = await indexAmbientMp3DirectoryImmediate(
          mediaRepo,
          folder.id,
          folder.absolutePath,
        );
        sendScanProgress({
          folderId: folder.id,
          discovered: count,
          processed: count,
          errors: 0,
          status: 'COMPLETED',
        });
      } else {
        triggerFolderScan(folderId);
      }

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

  // 7. Actualizar metadatos de canción
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

  // 8. Localizar en el Explorador de Windows
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

  // 9. Reanalizar archivo con ffprobe
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
          title: '',
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
