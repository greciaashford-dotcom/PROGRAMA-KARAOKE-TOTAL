import React, { useEffect, useState } from 'react';
import {
  Search,
  Settings,
  Zap,
  Play,
  XCircle,
  Sliders,
  BookmarkCheck,
  Volume2,
  VolumeX,
  Minus,
  Plus,
} from 'lucide-react';
import { QueueItemDTO } from '@karaoke/contracts';
import { audioMixerEngine, MixerMeterSnapshot } from '../utils/audio-mixer-engine.js';
import { cleanDisplayTitle, formatCountdownMMSS } from '../utils/title-cleaner.js';

export interface RightControlColumnProps {
  onOpenCatalogModal: () => void;
  onOpenSettingsModal: () => void;
  autoKaraokeEnabled: boolean;
  autoKaraokeDelaySec: number;
  countdownRemainingSec: number | null;
  nextQueuedItem: QueueItemDTO | null;
  onToggleAutoKaraoke: (enabled: boolean) => void;
  onChangeAutoKaraokeDelay: (sec: number) => void;
  onStartCountdownNow: () => Promise<void>;
  onCancelCountdown: () => void;
  // Mezclador en miniatura
  masterVolume: number;
  masterMuted: boolean;
  karaokeVolume: number;
  karaokeMuted: boolean;
  ambientVolume: number;
  ambientMuted: boolean;
  applauseVolume: number;
  isCurrentSongMemorized: boolean;
  currentSongMemorizedVol: number | null;
  memorizedCount: number;
  onChangeMasterVolume: (vol: number) => void;
  onToggleMasterMute: () => void;
  onChangeApplauseVolume: (vol: number) => void;
}

