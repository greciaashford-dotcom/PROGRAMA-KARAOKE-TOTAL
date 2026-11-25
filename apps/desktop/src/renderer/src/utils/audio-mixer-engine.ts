/**
 * Motor de audio profesional para Katakana Karaoke:
 * - Pitch Shifter en tiempo real (-6 a +6 semitonos) sin alterar la velocidad mediante Web Audio API
 *   (algoritmo dual-delay overlap-add con bypass bit-transparente en 0 semitonos).
 * - Medición estéreo real (Web Audio API AnalyserNode L/R) para Karaoke, Ambiente MP3 y Master.
 */

export interface StereoLevel {
  left: number;  // 0 a 100
  right: number; // 0 a 100
}

export interface MixerMeterSnapshot {
  karaoke: StereoLevel;
  ambient: StereoLevel;
  master: StereoLevel;
}

interface PitchShifterGraph {
  input: GainNode;
  output: GainNode;
  dryGain: GainNode;
  wetGain: GainNode;
  mod1: AudioBufferSourceNode;
  mod2: AudioBufferSourceNode;
  mod3: AudioBufferSourceNode;
  mod4: AudioBufferSourceNode;
  fade1: AudioBufferSourceNode;
  fade2: AudioBufferSourceNode;
  modGain1: GainNode;
  modGain2: GainNode;
  modGain3: GainNode;
  modGain4: GainNode;
  setPitchSemitones: (semitones: number) => void;
}

interface AttachedChannelNodes {
  element: HTMLMediaElement;
  source: MediaElementAudioSourceNode;
  splitter: ChannelSplitterNode;
  analyserL: AnalyserNode;
  analyserR: AnalyserNode;
  bufferL: Uint8Array<ArrayBuffer>;
  bufferR: Uint8Array<ArrayBuffer>;
  pitchShifter?: PitchShifterGraph;
}

function createFadeBuffer(ctx: AudioContext, activeTime: number, fadeTime: number): AudioBuffer {
  const length1 = Math.floor(activeTime * ctx.sampleRate);
  const length2 = Math.floor((activeTime - 2 * fadeTime) * ctx.sampleRate);
  const length = length1 + length2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const p = buffer.getChannelData(0);

  const fadeLength = Math.max(1, Math.floor(fadeTime * ctx.sampleRate));
  const fadeIndex1 = fadeLength;
  const fadeIndex2 = length1 - fadeLength;

  for (let i = 0; i < length1; i++) {
    let value: number;
    if (i < fadeIndex1) {
      value = Math.sqrt(i / fadeLength);
    } else if (i >= fadeIndex2) {
      value = Math.sqrt(1 - (i - fadeIndex2) / fadeLength);
    } else {
      value = 1;
    }
    p[i] = value;
  }
  for (let i = length1; i < length; i++) {
    p[i] = 0;
  }
  return buffer;
}

function createDelayTimeBuffer(
  ctx: AudioContext,
  activeTime: number,
  fadeTime: number,
  shiftUp: boolean,
): AudioBuffer {
  const length1 = Math.floor(activeTime * ctx.sampleRate);
  const length2 = Math.floor((activeTime - 2 * fadeTime) * ctx.sampleRate);
  const length = length1 + length2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const p = buffer.getChannelData(0);

  for (let i = 0; i < length1; i++) {
    p[i] = shiftUp ? (length1 - i) / length1 : i / length1;
  }
  for (let i = length1; i < length; i++) {
    p[i] = 0;
  }
  return buffer;
}

