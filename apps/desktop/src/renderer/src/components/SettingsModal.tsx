import React, { useState, useEffect } from 'react';
import { X, Volume2, Globe, Monitor, LifeBuoy } from 'lucide-react';
import { SettingsDTO, UpdateSettingsDTO, DisplayInfo } from '@karaoke/contracts';

interface SettingsModalProps {
  settings: SettingsDTO;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: UpdateSettingsDTO) => Promise<void>;
  onRescuePublicScreen?: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  isOpen,
  onClose,
  onSave,
  onRescuePublicScreen,
}) => {
  const [masterVolume, setMasterVolume] = useState<number>(settings.masterVolume);
  const [karaokeVolume, setKaraokeVolume] = useState<number>(settings.karaokeVolume);
  const [ambientVolume, setAmbientVolume] = useState<number>(settings.ambientVolume);
  const [language, setLanguage] = useState<'es' | 'en'>(settings.language);
  const [publicDisplayId, setPublicDisplayId] = useState<string>(settings.publicDisplayId || '');
  const [monitors, setMonitors] = useState<DisplayInfo[]>([]);
  const [saving, setSaving] = useState<boolean>(false);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        masterVolume,
        karaokeVolume,
        ambientVolume,
        language,
        publicDisplayId: publicDisplayId || null,
      });

      if (window.karaokeAPI) {
        await window.karaokeAPI.assignDisplays({
          operatorDisplayId: settings.operatorDisplayId || null,
          publicDisplayId: publicDisplayId || null,
        });
      }

      onClose();
    } catch (err) {
      console.error('Error guardando configuración:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <h2 id="modal-title" style={{ fontSize: '18px', fontWeight: 600 }}>
            Configuración del Sistema
          </h2>
          <button
            className="btn btn-icon"
            onClick={onClose}
            aria-label="Cerrar ventana de configuración"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Asignación de Pantallas */}
          <div className="form-group">
            <label className="form-label">
              <Monitor size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Pantalla Pública (Proyector o TV de sala)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-input"
                value={publicDisplayId}
                onChange={(e) => setPublicDisplayId(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Automático (primer monitor secundario)</option>
                {monitors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} {m.isPrimary ? '— (Principal / Operador)' : ''}
                  </option>
                ))}
              </select>

              {onRescuePublicScreen && (
                <button
                  type="button"
                  className="btn"
                  onClick={onRescuePublicScreen}
                  title="Rescatar pantalla pública y centrarla en el monitor principal"
                  style={{ whiteSpace: 'nowrap', gap: '6px' }}
                >
                  <LifeBuoy size={16} color="var(--accent-warm)" />
                  Rescatar
                </button>
              )}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              {monitors.length > 1
                ? `Se han detectado ${monitors.length} monitores conectados.`
                : 'Se detecta 1 único monitor. Si abres la pantalla pública se mostrará en ventana local.'}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">
              <Globe size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Idioma de la Consola
            </label>
            <select
              className="form-input"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'es' | 'en')}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              <Volume2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Volumen Principal ({masterVolume}%)
            </label>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
              />
              <span style={{ minWidth: '40px', textAlign: 'right', fontFamily: 'monospace' }}>
                {masterVolume}%
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Volumen Karaoke ({karaokeVolume}%)</label>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="100"
                value={karaokeVolume}
                onChange={(e) => setKaraokeVolume(Number(e.target.value))}
              />
              <span style={{ minWidth: '40px', textAlign: 'right', fontFamily: 'monospace' }}>
                {karaokeVolume}%
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Volumen Ambiente ({ambientVolume}%)</label>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="100"
                value={ambientVolume}
                onChange={(e) => setAmbientVolume(Number(e.target.value))}
              />
              <span style={{ minWidth: '40px', textAlign: 'right', fontFamily: 'monospace' }}>
                {ambientVolume}%
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};
