import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { SettingsModal } from './components/SettingsModal.js';
import { SessionBanner } from './components/SessionBanner.js';
import { CatalogPanel } from './components/CatalogPanel.js';
import { FolderManagerModal } from './components/FolderManagerModal.js';
import { EditSongModal } from './components/EditSongModal.js';
import { SongDetailsModal } from './components/SongDetailsModal.js';
import {
  SettingsDTO,
  UpdateSettingsDTO,
  SessionDTO,
  MediaFolderDTO,
  SongDTO,
} from '@karaoke/contracts';
import { AlertOctagon, ListOrdered, Play } from 'lucide-react';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionDTO | null>(null);
  const [folders, setFolders] = useState<MediaFolderDTO[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState<boolean>(false);
  const [editingSong, setEditingSong] = useState<SongDTO | null>(null);
  const [detailsSong, setDetailsSong] = useState<SongDTO | null>(null);
  const [scanProgress, setScanProgress] = useState<{
    folderId: string;
    discovered: number;
    processed: number;
    errors: number;
    status: string;
    currentFile?: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<string>('Catálogo local listo.');

  const refreshFolders = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.listFolders();
    if (res.success) {
      setFolders(res.data);
    }
  };

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

          await refreshFolders();

          // Suscribirse a progreso de escaneo
          window.karaokeAPI.onScanProgress((payload: unknown) => {
            const p = payload as {
              folderId: string;
              discovered: number;
              processed: number;
              errors: number;
              status: string;
              currentFile?: string;
            };
            setScanProgress(p);
            if (p.status === 'COMPLETED') {
              setNotification(`Escaneo completado: ${p.processed} archivos procesados.`);
              refreshFolders();
            } else if (p.status === 'CANCELLED') {
              setNotification('Escaneo cancelado por el operador.');
              refreshFolders();
            }
          });
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

  const handleSelectFolder = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.selectFolder();
    if (res.success && res.data) {
      const folder = res.data;
      setNotification(`Carpeta "${folder.displayName}" autorizada.`);
      await refreshFolders();
      // Iniciar escaneo automático inicial
      await window.karaokeAPI.scanFolder(folder.id);
    }
  };

  const handleScanFolder = async (folderId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.scanFolder(folderId);
    if (res.success) {
      setNotification('Escaneo iniciado en segundo plano...');
    }
  };

  const handleRemoveFolder = async (folderId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.removeFolder(folderId);
    if (res.success) {
      setNotification('Carpeta desautorizada.');
      await refreshFolders();
    }
  };

  const handleSaveSongMetadata = async (songId: string, title: string, artist: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.updateSong({ songId, title, artist });
    if (res.success) {
      setNotification(`Metadatos guardados: "${artist} - ${title}".`);
    }
  };

  const handleLocateInExplorer = async (mediaAssetId: string) => {
    if (!window.karaokeAPI) return;
    await window.karaokeAPI.locateInExplorer(mediaAssetId);
  };

  const handleReanalyze = async (mediaAssetId: string) => {
    if (!window.karaokeAPI) return;
    await window.karaokeAPI.reanalyzeAsset(mediaAssetId);
    setNotification('Activo reanalizado con ffprobe.');
    if (detailsSong && detailsSong.asset?.id === mediaAssetId) {
      setDetailsSong(null);
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
        {/* Panel 1: Catálogo Local con búsqueda y carpetas */}
        <CatalogPanel
          folders={folders}
          onOpenFolderManager={() => setIsFolderManagerOpen(true)}
          onEditSong={(song) => setEditingSong(song)}
          onViewDetails={(song) => setDetailsSong(song)}
          scanProgress={scanProgress}
        />

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
                La máquina de estados de cantantes y asignación de canciones se implementará en la Fase 3.
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

      <FolderManagerModal
        isOpen={isFolderManagerOpen}
        folders={folders}
        onClose={() => setIsFolderManagerOpen(false)}
        onSelectFolder={handleSelectFolder}
        onScanFolder={handleScanFolder}
        onRemoveFolder={handleRemoveFolder}
      />

      <EditSongModal
        song={editingSong}
        isOpen={!!editingSong}
        onClose={() => setEditingSong(null)}
        onSave={handleSaveSongMetadata}
      />

      <SongDetailsModal
        song={detailsSong}
        isOpen={!!detailsSong}
        onClose={() => setDetailsSong(null)}
        onLocateInExplorer={handleLocateInExplorer}
        onReanalyze={handleReanalyze}
      />
    </div>
  );
};
