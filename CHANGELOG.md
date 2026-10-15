# Registro de Cambios (Changelog)

Todas las modificaciones notables de este proyecto se documentarán en este archivo.

## [Fase 6] - 2026-10-15

### Añadido
- Empaquetado y Distribución:
  - Archivo de configuración `electron-builder.json` para empaquetado autónomo en Windows con instalador NSIS x64.
  - Ejecutable instalador `release/Karaoke Total Setup 0.1.0.exe` (183 MB) con asistente interactivo, selección de directorio de instalación, accesos directos y desinstalador limpio.
  - Distribución portable/desempaquetada en `release/win-unpacked/Karaoke Total.exe`.
  - Configuración `npmRebuild: false` y preservación de binarios precompilados estables N-API `win32-x64.node` de `better-sqlite3`.
  - Configuración `asarUnpack` para binarios auxiliares de `ffprobe-static` (`ffprobe.exe`).
- Paquete `@karaoke/media-indexer`:
  - Adaptación de `getFfprobePath()` para redirigir dinámicamente de la ruta virtual `app.asar` a `app.asar.unpacked` en producción.
- Documentación Técnica y Manuales:
  - `docs/USER_GUIDE.md`: Manual oficial de usuario y guía práctica para el operador del karaoke.
  - `docs/SECURITY.md`: Informe de auditoría y arquitectura de seguridad (CSP, sandbox, `assertSafePath`, IPC Zod y privacidad).
  - `docs/ARCHITECTURE.md`: Documento de arquitectura, modelo relacional SQLite WAL, diagramas de procesos y máquina de estados.
  - `docs/TESTING.md`: Plan de aseguramiento de calidad con 49 pruebas unitarias y protocolo de validación manual en Windows.
- Scripts en `package.json`:
  - Comandos `"pack"` y `"dist"` en `apps/desktop` para empaquetado rápido e instalador NSIS.
  - Configuración de aprobación de scripts nativos en `pnpm-workspace.yaml`.

## [Fase 5] - 2026-10-15

### Añadido
- Paquete `@karaoke/contracts`:
  - Nuevos esquemas y DTOs para configuración y gestión de pantallas: `DisplayInfoSchema`, `AssignDisplaysSchema`.
  - Canales IPC para monitores: `display:getMonitors`, `display:assign`, `display:togglePublicWindow`, `display:getPublicWindowStatus`, `display:rescuePublicWindow`.
- Aplicación `@karaoke/desktop`:
  - Gestor de Ventana Pública en `public-window.ts`:
    - Creación de ventana secundaria `BrowserWindow` con hash routing `#public`.
    - Posicionamiento a pantalla completa y sin marcos (`frame: false`, `fullscreen: true`) en el monitor seleccionado.
    - Seguridad estricta: sandbox, sin nodeIntegration, contextIsolation, bloqueo de navegación externa y apertura de popups.
  - Manejador de IPC de Monitores en `display-handlers.ts`:
    - Enlace reactivo con Electron `screen` y persistencia de configuración en SQLite (`settings.public_display_id`, `settings.operator_display_id`).
    - Detección de eventos de conexión/desconexión (`display-added`, `display-removed`, `display-metrics-changed`) y emisión push a la consola.
    - Rescate automático de la ventana pública a la pantalla principal si el monitor secundario se desconecta durante el uso.
    - Rescate manual de emergencia a través de IPC `display:rescuePublicWindow`.
  - Emisión sincronizada a todas las ventanas (`getAllWindows()`) en `player-handlers.ts` para mantener en tiempo real el estado de reproducción en la pantalla pública.
  - Componente `PublicScreen.tsx`:
    - Modo Reproducción: Vídeo HTML5 nativo con streaming `karaoke-media://`, cursor ocultable a los 2s, banner introductorio de 6s con título/artista/cantante, y reporte de fin por evento nativo `ended`.
    - Modo Cortesía: Fondo ambiental atmosférico, reloj digital, nombre de sesión y vista previa de próximo turno "A continuación".
    - Privacidad absoluta: Cero datos sensibles (mesas, notas, controles) expuestos en la vista del público.
  - Componentes de interfaz del operador:
    - Indicador en vivo de estado de pantalla pública y botones de alternancia/rescate en `Header.tsx`.
    - Selector interactivo de monitores y botón de rescate en `SettingsModal.tsx`.
  - Enrutamiento por hash (`#public`) en `main.tsx`.
- Verificación completa: 49 pruebas unitarias pasando en todo el monorepo, 0 errores en typecheck y ESLint.

## [Fase 4] - 2026-10-15

### Añadido
- Paquete `@karaoke/media-engine`:
  - Contrato formal desacoplado `IMediaEngine` y eventos de estado `MediaEngineEvents`.
  - Parser de rangos de bytes HTTP `parseByteRange` conforme a RFC 7233 / 9110, soportando streaming parcial y protegiendo contra peticiones insatisfactorias.
  - Resolvedor de tipos MIME `getMimeType` para formatos multimedia nativos web (.mp4, .webm, .mp3, .wav, .ogg, .aac, .flac).
  - Batería de 13 pruebas unitarias específicas para `parseByteRange` y `getMimeType`.
- Paquete `@karaoke/database`:
  - `PlaybackRepository`: Gestión persistente del estado de reproducción en la tabla `playback_state` (singleton).
  - Comandos atómicos para `PLAY`, `PAUSE`, `STOP`, `SEEK`, `SET_VOLUME` y actualización dosificada de progreso.
  - Reconciliación al inicio (`reconcileStartup`) para limpiar estados `PLAYING` huérfanos y prevenir reproducción automática tras reinicios.
  - Métodos `getAssetFileDetails` y `getAssetFileDetailsBySongId` en `MediaRepository` para resolución segura de archivos físicos.
  - Suite de pruebas unitarias en `playback.test.ts` con validación de integridad referencial.
- Aplicación `@karaoke/desktop`:
  - Esquema privilegiado `karaoke-media` registrado antes de `app.whenReady()`.
  - Controlador de protocolo `registerMediaProtocol` con streaming HTTP 206 Partial Content vía `ReadableStream` y verificación estricta de Path Traversal con `assertSafePath`.
  - Cero exposición de rutas físicas de disco en la interfaz; URLs normalizadas como `karaoke-media://asset/<uuid>`.
  - Canales IPC para reproductor en `player-handlers.ts` (`player:getState`, `player:prepare`, `player:command`, `player:emergencyStop`, `player:reportEnded`, `player:updateProgress`).
  - Preload bridge actualizado en `operator.ts` y contratos en `types.ts`.
  - Componente `PlayerPanel.tsx`:
    - Visor de previsualización 16:9 con elemento HTML5 `<video>` real.
    - Manejo estricto de finalización mediante evento nativo `ended` (sin temporizadores artificiales).
    - Scrubber interactivo con tiempo formateado `mm:ss / mm:ss`.
    - Controles de transporte (Reproducir, Pausar, Detener, Rebobinar 5s, Avanzar 5s).
    - Deslizador de volumen maestro con botón de silenciado.
    - Atajos de teclado para directo: `Espacio` (play/pause), `Esc`/`F12` (parada de emergencia), `Flechas` (búsqueda).
    - Botón de Parada de Emergencia permanente y accesible en 1 clic.
  - Integración en `QueuePanel` con botón directo "Cargar" para enviar canciones en estado `READY` o `PREPARING` al reproductor.
- Verificación completa: 47 pruebas unitarias pasando en todo el monorepo, 0 errores en typecheck y ESLint.

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
