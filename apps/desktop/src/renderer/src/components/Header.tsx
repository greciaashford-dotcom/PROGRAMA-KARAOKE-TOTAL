import React, { useState, useEffect } from 'react';
import { Settings, Monitor, Database, Disc, LifeBuoy, Sparkles } from 'lucide-react';
import { SessionDTO } from '@karaoke/contracts';

interface HeaderProps {
  currentSession: SessionDTO | null;
  isPublicScreenOpen: boolean;
  onTogglePublicScreen: () => void;
  onRescuePublicScreen: () => void;
  onOpenSettings: () => void;
  onOpenWizard?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSession,
  isPublicScreenOpen,
  onTogglePublicScreen,
  onRescuePublicScreen,
  onOpenSettings,
  onOpenWizard,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="header-bar">
      <div className="header-left">
        <div className="brand-badge">
          <Disc size={22} color="var(--accent-warm)" />
          <span>Karaoke Total</span>
          <span className="pill">PRO STUDIO</span>
        </div>

        <div className="status-indicator">
          <span className={`status-dot ${currentSession ? '' : 'warning'}`}></span>
          <span>
            {currentSession ? `Sesión: ${currentSession.name}` : 'Modo Reproducción Directa'}
          </span>
        </div>
      </div>

      <div className="header-center">
        {/* Control Rápido de la Pantalla Pública */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className={`btn ${isPublicScreenOpen ? 'btn-primary' : ''}`}
            onClick={onTogglePublicScreen}
            title={isPublicScreenOpen ? 'Cerrar pantalla del público' : 'Abrir pantalla pública en monitor secundario o ventana'}
            style={{
              height: '34px',
              minHeight: '34px',
              fontSize: '13px',
              padding: '0 12px',
              gap: '6px',
            }}
          >
            <Monitor size={15} />
            <span>
              {isPublicScreenOpen ? 'Pantalla Pública: En Vivo' : 'Abrir Pantalla Pública'}
            </span>
          </button>

          {isPublicScreenOpen && (
            <button
              className="btn btn-icon"
              onClick={onRescuePublicScreen}
              title="Rescatar pantalla pública (traer al monitor principal)"
              style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }}
            >
              <LifeBuoy size={15} color="var(--accent-warm)" />
            </button>
          )}
        </div>

        <div className="status-indicator" title="Motor SQLite WAL Local Activo">
          <Database size={15} color="var(--status-ready)" />
          <span>SQLite WAL</span>
        </div>
      </div>

      <div className="header-right">
        {onOpenWizard && (
          <button
            className="btn"
            onClick={onOpenWizard}
            title="Abrir asistente de configuración rápida"
            style={{ height: '34px', minHeight: '34px', fontSize: '12px', padding: '0 10px' }}
          >
            <Sparkles size={14} color="var(--accent-warm)" />
            <span>Asistente</span>
          </button>
        )}

        <div className="clock-display" aria-label="Hora actual">
          {currentTime || '--:--:--'}
        </div>

        <button
          className="btn btn-icon"
          onClick={onOpenSettings}
          title="Configuración local del sistema"
          aria-label="Abrir configuración"
          style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
