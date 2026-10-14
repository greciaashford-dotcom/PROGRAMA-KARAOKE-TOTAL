# Registro de Cambios (Changelog)

Todas las modificaciones notables de este proyecto se documentarán en este archivo.

## [Fase 1] - 2026-10-15

### Añadido
- Estructura de monorepo inicial con workspaces de `pnpm` (`apps/desktop`, `packages/contracts`, `packages/database`).
- Paquete `@karaoke/contracts`:
  - Definición de esquemas Zod para configuración, biblioteca, sesiones, cantantes, cola, reproductor y pantallas.
  - Constantes de canales IPC fuertemente tipados.
  - Utilidad y tipos para el patrón `Result<T, AppError>`.
- Paquete `@karaoke/database`:
  - Esquema completo de Drizzle ORM para SQLite con todas las 9 tablas requeridas: `settings`, `media_folders`, `media_assets`, `songs`, `karaoke_sessions`, `singers`, `queue_items`, `queue_events`, `playback_state`.
  - Conexión SQLite optimizada para directo con WAL mode (`journal_mode = WAL`), claves foráneas activas y timeout de 5000 ms.
  - Sistema de migraciones transaccionales y rotación de copias de seguridad de base de datos.
  - `SettingsRepository` y `SessionRepository`.
  - Pruebas unitarias para migrador y repositorios con cobertura total en memoria.
- Aplicación `@karaoke/desktop`:
  - Proceso principal de Electron con bloqueo de instancia única.
  - Configuración de seguridad con CSP restrictiva, bloqueo de navegación y popups.
  - Preload con `contextBridge` exponiendo `window.karaokeAPI` sin exponer Node ni Electron.
  - Manejadores IPC con validación Zod para `settings:*` y `session:*`.
  - Interfaz de operador en React 18 + Vite con tema oscuro grafito, reloj local en tiempo real, banner de sesión, modal accesible de configuración y parada de emergencia.
  - Pipeline de calidad con ESLint 9, TypeScript strict y Vitest.
