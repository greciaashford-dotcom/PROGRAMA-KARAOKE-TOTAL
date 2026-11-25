import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  PlaybackStatus,
} from '@karaoke/contracts';
import {
  Monitor,
  LifeBuoy,
  AlertOctagon,
  Disc,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  PlayerPrepareResult,
  VolumesStoreDTO,
  PublicOverlayStateDTO,
} from '../../preload/types.js';
import { AmbientColumn } from './components/AmbientColumn.js';
import { CenterMonitorColumn } from './components/CenterMonitorColumn.js';
import { RightControlColumn } from './components/RightControlColumn.js';
import { BottomQueueAndEffects } from './components/BottomQueueAndEffects.js';
import { CatalogModal } from './components/CatalogModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { FolderManagerModal } from './components/FolderManagerModal.js';
import { EditSongModal } from './components/EditSongModal.js';
import { QuickMessageModal } from './components/QuickMessageModal.js';
import { EditQueueItemModal } from './components/EditQueueItemModal.js';
import { SetupWizardModal } from './components/SetupWizardModal.js';
import {
  playApplause,
  playCheers,
  playLaughter,
  stopAllEffects,
} from './utils/sound-effects.js';
import { cleanDisplayTitle } from './utils/title-cleaner.js';

const DEFAULT_VOLUMES: VolumesStoreDTO = {
  songs: {},
  ambientVolume: 35,
  applauseVolume: 80,
  karaokeDefaultVolume: 85,
  masterVolume: 100,
  autoSaveSongVolume: false,
  autoKaraokeEnabled: false,
  autoKaraokeDelaySec: 20,
  publicBackgroundPath: null,
};

