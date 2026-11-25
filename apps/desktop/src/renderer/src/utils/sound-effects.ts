/**
 * Banco de efectos de sonido en vivo para Katakana Karaoke (Web Audio API estéreo):
 * - Aplausos (6 segundos, automático tras cada karaoke y manual)
 * - Ovaciones (4.5 segundos, público eufórico + silbidos de ánimo)
 * - Risas (3.5 segundos, carcajadas cálidas de sala)
 * Garantiza audio limpio sin solapamiento: al disparar un efecto detiene el anterior.
 */

let audioCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
let activeSource: AudioBufferSourceNode | null = null;
let activeGain: GainNode | null = null;
let activeTimeout: ReturnType<typeof setTimeout> | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function buildApplauseBuffer(ctx: AudioContext, durationSec: number = 6): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  let b0L = 0,
    b1L = 0,
    b2L = 0;
  let b0R = 0,
    b1R = 0,
    b2R = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let env = 1.0;
    if (t < 0.35) {
      env = Math.pow(t / 0.35, 0.7);
    } else if (t > durationSec - 1.8) {
      const rem = Math.max(0, (durationSec - t) / 1.8);
      env = Math.pow(rem, 1.5);
    }

    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;

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

  const clapCount = Math.floor(durationSec * 185);
  for (let c = 0; c < clapCount; c++) {
    const u = Math.random();
    const startSec =
      u < 0.82 ? Math.random() * (durationSec * 0.75) : durationSec * 0.72 + Math.random() * (durationSec * 0.25);
    if (startSec >= durationSec - 0.05) continue;

    let globalEnv = 1.0;
    if (startSec < 0.3) {
      globalEnv = 0.35 + 0.65 * (startSec / 0.3);
    } else if (startSec > durationSec - 1.8) {
      globalEnv = Math.pow(Math.max(0, (durationSec - startSec) / 1.8), 1.35);
    }

    const clapDurationSec = 0.011 + Math.random() * 0.016;
    const clapSamples = Math.floor(clapDurationSec * sampleRate);
    const startSample = Math.floor(startSec * sampleRate);

    const pan = (Math.random() * 2 - 1) * 0.85;
    const amp = (0.08 + Math.random() * 0.14) * globalEnv;
    const gainL = amp * Math.cos(((pan + 1) * Math.PI) / 4);
    const gainR = amp * Math.sin(((pan + 1) * Math.PI) / 4);

    const freq = 950 + Math.random() * 1500;
    const omega = (2 * Math.PI * freq) / sampleRate;
    const resonanceDecay = 65 + Math.random() * 55;

    let filterState = 0;
    for (let s = 0; s < clapSamples && startSample + s < totalSamples; s++) {
      const localT = s / sampleRate;
      const attack = localT < 0.0012 ? localT / 0.0012 : 1.0;
      const decay = Math.exp(-localT * resonanceDecay);
      const noise = Math.random() * 2 - 1;
      const resonant = noise * (0.65 + 0.35 * Math.sin(omega * s));
      filterState = 0.45 * filterState + 0.55 * resonant;

      const sampleVal = filterState * attack * decay;
      const idx = startSample + s;
      left[idx] = (left[idx] ?? 0) + sampleVal * gainL;
      right[idx] = (right[idx] ?? 0) + sampleVal * gainR;
    }
  }

  for (let i = 0; i < totalSamples; i++) {
    left[i] = Math.tanh((left[i] ?? 0) * 1.35) * 0.85;
    right[i] = Math.tanh((right[i] ?? 0) * 1.35) * 0.85;
  }

  return buffer;
}

function buildCheersBuffer(ctx: AudioContext, durationSec: number = 4.5): AudioBuffer {
  const buffer = buildApplauseBuffer(ctx, durationSec);
  const sampleRate = ctx.sampleRate;
  const totalSamples = buffer.length;
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Añadir vítores vocales y silbidos de entusiasmo ("¡Wooo! / ¡Bravo!")
  const whistles = [
    { start: 0.25, dur: 0.9, f0: 1550, f1: 2350, pan: -0.45 },
    { start: 0.7, dur: 1.0, f0: 1900, f1: 1400, pan: 0.55 },
    { start: 1.5, dur: 0.85, f0: 1650, f1: 2450, pan: 0.1 },
    { start: 2.1, dur: 0.95, f0: 2100, f1: 1750, pan: -0.3 },
  ];

  for (const w of whistles) {
    const startSample = Math.floor(w.start * sampleRate);
    const len = Math.floor(w.dur * sampleRate);
    const gainL = 0.16 * Math.cos(((w.pan + 1) * Math.PI) / 4);
    const gainR = 0.16 * Math.sin(((w.pan + 1) * Math.PI) / 4);
    let phase = 0;

    for (let s = 0; s < len && startSample + s < totalSamples; s++) {
      const p = s / len;
      const env = Math.sin(Math.PI * p);
      const freq = w.f0 + (w.f1 - w.f0) * Math.sin(Math.PI * 0.5 * p) + Math.sin(p * 34) * 35;
      phase += (2 * Math.PI * freq) / sampleRate;
      const val = Math.sin(phase) * env * 0.7;
      const idx = startSample + s;
      left[idx] = Math.tanh((left[idx] ?? 0) + val * gainL);
      right[idx] = Math.tanh((right[idx] ?? 0) + val * gainR);
    }
  }

  return buffer;
}

