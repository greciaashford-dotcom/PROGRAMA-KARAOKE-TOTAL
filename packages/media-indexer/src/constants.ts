export const ALLOWED_MEDIA_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.webm',
  '.mkv',
  '.mov',
  '.mp3',
  '.m4a',
  '.wav',
  '.ogg',
  '.flac',
]);

export const SUPPORTED_VIDEO_CODECS = new Set([
  'h264',
  'avc1',
  'hevc',
  'h265',
  'vp8',
  'vp9',
  'av01',
  'av1',
  'mpeg4',
  'theora',
]);

export const SUPPORTED_AUDIO_CODECS = new Set([
  'aac',
  'mp4a',
  'opus',
  'vorbis',
  'mp3',
  'mp2',
  'pcm_s16le',
  'pcm_s16be',
  'pcm_s24le',
  'pcm_s24be',
  'pcm_s32le',
  'pcm_f32le',
  'pcm_u8',
  'flac',
  'alac',
  'ac3',
  'eac3',
]);

export const FFPROBE_TIMEOUT_MS = 10000; // 10 segundos
export const DEFAULT_SCAN_CONCURRENCY = 2; // Óptimo para hardware i3 mínimo
