# Manual de Usuario — Karaoke Total (MVP Local)

Bienvenido a **Karaoke Total**, la solución de escritorio local diseñada específicamente para salas y bares de karaoke. Este sistema funciona de forma 100% independiente en tu ordenador con Windows, sin conexión a Internet, sin suscripciones en la nube y garantizando la privacidad de tus clientes y la seguridad de tus archivos.

---

## 1. Requisitos del Sistema

- **Sistema Operativo:** Windows 10 (64 bits, build 19041 o superior) o Windows 11.
- **Hardware Mínimo:** Procesador Intel Core i3 (o equivalente AMD), 4 GB de RAM, puerto HDMI o salida de vídeo para segunda pantalla.
- **Configuración de Pantallas Recomendada:** 2 pantallas (Monitor del Operador + Pantalla Pública/Proyector para el público).
- **Formatos Multimedia Compatibles:**
  - Vídeo: MP4 (códecs de vídeo H.264 / audio AAC), WebM (VP8/VP9 / audio Opus).
  - Audio: MP3, WAV, OGG, FLAC.

---

## 2. Instalación en Windows

1. Ejecuta el archivo instalador oficial: `Karaoke Total Setup 0.1.0.exe`.
2. Sigue las instrucciones del asistente de instalación NSIS:
   - Puedes elegir la ruta de instalación deseada (por defecto `C:\Program Files\Karaoke Total` o `AppData\Local\Programs\Karaoke Total`).
   - Se creará automáticamente un acceso directo en tu Escritorio y en el Menú Inicio.
3. Al finalizar la instalación, inicia la aplicación.

> [!NOTE]
> Todos los datos de la base de datos local y configuración se almacenan de forma segura en tu carpeta de usuario de Windows (`%APPDATA%\karaoke-total\`). Si actualizas la aplicación a una versión más reciente, tus carpetas, catálogo, cantantes e historial se conservarán intactos.

---

## 3. Puesta en Marcha: Tus Primeros Pasos

### Paso 1: Configurar las Carpetas de Canciones
1. En la consola principal del operador, pulsa el botón **"Gestionar Carpetas"** (o en la barra de navegación superior).
2. Haz clic en **"Añadir Carpeta"** y selecciona en el explorador de Windows la carpeta donde guardas tus vídeos y pistas de karaoke (por ejemplo, `D:\Karaoke\Pistas`).
3. La aplicación registrará la carpeta autorizada e iniciará un escaneo en segundo plano adaptado para no saturar tu procesador.
4. Podrás ver en tiempo real el progreso: canciones descubiertas, archivos válidos y archivos incompatibles.

### Paso 2: Preparar la Segunda Pantalla (Público)
1. Conecta tu segundo monitor o proyector al ordenador mediante HDMI, DisplayPort o VGA.
2. En la consola, haz clic en **"Ajustes"** (icono de engranaje) o directamente en el botón **"📺 Pantalla Pública"** de la cabecera.
3. Selecciona qué monitor será la pantalla pública. La ventana se abrirá automáticamente en modo **pantalla completa y sin marcos**.
4. **Pantalla de Cortesía:** Mientras no haya ninguna canción sonando, la pantalla del público mostrará una atmósfera visual elegante con la hora actual, el nombre de la sesión y el cartel *"A continuación: ..."* con el próximo turno.

> [!IMPORTANT]
> **Privacidad Total:** La pantalla pública nunca muestra números de mesa, notas privadas del cantante ni paneles de control. Solo el título, artista y alias del cantante.

---

## 4. Operación en Directo

### Buscar Canciones y Encolar
1. En el panel izquierdo de **Catálogo**, escribe en el buscador el título de la canción o el nombre del artista. La búsqueda es instantánea e insensible a mayúsculas o tildes.
2. Al encontrar la pista, haz clic en el botón verde **"Encolar"**.
3. Se abrirá el modal de encolado:
   - Selecciona o escribe el **Alias del Cantante** (ej. *"Carlos"*).
   - Opcionalmente añade la **Mesa o Ubicación** (ej. *"Mesa 4"*) y una nota interna.
   - Ajusta el **Tono** si el cantante lo solicita (desde `-6` hasta `+6` semitonos).
4. Pulsa **"Añadir a la Cola"**. El turno aparecerá de inmediato en el panel central de la **Cola**.

### Control de la Cola
- **Reordenar turnos:** Usa los botones de flecha arriba/abajo en cada fila de la cola para ajustar el orden.
- **Deshacer reordenación:** Si cometes un error reordenando, pulsa **"Deshacer Orden"** para restaurar la posición anterior.
- **Tiempos de espera:** Cada turno muestra una estimación en minutos del tiempo restante para su turno.

### Control de Reproducción (Panel Derecho)
- **Cargar pista:** Haz clic en **"Cargar"** en la canción que esté lista para pasarla al reproductor de directo.
- **Reproducir / Pausar:** Pulsa el botón central o presiona la tecla `Espacio`.
- **Avanzar / Retroceder 5 segundos:** Usa los botones correspondientes o las teclas `Flecha Derecha` / `Flecha Izquierda`.
- **Control de Volumen:** Ajusta el deslizador de volumen maestro o presiona el botón de altavoz para silenciar rápidamente la cabina.
- **Final de la canción:** Al terminar el vídeo, el sistema detecta automáticamente el fin de pista, archiva la actuación en el historial y devuelve la pantalla pública al modo cortesía.

---

## 5. Teclas de Acceso Rápido para el Operador

| Tecla | Acción |
| :--- | :--- |
| `Espacio` | Alternar Reproducir / Pausar |
| `Flecha Izquierda` | Retroceder 5 segundos |
| `Flecha Derecha` | Avanzar 5 segundos |
| `Esc` o `F12` | **PARADA DE EMERGENCIA** (Corte inmediato) |

---

## 6. Funciones Críticas de Seguridad y Emergencia

### Parada de Emergencia Inmediata (Botón Rojo)
Si ocurre cualquier incidente en la sala (acoples graves de micrófono, caída del cantante, contenido inapropiado):
- Pulsa la tecla `Esc`, `F12` o el botón rojo destacado **"Parada de Emergencia"** en la esquina superior de la consola.
- El audio y el vídeo se detendrán en menos de un fotograma, la pantalla pública pasará de inmediato a negro/cortesía y la pista quedará marcada como interrumpida en el registro de auditoría.

### Rescate de Pantalla ("Rescatar Pantalla")
Si alguien tropieza con el cable HDMI del proyector o se desconfigura la pantalla externa:
1. El sistema detecta automáticamente la desconexión del hardware y rescata la ventana pública a tu monitor principal.
2. Si la ventana queda en una posición invisible tras reconectar el cable, pulsa el botón **"Rescatar pantalla"** en la cabecera. La ventana pública volverá de inmediato al centro de tu monitor principal.

### Protección contra Cortes Eléctricos o Reinicios
Si el ordenador se apaga o reinicia accidentalmente:
- Al volver a abrir Karaoke Total, la base de datos SQLite se recupera automáticamente.
- Tu sesión, tu catálogo y la cola de cantantes se restauran intactos en sus posiciones exactas.
- **Cero sorpresas sonoras:** La aplicación nunca arranca reproduciendo música por sorpresa; cualquier pista que estuviera a mitad de ejecución se marca como `READY` lista para que el operador decida cuándo reanudarla.
