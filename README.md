# Karaoke Total — MVP Local para Windows

Aplicación de escritorio local y profesional diseñada para propietarios y operadores de salas de karaoke. Permite catalogar archivos multimedia locales, gestionar cantantes, ordenar la cola de actuaciones y proyectar el karaoke en un segundo monitor con total privacidad y sin dependencia de Internet.

## Estructura del Monorepo

```text
karaoke-total/
├── apps/
│   └── desktop/           # Aplicación Electron + React 18 + Vite (Consola del operador)
├── packages/
│   ├── contracts/         # Esquemas Zod, DTOs y constantes de canales IPC
│   └── database/          # SQLite + Drizzle ORM, migraciones y repositorios
├── docs/                  # Arquitectura, seguridad y manuales
├── IMPLEMENTATION_STATUS.md
├── DECISIONS.md
├── CHANGELOG.md
└── package.json
```

## Requisitos del Sistema

- **Sistema Operativo:** Windows 10 (64-bit) o Windows 11.
- **Entorno de Ejecución:** Node.js v20+ o v24+ con `pnpm` v12+.

## Comandos Principales

```bash
# Instalar dependencias del monorepo
pnpm install

# Compilar todos los paquetes
pnpm run build

# Ejecutar las pruebas unitarias e integración (Vitest)
pnpm test

# Verificación de tipos estricta (TypeScript)
pnpm typecheck

# Análisis estático de código (ESLint)
pnpm run lint

# Iniciar la aplicación de escritorio en modo local
pnpm --filter @karaoke/desktop start
```