function createPitchShifterGraph(ctx: AudioContext): PitchShifterGraph {
  const delayTime = 0.085;
  const fadeTime = 0.0425;
  const bufferTime = 0.085;

  const input = ctx.createGain();
  const output = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  dryGain.gain.value = 1;
  wetGain.gain.value = 0;

  // Ruta directa bit-transparente cuando semitonos === 0
  input.connect(dryGain);
  dryGain.connect(output);

  // Ruta granular dual-delay (Jungle Pitch Shifter) para -6..+6 semitonos sin cambiar velocidad
  const mod1 = ctx.createBufferSource();
  const mod2 = ctx.createBufferSource();
  const mod3 = ctx.createBufferSource();
  const mod4 = ctx.createBufferSource();
  const shiftDownBuf = createDelayTimeBuffer(ctx, bufferTime, fadeTime, false);
  const shiftUpBuf = createDelayTimeBuffer(ctx, bufferTime, fadeTime, true);

  mod1.buffer = shiftDownBuf;
  mod2.buffer = shiftDownBuf;
  mod3.buffer = shiftUpBuf;
  mod4.buffer = shiftUpBuf;
  mod1.loop = true;
  mod2.loop = true;
  mod3.loop = true;
  mod4.loop = true;

  const mod1Gain = ctx.createGain();
  const mod2Gain = ctx.createGain();
  const mod3Gain = ctx.createGain();
  const mod4Gain = ctx.createGain();
  mod3Gain.gain.value = 0;
  mod4Gain.gain.value = 0;

  const modGain1 = ctx.createGain();
  const modGain2 = ctx.createGain();
  const modGain3 = ctx.createGain();
  const modGain4 = ctx.createGain();

  const delay1 = ctx.createDelay(1);
  const delay2 = ctx.createDelay(1);

  mod1.connect(mod1Gain);
  mod2.connect(mod2Gain);
  mod3.connect(mod3Gain);
  mod4.connect(mod4Gain);

  mod1Gain.connect(modGain1);
  mod2Gain.connect(modGain2);
  mod3Gain.connect(modGain3);
  mod4Gain.connect(modGain4);

  modGain1.connect(delay1.delayTime);
  modGain2.connect(delay2.delayTime);
  modGain3.connect(delay1.delayTime);
  modGain4.connect(delay2.delayTime);

  const fade1 = ctx.createBufferSource();
  const fade2 = ctx.createBufferSource();
  const fadeBuf = createFadeBuffer(ctx, bufferTime, fadeTime);
  fade1.buffer = fadeBuf;
  fade2.buffer = fadeBuf;
  fade1.loop = true;
  fade2.loop = true;

  const mix1 = ctx.createGain();
  const mix2 = ctx.createGain();
  mix1.gain.value = 0;
  mix2.gain.value = 0;

  fade1.connect(mix1.gain);
  fade2.connect(mix2.gain);

  input.connect(delay1);
  input.connect(delay2);
  delay1.connect(mix1);
  delay2.connect(mix2);
  mix1.connect(wetGain);
  mix2.connect(wetGain);
  wetGain.connect(output);

  const t = ctx.currentTime + 0.02;
  const t2 = t + bufferTime - fadeTime;
  mod1.start(t);
  mod2.start(t2);
  mod3.start(t);
  mod4.start(t2);
  fade1.start(t);
  fade2.start(t2);

  const setDelayAmount = (val: number) => {
    modGain1.gain.setTargetAtTime(0.5 * val, ctx.currentTime, 0.01);
    modGain2.gain.setTargetAtTime(0.5 * val, ctx.currentTime, 0.01);
    modGain3.gain.setTargetAtTime(0.5 * val, ctx.currentTime, 0.01);
    modGain4.gain.setTargetAtTime(0.5 * val, ctx.currentTime, 0.01);
  };

  setDelayAmount(delayTime);

  const setPitchSemitones = (semitones: number) => {
    const clamped = Math.max(-6, Math.min(6, Math.round(semitones)));
    const now = ctx.currentTime;
    if (clamped === 0) {
      dryGain.gain.setTargetAtTime(1, now, 0.015);
      wetGain.gain.setTargetAtTime(0, now, 0.015);
      return;
    }

    dryGain.gain.setTargetAtTime(0, now, 0.015);
    wetGain.gain.setTargetAtTime(1, now, 0.015);

    const ratio = Math.pow(2, clamped / 12);
    const offset = ratio - 1;
    if (offset > 0) {
      // Subir tono
      mod1Gain.gain.setTargetAtTime(0, now, 0.01);
      mod2Gain.gain.setTargetAtTime(0, now, 0.01);
      mod3Gain.gain.setTargetAtTime(1, now, 0.01);
      mod4Gain.gain.setTargetAtTime(1, now, 0.01);
      setDelayAmount(delayTime * offset * 2);
    } else {
      // Bajar tono
      mod1Gain.gain.setTargetAtTime(1, now, 0.01);
      mod2Gain.gain.setTargetAtTime(1, now, 0.01);
      mod3Gain.gain.setTargetAtTime(0, now, 0.01);
      mod4Gain.gain.setTargetAtTime(0, now, 0.01);
      setDelayAmount(delayTime * Math.abs(offset) * 2);
    }
  };

  return {
    input,
    output,
    dryGain,
    wetGain,
    mod1,
    mod2,
    mod3,
    mod4,
    fade1,
    fade2,
    modGain1,
    modGain2,
    modGain3,
    modGain4,
    setPitchSemitones,
  };
}

class RealAudioMeterEngine {
  private ctx: AudioContext | null = null;
  private attachedMap = new WeakMap<HTMLMediaElement, AttachedChannelNodes>();
  private karaokeNodes: AttachedChannelNodes | null = null;
  private ambientNodes: AttachedChannelNodes | null = null;
  private currentKaraokeSemitones = 0;

