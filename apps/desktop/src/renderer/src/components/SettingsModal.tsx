import React, { useState } from 'react';
import { X, Volume2, Globe } from 'lucide-react';
import { SettingsDTO, UpdateSettingsDTO } from '@karaoke/contracts';

interface SettingsModalProps {
  settings: SettingsDTO;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: UpdateSettingsDTO) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  isOpen,
  onClose,
  onSave,
}) => {
  const [masterVolume, setMasterVolume] = useState<number>(settings.masterVolume);
  const [karaokeVolume, setKaraokeVolume] = useState<number>(settings.karaokeVolume);
  const [ambientVolume, setAmbientVolume] = useState<number>(settings.ambientVolume);
  const [language, setLanguage] = useState<'es' | 'en'>(settings.language);
  const [saving, setSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        masterVolume,
        karaokeVolume,
        ambientVolume,
        language,
      });
      onClose();
    } catch (err) {
      console.error('Error guardando configuración:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content">
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
