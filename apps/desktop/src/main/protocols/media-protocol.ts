import { protocol } from 'electron';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import { Readable } from 'node:stream';
import { MediaRepository } from '@karaoke/database';
import { assertSafePath, PathSecurityError } from '@karaoke/media-indexer';
import { parseByteRange, getMimeType } from '@karaoke/media-engine';

/**
 * Registra el controlador de protocolo personalizado 'karaoke-media://'.
 * Permite la transmisión de video/audio con soporte de HTTP 206 Partial Content y Range Requests,
 * garantizando que las rutas físicas locales NUNCA se expongan al renderer y protegiendo
 * contra Path Traversal mediante assertSafePath.
 */
export function registerMediaProtocol(mediaRepo: MediaRepository): void {
  protocol.handle('karaoke-media', async (request) => {
    try {
      const url = new URL(request.url);

      // Formato esperado: karaoke-media://asset/<assetId>
      // En URLs con esquema custom: url.host puede ser 'asset' y url.pathname '/<assetId>'
      let assetId = url.pathname.replace(/^\//, '');
      if (!assetId || assetId === 'asset') {
        assetId = url.hostname;
      }

      if (!assetId || assetId === 'asset') {
        return new Response('Asset ID requerido', { status: 400 });
      }

      // Obtener detalles del archivo a través del repositorio seguro
      const fileDetails = mediaRepo.getAssetFileDetails(assetId);
      if (!fileDetails) {
        return new Response('Archivo multimedia no encontrado en catálogo', { status: 404 });
      }

      const { folderAbsolutePath, absolutePath } = fileDetails;

      // Salvaguarda innegociable: verificar path traversal y escape de carpeta autorizada
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

      // Verificar existencia y tamaño del archivo en disco
      let stat: fs.Stats;
      try {
        stat = await fsp.stat(safePath);
      } catch (err: unknown) {
        const nodeErr = err as { code?: string };
        if (nodeErr.code === 'ENOENT') {
          return new Response('Archivo no encontrado físicamente en disco', { status: 404 });
        }
        throw err;
      }

      const fileSize = stat.size;
      const rangeHeader = request.headers.get('Range');
      const mimeType = getMimeType(safePath);

      const byteRange = parseByteRange(rangeHeader, fileSize);
      if (!byteRange) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      // Streaming HTTP 206 Partial Content
      const nodeStream = fs.createReadStream(safePath, {
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
      const isPartial = rangeHeader !== null && rangeHeader !== undefined && rangeHeader.trim() !== '';

      const headers: Record<string, string> = {
        'Content-Type': mimeType,
        'Content-Length': String(byteRange.chunkSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
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
