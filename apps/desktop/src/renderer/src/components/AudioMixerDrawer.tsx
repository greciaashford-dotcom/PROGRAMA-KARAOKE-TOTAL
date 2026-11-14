import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Sliders,
  Mic,
  Music,
  BarChart2,
  VolumeX,
  Volume2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  audioMixerEngine,
  MixerMeterSnapshot,
  StereoLevel,
  volumePercentToDb,
} from '../utils/audio-mixer-engine.js';

interface AudioMixerDrawerProps {
  expanded: boolean;
  onToggleExpanded: (nextExpanded: boolean) => void;
  karaokeVolume: number;
  ambientVolume: number;
  masterVolume: number;
  karaokeMuted: boolean;
  ambientMuted: boolean;
  masterMuted: boolean;
  crossfadeEnabled: boolean;
  crossfadeDurationSec: number;
  isCrossfading?: boolean;
  onChangeKaraokeVolume: (vol: number) => void;
  onChangeAmbientVolume: (vol: number) => void;
  onChangeMasterVolume: (vol: number) => void;
  onToggleKaraokeMute: () => void;
  onToggleAmbientMute: () => void;
  onToggleMasterMute: () => void;
  onToggleCrossfade: (enabled: boolean) => void;
  onChangeCrossfadeDuration: (sec: number) => void;
}

const DB_LABELS = ['+6 dB', '0 dB', '-6 dB', '-12 dB', '-18 dB', '-24 dB', '-∞'];
const LED_SEGMENTS = 12;

interface ChannelStripProps {
  title: string;
  accentColor: string;
  glowColor: string;
  borderColor: string;
  icon: React.ReactNode;
  volume: number;
  muted: boolean;
  levels: StereoLevel;
  onChangeVolume: (vol: number) => void;
  onToggleMute: () => void;
}

