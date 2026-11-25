# ESPECIFICACIÓN FUNCIONAL Y TÉCNICA — KARAOKE TOTAL (PRO STUDIO)

Este documento describe de forma exhaustiva y **agnóstica a la tecnología** la arquitectura funcional, reglas de negocio, flujos de operación, modelo de datos local y diseño de interfaz de usuario de **Karaoke Total – Pro Studio**.

Su propósito es servir como plano maestro para implementar la aplicación de escritorio desde cero en cualquier entorno nativo compatible tanto con sistemas clásicos como modernos.

---

## 1. FUNCIONALIDADES IMPLEMENTADAS

### 1.1. Gestión de Carpetas y Catálogo Multimedia Local
- **Autorización de carpetas locales**:
  - El operador puede vincular una o varias carpetas del disco duro o unidades externas donde almacena sus pistas de karaoke.
  - Cada carpeta tiene una categoría (`KARAOKE` para el catálogo principal de pistas o `AMBIENT` para música de fondo en intervalos) y un estado de activación (`Activa` / `Oculta`).
  - Desactivar una carpeta oculta temporalmente sus canciones del catálogo sin borrar sus registros ni sus metadatos editados.
  - Desautorizar (eliminar) una carpeta borra sus registros del catálogo local, pero **jamás** modifica ni elimina los archivos físicos del disco.
- **Escaneo e indexación recursiva en segundo plano**:
  - Recorre recursivamente la carpeta seleccionada ignorando archivos o subcarpetas ocultos (aquellos cuyo nombre comienza por `.`).
  - **Formatos admitidos en el catálogo de Karaoke**:
    - Vídeo: `.mp4`, `.m4v`, `.webm`, `.mkv`, `.mov`.
    - Audio: `.mp3`, `.m4a`, `.wav`, `.ogg`, `.flac`.
  - **Huella digital rápida (Fingerprint SHA-256)**:
    - Para indexar miles de archivos pesados sin bloquear el disco, la huella se calcula combinando la cadena `size:<tamaño_en_bytes>|mtime:<fecha_modificación_ms>|` junto con los primeros `4096 bytes` (4 KB) y los últimos `4096 bytes` (4 KB) del archivo (o el archivo entero si mide 8 KB o menos).
  - **Extracción de metadatos técnicos**:
    - De cada archivo se obtiene: duración en milisegundos, formato contenedor, códec de vídeo, códec de audio, resolución (`ancho × alto`) y número de canales de audio.
    - Si un archivo de audio contiene una imagen de portada incrustada (por ejemplo `mjpeg` o `png`) además de una pista de audio válida, debe clasificarse como `AVAILABLE` (Disponible) y tratarse como pista reproducible de solo audio.
  - **Inferencia automática de Artista y Título desde el nombre del archivo**:
    1. Se toma el nombre del archivo sin extensión.
    2. Se eliminan etiquetas accesorias entre paréntesis o corchetes (insensible a mayúsculas): `(karaoke)`, `(instrumental)`, `(playback)`, `(karaoke version)`, `(hd)`, `(hq)` y sus equivalentes con `[...]`.
    3. Se limpia cualquier numeración inicial de pista (expresión regular `^\s*\d+[\s._\-–—]+\s*`, por ejemplo `"01 - "`, `"01. "`, `"001_"`).
    4. Se busca el primer separador válido en este orden: `" - "`, `" – "`, `" — "`, `" _ "`.
    5. Si existe separador: la parte izquierda es el `Artista` (o `"Desconocido"` si queda vacía) y la derecha es el `Título` (o `"Sin Título"` si queda vacía).
    6. Si no existe separador: `Artista = "Desconocido"` y `Título = <nombre limpio>`.
  - **Preservación de ediciones manuales**:
    - Cada canción tiene un campo `metadata_source` con valor `FILENAME` (inferido automáticamente) o `MANUAL` (editado por el operador).
    - Si el operador edita manualmente el título, artista, idioma, género o colección de una canción, pasa a `MANUAL`. Los reescaneos posteriores de la carpeta actualizan el estado físico del archivo pero **nunca sobrescriben** los metadatos marcados como `MANUAL`.
  - **Reconciliación de archivos ausentes**:
    - Si durante un reescaneo o al intentar reproducir una pista el archivo físico ya no se encuentra en su ruta, su estado técnico cambia a `MISSING` (mostrando la etiqueta roja `AUSENTE` en la lista), conservando el registro en la base de datos por si la unidad externa vuelve a conectarse.

### 1.2. Buscador Normalizado y Filtros del Catálogo
- **Normalización de texto para búsqueda (`search_text_normalized`)**:
  - Al indexar o editar una canción, se genera una cadena normalizada concatenando `Artista + " " + Título + " " + NombreArchivo`, convertida a minúsculas, descomponiendo caracteres Unicode (`NFD`) para eliminar todas las tildes y signos diacríticos (`á→a`, `é→e`, `í→i`, `ó→o`, `ú→u`, `ü→u`), sustituyendo signos de puntuación por espacios y colapsando espacios múltiples.
  - Cuando el operador escribe en la caja de búsqueda, su consulta pasa por la misma función de normalización y se divide en palabras (tokens); una canción coincide si contiene **todos** los tokens buscados en cualquier orden.
- **Filtros combinables en tiempo real**:
  1. **Texto libre**: Canción, artista o nombre de archivo (con retardo/debounce de `200 ms`).
  2. **Carpeta**: Todas las carpetas habilitadas de categoría `KARAOKE` o una carpeta específica.
  3. **Formato**: Todos los formatos o extensión específica (`.mp4`, `.mkv`, `.webm`, `.mov`, `.mp3`, `.wav`, `.flac`).
  4. **Estado técnico**: Todos los estados, `AVAILABLE` (Disponibles), `MISSING` (Ausentes en disco) o `INCOMPATIBLE`.
  5. **Idioma**: Filtro por texto de idioma.
- **Paginación**:
  - Muestra lotes de `50 canciones` por página, ordenadas alfabéticamente por título ascendente, indicando el total de pistas y controles de página anterior/siguiente.

### 1.3. Gestión de Sesiones y Modo Libre
- **Modo Libre (Sin sesión abierta)**:
  - Permite reproducir cualquier pista directamente desde el catálogo con un solo clic en el botón `Play` (`▶`) o mediante doble clic sobre la fila, sin obligación de registrar cantantes ni abrir una sesión.
- **Sesión en Directo (`OPEN` / `PAUSED` / `CLOSED`)**:
  - El operador puede abrir una sesión con nombre personalizado (ej. `"Sesión en Directo"`, `"Noche de Viernes"`).
  - La sesión agrupa la lista de cantantes registrados, la cola de actuaciones, el historial de canciones cantadas y el registro de auditoría de eventos.
  - Una sesión abierta puede **Pausarse** (`PAUSED`), **Reanudarse** (`OPEN`) o **Cerrarse** (`CLOSED`). Al iniciar la aplicación, si la última sesión quedó `OPEN` o `PAUSED`, se restaura automáticamente.

### 1.4. Gestión de Cantantes, Cola de Actuaciones y Máquina de Estados
- **Registro de Cantantes**:
  - Cada cantante pertenece a la sesión activa y almacena: `Nombre o Alias` (obligatorio), `Mesa o Ubicación` (opcional) y `Notas` (opcional).
  - Puede registrarse desde el botón `+ Cantante` del panel central o directamente dentro del diálogo `Añadir Canción a la Cola`.
- **Encolado de Canciones y Protección Antiduplicados**:
  - Al pulsar `+` en una canción del catálogo, el operador elige un cantante existente (o crea uno nuevo al vuelo) y selecciona el ajuste de tono en semitonos (`-6` a `+6`, por defecto `0`).
  - **Protección contra doble clic**: Si se intenta insertar exactamente la misma combinación `sesión + canción + cantante` con menos de `1500 ms` (1.5 segundos) de diferencia respecto al registro anterior, la petición se rechaza como duplicada.
  - Se asigna automáticamente la posición correlativa `max(position) + 1`.
- **Cálculo de Tiempo Estimado de Espera**:
  - Para cada elemento activo en la cola (`PLAYING`, `READY`, `PREPARING`, `CALLED`, `QUEUED`), se calcula su tiempo estimado de espera sumando la duración (`duration_ms`) de todas las pistas activas situadas por delante de él (`"Ahora"` si es `0 ms`, `"~1 min"` o `"~X min"`).
