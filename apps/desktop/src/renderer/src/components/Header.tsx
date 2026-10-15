import React, { useState, useEffect } from 'react';
import { Settings, Monitor, Database, Disc, LifeBuoy } from 'lucide-react';
import { SessionDTO } from '@karaoke/contracts';

interface HeaderProps {
  currentSession: SessionDTO | null;
  isPublicScreenOpen: boolean;
  onTogglePublicScreen: () => void;
  onRescuePublicScreen: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSession,
  isPublicScreenOpen,
  onTogglePublicScreen,
  onRescuePublicScreen,
  onOpenSettings,
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
          <span className="pill">LOCAL</span>
        </div>

        <div className="status-indicator">
          <span className="status-dot"></span>
          <span>
            {currentSession ? `Sesión: ${currentSession.name}` : 'Sin sesión activa'}
          </span>
        </div>
      </div>

      <div className="header-center">
        {/* Control Rápido de la Pantalla Pública */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className={`btn ${isPublicScreenOpen ? 'btn-primary' : ''}`}
            onClick={onTogglePublicScreen}
            title={isPublicScreenOpen ? 'Cerrar pantalla del público' : 'Abrir pantalla pública en monitor secundario'}
            style={{
              height: '32px',
              minHeight: '32px',
              fontSize: '12px',
              padding: '0 10px',
              gap: '6px',
            }}
          >
            <Monitor size={15} />
            <span>
              {isPublicScreenOpen ? 'Pantalla Pública: Activa' : 'Abrir Pantalla Pública'}
            </span>
          </button>

          {isPublicScreenOpen && (
            <button
              className="btn btn-icon"
              onClick={onRescuePublicScreen}
              title="Rescatar pantalla pública (traer al monitor principal)"
              style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
            >
              <LifeBuoy size={15} color="var(--accent-warm)" />
            </button>
          )}
        </div>

        <div className="status-indicator" title="Estado de la base de datos local">
          <Database size={16} />
          <span>SQLite: Conectada</span>
        </div>
      </div>

      <div className="header-right">
        <div className="clock-display" aria-label="Hora actual">
          {currentTime || '--:--:--'}
        </div>

        <button
          className="btn btn-icon"
          onClick={onOpenSettings}
          title="Configuración local del sistema"
          aria-label="Abrir configuración"
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
};
