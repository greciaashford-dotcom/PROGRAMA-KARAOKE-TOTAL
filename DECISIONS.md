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
