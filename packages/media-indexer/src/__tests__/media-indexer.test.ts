import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { assertSafePath, getSafeRelativePath, PathSecurityError } from '../security-path.js';
import { parseSongMetadata, normalizeSearchText } from '../parser.js';
import { calculateFastFingerprint } from '../hasher.js';
import { scanAuthorizedFolder } from '../scanner.js';

describe('Indexador Multimedia y Metadatos', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'karaoke-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Seguridad de Rutas (assertSafePath & getSafeRelativePath)', () => {
    it('debe permitir rutas válidas dentro del directorio autorizado', async () => {
      const filePath = path.join(tempDir, 'subfolder', 'cancion.mp4');
      await fs.mkdir(path.join(tempDir, 'subfolder'), { recursive: true });
      await fs.writeFile(filePath, 'dummy content');

      const safe = await assertSafePath(tempDir, filePath);
      expect(safe).toBe(path.resolve(filePath));

      const rel = getSafeRelativePath(tempDir, filePath);
      expect(rel).toBe('subfolder/cancion.mp4');
    });

    it('debe rechazar directory traversal con .. fuera de la raíz', async () => {
      const maliciousPath = path.join(tempDir, '..', 'archivo_secreto.txt');
      await expect(assertSafePath(tempDir, maliciousPath)).rejects.toThrow(
        PathSecurityError,
      );
    });

    it('debe rechazar getSafeRelativePath fuera de la raíz', () => {
      const externalPath = path.resolve(tempDir, '../../windows/system32');
      expect(() => getSafeRelativePath(tempDir, externalPath)).toThrow(
        PathSecurityError,
      );
    });
  });

  describe('Inferencia y Normalización de Metadatos (parser)', () => {
    it('debe inferir artista y título con separadores estándar', () => {
      const res = parseSongMetadata('Queen - Bohemian Rhapsody.mp4');
      expect(res.artist).toBe('Queen');
      expect(res.title).toBe('Bohemian Rhapsody');
    });

    it('debe limpiar etiquetas de karaoke y números de pista', () => {
      const res = parseSongMetadata('01 - ABBA - Dancing Queen (Karaoke Version).mp4');
      expect(res.artist).toBe('ABBA');
      expect(res.title).toBe('Dancing Queen');
    });

    it('debe manejar archivos sin separador asignando Desconocido', () => {
      const res = parseSongMetadata('SoloTitulo.webm');
      expect(res.artist).toBe('Desconocido');
      expect(res.title).toBe('SoloTitulo');
    });

    it('debe normalizar texto eliminando tildes, mayúsculas y caracteres especiales', () => {
      const normalized = normalizeSearchText('¡Corazón Espinado! - Maná & Santana');
      expect(normalized).toBe('corazon espinado mana santana');
    });
  });

  describe('Huella Digital Rápida (hasher)', () => {
    it('debe generar fingerprints consistentes para el mismo archivo', async () => {
      const filePath = path.join(tempDir, 'audio.mp3');
      await fs.writeFile(filePath, 'contenido de prueba para fingerprinting');

      const stats = await fs.stat(filePath);
      const fp1 = await calculateFastFingerprint(filePath, stats.size, stats.mtimeMs);
      const fp2 = await calculateFastFingerprint(filePath, stats.size, stats.mtimeMs);

      expect(fp1).toBe(fp2);
      expect(fp1.length).toBe(64); // SHA-256 hex
    });
  });

  describe('Escaneo de Directorios (scanner)', () => {
    it('debe descubrir archivos válidos, ignorar ocultos y formatos no multimedia', async () => {
      // Archivo válido
      await fs.writeFile(path.join(tempDir, 'Queen - We Are The Champions.mp4'), 'test video');

      // Subcarpeta con archivo válido
      await fs.mkdir(path.join(tempDir, 'pop'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'pop', 'Madonna - Like a Virgin.webm'), 'test webm');

      // Archivo oculto (ignorar)
      await fs.writeFile(path.join(tempDir, '.hidden.mp4'), 'hidden');

      // Formato no multimedia (ignorar)
      await fs.writeFile(path.join(tempDir, 'documento.txt'), 'texto');

      const { items, cancelled } = await scanAuthorizedFolder('folder-123', tempDir);

      expect(cancelled).toBe(false);
      expect(items.length).toBe(2);

      const titles = items.map((i) => i.title);
      expect(titles).toContain('We Are The Champions');
      expect(titles).toContain('Like a Virgin');
    });
  });
});
