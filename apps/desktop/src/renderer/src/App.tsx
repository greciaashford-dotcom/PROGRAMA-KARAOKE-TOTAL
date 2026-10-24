import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { SettingsModal } from './components/SettingsModal.js';
import { SessionBanner } from './components/SessionBanner.js';
import { CatalogPanel } from './components/CatalogPanel.js';
import { QueuePanel } from './components/QueuePanel.js';
import { PlayerPanel } from './components/PlayerPanel.js';
import { FolderManagerModal } from './components/FolderManagerModal.js';
import { EditSongModal } from './components/EditSongModal.js';
import { SongDetailsModal } from './components/SongDetailsModal.js';
import { AddToQueueModal } from './components/AddToQueueModal.js';
import { AddSingerModal } from './components/AddSingerModal.js';
import { SetupWizardModal } from './components/SetupWizardModal.js';
import {
  SettingsDTO,
  UpdateSettingsDTO,
  SessionDTO,
  MediaFolderDTO,
  SongDTO,
  UpdateSongDTO,
  QueueItemDTO,
  SingerDTO,
  QueueStatus,
} from '@karaoke/contracts';
import { AlertOctagon, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PlayerPrepareResult } from '../../preload/types.js';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionDTO | null>(null);
  const [folders, setFolders] = useState<MediaFolderDTO[]>([]);
  const [queue, setQueue] = useState<QueueItemDTO[]>([]);
  const [singers, setSingers] = useState<SingerDTO[]>([]);
  const [previousOrder, setPreviousOrder] = useState<string[] | null>(null);
  const [preparedTrack, setPreparedTrack] = useState<PlayerPrepareResult | null>(null);
  const [isPublicScreenOpen, setIsPublicScreenOpen] = useState<boolean>(false);
  const [catalogRefreshTrigger, setCatalogRefreshTrigger] = useState<number>(0);
  const [emergencyStopSignal, setEmergencyStopSignal] = useState<number>(0);

  // Modales
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState<boolean>(false);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
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
  const [notification, setNotification] = useState<string>('Consola lista para reproducir.');
  const [toast, setToast] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

  const showNotice = (msg: string, type: 'info' | 'error' = 'info') => {
    setNotification(msg);
    setToast({ text: msg, type });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshFolders = async () => {
    if (!window.karaokeAPI) return [];
    const res = await window.karaokeAPI.listFolders();
    if (res.success) {
      setFolders(res.data);
      return res.data;
    }
    return [];
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

          const loadedFolders = await refreshFolders();
          if (loadedFolders.length === 0) {
            setIsWizardOpen(true);
          }

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
              showNotice(`Escaneo completado: ${p.processed ?? 0} archivos listos.`);
              refreshFolders();
              setCatalogRefreshTrigger((n) => n + 1);
            } else if (p.status === 'CANCELLED') {
              showNotice('Escaneo cancelado por el operador.');
              refreshFolders();
            }
          });

          // Suscribirse a actualizaciones de cola (validando siempre que items sea array)
          window.karaokeAPI.onQueueUpdated((payload) => {
            if (payload && Array.isArray(payload.items)) {
              setQueue(payload.items);
            }
          });

          // Estado inicial de la pantalla pública
          const pubStatusRes = await window.karaokeAPI.getPublicWindowStatus();
          if (pubStatusRes.success && pubStatusRes.data) {
            setIsPublicScreenOpen(pubStatusRes.data.isOpen);
          }

          // Escuchar cambios de pantallas en caliente
          window.karaokeAPI.onMonitorsChanged(() => {
            showNotice('Monitores actualizados (cambio en caliente detectado).');
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
      showNotice('Configuración guardada en SQLite.');
    }
  };

  const handleOpenSession = async (name: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.openSession(name);
    if (res.success) {
      setCurrentSession(res.data);
      showNotice(`Sesión "${res.data.name}" abierta.`);
      await refreshQueue(res.data.id);
      await refreshSingers(res.data.id);
    }
  };

  const handlePauseSession = async (sessionId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.pauseSession(sessionId);
    if (res.success) {
      setCurrentSession(res.data);
      showNotice(`Sesión "${res.data.name}" en pausa.`);
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.resumeSession(sessionId);
    if (res.success) {
      setCurrentSession(res.data);
      showNotice(`Sesión "${res.data.name}" reanudada.`);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.closeSession(sessionId);
    if (res.success) {
      setCurrentSession(null);
      setQueue([]);
      setSingers([]);
      showNotice('Sesión finalizada.');
    }
  };

  const handleSelectFolder = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.selectFolder();
    if (res.success && res.data) {
      const folder = res.data;
      showNotice(`Carpeta "${folder.displayName}" autorizada. Escaneando...`);
      await refreshFolders();
      await window.karaokeAPI.scanFolder(folder.id);
    }
  };

  const handleScanFolder = async (folderId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.scanFolder(folderId);
    if (res.success) {
      showNotice('Escaneo iniciado en segundo plano...');
      await refreshFolders();
    }
  };

  const handleCancelScan = async (folderId: string) => {
    if (!window.karaokeAPI) return;
    await window.karaokeAPI.cancelScan(folderId);
    showNotice('Cancelando escaneo...');
    await refreshFolders();
  };

  const handleToggleFolder = async (folderId: string, enabled: boolean) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.toggleFolder(folderId, enabled);
    if (res.success) {
      showNotice(
        enabled
          ? `Carpeta "${res.data.displayName}" habilitada en el catálogo.`
          : `Carpeta "${res.data.displayName}" ocultada temporalmente.`,
      );
      await refreshFolders();
      setCatalogRefreshTrigger((n) => n + 1);
    }
  };

  const handleRemoveFolder = async (folderId: string) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.removeFolder(folderId);
    if (res.success) {
      showNotice('Carpeta desautorizada.');
      await refreshFolders();
      setCatalogRefreshTrigger((n) => n + 1);
    }
  };

  const handleSaveSongMetadata = async (updates: UpdateSongDTO) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.updateSong(updates);
    if (res.success) {
      showNotice(`Metadatos actualizados: "${updates.artist} — ${updates.title}".`);
      setCatalogRefreshTrigger((n) => n + 1);
    }
  };

  const handleLocateInExplorer = async (mediaAssetId: string) => {
    if (!window.karaokeAPI) return;
    await window.karaokeAPI.locateInExplorer(mediaAssetId);
  };

  const handleReanalyze = async (mediaAssetId: string) => {
    if (!window.karaokeAPI) return;
    await window.karaokeAPI.reanalyzeAsset(mediaAssetId);
    showNotice('Archivo reanalizado con ffprobe.');
    setCatalogRefreshTrigger((n) => n + 1);
    if (detailsSong && detailsSong.asset?.id === mediaAssetId) {
      setDetailsSong(null);
    }
  };

  // Reproducción directa en 1 clic desde el Catálogo
  const handlePlayNowFromCatalog = async (song: SongDTO) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.previewAsset({
      mediaAssetId: song.mediaAssetId,
      sessionId: currentSession?.id ?? null,
    });

    if (res.success) {
      setPreparedTrack(res.data);
      await window.karaokeAPI.sendPlayerCommand({ command: 'PLAY' });
      showNotice(`Reproduciendo ahora: ${res.data.title} — ${res.data.artist}`);
    } else {
      showNotice(res.error.message, 'error');
      setCatalogRefreshTrigger((n) => n + 1);
    }
  };

  // Cantantes
  const handleCreateSinger = async (
    displayName: string,
    tableOrLocation?: string,
    notes?: string,
  ): Promise<SingerDTO | null> => {
    if (!window.karaokeAPI || !currentSession) return null;
    const res = await window.karaokeAPI.createSinger({
      sessionId: currentSession.id,
      displayName,
      tableOrLocation,
      notes,
    });
    if (res.success) {
      await refreshSingers(currentSession.id);
      showNotice(`Cantante "${displayName}" registrado.`);
      return res.data;
    }
    return null;
  };

  // Cola
  const handleAddToQueue = async (
    songId: string,
    singerId: string,
    keyShift: number,
    tempoPercent: number,
  ) => {
    if (!window.karaokeAPI || !currentSession) {
      showNotice('Abre una sesión primero para añadir canciones a la cola.', 'error');
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
      showNotice(`Canción añadida al turno #${res.data.position}.`);
      await refreshQueue(currentSession.id);
    } else {
      showNotice(res.error.message, 'error');
    }
  };

  const handleReorderList = async (orderedIds: string[]) => {
    if (!window.karaokeAPI || !currentSession) return;
    const res = await window.karaokeAPI.reorderQueue({
      sessionId: currentSession.id,
      orderedItemIds: orderedIds,
    });
    if (res.success) {
      setPreviousOrder(res.data.previousOrder);
      showNotice('Orden de la cola actualizado.');
      await refreshQueue(currentSession.id);
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

    await handleReorderList(newOrder.map((i) => i.id));
  };

  const handleUndoReorder = async () => {
    if (!window.karaokeAPI || !currentSession || !previousOrder) return;
    const res = await window.karaokeAPI.undoReorder({
      sessionId: currentSession.id,
      previousOrderedItemIds: previousOrder,
    });

    if (res.success) {
      setPreviousOrder(null);
      showNotice('Orden anterior restaurado.');
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
      showNotice(`Turno #${res.data.position} cambiado a ${nextStatus}.`);
      await refreshQueue(currentSession.id);
    } else {
      showNotice(res.error.message, 'error');
    }
  };

  const handlePrepareTrack = async (item: QueueItemDTO) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.preparePlayer({
      sessionId: item.sessionId,
      queueItemId: item.id,
    });
    if (res.success) {
      setPreparedTrack(res.data);
      showNotice(`Pista cargada y lista: ${res.data.title} (${res.data.singerName})`);
      if (currentSession) {
        await refreshQueue(currentSession.id);
      }
    } else {
      showNotice(`Error al preparar pista: ${res.error.message}`, 'error');
    }
  };

  const handlePlayQueueItemNow = async (item: QueueItemDTO) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.preparePlayer({
      sessionId: item.sessionId,
      queueItemId: item.id,
    });
    if (res.success) {
      setPreparedTrack(res.data);
      await window.karaokeAPI.sendPlayerCommand({ command: 'PLAY' });
      showNotice(`En directo: ${res.data.title} — Cantante: ${res.data.singerName}`);
      if (currentSession) {
        await refreshQueue(currentSession.id);
      }
    } else {
      showNotice(`Error al reproducir pista: ${res.error.message}`, 'error');
    }
  };

  const handleSkipTrack = async () => {
    if (!window.karaokeAPI) return;
    if (preparedTrack?.queueItemId && currentSession) {
      try {
        await window.karaokeAPI.transitionQueue({
          queueItemId: preparedTrack.queueItemId,
          nextStatus: 'SKIPPED',
          failureReason: 'Saltada por el operador desde el reproductor',
        });
      } catch {
        // Ignorar
      }
    }

    const safeQueue = Array.isArray(queue) ? queue : [];
    const nextItem = safeQueue.find(
      (i) =>
        i.id !== preparedTrack?.queueItemId &&
        !['COMPLETED', 'CANCELLED', 'SKIPPED', 'FAILED'].includes(i.status),
    );

    if (nextItem) {
      await handlePlayQueueItemNow(nextItem);
    } else {
      await window.karaokeAPI.sendPlayerCommand({ command: 'STOP' });
      setPreparedTrack(null);
      showNotice('Pista saltada. No hay más turnos pendientes en la cola.');
      if (currentSession) await refreshQueue(currentSession.id);
    }
  };

  const handleEmergencyStop = async () => {
    setEmergencyStopSignal((s) => s + 1);
    if (window.karaokeAPI) {
      await window.karaokeAPI.emergencyStop();
      if (currentSession) {
        await refreshQueue(currentSession.id);
      }
    }
    showNotice('¡PARADA DE EMERGENCIA ACTIVADA! Vídeo y audio cortados.', 'error');
  };

  const handleTogglePublicScreen = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.togglePublicWindow();
    if (res.success && res.data) {
      setIsPublicScreenOpen(res.data.isOpen);
      showNotice(
        res.data.isOpen
          ? 'Pantalla pública abierta.'
          : 'Pantalla pública cerrada.',
      );
    }
  };

  const handleRescuePublicScreen = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.rescuePublicWindow();
    if (res.success) {
      setIsPublicScreenOpen(true);
      showNotice('Pantalla pública rescatada en el monitor principal del operador.');
    }
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
        isPublicScreenOpen={isPublicScreenOpen}
        onTogglePublicScreen={handleTogglePublicScreen}
        onRescuePublicScreen={handleRescuePublicScreen}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenWizard={() => setIsWizardOpen(true)}
      />

      <div style={{ padding: '8px 16px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <SessionBanner
          currentSession={currentSession}
          onOpenSession={handleOpenSession}
          onPauseSession={handlePauseSession}
          onResumeSession={handleResumeSession}
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
          onPlayNow={handlePlayNowFromCatalog}
          onCancelScan={handleCancelScan}
          refreshTrigger={catalogRefreshTrigger}
          onAddToQueue={(song) => {
            if (!currentSession) {
              showNotice(
                'Abre una sesión arriba para encolar cantantes, o pulsa "Play" para reproducir el vídeo directamente.',
                'error',
              );
              return;
            }
            setAddingToQueueSong(song);
          }}
          scanProgress={scanProgress}
        />

        {/* Panel 2: Cola de Actuaciones */}
        <QueuePanel
          sessionId={currentSession?.id}
          queue={queue}
          singers={singers}
          hasUndo={!!previousOrder}
          onUndoReorder={handleUndoReorder}
          onMoveItem={handleMoveItem}
          onReorderList={handleReorderList}
          onTransitionItem={handleTransitionItem}
          onPrepareForPlayback={handlePrepareTrack}
          onPlayQueueItemNow={handlePlayQueueItemNow}
          onOpenAddSinger={() => setIsAddSingerOpen(true)}
        />

        {/* Panel 3: Reproductor y Control en Vivo */}
        <PlayerPanel
          queue={queue}
          onRefreshQueue={async () => {
            if (currentSession) await refreshQueue(currentSession.id);
          }}
          onNotification={(msg, type) => showNotice(msg, type)}
          preparedTrack={preparedTrack}
          onSetPreparedTrack={setPreparedTrack}
          onSkipTrack={handleSkipTrack}
          ambientVolume={settings?.ambientVolume ?? 35}
          onSaveAmbientVolume={(vol) => {
            window.karaokeAPI?.updateSettings({ ambientVolume: vol });
          }}
          catalogRefreshTrigger={catalogRefreshTrigger}
          emergencyStopSignal={emergencyStopSignal}
        />
      </main>

      <footer className="footer-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toast?.type === 'error' ? (
            <AlertTriangle size={15} color="var(--status-error)" />
          ) : (
            <CheckCircle2 size={15} color="var(--status-ready)" />
          )}
          <span
            style={{
              fontSize: '12px',
              color: toast?.type === 'error' ? 'var(--status-error)' : 'var(--text-secondary)',
              fontWeight: toast ? 600 : 400,
            }}
          >
            {notification}
          </span>
        </div>

        <button
          className="btn btn-emergency"
          onClick={handleEmergencyStop}
          title="Parada inmediata de sonido y vídeo en directo (Esc / F12)"
          style={{
            height: '28px',
            minHeight: '28px',
            padding: '0 10px',
            fontSize: '11px',
            fontWeight: 700,
            gap: '5px',
          }}
        >
          <AlertOctagon size={14} />
          Parada de Emergencia (Esc)
        </button>
      </footer>

      <SetupWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        settings={settings}
        folders={folders}
        currentSession={currentSession}
        scanProgress={scanProgress}
        onSaveSettings={handleSaveSettings}
        onSelectFolder={handleSelectFolder}
        onOpenSession={handleOpenSession}
      />

      {settings && (
        <SettingsModal
          settings={settings}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
          onRescuePublicScreen={handleRescuePublicScreen}
        />
      )}

      <FolderManagerModal
        isOpen={isFolderManagerOpen}
        folders={folders}
        onClose={() => setIsFolderManagerOpen(false)}
        onSelectFolder={handleSelectFolder}
        onScanFolder={handleScanFolder}
        onCancelScan={handleCancelScan}
        onToggleFolder={handleToggleFolder}
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