- **Máquina de Estados Formal de la Cola (`QueueStatus`)**:
  - Estados posibles y sus etiquetas visibles:
    - `QUEUED` → `EN COLA`
    - `CALLED` → `LLAMADO` (el operador avisa al cantante para que se acerque al escenario)
    - `PREPARING` → `PREPARANDO`
    - `READY` → `CARGADO` (pista cargada en el reproductor esperando pulsar Reproducir)
    - `PLAYING` → `EN DIRECTO` (reproduciéndose actualmente)
    - `PAUSED` → `PAUSADO`
    - `COMPLETED` → `COMPLETADO` (finalizó normalmente)
    - `SKIPPED` → `SALTADO` (turno saltado)
    - `CANCELLED` → `CANCELADO` (turno cancelado)
    - `FAILED` → `ERROR ARCHIVO` (fallo de lectura o archivo ausente)
  - **Transiciones permitidas**:
    - Desde `QUEUED`: `CALLED`, `PREPARING`, `CANCELLED`, `SKIPPED`.
    - Desde `CALLED`: `PREPARING`, `READY`, `SKIPPED`, `CANCELLED`.
    - Desde `PREPARING`: `READY`, `PLAYING`, `FAILED`, `CANCELLED`.
    - Desde `READY`: `PLAYING`, `FAILED`, `CANCELLED`, `SKIPPED`.
    - Desde `PLAYING`: `PAUSED`, `COMPLETED`, `SKIPPED`, `FAILED`.
    - Desde `PAUSED`: `PLAYING`, `COMPLETED`, `SKIPPED`, `FAILED`.
    - Desde `COMPLETED`: *(estado final, sin transiciones salientes)*.
    - Desde `SKIPPED`: `QUEUED` *(permite reencolar desde la pestaña Historial si el cantante regresa)*.
    - Desde `CANCELLED`: `QUEUED` *(permite reencolar desde la pestaña Historial)*.
    - Desde `FAILED`: `READY`, `QUEUED` *(permite reintentar si se reconecta el disco o se corrige el archivo)*.
  - **Regla de exclusividad de reproducción**:
    - Jamás puede haber dos elementos en estado `PLAYING` al mismo tiempo dentro de una sesión. Si se lanza un nuevo turno mientras otro estaba en `PLAYING`, el anterior debe cerrarse o detenerse primero.
- **Reordenación y Deshacer (`Undo`)**:
  - Los turnos pendientes pueden reordenarse arrastrando y soltando (`Drag & Drop`) o mediante los botones de flecha arriba (`↑`) y abajo (`↓`).
  - **Regla del elemento en reproducción**: El turno que está actualmente en estado `PLAYING` está bloqueado en su posición y no puede moverse.
  - Cada reordenación guarda en memoria el vector con el orden previo de identificadores y habilita el botón **`Deshacer`** en la cabecera del panel central para restaurar el orden anterior con un clic.
- **Recuadro Destacado `PRÓXIMO CANTANTE`**:
  - Situado en la parte superior de la pestaña `Activos` del panel central.
  - Selecciona automáticamente el primer turno activo que no esté en reproducción (o el que está en escenario si es el único activo) y muestra en grande:
    - Nombre del cantante.
    - Título de la canción y artista original.
    - Posición en la cola (`Posición #X`).
    - Etiqueta de estado (`SIGUIENTE TURNO` en ámbar o `EN ESCENARIO` en verde).
    - Botón rápido **`▶ Lanzar`** para cargar y reproducir ese turno inmediatamente.

### 1.5. Pantalla Pública en Segundo Monitor (TV / Proyector)
- **Detección automática y asignación de monitores**:
  - La aplicación enumera todos los monitores conectados al sistema indicando su identificador, resolución, coordenadas y cuál es el monitor principal.
  - Por defecto (`Automático`), la Pantalla Pública se abre a pantalla completa sin bordes en el **primer monitor secundario** disponible.
  - Si el equipo solo tiene **1 monitor conectado**, la Pantalla Pública se abre como una ventana redimensionable (`960 × 540`) centrada en el monitor principal para que no tape completamente la consola del operador.
- **Sincronización en tiempo real con el Monitor del Operador**:
  - El vídeo y el audio de la canción de karaoke se reproducen de forma sincronizada con el reproductor de la consola.
  - Si la diferencia de tiempo entre la posición del operador y la pantalla pública supera `1500 ms` (1.5 segundos), la pantalla pública ajusta automáticamente su posición de tiempo.
- **Función de Rescate (`Rescatar Pantalla Pública`)**:
  - Si un monitor secundario se desconecta o pierde imagen, el botón de salvavidas (`Rescatar`) mueve inmediatamente la ventana pública al monitor principal del operador en modo ventana (`960 × 540` centrada).

### 1.6. Música de Ambiente (Solo MP3) para Intervalos
- **Exclusividad de formato `.mp3`**:
  - El módulo de música ambiental acepta y filtra exclusivamente archivos con extensión `.mp3` almacenados bajo la categoría `AMBIENT`.
- **Importación flexible**:
  - **`+ Archivos MP3`**: Permite seleccionar uno o varios archivos `.mp3` sueltos desde cualquier carpeta del ordenador; la aplicación autoriza su carpeta contenedora en categoría `AMBIENT` e indexa los archivos seleccionados.
  - **`+ Carpeta MP3`**: Permite seleccionar una carpeta entera de música `.mp3` de fondo para indexar todos sus archivos `.mp3`.
  - Cada pista de la lista incluye un botón de papelera para quitarla de la lista de ambiente sin borrar el archivo del disco.
- **Modos de reproducción**:
  - **`Auto en intervalos`** (casilla activada por defecto): Cuando el operador activa la música de ambiente (`▶`), esta suena automáticamente únicamente mientras **no** hay un karaoke en reproducción (`PLAYING`) y **no** están sonando los aplausos de fin de actuación. En cuanto comienza un karaoke, la música de ambiente se pausa (o hace fade-out si el crossfade está activo), y vuelve a sonar automáticamente cuando termina la canción de karaoke y concluyen los 6 segundos de aplausos.
  - **`Aleatorio` (`Shuffle`)**: Cuando termina una pista `.mp3` ambiental o se pulsa `Siguiente pista ambiental`, elige al azar otra pista distinta de la lista en lugar de avanzar secuencialmente.

### 1.7. Efecto Automático de Aplausos (6 Segundos)
- **Activación automática al finalizar cada karaoke**:
  - Cada vez que una pista de karaoke llega a su final natural, se dispara automáticamente un sonido estéreo de aplausos de sala durante **exactamente `6000 ms` (6 segundos)**.
- **Síntesis o reproducción acústica del aplauso**:
  - El sonido de aplausos dura 6.0 segundos con una envolvente de entrada rápida (`0.0 s – 0.35 s`), cuerpo pleno de sala (`0.35 s – 4.2 s`) y caída progresiva natural (`4.2 s – 6.0 s`).
  - *(En una implementación nativa puede generarse mediante síntesis PCM estéreo de palmadas resonantes entre `950 Hz` y `2450 Hz` con reverberación de sala, o reproducirse desde un recurso de audio PCM/WAV estéreo de 6 segundos integrado en el ejecutable).*
- **Volumen y corte del aplauso**:
  - El volumen del aplauso respeta los faders de `KARAOKE` y `MASTER` (si cualquiera de los dos está en `MUTE`, el aplauso se silencia; en caso contrario suena con ganancia proporcional `(VolumenKaraoke / 100) * (VolumenMaster / 100)` con un mínimo audible de `0.35`).
  - Durante los 6 segundos de aplausos, el monitor del operador muestra la superposición visual **`👏 ¡APLAUSOS EN SALA! (6s)`** y la música de ambiente espera a que terminen los aplausos antes de iniciar su entrada.
  - Si el operador inicia otra canción de karaoke o pulsa la Parada de Emergencia antes de que pasen los 6 segundos, los aplausos se cortan de inmediato.

