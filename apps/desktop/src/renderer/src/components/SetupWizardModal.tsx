import React, { useState, useEffect } from 'react';
import {
  Disc,
  Monitor,
  FolderPlus,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  X,
  Sparkles,
  Folder,
} from 'lucide-react';
import {
  DisplayInfo,
  MediaFolderDTO,
  SessionDTO,
  SettingsDTO,
  UpdateSettingsDTO,
} from '@karaoke/contracts';

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsDTO | null;
  folders: MediaFolderDTO[];
  currentSession: SessionDTO | null;
  scanProgress: {
    folderId: string;
    discovered: number;
    processed: number;
    errors: number;
    status: string;
    currentFile?: string;
  } | null;
  onSaveSettings: (updates: UpdateSettingsDTO) => Promise<void>;
  onSelectFolder: () => Promise<void>;
  onOpenSession: (name: string) => Promise<void>;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  onClose,
  settings,
  folders,
  currentSession,
  scanProgress,
  onSaveSettings,
  onSelectFolder,
  onOpenSession,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [monitors, setMonitors] = useState<DisplayInfo[]>([]);
  const [publicDisplayId, setPublicDisplayId] = useState<string>(
    settings?.publicDisplayId || '',
  );
  const [sessionName, setSessionName] = useState<string>('Sesión en Directo');

  useEffect(() => {
    if (isOpen && window.karaokeAPI) {
      window.karaokeAPI.getMonitors().then((res) => {
        if (res.success) {
          setMonitors(res.data);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveMonitorsAndNext = async () => {
    await onSaveSettings({
      publicDisplayId: publicDisplayId || null,
    });
    if (window.karaokeAPI) {
      await window.karaokeAPI.assignDisplays({
        operatorDisplayId: settings?.operatorDisplayId || null,
        publicDisplayId: publicDisplayId || null,
      });
    }
    setStep(2);
  };

  const handleFinishWizard = async () => {
    if (!currentSession && sessionName.trim()) {
      await onOpenSession(sessionName.trim());
    }
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <div className="modal-content" style={{ width: '640px', maxWidth: '94vw' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(217, 119, 6, 0.18)',
                border: '1px solid var(--accent-warm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-warm)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 id="wizard-title" style={{ fontSize: '17px', fontWeight: 700 }}>
                Asistente de Configuración Rápida
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Paso {step} de 3 — Preparación de cabina local
              </div>
            </div>
          </div>

          <button className="btn btn-icon" onClick={onClose} aria-label="Cerrar asistente">
            <X size={20} />
          </button>
        </div>

        {/* Indicador de pasos */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: 'var(--bg-app)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {[
            { num: 1, label: '1. Pantallas' },
            { num: 2, label: '2. Biblioteca Local' },
            { num: 3, label: '3. Abrir Sesión' },
          ].map((item) => {
            const active = step === item.num;
            const done = step > item.num;
            return (
              <div
                key={item.num}
                onClick={() => setStep(item.num as 1 | 2 | 3)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: active
                    ? 'rgba(217, 119, 6, 0.16)'
                    : done
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'var(--bg-surface-raised)',
                  color: active
                    ? 'var(--accent-warm)'
                    : done
                      ? 'var(--status-ready)'
                      : 'var(--text-muted)',
                  border: active
                    ? '1px solid var(--accent-warm)'
                    : '1px solid var(--border-subtle)',
                }}
              >
                {done ? <CheckCircle2 size={15} /> : <Disc size={15} />}
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        <div className="modal-body" style={{ minHeight: '260px', justifyContent: 'space-between' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Monitor size={22} color="var(--accent-warm)" />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                    Detección de Monitores y Pantalla Pública
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Elige dónde se proyectará la letra y el vídeo para el público. Puedes operar con 1 o 2 pantallas.
                  </p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Monitor asignado a la Pantalla Pública ({monitors.length} detectado{monitors.length === 1 ? '' : 's'})
                </label>
                <select
                  className="form-input"
                  value={publicDisplayId}
                  onChange={(e) => setPublicDisplayId(e.target.value)}
                >
                  <option value="">Automático (Usar monitor secundario si está disponible)</option>
                  {monitors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} {m.isPrimary ? '— (Pantalla Principal)' : '— (Secundario)'}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}
              >
                💡 <strong>Consejo de Cabina:</strong> Puedes reproducir vídeos directamente dentro del reproductor integrado de la consola sin necesidad de abrir la Pantalla Pública, o enviarlo a un televisor/proyector HDMI cuando quieras.
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FolderPlus size={22} color="var(--accent-warm)" />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                      Selecciona tu Carpeta de Vídeos o MP3 de Karaoke
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Formatos soportados: MP4, MKV, WEBM, MOV, MP3, M4A, WAV, OGG y FLAC.
                    </p>
                  </div>
                </div>

                <button className="btn btn-primary" onClick={onSelectFolder}>
                  <FolderPlus size={18} />
                  Añadir Carpeta del PC
                </button>
              </div>

              {scanProgress && scanProgress.status === 'SCANNING' && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(217, 119, 6, 0.12)',
                    border: '1px solid var(--accent-warm)',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong>
                      Indexando archivos: {scanProgress.processed} / {scanProgress.discovered}
                    </strong>
                    <span>{scanProgress.currentFile || ''}</span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'var(--bg-app)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: 'var(--accent-warm)',
                        width: `${scanProgress.discovered ? Math.round((scanProgress.processed / scanProgress.discovered) * 100) : 0}%`,
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                {folders.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      textAlign: 'center',
                      border: '1px dashed var(--border-strong)',
                      borderRadius: '6px',
                      color: 'var(--text-muted)',
                      fontSize: '14px',
                    }}
                  >
                    Todavía no has autorizado ninguna carpeta. Pulsa <strong>&quot;Añadir Carpeta del PC&quot;</strong> arriba.
                  </div>
                ) : (
                  folders.map((f) => (
                    <div
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-surface-raised)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <Folder size={16} color="var(--accent-warm)" />
                        <span>{f.displayName}</span>
                      </div>
                      <span
                        className="pill"
                        style={{
                          fontSize: '11px',
                          backgroundColor: 'var(--status-ready)',
                          color: '#18181b',
                        }}
                      >
                        {f.scanStatus}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <PlayCircle size={22} color="var(--status-ready)" />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                    Iniciar Sesión de Karaoke
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Una sesión abierta te permite organizar la cola de cantantes y llevar el historial de la noche. También puedes reproducir cualquier vídeo directamente con el botón ▶ del catálogo.
                  </p>
                </div>
              </div>

              {currentSession ? (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid var(--status-ready)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <CheckCircle2 size={24} color="var(--status-ready)" />
                  <div>
                    <div style={{ fontWeight: 700 }}>Sesión activa: {currentSession.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Ya tienes una sesión lista para operar.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Nombre de la Sesión</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Ej. Noche de Karaoke / Fiesta Viernes"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn" onClick={onClose}>
            Omitir por ahora
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 1 && (
              <button className="btn" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                Anterior
              </button>
            )}

            {step === 1 && (
              <button className="btn btn-primary" onClick={handleSaveMonitorsAndNext}>
                Siguiente
                <ArrowRight size={16} />
              </button>
            )}

            {step === 2 && (
              <button className="btn btn-primary" onClick={() => setStep(3)}>
                Siguiente
                <ArrowRight size={16} />
              </button>
            )}

            {step === 3 && (
              <button className="btn btn-primary" onClick={handleFinishWizard}>
                <CheckCircle2 size={16} />
                Comenzar a Operar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
