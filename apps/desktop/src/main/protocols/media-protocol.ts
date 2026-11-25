import { protocol } from 'electron';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { MediaRepository } from '@karaoke/database';
import { assertSafePath, PathSecurityError } from '@karaoke/media-indexer';
import { parseByteRange, getMimeType } from '@karaoke/media-engine';
import { ensurePlayableFile } from './transcoder.js';
import { VolumesStore } from '../storage/volumes-store.js';

const IMAGE_MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

// Tamaño máximo por bloque en peticiones Range abiertas (bytes=start-) -> 2 MB
// Evita por completo cortes/stalls de Readable.toWeb en Electron 33 y permite reproducción 100% completa + seek instantáneo.
const MAX_RANGE_CHUNK_BYTES = 2 * 1024 * 1024;

/**
 * Registra el controlador de protocolo personalizado 'karaoke-media://'.
 * - karaoke-media://asset/<assetId> -> streaming determinista HTTP 206 Partial Content por bloques de 2 MB
 * - karaoke-media://background -> imagen de fondo personalizada para la Pantalla Pública
 */
export function registerMediaProtocol(
  mediaRepo: MediaRepository,
  volumesStore?: VolumesStore,
): void {
  protocol.handle('karaoke-media', async (request) => {
    try {
      const url = new URL(request.url);

      // Servir fondo personalizado de Pantalla Pública si está configurado
      if (url.hostname === 'background' || url.pathname === '/background') {
        const bgPath = volumesStore?.getAll().publicBackgroundPath;
        if (!bgPath || !fs.existsSync(bgPath)) {
          return new Response('Sin fondo personalizado', { status: 404 });
        }
        const ext = path.extname(bgPath).toLowerCase();
        const imgMime = IMAGE_MIME_MAP[ext] || 'image/png';
        const data = await fsp.readFile(bgPath);
        return new Response(new Uint8Array(data), {
          status: 200,
          headers: {
            'Content-Type': imgMime,
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Formato esperado: karaoke-media://asset/<assetId>
      let assetId = url.pathname.replace(/^\//, '');
      if (!assetId || assetId === 'asset') {
        assetId = url.hostname;
      }

      if (!assetId || assetId === 'asset') {
        return new Response('Asset ID requerido', { status: 400 });
      }

      const fileDetails = mediaRepo.getAssetFileDetails(assetId);
      if (!fileDetails) {
        return new Response('Archivo multimedia no encontrado en catálogo', { status: 404 });
      }

      const { folderAbsolutePath, absolutePath, asset } = fileDetails;

      let safePath: string;
      try {
        safePath = await assertSafePath(folderAbsolutePath, absolutePath);
      } catch (err) {
        if (err instanceof PathSecurityError) {
          console.error(`[Seguridad de Protocolo] Intento de acceso no autorizado: ${err.message}`);
          return new Response('Acceso prohibido', { status: 403 });
        }
        throw err;
      }

      if (!fs.existsSync(safePath)) {
        return new Response('Archivo no encontrado físicamente en disco', { status: 404 });
      }

      // Transcodificación / remux al vuelo para .dat (VCD/MPEG-1), .avi, .mpg, .cdg o códecs heredados
      let playablePath = safePath;
      let mimeType = getMimeType(safePath);

      try {
        const resolved = await ensurePlayableFile(
          safePath,
          asset.fingerprint,
          asset.extension,
          asset.videoCodec,
        );
        playablePath = resolved.path;
        if (resolved.mimeType) {
          mimeType = resolved.mimeType;
        }
      } catch (transcodeErr) {
        console.error('[Transcoder] Error convirtiendo archivo para reproducción:', transcodeErr);
        return new Response('Error al convertir archivo multimedia para reproducción', {
          status: 500,
        });
      }

      const stat = await fsp.stat(playablePath);
      const fileSize = stat.size;
      const rangeHeader = request.headers.get('Range');

      const byteRange = parseByteRange(rangeHeader, fileSize);
      if (!byteRange) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      const isPartial =
        rangeHeader !== null && rangeHeader !== undefined && rangeHeader.trim() !== '';

      // Acotar bloques abiertos (ej. bytes=0-) a 2 MB para respuesta inmediata y streaming sin bloqueos
      let start = byteRange.start;
      let end = byteRange.end;
      if (isPartial && end - start + 1 > MAX_RANGE_CHUNK_BYTES) {
        end = Math.min(fileSize - 1, start + MAX_RANGE_CHUNK_BYTES - 1);
      }

      const chunkSize = end - start + 1;
      const buffer = Buffer.allocUnsafe(chunkSize);
      const fh = await fsp.open(playablePath, 'r');
      let bytesRead = 0;
      try {
        while (bytesRead < chunkSize) {
          const res = await fh.read(buffer, bytesRead, chunkSize - bytesRead, start + bytesRead);
          if (res.bytesRead === 0) break;
          bytesRead += res.bytesRead;
        }
      } finally {
        await fh.close();
      }

      const actualEnd = start + bytesRead - 1;
      const payload = new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead);

      const headers: Record<string, string> = {
        'Content-Type': mimeType,
        'Content-Length': String(bytesRead),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      };

      if (isPartial) {
        headers['Content-Range'] = `bytes ${start}-${actualEnd}/${fileSize}`;
      }

      return new Response(payload, {
        status: isPartial ? 206 : 200,
        headers,
      });
    } catch (err) {
      console.error('[Error en protocolo karaoke-media]:', err);
      return new Response('Error interno del servidor de medios', { status: 500 });
    }
  });
}