### 1.8. Mezclador de Audio Profesional DJ de 3 Canales y Crossfade Automático
- **Arquitectura de 3 canales independientes**:
  1. **Canal 1: `KARAOKE` (Color Ámbar `#FFB100`)**:
     - Controla exclusivamente el nivel de audio de las pistas de karaoke.
     - Incluye fader vertical (`0 %` a `100 %`), lectura en porcentaje grande, lectura en decibelios (`dB`), escala graduada (`+6 dB`, `0 dB`, `-6 dB`, `-12 dB`, `-18 dB`, `-24 dB`, `-∞`), doble barra de vúmetros LED estéreo (`L` y `R` de 12 segmentos cada una) y botón **`MUTE`**.
  2. **Canal 2: `MÚSICA AMBIENTAL` (Color Azul Cian `#29C7FF`)**:
     - Controla exclusivamente el nivel de los archivos `.mp3` de música de ambiente.
     - Incluye fader vertical (`0 %` a `100 %`), lectura en porcentaje y dB, escala graduada, vúmetros LED estéreo (`L` y `R`) y botón **`MUTE`**.
     - Está sincronizado bidireccionalmente con la barra horizontal de volumen del panel de Música de Ambiente.
  3. **Canal 3: `MASTER` (Color Verde `#10B981`)**:
     - Controla el volumen general de salida de toda la aplicación, escalando proporcionalmente los niveles individuales de Karaoke y Música Ambiental:
       - `GananciaEfectivaKaraoke = (KaraokeMuted || MasterMuted) ? 0 : (KaraokeVolume / 100) * (MasterVolume / 100) * FactorCrossfadeKaraoke`
       - `GananciaEfectivaAmbiente = (AmbientMuted || MasterMuted) ? 0 : (AmbientVolume / 100) * (MasterVolume / 100) * FactorCrossfadeAmbiente`
     - Incluye fader vertical (`0 %` a `100 %`), lectura en porcentaje y dB, escala graduada, vúmetros LED estéreo (`L` y `R`) y botón **`MUTE`**.
- **Fórmula de conversión de Porcentaje a Decibelios (`dB`)**:
  - Si el canal está en `MUTE` o el volumen es `<= 0 %`: muestra **`-∞ dB`**.
  - Si el volumen es `>= 85 %`: interpola linealmente entre `0 dB` (al `85 %`) y `+6.0 dB` (al `100 %`):
    `dB = ((volumen - 85) / 15) * 6`
  - Si el volumen está entre `1 %` y `84 %`: aplica curva logarítmica respecto a `85 %`:
    `dB = max(-48, 20 * log10(volumen / 85))`
- **Medidores VU Estéreo Reales**:
  - Los vúmetros `L` (izquierdo) y `R` (derecho) de cada canal miden las muestras PCM reales del flujo de audio en reproducción (combinando valor eficaz `RMS` y valor de pico `Peak` en ventanas de tiempo real a `~25–30 FPS`).
  - Si una pista es monofónica y el canal derecho entrega `0`, se espeja la lectura del canal izquierdo en el derecho.
  - El vúmetro `MASTER` muestra en cada canal (`L` y `R`) la suma cuadrática de los niveles instantáneos de Karaoke y Música Ambiental:
    `Master_L = min(100, round(sqrt(Karaoke_L^2 + Ambiente_L^2)))`
    `Master_R = min(100, round(sqrt(Karaoke_R^2 + Ambiente_R^2)))`
  - Cada columna LED tiene **12 segmentos**:
    - Segmentos `1 a 8` (inferiores): **Verde** (`#10B981`).
    - Segmentos `9 y 10` (medios-altos): **Ámbar** (`#FFB100`).
    - Segmentos `11 y 12` (picos): **Rojo** (`#EF4444`).
- **Cajón Inferior Desplegable y Ocultable**:
  - Por defecto, al instalar la aplicación, el mezclador inicia **recogido/oculto** (`mixer_expanded = false`) para maximizar el espacio de las tres columnas principales y evitar barras de desplazamiento en pantallas `1366 × 768`.
  - Cuando está recogido, muestra una barra compacta de `36 px` de alto con el título `MEZCLADOR DE AUDIO`, un resumen en vivo de los niveles (`KARAOKE: XX%`, `AMBIENTE: XX%`, `MASTER: XX%`, `CROSSFADE: ON/OFF`) y una flecha hacia arriba (`↑`).
  - Al pulsar la barra, se despliega suavemente (`~240 ms`) mostrando los 3 canales con sus faders verticales y controles de crossfade, cambiando el icono a una flecha hacia abajo (`↓`).
  - Plegar o desplegar el mezclador jamás interrumpe el audio ni reinicia volúmenes, y su estado abierto/cerrado se guarda inmediatamente en la base de datos local.
- **Crossfade Automático Configurable**:
  - Incluye un interruptor **`CROSSFADE AUTOMÁTICO` (`ON` / `OFF`)** y un selector de duración de transición (`1 s`, `2 s`, `3 s`, `4 s`, `5 s`; por defecto `3 s`).
  - **Al iniciar un Karaoke**:
    - Si la música ambiental estaba sonando y el Crossfade está en `ON`, la música ambiental reduce gradualmente su ganancia desde su nivel actual hasta `0` a lo largo de los segundos configurados (`crossfade_duration_sec`) y luego se pausa, mientras el audio del karaoke entra con una rampa ascendente desde el `35 %` hasta el `100 %` de su volumen objetivo durante ese mismo tiempo.
  - **Al terminar un Karaoke (tras los 6 segundos de aplausos)**:
    - Si la música ambiental está activa en modo `Auto en intervalos` y el Crossfade está en `ON`, el reproductor ambiental reanuda la pista `.mp3` desde el `5 %` de su volumen objetivo y sube progresivamente hasta el `100 %` de su nivel en los segundos configurados.

---

## 2. FLUJOS DE USUARIO, ATAJOS DE TECLADO Y COMPORTAMIENTO EXACTO

### 2.1. Comportamiento Exacto al Iniciar la Aplicación
1. **Inicialización de Base de Datos Local**:
   - Se abre o crea el archivo de base de datos SQLite en la carpeta de datos locales del usuario (con modo `WAL` y claves foráneas activadas) y se ejecutan las migraciones pendientes sin destruir datos previos.
2. **Saneamiento y Recuperación Automática tras Cierre Inesperado**:
   - Si quedaron activos multimedia falsamente marcados como `INCOMPATIBLE` por tener portadas incrustadas pero con códec de audio válido, se restauran automáticamente a `AVAILABLE`.
   - Si existe una sesión activa (`OPEN` o `PAUSED`), se inspecciona su cola: cualquier turno que hubiera quedado en estado `PLAYING` antes de un corte de energía o cierre forzoso se pasa automáticamente a estado `READY` y se registra un evento `RECOVERED_AFTER_RESTART` en la auditoría.
   - El estado del reproductor (`playback_state`) se inicializa en `IDLE` (o `STOPPED`) con posición `0 ms`.
3. **Carga de Configuración y Mezclador**:
   - Se leen los ajustes guardados: volúmenes de Karaoke, Ambiente y Master, estados `MUTE`, configuración de `Crossfade`, estado plegado/desplegado del mezclador y monitores asignados.
4. **Apertura Automática del Asistente Rápido**:
   - Si no existe ninguna carpeta autorizada en la base de datos, se abre automáticamente el **Asistente de Configuración Rápida** de 3 pasos (1. Pantallas → 2. Biblioteca Local → 3. Abrir Sesión).

### 2.2. Comportamiento al Reproducir una Canción
Existen dos formas de iniciar la reproducción de un karaoke:
- **A) Reproducción Directa desde el Catálogo (1 clic en `▶` o doble clic en la fila)**:
  1. Se verifica que el archivo físico exista en disco. Si no existe, el archivo se marca como `MISSING` (`AUSENTE`), se refresca la fila y se muestra una notificación de error sin bloquear la aplicación.
  2. Si existe, se carga en el Monitor de Reproducción (y en la Pantalla Pública si está abierta) con etiqueta `"Reproducción Directa"`.
  3. El estado del reproductor pasa a `PLAYING`.
  4. Si estaba sonando un aplauso previo, se corta inmediatamente.
  5. Si la música de ambiente estaba sonando en modo `Auto en intervalos`, ejecuta su fundido de salida (`fade-out`) según la duración del Crossfade (o se pausa al instante si el Crossfade está en `OFF`).
  6. El audio del karaoke inicia su fundido de entrada (`fade-in` si Crossfade está en `ON`) hasta alcanzar `(KaraokeVolume / 100) * (MasterVolume / 100)`.
