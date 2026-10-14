import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ALLOWED_MEDIA_EXTENSIONS, DEFAULT_SCAN_CONCURRENCY } from './constants.js';
import { assertSafePath, getSafeRelativePath } from './security-path.js';
import { calculateFastFingerprint } from './hasher.js';
import { parseSongMetadata, normalizeSearchText } from './parser.js';
import { analyzeMediaFile, TechnicalMetadata } from './ffprobe.js';

export interface ScanProgress {
  folderId: string;
  discovered: number;
  processed: number;
  errors: number;
  status: 'SCANNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  currentFile?: string;
}

export interface ScannedMediaItem {
  relativePath: string;
  filename: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  fingerprint: string;
  technical: TechnicalMetadata;
  title: string;
  artist: string;
  searchTextNormalized: string;
}

export type ScanProgressCallback = (progress: ScanProgress) => void;

/**
 * Escanea recursivamente un directorio autorizado buscando archivos multimedia permitidos.
 */
export async function* walkDirectory(
  rootPath: string,
  currentDir: string = rootPath,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (signal?.aborted) return;

  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (signal?.aborted) return;

    // Ignorar archivos y carpetas ocultas o del sistema
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      yield* walkDirectory(rootPath, fullPath, signal);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_MEDIA_EXTENSIONS.has(ext)) {
        // Validación estricta contra directory traversal
        await assertSafePath(rootPath, fullPath);
        yield fullPath;
      }
    }
  }
}

/**
 * Ejecutor del escaneo asíncrono con control de concurrencia y emisión de progreso.
 */
export async function scanAuthorizedFolder(
  folderId: string,
  rootPath: string,
  onProgress?: ScanProgressCallback,
  signal?: AbortSignal,
  concurrency: number = DEFAULT_SCAN_CONCURRENCY,
): Promise<{ items: ScannedMediaItem[]; cancelled: boolean }> {
  const discoveredPaths: string[] = [];
  const items: ScannedMediaItem[] = [];
  let processed = 0;
  let errors = 0;

  // 1. Fase de descubrimiento rápido
  try {
    for await (const filePath of walkDirectory(rootPath, rootPath, signal)) {
      if (signal?.aborted) {
        onProgress?.({
          folderId,
          discovered: discoveredPaths.length,
          processed,
          errors,
          status: 'CANCELLED',
        });
        return { items, cancelled: true };
      }

      discoveredPaths.push(filePath);
      if (discoveredPaths.length % 50 === 0) {
        onProgress?.({
          folderId,
          discovered: discoveredPaths.length,
          processed: 0,
          errors: 0,
          status: 'SCANNING',
        });
      }
    }
  } catch (err) {
    console.error(`Error descubriendo archivos en ${rootPath}:`, err);
    onProgress?.({
      folderId,
      discovered: discoveredPaths.length,
      processed,
      errors: ++errors,
      status: 'FAILED',
    });
    throw err;
  }

  onProgress?.({
    folderId,
    discovered: discoveredPaths.length,
    processed: 0,
    errors: 0,
    status: 'SCANNING',
  });

  // 2. Procesamiento concurrente limitado por lotes
  const queue = [...discoveredPaths];

  const processNext = async (): Promise<void> => {
    while (queue.length > 0) {
      if (signal?.aborted) return;

      const filePath = queue.shift();
      if (!filePath) break;

      try {
        const stats = await fs.stat(filePath);
        const relativePath = getSafeRelativePath(rootPath, filePath);
        const filename = path.basename(filePath);
        const extension = path.extname(filePath).toLowerCase();

        // Huella rápida
        const fingerprint = await calculateFastFingerprint(
          filePath,
          stats.size,
          stats.mtimeMs,
        );

        // Análisis técnico
        const technical = await analyzeMediaFile(filePath);

        // Inferencia de metadatos
        const parsed = parseSongMetadata(filename);
        const searchTextNormalized = normalizeSearchText(
          `${parsed.artist} ${parsed.title} ${filename}`,
        );

        items.push({
          relativePath,
          filename,
          extension,
          sizeBytes: stats.size,
          modifiedAt: new Date(stats.mtimeMs).toISOString(),
          fingerprint,
          technical,
          title: parsed.title,
          artist: parsed.artist,
          searchTextNormalized,
        });

        processed++;
      } catch (err) {
        console.error(`Error procesando archivo ${filePath}:`, err);
        errors++;
      } finally {
        onProgress?.({
          folderId,
          discovered: discoveredPaths.length,
          processed,
          errors,
          status: 'SCANNING',
          currentFile: path.basename(filePath),
        });
      }
    }
  };

  const workers = Array.from({ length: concurrency }, () => processNext());
  await Promise.all(workers);

  const cancelled = signal?.aborted ?? false;

  onProgress?.({
    folderId,
    discovered: discoveredPaths.length,
    processed,
    errors,
    status: cancelled ? 'CANCELLED' : 'COMPLETED',
  });

  return { items, cancelled };
}
