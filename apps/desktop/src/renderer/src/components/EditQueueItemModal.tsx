import React, { useState, useEffect } from 'react';
import { X, Save, Minus, Plus } from 'lucide-react';
import { QueueItemDTO } from '@karaoke/contracts';
import { cleanDisplayTitle } from '../utils/title-cleaner.js';

interface EditQueueItemModalProps {
  item: QueueItemDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (queueItemId: string, singerName: string, keyShift: number) => Promise<void>;
}

export const EditQueueItemModal: React.FC<EditQueueItemModalProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
}) => {
  const [singerName, setSingerName] = useState('');
  const [keyShift, setKeyShift] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setSingerName(item.singer?.displayName || '');
      setKeyShift(item.keyShift || 0);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singerName.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(item.id, singerName.trim(), keyShift);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-queue-item-title">
      <div className="modal-content" style={{ width: '500px' }}>
        <div className="modal-header">
          <span id="edit-queue-item-title">Editar Turno #{item.position}</span>
          <button type="button" className="btn btn-icon" onClick={onClose} style={{ backgroundColor: '#f6efe0' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="katakana-card" style={{ fontSize: '18px', fontWeight: 800 }}>
              {cleanDisplayTitle(item.song?.title)}
            </div>

            <div className="form-group">
              <label className="form-label">Nombre del Cantante *</label>
              <input
                type="text"
                className="form-input"
                value={singerName}
                onChange={(e) => setSingerName(e.target.value)}
                required
                autoFocus
                style={{ fontSize: '18px' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Tono Programado ({keyShift > 0 ? `+${keyShift}` : keyShift} semitonos)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setKeyShift((k) => Math.max(-6, k - 1))}
                  disabled={keyShift <= -6}
                >
                  <Minus size={18} />
                </button>
                <div
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '20px',
                    fontWeight: 900,
                  }}
                >
                  {keyShift === 0 ? '0 (Original)' : keyShift > 0 ? `+${keyShift} st` : `${keyShift} st`}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setKeyShift((k) => Math.min(6, k + 1))}
                  disabled={keyShift >= 6}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-surf" disabled={saving || !singerName.trim()}>
              <Save size={17} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