- **B) Reproducción desde la Cola de Cantantes (`▶ Play` en un turno, `▶ Lanzar` en Próximo Cantante, o botón `Reproducir` del monitor)**:
  1. Si el operador pulsa **`Cargar`** en un turno de la cola:
     - El turno pasa a estado `READY` (`CARGADO`).
     - El reproductor carga el archivo y lo deja pausado en `0:00` listo para arrancar.
     - La Pantalla Pública muestra en su tarjeta central el aviso en verde: **`¡PREPARADO! SUBE AL ESCENARIO`** con el nombre del cantante y la canción.
  2. Si el operador pulsa **`Play` / `Lanzar`** (o pulsa **`Reproducir`** en el monitor cuando no hay pista cargada, lo cual toma automáticamente el primer turno pendiente de la cola):
     - Si había otro turno distinto en estado `PLAYING`, ese turno anterior pasa primero a `COMPLETED`.
     - Se verifica la existencia física del archivo en disco (si falta, el turno pasa a `FAILED` con motivo `"El archivo físico ya no se encuentra en la ubicación original"`).
     - El turno seleccionado pasa a estado `PLAYING`, registrando la marca de tiempo `started_at`.
     - Se inicia el vídeo en el Monitor del Operador y en la Pantalla Pública.
     - En la Pantalla Pública aparece durante **6 segundos** el banner inferior izquierdo **`EN DIRECTO`** con el título de la canción, el artista y el nombre del cantante, desvaneciéndose después para dejar limpia la letra del vídeo.

### 2.3. Comportamiento al Pausar y Reanudar
- **Al pulsar `Pausar` (o barra `Espacio` mientras reproduce)**:
  - El reproductor del operador y la Pantalla Pública pausan el vídeo en el milisegundo actual.
  - El estado del reproductor pasa a `PAUSED`.
  - Si la pista pertenece a un turno de la cola, el turno pasa de `PLAYING` a `PAUSED` y se registra el evento `STATE_PAUSED`.
  - En la esquina superior derecha de la Pantalla Pública aparece el indicador **`⏸ EN PAUSA`**.
  - *Nota importante*: Pausar momentáneamente un karaoke **no** dispara los aplausos ni reactiva la música de ambiente, para permitir al operador o al cantante resolver una pausa breve sin perder su turno.
- **Al pulsar `Reproducir` desde `PAUSED` (o barra `Espacio` mientras está en pausa)**:
  - El vídeo continúa exactamente desde el punto donde se pausó tanto en el monitor del operador como en la Pantalla Pública.
  - El estado vuelve a `PLAYING` y desaparece el cartel `EN PAUSA` de la Pantalla Pública.

### 2.4. Comportamiento al Pasar a la Siguiente Canción (`Siguiente` / `Skip`)
Cuando el operador pulsa el botón **`Siguiente` (`⏭`)** en el Monitor de Reproducción:
1. Si la pista actual pertenecía a un turno de la cola, dicho turno cambia su estado a **`SKIPPED` (`SALTADO`)** con motivo `"Saltada por el operador desde el reproductor"` y registra `completed_at`.
2. Se busca en la cola activa el siguiente turno cuyo estado no sea `COMPLETED`, `CANCELLED`, `SKIPPED` ni `FAILED`.
3. **Si existe un siguiente turno pendiente**:
   - Se carga y reproduce automáticamente de inmediato (`PLAYING`), actualizando el Monitor del Operador, el recuadro `PRÓXIMO CANTANTE` y la Pantalla Pública.
4. **Si no quedan más turnos pendientes en la cola**:
   - El reproductor se detiene (`STOPPED`), limpia la pista cargada, la Pantalla Pública vuelve a la pantalla de cortesía y la música de ambiente (si estaba habilitada en `Auto en intervalos`) vuelve a sonar con suavidad.

### 2.5. Comportamiento al Terminar una Canción Naturalmente
Cuando el vídeo o audio de karaoke llega al final del archivo:
1. El reproductor reporta el fin natural de la pista.
2. Si la pista correspondía a un turno de la cola, el turno pasa automáticamente a estado **`COMPLETED` (`COMPLETADO`)**, registrando `completed_at` y moviéndose de la pestaña `Activos` a la pestaña `Historial`.
3. El Monitor de Reproducción limpia la pista activa, la Pantalla Pública pasa a mostrar la **Pantalla de Cortesía** con el nombre del siguiente cantante en la cola (`"A CONTINUACIÓN EN EL ESCENARIO"`), y el recuadro `PRÓXIMO CANTANTE` de la consola se actualiza al nuevo turno.
4. **Suenan automáticamente los 6 segundos de aplausos** (`👏 ¡APLAUSOS EN SALA! (6s)`).
5. Una vez concluidos los 6 segundos de aplausos, si la **Música de Ambiente** está activada con `Auto en intervalos`, comienza a reproducir los archivos `.mp3` ambientales aplicando el `fade-in` del Crossfade automático.

### 2.6. Comportamiento de la Parada de Emergencia (`Esc` / `F12`)
Al pulsar el botón rojo **`PARADA DE EMERGENCIA (Esc)`** de la barra inferior (o las teclas `Esc` / `F12`):
1. Se corta instantáneamente el vídeo y el audio del reproductor de karaoke (`STOPPED`, posición `0`).
2. Se corta instantáneamente cualquier sonido de aplausos activo.
3. Se corta y desactiva instantáneamente la reproducción de Música de Ambiente (cancelando cualquier temporizador de crossfade).
4. Si había un turno de la cola en estado `PLAYING` o `PAUSED`, pasa a estado `PAUSED` con nota `"Parada de emergencia ejecutada por el operador"`, registrando el evento `EMERGENCY_STOP` en la auditoría.
5. La Pantalla Pública detiene el vídeo de inmediato y pasa a la pantalla de cortesía.
6. La barra inferior muestra la alerta en rojo: **`¡PARADA DE EMERGENCIA ACTIVADA! Vídeo y audio cortados.`**

### 2.7. Atajos de Teclado Globales de la Consola
*(Los atajos se procesan cuando el foco del teclado no está dentro de un campo de escritura de texto o lista desplegable)*:

| Tecla | Acción |
| :--- | :--- |
| **`Espacio`** | Alterna entre **Reproducir** y **Pausar** la pista actual (o lanza el primer turno pendiente de la cola si no hay pista cargada). |
| **`Esc`** o **`F12`** | Ejecuta la **Parada de Emergencia** inmediata (corta karaoke, pantalla pública, aplausos y música de ambiente). |
| **`Flecha Izquierda (←)`** | Retrocede **`5 segundos`** (`-5000 ms`) en la canción de karaoke en reproducción. |
| **`Flecha Derecha (→)`** | Avanza **`5 segundos`** (`+5000 ms`) en la canción de karaoke en reproducción. |
| **Doble clic en fila del Catálogo** | Reproduce inmediatamente esa canción en el Monitor de Reproducción y Pantalla Pública. |

---

## 3. ESTRUCTURA DE DATOS LOCAL (BASE DE DATOS RELACIONAL)

Toda la información se persiste localmente en una base de datos relacional (SQLite). A continuación se detallan las **9 tablas** que conforman el esquema completo.

### 3.1. Tabla `settings` (Configuración del Sistema y Mezclador)
Almacena un único registro global (`id = "default"`).