export const App: React.FC = () => {
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [volumesStore, setVolumesStore] = useState<VolumesStoreDTO>(DEFAULT_VOLUMES);
  const [currentSession, setCurrentSession] = useState<SessionDTO | null>(null);
  const [folders, setFolders] = useState<MediaFolderDTO[]>([]);
  const [queue, setQueue] = useState<QueueItemDTO[]>([]);
  const [singers, setSingers] = useState<SingerDTO[]>([]);
  const [preparedTrack, setPreparedTrack] = useState<PlayerPrepareResult | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackStatus>('IDLE');
  const [isPublicScreenOpen, setIsPublicScreenOpen] = useState<boolean>(false);
  const [catalogRefreshTrigger, setCatalogRefreshTrigger] = useState<number>(0);

  // Audio estrictamente secuencial (CROSSFADE: OFF)
  const [karaokeVolume, setKaraokeVolume] = useState<number>(85);
  const [ambientVolume, setAmbientVolume] = useState<number>(35);
  const [masterVolume, setMasterVolume] = useState<number>(100);
  const [applauseVolume, setApplauseVolume] = useState<number>(80);
  const [karaokeMuted, setKaraokeMuted] = useState<boolean>(false);
  const [ambientMuted, setAmbientMuted] = useState<boolean>(false);
  const [masterMuted, setMasterMuted] = useState<boolean>(false);
  const [pitchSemitones, setPitchSemitones] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Señales de coordinación secuencial (MP3 <-> Aplausos <-> Karaoke)
  const [ambientForceStopSignal, setAmbientForceStopSignal] = useState<number>(0);
  const [ambientAutoStartSignal, setAmbientAutoStartSignal] = useState<number>(0);
  const [karaokeStopSignal, setKaraokeStopSignal] = useState<number>(0);
  const [isApplauseActive, setIsApplauseActive] = useState<boolean>(false);
  const [isAnyEffectActive, setIsAnyEffectActive] = useState<boolean>(false);
  const manualStopGuardRef = useRef<boolean>(false);

  // Auto Karaoke (SOLO COLA) + Cuenta regresiva
  const [autoKaraokeEnabled, setAutoKaraokeEnabled] = useState<boolean>(false);
  const [autoKaraokeDelaySec, setAutoKaraokeDelaySec] = useState<number>(20);
  const [countdownRemainingSec, setCountdownRemainingSec] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<QueueItemDTO[]>([]);
  const autoKaraokeEnabledRef = useRef<boolean>(false);
  const autoKaraokeDelayRef = useRef<number>(20);
  const volumesStoreRef = useRef<VolumesStoreDTO>(DEFAULT_VOLUMES);

  // Estado compartido con Pantalla Pública
  const [publicOverlay, setPublicOverlay] = useState<PublicOverlayStateDTO>({
    mode: 'IDLE',
    countdownSec: null,
    singerName: null,
    songTitle: null,
    quickMessage: null,
    hasCustomBackground: false,
    backgroundVersion: 0,
  });

  // Modales
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState<boolean>(false);
  const [isQuickMessageOpen, setIsQuickMessageOpen] = useState<boolean>(false);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [editingSong, setEditingSong] = useState<SongDTO | null>(null);
  const [editingQueueItem, setEditingQueueItem] = useState<QueueItemDTO | null>(null);

  // Escaneo + Reloj + Avisos
  const [scanProgress, setScanProgress] = useState<{
    folderId: string;
    discovered: number;
    processed: number;
    errors: number;
    status: string;
    currentFile?: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [clockText, setClockText] = useState<string>('');
  const [notification, setNotification] = useState<{ text: string; type: 'info' | 'error' }>({
    text: 'Katakana Karaoke listo para operar.',
    type: 'info',
  });

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    autoKaraokeEnabledRef.current = autoKaraokeEnabled;
  }, [autoKaraokeEnabled]);

  useEffect(() => {
    autoKaraokeDelayRef.current = autoKaraokeDelaySec;
  }, [autoKaraokeDelaySec]);

  useEffect(() => {
    volumesStoreRef.current = volumesStore;
  }, [volumesStore]);

  const showNotice = useCallback((text: string, type: 'info' | 'error' = 'info') => {
    setNotification({ text, type });
  }, []);

  // Reloj en vivo
  useEffect(() => {
    const tick = () => {
      setClockText(
        new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const broadcastOverlayState = useCallback((partial: Partial<PublicOverlayStateDTO>) => {
    setPublicOverlay((prev) => {
      const next = { ...prev, ...partial };
      window.karaokeAPI?.broadcastPublicOverlay(next).catch(() => {});
      return next;
    });
  }, []);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownRemainingSec(null);
  }, []);

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

  const ensureActiveSession = async (): Promise<SessionDTO | null> => {
    if (currentSession) return currentSession;
    if (!window.karaokeAPI) return null;
    const res = await window.karaokeAPI.openSession('Katakana Karaoke');
    if (res.success) {
      setCurrentSession(res.data);
      await refreshQueue(res.data.id);
      await refreshSingers(res.data.id);
      return res.data;
    }
    return null;
  };

  // Inicialización de la app
  useEffect(() => {
    const init = async () => {
      try {
        if (!window.karaokeAPI) return;

        const [settingsRes, volumesRes, sessionRes, pubRes] = await Promise.all([
          window.karaokeAPI.getSettings(),
          window.karaokeAPI.getVolumes(),
          window.karaokeAPI.getCurrentSession(),
          window.karaokeAPI.getPublicWindowStatus(),
        ]);

        if (settingsRes.success && settingsRes.data) {
          setSettings(settingsRes.data);
          setKaraokeMuted(Boolean(settingsRes.data.karaokeMuted));
          setAmbientMuted(Boolean(settingsRes.data.ambientMuted));
          setMasterMuted(Boolean(settingsRes.data.masterMuted));
        }

        if (volumesRes.success && volumesRes.data) {
          const v = volumesRes.data;
          setVolumesStore(v);
          setKaraokeVolume(v.karaokeDefaultVolume);
          setAmbientVolume(v.ambientVolume);
          setMasterVolume(v.masterVolume);
          setApplauseVolume(v.applauseVolume);
          setAutoKaraokeEnabled(v.autoKaraokeEnabled);
          setAutoKaraokeDelaySec(v.autoKaraokeDelaySec);
          setPublicOverlay((prev) => ({
            ...prev,
            hasCustomBackground: Boolean(v.publicBackgroundPath),
            backgroundVersion: Date.now(),
          }));
        }

        if (sessionRes.success && sessionRes.data) {
          setCurrentSession(sessionRes.data);
          await refreshQueue(sessionRes.data.id);
          await refreshSingers(sessionRes.data.id);
        } else {
          // Abrir sesión por defecto para que la cola esté lista de inmediato sin fricción
          const opened = await window.karaokeAPI.openSession('Katakana Karaoke');
          if (opened.success) {
            setCurrentSession(opened.data);
          }
        }

        if (pubRes.success && pubRes.data) {
          setIsPublicScreenOpen(pubRes.data.isOpen);
        }

        const loadedFolders = await refreshFolders();
        if (loadedFolders.length === 0) {
          setIsWizardOpen(true);
        }

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
            showNotice(`Escaneo completado: ${p.processed ?? 0} canciones listas.`);
            refreshFolders();
            setCatalogRefreshTrigger((n) => n + 1);
          } else if (p.status === 'CANCELLED') {
            showNotice('Escaneo cancelado.');
            refreshFolders();
          }
        });

        window.karaokeAPI.onQueueUpdated((payload) => {
          if (payload && Array.isArray(payload.items)) {
            setQueue(payload.items);
          }
        });

        window.karaokeAPI.onMonitorsChanged(() => {
          showNotice('Monitores actualizados.');
        });
      } catch (err) {
        console.error('Error inicializando consola Katakana:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => {
      clearCountdownTimer();
      stopAllEffects();
    };
  }, [clearCountdownTimer, showNotice]);

  // Obtener siguiente turno pendiente EXCLUSIVAMENTE de la Cola (Activos)
  const getNextPendingQueueItem = useCallback((items: QueueItemDTO[], excludeId?: string | null) => {
    return (
      items.find(
        (i) =>
          i.id !== excludeId &&
          !['COMPLETED', 'CANCELLED', 'SKIPPED', 'FAILED', 'PLAYING'].includes(i.status),
      ) || null
    );
  }, []);

  const nextQueuedItem = getNextPendingQueueItem(queue, preparedTrack?.queueItemId);

  // Cargar volumen memorizado de una pista si existe en volumes.json
  const applyVolumeForTrack = useCallback((mediaAssetId: string) => {
    const store = volumesStoreRef.current;
    const savedVol = store.songs[mediaAssetId];
    if (savedVol !== undefined) {
      setKaraokeVolume(savedVol);
      return savedVol;
    }
    setKaraokeVolume(store.karaokeDefaultVolume);
    return store.karaokeDefaultVolume;
  }, []);

  // Lanzar un turno específico de la Cola (AUDIO ESTRICTAMENTE SECUENCIAL: para MP3 y efectos antes de arrancar Karaoke)
  const handleLaunchQueueItem = useCallback(
    async (item: QueueItemDTO) => {
      if (!window.karaokeAPI) return;
      manualStopGuardRef.current = false;
      clearCountdownTimer();

      // 1. Detener por completo MP3 de ambiente y cualquier efecto (SIN crossfade / SIN solapamiento)
      stopAllEffects();
      setIsApplauseActive(false);
      setIsAnyEffectActive(false);
      setAmbientForceStopSignal((n) => n + 1);

      const res = await window.karaokeAPI.preparePlayer({
        sessionId: item.sessionId,
        queueItemId: item.id,
      });

      if (res.success) {
        const appliedVol = applyVolumeForTrack(res.data.mediaAssetId);
        setPreparedTrack(res.data);
        setPitchSemitones(res.data.keyShift || 0);
        setPlaybackSpeed(1);
        setPlaybackState('PLAYING');

        broadcastOverlayState({
          mode: 'IDLE',
          countdownSec: null,
          singerName: res.data.singerName,
          songTitle: cleanDisplayTitle(res.data.title),
        });

        await window.karaokeAPI.sendPlayerCommand({ command: 'PLAY' });
        showNotice(
          `En escenario: ${res.data.singerName} — ${cleanDisplayTitle(res.data.title)} (Vol: ${appliedVol}%, Tono: ${res.data.keyShift >= 0 ? `+${res.data.keyShift}` : res.data.keyShift})`,
        );
        await refreshQueue(item.sessionId);
      } else {
        showNotice(res.error.message, 'error');
      }
    },
    [applyVolumeForTrack, broadcastOverlayState, clearCountdownTimer, showNotice],
  );

  // Iniciar cuenta regresiva de Auto Karaoke (SOLO COLA; jamás del catálogo)
  const startAutoKaraokeCountdown = useCallback(
    (targetItem: QueueItemDTO) => {
      clearCountdownTimer();
      const delay = autoKaraokeDelayRef.current;

      if (delay <= 0) {
        handleLaunchQueueItem(targetItem);
        return;
      }

      let remaining = delay;
      setCountdownRemainingSec(remaining);
      broadcastOverlayState({
        mode: 'COUNTDOWN',
        countdownSec: remaining,
        singerName: targetItem.singer?.displayName || 'Cantante',
        songTitle: cleanDisplayTitle(targetItem.song?.title),
      });

      countdownTimerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearCountdownTimer();
          // Verificar que el turno siga activo en la cola antes de lanzarlo
          const latestNext = getNextPendingQueueItem(queueRef.current);
          if (latestNext && autoKaraokeEnabledRef.current) {
            handleLaunchQueueItem(latestNext);
          } else {
            broadcastOverlayState({ mode: 'IDLE', countdownSec: null });
          }
        } else {
          setCountdownRemainingSec(remaining);
          broadcastOverlayState({
            mode: 'COUNTDOWN',
            countdownSec: remaining,
            singerName: targetItem.singer?.displayName || 'Cantante',
            songTitle: cleanDisplayTitle(targetItem.song?.title),
          });
        }
      }, 1000);
    },
    [broadcastOverlayState, clearCountdownTimer, getNextPendingQueueItem, handleLaunchQueueItem],
  );

  // Si Auto Karaoke está ON, no hubo parada manual reciente, no hay karaoke ni aplausos sonando,
  // no hay countdown corriendo, y hay un turno en la cola -> iniciar cuenta regresiva automáticamente
  useEffect(() => {
    if (
      autoKaraokeEnabled &&
      !manualStopGuardRef.current &&
      playbackState !== 'PLAYING' &&
      playbackState !== 'PAUSED' &&
      playbackState !== 'STOPPED' &&
      !isApplauseActive &&
      countdownRemainingSec === null &&
      nextQueuedItem
    ) {
      startAutoKaraokeCountdown(nextQueuedItem);
    }
  }, [
    autoKaraokeEnabled,
    playbackState,
    isApplauseActive,
    countdownRemainingSec,
    nextQueuedItem,
    startAutoKaraokeCountdown,
  ]);

  // Al terminar un Karaoke de forma natural:
  // 1) Detener Karaoke por completo -> 2) Reproducir Aplausos SOLO -> 3) Detener Aplausos -> 4) Iniciar MP3 de golpe + Cuenta regresiva si hay Cola y Auto Karaoke ON
  const handleNativeTrackEnded = useCallback(
    async (finishedTrack: PlayerPrepareResult) => {
      if (!window.karaokeAPI) return;
      const finishedTitle = cleanDisplayTitle(finishedTrack.title);
      const finishedSinger = finishedTrack.singerName;

      // 1) Detener Karaoke por completo
      await window.karaokeAPI.reportPlayerEnded(finishedTrack.queueItemId);
      setPreparedTrack(null);
      setPlaybackState('ENDED');

      if (currentSession) {
        await refreshQueue(currentSession.id);
      }

      // 2) Reproducir Aplausos SOLO a su volumen memorizado (sin MP3 superpuesto)
      const effApplause = masterMuted
        ? 0
        : Math.max(0, Math.min(1, (applauseVolume / 100) * (masterVolume / 100)));

      setIsApplauseActive(true);
      setIsAnyEffectActive(true);
      showNotice(`👏 ¡Aplausos para ${finishedSinger} — ${finishedTitle}!`);

      playApplause(6000, effApplause, () => {
        // 3) Aplausos terminaron por completo -> 4) Iniciar Música de Ambiente MP3 de golpe
        setIsApplauseActive(false);
        setIsAnyEffectActive(false);
        setAmbientAutoStartSignal((n) => n + 1);

        // Si Auto Karaoke está ON y hay turnos en la Cola (NUNCA del catálogo), iniciar cuenta regresiva
        const nextFromQueue = getNextPendingQueueItem(queueRef.current);
        if (autoKaraokeEnabledRef.current && nextFromQueue) {
          startAutoKaraokeCountdown(nextFromQueue);
        } else {
          broadcastOverlayState({
            mode: 'IDLE',
            countdownSec: null,
            singerName: nextFromQueue?.singer?.displayName || null,
            songTitle: nextFromQueue ? cleanDisplayTitle(nextFromQueue.song?.title) : null,
          });
        }
      });
    },
    [
      applauseVolume,
      broadcastOverlayState,
      currentSession,
      getNextPendingQueueItem,
      masterMuted,
      masterVolume,
      showNotice,
      startAutoKaraokeCountdown,
    ],
  );

  // Reproducción directa desde el Catálogo (Modal)
  const handlePlayNowFromCatalog = async (song: SongDTO) => {
    if (!window.karaokeAPI) return;
    clearCountdownTimer();
    stopAllEffects();
    setIsApplauseActive(false);
    setIsAnyEffectActive(false);
    setAmbientForceStopSignal((n) => n + 1);

    const res = await window.karaokeAPI.previewAsset({
      mediaAssetId: song.mediaAssetId,
      sessionId: currentSession?.id ?? null,
    });

    if (res.success) {
      applyVolumeForTrack(res.data.mediaAssetId);
      setPreparedTrack(res.data);
      setPitchSemitones(0);
      setPlaybackSpeed(1);
      setPlaybackState('PLAYING');
      broadcastOverlayState({
        mode: 'IDLE',
        countdownSec: null,
        singerName: 'Katakana Karaoke',
        songTitle: cleanDisplayTitle(res.data.title),
      });
      await window.karaokeAPI.sendPlayerCommand({ command: 'PLAY' });
      showNotice(`Reproduciendo: ${cleanDisplayTitle(res.data.title)}`);
    } else {
      showNotice(res.error.message, 'error');
    }
  };

  // Botón "Lanzar / Iniciar" central
  const handleLaunchNextOrPlay = useCallback(async () => {
    if (nextQueuedItem && (!preparedTrack || playbackState === 'IDLE' || playbackState === 'ENDED' || playbackState === 'STOPPED')) {
      await handleLaunchQueueItem(nextQueuedItem);
      return;
    }
    if (preparedTrack && playbackState !== 'PLAYING') {
      clearCountdownTimer();
      stopAllEffects();
      setIsApplauseActive(false);
      setIsAnyEffectActive(false);
      setAmbientForceStopSignal((n) => n + 1);
      setPlaybackState('PLAYING');
      await window.karaokeAPI?.sendPlayerCommand({ command: 'PLAY' });
      return;
    }
    if (nextQueuedItem) {
      await handleLaunchQueueItem(nextQueuedItem);
      return;
    }
    showNotice('No hay turnos en la Cola. Abre el Catálogo (F2) para agregar una canción.');
  }, [clearCountdownTimer, handleLaunchQueueItem, nextQueuedItem, playbackState, preparedTrack, showNotice]);

  const handleTogglePlayPause = useCallback(async () => {
    if (!window.karaokeAPI) return;
    if (!preparedTrack) {
      await handleLaunchNextOrPlay();
      return;
    }
    if (playbackState === 'PLAYING') {
      setPlaybackState('PAUSED');
      await window.karaokeAPI.sendPlayerCommand({ command: 'PAUSE' });
      showNotice('Karaoke en pausa.');
    } else {
      stopAllEffects();
      setIsApplauseActive(false);
      setIsAnyEffectActive(false);
      setAmbientForceStopSignal((n) => n + 1);
      setPlaybackState('PLAYING');
      await window.karaokeAPI.sendPlayerCommand({ command: 'PLAY' });
      showNotice(`Reanudado: ${cleanDisplayTitle(preparedTrack.title)}`);
    }
    if (currentSession) await refreshQueue(currentSession.id);
  }, [currentSession, handleLaunchNextOrPlay, playbackState, preparedTrack, showNotice]);

  const handleStopKaraoke = useCallback(async () => {
    if (!window.karaokeAPI) return;
    manualStopGuardRef.current = true;
    clearCountdownTimer();
    stopAllEffects();
    setIsApplauseActive(false);
    setIsAnyEffectActive(false);
    setAmbientForceStopSignal((n) => n + 1);
    setKaraokeStopSignal((n) => n + 1);
    setPreparedTrack(null);
    setPlaybackState('STOPPED');
    broadcastOverlayState({ mode: 'IDLE', countdownSec: null });
    await window.karaokeAPI.sendPlayerCommand({ command: 'STOP' });
    showNotice('Reproducción detenida por completo.');
    if (currentSession) await refreshQueue(currentSession.id);
  }, [broadcastOverlayState, clearCountdownTimer, currentSession, showNotice]);

  const handleEmergencyStop = useCallback(async () => {
    manualStopGuardRef.current = true;
    clearCountdownTimer();
    stopAllEffects();
    setIsApplauseActive(false);
    setIsAnyEffectActive(false);
    setAmbientForceStopSignal((n) => n + 1);
    setKaraokeStopSignal((n) => n + 1);
    setPlaybackState('STOPPED');
    setPreparedTrack(null);
    broadcastOverlayState({ mode: 'IDLE', countdownSec: null });
    if (window.karaokeAPI) {
      await window.karaokeAPI.emergencyStop();
      if (currentSession) await refreshQueue(currentSession.id);
    }
    showNotice('¡PARADA DE EMERGENCIA! Todo el audio y vídeo ha sido cortado.', 'error');
  }, [broadcastOverlayState, clearCountdownTimer, currentSession, showNotice]);

  // Atajos globales: F2 / Ctrl+B -> Abrir Catálogo, Espacio -> Play/Pausa, Esc / F12 -> Parada de Emergencia
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F2' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        setIsCatalogModalOpen((open) => !open);
        return;
      }

      if (e.code === 'F12') {
        e.preventDefault();
        handleEmergencyStop();
        return;
      }

      if (e.code === 'Escape') {
        if (isCatalogModalOpen || isSettingsOpen || isFolderManagerOpen || isQuickMessageOpen || editingQueueItem || editingSong) {
          setIsCatalogModalOpen(false);
          setIsSettingsOpen(false);
          setIsFolderManagerOpen(false);
          setIsQuickMessageOpen(false);
          setEditingQueueItem(null);
          setEditingSong(null);
          return;
        }
        e.preventDefault();
        handleEmergencyStop();
        return;
      }

      const tag = document.activeElement?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.code === 'Space' && !isCatalogModalOpen && !isSettingsOpen && !isQuickMessageOpen) {
        e.preventDefault();
        handleTogglePlayPause();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    editingQueueItem,
    editingSong,
    handleEmergencyStop,
    handleTogglePlayPause,
    isCatalogModalOpen,
    isFolderManagerOpen,
    isQuickMessageOpen,
    isSettingsOpen,
  ]);

  // Volúmenes memorizados (volumes.json)
  const handleKaraokeVolumeChange = (vol: number) => {
    setKaraokeVolume(vol);
    if (karaokeMuted && vol > 0) setKaraokeMuted(false);
    if (preparedTrack && volumesStore.autoSaveSongVolume) {
      window.karaokeAPI?.saveSongVolume(preparedTrack.mediaAssetId, vol).then((res) => {
        if (res.success) setVolumesStore(res.data);
      });
    }
  };

  const handleMemorizeCurrentVolume = async () => {
    if (!preparedTrack || !window.karaokeAPI) return;
    const res = await window.karaokeAPI.saveSongVolume(preparedTrack.mediaAssetId, karaokeVolume);
    if (res.success) {
      setVolumesStore(res.data);
      showNotice(
        `Volumen ${karaokeVolume}% memorizado para "${cleanDisplayTitle(preparedTrack.title)}".`,
      );
    }
  };

  const handleAmbientVolumeChange = (vol: number) => {
    setAmbientVolume(vol);
    if (ambientMuted && vol > 0) setAmbientMuted(false);
    window.karaokeAPI?.saveGlobalVolumes({ ambientVolume: vol }).then((res) => {
      if (res.success) setVolumesStore(res.data);
    });
    window.karaokeAPI?.updateSettings({ ambientVolume: vol, ambientMuted: false });
  };

  const handleMasterVolumeChange = (vol: number) => {
    setMasterVolume(vol);
    if (masterMuted && vol > 0) setMasterMuted(false);
    window.karaokeAPI?.saveGlobalVolumes({ masterVolume: vol }).then((res) => {
      if (res.success) setVolumesStore(res.data);
    });
    window.karaokeAPI?.updateSettings({ masterVolume: vol, masterMuted: false });
  };

  const handleApplauseVolumeChange = (vol: number) => {
    setApplauseVolume(vol);
    window.karaokeAPI?.saveGlobalVolumes({ applauseVolume: vol }).then((res) => {
      if (res.success) setVolumesStore(res.data);
    });
  };

  const handleToggleAutoKaraoke = (enabled: boolean) => {
    if (enabled) manualStopGuardRef.current = false;
    setAutoKaraokeEnabled(enabled);
    window.karaokeAPI?.saveGlobalVolumes({ autoKaraokeEnabled: enabled }).then((res) => {
      if (res.success) setVolumesStore(res.data);
    });
    if (!enabled) {
      clearCountdownTimer();
      broadcastOverlayState({ mode: 'IDLE', countdownSec: null });
      showNotice('Auto Karaoke desactivado.');
    } else {
      showNotice('Auto Karaoke activado (solo canciones de la Cola).');
    }
  };

  const handleChangeAutoKaraokeDelay = (sec: number) => {
    setAutoKaraokeDelaySec(sec);
    window.karaokeAPI?.saveGlobalVolumes({ autoKaraokeDelaySec: sec }).then((res) => {
      if (res.success) setVolumesStore(res.data);
    });
  };

  // Encolar canción desde el Modal de Catálogo (con Cantante + Tono -6..+6)
  const handleEnqueueWithSingerAndPitch = async (
    song: SongDTO,
    singerName: string,
    keyShift: number,
  ) => {
    if (!window.karaokeAPI) return;
    const session = await ensureActiveSession();
    if (!session) {
      showNotice('No se pudo abrir sesión para encolar.', 'error');
      return;
    }

    let singer = singers.find(
      (s) => s.displayName.trim().toLowerCase() === singerName.trim().toLowerCase(),
    );

    if (!singer) {
      const created = await window.karaokeAPI.createSinger({
        sessionId: session.id,
        displayName: singerName.trim(),
      });
      if (!created.success) {
        showNotice(created.error.message, 'error');
        return;
      }
      singer = created.data;
      await refreshSingers(session.id);
    }

    const addRes = await window.karaokeAPI.addToQueue({
      sessionId: session.id,
      songId: song.id,
      singerId: singer.id,
      keyShift,
      tempoPercent: 100,
    });

    if (addRes.success) {
      manualStopGuardRef.current = false;
      showNotice(
        `Agregado a la Cola (#${addRes.data.position}): ${singer.displayName} — ${cleanDisplayTitle(song.title)} (Tono ${keyShift >= 0 ? `+${keyShift}` : keyShift})`,
      );
      await refreshQueue(session.id);
    } else {
      showNotice(addRes.error.message, 'error');
    }
  };

  // Editar turno en cola (Cantante / Tono)
  const handleSaveQueueItemEdit = async (
    queueItemId: string,
    singerName: string,
    keyShift: number,
  ) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.updateQueueItem({
      queueItemId,
      singerName,
      keyShift,
    });
    if (res.success) {
      if (preparedTrack?.queueItemId === queueItemId) {
        setPitchSemitones(keyShift);
      }
      if (currentSession) {
        await refreshQueue(currentSession.id);
        await refreshSingers(currentSession.id);
      }
      showNotice(`Turno actualizado: ${singerName} (Tono ${keyShift >= 0 ? `+${keyShift}` : keyShift})`);
    }
  };

  const handleMoveQueueItem = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!window.karaokeAPI || !currentSession) return;
    const target = direction === 'UP' ? index - 1 : index + 1;
    if (target < 0 || target >= queue.length) return;
    const nextOrder = [...queue];
    const [moved] = nextOrder.splice(index, 1);
    if (!moved) return;
    nextOrder.splice(target, 0, moved);
    const res = await window.karaokeAPI.reorderQueue({
      sessionId: currentSession.id,
      orderedItemIds: nextOrder.map((i) => i.id),
    });
    if (res.success) await refreshQueue(currentSession.id);
  };

  const handleRemoveQueueItem = async (item: QueueItemDTO) => {
    if (!window.karaokeAPI || !currentSession) return;
    // Si el turno que se quita es el que está sonando o cargado, detener la reproducción limpiamente primero
    if (preparedTrack?.queueItemId === item.id || item.status === 'PLAYING') {
      manualStopGuardRef.current = true;
      clearCountdownTimer();
      stopAllEffects();
      setIsApplauseActive(false);
      setIsAnyEffectActive(false);
      setKaraokeStopSignal((n) => n + 1);
      setPreparedTrack(null);
      setPlaybackState('STOPPED');
      broadcastOverlayState({ mode: 'IDLE', countdownSec: null });
      await window.karaokeAPI.sendPlayerCommand({ command: 'STOP' });
    }
    const res = await window.karaokeAPI.transitionQueue({
      queueItemId: item.id,
      nextStatus: 'CANCELLED',
    });
    if (res.success) {
      await refreshQueue(currentSession.id);
      showNotice(`Turno quitado de la cola: ${cleanDisplayTitle(item.song?.title)}`);
    } else {
      showNotice(res.error.message, 'error');
    }
  };

  const handleTransitionQueueItem = async (itemId: string, nextStatus: QueueStatus) => {
    if (!window.karaokeAPI || !currentSession) return;
    const res = await window.karaokeAPI.transitionQueue({ queueItemId: itemId, nextStatus });
    if (res.success) {
      await refreshQueue(currentSession.id);
    } else {
      showNotice(res.error.message, 'error');
    }
  };

  // Efectos rápidos manuales (respetando volumen memorizado de aplausos)
  const getEffectGain = () =>
    masterMuted ? 0 : Math.max(0, Math.min(1, (applauseVolume / 100) * (masterVolume / 100)));

  const triggerManualApplause = () => {
    setIsAnyEffectActive(true);
    setIsApplauseActive(true);
    showNotice('👏 Efecto: Aplausos en sala.');
    playApplause(6000, getEffectGain(), () => {
      setIsApplauseActive(false);
      setIsAnyEffectActive(false);
    });
  };

  const triggerManualCheers = () => {
    setIsAnyEffectActive(true);
    showNotice('🎉 Efecto: Ovaciones.');
    playCheers(getEffectGain(), () => setIsAnyEffectActive(false));
  };

  const triggerManualLaughter = () => {
    setIsAnyEffectActive(true);
    showNotice('😂 Efecto: Risas.');
    playLaughter(getEffectGain(), () => setIsAnyEffectActive(false));
  };

  // Gestión de carpetas y ajustes
  const handleSelectFolder = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.selectFolder();
    if (res.success && res.data) {
      showNotice(`Carpeta "${res.data.displayName}" agregada. Indexando...`);
      await refreshFolders();
      await window.karaokeAPI.scanFolder(res.data.id);
    }
  };

  const handleSaveSettings = async (updates: UpdateSettingsDTO) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.updateSettings(updates);
    if (res.success) {
      setSettings(res.data);
      showNotice('Configuración guardada.');
    }
  };

  const handleSaveGlobalVolumes = async (updates: Partial<Omit<VolumesStoreDTO, 'songs'>>) => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.saveGlobalVolumes(updates);
    if (res.success) {
      setVolumesStore(res.data);
      setMasterVolume(res.data.masterVolume);
      setAmbientVolume(res.data.ambientVolume);
      setApplauseVolume(res.data.applauseVolume);
      if (!preparedTrack) setKaraokeVolume(res.data.karaokeDefaultVolume);
    }
  };

  const handleSelectPublicBackground = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.selectPublicBackground();
    if (res.success) {
      setVolumesStore(res.data);
      setPublicOverlay((prev) => ({
        ...prev,
        hasCustomBackground: Boolean(res.data.publicBackgroundPath),
        backgroundVersion: Date.now(),
      }));
      showNotice('Imagen de fondo de Pantalla Pública actualizada.');
    }
  };

  const handleResetPublicBackground = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.resetPublicBackground();
    if (res.success) {
      setVolumesStore(res.data);
      setPublicOverlay((prev) => ({
        ...prev,
        hasCustomBackground: false,
        backgroundVersion: Date.now(),
      }));
      showNotice('Fondo oficial Katakana Karaoke restaurado.');
    }
  };

  const handleTogglePublicScreen = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.togglePublicWindow();
    if (res.success && res.data) {
      setIsPublicScreenOpen(res.data.isOpen);
      showNotice(res.data.isOpen ? 'Pantalla Pública abierta.' : 'Pantalla Pública cerrada.');
      if (res.data.isOpen) {
        setTimeout(() => {
          window.karaokeAPI?.broadcastPublicOverlay(publicOverlay).catch(() => {});
        }, 400);
      }
    }
  };

  const handleRescuePublicScreen = async () => {
    if (!window.karaokeAPI) return;
    const res = await window.karaokeAPI.rescuePublicWindow();
    if (res.success) {
      setIsPublicScreenOpen(true);
      showNotice('Pantalla Pública rescatada en el monitor principal.');
    }
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--ink-piano)',
          fontSize: '22px',
          fontWeight: 800,
        }}
      >
        Iniciando Katakana Karaoke...
      </div>
    );
  }

  const currentSongMemVol =
    preparedTrack && volumesStore.songs[preparedTrack.mediaAssetId] !== undefined
      ? volumesStore.songs[preparedTrack.mediaAssetId]!
      : null;

  const isAudioBlockedForAmbient = playbackState === 'PLAYING' || isAnyEffectActive;

  return (
    <div className="katakana-app">
      {/* Barra Superior (Negro Piano 30%) */}
      <header className="katakana-topbar">
        <div className="katakana-brand">
          <Disc size={26} color="#00C2B5" />
          <span>Katakana Karaoke</span>
          <span className="katakana-brand-pill">KARAOKE TOTAL</span>
        </div>

        {/* Estado operativo en vivo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '15px',
            fontWeight: 700,
            color: notification.type === 'error' ? '#fca5a5' : '#e4d7bc',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '40vw',
          }}
        >
          {notification.type === 'error' ? (
            <AlertTriangle size={18} color="#f87171" style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={18} color="#00C2B5" style={{ flexShrink: 0 }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{notification.text}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={`btn btn-compact ${isPublicScreenOpen ? 'btn-surf' : ''}`}
            onClick={handleTogglePublicScreen}
            style={{ minHeight: '38px' }}
          >
            <Monitor size={18} />
            {isPublicScreenOpen ? 'Pantalla Pública: ACTIVA' : 'Abrir Pantalla Pública'}
          </button>

          {isPublicScreenOpen && (
            <button
              type="button"
              className="btn btn-compact"
              onClick={handleRescuePublicScreen}
              title="Rescatar Pantalla Pública al monitor principal"
              style={{ minWidth: '38px', padding: '0 8px' }}
            >
              <LifeBuoy size={18} />
            </button>
          )}

          <div className="katakana-clock">{clockText}</div>

          <button
            type="button"
            className="btn btn-emergency btn-compact"
            onClick={handleEmergencyStop}
            title="Parada de emergencia inmediata (Esc / F12)"
          >
            <AlertOctagon size={17} />
            Emergencia
          </button>
        </div>
      </header>

      {/* 3 Columnas Principales */}
      <main className="katakana-main-grid">
        {/* COLUMNA IZQUIERDA: MÚSICA DE AMBIENTE (MP3) */}
        <AmbientColumn
          blockedByKaraokeOrEffects={isAudioBlockedForAmbient}
          forceStopSignal={ambientForceStopSignal}
          autoStartSignal={ambientAutoStartSignal}
          ambientVolume={ambientVolume}
          masterVolume={masterVolume}
          ambientMuted={ambientMuted}
          masterMuted={masterMuted}
          refreshTrigger={catalogRefreshTrigger}
          onChangeAmbientVolume={handleAmbientVolumeChange}
          onToggleAmbientMute={() => {
            const next = !ambientMuted;
            setAmbientMuted(next);
            window.karaokeAPI?.updateSettings({ ambientMuted: next });
          }}
          onNotification={showNotice}
        />

        {/* COLUMNA CENTRAL (PROTAGONISTA): MONITOR DE KARAOKE Y CONTROLES */}
        <CenterMonitorColumn
          preparedTrack={preparedTrack}
          playbackState={playbackState}
          stopSignal={karaokeStopSignal}
          onPlaybackStateChange={setPlaybackState}
          onNativeTrackEnded={handleNativeTrackEnded}
          onLaunchNextOrPlay={handleLaunchNextOrPlay}
          onTogglePlayPause={handleTogglePlayPause}
          onStopKaraoke={handleStopKaraoke}
          onOpenQuickMessage={() => setIsQuickMessageOpen(true)}
          karaokeVolume={karaokeVolume}
          masterVolume={masterVolume}
          karaokeMuted={karaokeMuted}
          masterMuted={masterMuted}
          isVolumeMemorized={currentSongMemVol !== null}
          memorizedVolumeValue={currentSongMemVol}
          pitchSemitones={pitchSemitones}
          playbackSpeed={playbackSpeed}
          isApplauseActive={isApplauseActive}
          publicOverlay={publicOverlay}
          nextQueuedItem={nextQueuedItem}
          onChangeKaraokeVolume={handleKaraokeVolumeChange}
          onToggleKaraokeMute={() => {
            const next = !karaokeMuted;
            setKaraokeMuted(next);
            window.karaokeAPI?.updateSettings({ karaokeMuted: next });
          }}
          onMemorizeCurrentVolume={handleMemorizeCurrentVolume}
          onChangePitch={setPitchSemitones}
          onChangeSpeed={setPlaybackSpeed}
          onNotification={showNotice}
        />

        {/* COLUMNA DERECHA: CATÁLOGO MODAL, AUTO KARAOKE, CONFIGURAR Y MEZCLADOR MINIATURA */}
        <RightControlColumn
          onOpenCatalogModal={() => setIsCatalogModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
          autoKaraokeEnabled={autoKaraokeEnabled}
          autoKaraokeDelaySec={autoKaraokeDelaySec}
          countdownRemainingSec={countdownRemainingSec}
          nextQueuedItem={nextQueuedItem}
          onToggleAutoKaraoke={handleToggleAutoKaraoke}
          onChangeAutoKaraokeDelay={handleChangeAutoKaraokeDelay}
          onStartCountdownNow={async () => {
            if (nextQueuedItem) await handleLaunchQueueItem(nextQueuedItem);
          }}
          onCancelCountdown={() => {
            clearCountdownTimer();
            broadcastOverlayState({ mode: 'IDLE', countdownSec: null });
            showNotice('Cuenta regresiva cancelada.');
          }}
          masterVolume={masterVolume}
          masterMuted={masterMuted}
          karaokeVolume={karaokeVolume}
          karaokeMuted={karaokeMuted}
          ambientVolume={ambientVolume}
          ambientMuted={ambientMuted}
          applauseVolume={applauseVolume}
          isCurrentSongMemorized={currentSongMemVol !== null}
          currentSongMemorizedVol={currentSongMemVol}
          memorizedCount={Object.keys(volumesStore.songs).length}
          onChangeMasterVolume={handleMasterVolumeChange}
          onToggleMasterMute={() => {
            const next = !masterMuted;
            setMasterMuted(next);
            window.karaokeAPI?.updateSettings({ masterMuted: next });
          }}
          onChangeApplauseVolume={handleApplauseVolumeChange}
        />
      </main>

      {/* PARTE INFERIOR (ANCHO COMPLETO): COLA DE ESCENARIO Y EFECTOS RÁPIDOS */}
      <BottomQueueAndEffects
        queue={queue}
        memorizedSongs={volumesStore.songs}
        defaultKaraokeVolume={volumesStore.karaokeDefaultVolume}
        onLaunchItem={handleLaunchQueueItem}
        onEditItem={(item) => setEditingQueueItem(item)}
        onRemoveItem={handleRemoveQueueItem}
        onMoveItem={handleMoveQueueItem}
        onRequeueItem={handleTransitionQueueItem}
        onTriggerApplause={triggerManualApplause}
        onTriggerCheers={triggerManualCheers}
        onTriggerLaughter={triggerManualLaughter}
      />

      {/* MODAL DEL CATÁLOGO LOCAL + SELECTOR DE CANTANTE Y TONO (-6 a +6) */}
      <CatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        folders={folders}
        singers={singers}
        memorizedSongs={volumesStore.songs}
        refreshTrigger={catalogRefreshTrigger}
        scanProgress={scanProgress}
        onOpenFolderManager={() => setIsFolderManagerOpen(true)}
        onPlayNow={handlePlayNowFromCatalog}
        onEnqueueWithSingerAndPitch={handleEnqueueWithSingerAndPitch}
        onEditSong={(song) => setEditingSong(song)}
      />

      {/* MODAL DE MENSAJE RÁPIDO EN PANTALLA PÚBLICA */}
      <QuickMessageModal
        isOpen={isQuickMessageOpen}
        currentMessage={publicOverlay.quickMessage}
        onClose={() => setIsQuickMessageOpen(false)}
        onSendMessage={async (msg) => {
          broadcastOverlayState({ quickMessage: msg });
          showNotice(msg ? `Mensaje en pantalla: "${msg}"` : 'Mensaje quitado de la Pantalla Pública.');
        }}
      />

      {/* MODAL DE EDICIÓN DE TURNO EN COLA */}
      <EditQueueItemModal
        item={editingQueueItem}
        isOpen={!!editingQueueItem}
        onClose={() => setEditingQueueItem(null)}
        onSave={handleSaveQueueItemEdit}
      />

      {/* MODAL DE CONFIGURACIÓN */}
      {settings && (
        <SettingsModal
          settings={settings}
          volumesStore={volumesStore}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
          onSaveGlobalVolumes={handleSaveGlobalVolumes}
          onSelectPublicBackground={handleSelectPublicBackground}
          onResetPublicBackground={handleResetPublicBackground}
          onOpenFolderManager={() => setIsFolderManagerOpen(true)}
          onRescuePublicScreen={handleRescuePublicScreen}
        />
      )}

      {/* MODAL DE GESTIÓN DE CARPETAS */}
      <FolderManagerModal
        isOpen={isFolderManagerOpen}
        folders={folders}
        onClose={() => setIsFolderManagerOpen(false)}
        onSelectFolder={handleSelectFolder}
        onScanFolder={async (folderId) => {
          await window.karaokeAPI?.scanFolder(folderId);
          showNotice('Reescaneando carpeta...');
          await refreshFolders();
        }}
        onCancelScan={async (folderId) => {
          await window.karaokeAPI?.cancelScan(folderId);
          await refreshFolders();
        }}
        onToggleFolder={async (folderId, enabled) => {
          await window.karaokeAPI?.toggleFolder(folderId, enabled);
          await refreshFolders();
          setCatalogRefreshTrigger((n) => n + 1);
        }}
        onRemoveFolder={async (folderId) => {
          const res = await window.karaokeAPI?.removeFolder(folderId);
          if (res?.success) {
            await refreshFolders();
            if (currentSession) await refreshQueue(currentSession.id);
            setCatalogRefreshTrigger((n) => n + 1);
            showNotice('Carpeta quitada del catálogo (tus archivos en disco siguen intactos).');
          } else if (res && !res.success) {
            showNotice(res.error.message, 'error');
          }
        }}
      />

      {/* MODAL DE EDICIÓN DE METADATOS DE CANCIÓN */}
      <EditSongModal
        song={editingSong}
        isOpen={!!editingSong}
        onClose={() => setEditingSong(null)}
        onSave={async (updates: UpdateSongDTO) => {
          const res = await window.karaokeAPI?.updateSong(updates);
          if (res?.success) {
            showNotice(`Canción actualizada: "${updates.title}".`);
            setCatalogRefreshTrigger((n) => n + 1);
          }
        }}
      />

      {/* ASISTENTE DE CONFIGURACIÓN INICIAL (SOLO SI NO HAY CARPETAS) */}
      <SetupWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        settings={settings}
        folders={folders}
        currentSession={currentSession}
        scanProgress={scanProgress}
        onSaveSettings={handleSaveSettings}
        onSelectFolder={handleSelectFolder}
        onOpenSession={async (name) => {
          const res = await window.karaokeAPI?.openSession(name);
          if (res?.success) setCurrentSession(res.data);
        }}
      />
    </div>
  );
};
