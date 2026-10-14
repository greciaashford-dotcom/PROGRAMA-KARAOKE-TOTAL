# Estado de Implementación — Karaoke Total (MVP Local)

## Resumen Ejecutivo

| Fase | Descripción | Estado | Pruebas |
| :--- | :--- | :--- | :--- |
| **Fase 0** | Arquitectura, Contratos, Diagramas, Riesgos | **Completada y Aprobada** | N/A (Teórica) |
| **Fase 1** | Base Segura (Monorepo, Electron, Vite, React, SQLite, CSP, IPC) | **Completada y Verificada** | 9 pasadas / 0 fallidas |
| **Fase 2** | Biblioteca Local (Carpetas, ffprobe, Watcher, Catálogo, Filtros) | **Completada y Verificada** | 19 pasadas / 0 fallidas |
| **Fase 3** | Sesión y Cola (Cantantes, Turnos, Reordenar, Transiciones) | **Completada y Verificada** | 29 pasadas / 0 fallidas |
| **Fase 4** | Reproductor (Protocolo Seguro, Rangos de Bytes, Controles) | Pendiente de Aprobación | — |
| **Fase 5** | Segunda Pantalla (Ventana Pública, Monitor Secundario, Desconexión) | Pendiente | — |
| **Fase 6** | Empaquetado y Validación (Instalador NSIS, Auditoría) | Pendiente | — |

---

## Detalle de la Fase 3 — Sesión y Cola de Actuaciones

### Objetivos Completados
- [x] Máquina de estados formal implementada con validación estricta (`isValidQueueTransition`):
  - Flujo principal: `QUEUED → CALLED → PREPARING → READY → PLAYING → COMPLETED`.
  - Transiciones alternativas controladas: `QUEUED → CANCELLED`, `QUEUED → SKIPPED`, `CALLED → SKIPPED`, `PREPARING → FAILED`, `READY → FAILED`, `PLAYING → PAUSED → PLAYING`, `PLAYING → SKIPPED`, `PLAYING → FAILED`.
  - Regla innegociable de concurrencia: No se permite más de un elemento en estado `PLAYING` simultáneamente en la misma sesión.
- [x] Repositorio de cantantes (`SingerRepository`):
  - Registro de alias o nombre operativo con mesa/ubicación opcional y notas.
  - Privacidad estricta: sin solicitar correo, teléfono ni datos sensibles.
- [x] Repositorio de cola (`QueueRepository`):
  - Inserción incremental atómica (`AddToQueueDTO`) con protección anti-doble clic (rechaza peticiones idénticas dentro de una ventana de 1.5s).
  - Cálculo automático y acumulativo de tiempos de espera estimados por turno a partir de la duración de las pistas precedentes.
  - Reordenamiento transaccional de posiciones con preservación del orden previo para permitir "Deshacer".
  - Registro auditable de cada transición y reordenación en la tabla `queue_events`.
  - Reconciliación tras reinicio (`recoverSessionQueue`): reasigna elementos `PLAYING` a `READY` sin activar reproducción automática inesperada.
- [x] Canales IPC implementados y validados con Zod:
  - `queue:get`, `queue:add`, `queue:reorder`, `queue:undoReorder`, `queue:transition`.
  - `singer:create`, `singer:list`.
  - Emisión de evento en tiempo real `event:queue:updated` tras cada cambio.
- [x] Interfaz de la Consola del Operador (UI):
  - `QueuePanel`: Lista ordenada de turnos con badges de estado accesibles, tiempo de espera aproximado, ajuste de semitonos, botones de subir/bajar posición por teclado/ratón, banner destacado del "Siguiente turno" y botón "Deshacer orden".
  - `AddToQueueModal`: Selector de cantante (existente o creación rápida al vuelo) y ajuste de tono (-6 a +6 semitonos).
  - `AddSingerModal`: Modal de alta de cantantes.
  - Integración en `CatalogPanel` con botón directo `+` en cada fila de canción.
- [x] 29 pruebas unitarias automatizadas con Vitest cubriendo transiciones válidas e inválidas, anti-doble clic, reordenamiento, eventos y recuperación.
