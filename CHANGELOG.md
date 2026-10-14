# Registro de Cambios (Changelog)

Todas las modificaciones notables de este proyecto se documentarán en este archivo.

## [Fase 2] - 2026-10-15

### Añadido
- Paquete `@karaoke/media-indexer`:
  - Recorrido asíncrono no bloqueante con generadores de directorios (`walkDirectory`).
  - Límite de concurrencia optimizado para equipos i3 (2 procesos concurrentes).
  - Integración de `ffprobe-static` con timeout de 10s y diagnóstico de códecs web soportados (H.264/AAC, WebM/VP8/VP9/Opus, MP3, WAV).
  - Inferencia automática de artista y título a partir del nombre de archivo (`parseSongMetadata`).
  - Normalizador de texto insensible a tildes, mayúsculas y signos de puntuación (`normalizeSearchText`).
  - Validación de seguridad de rutas contra directory traversal (`..`) y escape de symlinks (`assertSafePath`, `getSafeRelativePath`).
  - Huella rápida de archivos (`calculateFastFingerprint`) leyendo solo 8 KB por archivo.
  - Monitorización en tiempo real de cambios de archivos con Chokidar (`MediaFolderWatcher`).
- Paquete `@karaoke/database`:
  - `MediaRepository`: Métodos para añadir, listar y quitar carpetas autorizadas.
  - Sincronización transaccional por lotes (`syncScannedBatch`) preservando ediciones manuales (`metadata_source = 'MANUAL'`).
  - Reconciliación no destructiva de activos ausentes (`reconcileMissingAssets`).
  - Consulta paginada y filtrada de catálogo de alto rendimiento para hasta 100.000 pistas (`queryCatalog`).
  - Actualización de metadatos de canciones (`updateSongMetadata`).
- Aplicación `@karaoke/desktop`:
  - Nuevos canales IPC: `library:selectFolder`, `library:listFolders`, `library:removeFolder`, `library:scanFolder`, `library:cancelScan`, `library:listAssets`, `library:updateSong`, `library:locateInExplorer`, `library:reanalyzeAsset`.
  - Componentes de interfaz del operador:
    - `CatalogPanel`: Tabla paginada de catálogo, búsqueda en vivo con debounce, filtros por carpeta y estado, y barra de progreso de escaneo.
    - `FolderManagerModal`: Administrador de carpetas autorizadas con acciones de reescaneo y revocación.
    - `EditSongModal`: Modal de corrección manual de artista y título.
    - `SongDetailsModal`: Ficha técnica de formatos, resolución y códecs con localización protegida en el Explorador de Windows.
- Batería de 19 pruebas unitarias automatizadas que cubren seguridad de rutas, parser, scanner, fingerprinting, repositorios y contratos.

## [Fase 1] - 2026-10-15

### Añadido
- Estructura de monorepo inicial con workspaces de `pnpm` (`apps/desktop`, `packages/contracts`, `packages/database`).
- Paquete `@karaoke/contracts`: Zod schemas, tipos compartidos, constantes IPC y patrón `Result<T, AppError>`.
- Paquete `@karaoke/database`: Esquema Drizzle ORM de SQLite (9 tablas), WAL mode, migrador atómico (`0001_initial_schema`), `SettingsRepository` y `SessionRepository`.
- Aplicación `@karaoke/desktop`: Electron con sandboxing, CSP restrictiva, preload seguro, consola de operador en React 18 + Vite con tema oscuro grafito, reloj local y parada de emergencia.
