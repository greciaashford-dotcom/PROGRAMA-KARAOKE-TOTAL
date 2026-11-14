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
          backgroundColor: 'var(--bg-surface)',
          padding: '6px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <strong style={{ color: 'var(--accent-warm)', fontSize: '13px' }}>
            Modo Libre / Sin Sesión de Cola:
          </strong>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Reproduce vídeos directamente con el botón ▶ del catálogo, o inicia una sesión para gestionar turnos de cantantes.
          </span>
        </div>

        {isCreating ? (
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Nombre (ej. Sesión en Directo)"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              autoFocus
              style={{ minWidth: '200px', minHeight: '30px', height: '30px', fontSize: '12.5px' }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ height: '30px', minHeight: '30px', fontSize: '12px', padding: '0 12px' }}
            >
              Iniciar
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setIsCreating(false)}
              style={{ height: '30px', minHeight: '30px', fontSize: '12px', padding: '0 10px' }}
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => setIsCreating(true)}
            style={{ height: '30px', minHeight: '30px', fontSize: '12px', padding: '0 12px', whiteSpace: 'nowrap' }}
          >
            <Plus size={14} />
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
        backgroundColor: 'var(--bg-surface)',
        padding: '6px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {isPaused ? (
          <PauseCircle size={19} color="var(--status-warning)" />
        ) : (
          <PlayCircle size={19} color="var(--status-ready)" />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
            {currentSession.name}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span
            className="pill"
            style={{
              fontSize: '10px',
              backgroundColor: isPaused ? 'var(--status-warning)' : 'var(--status-ready)',
              color: '#052e16',
              padding: '2px 7px',
              borderRadius: '4px',
            }}
          >
            {isPaused ? 'PAUSADA' : 'ABIERTA'}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              borderLeft: '1px solid var(--border-subtle)',
              paddingLeft: '10px',
              marginLeft: '4px',
            }}
          >
            Iniciada a las {new Date(currentSession.openedAt).toLocaleTimeString('es-ES')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isPaused && onResumeSession && (
          <button
            className="btn btn-primary"
            onClick={() => onResumeSession(currentSession.id)}
            style={{ height: '30px', minHeight: '30px', fontSize: '12px', padding: '0 12px' }}
          >
            <PlayCircle size={14} />
            Reanudar Sesión
          </button>
        )}

        {!isPaused && onPauseSession && (
          <button
            className="btn"
            onClick={() => onPauseSession(currentSession.id)}
            style={{ height: '30px', minHeight: '30px', fontSize: '12px', padding: '0 12px' }}
          >
            <PauseCircle size={14} />
            Pausar Sesión
          </button>
        )}

        <button
          className="btn"
          onClick={() => onCloseSession(currentSession.id)}
          title="Cerrar la sesión actual"
          style={{ height: '30px', minHeight: '30px', fontSize: '12px', padding: '0 12px' }}
        >
          <StopCircle size={14} />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};
