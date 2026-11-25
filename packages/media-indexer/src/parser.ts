import * as path from 'node:path';

export interface ParsedMetadata {
  artist: string;
  title: string;
}

const KNOWN_EXTENSIONS_REGEX = /\.(dat|mp4|m4v|mkv|avi|cdg|mp3|m4a|webm|mov|mpg|mpeg|wav|ogg|flac)$/i;

/**
 * Limpia inteligentemente un título o nombre de archivo para mostrar en Cola y Pantalla Pública:
 * 1. Elimina la extensión (.dat, .mp4, .mkv, .avi, .cdg, .mp3, etc.).
 * 2. Elimina cualquier código de catálogo al inicio (ej. ES20611_, ES20713-, K0045_, 01234 - , SC8123-05_).
 * 3. Elimina etiquetas accesorias entre paréntesis/corchetes ((karaoke), (hd), etc.).
 * 4. Reemplaza guiones bajos "_" por espacios y limpia espacios múltiples.
 */
export function cleanSongTitle(raw: string): string {
  if (!raw) return 'Sin Título';

  let text = raw.trim();

  // 1. Quitar extensión conocida si existe
  text = text.replace(KNOWN_EXTENSIONS_REGEX, '');

  // 2. Quitar etiquetas de karaoke/calidad entre paréntesis o corchetes
  text = text.replace(/\((karaoke|instrumental|playback|karaoke version|hd|hq|vcd)\)/gi, '');
  text = text.replace(/\[(karaoke|instrumental|playback|karaoke version|hd|hq|vcd)\]/gi, '');

  // 3. Quitar prefijos de código de catálogo al inicio (repetir por si hay prefijo doble ej. "01 - ES20713_")
  let prev = '';
  while (prev !== text) {
    prev = text;
    text = text.replace(
      /^\s*(?:[A-Za-z]{1,6}[-_]?\d{2,8}(?:[-_]\d{1,3})?|\d{1,8})[\s._\-–—]+/,
      '',
    );
  }

  // 4. Quitar sufijo _AV habitual en pistas VCD (.DAT), reemplazar guiones bajos por espacios y limpiar bordes
  text = text
    .replace(/[\s_]+AV$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, '')
    .trim();

  return text || 'Sin Título';
}

/**
 * Normaliza cadenas para búsqueda insensible a mayúsculas, espacios y tildes.
 * Ejemplo: "Canción del Verano" -> "cancion del verano"
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';

  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar tildes y diacríticos
    .replace(/[^\w\s]/g, ' ') // Sustituir puntuación por espacios
    .replace(/_/g, ' ') // Sustituir guiones bajos por espacios
    .replace(/\s+/g, ' ') // Colapsar múltiples espacios
    .trim();
}

/**
 * Infiere el artista y título a partir del nombre del archivo mediante reglas heurísticas.
 * Maneja patrones habituales en colecciones de karaoke:
 * - "ES20713_SOLAMENTE_TU.dat" -> title: "SOLAMENTE TU", artist: "Desconocido"
 * - "Queen - Bohemian Rhapsody.mp4" -> artist: "Queen", title: "Bohemian Rhapsody"
 * - "01 - ABBA - Dancing Queen (Karaoke Version).mp4" -> artist: "ABBA", title: "Dancing Queen"
 */
export function parseSongMetadata(filename: string): ParsedMetadata {
  const ext = path.extname(filename);
  const baseRaw = path.basename(filename, ext);
  const cleaned = cleanSongTitle(baseRaw);

  // Buscar separador entre Artista y Título
  const separators = [' - ', ' – ', ' — '];
  let matchedIndex = -1;
  let matchedSep = '';

  for (const sep of separators) {
    const idx = cleaned.indexOf(sep);
    if (idx !== -1) {
      matchedIndex = idx;
      matchedSep = sep;
      break;
    }
  }

  if (matchedIndex !== -1) {
    const artist = cleaned.substring(0, matchedIndex).trim();
    const title = cleaned.substring(matchedIndex + matchedSep.length).trim();

    return {
      artist: artist || 'Desconocido',
      title: title || 'Sin Título',
    };
  }

  return {
    artist: 'Desconocido',
    title: cleaned || 'Sin Título',
  };
}
