import React, { useState } from 'react';
import { PlayCircle, StopCircle, Plus } from 'lucide-react';
import { SessionDTO } from '@karaoke/contracts';

interface SessionBannerProps {
  currentSession: SessionDTO | null;
  onOpenSession: (name: string) => Promise<void>;
  onCloseSession: (sessionId: string) => Promise<void>;
}

export const SessionBanner: React.FC<SessionBannerProps> = ({
  currentSession,
  onOpenSession,
  onCloseSession,
}) => {
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    await onOpenSession(newSessionName.trim());
    setNewSessionName('');
    setIsCreating(false);
  };

  if (!currentSession) {
    return (
      <div
        style={{
          backgroundColor: 'var(--bg-surface-raised)',
          padding: '12px 16px',
          borderRadius: '6px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <strong style={{ color: 'var(--accent-warm)' }}>No hay sesión activa.</strong>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Abre una sesión para comenzar a registrar cantantes y gestionar la cola.
          </p>
        </div>

        {isCreating ? (
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Nombre (ej. Noche de Viernes)"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              autoFocus
              style={{ minWidth: '220px' }}
            />
            <button type="submit" className="btn btn-primary">
              Iniciar
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setIsCreating(false)}
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => setIsCreating(true)}
          >
            <Plus size={18} />
            Nueva Sesión
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface-raised)',
        padding: '12px 16px',
        borderRadius: '6px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <PlayCircle size={24} color="var(--status-ready)" />
        <div>
          <div style={{ fontWeight: 600 }}>{currentSession.name}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Abierta el {new Date(currentSession.openedAt).toLocaleTimeString('es-ES')}
          </div>
        </div>
      </div>

      <button
        className="btn"
        onClick={() => onCloseSession(currentSession.id)}
        title="Cerrar la sesión actual"
      >
        <StopCircle size={18} />
        Cerrar Sesión
      </button>
    </div>
  );
};
