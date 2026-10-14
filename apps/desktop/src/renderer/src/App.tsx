import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { SettingsModal } from './components/SettingsModal.js';
import { SessionBanner } from './components/SessionBanner.js';
import { SettingsDTO, UpdateSettingsDTO, SessionDTO } from '@karaoke/contracts';
import { AlertOctagon, Music, ListOrdered, Play, Search, FolderPlus } from 'lucide-react';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionDTO | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<string>('Base segura inicializada correctamente.');

  useEffect(() => {
    const initApp = async () => {
      try {
        if (window.karaokeAPI) {
          const settingsRes = await window.karaokeAPI.getSettings();
          if (settingsRes.success) {
            setSettings(settingsRes.data);
          }

          const sessionRes = await window.karaokeAPI.getCurrentSession();
          if (sessionRes.success) {
            setCurrentSession(sessionRes.data);
          }
        }
      } catch (err) {
        console.error('Error inicializando consola:', err);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  const handleSaveSettings = async (updates: UpdateSettingsDTO) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.updateSettings(updates);
    if (res.success) {
      setSettings(res.data);
      setNotification('Configuración guardada en SQLite.');
    }
  };

  const handleOpenSession = async (name: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.openSession(name);
    if (res.success) {
      setCurrentSession(res.data);
      setNotification(`Sesión "${res.data.name}" abierta.`);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.closeSession(sessionId);
    if (res.success) {
      setCurrentSession(null);
      setNotification('Sesión finalizada.');
    }
  };

  const handleEmergencyStop = () => {
    setNotification('¡PARADA DE EMERGENCIA ACTIVADA!');
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-secondary)',
        }}
      >
        Iniciando consola de directo...
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header
        currentSession={currentSession}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div style={{ padding: '8px 16px', backgroundColor: 'var(--bg-surface)' }}>
        <SessionBanner
          currentSession={currentSession}
          onOpenSession={handleOpenSession}
          onCloseSession={handleCloseSession}
        />
      </div>

      <main className="main-grid">
        {/* Panel 1: Catálogo */}
        <section className="panel" aria-label="Catálogo de canciones">
          <div className="panel-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Music size={18} color="var(--accent-warm)" />
              Catálogo Local
            </span>
            <button className="btn btn-icon" title="Añadir carpeta (Fase 2)" disabled>
              <FolderPlus size={18} />
            </button>
          </div>

          <div className="panel-content">
            <div className="form-group">
              <div style={{ position: 'relative' }}>
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '13px',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar por artista o título..."
                  style={{ width: '100%', paddingLeft: '40px' }}
                  disabled
                />
              </div>
            </div>

            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                border: '1px dashed var(--border-strong)',
                borderRadius: '6px',
                padding: '24px',
              }}
            >
              <Music size={40} color="var(--border-strong)" style={{ marginBottom: '12px' }} />
              <strong style={{ color: 'var(--text-primary)' }}>Base segura completada</strong>
              <p style={{ fontSize: '14px', marginTop: '6px' }}>
                El catálogo local, el escaneo con ffprobe y la monitorización de carpetas se activarán en la Fase 2.
              </p>
            </div>
          </div>
        </section>

        {/* Panel 2: Cola de Actuaciones */}
        <section className="panel" aria-label="Cola de cantantes">
          <div className="panel-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListOrdered size={18} color="var(--accent-warm)" />
              Cola de Actuaciones
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>0 en espera</span>
          </div>

          <div className="panel-content">
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                border: '1px dashed var(--border-strong)',
                borderRadius: '6px',
                padding: '24px',
              }}
            >
              <ListOrdered size={40} color="var(--border-strong)" style={{ marginBottom: '12px' }} />
              <strong style={{ color: 'var(--text-primary)' }}>Cola vacía</strong>
              <p style={{ fontSize: '14px', marginTop: '6px' }}>
                La máquina de estados de turnos y cantantes se implementará en la Fase 3.
              </p>
            </div>
          </div>
        </section>

        {/* Panel 3: Reproducción Actual */}
        <section className="panel" aria-label="Control de reproducción actual">
          <div className="panel-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={18} color="var(--accent-warm)" />
              Reproductor Local
            </span>
            <span className="pill" style={{ backgroundColor: 'var(--bg-surface-hover)', fontSize: '12px' }}>
              IDLE
            </span>
          </div>

          <div className="panel-content">
            <div
              style={{
                height: '180px',
                backgroundColor: '#0a0a0c',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              Vista previa del vídeo local (Fase 4)
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button className="btn" disabled>
                Anterior
              </button>
              <button className="btn btn-primary" disabled>
                Reproducir
              </button>
              <button className="btn" disabled>
                Siguiente
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            <strong>Mensajes:</strong> {notification}
          </span>
        </div>

        <button
          className="btn btn-emergency"
          onClick={handleEmergencyStop}
          title="Parada inmediata de sonido y vídeo en directo"
        >
          <AlertOctagon size={20} />
          PARADA DE EMERGENCIA
        </button>
      </footer>

      {settings && (
        <SettingsModal
          settings={settings}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
};