| Columna | Tipo | Nulo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` (PK) | No | `'default'` | Identificador único del registro de configuración. |
| `language` | `TEXT` | No | `'es'` | Idioma de la interfaz (`'es'` o `'en'`). |
| `theme` | `TEXT` | No | `'dark'` | Tema visual (`'dark'` o `'light'`). |
| `operator_display_id` | `TEXT` | Sí | `NULL` | ID del monitor asignado a la consola del operador. |
| `public_display_id` | `TEXT` | Sí | `NULL` | ID del monitor asignado a la Pantalla Pública (`NULL` = automático). |
| `master_volume` | `INTEGER` | No | `80` | Volumen del canal MASTER (`0` a `100`). |
| `karaoke_volume` | `INTEGER` | No | `100` | Volumen del canal KARAOKE (`0` a `100`). |
| `ambient_volume` | `INTEGER` | No | `30` | Volumen del canal MÚSICA AMBIENTAL (`0` a `100`). |
| `karaoke_muted` | `INTEGER (BOOL)` | No | `0` (`false`) | Estado `MUTE` del canal KARAOKE (`0` o `1`). |
| `ambient_muted` | `INTEGER (BOOL)` | No | `0` (`false`) | Estado `MUTE` del canal MÚSICA AMBIENTAL (`0` o `1`). |
| `master_muted` | `INTEGER (BOOL)` | No | `0` (`false`) | Estado `MUTE` del canal MASTER (`0` o `1`). |
| `crossfade_enabled` | `INTEGER (BOOL)` | No | `1` (`true`) | Si el Crossfade Automático está activado (`0` o `1`). |
| `crossfade_duration_sec` | `INTEGER` | No | `3` | Duración del Crossfade en segundos (`1` a `5`). |
| `mixer_expanded` | `INTEGER (BOOL)` | No | `0` (`false`) | Si el cajón del mezclador está desplegado (`1`) o recogido (`0`). |
| `created_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de creación. |
| `updated_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de última modificación. |

### 3.2. Tabla `media_folders` (Carpetas Autorizadas)

| Columna | Tipo | Nulo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT (UUID)` (PK) | No | — | Identificador único de la carpeta. |
| `display_name` | `TEXT` | No | — | Nombre visible de la carpeta. |
| `absolute_path_encrypted_or_local_only` | `TEXT` | No | — | Ruta absoluta normalizada en el sistema de archivos local. |
| `category` | `TEXT` | No | `'KARAOKE'` | Categoría: `'KARAOKE'` (catálogo principal) o `'AMBIENT'` (música de fondo MP3). |
| `enabled` | `INTEGER (BOOL)` | No | `1` (`true`) | `1` si está activa en el catálogo; `0` si está oculta temporalmente. |
| `last_scan_started_at` | `TEXT (ISO-8601)` | Sí | `NULL` | Inicio del último escaneo. |
| `last_scan_completed_at` | `TEXT (ISO-8601)` | Sí | `NULL` | Finalización del último escaneo. |
| `scan_status` | `TEXT` | No | `'IDLE'` | Estado: `'IDLE'`, `'SCANNING'`, `'COMPLETED'`, `'FAILED'`, `'CANCELLED'`. |
| `created_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de alta. |
| `updated_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de actualización. |

### 3.3. Tabla `media_assets` (Archivos Físicos Multimedia)
- **Índices**:
  - Índice único compuesto: `idx_media_assets_folder_relative (folder_id, relative_path)`.
  - Índice de huella: `idx_media_assets_fingerprint (fingerprint)`.
  - Índice de estado: `idx_media_assets_status (status)`.

| Columna | Tipo | Nulo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT (UUID)` (PK) | No | — | Identificador único del archivo físico. |
| `folder_id` | `TEXT (UUID)` (FK) | No | — | Referencia a `media_folders.id` (`ON DELETE CASCADE`). |
| `relative_path` | `TEXT` | No | — | Ruta relativa dentro de la carpeta autorizada. |
| `filename` | `TEXT` | No | — | Nombre del archivo con extensión. |
| `extension` | `TEXT` | No | — | Extensión en minúsculas con punto (ej. `'.mp4'`, `'.mp3'`). |
| `size_bytes` | `INTEGER` | No | — | Tamaño del archivo en bytes. |
| `modified_at` | `TEXT (ISO-8601)` | No | — | Fecha de modificación del archivo en disco. |
| `fingerprint` | `TEXT` | No | — | Huella digital rápida SHA-256 del archivo. |
| `duration_ms` | `INTEGER` | Sí | `NULL` | Duración en milisegundos. |
| `container` | `TEXT` | Sí | `NULL` | Formato contenedor (ej. `'mov,mp4,m4a'`, `'matroska,webm'`, `'mp3'`). |
| `video_codec` | `TEXT` | Sí | `NULL` | Códec de vídeo (ej. `'h264'`, `'vp9'`) o `NULL` si es solo audio. |
| `audio_codec` | `TEXT` | Sí | `NULL` | Códec de audio (ej. `'aac'`, `'mp3'`, `'opus'`). |
| `width` | `INTEGER` | Sí | `NULL` | Ancho del vídeo en píxeles. |
| `height` | `INTEGER` | Sí | `NULL` | Alto del vídeo en píxeles. |
| `audio_channels` | `INTEGER` | Sí | `NULL` | Número de canales de audio (ej. `2`). |
| `status` | `TEXT` | No | `'PENDING_ANALYSIS'` | `'AVAILABLE'`, `'MISSING'`, `'INCOMPATIBLE'`, `'CORRUPTED'`, `'PENDING_ANALYSIS'`. |
| `last_seen_at` | `TEXT (ISO-8601)` | Sí | `NULL` | Última vez que el escáner verificó su presencia en disco. |
| `created_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de creación. |
| `updated_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de actualización. |

### 3.4. Tabla `songs` (Catálogo de Canciones y Metadatos)
- **Índices**:
  - `idx_songs_search (search_text_normalized)`
  - `idx_songs_asset (media_asset_id)`

| Columna | Tipo | Nulo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT (UUID)` (PK) | No | — | Identificador único de la canción. |
| `media_asset_id` | `TEXT (UUID)` (FK) | No | — | Referencia a `media_assets.id` (`ON DELETE CASCADE`). |
| `title` | `TEXT` | No | — | Título de la canción. |
| `artist` | `TEXT` | No | — | Artista o intérprete original. |
| `language` | `TEXT` | Sí | `NULL` | Idioma opcional (ej. `'Español'`, `'Inglés'`). |
| `genre` | `TEXT` | Sí | `NULL` | Género musical opcional (ej. `'Pop'`, `'Rock'`, `'Balada'`). |
| `collection` | `TEXT` | Sí | `NULL` | Colección o álbum opcional. |
| `disc` | `TEXT` | Sí | `NULL` | Número o código de disco opcional. |
| `track` | `TEXT` | Sí | `NULL` | Número de pista opcional. |
| `search_text_normalized` | `TEXT` | No | — | Texto normalizado sin tildes ni mayúsculas para búsqueda instantánea. |
| `metadata_source` | `TEXT` | No | `'FILENAME'` | Origen del metadato: `'FILENAME'` (automático) o `'MANUAL'` (editado). |
| `created_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de creación. |
| `updated_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de actualización. |

### 3.5. Tabla `karaoke_sessions` (Sesiones de Directo)

| Columna | Tipo | Nulo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT (UUID)` (PK) | No | — | Identificador único de la sesión. |
| `name` | `TEXT` | No | — | Nombre de la sesión (ej. `'Sesión en Directo'`). |
| `status` | `TEXT` | No | `'OPEN'` | Estado: `'OPEN'`, `'PAUSED'`, `'CLOSED'`, `'RECOVERING'`. |
| `opened_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de apertura. |
| `closed_at` | `TEXT (ISO-8601)` | Sí | `NULL` | Fecha/hora de cierre (si `status = 'CLOSED'`). |
| `created_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de creación. |
| `updated_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de actualización. |

### 3.6. Tabla `singers` (Cantantes Registrados por Sesión)
- **Índice**: `idx_singers_session (session_id)`.

