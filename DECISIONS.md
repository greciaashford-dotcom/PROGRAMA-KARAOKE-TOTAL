# Registro de Decisiones de Arquitectura (ADR)

## ADR-001: Estructura en Monorepo con pnpm Workspaces
- **Contexto:** El proyecto requiere compartir contratos Zod y tipos entre el proceso principal de Electron, el proceso de renderizado y la capa de base de datos.
- **Decisión:** Configurar un monorepo gestionado con `pnpm` workspaces dividiendo en `apps/desktop` y paquetes reutilizables `packages/contracts`, `packages/database`, etc.
- **Consecuencias:** Permite verificación estricta de tipos de extremo a extremo, compilación modular y separación clara de responsabilidades.

## ADR-002: Selección de Driver SQLite (`better-sqlite3@13.0.3`)
- **Contexto:** En Windows con Node 24, versiones previas de drivers nativos exigían el SDK de Windows C++ de Visual Studio que no siempre está presente en máquinas estándar de locales.
- **Decisión:** Utilizar `better-sqlite3@13.0.3` que dispone de binarios precompilados estables para Windows x64 y Node 24, operando en conjunto con Drizzle ORM.
- **Consecuencias:** Instalación instantánea y ejecución fiable sin necesidad de compilar código C++ en la máquina de destino.

## ADR-003: Aislamiento Total en Electron
- **Contexto:** Seguridad estricta innegociable en la aplicación de directo.
- **Decisión:** Habilitar `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, aplicar CSP estricta en `session.defaultSession.webRequest.onHeadersReceived`, bloquear `will-navigate` y rechazar cualquier ventana secundaria con `setWindowOpenHandler`.
- **Consecuencias:** La consola del operador está totalmente blindada contra inyecciones y ataques XSS.

## ADR-004: Patrón Result<T, E> y Validación con Zod en IPC
- **Contexto:** Los errores en IPC no deben provocar caídas silenciosas ni fugas de stack traces técnicos hacia la interfaz.
- **Decisión:** Todo canal IPC valida sus argumentos de entrada con esquemas Zod y responde con el tipo discriminado `Result<T, AppError>`.
- **Consecuencias:** La interfaz recibe siempre respuestas predecibles y mensajes comprensibles en español.

## ADR-005: Control de Concurrencia en Escaneo para Hardware i3
- **Contexto:** El local puede operar en hardware base (Intel Core i3) con bibliotecas de hasta 100.000 archivos. Disparar procesos `ffprobe` ilimitados bloquearía la CPU y provocaría cuelgues.
- **Decisión:** Limitar la concurrencia a 2 procesos de análisis simultáneos con generadores asíncronos y timeout de 10 segundos por archivo.
- **Consecuencias:** Escaneo fluido sin congelar la interfaz ni acaparar el sistema operativo.

## ADR-006: Preservación No Destructiva de Metadatos y Archivos Ausentes
- **Contexto:** Si el operador corrige un título o desconecta temporalmente una unidad externa, los datos corregidos o las canciones en cola no deben perderse.
- **Decisión:** Las canciones corregidas se marcan con `metadata_source = 'MANUAL'` y no son sobrescritas en reescaneos. Los archivos no observados pasan a `status = 'MISSING'` y nunca se eliminan físicamente ni de la base de datos de forma automática.
- **Consecuencias:** Resiliencia operativa absoluta ante unidades externas o desconexiones temporales en pleno directo.

## ADR-007: Máquina de Estados Estricta y Regla de Reproducción Única
- **Contexto:** En un directo nunca pueden coexistir dos pistas en estado `PLAYING`, ni pueden ocurrir transiciones incoherentes (ej. pasar de `QUEUED` directamente a `COMPLETED`).
- **Decisión:** Validar cada transición con `isValidQueueTransition` dentro de una transacción atómica SQLite que verifica que no haya otro elemento `PLAYING`. Cada transición genera un registro inmutable en `queue_events`.
- **Consecuencias:** Integridad del flujo en directo y trazabilidad completa de cada actuación.

## ADR-008: Reconciliación Pasiva tras Reinicio
- **Contexto:** Si la aplicación se cierra inesperadamente mientras una canción estaba en reproducción, al reabrir no debe reproducirse automáticamente ni asumir que la canción sigue sonando.
- **Decisión:** Al iniciar, cualquier elemento que estuviera en `PLAYING` se transiciona a `READY` y se mantiene la cola intacta sin disparar reproducción automática.
- **Consecuencias:** Cero sorpresas de audio para el operador al arrancar la consola tras un reinicio.

## ADR-009: Protocolo Seguro `karaoke-media://` con HTTP 206 y Cero Exposición de Rutas
- **Contexto:** El elemento `<video>` de Chromium requiere soporte de rangos parciales de bytes para búsqueda rápida (seeking), pero exponer rutas absolutas locales (`file:///C:/...`) al renderer viola el principio de mínimo privilegio y crea riesgos de seguridad.
- **Decisión:** Implementar el esquema privilegiado `karaoke-media://asset/<assetId>`. El renderer únicamente manipula identificadores de activos. El proceso principal resuelve la ruta física en disco a través del repositorio, verifica `assertSafePath` para blindar contra Path Traversal y sirve el archivo usando `ReadableStream` con encabezados HTTP 206 (`Content-Range`, `Accept-Ranges`).
- **Consecuencias:** Rendimiento nativo de streaming y búsqueda instantánea en video/audio con aislamiento absoluto del sistema de archivos.