function buildLaughterBuffer(ctx: AudioContext, durationSec: number = 3.5): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Simular varias voces de público riendo en ráfagas rítmicas ("ja-ja-ja")
  const voices = 14;
  for (let v = 0; v < voices; v++) {
    const startOffset = Math.random() * 0.55;
    const syllables = 5 + Math.floor(Math.random() * 5);
    const rate = 4.8 + Math.random() * 2.2; // sílabas por segundo
    const basePitch = 165 + Math.random() * 260;
    const pan = (Math.random() * 2 - 1) * 0.75;
    const gL = (0.15 + Math.random() * 0.08) * Math.cos(((pan + 1) * Math.PI) / 4);
    const gR = (0.15 + Math.random() * 0.08) * Math.sin(((pan + 1) * Math.PI) / 4);

    for (let k = 0; k < syllables; k++) {
      const sylStart = startOffset + k / rate;
      const sylDur = 0.11 + Math.random() * 0.04;
      const startSample = Math.floor(sylStart * sampleRate);
      const sylSamples = Math.floor(sylDur * sampleRate);
      const fadeOutVoice = 1 - k / (syllables + 1.5);
      let phase = 0;
      let lp = 0;

      for (let s = 0; s < sylSamples && startSample + s < totalSamples; s++) {
        const p = s / sylSamples;
        const env = Math.sin(Math.PI * p) * fadeOutVoice;
        const f = basePitch * (1 - 0.15 * p);
        phase += (2 * Math.PI * f) / sampleRate;
        const glottal = Math.sin(phase) * 0.6 + Math.sin(phase * 2.02) * 0.3 + (Math.random() * 2 - 1) * 0.25;
        lp = 0.6 * lp + 0.4 * glottal;
        const idx = startSample + s;
        left[idx] = (left[idx] ?? 0) + lp * env * gL;
        right[idx] = (right[idx] ?? 0) + lp * env * gR;
      }
    }
  }

  for (let i = 0; i < totalSamples; i++) {
    left[i] = Math.tanh((left[i] ?? 0) * 1.4) * 0.85;
    right[i] = Math.tanh((right[i] ?? 0) * 1.4) * 0.85;
  }

  return buffer;
}

function playCachedEffect(
  key: string,
  durationMs: number,
  volumeScalar: number,
  builder: (ctx: AudioContext, durationSec: number) => AudioBuffer,
  onComplete?: () => void,
): void {
  stopAllEffects();

  try {
    const ctx = getAudioContext();
    const durationSec = Math.max(1, durationMs / 1000);
    const cacheKey = `${key}_${durationSec.toFixed(1)}`;
    let buf = bufferCache.get(cacheKey);
    if (!buf) {
      buf = builder(ctx, durationSec);
      bufferCache.set(cacheKey, buf);
    }

    const source = ctx.createBufferSource();
    source.buffer = buf;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volumeScalar)), ctx.currentTime);

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    activeSource = source;
    activeGain = gainNode;
    source.start(0);

    activeTimeout = setTimeout(() => {
      stopAllEffects();
      if (onComplete) onComplete();
    }, durationMs);
  } catch (err) {
    console.warn(`[Efectos] No se pudo reproducir efecto ${key}:`, err);
    if (onComplete) onComplete();
  }
}

export function playApplause(
  durationMs: number = 6000,
  volumeScalar: number = 0.85,
  onComplete?: () => void,
): void {
  playCachedEffect('applause', durationMs, volumeScalar, buildApplauseBuffer, onComplete);
}

export function playCheers(volumeScalar: number = 0.85, onComplete?: () => void): void {
  playCachedEffect('cheers', 4500, volumeScalar, buildCheersBuffer, onComplete);
}

export function playLaughter(volumeScalar: number = 0.85, onComplete?: () => void): void {
  playCachedEffect('laughter', 3500, volumeScalar, buildLaughterBuffer, onComplete);
}

export function stopAllEffects(): void {
  if (activeTimeout) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  if (activeSource) {
    try {
      activeSource.stop();
      activeSource.disconnect();
    } catch {
      // Ignorar si ya había finalizado
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

export const stopApplause = stopAllEffects;
