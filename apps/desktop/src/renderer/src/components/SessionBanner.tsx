import React, { useState } from 'react';
import { PlayCircle, PauseCircle, StopCircle, Plus } from 'lucide-react';
import { SessionDTO } from '@karaoke/contracts';

interface SessionBannerProps {
  currentSession: SessionDTO | null;
  onOpenSession: (name: string) => Promise<void>;
  onPauseSession?: (sessionId: string) => Promise<void>;
  onResumeSession?: (sessionId: string) => Promise<void>;
  onCloseSession: (sessionId: string) => Promise<void>;
}

export const SessionBanner: React.FC<SessionBannerProps> = ({
  currentSession,
  onOpenSession,
  onPauseSession,
  onResumeSession,
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
          padding: '10px 16px',
          borderRadius: '6px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <strong style={{ color: 'var(--accent-warm)', fontSize: '14px' }}>
            Modo Libre / Sin Sesión de Cola:
          </strong>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Puedes reproducir vídeos directamente con el botón ▶ del catálogo, o iniciar una sesión para gestionar turnos de cantantes.
          </span>
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
              style={{ minWidth: '220px', minHeight: '36px', height: '36px', fontSize: '14px' }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ height: '36px', minHeight: '36px', fontSize: '13px' }}
            >
              Iniciar
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setIsCreating(false)}
              style={{ height: '36px', minHeight: '36px', fontSize: '13px' }}
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => setIsCreating(true)}
            style={{ height: '36px', minHeight: '36px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            <Plus size={16} />
            Nueva Sesión
          </button>
        )}
      </div>
    );
  }

  const isPaused = currentSession.status === 'PAUSED';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface-raised)',
        padding: '8px 16px',
        borderRadius: '6px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isPaused ? (
          <PauseCircle size={22} color="var(--status-warning)" />
        ) : (
          <PlayCircle size={22} color="var(--status-ready)" />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>{currentSession.name}</span>
          <span
            className="pill"
            style={{
              fontSize: '11px',
              backgroundColor: isPaused ? 'var(--status-warning)' : 'var(--status-ready)',
              color: '#18181b',
            }}
          >
            {isPaused ? 'PAUSADA' : 'ABIERTA'}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Iniciada a las {new Date(currentSession.openedAt).toLocaleTimeString('es-ES')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isPaused && onResumeSession && (
          <button
            className="btn btn-primary"
            onClick={() => onResumeSession(currentSession.id)}
            style={{ height: '34px', minHeight: '34px', fontSize: '13px', padding: '0 12px' }}
          >
            <PlayCircle size={15} />
            Reanudar Sesión
          </button>
        )}

        {!isPaused && onPauseSession && (
          <button
            className="btn"
            onClick={() => onPauseSession(currentSession.id)}
            style={{ height: '34px', minHeight: '34px', fontSize: '13px', padding: '0 12px' }}
          >
            <PauseCircle size={15} />
            Pausar Sesión
          </button>
        )}

        <button
          className="btn"
          onClick={() => onCloseSession(currentSession.id)}
          title="Cerrar la sesión actual"
          style={{ height: '34px', minHeight: '34px', fontSize: '13px', padding: '0 12px' }}
        >
          <StopCircle size={15} />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};