## ADR-010: Finalización de Pistas Estrictamente por Evento Nativo `ended`
- **Contexto:** Marcar canciones como completadas usando temporizadores aproximados o duraciones estimadas provoca cortes prematuros o estados desincronizados en pistas con silencios o variaciones.
- **Decisión:** La transición a `COMPLETED` se desencadena exclusivamente mediante el evento nativo del DOM `ended` emitido por el elemento HTML5 `<video>`, canalizado de forma segura vía IPC `player:reportEnded`.
- **Consecuencias:** Finalización 100% precisa y libre de simulaciones artificiales.

## ADR-011: Ventana Pública Independiente, Pantalla de Cortesía y Rescate Automático de Monitores
- **Contexto:** El local requiere dos pantallas: la consola privada del operador y la pantalla pública para el público/cantante. Si un monitor HDMI se desconecta accidentalmente, la ventana pública no debe quedar inaccesible ni interrumpir la sesión. Además, en momentos sin música o entre canciones, la pantalla no debe mostrar un escritorio vacío ni exponer información confidencial de la mesa o notas del operador.
- **Decisión:**
  1. Instanciar una segunda ventana `BrowserWindow` aislada, controlada por el proceso principal, que utiliza hash routing (`#public`) sobre el mismo bundle seguro de Vite.
  2. Implementar pantalla de cortesía ambiental automática cuando no hay canción en reproducción, mostrando la hora, la sesión y el próximo cantante.
  3. Proteger la privacidad del cliente: la vista pública filtra estrictamente cualquier dato sensible (mesas, notas, controles de operador).
  4. Escuchar eventos de hardware de pantalla (`display-removed`) para rescatar automáticamente la ventana pública al monitor primario si la pantalla externa se desconecta, complementado con un botón manual de rescate ("Rescatar pantalla").
- **Consecuencias:** Experiencia profesional ininterrumpida para el público, máxima resiliencia ante incidentes con cables o proyectores, y garantía absoluta de privacidad en el local.

## ADR-012: Empaquetado NSIS con electron-builder, Binarios N-API y Desempaquetado de Binarios Auxiliares
- **Contexto:** En sistemas Windows de producción, la compilación de dependencias nativas C++ como `better-sqlite3` con `node-gyp` falla si el equipo del local carece del SDK de Visual Studio C++. Asimismo, los ejecutables empaquetados dentro de un archivo virtual `.asar` no pueden ser ejecutados directamente mediante `child_process.spawn()`.
- **Decisión:**
  1. Configurar `npmRebuild: false` y `buildDependenciesFromSource: false` en `electron-builder.json`, aprovechando los binarios N-API precompilados de `better-sqlite3` (`win32-x64.node`) que son compatibles y estables entre versiones de Node.js y Electron.
  2. Configurar `asarUnpack` para `ffprobe-static` y adaptar `getFfprobePath()` para redirigir dinámicamente de `app.asar` a `app.asar.unpacked`.
  3. Empaquetar un instalador NSIS completo (`oneClick: false`, selección de directorio y accesos directos).
- **Consecuencias:** Instalador autónomo y reproducible que funciona sin dependencias de compilación adicionales en Windows 10/11, garantizando que `ffprobe` y SQLite operen inmediatamente tras la instalación.


