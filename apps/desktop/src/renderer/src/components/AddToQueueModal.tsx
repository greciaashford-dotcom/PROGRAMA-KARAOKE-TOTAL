import React, { useState, useEffect } from 'react';
import { X, ListPlus, Music } from 'lucide-react';
import { SongDTO, SingerDTO } from '@karaoke/contracts';

interface AddToQueueModalProps {
  song: SongDTO | null;
  singers: SingerDTO[];
  isOpen: boolean;
  onClose: () => void;
  onAddToQueue: (songId: string, singerId: string, keyShift: number, tempoPercent: number) => Promise<void>;
  onCreateSinger: (name: string, table?: string) => Promise<SingerDTO | null>;
}

export const AddToQueueModal: React.FC<AddToQueueModalProps> = ({
  song,
  singers,
  isOpen,
  onClose,
  onAddToQueue,
  onCreateSinger,
}) => {
  const [selectedSingerId, setSelectedSingerId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newSingerName, setNewSingerName] = useState<string>('');
  const [newSingerTable, setNewSingerTable] = useState<string>('');
  const [keyShift, setKeyShift] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (singers.length > 0 && !selectedSingerId) {
      const firstSinger = singers[0];
      if (firstSinger) {
        setSelectedSingerId(firstSinger.id);
      }
      setIsCreatingNew(false);
    } else if (singers.length === 0) {
      setIsCreatingNew(true);
    }
  }, [singers, isOpen]);

  if (!isOpen || !song) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      let finalSingerId = selectedSingerId;

      if (isCreatingNew) {
        if (!newSingerName.trim()) return;
        const created = await onCreateSinger(newSingerName.trim(), newSingerTable.trim() || undefined);
        if (!created) return;
        finalSingerId = created.id;
      }

      if (!finalSingerId) return;

      await onAddToQueue(song.id, finalSingerId, keyShift, 100);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-queue-title">
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="add-queue-title" style={{ fontSize: '18px', fontWeight: 600 }}>
            Añadir Canción a la Cola
          </h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'var(--bg-surface-raised)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Music size={24} color="var(--accent-warm)" />
              <div>
                <strong style={{ fontSize: '16px' }}>{song.title}</strong>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{song.artist}</div>
              </div>
            </div>

            {/* Selector de cantante */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Cantante Asignado *</label>
                {singers.length > 0 && (
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-warm)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      textDecoration: 'underline',
                    }}
                    onClick={() => setIsCreatingNew(!isCreatingNew)}
                  >
                    {isCreatingNew ? 'Elegir cantante existente' : '+ Nuevo cantante'}
                  </button>
                )}
              </div>

              {!isCreatingNew && singers.length > 0 ? (
                <select
                  className="form-input"
                  value={selectedSingerId}
                  onChange={(e) => setSelectedSingerId(e.target.value)}
                >
                  {singers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName} {s.tableOrLocation ? `(${s.tableOrLocation})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nombre o alias del cantante..."
                    value={newSingerName}
                    onChange={(e) => setNewSingerName(e.target.value)}
                    required
                    autoFocus
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Mesa o ubicación (opcional)..."
                    value={newSingerTable}
                    onChange={(e) => setNewSingerTable(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Ajuste de Tono (Semitonos) */}
            <div className="form-group">
              <label className="form-label">Ajuste de Tono (Semitonos: {keyShift > 0 ? `+${keyShift}` : keyShift})</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setKeyShift((k) => Math.max(-6, k - 1))}
                  disabled={keyShift <= -6}
                  style={{ width: '44px', height: '44px' }}
                >
                  -
                </button>
                <div
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    fontWeight: 700,
                  }}
                >
                  {keyShift === 0 ? 'Original (0)' : keyShift > 0 ? `+${keyShift}` : keyShift}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setKeyShift((k) => Math.min(6, k + 1))}
                  disabled={keyShift >= 6}
                  style={{ width: '44px', height: '44px' }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <ListPlus size={16} />
              {submitting ? 'Añadiendo...' : 'Añadir a la Cola'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
