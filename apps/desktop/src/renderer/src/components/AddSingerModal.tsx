import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { SingerDTO } from '@karaoke/contracts';

interface AddSingerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSinger: (displayName: string, tableOrLocation?: string, notes?: string) => Promise<SingerDTO | null>;
}

export const AddSingerModal: React.FC<AddSingerModalProps> = ({
  isOpen,
  onClose,
  onAddSinger,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [tableOrLocation, setTableOrLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setSaving(true);
    try {
      const singer = await onAddSinger(
        displayName.trim(),
        tableOrLocation.trim() || undefined,
        notes.trim() || undefined,
      );
      if (singer) {
        setDisplayName('');
        setTableOrLocation('');
        setNotes('');
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-singer-title">
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="add-singer-title" style={{ fontSize: '18px', fontWeight: 600 }}>
            Registrar Cantante
          </h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Solo se requiere un alias o nombre operativo. No se solicitan datos personales ni teléfonos.
            </p>

            <div className="form-group">
              <label className="form-label">Nombre o Alias del Cantante *</label>
              <input
                type="text"
                className="form-input"
                placeholder="ej. Laura, Carlos, Grupo Amigos"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mesa o Ubicación (Opcional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="ej. Mesa 5, Barra, Zona VIP"
                value={tableOrLocation}
                onChange={(e) => setTableOrLocation(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notas Adicionales (Opcional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="ej. Cumpleaños, primera vez"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !displayName.trim()}>
              <UserPlus size={16} />
              {saving ? 'Registrando...' : 'Registrar Cantante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
