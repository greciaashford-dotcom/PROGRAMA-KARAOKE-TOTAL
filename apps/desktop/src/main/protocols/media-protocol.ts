import { protocol } from 'electron';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { Readable } from 'node:stream';
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

/**
 * Registra el controlador de protocolo personalizado 'karaoke-media://'.
 * - karaoke-media://asset/<assetId> -> streaming con HTTP 206 Partial Content y transcodificación al vuelo (.dat/.avi/.cdg)
 * - karaoke-media://background -> imagen de fondo personalizada para la Pantalla Pública (si el operador eligió una)
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
        return new Response(data, {
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

      const nodeStream = fs.createReadStream(playablePath, {
        start: byteRange.start,
        end: byteRange.end,
      });

      nodeStream.on('error', () => {
        try {
          nodeStream.destroy();
        } catch {
          // Ignorar error de cierre de stream
        }
      });

      if (request.signal) {
        request.signal.addEventListener(
          'abort',
          () => {
            try {
              nodeStream.destroy();
            } catch {
              // Ignorar al abortar
            }
          },
          { once: true },
        );
      }

      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
      const isPartial =
        rangeHeader !== null && rangeHeader !== undefined && rangeHeader.trim() !== '';

      const headers: Record<string, string> = {
        'Content-Type': mimeType,
        'Content-Length': String(byteRange.chunkSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      };

      if (isPartial) {
        headers['Content-Range'] = `bytes ${byteRange.start}-${byteRange.end}/${fileSize}`;
      }

      return new Response(webStream, {
        status: isPartial ? 206 : 200,
        headers,
      });
    } catch (err) {
      console.error('[Error en protocolo karaoke-media]:', err);
      return new Response('Error interno del servidor de medios', { status: 500 });
    }
  });
}
