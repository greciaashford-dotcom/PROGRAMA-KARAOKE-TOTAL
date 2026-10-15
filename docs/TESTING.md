# Plan y Protocolo de Pruebas — Karaoke Total (MVP Local)

Este documento describe la suite de pruebas automatizadas y el protocolo de validación manual para certificar la fiabilidad y estabilidad de **Karaoke Total** en Windows.

---

## 1. Suite de Pruebas Automatizadas (Vitest)

El proyecto cuenta con **49 pruebas automatizadas** que cubren la lógica de negocio crítica, la máquina de estados, el análisis de medios, la seguridad de rutas y los canales IPC:

```bash
# Ejecutar todas las pruebas del monorepo
pnpm test
```

### Detalle por Módulos y Paquetes:

| Paquete | Archivo de Prueba | Casos de Prueba | Aspectos Clave Verificados |
| :--- | :--- | :--- | :--- |
| `@karaoke/database` | `database.test.ts` | 5 pruebas | Conexión SQLite WAL, ejecución idempotente de migraciones, tabla `__migrations`, repositorio de configuración y sesiones. |
| `@karaoke/database` | `queue.test.ts` | 10 pruebas | Encolado atómico, debounce anti-doble clic (<1.5s), cálculo de tiempos de espera, reordenación con capacidad de deshacer (`undoLastReorder`), máquina de estados estricta (máximo 1 `PLAYING`) y registro de auditoría en `queue_events`. |
| `@karaoke/database` | `playback.test.ts` | 5 pruebas | Fila singleton `playback_state`, comandos de transporte (`PLAY`, `PAUSE`, `STOP`, `SEEK`, `SET_VOLUME`), reconciliación al inicio tras reinicio forzado. |
| `@karaoke/media-indexer` | `media-indexer.test.ts` | 9 pruebas | Recorrido recursivo no bloqueante, filtrado de archivos no multimedia, extracción de metadatos con `ffprobe-static`, huella rápida de 8 KB (`calculateFastFingerprint`), y blindaje contra Directory Traversal con `assertSafePath`. |
| `@karaoke/media-engine` | `range-parser.test.ts` | 13 pruebas | Parser RFC 7233 / 9110 de rangos de bytes HTTP (`Range: bytes=start-end`), soporte de rangos abiertos, sufijos, protección contra desbordamientos, y resolvedor de tipos MIME nativos. |
| `@karaoke/desktop` | `ipc.test.ts` | 7 pruebas | Validación de argumentos IPC con esquemas Zod, rechazo de cargas maliciosas o incompletas, y formato uniforme de respuesta `Result<T, AppError>`. |

---

## 2. Protocolo de Validación Manual de Aceptación (Windows)

Para certificar la versión final en un equipo Windows real:

### Prueba 1: Instalación Limpia y Lanzamiento
1. Ejecutar el instalador `release/Karaoke Total Setup 0.1.0.exe`.
2. Completar la instalación guiada seleccionando una ruta personalizada o la predeterminada.
3. Verificar que se creen los accesos directos en el Menú Inicio y en el Escritorio.
4. Abrir la aplicación y verificar que la consola del operador arranque sin errores ni pantallas en blanco.
5. Comprobar que en `%APPDATA%\karaoke-total\` se cree el archivo de base de datos `karaoke_total.sqlite`.

### Prueba 2: Autorización e Indexación de Carpetas Reales
1. Pulsar **"Gestionar Carpetas"** y añadir una carpeta del disco con pistas de karaoke reales (archivos `.mp4`, `.webm`, `.mp3`).
2. Comprobar que el indicador muestre el avance de escaneo incremental sin congelar la interfaz.
3. Verificar que las pistas aparezcan en el catálogo con duración, formato y resolución correctos.
4. Probar la búsqueda en tiempo real buscando por fragmentos de título o artista con y sin tildes.

### Prueba 3: Gestión de Cantantes y Turnos en Cola
1. Seleccionar una canción y pulsar **"Encolar"**.
2. Indicar un cantante (ej. *"Ana"*), mesa (ej. *"Mesa 2"*) y un ajuste de tono de `+2` semitonos.
3. Comprobar que el turno aparezca en la cola con el tiempo de espera estimado.
4. Añadir una segunda canción y usar las flechas para reordenar la cola. Pulsar **"Deshacer Orden"** y verificar que retorne a la posición previa.

### Prueba 4: Proyección en Pantalla Pública (Dual-Screen)
1. Conectar una segunda pantalla o proyector.
2. Hacer clic en **"📺 Pantalla Pública"** en la cabecera.
3. Verificar que la ventana pública se abra en pantalla completa sin marcos en el segundo monitor.
4. Observar el **Modo Cortesía**: debe verse la hora actual, el nombre de la sesión y el cartel *"A continuación: Ana - Canción (Mesa no visible)"*.
5. Cargar y reproducir la canción de Ana:
   - Ambas pantallas deben sincronizarse de inmediato con streaming local `karaoke-media://`.
   - La pantalla pública debe mostrar el banner introductivo durante 6 segundos y ocultar el cursor a los 2 segundos.
   - La consola del operador debe permitir pausar (`Espacio`), rebobinar y avanzar 5 segundos (`Flechas`).
6. Dejar correr el vídeo hasta el final: verificar que al emitirse el evento nativo `ended` la canción pase a `COMPLETED` y la pantalla pública regrese al modo cortesía.

### Prueba 5: Resiliencia ante Desconexión de Pantalla y Parada de Emergencia
1. Durante la reproducción, desconectar el cable de la pantalla externa: la aplicación debe rescatar automáticamente la ventana pública a la pantalla principal sin colapsar.
2. Reconectar y pulsar **"Rescatar pantalla"** para reposicionarla.
3. Presionar la tecla `Esc` o `F12`: la reproducción debe detenerse en menos de un fotograma de forma incondicional.

### Prueba 6: Reinicio Seguro sin Reproducción Automática
1. Mientras una canción esté en cola o preparándose, cerrar forzosamente la aplicación (`Alt + F4`).
2. Volver a abrir Karaoke Total:
   - Toda la cola, las carpetas y los cantantes deben estar intactos.
   - **Ningún audio debe comenzar a reproducirse automáticamente**.
