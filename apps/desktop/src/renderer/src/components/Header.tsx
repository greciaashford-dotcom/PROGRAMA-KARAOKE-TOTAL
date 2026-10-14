import React, { useState, useEffect } from 'react';
import { Settings, Monitor, Database, Disc } from 'lucide-react';
import { SessionDTO } from '@karaoke/contracts';

interface HeaderProps {
  currentSession: SessionDTO | null;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentSession, onOpenSettings }) => {
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
        <div className="status-indicator" title="Pantalla pública secundaria">
          <Monitor size={18} />
          <span>Pantalla: Configurando</span>
        </div>

        <div className="status-indicator" title="Estado de la base de datos local">
          <Database size={18} />
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
