/**
 * Generador y reproductor de sonido de aplausos de público (6 segundos)
 * mediante Web Audio API (estéreo, múltiples capas de palmadas resonantes y acústica de sala).
 */

let audioCtx: AudioContext | null = null;
let cachedApplauseBuffer: AudioBuffer | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let activeGain: GainNode | null = null;
let activeTimeout: ReturnType<typeof setTimeout> | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Construye un buffer estéreo de 6.0 segundos que simula una sala llena aplaudiendo:
 * - Cientos de palmadas individuales por segundo con envolvente percusiva y resonancia de manos (900Hz-2600Hz)
 * - Cuerpo acústico de sala y reverberación cálida
 * - Fade-in rápido (0.35s), cuerpo pleno (0.35s-4.4s) y caída natural gradual hasta los 6.0s exactos
 */
function buildApplauseBuffer(ctx: AudioContext, durationSec: number = 6): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // 1. Capa de reverberación / murmullo cálido de sala (filtro paso-banda suave)
  let b0L = 0,
    b1L = 0,
    b2L = 0;
  let b0R = 0,
    b1R = 0,
    b2R = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Envolvente global de 6 segundos
    let env = 1.0;
    if (t < 0.35) {
      env = Math.pow(t / 0.35, 0.7);
    } else if (t > 4.2) {
      const rem = Math.max(0, (durationSec - t) / (durationSec - 4.2));
      env = Math.pow(rem, 1.5);
    }

    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;

    // Filtro tipo ruido rosa / ambiente de sala
    b0L = 0.99 * b0L + whiteL * 0.04;
    b1L = 0.96 * b1L + whiteL * 0.08;
    b2L = 0.85 * b2L + whiteL * 0.12;
    const roomL = (b0L + b1L + b2L) * 0.14;

    b0R = 0.99 * b0R + whiteR * 0.04;
    b1R = 0.96 * b1R + whiteR * 0.08;
    b2R = 0.85 * b2R + whiteR * 0.12;
    const roomR = (b0R + b1R + b2R) * 0.14;

    left[i] = roomL * env;
    right[i] = roomR * env;
  }

  // 2. Superposición de ~1100 palmadas individuales distribuidas en los 6 segundos y en el panorama estéreo
  const clapCount = Math.floor(durationSec * 185);
  for (let c = 0; c < clapCount; c++) {
    // Densidad decreciente hacia el final
    const u = Math.random();
    const startSec = u < 0.82 ? Math.random() * 4.5 : 4.3 + Math.random() * 1.55;
    if (startSec >= durationSec - 0.05) continue;

    // Envolvente global según el instante de la palmada
    let globalEnv = 1.0;
    if (startSec < 0.3) {
      globalEnv = 0.35 + 0.65 * (startSec / 0.3);
    } else if (startSec > 4.2) {
      globalEnv = Math.pow(Math.max(0, (durationSec - startSec) / (durationSec - 4.2)), 1.35);
    }

    const clapDurationSec = 0.011 + Math.random() * 0.016; // 11ms a 27ms por palmada
    const clapSamples = Math.floor(clapDurationSec * sampleRate);
    const startSample = Math.floor(startSec * sampleRate);

    // Panorama estéreo (-0.85 a +0.85) y amplitud individual
    const pan = (Math.random() * 2 - 1) * 0.85;
    const amp = (0.08 + Math.random() * 0.14) * globalEnv;
    const gainL = amp * Math.cos(((pan + 1) * Math.PI) / 4);
    const gainR = amp * Math.sin(((pan + 1) * Math.PI) / 4);

    // Frecuencia de resonancia de manos ahuecadas (950 Hz - 2450 Hz)
    const freq = 950 + Math.random() * 1500;
    const omega = (2 * Math.PI * freq) / sampleRate;
    const resonanceDecay = 65 + Math.random() * 55;

    let filterState = 0;
    for (let s = 0; s < clapSamples && startSample + s < totalSamples; s++) {
      const localT = s / sampleRate;
      // Ataque rápido de 1.2ms y caída exponencial
      const attack = localT < 0.0012 ? localT / 0.0012 : 1.0;
      const decay = Math.exp(-localT * resonanceDecay);
      const noise = Math.random() * 2 - 1;
      // Modulación resonante de palmada
      const resonant = noise * (0.65 + 0.35 * Math.sin(omega * s));
      filterState = 0.45 * filterState + 0.55 * resonant;

      const sampleVal = filterState * attack * decay;
      const idx = startSample + s;
      left[idx] = (left[idx] ?? 0) + sampleVal * gainL;
      right[idx] = (right[idx] ?? 0) + sampleVal * gainR;
    }
  }

  // 3. Normalización suave con limitador tanh para evitar saturación
  for (let i = 0; i < totalSamples; i++) {
    left[i] = Math.tanh((left[i] ?? 0) * 1.35) * 0.85;
    right[i] = Math.tanh((right[i] ?? 0) * 1.35) * 0.85;
  }

  return buffer;
}

/**
 * Reproduce 6 segundos de aplausos automáticamente o bajo demanda.
 */
export function playApplause(
  durationMs: number = 6000,
  volumeScalar: number = 0.85,
  onComplete?: () => void,
): void {
  stopApplause();

  try {
    const ctx = getAudioContext();
    const durationSec = Math.max(1, durationMs / 1000);

    if (!cachedApplauseBuffer || Math.abs(cachedApplauseBuffer.duration - durationSec) > 0.1) {
      cachedApplauseBuffer = buildApplauseBuffer(ctx, durationSec);
    }

    const source = ctx.createBufferSource();
    source.buffer = cachedApplauseBuffer;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volumeScalar)), ctx.currentTime);

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    activeSource = source;
    activeGain = gainNode;

    source.start(0);

    activeTimeout = setTimeout(() => {
      stopApplause();
      if (onComplete) onComplete();
    }, durationMs);
  } catch (err) {
    console.warn('[Aplausos] No se pudo reproducir el efecto de aplausos:', err);
    if (onComplete) onComplete();
  }
}

/**
 * Detiene inmediatamente el sonido de aplausos si está activo.
 */
export function stopApplause(): void {
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  if (activeSource) {
    try {
      activeSource.stop();
      activeSource.disconnect();
    } catch {
      // Ignorar si ya había terminado
    }
    activeSource = null;
  }
  if (activeGain) {
    try {
      activeGain.disconnect();
    } catch {
      // Ignorar
    }
    activeGain = null;
  }
}