| Columna | Tipo | Nulo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT (UUID)` (PK) | No | — | Identificador único del cantante. |
| `session_id` | `TEXT (UUID)` (FK) | No | — | Referencia a `karaoke_sessions.id` (`ON DELETE CASCADE`). |
| `display_name` | `TEXT` | No | — | Nombre o alias público del cantante. |
| `table_or_location` | `TEXT` | Sí | `NULL` | Mesa o ubicación en el local (ej. `'Mesa 4'`). |
| `notes` | `TEXT` | Sí | `NULL` | Notas operativas opcionales. |
| `created_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de registro. |
| `updated_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de actualización. |

### 3.7. Tabla `queue_items` (Cola de Actuaciones e Historial)
- **Índices**:
  - `idx_queue_items_session_pos (session_id, position)`
  - `idx_queue_items_status (status)`

| Columna | Tipo | Nulo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT (UUID)` (PK) | No | — | Identificador único del turno en la cola. |
| `session_id` | `TEXT (UUID)` (FK) | No | — | Referencia a `karaoke_sessions.id` (`ON DELETE CASCADE`). |
| `song_id` | `TEXT (UUID)` (FK) | No | — | Referencia a `songs.id` (`ON DELETE RESTRICT`). |
| `singer_id` | `TEXT (UUID)` (FK) | No | — | Referencia a `singers.id` (`ON DELETE RESTRICT`). |
| `position` | `INTEGER` | No | — | Orden numérico correlativo en la cola (`1, 2, 3...`). |
| `key_shift` | `INTEGER` | No | `0` | Ajuste de tono en semitonos (`-6` a `+6`). |
| `tempo_percent` | `INTEGER` | No | `100` | Porcentaje de tempo (`50` a `150`). |
| `status` | `TEXT` | No | `'QUEUED'` | `'QUEUED'`, `'CALLED'`, `'PREPARING'`, `'READY'`, `'PLAYING'`, `'PAUSED'`, `'COMPLETED'`, `'SKIPPED'`, `'CANCELLED'`, `'FAILED'`. |
| `failure_reason` | `TEXT` | Sí | `NULL` | Motivo de error, salto o parada si aplica. |
| `started_at` | `TEXT (ISO-8601)` | Sí | `NULL` | Momento en que pasó a `PLAYING`. |
| `completed_at` | `TEXT (ISO-8601)` | Sí | `NULL` | Momento en que pasó a `COMPLETED`, `SKIPPED`, `CANCELLED` o `FAILED`. |
| `created_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de creación. |
| `updated_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de última transición. |

### 3.8. Tabla `queue_events` (Auditoría de Eventos de la Cola)
- **Índices**:
  - `idx_queue_events_item (queue_item_id)`
  - `idx_queue_events_session (session_id)`

| Columna | Tipo | Nulo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT (UUID)` (PK) | No | — | Identificador único del evento. |
| `session_id` | `TEXT (UUID)` (FK) | No | — | Referencia a `karaoke_sessions.id` (`ON DELETE CASCADE`). |
| `queue_item_id` | `TEXT (UUID)` (FK) | No | — | Referencia a `queue_items.id` (`ON DELETE CASCADE`). |
| `event_type` | `TEXT` | No | — | Tipo de evento (`'ENQUEUED'`, `'REORDERED'`, `'STATE_PLAYING'`, `'STATE_COMPLETED'`, `'EMERGENCY_STOP'`, `'RECOVERED_AFTER_RESTART'`, etc.). |
| `previous_state` | `TEXT` | Sí | `NULL` | Estado anterior del turno. |
| `next_state` | `TEXT` | No | — | Nuevo estado del turno. |
| `payload_json` | `TEXT` | Sí | `NULL` | Datos adicionales en formato JSON (posiciones, motivo de fallo, etc.). |
| `created_at` | `TEXT (ISO-8601)` | No | — | Marca de tiempo exacta del evento. |

### 3.9. Tabla `playback_state` (Estado Persistente del Reproductor)
Almacena un único registro (`id = "current"`).

| Columna | Tipo | Nulo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `TEXT` (PK) | No | `'current'` | Identificador único del estado del reproductor. |
| `session_id` | `TEXT (UUID)` (FK) | Sí | `NULL` | Sesión activa asociada (`ON DELETE SET NULL`). |
| `queue_item_id` | `TEXT (UUID)` (FK) | Sí | `NULL` | Turno activo cargado (`ON DELETE SET NULL`). |
| `media_asset_id` | `TEXT (UUID)` (FK) | Sí | `NULL` | Archivo multimedia cargado (`ON DELETE SET NULL`). |
| `state` | `TEXT` | No | `'IDLE'` | `'IDLE'`, `'LOADING'`, `'READY'`, `'PLAYING'`, `'PAUSED'`, `'STOPPED'`, `'ENDED'`, `'ERROR'`. |
| `position_ms` | `INTEGER` | No | `0` | Posición actual de reproducción en milisegundos. |
| `duration_ms` | `INTEGER` | No | `0` | Duración total de la pista actual en milisegundos. |
| `volume` | `INTEGER` | No | `100` | Volumen efectivo actual enviado a la salida (`0` a `100`). |
| `last_error_code` | `TEXT` | Sí | `NULL` | Último código de error si `state = 'ERROR'`. |
| `updated_at` | `TEXT (ISO-8601)` | No | — | Fecha/hora de última actualización. |

---

## 4. DISEÑO FUNCIONAL DE CADA VENTANA

### 4.1. Paleta Visual y Estética General (Consola DJ "Pro Studio")
- **Fondo principal de la aplicación**: Negro grafito (`#0C1017`).
- **Fondo de paneles y tarjetas**: Gris carbón oscuro (`#121722`) y superficie elevada (`#171E2C`).
- **Bordes sutiles**: Gris azulado oscuro (`#232C3D`).
- **Color de acento principal (Karaoke / Próximo Cantante / Transporte)**: Amarillo ámbar (`#FFB100`).
- **Color de acento secundario (Música de Ambiente)**: Azul cian (`#29C7FF`).
- **Color de estado activo y canal Master**: Verde esmeralda (`#10B981`).
- **Color de alerta, archivo ausente y Parada de Emergencia**: Rojo intenso (`#EF4444` / `#DC2626`).
- **Tipografía**: Fuente sin serifa limpia y de alta legibilidad para textos (`Segoe UI` / `Tahoma` / `Arial`) y fuente monoespaciada (`Consolas` / `Courier New`) para tiempos, relojes, duraciones, porcentajes y escalas en decibelios.
- **Resoluciones objetivo**: Diseño adaptable sin barras de desplazamiento globales tanto en pantallas **`1366 × 768`** (mínimo recomendado `1120 × 700`) como en **`1920 × 1080`**.

---

### 4.2. Ventana 1: Consola Principal del Operador
La ventana principal ocupa toda la pantalla del monitor del operador y se estructura verticalmente en **5 franjas**:

```
+---------------------------------------------------------------------------------------------------+
| 1. BARRA SUPERIOR: [Karaoke Total PRO STUDIO] [● Sesión]   [Abrir Pantalla Pública] [Reloj] [⚙]   |
+---------------------------------------------------------------------------------------------------+
| 2. BARRA DE SESIÓN: [▶ Sesión en Directo • ABIERTA | Iniciada a las ...] [Pausar] [Cerrar Sesión] |
+---------------------------------+---------------------------------+-------------------------------+
| 3A. PANEL IZQUIERDO (1.32fr)    | 3B. PANEL CENTRAL (1.08fr)      | 3C. PANEL DERECHO (1.00fr)    |
| CATÁLOGO LOCAL (N PISTAS)       | COLA Y ESCENARIO (N)            | MONITOR DE REPRODUCCIÓN       |
| - Buscador instantáneo          | - Pestañas: Activos | Historial | - Visor de vídeo 16:9         |
| - Filtros: Carpeta/Formato/     |   Cantantes | Auditoría         | - Título, Artista y Cantante  |
|   Estado/Idioma                 | - Recuadro PRÓXIMO CANTANTE     | - Barra de progreso y tiempos |
| - Tabla paginada de canciones:  |   (Nombre, Canción, #Pos,       | - Botonera: |< -5s [Play] +5s |
|   [Título/Artista] [Dur] [MP4]  |    Estado y botón ▶ Lanzar)     |             >| []             |
|   Botones: [▶] [+] [Editar] [i] | - Lista de turnos con Drag&Drop | - Panel MÚSICA DE AMBIENTE    |
| - Paginación inferior           |   flechas ↑/↓ y acciones        |   (SOLO MP3, Auto intervalos) |
+---------------------------------+---------------------------------+-------------------------------+
| 4. CAJÓN DEL MEZCLADOR DJ (Plegado por defecto: barra 36px ↑ | Desplegado: 3 canales + Crossfade) |
+---------------------------------------------------------------------------------------------------+
| 5. BARRA INFERIOR DE ESTADO: [✔ Consola lista para reproducir.]     [(!) PARADA DE EMERGENCIA]    |
+---------------------------------------------------------------------------------------------------+
```

