import * as path from 'node:path';

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.wave': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
};

/**
 * Devuelve el tipo MIME adecuado para un archivo o extensión multimedia.
 */
export function getMimeType(filePathOrExt: string): string {
  const ext = (path.extname(filePathOrExt) || filePathOrExt).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}
