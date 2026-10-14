# Registro de Cambios (Changelog)

Todas las modificaciones notables de este proyecto se documentarán en este archivo.

## [Fase 3] - 2026-10-15

### Añadido
- Paquete `@karaoke/contracts`:
  - Validador formal de máquina de estados de cola (`isValidQueueTransition`) y matriz de transiciones permitidas (`ALLOWED_QUEUE_TRANSITIONS`).
  - Nuevos esquemas Zod y DTOs: `CreateSingerSchema`, `AddToQueueSchema`, `ReorderQueueSchema`, `UndoReorderSchema`, `QueueTransitionSchema`.
  - Campo `estimatedWaitMs` en `QueueItemDTO` para previsión de tiempo de espera por turno.
  - Constantes de canales IPC `queue:get` y `queue:undoReorder`.
- Paquete `@karaoke/database`:
  - `SingerRepository`: Registro de cantantes, alias, mesas y notas sin exigencia de datos personales.
  - `QueueRepository`:
    - Encolado atómico con protección contra doble clic accidental (<1.5s).
    - Cálculo acumulativo de tiempos de espera estimados por turno a partir de la duración de pistas previas.
    - Reordenamiento transaccional de posiciones (`reorderQueue`) con capacidad de deshacer (`undoLastReorder`).
    - Máquina de estados con bloqueo estricto contra reproducciones concurrentes (máximo 1 `PLAYING`).
    - Registro auditable de eventos en la tabla `queue_events` para cada cambio de estado y reordenación.
    - Reconciliación pasiva al inicio (`recoverSessionQueue`) para evitar estados fantasma tras reinicios forzados.
  - Suite de 10 pruebas unitarias específicas en `queue.test.ts` (15 pruebas en total para el paquete database).
- Aplicación `@karaoke/desktop`:
  - Canales IPC para cola y cantantes en `queue-handlers.ts` con validación Zod y emisión de `event:queue:updated`.
  - Reconciliación automática de la cola en el ciclo de vida (`lifecycle.ts`).
  - Preload bridge actualizado con métodos tipados en `window.karaokeAPI`.
  - Componentes de interfaz del operador:
    - `QueuePanel`: Panel de cola con visualización de turnos, estado, tiempo de espera, botones accesibles de subida/bajada de posición, banner de siguiente turno y botón de deshacer orden.
    - `AddToQueueModal`: Modal accesible para asignar cantante, tono (-6 a +6 semitonos) y encolar sin duplicación.
    - `AddSingerModal`: Modal para alta de cantantes.
    - Botón de encolado rápido integrado en cada fila del catálogo.
- Batería de 29 pruebas unitarias automatizadas ejecutadas con Vitest con 100% de éxito.

## [Fase 2] - 2026-10-15

### Añadido
- Paquete `@karaoke/media-indexer`:
  - Recorrido recursivo no bloqueante de directorios (`walkDirectory`) con límite de concurrencia para i3.
  - Integración de `ffprobe-static` con diagnóstico de códecs web (H.264/AAC, WebM/VP8/VP9/Opus, MP3, WAV).
  - Inferencia de artista y título (`parseSongMetadata`) y normalizador de texto insensible a tildes (`normalizeSearchText`).
  - Validación de seguridad de rutas contra directory traversal (`assertSafePath`, `getSafeRelativePath`).
  - Huella rápida de archivos (`calculateFastFingerprint`) leyendo solo 8 KB por archivo.
  - Monitorización reactiva de cambios en carpetas autorizadas con Chokidar (`MediaFolderWatcher`).
- Paquete `@karaoke/database`:
  - `MediaRepository`: Gestión de carpetas, sincronización atómica por lotes preservando ediciones manuales (`metadata_source = 'MANUAL'`), reconciliación no destructiva de archivos ausentes (`reconcileMissingAssets`) y catálogo paginado de alta velocidad (`queryCatalog`).
- Componentes de interfaz: `CatalogPanel`, `FolderManagerModal`, `EditSongModal`, `SongDetailsModal`.

## [Fase 1] - 2026-10-15

### Añadido
- Estructura de monorepo inicial con workspaces de `pnpm` (`apps/desktop`, `packages/contracts`, `packages/database`).
- Paquete `@karaoke/contracts`: Zod schemas, tipos compartidos, constantes IPC y patrón `Result<T, AppError>`.
- Paquete `@karaoke/database`: Esquema Drizzle ORM de SQLite (9 tablas), WAL mode, migrador atómico (`0001_initial_schema`), `SettingsRepository` y `SessionRepository`.
- Aplicación `@karaoke/desktop`: Electron con sandboxing, CSP restrictiva, preload seguro, consola de operador en React 18 + Vite con tema oscuro grafito, reloj local y parada de emergencia.
