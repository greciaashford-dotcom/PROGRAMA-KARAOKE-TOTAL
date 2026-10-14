import { spawn } from 'node:child_process';
import ffprobeStatic from 'ffprobe-static';
import {
  SUPPORTED_VIDEO_CODECS,
  SUPPORTED_AUDIO_CODECS,
  FFPROBE_TIMEOUT_MS,
} from './constants.js';
import { MediaStatus } from '@karaoke/contracts';

export interface TechnicalMetadata {
  durationMs: number | null;
  container: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
  audioChannels: number | null;
  status: MediaStatus;
  incompatibleReason?: string;
}

export function getFfprobePath(): string {
  // Ruta provista por el binario empaquetado ffprobe-static
  return ffprobeStatic.path || 'ffprobe';
}

/**
 * Ejecuta ffprobe de forma asíncrona sobre un archivo con timeout controlado.
 * Diagnostica compatibilidad con el motor de reproducción HTML5/Chromium.
 */
export async function analyzeMediaFile(filePath: string): Promise<TechnicalMetadata> {
  const binary = getFfprobePath();

  const args = [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  return new Promise<TechnicalMetadata>((resolve) => {
    let stdout = '';
    let stderr = '';
    let hasResolved = false;

    const child = spawn(binary, args, {
      windowsHide: true,
      timeout: FFPROBE_TIMEOUT_MS,
    });

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        child.kill();
        resolve({
          durationMs: null,
          container: null,
          videoCodec: null,
          audioCodec: null,
          width: null,
          height: null,
          audioChannels: null,
          status: 'CORRUPT',
          incompatibleReason: 'Timeout al analizar archivo multimedia con ffprobe.',
        });
      }
    }, FFPROBE_TIMEOUT_MS);

    child.on('error', (err) => {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timer);
        resolve({
          durationMs: null,
          container: null,
          videoCodec: null,
          audioCodec: null,
          width: null,
          height: null,
          audioChannels: null,
          status: 'CORRUPT',
          incompatibleReason: `Error ejecutando ffprobe: ${err.message}`,
        });
      }
    });

    child.on('close', (code) => {
      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(timer);

      if (code !== 0 || !stdout.trim()) {
        resolve({
          durationMs: null,
          container: null,
          videoCodec: null,
          audioCodec: null,
          width: null,
          height: null,
          audioChannels: null,
          status: 'CORRUPT',
          incompatibleReason: stderr.trim() || 'El archivo no contiene un flujo multimedia legible.',
        });
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const streams: Array<{
          codec_type?: string;
          codec_name?: string;
          width?: number;
          height?: number;
          channels?: number;
        }> = data.streams || [];

        const format = data.format || {};

        let durationMs: number | null = null;
        if (format.duration) {
          durationMs = Math.round(parseFloat(format.duration) * 1000);
        }

        const container: string | null = format.format_name ? format.format_name.split(',')[0] : null;

        const videoStream = streams.find((s) => s.codec_type === 'video');
        const audioStream = streams.find((s) => s.codec_type === 'audio');

        const videoCodec = videoStream?.codec_name ? videoStream.codec_name.toLowerCase() : null;
        const audioCodec = audioStream?.codec_name ? audioStream.codec_name.toLowerCase() : null;
        const width = videoStream?.width || null;
        const height = videoStream?.height || null;
        const audioChannels = audioStream?.channels || null;

        // Comprobación de compatibilidad con Chromium / HTML5
        let isCompatible = true;
        let incompatibleReason: string | undefined;

        if (videoCodec && !SUPPORTED_VIDEO_CODECS.has(videoCodec)) {
          isCompatible = false;
          incompatibleReason = `Códec de vídeo '${videoCodec}' no compatible con el reproductor web.`;
        } else if (audioCodec && !SUPPORTED_AUDIO_CODECS.has(audioCodec)) {
          isCompatible = false;
          incompatibleReason = `Códec de audio '${audioCodec}' no compatible con el reproductor web.`;
        }

        resolve({
          durationMs,
          container,
          videoCodec,
          audioCodec,
          width,
          height,
          audioChannels,
          status: isCompatible ? 'AVAILABLE' : 'INCOMPATIBLE',
          incompatibleReason,
        });
      } catch (err: unknown) {
        resolve({
          durationMs: null,
          container: null,
          videoCodec: null,
          audioCodec: null,
          width: null,
          height: null,
          audioChannels: null,
          status: 'CORRUPT',
          incompatibleReason: `Error analizando salida de ffprobe: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
  });
}