export const RightControlColumn: React.FC<RightControlColumnProps> = ({
  onOpenCatalogModal,
  onOpenSettingsModal,
  autoKaraokeEnabled,
  autoKaraokeDelaySec,
  countdownRemainingSec,
  nextQueuedItem,
  onToggleAutoKaraoke,
  onChangeAutoKaraokeDelay,
  onStartCountdownNow,
  onCancelCountdown,
  masterVolume,
  masterMuted,
  karaokeVolume,
  karaokeMuted,
  ambientVolume,
  ambientMuted,
  applauseVolume,
  isCurrentSongMemorized,
  currentSongMemorizedVol,
  memorizedCount,
  onChangeMasterVolume,
  onToggleMasterMute,
  onChangeApplauseVolume,
}) => {
  const [meters, setMeters] = useState<MixerMeterSnapshot>({
    karaoke: { left: 0, right: 0 },
    ambient: { left: 0, right: 0 },
    master: { left: 0, right: 0 },
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setMeters(audioMixerEngine.sampleLevels());
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  const masterVuPct = Math.max(meters.master.left, meters.master.right);
  const karaokeVuPct = Math.max(meters.karaoke.left, meters.karaoke.right);
  const ambientVuPct = Math.max(meters.ambient.left, meters.ambient.right);

  return (
    <section className="katakana-panel" aria-label="Acciones, Automatización y Mezclador">
      <div className="katakana-panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={20} />
          CONTROL Y AUTO KARAOKE
        </span>
      </div>

      <div className="katakana-panel-body" style={{ gap: '10px' }}>
        {/* Botón grande y destacado: Abrir Catálogo / Buscar Canción */}
        <button
          type="button"
          className="btn btn-surf"
          onClick={onOpenCatalogModal}
          style={{
            minHeight: '54px',
            fontSize: '18px',
            fontWeight: 900,
            width: '100%',
            justifyContent: 'center',
            padding: '8px 14px',
          }}
          title="Abrir Catálogo de Canciones en ventana emergente (F2 / Ctrl+B)"
        >
          <Search size={22} strokeWidth={2.6} />
          <span>Abrir Catálogo / Buscar</span>
        </button>

        {/* Tarjeta de Automatización: Auto Karaoke + Cuenta regresiva */}
        <div
          className="katakana-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: autoKaraokeEnabled ? 'rgba(0, 194, 181, 0.14)' : 'var(--bg-surface-raised)',
            border: autoKaraokeEnabled ? '2px solid var(--ink-piano)' : '1.5px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '17px', fontWeight: 800 }}>Auto Karaoke (Solo Cola)</span>
            <button
              type="button"
              className={`btn btn-compact ${autoKaraokeEnabled ? 'btn-surf' : ''}`}
              onClick={() => onToggleAutoKaraoke(!autoKaraokeEnabled)}
              style={{ minWidth: '88px', fontWeight: 900 }}
            >
              {autoKaraokeEnabled ? '● ACTIVO' : 'APAGADO'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 700 }}>Siguiente en:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onChangeAutoKaraokeDelay(Math.max(0, autoKaraokeDelaySec - 5))}
                style={{ minWidth: '34px', padding: 0 }}
                title="Restar 5 segundos"
              >
                <Minus size={15} />
              </button>
              <input
                type="number"
                className="form-input"
                min={0}
                max={120}
                value={autoKaraokeDelaySec}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(120, Number(e.target.value) || 0));
                  onChangeAutoKaraokeDelay(n);
                }}
                style={{
                  width: '66px',
                  minHeight: '36px',
                  height: '36px',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '16px',
                  padding: '2px 4px',
                }}
              />
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => onChangeAutoKaraokeDelay(Math.min(120, autoKaraokeDelaySec + 5))}
                style={{ minWidth: '34px', padding: 0 }}
                title="Sumar 5 segundos"
              >
                <Plus size={15} />
              </button>
              <span style={{ fontSize: '15px', fontWeight: 700 }}>seg</span>
            </div>
          </div>

          {/* Bloque activo cuando corre la cuenta regresiva */}
          {countdownRemainingSec !== null && nextQueuedItem && (
            <div
              style={{
                backgroundColor: 'var(--ink-piano)',
                color: '#f6efe0',
                borderRadius: '10px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                border: '2px solid var(--accent-surf)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#F5C76B' }}>
                  PRÓXIMO CANTANTE
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '22px',
                    fontWeight: 900,
                    color: '#FF9E2C',
                  }}
                >
                  {formatCountdownMMSS(countdownRemainingSec)}
                </span>
              </div>

              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {nextQueuedItem.singer?.displayName}
              </div>
              <div
                style={{
                  fontSize: '15px',
                  color: 'var(--accent-surf)',
                  fontWeight: 700,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {cleanDisplayTitle(nextQueuedItem.song?.title)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '2px' }}>
                <button
                  type="button"
                  className="btn btn-surf btn-compact"
                  onClick={onStartCountdownNow}
                >
                  <Play size={16} fill="currentColor" />
                  Iniciar ya
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-compact"
                  onClick={onCancelCountdown}
                >
                  <XCircle size={16} />
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Botón Configurar */}
        <button
          type="button"
          className="btn btn-dark"
          onClick={onOpenSettingsModal}
          style={{ width: '100%', minHeight: '44px', fontSize: '16px' }}
        >
          <Settings size={19} />
          Configurar (Fondo, Carpetas y Opciones)
        </button>

        {/* Mezclador de Audio en Miniatura */}
        <div
          className="katakana-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '7px',
            marginTop: 'auto',
            border: '2px solid var(--ink-piano)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: 800 }}>
              <Sliders size={16} />
              MEZCLADOR MINIATURA
            </span>
            <span
              className="pill"
              style={{
                backgroundColor: isCurrentSongMemorized ? 'var(--accent-surf)' : 'var(--bg-surface-warm)',
                color: 'var(--ink-piano)',
                border: '1px solid var(--ink-piano)',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={`${memorizedCount} canción(es) con volumen memorizado`}
            >
              <BookmarkCheck size={13} />
              {isCurrentSongMemorized && currentSongMemorizedVol !== null
                ? `MEM: ${currentSongMemorizedVol}%`
                : `${memorizedCount} MEM.`}
            </span>
          </div>

          {/* Master + Mute + VU */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={onToggleMasterMute}
              style={{
                background: masterMuted ? 'var(--status-error)' : 'var(--ink-piano)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                width: '30px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Silenciar Master General"
            >
              {masterMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <span style={{ fontSize: '14px', fontWeight: 800, minWidth: '64px' }}>MASTER</span>
            <input
              type="range"
              min={0}
              max={100}
              value={masterMuted ? 0 : masterVolume}
              onChange={(e) => onChangeMasterVolume(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 800, minWidth: '40px', textAlign: 'right' }}>
              {masterMuted ? 'MUTE' : `${masterVolume}%`}
            </span>
          </div>

          {/* Aplausos / Efectos memorizado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, minWidth: '100px' }}>APLAUSOS</span>
            <input
              type="range"
              min={0}
              max={100}
              value={applauseVolume}
              onChange={(e) => onChangeApplauseVolume(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 800, minWidth: '40px', textAlign: 'right' }}>
              {applauseVolume}%
            </span>
          </div>

          {/* Mini indicadores de nivel y VU reales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '12px', fontWeight: 800 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>KAR</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{karaokeMuted ? 'MUTE' : `${karaokeVolume}%`}</span>
              </div>
              <div style={{ height: '7px', backgroundColor: '#151515', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${karaokeVuPct}%`, height: '100%', backgroundColor: 'var(--accent-surf)', transition: 'width 60ms linear' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>MP3</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{ambientMuted ? 'MUTE' : `${ambientVolume}%`}</span>
              </div>
              <div style={{ height: '7px', backgroundColor: '#151515', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${ambientVuPct}%`, height: '100%', backgroundColor: '#0284c7', transition: 'width 60ms linear' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>SALIDA</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{masterVuPct}%</span>
              </div>
              <div style={{ height: '7px', backgroundColor: '#151515', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${masterVuPct}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 60ms linear' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
