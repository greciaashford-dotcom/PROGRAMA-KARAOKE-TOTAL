import React, { useState, useEffect, useRef } from 'react';
import {
  PlaybackSnapshotDTO,
  PlaybackStatus,
  QueueItemDTO,
  SessionDTO,
} from '@karaoke/contracts';
import { Mic, Disc, Clock, Music } from 'lucide-react';

export const PublicScreen: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackStatus>('IDLE');
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string | null>(null);
  const [currentQueueItem, setCurrentQueueItem] = useState<QueueItemDTO | null>(null);
  const [nextQueueItem, setNextQueueItem] = useState<QueueItemDTO | null>(null);
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [showIntroBanner, setShowIntroBanner] = useState<boolean>(true);
  const [isCursorHidden, setIsCursorHidden] = useState<boolean>(false);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reloj local en tiempo real para pantalla de cortesía
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Ocultar cursor del ratón tras 2 segundos de inactividad
  useEffect(() => {
    const handleMouseMove = () => {
      setIsCursorHidden(false);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
      cursorTimeoutRef.current = setTimeout(() => {
        setIsCursorHidden(true);
      }, 2000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
    };
  }, []);

  // Cargar estado inicial y suscribirse a eventos
  useEffect(() => {
    const initPublicState = async () => {
      if (!window.karaokeAPI) return;

      const sessionRes = await window.karaokeAPI.getCurrentSession();
      if (sessionRes.success && sessionRes.data) {
        setSession(sessionRes.data);
        const queueRes = await window.karaokeAPI.getQueue(sessionRes.data.id);
        if (queueRes.success) {
          updateQueueItems(queueRes.data);
        }
      }

      const playerRes = await window.karaokeAPI.getPlayerState();
      if (playerRes.success && playerRes.data) {
        handleSnapshot(playerRes.data);
      }
    };

    initPublicState();

    const unsubPlayer = window.karaokeAPI.onPlayerStateChanged((snapshot: PlaybackSnapshotDTO) => {
      handleSnapshot(snapshot);
    });

    const unsubQueue = window.karaokeAPI.onQueueUpdated((payload) => {
      if (payload && payload.items) {
        updateQueueItems(payload.items);
      }
    });

    return () => {
      unsubPlayer();
      unsubQueue();
    };
  }, []);

  const updateQueueItems = (items: QueueItemDTO[]) => {
    const activePlaying = items.find((i) => i.status === 'PLAYING' || i.status === 'READY');
    if (activePlaying) {
      setCurrentQueueItem(activePlaying);
    }

    const pending = items.filter(
      (i) => !['COMPLETED', 'CANCELLED', 'SKIPPED', 'PLAYING'].includes(i.status),
    );
    setNextQueueItem(pending[0] || null);
  };

  const handleSnapshot = (snapshot: PlaybackSnapshotDTO) => {
    setPlaybackState(snapshot.state);

    if (snapshot.mediaAssetId) {
      const url = `karaoke-media://asset/${snapshot.mediaAssetId}`;
      if (currentMediaUrl !== url) {
        setCurrentMediaUrl(url);
        setShowIntroBanner(true);
        // Ocultar banner de presentación tras 6 segundos
        setTimeout(() => {
          setShowIntroBanner(false);
        }, 6000);
      }
    } else {
      setCurrentMediaUrl(null);
    }

    if (videoRef.current) {
      videoRef.current.volume = snapshot.volume / 100;

      if (snapshot.state === 'PLAYING') {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(console.error);
        }
        // Resincronizar si hay desvío superior a 1.5s
        const drift = Math.abs(videoRef.current.currentTime * 1000 - snapshot.positionMs);
        if (drift > 1500) {
          videoRef.current.currentTime = snapshot.positionMs / 1000;
        }
      } else if (snapshot.state === 'PAUSED') {
        if (!videoRef.current.paused) {
          videoRef.current.pause();
        }
      } else if (snapshot.state === 'STOPPED' || snapshot.state === 'IDLE') {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  };

  /**
   * INNEGOCIABLE: La pista finaliza al recibir el evento nativo del DOM HTML5 'ended'.
   */
  const handleNativeEnded = async () => {
    if (currentQueueItem) {
      await window.karaokeAPI.reportPlayerEnded(currentQueueItem.id);
    }
  };

  const isVideoVisible =
    (playbackState === 'PLAYING' || playbackState === 'PAUSED' || playbackState === 'READY') &&
    !!currentMediaUrl;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isCursorHidden ? 'none' : 'default',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      {/* 1. Reproducción de Vídeo a Pantalla Completa */}
      {currentMediaUrl && (
        <video
          ref={videoRef}
          src={currentMediaUrl}
          playsInline
          onEnded={handleNativeEnded}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: isVideoVisible ? 'block' : 'none',
          }}
        />
      )}

      {/* Banner de Presentación Inicial (Fade out tras 6s) */}
      {isVideoVisible && showIntroBanner && currentQueueItem?.song && currentQueueItem?.singer && (
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '40px',
            backgroundColor: 'rgba(10, 12, 16, 0.85)',
            backdropFilter: 'blur(10px)',
            borderLeft: '5px solid var(--accent-warm, #f59e0b)',
            padding: '16px 24px',
            borderRadius: '0 8px 8px 0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            animation: 'fadeIn 0.5s ease-out',
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: '14px', textTransform: 'uppercase', color: '#f59e0b', fontWeight: 700, letterSpacing: '1px' }}>
            En Directo
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px' }}>
            {currentQueueItem.song.title}
          </div>
          <div style={{ fontSize: '20px', color: '#cbd5e1' }}>
            {currentQueueItem.song.artist}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '16px', color: '#93c5fd' }}>
            <Mic size={18} />
            <span>Cantante: <strong>{currentQueueItem.singer.displayName}</strong></span>
          </div>
        </div>
      )}

      {/* 2. Pantalla de Cortesía y Espera (Ambiental entre canciones) */}
      {!isVideoVisible && (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at center, #181d26 0%, #080a0d 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '48px 64px',
            boxSizing: 'border-box',
          }}
        >
          {/* Cabecera de la Sala */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  backgroundColor: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#18181b',
                }}
              >
                <Disc size={36} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                  {session ? session.name : 'KARAOKE TOTAL'}
                </h1>
                <div style={{ fontSize: '16px', color: '#94a3b8', marginTop: '2px' }}>
                  Consola de Directo — Escenario Principal
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '26px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>
              <Clock size={28} color="#38bdf8" />
              <span>{currentTimeStr}</span>
            </div>
          </div>

          {/* Zona Central: Próxima Actuación o Mensaje de Bienvenida */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '40px 48px',
              maxWidth: '850px',
              margin: '0 auto',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              textAlign: 'center',
            }}
          >
            {nextQueueItem?.song && nextQueueItem?.singer ? (
              <>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontSize: '15px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    marginBottom: '20px',
                  }}
                >
                  <Mic size={18} />
                  A continuación en el escenario
                </div>

                <div style={{ fontSize: '42px', fontWeight: 900, color: '#f8fafc', marginBottom: '8px' }}>
                  {nextQueueItem.singer.displayName}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '24px', color: '#cbd5e1' }}>
                  <Music size={22} color="#f59e0b" />
                  <span>
                    <strong>{nextQueueItem.song.title}</strong> — {nextQueueItem.song.artist}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '38px', fontWeight: 800, color: '#f8fafc', marginBottom: '12px' }}>
                  ¡El escenario está listo!
                </div>
                <div style={{ fontSize: '20px', color: '#94a3b8' }}>
                  Pide tu canción en la cabina del operador para subir a cantar.
                </div>
              </>
            )}
          </div>

          {/* Pie de Pantalla de Cortesía */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '15px',
              color: '#64748b',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              paddingTop: '20px',
            }}
          >
            <span>Karaoke Total — Audio y Vídeo de Alta Definición</span>
          </div>
        </div>
      )}
    </div>
  );
};
