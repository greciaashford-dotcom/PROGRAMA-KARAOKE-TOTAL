import * as path from 'node:path';

export interface ParsedMetadata {
  artist: string;
  title: string;
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
    .replace(/\s+/g, ' ') // Colapsar múltiples espacios
    .trim();
}

/**
 * Infiere el artista y título a partir del nombre del archivo mediante reglas heurísticas.
 * Maneja patrones habituales en colecciones de karaoke:
 * - "Artista - Título.mp4"
 * - "01 - Artista - Título (Karaoke).mp4"
 * - "01. Artista - Título.webm"
 */
export function parseSongMetadata(filename: string): ParsedMetadata {
  const ext = path.extname(filename);
  let baseName = path.basename(filename, ext);

  // 1. Eliminar etiquetas habituales entre paréntesis o corchetes que no aportan al título
  baseName = baseName.replace(/\((karaoke|instrumental|playback|karaoke version|hd|hq)\)/gi, '');
  baseName = baseName.replace(/\[(karaoke|instrumental|playback|karaoke version|hd|hq)\]/gi, '');

  // 2. Limpiar prefijo de número de pista (ej. "01 - ", "01. ", "001_")
  baseName = baseName.replace(/^\s*\d+[\s._\-–—]+\s*/, '');

  // 3. Buscar separador entre Artista y Título (guion, guion largo, guion bajo)
  const separators = [' - ', ' – ', ' — ', ' _ '];
  let matchedIndex = -1;
  let matchedSep = '';

  for (const sep of separators) {
    const idx = baseName.indexOf(sep);
    if (idx !== -1) {
      matchedIndex = idx;
      matchedSep = sep;
      break;
    }
  }

  if (matchedIndex !== -1) {
    const artist = baseName.substring(0, matchedIndex).trim();
    const title = baseName.substring(matchedIndex + matchedSep.length).trim();

    return {
      artist: artist || 'Desconocido',
      title: title || 'Sin Título',
    };
  }

  // Si no hay separador identificable
  return {
    artist: 'Desconocido',
    title: baseName.trim() || 'Sin Título',
  };
}