const VerticalFaderChannel: React.FC<ChannelStripProps> = ({
  title,
  accentColor,
  glowColor,
  borderColor,
  icon,
  volume,
  muted,
  levels,
  onChangeVolume,
  onToggleMute,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateFromClientY = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const relY = clientY - rect.top;
      const ratio = 1 - Math.max(0, Math.min(1, relY / rect.height));
      onChangeVolume(Math.round(ratio * 100));
    },
    [onChangeVolume],
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      updateFromClientY(e.clientY);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, updateFromClientY]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.deltaY < 0 ? 3 : -3;
    onChangeVolume(Math.max(0, Math.min(100, volume + step)));
  };

  const renderVuColumn = (level: number, label: string) => {
    const activeCount = muted ? 0 : Math.round((level / 100) * LED_SEGMENTS);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '2px',
            padding: '4px 3px',
            backgroundColor: '#07090e',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.06)',
            height: '116px',
            justifyContent: 'space-between',
          }}
        >
          {Array.from({ length: LED_SEGMENTS }).map((_, idx) => {
            const isLit = idx < activeCount;
            let segColor = '#10b981'; // Verde (0..7)
            if (idx >= 10) {
              segColor = '#ef4444'; // Rojo pico (10..11)
            } else if (idx >= 8) {
              segColor = '#f59e0b'; // Ámbar (8..9)
            }
            return (
              <div
                key={idx}
                style={{
                  width: '13px',
                  height: '6px',
                  borderRadius: '1.5px',
                  backgroundColor: isLit ? segColor : 'rgba(255,255,255,0.06)',
                  boxShadow: isLit ? `0 0 6px ${segColor}` : 'none',
                  transition: 'background-color 60ms linear',
                }}
              />
            );
          })}
        </div>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {label}
        </span>
      </div>
    );
  };

  return (
    <div
      onWheel={handleWheel}
      style={{
        backgroundColor: '#111621',
        border: `1px solid ${borderColor}`,
        boxShadow: `inset 0 0 18px rgba(0,0,0,0.5), 0 0 12px ${glowColor}`,
        borderRadius: '10px',
        padding: '10px 14px',
        display: 'grid',
        gridTemplateColumns: '1.15fr 1fr auto',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0,
      }}
    >
      {/* Columna Izquierda: Título, Porcentaje, dB y Botón MUTE */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {icon}
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              color: accentColor,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </span>
        </div>

        <div>
          <div
            style={{
              fontSize: '26px',
              fontWeight: 900,
              lineHeight: 1.05,
              color: muted ? 'var(--status-error)' : accentColor,
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.5px',
            }}
          >
            {muted ? 'MUTE' : `${volume} %`}
          </div>
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              marginTop: '2px',
            }}
          >
            {volumePercentToDb(volume, muted)}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          className="btn"
          title={muted ? `Reactivar audio de ${title}` : `Silenciar canal ${title}`}
          style={{
            height: '28px',
            minHeight: '28px',
            padding: '0 10px',
            fontSize: '11px',
            fontWeight: 800,
            gap: '5px',
            alignSelf: 'flex-start',
            backgroundColor: muted ? 'rgba(239, 68, 68, 0.22)' : '#181f2e',
            borderColor: muted ? '#ef4444' : 'rgba(255,255,255,0.12)',
            color: muted ? '#fca5a5' : 'var(--text-secondary)',
          }}
        >
          {muted ? <VolumeX size={13} color="#ef4444" /> : <Volume2 size={13} />}
          <span>MUTE</span>
        </button>
      </div>

      {/* Columna Central: Fader Vertical Metálico + Escala graduada en dB */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '132px' }}>
        {/* Pista del Fader */}
        <div
          ref={trackRef}
          onMouseDown={(e) => {
            setIsDragging(true);
            updateFromClientY(e.clientY);
          }}
          role="slider"
          aria-label={`Fader de volumen ${title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={volume}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              onChangeVolume(Math.min(100, volume + 2));
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              onChangeVolume(Math.max(0, volume - 2));
            }
          }}
          style={{
            position: 'relative',
            width: '28px',
            height: '118px',
            cursor: 'ns-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          }}
        >
          {/* Ranura central oscura */}
          <div
            style={{
              width: '8px',
              height: '100%',
              backgroundColor: '#07090e',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.08)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Relleno luminoso del fader */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${muted ? 0 : volume}%`,
                background: accentColor,
                boxShadow: `0 0 10px ${accentColor}`,
                borderRadius: '999px',
                transition: isDragging ? 'none' : 'height 80ms ease-out',
              }}
            />
          </div>

          {/* Capuchón metálico deslizante tipo consola DJ */}
          <div
            style={{
              position: 'absolute',
              bottom: `calc(${volume}% - 10px)`,
              left: '0',
              width: '28px',
              height: '20px',
              borderRadius: '4px',
              background: 'linear-gradient(180deg, #e2e8f0 0%, #94a3b8 45%, #475569 55%, #cbd5e1 100%)',
              border: '1px solid #1e293b',
              boxShadow: '0 3px 8px rgba(0,0,0,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: isDragging ? 'none' : 'bottom 80ms ease-out',
              pointerEvents: 'none',
            }}
          >
            {/* Línea indicadora central grabada en el capuchón */}
            <div
              style={{
                width: '18px',
                height: '2px',
                backgroundColor: accentColor,
                boxShadow: `0 0 4px ${accentColor}`,
              }}
            />
          </div>
        </div>

        {/* Escala graduada en decibelios */}
        <div
          style={{
            height: '116px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            userSelect: 'none',
          }}
        >
          {DB_LABELS.map((lbl) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '5px', height: '1px', backgroundColor: 'rgba(255,255,255,0.18)' }} />
              <span>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Columna Derecha: Medidores VU Estéreo L y R */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
        {renderVuColumn(levels.left, 'L')}
        {renderVuColumn(levels.right, 'R')}
      </div>
    </div>
  );
};

