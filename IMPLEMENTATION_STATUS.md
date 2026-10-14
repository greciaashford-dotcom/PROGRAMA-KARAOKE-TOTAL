# Estado de Implementación — Karaoke Total (MVP Local)

## Resumen Ejecutivo

| Fase | Descripción | Estado | Pruebas |
| :--- | :--- | :--- | :--- |
| **Fase 0** | Arquitectura, Contratos, Diagramas, Riesgos | **Completada y Aprobada** | N/A (Teórica) |
| **Fase 1** | Base Segura (Monorepo, Electron, Vite, React, SQLite, CSP, IPC) | **Completada y Verificada** | 9 pasadas / 0 fallidas |
| **Fase 2** | Biblioteca Local (Carpetas, ffprobe, Watcher, Catálogo, Filtros) | **Completada y Verificada** | 19 pasadas / 0 fallidas |
| **Fase 3** | Sesión y Cola (Cantantes, Turnos, Reordenar, Transiciones) | Pendiente de Aprobación | — |
| **Fase 4** | Reproductor (Protocolo Seguro, Rangos de Bytes, Controles) | Pendiente | — |
| **Fase 5** | Segunda Pantalla (Ventana Pública, Monitor Secundario, Desconexión) | Pendiente | — |
| **Fase 6** | Empaquetado y Validación (Instalador NSIS, Auditoría) | Pendiente | — |

---

## Detalle de la Fase 2 — Biblioteca Local

### Objetivos Completados
- [x] Paquete `@karaoke/media-indexer` implementado con tipado estricto.
- [x] `security-path.ts`: Validación estricta contra directory traversal (`..`) y detección de symlinks que apunten fuera de la raíz autorizada.
- [x] `hasher.ts`: Huella digital rápida (fingerprint) basada en tamaño, fecha de modificación y fragmentos extremos (4KB iniciales y finales), evitando leer gigabytes en cada arranque.
- [x] `parser.ts`: Inferencia heurística de `Artista - Título` a partir de nombres de archivo reales (eliminando pistas numéricas y etiquetas) y normalizador de texto insensible a tildes, mayúsculas y caracteres especiales.
- [x] `ffprobe.ts`: Binario auxiliar empaquetado para inspección técnica de archivos multimedia. Diagnóstico automático de códecs web soportados (H.264/AAC, WebM/VP8/VP9/Opus, MP3, WAV); formatos no soportados marcados como `INCOMPATIBLE` con explicación clara.
- [x] `scanner.ts`: Recorrido asíncrono y no bloqueante con generadores de Node.js, control de concurrencia optimizado para equipos i3 (límite de 2 procesos simultáneos), emisión de progreso en tiempo real y soporte de cancelación mediante `AbortSignal`.
- [x] `watcher.ts`: Monitorización reactiva de cambios en carpetas autorizadas con Chokidar.
- [x] `MediaRepository` en `@karaoke/database`: Registro y revocación de carpetas, sincronización atómica por lotes en SQLite, preservación de correcciones manuales (`metadata_source = 'MANUAL'`), reconciliación de archivos eliminados marcándolos como `MISSING` (sin borrarlos del disco), y consultas paginadas de alto rendimiento preparadas para catálogos de hasta 100.000 canciones.
- [x] Canales IPC implementados y validados con Zod:
  - `library:selectFolder` (diálogo nativo del sistema)
  - `library:listFolders`
  - `library:removeFolder`
  - `library:scanFolder`
  - `library:cancelScan`
  - `library:listAssets`
  - `library:updateSong`
  - `library:locateInExplorer` (`shell.showItemInFolder` protegido)
  - `library:reanalyzeAsset`
- [x] Consola del Operador (UI):
  - `CatalogPanel`: Tabla paginada y virtualizable, búsqueda en tiempo real con debounce, filtros por carpeta y estado (`AVAILABLE`, `MISSING`, `INCOMPATIBLE`), y barra de progreso real durante el escaneo.
  - `FolderManagerModal`: Gestión de carpetas autorizadas con acciones de reescaneo y revocación.
  - `EditSongModal`: Corrección manual de título y artista sin renombrar archivos físicos.
  - `SongDetailsModal`: Ficha técnica del archivo (códecs, resolución, contenedor, duración, tamaño) con localización en el Explorador de Windows.
- [x] Pruebas unitarias de path traversal, parser, fingerprinting, scanner y repositorio de medios (19 pruebas en total).
