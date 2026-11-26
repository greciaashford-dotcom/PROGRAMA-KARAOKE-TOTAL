import React, { useState, useEffect, useRef } from 'react';
import { PlaybackSnapshotDTO, PlaybackStatus, QueueItemDTO } from '@karaoke/contracts';
import { PublicOverlayStateDTO } from '../../../preload/types.js';
import { cleanDisplayTitle, formatCountdownMMSS } from '../utils/title-cleaner.js';
import { Disc, Pause, Sparkles } from 'lucide-react';

/**
 * Pantalla Pública Unificada — Katakana Karaoke (100% Sincronizada con la Pantalla en Miniatura):
 * - Usa por defecto la imagen oficial assets/fondo_katakana.png (o imagen personalizada de Configurar).
 * - Antes de iniciar sesión (sessionActive === false): muestra el fondo general limpio.
 * - Al iniciar sesión (sessionActive === true): muestra "Solicita tu canción".
 * - Durante el conteo regresivo (mode === 'COUNTDOWN'): muestra cantante, canción y contador regresivo.
 * - Durante la reproducción de vídeo: sincroniza cuadro a cuadro el vídeo, velocidad, pausa, banner inicial y mensajes.
 */
export const PublicScreen: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackStatus>('IDLE');
  const playbackStateRef = useRef<PlaybackStatus>('IDLE');
  const positionMsRef = useRef<number>(0);

  const [currentMediaUrl, setCurrentMediaUrl] = useState<string | null>(null);
  const currentMediaUrlRef = useRef<string | null>(null);
  const [currentQueueItem, setCurrentQueueItem] = useState<QueueItemDTO | null>(null);
  const [nextQueueItem, setNextQueueItem] = useState<QueueItemDTO | null>(null);
  const [isAudioOnlyTrack, setIsAudioOnlyTrack] = useState<boolean>(false);
  const [isCursorHidden, setIsCursorHidden] = useState<boolean>(false);
  const [showIntroBanner, setShowIntroBanner] = useState<boolean>(false);

  const [overlay, setOverlay] = useState<PublicOverlayStateDTO>({
    mode: 'IDLE',
    sessionActive: false,
    countdownSec: null,
    singerName: null,
    songTitle: null,
    quickMessage: null,
    isApplauseActive: false,
    playbackSpeed: 1,
    hasCustomBackground: false,
    backgroundVersion: 0,
  });
  const overlayRef = useRef<PublicOverlayStateDTO>(overlay);

  useEffect(() => {
    overlayRef.current = overlay;
    if (videoRef.current && overlay.playbackSpeed) {
      videoRef.current.playbackRate = overlay.playbackSpeed;
      (videoRef.current as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch = true;
    }
  }, [overlay]);

  const cursorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ocultar cursor tras 2s de inactividad
  useEffect(() => {
    const handleMouseMove = () => {
      setIsCursorHidden(false);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
      cursorTimeoutRef.current = setTimeout(() => setIsCursorHidden(true), 2000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
    };
  }, []);

  const updateQueueItems = (items: QueueItemDTO[]) => {
    const activePlaying = items.find(
      (i) => i.status === 'PLAYING' || i.status === 'PAUSED' || i.status === 'READY',
    );
    setCurrentQueueItem(activePlaying || null);

    const pending = items.filter(
      (i) => !['COMPLETED', 'CANCELLED', 'SKIPPED', 'FAILED', 'PLAYING'].includes(i.status),
    );
    setNextQueueItem(pending[0] || null);
  };

  const handleSnapshot = (snapshot: PlaybackSnapshotDTO) => {
    playbackStateRef.current = snapshot.state;
    positionMsRef.current = snapshot.positionMs;
    setPlaybackState(snapshot.state);

    if (snapshot.mediaAssetId && (snapshot.state === 'PLAYING' || snapshot.state === 'PAUSED' || snapshot.state === 'READY')) {
      const url = `karaoke-media://asset/${snapshot.mediaAssetId}`;
      if (currentMediaUrlRef.current !== url) {
        currentMediaUrlRef.current = url;
        setCurrentMediaUrl(url);
        setIsAudioOnlyTrack(false);

        if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current);
        setShowIntroBanner(true);
        introTimeoutRef.current = setTimeout(() => {
          setShowIntroBanner(false);
        }, 5500);
      }
    } else if (snapshot.state === 'STOPPED' || snapshot.state === 'IDLE' || snapshot.state === 'ENDED') {
      currentMediaUrlRef.current = null;
      setCurrentMediaUrl(null);
      setShowIntroBanner(false);
    }

    if (videoRef.current) {
      videoRef.current.muted = true; // Audio maestro gestionado por la Consola (evita doble sonido y aplica pitch shift)
      const targetSpeed = overlayRef.current.playbackSpeed || 1;
      if (videoRef.current.playbackRate !== targetSpeed) {
        videoRef.current.playbackRate = targetSpeed;
      }

      if (snapshot.state === 'PLAYING') {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
        const drift = Math.abs(videoRef.current.currentTime * 1000 - snapshot.positionMs);
        if (drift > 300) {
          videoRef.current.currentTime = snapshot.positionMs / 1000;
        }
      } else if (snapshot.state === 'PAUSED') {
        if (!videoRef.current.paused) {
          videoRef.current.pause();
        }
        const drift = Math.abs(videoRef.current.currentTime * 1000 - snapshot.positionMs);
        if (drift > 100) {
          videoRef.current.currentTime = snapshot.positionMs / 1000;
        }
      } else if (
        snapshot.state === 'STOPPED' ||
        snapshot.state === 'IDLE' ||
        snapshot.state === 'ENDED'
      ) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!window.karaokeAPI) return;

      // 1. Hidratar inmediatamente el estado exacto del overlay desde el proceso principal
      const overlayRes = await window.karaokeAPI.broadcastPublicOverlay({});
      if (overlayRes.success && overlayRes.data) {
        setOverlay(overlayRes.data);
        overlayRef.current = overlayRes.data;
      } else {
        const volRes = await window.karaokeAPI.getVolumes();
        if (volRes.success && volRes.data) {
          setOverlay((prev) => ({
            ...prev,
            hasCustomBackground: Boolean(volRes.data.publicBackgroundPath),
            backgroundVersion: Date.now(),
          }));
        }
      }

      // 2. Hidratar cola si hay sesión activa
      const sessionRes = await window.karaokeAPI.getCurrentSession();
      if (sessionRes.success && sessionRes.data) {
        const queueRes = await window.karaokeAPI.getQueue(sessionRes.data.id);
        if (queueRes.success) updateQueueItems(queueRes.data);
      }

      // 3. Hidratar estado de reproducción y posición de vídeo actual
      const playerRes = await window.karaokeAPI.getPlayerState();
      if (playerRes.success && playerRes.data) {
        handleSnapshot(playerRes.data);
      }
    };

    init();

    const unsubPlayer = window.karaokeAPI.onPlayerStateChanged(handleSnapshot);
    const unsubQueue = window.karaokeAPI.onQueueUpdated((payload) => {
      if (payload && Array.isArray(payload.items)) {
        updateQueueItems(payload.items);
      }
    });
    const unsubOverlay = window.karaokeAPI.onPublicOverlayChanged((nextOverlay) => {
      setOverlay(nextOverlay);
      overlayRef.current = nextOverlay;
    });

    return () => {
      unsubPlayer();
      unsubQueue();
      unsubOverlay();
      if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current);
    };
  }, []);

  const handleCanPlay = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = true;
    videoRef.current.playbackRate = overlayRef.current.playbackSpeed || 1;
    (videoRef.current as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch = true;

    if (videoRef.current.videoWidth === 0 && videoRef.current.videoHeight === 0) {
      setIsAudioOnlyTrack(true);
    } else {
      setIsAudioOnlyTrack(false);
    }

    if (positionMsRef.current > 200) {
      videoRef.current.currentTime = positionMsRef.current / 1000;
    }

    if (playbackStateRef.current === 'PLAYING' && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
  };

  const isVideoActive =
    (playbackState === 'PLAYING' || playbackState === 'PAUSED') && !!currentMediaUrl;

  const bgImageSrc = overlay.hasCustomBackground
    ? `karaoke-media://background?v=${overlay.backgroundVersion}`
    : './assets/fondo_katakana.png';

  const activeSingerName =
    overlay.singerName || currentQueueItem?.singer?.displayName || null;
  const activeSongTitleClean = cleanDisplayTitle(
    overlay.songTitle || currentQueueItem?.song?.title || '',
  );

  const isCountdownActive = overlay.mode === 'COUNTDOWN' && overlay.countdownSec !== null;
  const displaySinger = isCountdownActive
    ? overlay.singerName || nextQueueItem?.singer?.displayName || null
    : null;
  const displaySongTitle = isCountdownActive
    ? cleanDisplayTitle(overlay.songTitle || nextQueueItem?.song?.title || '')
    : '';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
        overflow: 'hidden',
        position: 'relative',
        cursor: isCursorHidden ? 'none' : 'default',
      }}
    >
      {/* 1. Reproducción de Vídeo a Pantalla Completa Sincronizada */}
      {currentMediaUrl && (
        <video
          ref={videoRef}
          src={currentMediaUrl}
          muted
          playsInline
          onCanPlay={handleCanPlay}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: isVideoActive ? 'block' : 'none',
          }}
        />
      )}

      {/* Visualizador sobre fondo Katakana si la pista en reproducción es solo audio */}
      {isVideoActive && isAudioOnlyTrack && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
          <img
            src={bgImageSrc}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '34%',
              height: '54%',
              left: '9%',
              width: '82%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
              gap: '16px',
            }}
          >
            <Disc
              size={84}
              color="#F5C76B"
              className={playbackState === 'PLAYING' ? 'spin' : ''}
              style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.9))' }}
            />
            {activeSingerName && (
              <div
                style={{
                  fontSize: 'clamp(28px, 3.6vw, 54px)',
                  fontWeight: 700,
                  color: '#F5C76B',
                  textShadow: '0 4px 18px rgba(0,0,0,0.95)',
                }}
              >
                {activeSingerName}
              </div>
            )}
            <div
              style={{
                fontSize: 'clamp(36px, 5vw, 72px)',
                fontWeight: 800,
                color: '#FFFFFF',
                textShadow: '0 4px 20px rgba(0,0,0,0.95)',
                lineHeight: 1.15,
              }}
            >
              {activeSongTitleClean}
            </div>
          </div>
        </div>
      )}

      {/* Aviso discreto al inicio de vídeo (5.5s) sincronizado con Pantalla en Miniatura */}
      {isVideoActive && !isAudioOnlyTrack && showIntroBanner && activeSingerName && activeSongTitleClean && (
        <div
          style={{
            position: 'absolute',
            bottom: '44px',
            left: '48px',
            fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
            textShadow: '0 3px 16px rgba(0,0,0,0.98), 0 0 8px rgba(0,0,0,0.95)',
            zIndex: 15,
          }}
        >
          <div style={{ fontSize: '22px', color: '#F5C76B', fontWeight: 700, letterSpacing: '1px' }}>
            Cantado por:
          </div>
          <div style={{ fontSize: '42px', color: '#FFFFFF', fontWeight: 800, lineHeight: 1.1 }}>
            {activeSingerName}
          </div>
          <div style={{ fontSize: '30px', color: '#FFB830', fontWeight: 700, marginTop: '4px' }}>
            {activeSongTitleClean}
          </div>
        </div>
      )}

      {/* Indicador discreto de PAUSA sincronizado con Pantalla en Miniatura */}
      {isVideoActive && playbackState === 'PAUSED' && (
        <div
          style={{
            position: 'absolute',
            top: '36px',
            right: '44px',
            color: '#F5C76B',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '28px',
            fontWeight: 800,
            fontFamily: 'Georgia, Cambria, serif',
            textShadow: '0 3px 16px rgba(0,0,0,0.98)',
            zIndex: 20,
          }}
        >
          <Pause size={30} />
          <span>PAUSA</span>
        </div>
      )}

      {/* Mensaje Rápido del Operador superpuesto durante vídeo */}
      {isVideoActive && overlay.quickMessage && (
        <div
          style={{
            position: 'absolute',
            bottom: '34px',
            left: '9%',
            width: '82%',
            textAlign: 'center',
            fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
            fontSize: 'clamp(28px, 3.8vw, 54px)',
            fontWeight: 800,
            color: '#FFFFFF',
            textShadow: '0 4px 20px rgba(0,0,0,0.98), 0 0 12px rgba(0,0,0,0.95)',
            zIndex: 25,
          }}
        >
          {overlay.quickMessage}
        </div>
      )}

      {/* 2. Vista Unificada 100% Sincronizada con la Pantalla en Miniatura cuando no hay vídeo activo */}
      {!isVideoActive && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <img
            src={bgImageSrc}
            alt="Katakana Karaoke"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
              display: 'block',
            }}
          />

          {/* ZONA PROHIBIDA: 0% a 32% de altura -> 100% libre para logo Katakana KARAOKE, siluetas y onda dorada */}

          {/* ZONA LIBRE: 34% a 88% de altura, 82% de ancho centrado */}
          <div
            style={{
              position: 'absolute',
              top: '34%',
              height: '54%',
              left: '9%',
              width: '82%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: isCountdownActive ? 'space-between' : 'center',
              textAlign: 'center',
              fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
              padding: '1vh 0',
            }}
          >
            {overlay.quickMessage ? (
              <div
                style={{
                  fontSize: 'clamp(38px, 5vw, 76px)',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  textShadow: '0 4px 22px rgba(0, 0, 0, 0.92), 0 2px 6px rgba(0, 0, 0, 0.95)',
                  lineHeight: 1.2,
                  margin: 'auto 0',
                }}
              >
                {overlay.quickMessage}
              </div>
            ) : overlay.isApplauseActive ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1.8vh',
                  color: '#F5C76B',
                  textShadow: '0 4px 20px rgba(0, 0, 0, 0.95)',
                }}
              >
                <Sparkles size={72} />
                <span style={{ fontSize: 'clamp(38px, 5vw, 74px)', fontWeight: 800 }}>
                  ¡APLAUSOS EN SALA!
                </span>
              </div>
            ) : isCountdownActive && displaySinger && displaySongTitle ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1.8vh',
                    flex: 1,
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'clamp(22px, 2.5vw, 38px)',
                      fontWeight: 700,
                      letterSpacing: '2.5px',
                      textTransform: 'uppercase',
                      color: '#F5C76B',
                      textShadow: '0 3px 16px rgba(0, 0, 0, 0.95)',
                    }}
                  >
                    A CONTINUACIÓN EN EL ESCENARIO
                  </div>

                  <div
                    style={{
                      fontSize: 'clamp(46px, 6.2vw, 96px)',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      lineHeight: 1.08,
                      textShadow: '0 5px 24px rgba(0, 0, 0, 0.96), 0 2px 8px rgba(0, 0, 0, 0.95)',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displaySinger}
                  </div>

                  <div
                    style={{
                      fontSize: 'clamp(34px, 4.4vw, 68px)',
                      fontWeight: 700,
                      color: '#FFB830',
                      lineHeight: 1.18,
                      textShadow: '0 4px 20px rgba(0, 0, 0, 0.95)',
                      maxWidth: '100%',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {displaySongTitle}
                  </div>
                </div>

                {overlay.countdownSec !== null && (
                  <div
                    style={{
                      fontSize: 'clamp(48px, 6.5vw, 96px)',
                      fontWeight: 900,
                      color: '#FF9E2C',
                      fontFamily: 'Georgia, Cambria, "Times New Roman", serif',
                      letterSpacing: '4px',
                      lineHeight: 1,
                      textShadow: '0 5px 24px rgba(0, 0, 0, 0.98), 0 0 18px rgba(255, 158, 44, 0.35)',
                      paddingTop: '1vh',
                    }}
                  >
                    {formatCountdownMMSS(overlay.countdownSec)}
                  </div>
                )}
              </>
            ) : overlay.sessionActive ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2.2vh',
                }}
              >
                <div
                  style={{
                    fontSize: 'clamp(44px, 5.8vw, 88px)',
                    fontWeight: 900,
                    color: '#FFFFFF',
                    textShadow: '0 5px 24px rgba(0, 0, 0, 0.95)',
                    lineHeight: 1.15,
                  }}
                >
                  Solicita tu canción
                </div>
                <div
                  style={{
                    fontSize: 'clamp(22px, 2.6vw, 40px)',
                    fontWeight: 600,
                    color: '#F5C76B',
                    textShadow: '0 3px 16px rgba(0, 0, 0, 0.95)',
                  }}
                >
                  ¡El escenario de Katakana Karaoke está abierto!
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
