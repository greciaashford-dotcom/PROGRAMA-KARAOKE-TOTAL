/**
 * Motor de medición estéreo real (Web Audio API AnalyserNode L/R) y cálculo de ganancia/crossfade
 * para Karaoke Total — PRO STUDIO.
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

interface AttachedChannelNodes {
  element: HTMLMediaElement;
  source: MediaElementAudioSourceNode;
  splitter: ChannelSplitterNode;
  analyserL: AnalyserNode;
  analyserR: AnalyserNode;
  bufferL: Uint8Array<ArrayBuffer>;
  bufferR: Uint8Array<ArrayBuffer>;
}

class RealAudioMeterEngine {
  private ctx: AudioContext | null = null;
  private attachedMap = new WeakMap<HTMLMediaElement, AttachedChannelNodes>();
  private karaokeNodes: AttachedChannelNodes | null = null;
  private ambientNodes: AttachedChannelNodes | null = null;

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

  private attachElement(el: HTMLMediaElement): AttachedChannelNodes | null {
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

      // Salida directa al destino de audio del sistema y ramificación al analizador estéreo L/R
      source.connect(ctx.destination);
      source.connect(splitter);
      splitter.connect(analyserL, 0);
      splitter.connect(analyserR, 1);

      const nodes: AttachedChannelNodes = {
        element: el,
        source,
        splitter,
        analyserL,
        analyserR,
        bufferL: new Uint8Array(analyserL.fftSize),
        bufferR: new Uint8Array(analyserR.fftSize),
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
    this.karaokeNodes = this.attachElement(el);
  }

  public registerAmbientElement(el: HTMLAudioElement | null): void {
    if (!el) {
      this.ambientNodes = null;
      return;
    }
    this.ambientNodes = this.attachElement(el);
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
    // Combinación ponderada RMS + Peak para respuesta visual natural de vúmetro LED
    const composite = Math.min(1, rms * 2.15 + peak * 0.35);
    if (composite < 0.008) return 0;
    // Curva logarítmica suave hacia escala 0..100
    const scaled = Math.pow(composite, 0.62) * 100;
    return Math.max(0, Math.min(100, Math.round(scaled)));
  }

  private readNodeLevels(nodes: AttachedChannelNodes | null): StereoLevel {
    if (!nodes || nodes.element.paused || nodes.element.ended || nodes.element.muted || nodes.element.volume === 0) {
      return { left: 0, right: 0 };
    }
    const left = this.computeRmsLevel(nodes.analyserL, nodes.bufferL);
    const right = this.computeRmsLevel(nodes.analyserR, nodes.bufferR);
    // Si la pista es mono y el canal derecho viene vacío, espejar el izquierdo
    return {
      left,
      right: right === 0 && left > 0 ? left : right,
    };
  }

  public readLevels(masterMuted: boolean): MixerMeterSnapshot {
    const karaoke = this.readNodeLevels(this.karaokeNodes);
    const ambient = this.readNodeLevels(this.ambientNodes);

    if (masterMuted) {
      return {
        karaoke: { left: 0, right: 0 },
        ambient: { left: 0, right: 0 },
        master: { left: 0, right: 0 },
      };
    }

    const masterLeft = Math.min(
      100,
      Math.round(Math.sqrt(karaoke.left * karaoke.left + ambient.left * ambient.left)),
    );
    const masterRight = Math.min(
      100,
      Math.round(Math.sqrt(karaoke.right * karaoke.right + ambient.right * ambient.right)),
    );

    return {
      karaoke,
      ambient,
      master: { left: masterLeft, right: masterRight },
    };
  }
}

export const audioMixerEngine = new RealAudioMeterEngine();

/**
 * Convierte un porcentaje de fader (0..100%) a representación en decibelios (-∞ dB a +6.0 dB),
 * donde 80% equivale a 0.0 dB (ganancia unitaria nominal de consola DJ).
 */
export function volumePercentToDb(percent: number, muted: boolean = false): string {
  if (muted || percent <= 0) return '-∞ dB';
  if (percent >= 80) {
    const db = ((percent - 80) / 20) * 6;
    return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
  }
  // Entre 1% y 80% mapea de -36 dB a 0.0 dB
  const ratio = percent / 80;
  const db = 20 * Math.log10(ratio);
  return `${db.toFixed(1)} dB`;
}
