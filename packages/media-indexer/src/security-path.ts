import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export class PathSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

/**
 * Normaliza y valida estrictamente que una ruta pertenezca al directorio raíz autorizado.
 * Rechaza directory traversal y enlaces simbólicos que apunten fuera de la raíz.
 */
export async function assertSafePath(rootPath: string, targetPath: string): Promise<string> {
  const normalizedRoot = path.resolve(rootPath);
  const normalizedTarget = path.resolve(targetPath);

  // 1. Verificación léxica estricta
  const relative = path.relative(normalizedRoot, normalizedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PathSecurityError(
      `Acceso denegado: La ruta está fuera del directorio autorizado. [${relative}]`,
    );
  }

  // 2. Verificación de enlace simbólico (resolución de ruta física real en disco)
  try {
    const realRoot = await fs.realpath(normalizedRoot);
    const realTarget = await fs.realpath(normalizedTarget);

    const realRelative = path.relative(realRoot, realTarget);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw new PathSecurityError(
        'Acceso denegado: El enlace simbólico apunta fuera del directorio autorizado.',
      );
    }

    return realTarget;
  } catch (err: unknown) {
    // Si el archivo aún no existe en disco (o fs.realpath falla por archivo ausente),
    // la verificación léxica se mantiene como salvaguarda
    const error = err as { code?: string };
    if (error.code === 'ENOENT') {
      return normalizedTarget;
    }
    throw err;
  }
}

/**
 * Calcula la ruta relativa segura entre la raíz y el archivo.
 */
export function getSafeRelativePath(rootPath: string, fullPath: string): string {
  const normalizedRoot = path.resolve(rootPath);
  const normalizedTarget = path.resolve(fullPath);

  const relative = path.relative(normalizedRoot, normalizedTarget);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PathSecurityError('No se puede calcular ruta relativa fuera de la raíz.');
  }

  // En Windows, normalizar separadores a '/' para almacenamiento consistente en SQLite
  return relative.replace(/\\/g, '/');
}