#### Franja 1: Barra Superior (`Header`)
- **Izquierda**:
  - Icono de disco en ámbar + título **`Karaoke Total`** + insignia ámbar **`PRO STUDIO`**.
  - Indicador de estado con punto luminoso verde (si hay sesión abierta: `"Sesión: <Nombre>"`) o ámbar (`"Modo Reproducción Directa"`).
- **Centro**:
  - Botón **`Abrir Pantalla Pública`** (cuando está cerrada) o **`Pantalla Pública: En Vivo`** resaltado en ámbar (cuando está abierta).
  - Botón de icono **`Rescatar`** (salvavidas, visible solo cuando la Pantalla Pública está abierta) para traerla al monitor principal.
  - Indicador de estado de base de datos local activa.
- **Derecha**:
  - Botón **`Asistente`** (abre el asistente rápido de 3 pasos).
  - **Reloj digital en tiempo real** (`HH:MM:SS` en fuente monoespaciada).
  - Botón de engranaje **`Configuración` (`⚙`)**.

#### Franja 2: Barra de Sesión (`SessionBanner`)
- **Si no hay sesión abierta**:
  - Muestra `"Modo Libre / Sin Sesión de Cola: Reproduce vídeos directamente con el botón ▶ del catálogo, o inicia una sesión para gestionar turnos de cantantes"` y el botón ámbar **`+ Nueva Sesión`** (que despliega un campo de texto inline para escribir el nombre e iniciarla).
- **Si hay sesión activa**:
  - Muestra icono verde de reproducción (o ámbar si está pausada), el **nombre de la sesión**, insignia **`ABIERTA`** (verde) o **`PAUSADA`** (ámbar), hora de apertura (`"Iniciada a las HH:MM:SS"`) y a la derecha los botones **`Pausar Sesión`** (o **`Reanudar Sesión`**) y **`Cerrar Sesión`**.

#### Franja 3: Los Tres Paneles Principales en Columnas
1. **Columna Izquierda — `CATÁLOGO LOCAL (N PISTAS)`**:
   - **Cabecera**: Título con contador total de pistas + botón **`Carpetas (N)`** que abre el gestor de carpetas.
   - **Barra de progreso de escaneo** (visible solo mientras se indexa una carpeta): Muestra `procesados / descubiertos`, nombre del archivo actual, barra de porcentaje ámbar y botón `Cancelar`.
   - **Buscador y Filtros**:
     - Caja de búsqueda con icono de lupa y botón `X` para limpiar.
     - Fila de 4 controles compactos: desplegable `Todas las carpetas`, desplegable `Todos los formatos`, desplegable `Todos los estados` y campo `Idioma...`.
   - **Tabla de Canciones**:
     - Columnas: `Título / Artista`, `Duración`, `Formato`, `Acciones`.
     - Cada fila muestra: icono de vídeo a la izquierda, **Título** en negrita blanca, etiquetas opcionales de idioma o etiqueta roja **`AUSENTE`** si el archivo falta en disco, **Artista** (y género si existe) en gris debajo, duración (`M:SS`), insignia dorada con la extensión (`MP4`, `MKV`, `MP3`, etc.) y 4 botones a la derecha:
       1. **`▶` (Verde)**: Reproducir ahora mismo.
       2. **`+` (Ámbar)**: Añadir a la cola de cantantes.
       3. **`✎` (Gris)**: Editar metadatos de la canción.
       4. **`i` (Gris)**: Ver detalles técnicos del archivo.
   - **Pie de paginación**: `"Página X de Y • Doble clic o botón Play para reproducir al instante"` y botones `<` y `>`.

2. **Columna Central — `COLA Y ESCENARIO (N)`**:
   - **Cabecera**: Título con contador de turnos activos, botón **`Deshacer`** (visible tras reordenar) y botón **`+ Cantante`**.
   - **Barra de 4 Pestañas**:
     1. **`Activos (N)`**:
        - En la parte superior muestra el recuadro destacado con borde ámbar **`PRÓXIMO CANTANTE`** (Nombre del siguiente cantante en grande, `Canción – Artista`, `Posición #X`, insignia `SIGUIENTE TURNO` / `EN ESCENARIO` y botón verde **`▶ Lanzar`**).
        - Debajo lista las tarjetas de los turnos pendientes. Cada tarjeta tiene: icono de agarre para arrastrar, número `#Posición`, flechas `↑` y `↓`, nombre del cantante (y mesa entre paréntesis), insignia de semitonos (`+2 st` / `-1 st` si es distinto de 0), `Título — Artista`, duración, tiempo estimado de espera (`~X min`), insignia de estado y botones rápidos: **`▶ Play`**, **`Cargar`**, **`📞 Llamar`** (si está `QUEUED`), **`⏭ Saltar`** y **`✖ Cancelar`**.
     2. **`Historial (N)`**:
        - Lista las actuaciones ya terminadas (`COMPLETADO`, `SALTADO`, `CANCELADO`, `ERROR ARCHIVO`).
        - En los turnos `SALTADO`, `CANCELADO` o `ERROR ARCHIVO`, muestra el botón **`Reencolar`** para devolverlos a la cola activa.
     3. **`Cantantes (N)`**:
        - Lista todos los cantantes registrados en la sesión con su ubicación/mesa, notas, total de canciones pedidas y total de canciones ya cantadas.
     4. **`Auditoría`**:
        - Muestra la bitácora cronológica inversa de todos los eventos de la sesión (`ENQUEUED`, `STATE_PLAYING`, `REORDERED`, etc.) con su hora exacta (`HH:MM:SS`).

3. **Columna Derecha — `MONITOR DE REPRODUCCIÓN` + `MÚSICA DE AMBIENTE`**:
   - **Cabecera del Monitor**: Título `MONITOR DE REPRODUCCIÓN` e insignia de estado a la derecha (`▣ REPRODUCIENDO` en ámbar, `⏸ PAUSADO`, `● LISTO` en cian o `EN ESPERA`).
   - **Visor 16:9**:
     - Cuando está en espera sin pista cargada, muestra un fondo oscuro de escenario con haces de luz azul/cian e icono musical central.
     - Cuando reproduce un vídeo, muestra la imagen sincronizada con la Pantalla Pública.
     - Cuando reproduce una pista de solo audio, muestra un ecualizador animado de 5 barras ámbar con el título y extensión.
     - Durante los 6 segundos posteriores a terminar una canción, muestra la animación **`👏 ¡APLAUSOS EN SALA! (6s)`**.
   - **Franja de metadatos de pista cargada**: Muestra `Título — Artista`, nombre del cantante e insignia de semitonos (`st`).
   - **Barra de progreso interactiva**: Tiempo transcurrido a la izquierda (`M:SS`), deslizador ámbar arrastrable en el centro y tiempo restante / total a la derecha (`-M:SS / M:SS`).
   - **Botonera de Transporte (6 botones)**:
     1. **`⏮` Reiniciar pista**: Vuelve al segundo `0:00`.
     2. **`↺` Retroceder 5s**: Resta 5 segundos.
     3. **`▶ Reproducir` / `⏸ Pausar`** (Botón principal ancho en color ámbar `#FFB100`).
     4. **`↻` Avanzar 5s**: Suma 5 segundos.
     5. **`⏭` Siguiente canción**: Salta al siguiente turno de la cola.
     6. **`⏹` Detener**: Detiene la reproducción y rebobina a `0:00`.
   - **Subpanel `MÚSICA DE AMBIENTE (SOLO MP3)`**:
     - Cabecera con insignia cian `SOLO MP3` y estado a la derecha (`● SONANDO EN INTERVALO`, `⏸ PAUSADO POR KARAOKE` o `DETENIDO (N MP3)`).
     - Fila de botones: **`+ Archivos MP3`**, **`+ Carpeta MP3`**, botón activable **`Aleatorio`** y casilla **`Auto en intervalos`**.
     - Fila de transporte ambiental: botón **`▶ / ⏸`**, botón **`⏭`**, botón de icono **`Mute`**, deslizador horizontal azul cian (`0–100 %`) y etiqueta de porcentaje (`30%` o `MUTE`).
     - Lista compacta desplazable con los archivos `.mp3` cargados (clic para reproducir uno específico y botón de papelera para quitarlo).

