const KNOWN_EXT_RE = /\.(dat|mp4|m4v|mkv|avi|cdg|mp3|m4a|webm|mov|mpg|mpeg|wav|ogg|flac)$/i;

/**
 * Limpieza inteligente de títulos para Pantalla Pública, Cola y Catálogo:
 * - Elimina extensiones (.dat, .mp4, .mkv, .avi, .cdg, .mp3, etc.)
 * - Elimina códigos de catálogo al inicio (ES20611_, ES20713-, K0045_, 01234 - , etc.)
 * - Reemplaza guiones bajos "_" por espacios y limpia espacios múltiples.
 */
export function cleanDisplayTitle(rawTitle?: string | null): string {
  if (!rawTitle) return '';
  let text = rawTitle.trim();

  // 1. Quitar extensión
  text = text.replace(KNOWN_EXT_RE, '');

  // 2. Quitar etiquetas entre paréntesis/corchetes tipo (karaoke), [vcd], etc.
  text = text.replace(/\((karaoke|instrumental|playback|karaoke version|hd|hq|vcd)\)/gi, '');
  text = text.replace(/\[(karaoke|instrumental|playback|karaoke version|hd|hq|vcd)\]/gi, '');

  // 3. Quitar prefijos alfanuméricos o numéricos de catálogo al inicio
  let prev = '';
  while (prev !== text) {
    prev = text;
    text = text.replace(
      /^\s*(?:[A-Za-z]{1,6}[-_]?\d{2,8}(?:[-_]\d{1,3})?|\d{1,8})[\s._\-–—]+/,
      '',
    );
  }

  // 4. Reemplazar guiones bajos y limpiar espacios/bordes
  text = text
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, '')
    .trim();

  return text || rawTitle.replace(KNOWN_EXT_RE, '').replace(/_/g, ' ').trim();
}

/**
 * Devuelve el artista limpio o cadena vacía si es "Desconocido" (nunca mostrar "— Desconocido").
 */
export function cleanDisplayArtist(rawArtist?: string | null): string {
  if (!rawArtist) return '';
  const cleaned = rawArtist.trim();
  if (!cleaned) return '';
  const lower = cleaned.toLowerCase();
  if (lower === 'desconocido' || lower === 'unknown' || lower === 'sin artista' || lower === 'n/a') {
    return '';
  }
  return cleaned.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

export function formatTimeMMSS(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function formatCountdownMMSS(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}
