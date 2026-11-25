import { app } from 'electron';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const TRANSCODE_EXTENSIONS = new Set(['.dat', '.avi', '.mpg', '.mpeg', '.cdg']);
const TRANSCODE_VIDEO_CODECS = new Set([
  'mpeg1video',
  'mpeg2video',
  'msmpeg4',
  'msmpeg4v2',
  'msmpeg4v3',
  'msvideo1',
  'cdgraphics',
  'divx',
  'xvid',
  'wmv1',
  'wmv2',
  'wmv3',
]);

const activeJobs = new Map<string, Promise<string>>();

function resolveFfmpegPath(): string {
  try {
    const ffmpegStatic: unknown = require('ffmpeg-static');
    if (typeof ffmpegStatic === 'string' && ffmpegStatic.trim()) {
      return ffmpegStatic.replace('app.asar', 'app.asar.unpacked');
    }
  } catch {
    // Fallback al ffmpeg del sistema si no está ffmpeg-static
  }
  return 'ffmpeg';
}

export function needsTranscoding(extension: string, videoCodec?: string | null): boolean {
  const ext = (extension || '').toLowerCase();
  if (TRANSCODE_EXTENSIONS.has(ext)) return true;
  if (videoCodec && TRANSCODE_VIDEO_CODECS.has(videoCodec.toLowerCase())) return true;
  return false;
}

/**
 * Convierte al vuelo archivos .dat (VCD/MPEG-1), .avi, .mpg o .cdg+mp3 a un archivo MP4 H.264/AAC
 * cacheado por huella digital en la carpeta local del usuario para reproducción instantánea con
 * soporte completo de Play, Pausa, Stop, barra de progreso (seek), volumen, velocidad y tono.
 */
export async function ensurePlayableFile(
  safePath: string,
  fingerprint: string,
  extension: string,
  videoCodec?: string | null,
): Promise<{ path: string; mimeType: string }> {
  if (!needsTranscoding(extension, videoCodec)) {
    return { path: safePath, mimeType: '' };
  }

  const cacheDir = path.join(app.getPath('userData'), 'transcode-cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const safeFp = (fingerprint || 'track').replace(/[^a-zA-Z0-9_-]/g, '');
  const targetMp4 = path.join(cacheDir, `${safeFp}.mp4`);

  if (fs.existsSync(targetMp4)) {
    try {
      const stat = fs.statSync(targetMp4);
      if (stat.size > 1024) {
        return { path: targetMp4, mimeType: 'video/mp4' };
      }
    } catch {
      // Regenerar si está corrupto
    }
  }

  const existingJob = activeJobs.get(safeFp);
  if (existingJob) {
    const outPath = await existingJob;
    return { path: outPath, mimeType: 'video/mp4' };
  }

  const jobPromise = runFfmpegTranscode(safePath, targetMp4, extension.toLowerCase()).finally(() => {
    activeJobs.delete(safeFp);
  });

  activeJobs.set(safeFp, jobPromise);
  const finalPath = await jobPromise;
  return { path: finalPath, mimeType: 'video/mp4' };
}

function findSiblingAudioForCdg(cdgPath: string): string | null {
  const dir = path.dirname(cdgPath);
  const base = path.basename(cdgPath, path.extname(cdgPath));
  const candidates = ['.mp3', '.MP3', '.wav', '.WAV', '.ogg', '.m4a'];
  for (const ext of candidates) {
    const candidate = path.join(dir, `${base}${ext}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function runFfmpegTranscode(inputPath: string, outputMp4: string, ext: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpegBin = resolveFfmpegPath();
    const tmpOutput = `${outputMp4}.tmp.mp4`;

    const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error'];

    if (ext === '.cdg') {
      const siblingAudio = findSiblingAudioForCdg(inputPath);
      args.push('-i', inputPath);
      if (siblingAudio) {
        args.push('-i', siblingAudio);
      }
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
      );
      if (siblingAudio) {
        args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
      }
      args.push('-movflags', '+faststart', tmpOutput);
    } else {
      // .dat (VCD/MPEG-1), .avi, .mpg, .mpeg y otros códecs heredados
      args.push(
        '-fflags',
        '+genpts+discardcorrupt',
        '-i',
        inputPath,
        '-map',
        '0:v:0?',
        '-map',
        '0:a:0?',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-ac',
        '2',
        '-movflags',
        '+faststart',
        tmpOutput,
      );
    }

    const child = spawn(ffmpegBin, args, { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      cleanupTmp(tmpOutput);
      reject(new Error(`No se pudo iniciar FFmpeg para reproducir ${ext}: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(tmpOutput)) {
        try {
          if (fs.existsSync(outputMp4)) {
            fs.unlinkSync(outputMp4);
          }
          fs.renameSync(tmpOutput, outputMp4);
          resolve(outputMp4);
        } catch (renameErr) {
          cleanupTmp(tmpOutput);
          reject(renameErr);
        }
      } else {
        cleanupTmp(tmpOutput);
        reject(new Error(`FFmpeg falló al convertir el archivo (${code}): ${stderr.trim()}`));
      }
    });
  });
}

function cleanupTmp(file: string): void {
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    // Ignorar error de limpieza temporal
  }
}
