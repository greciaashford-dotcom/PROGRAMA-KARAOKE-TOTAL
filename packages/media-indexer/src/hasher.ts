import * as fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const CHUNK_SIZE = 4096; // 4 KB

/**
 * Calcula una huella digital rápida (fingerprint) basada en tamaño, mtime y fragmentos extremos.
 * Permite indexar y reconciliar miles de archivos grandes sin saturar disco o procesador.
 */
export async function calculateFastFingerprint(
  filePath: string,
  sizeBytes: number,
  mtimeMs: number,
): Promise<string> {
  const hash = createHash('sha256');

  // Metadatos base
  hash.update(`size:${sizeBytes}|mtime:${mtimeMs}|`);

  let fileHandle: fs.FileHandle | null = null;
  try {
    fileHandle = await fs.open(filePath, 'r');

    if (sizeBytes <= CHUNK_SIZE * 2) {
      // Archivo pequeño: leer completo
      const buffer = Buffer.alloc(sizeBytes);
      await fileHandle.read(buffer, 0, sizeBytes, 0);
      hash.update(buffer);
    } else {
      // Archivo grande: leer primeros 4KB y últimos 4KB
      const headBuffer = Buffer.alloc(CHUNK_SIZE);
      await fileHandle.read(headBuffer, 0, CHUNK_SIZE, 0);
      hash.update(headBuffer);

      const tailBuffer = Buffer.alloc(CHUNK_SIZE);
      const tailOffset = sizeBytes - CHUNK_SIZE;
      await fileHandle.read(tailBuffer, 0, CHUNK_SIZE, tailOffset);
      hash.update(tailBuffer);
    }
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }

  return hash.digest('hex');
}