#### Franja 4: Cajón Desplegable del Mezclador Profesional DJ (`AudioMixerDrawer`)
- **Barra Superior del Mezclador (`36 px`, siempre visible)**:
  - **Izquierda**: Icono de faders + título `MEZCLADOR DE AUDIO` + resumen compacto cuando está plegado (`KARAOKE: XX%`, `AMBIENTE: XX%`, `MASTER: XX%`, `CROSSFADE: ON (3s)`).
  - **Centro/Derecha (visible al desplegar)**: Icono de ondas cruzadas en ámbar y cian + título `CROSSFADE AUTOMÁTICO` + interruptor **`ON / OFF`** + selector de duración (`1s`, `2s`, `3s`, `4s`, `5s`).
  - **Extremo Derecho**: Botón con etiqueta `Mezclador` (cuando está cerrado) o `Ocultar` (cuando está abierto) y flecha **`↑` / `↓`**.
- **Cuerpo Desplegable (`178 px` de alto, 3 tarjetas en paralelo)**:
  - **Tarjeta 1 (`KARAOKE` — Borde y Fader Ámbar `#FFB100`)**
  - **Tarjeta 2 (`MÚSICA AMBIENTE` — Borde y Fader Azul Cian `#29C7FF`)**
  - **Tarjeta 3 (`MASTER` — Borde y Fader Verde `#10B981`)**
  - Cada tarjeta contiene:
    - **Columna izquierda**: Título con icono, porcentaje grande (`78 %` o `MUTE` en rojo), lectura en decibelios (`-1.2 dB` o `-∞ dB`) y botón **`MUTE`** con icono de altavoz.
    - **Centro**: Carril vertical oscuro con ranura graduada, relleno luminoso del color del canal y capuchón metálico deslizable (`Fader`) que responde al arrastre vertical del ratón.
    - **Derecha**: Escala vertical de decibelios (`+6 dB`, `0 dB`, `-6 dB`, `-12 dB`, `-18 dB`, `-24 dB`, `-∞`) junto a las dos columnas verticales de **12 segmentos LED** para los canales **`L`** y **`R`**.

#### Franja 5: Barra Inferior de Estado y Parada de Emergencia (`Footer`)
- **Izquierda**: Icono verde de confirmación (o triángulo rojo si el último aviso fue un error) + texto del último evento o estado operativo (`"Consola lista para reproducir."`).
- **Derecha**: Un único botón rojo compacto y destacado **`(!) PARADA DE EMERGENCIA (Esc)`**, siempre visible y accesible independientemente de si el mezclador está abierto o cerrado.

---

### 4.3. Ventanas Modales (Diálogos de la Consola del Operador)
1. **Asistente de Configuración Rápida (`3 Pasos`)**:
   - **Paso 1 (Pantallas)**: Selector de monitor para la Pantalla Pública y consejo de operación con 1 o 2 pantallas.
   - **Paso 2 (Biblioteca Local)**: Botón `Añadir Carpeta del PC`, barra de progreso de indexación y lista de carpetas autorizadas.
   - **Paso 3 (Abrir Sesión)**: Campo para el nombre de la sesión inicial y botón `Comenzar a Operar`.
2. **Gestión de Carpetas Autorizadas**:
   - Botón `+ Añadir Carpeta` y lista de carpetas con su estado (`COMPLETED`, `SCANNING`, `OCULTA`), fecha del último escaneo y 3 botones por carpeta: **`Activa / Inactiva`**, **`Reescanear` / `Cancelar`** y **`Eliminar (Desautorizar)`** (con confirmación).
3. **Añadir Canción a la Cola**:
   - Muestra el título y artista de la canción seleccionada, selector desplegable de cantante existente o formulario inline `+ Nuevo cantante` (Nombre obligatorio + Mesa opcional), control de **Ajuste de Tono en Semitonos** con botones `-` y `+` (rango `-6` a `+6`) y botón `Añadir a la Cola`.
4. **Registrar Cantante**:
   - Campos: `Nombre o Alias del Cantante *`, `Mesa o Ubicación (Opcional)` y `Notas Adicionales (Opcional)`.
5. **Editar Metadatos de Canción**:
   - Campos: `Título de la Canción *`, `Artista / Intérprete *`, `Idioma`, `Género` y `Colección / Disco`. Al guardar, marca `metadata_source = 'MANUAL'` y regenera `search_text_normalized`.
6. **Detalles Técnicos del Archivo**:
   - Muestra tabla con: Nombre de archivo, Estado (`AVAILABLE` / `MISSING` / `INCOMPATIBLE`), Duración, Tamaño en MB, Contenedor, Códec de Vídeo, Códec de Audio, Resolución y Canales de Audio.
   - Incluye dos botones de utilidad: **`Localizar en Explorador`** (abre el Explorador de Windows seleccionando el archivo físico) y **`Volver a analizar`** (relee los metadatos técnicos del archivo).
7. **Configuración del Sistema**:
   - Selector de monitor para la Pantalla Pública + botón `Rescatar`.
   - Selector de idioma de la consola (`Español` / `English`).
   - Deslizadores de volumen Principal (`Master`), `Karaoke` y `Ambiente` + botón `Guardar Cambios`.

---

### 4.4. Ventana 2: Pantalla Pública (Proyector / TV de Sala)
Ventana diseñada para el público y el cantante en el escenario. Carece de controles o menús de operador y oculta automáticamente el puntero del ratón tras **`2000 ms` (2 segundos)** de inactividad.

Opera en **2 modos automáticos** según el estado del reproductor:

#### Modo A: Reproducción Activa (`PLAYING` o `PAUSED`)
- **Vídeo a Pantalla Completa**:
  - Fondo negro (`#000000`) con el vídeo escalado proporcionalmente (`contain`) ocupando el 100 % del área visible.
- **Visualizador para Pistas de Solo Audio**:
  - Si la pista de karaoke es solo un archivo de audio (sin flujo de vídeo), muestra un fondo radial oscuro de escenario con un disco dorado giratorio en el centro, el **Título de la canción** en tipografía gigante (`46 px`) y el **Artista** debajo (`26 px`).
- **Banner de Presentación Inicial (6 segundos)**:
  - Al comenzar cada canción, aparece en la esquina inferior izquierda una tarjeta semitransparente con borde izquierdo ámbar (`#FFB100`) que muestra:
    - Etiqueta superior: **`EN DIRECTO`**
    - **Título de la canción** y **Artista**
    - Icono de micrófono + **`Cantante: <Nombre del Cantante>`**
  - Transcurridos **6 segundos** desde el inicio de la canción, este banner se oculta automáticamente para no tapar ninguna línea de la letra del karaoke.
- **Indicador de Pausa**:
  - Si el operador pausa la reproducción, aparece en la esquina superior derecha un recuadro con borde ámbar: **`⏸ EN PAUSA`**.

#### Modo B: Pantalla de Cortesía e Intervalo (Cuando no hay vídeo reproduciéndose)
Muestra un diseño elegante de escenario con fondo radial oscuro distribuido en tres zonas:
1. **Cabecera de Sala**:
   - A la izquierda: Icono de disco en ámbar + nombre de la sesión activa (o **`KARAOKE TOTAL`**) y subtítulo `"Consola de Directo — Escenario Principal"`.
   - A la derecha: Icono de reloj azul cian + **hora actual en vivo (`HH:MM`)**.
2. **Tarjeta Central de Escenario** (cambia dinámicamente según el estado de la cola):
   - **Caso 1 — Hay una pista cargada en estado `READY` (`CARGADO`)**:
     - Borde verde esmeralda (`#10B981`), insignia superior verde **`🎤 ¡PREPARADO! SUBE AL ESCENARIO`**, nombre del cantante en tamaño gigante (`46 px`) y debajo `Título de la canción — Artista`.
   - **Caso 2 — Hay turnos pendientes en la cola**:
     - Insignia azul cian **`🎤 A CONTINUACIÓN EN EL ESCENARIO`**, nombre del próximo cantante en tamaño gigante (`42 px`) y debajo `Título de la canción — Artista`.
   - **Caso 3 — La cola está vacía**:
     - Mensaje de bienvenida: **`¡El escenario está listo!`** y subtítulo `"Pide tu canción en la cabina del operador para subir a cantar."`
3. **Pie de Pantalla**:
   - Leyenda discreta centrada: `"Karaoke Total — Audio y Vídeo de Alta Definición"`.