export const AudioMixerDrawer: React.FC<AudioMixerDrawerProps> = ({
  expanded,
  onToggleExpanded,
  karaokeVolume,
  ambientVolume,
  masterVolume,
  karaokeMuted,
  ambientMuted,
  masterMuted,
  crossfadeEnabled,
  crossfadeDurationSec,
  isCrossfading = false,
  onChangeKaraokeVolume,
  onChangeAmbientVolume,
  onChangeMasterVolume,
  onToggleKaraokeMute,
  onToggleAmbientMute,
  onToggleMasterMute,
  onToggleCrossfade,
  onChangeCrossfadeDuration,
}) => {
  const [levels, setLevels] = useState<MixerMeterSnapshot>({
    karaoke: { left: 0, right: 0 },
    ambient: { left: 0, right: 0 },
    master: { left: 0, right: 0 },
  });

  // Muestreo en tiempo real del motor Web Audio cuando el mezclador está visible
  useEffect(() => {
    if (!expanded) return;
    const interval = setInterval(() => {
      const snap = audioMixerEngine.readLevels(masterMuted);
      setLevels(snap);
    }, 55);
    return () => clearInterval(interval);
  }, [expanded, masterMuted]);

  return (
    <section
      aria-label="Mezclador de audio profesional"
      style={{
        backgroundColor: '#0e131d',
        borderTop: '1px solid #232b3a',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'max-height 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        maxHeight: expanded ? '218px' : '36px',
      }}
    >
      {/* Barra Superior del Mezclador (Siempre visible tanto oculto como desplegado) */}
      <div
        style={{
          height: '36px',
          minHeight: '36px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#131926',
          borderBottom: expanded ? '1px solid #202838' : 'none',
          gap: '12px',
        }}
      >
        {/* Izquierda: Título del Mezclador + Botón de Plegar/Desplegar */}
        <button
          type="button"
          onClick={() => onToggleExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            fontWeight: 800,
            fontSize: '12px',
            letterSpacing: '0.5px',
          }}
          title={expanded ? 'Ocultar mezclador de audio (↓)' : 'Desplegar mezclador de audio profesional (↑)'}
        >
          <Sliders size={15} color="#FFB100" />
          <span>MEZCLADOR DE AUDIO</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 7px',
              borderRadius: '4px',
              backgroundColor: expanded ? 'rgba(255, 177, 0, 0.16)' : 'rgba(255, 255, 255, 0.07)',
              color: expanded ? '#FFB100' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 800,
            }}
          >
            {expanded ? (
              <>
                <span>↓</span>
                <ChevronDown size={13} />
              </>
            ) : (
              <>
                <span>↑</span>
                <ChevronUp size={13} />
              </>
            )}
          </span>
        </button>

        {/* Centro: Cuando está oculto muestra resumen compacto; cuando está desplegado muestra controles de Crossfade */}
        {!expanded ? (
          <div
            onClick={() => onToggleExpanded(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              fontSize: '11px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
            title="Haz clic para abrir el mezclador de 3 canales"
          >
            <span>
              <strong style={{ color: '#FFB100' }}>KARAOKE:</strong>{' '}
              {karaokeMuted ? 'MUTE' : `${karaokeVolume}%`}
            </span>
            <span>
              <strong style={{ color: '#29C7FF' }}>AMBIENTE:</strong>{' '}
              {ambientMuted ? 'MUTE' : `${ambientVolume}%`}
            </span>
            <span>
              <strong style={{ color: '#10B981' }}>MASTER:</strong>{' '}
              {masterMuted ? 'MUTE' : `${masterVolume}%`}
            </span>
            <span>
              <strong style={{ color: crossfadeEnabled ? '#FFB100' : 'var(--text-muted)' }}>
                CROSSFADE:
              </strong>{' '}
              {crossfadeEnabled ? `ON (${crossfadeDurationSec}s)` : 'OFF'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Icono de onda cruzada tipo DJ Crossfade */}
            <svg width="34" height="16" viewBox="0 0 34 16" fill="none" aria-hidden="true">
              <path
                d="M1 14C9 14 13 2 21 2C27 2 30 8 33 8"
                stroke="#FFB100"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M1 2C9 2 13 14 21 14C27 14 30 8 33 8"
                stroke="#29C7FF"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.4px' }}>
              CROSSFADE AUTOMÁTICO
            </span>

            {/* Interruptor ON / OFF estilo hardware */}
            <button
              type="button"
              onClick={() => onToggleCrossfade(!crossfadeEnabled)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: crossfadeEnabled ? 'flex-end' : 'flex-start',
                width: '48px',
                height: '22px',
                borderRadius: '999px',
                padding: '2px 4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: crossfadeEnabled ? '#FFB100' : '#273042',
                color: crossfadeEnabled ? '#0C1017' : 'var(--text-muted)',
                fontWeight: 900,
                fontSize: '10px',
                position: 'relative',
                transition: 'background-color 150ms ease',
              }}
              title="Activar o desactivar transición suave automática entre Karaoke y Música de Ambiente"
            >
              <span
                style={{
                  position: 'absolute',
                  left: crossfadeEnabled ? '7px' : '22px',
                  fontSize: '9px',
                  fontWeight: 900,
                }}
              >
                {crossfadeEnabled ? 'ON' : 'OFF'}
              </span>
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
              />
            </button>

            {/* Selector de segundos de transición (1s a 5s, por defecto 3s) */}
            <select
              value={crossfadeDurationSec}
              disabled={!crossfadeEnabled}
              onChange={(e) => onChangeCrossfadeDuration(Number(e.target.value))}
              style={{
                backgroundColor: '#0c1017',
                color: crossfadeEnabled ? '#FFB100' : 'var(--text-muted)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '5px',
                padding: '2px 6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: crossfadeEnabled ? 'pointer' : 'not-allowed',
              }}
              title="Duración del crossfade automático (1 a 5 segundos)"
            >
              {[1, 2, 3, 4, 5].map((sec) => (
                <option key={sec} value={sec}>
                  {sec} s
                </option>
              ))}
            </select>

            <span style={{ fontSize: '11px', color: isCrossfading ? '#29C7FF' : 'var(--text-muted)' }}>
              {isCrossfading
                ? '⚡ Ejecutando transición suave de audio...'
                : 'Transición suave entre Karaoke y Música de Ambiente'}
            </span>
          </div>
        )}

        {/* Derecha: Botón explícito para plegar/desplegar con flecha ↑ / ↓ */}
        <button
          type="button"
          onClick={() => onToggleExpanded(!expanded)}
          className="btn"
          style={{
            height: '24px',
            minHeight: '24px',
            padding: '0 9px',
            fontSize: '11px',
            gap: '4px',
            backgroundColor: '#192132',
            borderColor: 'rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
          }}
        >
          <span>{expanded ? 'Ocultar ↓' : 'Abrir ↑'}</span>
        </button>
      </div>

      {/* Cuerpo desplegable con los 3 canales profesionales */}
      <div
        style={{
          padding: '10px 16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? 'auto' : 'none',
          transition: 'opacity 180ms ease',
        }}
      >
        {/* CANAL 1: KARAOKE (Amarillo Ámbar #FFB100) */}
        <VerticalFaderChannel
          title="KARAOKE"
          accentColor="#FFB100"
          glowColor="rgba(255, 177, 0, 0.14)"
          borderColor="rgba(255, 177, 0, 0.55)"
          icon={<Mic size={15} color="#FFB100" />}
          volume={karaokeVolume}
          muted={karaokeMuted}
          levels={levels.karaoke}
          onChangeVolume={onChangeKaraokeVolume}
          onToggleMute={onToggleKaraokeMute}
        />

        {/* CANAL 2: MÚSICA AMBIENTE (Azul Cian #29C7FF) */}
        <VerticalFaderChannel
          title="MÚSICA AMBIENTE"
          accentColor="#29C7FF"
          glowColor="rgba(41, 199, 255, 0.14)"
          borderColor="rgba(41, 199, 255, 0.55)"
          icon={<Music size={15} color="#29C7FF" />}
          volume={ambientVolume}
          muted={ambientMuted}
          levels={levels.ambient}
          onChangeVolume={onChangeAmbientVolume}
          onToggleMute={onToggleAmbientMute}
        />

        {/* CANAL 3: MASTER (Verde #10B981) */}
        <VerticalFaderChannel
          title="MASTER"
          accentColor="#10B981"
          glowColor="rgba(16, 185, 129, 0.14)"
          borderColor="rgba(16, 185, 129, 0.55)"
          icon={<BarChart2 size={15} color="#10B981" />}
          volume={masterVolume}
          muted={masterMuted}
          levels={levels.master}
          onChangeVolume={onChangeMasterVolume}
          onToggleMute={onToggleMasterMute}
        />
      </div>
    </section>
  );
};
