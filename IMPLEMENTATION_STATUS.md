# Estado de Implementación — Karaoke Total (MVP Local)

## Resumen Ejecutivo

| Fase | Descripción | Estado | Pruebas |
| :--- | :--- | :--- | :--- |
| **Fase 0** | Arquitectura, Contratos, Diagramas, Riesgos | **Completada y Aprobada** | N/A (Teórica) |
| **Fase 1** | Base Segura (Monorepo, Electron, Vite, React, SQLite, CSP, IPC) | **Completada y Verificada** | 9 pasadas / 0 fallidas |
| **Fase 2** | Biblioteca Local (Carpetas, ffprobe, Watcher, Catálogo, Filtros) | **Completada y Verificada** | 19 pasadas / 0 fallidas |
| **Fase 3** | Sesión y Cola (Cantantes, Turnos, Reordenar, Transiciones) | **Completada y Verificada** | 29 pasadas / 0 fallidas |
| **Fase 4** | Reproductor (Protocolo Seguro, Rangos de Bytes, Controles) | **Completada y Verificada** | 47 pasadas / 0 fallidas |
| **Fase 5** | Segunda Pantalla (Ventana Pública, Monitor Secundario, Desconexión) | Pendiente de Aprobación | — |
| **Fase 6** | Empaquetado y Validación (Instalador NSIS, Auditoría) | Pendiente | — |

---

## Detalle de la Fase 4 — Reproductor Multimedia Local y Control en Vivo

### Objetivos Completados
- [x] Paquete dedicado `@karaoke/media-engine`:
  - Contrato formal desacoplado `IMediaEngine` con suscripción a eventos de estado (`PLAYING`, `PAUSED`, `STOPPED`, `READY`, etc.).
  - Parser robusto de encabezados HTTP `Range` (`RFC 7233 / 9110`): `parseByteRange` soportando rangos inicial-final, abiertos y sufijos con clampeo automático contra desbordamientos.
  - Resolvedor de tipos MIME nativos para video/audio web (`.mp4`, `.webm`, `.mp3`, `.wav`, `.ogg`, `.aac`, `.flac`).
  - 13 pruebas unitarias específicas para validación sintáctica y casos límite.
- [x] Protocolo seguro de streaming nativo `karaoke-media://`:
  - Registrado como esquema privilegiado antes de `app.whenReady()` (estándar, seguro, soporte de Fetch API, CORS habilitado y streaming).
  - Manejador HTTP con soporte real de **HTTP 206 Partial Content** y `Content-Range: bytes START-END/TOTAL`.
  - **Cero exposición de rutas físicas en el renderer**: Las URLs usan exclusivamente la forma `karaoke-media://asset/<uuid>`.
  - Salvaguarda innegociable de seguridad: Validación en cada petición con `assertSafePath` para imposibilitar Path Traversal y escape de carpetas autorizadas.
- [x] Repositorio de estado de reproducción (`PlaybackRepository`):
  - Fila singleton persistente en SQLite (`playback_state`).
  - Métodos atómicos para comandos `PLAY`, `PAUSE`, `STOP`, `SEEK`, `SET_VOLUME` y actualización dosificada de progreso.
  - Reconciliación resiliente al iniciar (`reconcileStartup`): limpia estados huérfanos `PLAYING` para evitar reproducción automática no deseada tras reinicio o fallo eléctrico.
- [x] Canales IPC implementados y validados con Zod:
  - `player:getState`, `player:prepare`, `player:command`, `player:emergencyStop`, `player:reportEnded`, `player:updateProgress`.
  - Eventos push en tiempo real: `event:player:stateChanged` y `event:queue:updated`.
  - `player:reportEnded`: procesamiento condicionado exclusivamente al evento nativo `ended` del DOM HTML5.
- [x] Consola del Operador (`PlayerPanel.tsx`):
  - Visor de previsualización con proporción 16:9 integrado en la rejilla de tres paneles de la consola.
  - Barra de progreso interactiva / scrubber con tiempo formateado `mm:ss / mm:ss` y búsqueda inmediata.
  - Botonera de control: Reproducir/Pausar, Detener, Rebobinar 5s, Avanzar 5s.
  - Control de volumen maestro con deslizador y botón de silenciado instantáneo.
  - Indicador destacado de metadatos: Título, Artista, Cantante, Mesa y Tono (`±semitonos`).
  - Atajos de teclado globales para el operador en directo:
    - `Espacio`: Alternar Reproducir / Pausar.
    - `Esc` o `F12`: Parada de Emergencia inmediata.
    - `Flecha Izquierda` / `Flecha Derecha`: Retroceder / Avanzar 5 segundos.
  - **Parada de Emergencia**: Botón de contraste alto y presencia permanente en el panel y pie de página, cortando instantáneamente sonido y vídeo y marcando la pista como `SKIPPED` en la auditoría.
- [x] Integración bidireccional con `QueuePanel`: Botón directo "Cargar" en turnos `READY` o `PREPARING` para transferir la pista a la consola de directo en un solo clic.
- [x] 47 pruebas unitarias automatizadas pasando limpiamente en todo el monorepo. Typecheck y ESLint pasando con 0 errores.
