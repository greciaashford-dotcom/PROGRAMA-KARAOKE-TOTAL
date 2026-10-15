# Arquitectura y Auditoría de Seguridad — Karaoke Total

Este documento detalla las medidas de seguridad, defensas en profundidad y auditoría de la arquitectura del MVP local de **Karaoke Total** en Windows.

---

## 1. Principio Rector: Mínimo Privilegio y Cero Confianza

El sistema está diseñado para operar en un entorno de host local con acceso a archivos del disco duro pero aislando completamente el código de renderizado (React/HTML5) del acceso directo al sistema operativo.

---

## 2. Aislamiento de Procesos en Electron

Todas las ventanas de la aplicación (`BrowserWindow`), tanto la Consola del Operador como la Pantalla Pública, están blindadas con las siguientes directivas innegociables:

```typescript
webPreferences: {
  nodeIntegration: false,     // Prohíbe el uso de require() y módulos nativos en el DOM
  contextIsolation: true,     // Aísla completamente el contexto JS de la ventana del de Node
  sandbox: true,              // Ejecuta los procesos de renderizado dentro del sandbox de Chromium
  webSecurity: true,          // Hace cumplir la política del mismo origen (SOP) y restricciones de CORS
  preload: path.resolve(...), // Solo expone funciones bridge explícitas y tipadas
}
```

### Bloqueo de Navegación y Creación de Ventanas
En el proceso principal (`apps/desktop/src/main/security.ts`):
- Se intercepta el evento `will-navigate` de cada `webContents` para cancelar cualquier intento de redirigir a una URL externa o protocolo no autorizado.
- Se configura `setWindowOpenHandler` para denegar (`{ action: 'deny' }`) cualquier intento de abrir ventanas emergentes (`window.open`), enlaces con `target="_blank"` o diálogos de navegación no controlados.

---

## 3. Política de Seguridad de Contenido (CSP)

Se inyecta una cabecera CSP estricta en todas las respuestas locales mediante `session.defaultSession.webRequest.onHeadersReceived`:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' karaoke-media:; img-src 'self' data:; connect-src 'self' karaoke-media:; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'self';
```

- **`object-src 'none'` y `frame-src 'none'`**: Previene la incrustación de plugins o iframes.
- **`media-src 'self' karaoke-media:`**: Permite únicamente la carga de medios a través del protocolo seguro autorizado.
- **Sin scripts remotos**: No se permite la carga de CDNs ni código ejecutable foráneo.

---

## 4. Protocolo Seguro `karaoke-media://` y Streaming HTTP 206

### Cero Exposición de Rutas Físicas
- El renderer nunca recibe ni manipula rutas absolutas de disco (ej. `C:\Karaoke\cancion.mp4`).
- Toda referencia multimedia en la interfaz utiliza identificadores universales opacos:
  ```text
  karaoke-media://asset/550e8400-e29b-41d4-a716-446655440000
  ```

### Validación contra Path Traversal (`assertSafePath`)
Cuando el protocolo recibe una solicitud:
1. Resuelve el UUID contra la base de datos SQLite para obtener la ruta física almacenada.
2. Comprueba que el archivo pertenezca a una carpeta raíz autorizada (`media_folders`).
3. Ejecuta `assertSafePath(absolutePath, authorizedRoot)`:
   - Resuelve enlaces simbólicos y normaliza con `path.resolve`.
   - Verifica que la ruta resultante comience estrictamente con la ruta de la raíz autorizada (`path.relative(root, candidate)` no empieza con `..`).
   - Bloquea cualquier intento de evasión de directorio (`../`, `..\\`, rutas UNC o secuencias maliciosas).

### Soporte de Rangos de Bytes (RFC 7233 / 9110)
- El protocolo maneja solicitudes `Range: bytes=START-END` y responde con **HTTP 206 Partial Content**.
- Valida los límites de los rangos para evitar desbordamientos de enteros o respuestas fuera del tamaño real del archivo, permitiendo scrubbing suave en el reproductor HTML5 sin exponer el sistema de archivos.

---

## 5. Blindaje del Puente Preload e IPC

- **Sin APIs genéricas**: No se expone ningún canal genérico (`ipcRenderer.send`, `ipcRenderer.on`, `shell`, `fs`).
- **Contratos Fuertes con Zod**: Cada argumento entrante a través de IPC es validado mediante esquemas Zod en el proceso principal. Cualquier carga inválida es rechazada de inmediato sin ejecutar lógica de negocio.
- **Patrón Discriminado `Result<T, AppError>`**: Ningún error de base de datos o excepción no controlada expone volcados de memoria (stack traces) hacia la interfaz. Los mensajes devueltos son códigos y descripciones funcionales y sanitizadas en español.

---

## 6. Privacidad en la Pantalla Pública

- La ventana pública (`PublicScreen.tsx`) es renderizada en un contexto separado.
- Los metadatos proyectados se limitan estrictamente a:
  - Título de la Canción
  - Nombre del Artista
  - Alias Artístico del Cantante
- **Datos Vetados en la Pantalla Pública**:
  - Número de mesa o ubicación del cliente.
  - Notas privadas del operador.
  - Identificadores de cola, tiempos de espera administrativos o botones de control.

---

## 7. Sanitización y Redacción de Logs

- En caso de diagnóstico o exportación de errores, cualquier ruta de archivo local en los registros es redactada (`[REDACTED_PATH]`) para no filtrar la estructura del disco duro del usuario ni nombres de cuentas de Windows.
