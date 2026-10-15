export interface ByteRangeResult {
  start: number;
  end: number;
  chunkSize: number;
  totalSize: number;
}

/**
 * Parsea el encabezado HTTP Range (RFC 7233 / 9110) para solicitudes de streaming multimedia.
 * Soporta:
 * - bytes=start-end (ej. bytes=0-1024)
 * - bytes=start-    (ej. bytes=1024-)
 * - bytes=-suffix   (ej. bytes=-500)
 *
 * Retorna:
 * - El rango parseado si la sintaxis es correcta.
 * - El archivo completo si rangeHeader no está definido o es vacío (solicitud estándar 200).
 * - null si la sintaxis es inválida o el rango es insatisfactorio (HTTP 416).
 */
export function parseByteRange(
  rangeHeader: string | undefined | null,
  totalSize: number,
): ByteRangeResult | null {
  if (totalSize <= 0) {
    return null;
  }

  // Si no se proporcionó encabezado Range, se solicita el archivo completo
  if (rangeHeader === undefined || rangeHeader === null || rangeHeader.trim() === '') {
    return {
      start: 0,
      end: totalSize - 1,
      chunkSize: totalSize,
      totalSize,
    };
  }

  // Si se proporcionó un encabezado pero no empieza por 'bytes=', la sintaxis es inválida
  if (!rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const rangeValue = rangeHeader.slice(6).trim();
  // Si vienen múltiples rangos separados por coma, tomar el primer rango
  const targetRange = rangeValue.includes(',')
    ? (rangeValue.split(',')[0]?.trim() ?? '')
    : rangeValue;

  const parts = targetRange.split('-');
  if (parts.length !== 2) {
    return null;
  }

  const rawStart = parts[0]?.trim() ?? '';
  const rawEnd = parts[1]?.trim() ?? '';

  // Caso inválido: bytes=-
  if (rawStart === '' && rawEnd === '') {
    return null;
  }

  // Caso: bytes=-suffix (los últimos N bytes)
  if (rawStart === '') {
    const suffixLength = parseInt(rawEnd, 10);
    if (isNaN(suffixLength) || suffixLength <= 0) return null;

    const start = Math.max(0, totalSize - suffixLength);
    const end = totalSize - 1;
    return {
      start,
      end,
      chunkSize: end - start + 1,
      totalSize,
    };
  }

  const start = parseInt(rawStart, 10);
  if (isNaN(start) || start < 0 || start >= totalSize) {
    return null;
  }

  // Caso: bytes=start-
  if (rawEnd === '') {
    const end = totalSize - 1;
    return {
      start,
      end,
      chunkSize: end - start + 1,
      totalSize,
    };
  }

  // Caso: bytes=start-end
  const end = parseInt(rawEnd, 10);
  if (isNaN(end) || end < start) {
    return null;
  }

  // Clampear el final al tamaño máximo del archivo
  const clampedEnd = Math.min(end, totalSize - 1);

  return {
    start,
    end: clampedEnd,
    chunkSize: clampedEnd - start + 1,
    totalSize,
  };
}
