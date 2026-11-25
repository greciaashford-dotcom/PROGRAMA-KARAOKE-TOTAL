import React, { useState, useEffect } from 'react';
import {
  X,
  Volume2,
  Monitor,
  LifeBuoy,
  Image as ImageIcon,
  RotateCcw,
  FolderPlus,
  BookmarkCheck,
} from 'lucide-react';
import { SettingsDTO, UpdateSettingsDTO, DisplayInfo } from '@karaoke/contracts';
import { VolumesStoreDTO } from '../../../preload/types.js';

interface SettingsModalProps {
  settings: SettingsDTO;
  volumesStore: VolumesStoreDTO;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: UpdateSettingsDTO) => Promise<void>;
  onSaveGlobalVolumes: (updates: Partial<Omit<VolumesStoreDTO, 'songs'>>) => Promise<void>;
  onSelectPublicBackground: () => Promise<void>;
  onResetPublicBackground: () => Promise<void>;
  onOpenFolderManager: () => void;
  onRescuePublicScreen?: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  volumesStore,
  isOpen,
  onClose,
  onSave,
  onSaveGlobalVolumes,
  onSelectPublicBackground,
  onResetPublicBackground,
  onOpenFolderManager,
  onRescuePublicScreen,
}) => {
  const [masterVolume, setMasterVolume] = useState<number>(volumesStore.masterVolume);
  const [karaokeDefaultVolume, setKaraokeDefaultVolume] = useState<number>(
    volumesStore.karaokeDefaultVolume,
  );
  const [ambientVolume, setAmbientVolume] = useState<number>(volumesStore.ambientVolume);
  const [applauseVolume, setApplauseVolume] = useState<number>(volumesStore.applauseVolume);
  const [autoSaveSongVolume, setAutoSaveSongVolume] = useState<boolean>(
    volumesStore.autoSaveSongVolume,
  );
  const [publicDisplayId, setPublicDisplayId] = useState<string>(settings.publicDisplayId || '');
  const [monitors, setMonitors] = useState<DisplayInfo[]>([]);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setMasterVolume(volumesStore.masterVolume);
      setKaraokeDefaultVolume(volumesStore.karaokeDefaultVolume);
      setAmbientVolume(volumesStore.ambientVolume);
      setApplauseVolume(volumesStore.applauseVolume);
      setAutoSaveSongVolume(volumesStore.autoSaveSongVolume);
      setPublicDisplayId(settings.publicDisplayId || '');
      window.karaokeAPI?.getMonitors().then((res) => {
        if (res.success) setMonitors(res.data);
      });
    }
  }, [isOpen, volumesStore, settings.publicDisplayId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        masterVolume,
        karaokeVolume: karaokeDefaultVolume,
        ambientVolume,
        publicDisplayId: publicDisplayId || null,
      });

      await onSaveGlobalVolumes({
        masterVolume,
        karaokeDefaultVolume,
        ambientVolume,
        applauseVolume,
        autoSaveSongVolume,
      });

      if (window.karaokeAPI) {
        await window.karaokeAPI.assignDisplays({
          operatorDisplayId: settings.operatorDisplayId || null,
          publicDisplayId: publicDisplayId || null,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content" style={{ width: '640px' }}>
        <div className="modal-header">
          <h2 id="modal-title" style={{ fontSize: '21px', fontWeight: 900 }}>
            Configuración — Katakana Karaoke
          </h2>
          <button
            type="button"
            className="btn btn-icon"
            onClick={onClose}
            aria-label="Cerrar configuración"
            style={{ backgroundColor: '#f6efe0' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Carpetas del Catálogo */}
          <div className="katakana-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 800 }}>Carpetas de Canciones y Catálogo</div>
              <div style={{ fontSize: '14px', color: 'var(--ink-muted)' }}>
                Agrega o reescanea carpetas con vídeos .DAT, .MP4, .MKV, .AVI, .CDG o MP3.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-surf"
              onClick={() => {
                onClose();
                onOpenFolderManager();
              }}
            >
              <FolderPlus size={18} />
              Carpetas
            </button>
          </div>

          {/* Imagen de Fondo de Pantalla Pública */}
          <div className="katakana-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', fontWeight: 800 }}>
              <ImageIcon size={18} />
              Imagen de Fondo de Pantalla Pública (Llamado y Espera)
            </div>
            <div style={{ fontSize: '14px', color: 'var(--ink-muted)' }}>
              {volumesStore.publicBackgroundPath
                ? `Imagen personalizada activa: ${volumesStore.publicBackgroundPath}`
                : 'Usando la imagen oficial Katakana Karaoke (assets/fondo_katakana.png).'}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-dark" onClick={onSelectPublicBackground}>
                <ImageIcon size={17} />
                Cambiar Imagen de Fondo
              </button>
              {volumesStore.publicBackgroundPath && (
                <button type="button" className="btn" onClick={onResetPublicBackground}>
                  <RotateCcw size={17} />
                  Restaurar Fondo Katakana
                </button>
              )}
            </div>
          </div>

          {/* Asignación de Pantallas */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Monitor size={18} />
              Monitor de Pantalla Pública (TV / Proyector)
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
                    {m.label} {m.isPrimary ? '— (Principal)' : '— (Secundario)'}
                  </option>
                ))}
              </select>

              {onRescuePublicScreen && (
                <button type="button" className="btn" onClick={onRescuePublicScreen}>
                  <LifeBuoy size={17} />
                  Rescatar
                </button>
              )}
            </div>
          </div>

          {/* Volúmenes Generales y Memoria Automática */}
          <div className="katakana-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', fontWeight: 800 }}>
              <Volume2 size={18} />
              Volúmenes Memorizados por Defecto
            </div>

            {[
              { label: 'Master General', val: masterVolume, set: setMasterVolume },
              { label: 'Karaoke (si no está memorizado)', val: karaokeDefaultVolume, set: setKaraokeDefaultVolume },
              { label: 'Música de Ambiente (MP3)', val: ambientVolume, set: setAmbientVolume },
              { label: 'Aplausos y Efectos', val: applauseVolume, set: setApplauseVolume },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, minWidth: '220px' }}>{row.label}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={row.val}
                  onChange={(e) => row.set(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 800, minWidth: '46px', textAlign: 'right' }}>
                  {row.val}%
                </span>
              </div>
            ))}

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                paddingTop: '4px',
              }}
            >
              <input
                type="checkbox"
                checked={autoSaveSongVolume}
                onChange={(e) => setAutoSaveSongVolume(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--accent-surf)' }}
              />
              <BookmarkCheck size={18} />
              <span>Memorizar automáticamente el volumen de cada karaoke al mover el deslizador</span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn btn-surf" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
};
