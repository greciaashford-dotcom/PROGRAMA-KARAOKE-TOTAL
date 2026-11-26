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
import { Btn09 } from './ui/button-hover.js';

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

  const displayedTimerSec =
    countdownRemainingSec !== null ? countdownRemainingSec : autoKaraokeDelaySec;

  return (
    <section className="katakana-panel" aria-label="Acciones, Automatización y Mezclador">
      <div className="katakana-panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={19} color="#F3D285" />
          CONTROL Y AUTO KARAOKE
        </span>
      </div>

      <div className="katakana-panel-body" style={{ gap: '8px' }}>
        {/* Botón Hero Cristal Turquesa: Abrir Catálogo / Buscar Canción */}
        <Btn09
          type="button"
          variant="surf"
          className="btn-catalog-hero"
          onClick={onOpenCatalogModal}
          style={{
            minHeight: '50px',
            fontSize: '18px',
            fontWeight: 900,
            width: '100%',
            justifyContent: 'center',
            padding: '8px 14px',
          }}
          title="Abrir Catálogo de Canciones en ventana emergente (F2 / Ctrl+B)"
        >
          <Search size={22} strokeWidth={2.7} />
          <span>Abrir Catálogo / Buscar</span>
        </Btn09>

        {/* Tarjeta de Automatización: Auto Karaoke (Solo Cola) + Próximo Cantante */}
        <div
          className="katakana-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px',
            border: autoKaraokeEnabled
              ? '1.5px solid rgba(201, 160, 80, 0.7)'
              : '1.5px solid rgba(201, 160, 80, 0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#F3EFE6' }}>
              Auto Karaoke (Solo Cola)
            </span>
            <button
              type="button"
              className={`btn btn-compact ${autoKaraokeEnabled ? 'btn-surf' : 'btn-dark'}`}
              onClick={() => onToggleAutoKaraoke(!autoKaraokeEnabled)}
              style={{
                minWidth: '88px',
                minHeight: '30px',
                borderRadius: '999px',
                fontWeight: 900,
                fontSize: '13px',
              }}
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
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#D4DCE8' }}>Siguiente en:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                type="button"
                className="btn btn-dark btn-compact"
                onClick={() => onChangeAutoKaraokeDelay(Math.max(0, autoKaraokeDelaySec - 5))}
                style={{ minWidth: '34px', minHeight: '32px', height: '32px', padding: 0 }}
                title="Restar 5 segundos"
              >
                <Minus size={15} />
              </button>
              <input
                type="number"
                className="katakana-value-box"
                min={0}
                max={120}
                value={autoKaraokeDelaySec}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(120, Number(e.target.value) || 0));
                  onChangeAutoKaraokeDelay(n);
                }}
                style={{
                  width: '58px',
                  minHeight: '32px',
                  height: '32px',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '16px',
                  padding: '2px 4px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                className="btn btn-dark btn-compact"
                onClick={() => onChangeAutoKaraokeDelay(Math.min(120, autoKaraokeDelaySec + 5))}
                style={{ minWidth: '34px', minHeight: '32px', height: '32px', padding: 0 }}
                title="Sumar 5 segundos"
              >
                <Plus size={15} />
              </button>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#D4DCE8' }}>seg</span>
            </div>
          </div>

          {/* Tarjeta interior con borde Cian brillante: PRÓXIMO CANTANTE */}
          {nextQueuedItem ? (
            <div
              style={{
                background:
                  'radial-gradient(circle at 85% 15%, rgba(0, 229, 209, 0.22) 0%, rgba(11, 17, 27, 0.96) 65%)',
                color: '#F3EFE6',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                border: '1.5px solid #26F2E2',
                boxShadow:
                  '0 0 14px rgba(0, 229, 209, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 900,
                    color: '#F3C66F',
                    letterSpacing: '0.04em',
                  }}
                >
                  {countdownRemainingSec !== null ? 'CONTEO EN PANTALLAS' : 'PRÓXIMO CANTANTE'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '21px',
                    fontWeight: 900,
                    color: '#FF9E2C',
                    textShadow: '0 0 10px rgba(255, 158, 44, 0.45)',
                  }}
                >
                  {formatCountdownMMSS(displayedTimerSec)}
                </span>
              </div>

              <div
                style={{
                  fontSize: '21px',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.15,
                }}
              >
                {nextQueuedItem.singer?.displayName || 'Cantante'}
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#26F2E2',
                  fontWeight: 800,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: '4px',
                }}
              >
                {cleanDisplayTitle(nextQueuedItem.song?.title)}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-surf btn-compact"
                  onClick={onStartCountdownNow}
                  style={{ minHeight: '36px', fontSize: '15px', fontWeight: 900 }}
                  title={
                    countdownRemainingSec !== null
                      ? 'Saltar el resto del conteo e iniciar el karaoke ya'
                      : 'Iniciar el conteo regresivo en pantallas para esta canción'
                  }
                >
                  <Play size={16} fill="currentColor" />
                  {countdownRemainingSec !== null ? 'Iniciar ya' : 'Lanzar'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-compact"
                  onClick={onCancelCountdown}
                  disabled={countdownRemainingSec === null}
                  style={{ minHeight: '36px', fontSize: '15px', fontWeight: 900 }}
                >
                  <XCircle size={16} />
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(11, 17, 27, 0.85)',
                color: '#95A3B8',
                borderRadius: '10px',
                padding: '10px',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 700,
                border: '1px solid rgba(38, 242, 226, 0.35)',
              }}
            >
              Sin próximo cantante en espera en la Cola.
            </div>
          )}
        </div>

        {/* Botón Configurar */}
        <Btn09
          type="button"
          variant="dark"
          onClick={onOpenSettingsModal}
          style={{ width: '100%', minHeight: '40px', fontSize: '15px' }}
        >
          <Settings size={18} color="#F3D285" />
          Configurar (Fondo, Carpetas y Opciones)
        </Btn09>

        {/* Mezclador de Audio en Miniatura */}
        <div
          className="katakana-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            marginTop: 'auto',
            padding: '7px 10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 800,
                color: '#F3D285',
              }}
            >
              <Sliders size={14} />
              MEZCLADOR MINIATURA
            </span>
            <span
              className="pill"
              style={{
                backgroundColor: isCurrentSongMemorized ? '#00D8C8' : 'rgba(255,255,255,0.08)',
                color: isCurrentSongMemorized ? '#071F1D' : '#D4DCE8',
                border: '1px solid rgba(201, 160, 80, 0.45)',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={`${memorizedCount} canción(es) con volumen memorizado`}
            >
              <BookmarkCheck size={12} />
              {isCurrentSongMemorized && currentSongMemorizedVol !== null
                ? `MEM: ${currentSongMemorizedVol}%`
                : `${memorizedCount} MEM.`}
            </span>
          </div>

          {/* Master + Mute */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={onToggleMasterMute}
              style={{
                background: masterMuted ? '#DC2626' : '#1E2736',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                width: '26px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Silenciar Master General"
            >
              {masterMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
            <span style={{ fontSize: '12px', fontWeight: 800, minWidth: '54px', color: '#D4DCE8' }}>
              MASTER
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={masterMuted ? 0 : masterVolume}
              onChange={(e) => onChangeMasterVolume(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 800,
                minWidth: '38px',
                textAlign: 'right',
                color: '#F3EFE6',
              }}
            >
              {masterMuted ? 'MUTE' : `${masterVolume}%`}
            </span>
          </div>

          {/* Aplausos / Efectos memorizado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, minWidth: '86px', color: '#D4DCE8' }}>
              APLAUSOS
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={applauseVolume}
              onChange={(e) => onChangeApplauseVolume(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 800,
                minWidth: '38px',
                textAlign: 'right',
                color: '#F3EFE6',
              }}
            >
              {applauseVolume}%
            </span>
          </div>

          {/* Mini indicadores de nivel y VU reales */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 800,
              color: '#D4DCE8',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>KAR</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {karaokeMuted ? 'MUTE' : `${karaokeVolume}%`}
                </span>
              </div>
              <div style={{ height: '5px', backgroundColor: '#0A0E15', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${karaokeVuPct}%`,
                    height: '100%',
                    backgroundColor: '#00E5D1',
                    transition: 'width 60ms linear',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>MP3</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {ambientMuted ? 'MUTE' : `${ambientVolume}%`}
                </span>
              </div>
              <div style={{ height: '5px', backgroundColor: '#0A0E15', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${ambientVuPct}%`,
                    height: '100%',
                    backgroundColor: '#38BDF8',
                    transition: 'width 60ms linear',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>SALIDA</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{masterVuPct}%</span>
              </div>
              <div style={{ height: '5px', backgroundColor: '#0A0E15', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${masterVuPct}%`,
                    height: '100%',
                    backgroundColor: '#10B981',
                    transition: 'width 60ms linear',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
