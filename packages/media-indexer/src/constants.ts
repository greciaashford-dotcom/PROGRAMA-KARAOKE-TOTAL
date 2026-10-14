export const ALLOWED_MEDIA_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.webm',
  '.mp3',
  '.wav',
  '.ogg',
]);

export const SUPPORTED_VIDEO_CODECS = new Set([
  'h264',
  'avc1',
  'vp8',
  'vp9',
  'av01',
  'av1',
]);

export const SUPPORTED_AUDIO_CODECS = new Set([
  'aac',
  'mp4a',
  'opus',
  'vorbis',
  'mp3',
  'pcm_s16le',
  'pcm_s24le',
  'flac',
]);

export const FFPROBE_TIMEOUT_MS = 10000; // 10 segundos
export const DEFAULT_SCAN_CONCURRENCY = 2; // Óptimo para hardware i3 mínimo
