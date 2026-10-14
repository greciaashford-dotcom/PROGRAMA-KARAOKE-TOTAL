import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { SettingsModal } from './components/SettingsModal.js';
import { SessionBanner } from './components/SessionBanner.js';
import { CatalogPanel } from './components/CatalogPanel.js';
import { QueuePanel } from './components/QueuePanel.js';
import { FolderManagerModal } from './components/FolderManagerModal.js';
import { EditSongModal } from './components/EditSongModal.js';
import { SongDetailsModal } from './components/SongDetailsModal.js';
import { AddToQueueModal } from './components/AddToQueueModal.js';
import { AddSingerModal } from './components/AddSingerModal.js';
import {
  SettingsDTO,
  UpdateSettingsDTO,
  SessionDTO,
  MediaFolderDTO,
  SongDTO,
  QueueItemDTO,
  SingerDTO,
  QueueStatus,
} from '@karaoke/contracts';
import { AlertOctagon, Play } from 'lucide-react';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionDTO | null>(null);
  const [folders, setFolders] = useState<MediaFolderDTO[]>([]);
  const [queue, setQueue] = useState<QueueItemDTO[]>([]);
  const [singers, setSingers] = useState<SingerDTO[]>([]);
  const [previousOrder, setPreviousOrder] = useState<string[] | null>(null);

  // Modales
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState<boolean>(false);
  const [editingSong, setEditingSong] = useState<SongDTO | null>(null);
  const [detailsSong, setDetailsSong] = useState<SongDTO | null>(null);
  const [addingToQueueSong, setAddingToQueueSong] = useState<SongDTO | null>(null);
  const [isAddSingerOpen, setIsAddSingerOpen] = useState<boolean>(false);

  // Escaneo en vivo
  const [scanProgress, setScanProgress] = useState<{
    folderId: string;
    discovered: number;
    processed: number;
    errors: number;
    status: string;
    currentFile?: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<string>('Consola lista para directo.');

  const refreshFolders = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.listFolders();
    if (res.success) {
      setFolders(res.data);
    }
  };

  const refreshQueue = async (sessionId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.getQueue(sessionId);
    if (res.success) {
      setQueue(res.data);
    }
  };

  const refreshSingers = async (sessionId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.listSingers(sessionId);
    if (res.success) {
      setSingers(res.data);
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
          if (sessionRes.success && sessionRes.data) {
            setCurrentSession(sessionRes.data);
            await refreshQueue(sessionRes.data.id);
            await refreshSingers(sessionRes.data.id);
          }

          await refreshFolders();

          // Suscribirse a eventos de escaneo
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

          // Suscribirse a actualizaciones de cola
          window.karaokeAPI.onQueueUpdated((payload) => {
            setQueue(payload.items);
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
      await refreshQueue(res.data.id);
      await refreshSingers(res.data.id);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.closeSession(sessionId);
    if (res.success) {
      setCurrentSession(null);
      setQueue([]);
      setSingers([]);
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

  // Cantantes
  const handleCreateSinger = async (displayName: string, tableOrLocation?: string, notes?: string): Promise<SingerDTO | null> => {
    if (!window.karaokeAPI || !currentSession) return null;
    const res = await window.karaokeAPI.createSinger({
      sessionId: currentSession.id,
      displayName,
      tableOrLocation,
      notes,
    });
    if (res.success) {
      await refreshSingers(currentSession.id);
      setNotification(`Cantante "${displayName}" registrado.`);
      return res.data;
    }
    return null;
  };

  // Cola
  const handleAddToQueue = async (songId: string, singerId: string, keyShift: number, tempoPercent: number) => {
    if (!window.karaokeAPI || !currentSession) {
      alert('Debes abrir una sesión antes de añadir canciones a la cola.');
      return;
    }

    const res = await window.karaokeAPI.addToQueue({
      sessionId: currentSession.id,
      songId,
      singerId,
      keyShift,
      tempoPercent,
    });

    if (res.success) {
      setNotification(`Canción añadida al turno #${res.data.position}.`);
      await refreshQueue(currentSession.id);
    } else {
      alert(res.error.message);
    }
  };

  const handleMoveItem = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!window.karaokeAPI || !currentSession) return;
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= queue.length) return;

    const newOrder = [...queue];
    const item = newOrder[index]!;
    newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, item);

    const orderedIds = newOrder.map((i) => i.id);
    const res = await window.karaokeAPI.reorderQueue({
      sessionId: currentSession.id,
      orderedItemIds: orderedIds,
    });

    if (res.success) {
      setPreviousOrder(res.data.previousOrder);
      setNotification('Orden de la cola actualizado.');
      await refreshQueue(currentSession.id);
    }
  };

  const handleUndoReorder = async () => {
    if (!window.karaokeAPI || !currentSession || !previousOrder) return;
    const res = await window.karaokeAPI.undoReorder({
      sessionId: currentSession.id,
      previousOrderedItemIds: previousOrder,
    });

    if (res.success) {
      setPreviousOrder(null);
      setNotification('Orden anterior restaurado.');
      await refreshQueue(currentSession.id);
    }
  };

  const handleTransitionItem = async (itemId: string, nextStatus: QueueStatus, reason?: string) => {
    if (!window.karaokeAPI || !currentSession) return;
    const res = await window.karaokeAPI.transitionQueue({
      queueItemId: itemId,
      nextStatus,
      failureReason: reason,
    });

    if (res.success) {
      setNotification(`Turno #${res.data.position} cambiado a ${nextStatus}.`);
      await refreshQueue(currentSession.id);
    } else {
      alert(res.error.message);
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
        {/* Panel 1: Catálogo Local */}
        <CatalogPanel
          folders={folders}
          onOpenFolderManager={() => setIsFolderManagerOpen(true)}
          onEditSong={(song) => setEditingSong(song)}
          onViewDetails={(song) => setDetailsSong(song)}
          onAddToQueue={(song) => {
            if (!currentSession) {
              alert('Debes abrir una sesión antes de asignar canciones a cantantes.');
              return;
            }
            setAddingToQueueSong(song);
          }}
          scanProgress={scanProgress}
        />

        {/* Panel 2: Cola de Actuaciones */}
        <QueuePanel
          queue={queue}
          hasUndo={!!previousOrder}
          onUndoReorder={handleUndoReorder}
          onMoveItem={handleMoveItem}
          onTransitionItem={handleTransitionItem}
        />

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

      <AddToQueueModal
        song={addingToQueueSong}
        singers={singers}
        isOpen={!!addingToQueueSong}
        onClose={() => setAddingToQueueSong(null)}
        onAddToQueue={handleAddToQueue}
        onCreateSinger={async (name, table) => handleCreateSinger(name, table)}
      />

      <AddSingerModal
        isOpen={isAddSingerOpen}
        onClose={() => setIsAddSingerOpen(false)}
        onAddSinger={handleCreateSinger}
      />
    </div>
  );
};