  private ensureContext(): AudioContext | null {
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private attachElement(el: HTMLMediaElement, withPitchShifter: boolean): AttachedChannelNodes | null {
    const existing = this.attachedMap.get(el);
    if (existing) {
      this.ensureContext();
      return existing;
    }

    const ctx = this.ensureContext();
    if (!ctx) return null;

    try {
      const source = ctx.createMediaElementSource(el);
      const splitter = ctx.createChannelSplitter(2);
      const analyserL = ctx.createAnalyser();
      const analyserR = ctx.createAnalyser();

      analyserL.fftSize = 256;
      analyserL.smoothingTimeConstant = 0.6;
      analyserR.fftSize = 256;
      analyserR.smoothingTimeConstant = 0.6;

      let pitchShifter: PitchShifterGraph | undefined;

      if (withPitchShifter) {
        pitchShifter = createPitchShifterGraph(ctx);
        pitchShifter.setPitchSemitones(this.currentKaraokeSemitones);
        source.connect(pitchShifter.input);
        pitchShifter.output.connect(ctx.destination);
        pitchShifter.output.connect(splitter);
      } else {
        source.connect(ctx.destination);
        source.connect(splitter);
      }

      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);

      const nodes: AttachedChannelNodes = {
        element: el,
        source,
        splitter,
        analyserL,
        analyserR,
        bufferL: new Uint8Array(new ArrayBuffer(analyserL.fftSize)),
        bufferR: new Uint8Array(new ArrayBuffer(analyserR.fftSize)),
        pitchShifter,
      };

      this.attachedMap.set(el, nodes);
      return nodes;
    } catch (err) {
      console.warn('[AudioMixerEngine] No se pudo enlazar elemento multimedia a Web Audio:', err);
      return null;
    }
  }

  public registerKaraokeElement(el: HTMLVideoElement | null): void {
    if (!el) {
      this.karaokeNodes = null;
      return;
    }
    this.karaokeNodes = this.attachElement(el, true);
    this.karaokeNodes?.pitchShifter?.setPitchSemitones(this.currentKaraokeSemitones);
  }

  public registerAmbientElement(el: HTMLAudioElement | null): void {
    if (!el) {
      this.ambientNodes = null;
      return;
    }
    this.ambientNodes = this.attachElement(el, false);
  }

  public setKaraokePitchSemitones(semitones: number): void {
    const clamped = Math.max(-6, Math.min(6, Math.round(semitones)));
    this.currentKaraokeSemitones = clamped;
    this.ensureContext();
    this.karaokeNodes?.pitchShifter?.setPitchSemitones(clamped);
  }

  private computeRmsLevel(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
    analyser.getByteTimeDomainData(buffer);
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const normalized = ((buffer[i] ?? 128) - 128) / 128;
      const abs = Math.abs(normalized);
      if (abs > peak) peak = abs;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / buffer.length);
    const composite = Math.min(1, rms * 2.15 + peak * 0.35);
    if (composite < 0.008) return 0;
    const scaled = Math.pow(composite, 0.62) * 100;
    return Math.max(0, Math.min(100, Math.round(scaled)));
  }

  private readNodeLevels(nodes: AttachedChannelNodes | null): StereoLevel {
    if (
      !nodes ||
      nodes.element.paused ||
      nodes.element.ended ||
      nodes.element.muted ||
      nodes.element.volume === 0
    ) {
      return { left: 0, right: 0 };
    }
    const left = this.computeRmsLevel(nodes.analyserL, nodes.bufferL);
    const right = this.computeRmsLevel(nodes.analyserR, nodes.bufferR);
    return {
      left,
      right: right === 0 && left > 0 ? left : right,
    };
  }

  public sampleLevels(): MixerMeterSnapshot {
    const karaoke = this.readNodeLevels(this.karaokeNodes);
    const ambient = this.readNodeLevels(this.ambientNodes);
    const master: StereoLevel = {
      left: Math.min(100, Math.round(Math.hypot(karaoke.left, ambient.left))),
      right: Math.min(100, Math.round(Math.hypot(karaoke.right, ambient.right))),
    };
    return { karaoke, ambient, master };
  }

  public readLevels(masterMuted?: boolean): MixerMeterSnapshot {
    const snap = this.sampleLevels();
    if (masterMuted) {
      return {
        karaoke: snap.karaoke,
        ambient: snap.ambient,
        master: { left: 0, right: 0 },
      };
    }
    return snap;
  }
}

export const audioMixerEngine = new RealAudioMeterEngine();

/**
 * Convierte un volumen porcentual (0..100) a lectura profesional en decibelios (+6 dB a -∞ dB).
 */
export function volumePercentToDb(percent: number, muted: boolean): string {
  if (muted || percent <= 0) return '-∞ dB';
  if (percent >= 85) {
    const db = ((percent - 85) / 15) * 6;
    return `+${db.toFixed(1)} dB`;
  }
  const db = 20 * Math.log10(percent / 85);
  return `${Math.max(-48, db).toFixed(1)} dB`;
}
