import React, { useState, useEffect, useRef } from 'react';
import { PlaybackSnapshotDTO, PlaybackStatus, QueueItemDTO } from '@karaoke/contracts';
import { PublicOverlayStateDTO } from '../../../preload/types.js';
import { cleanDisplayTitle, formatCountdownMMSS } from '../utils/title-cleaner.js';
import { Disc, Pause } from 'lucide-react';

/**
 * Pantalla Pública Unificada — Katakana Karaoke:
 * - Usa por defecto la imagen oficial assets/fondo_katakana.png (o imagen personalizada de Configurar)
 *   para AMBAS vistas: Llamado/Anuncio y Espera/Intervalo.
 * - object-fit: cover; object-position: top center;
 * - ZONA PROHIBIDA (0% a 32% de altura): 100% libre para logo "Katakana KARAOKE", siluetas y onda dorada.
 * - ZONA LIBRE (34% a 88% de altura, 82% de ancho centrado): sin cajas negras opacas, tipografía grande con
 *   serifa (Georgia / Cambria) y text-shadow suave.
 * - Sin textos genéricos antiguos ("SESIÓN EN DIRECTO", "— Desconocido", etc.).
 * - El elemento <video> de la Pantalla Pública se mantiene silenciado (muted) para evitar eco/duplicado
 *   con el motor principal de audio + pitch-shift de la Consola del Operador.
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
    countdownSec: null,
    singerName: null,
    songTitle: null,
    quickMessage: null,
    hasCustomBackground: false,
    backgroundVersion: 0,
  });

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

    if (snapshot.mediaAssetId) {
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
    } else {
      currentMediaUrlRef.current = null;
      setCurrentMediaUrl(null);
    }

    if (videoRef.current) {
      videoRef.current.muted = true; // Audio maestro gestionado por la Consola (evita doble sonido y aplica pitch shift)
      if (snapshot.state === 'PLAYING') {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
        const drift = Math.abs(videoRef.current.currentTime * 1000 - snapshot.positionMs);
        if (drift > 1200) {
          videoRef.current.currentTime = snapshot.positionMs / 1000;
        }
      } else if (snapshot.state === 'PAUSED') {
        if (!videoRef.current.paused) {
          videoRef.current.pause();
        }
      } else if (snapshot.state === 'STOPPED' || snapshot.state === 'IDLE' || snapshot.state === 'ENDED') {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!window.karaokeAPI) return;

      const volRes = await window.karaokeAPI.getVolumes();
      if (volRes.success && volRes.data) {
        setOverlay((prev) => ({
          ...prev,
          hasCustomBackground: Boolean(volRes.data.publicBackgroundPath),
          backgroundVersion: Date.now(),
        }));
      }

      const sessionRes = await window.karaokeAPI.getCurrentSession();
      if (sessionRes.success && sessionRes.data) {
        const queueRes = await window.karaokeAPI.getQueue(sessionRes.data.id);
        if (queueRes.success) updateQueueItems(queueRes.data);
      }

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
    if (videoRef.current.videoWidth === 0 && videoRef.current.videoHeight === 0) {
      setIsAudioOnlyTrack(true);
    } else {
      setIsAudioOnlyTrack(false);
    }
    if (playbackStateRef.current === 'PLAYING' && videoRef.current.paused) {
      if (positionMsRef.current > 800) {
        videoRef.current.currentTime = positionMsRef.current / 1000;
      }
      videoRef.current.play().catch(() => {});
    }
  };

  const isVideoActive =
    (playbackState === 'PLAYING' || playbackState === 'PAUSED') && !!currentMediaUrl;

  const bgImageSrc = overlay.hasCustomBackground
    ? `karaoke-media://background?v=${overlay.backgroundVersion}`
    : './assets/fondo_katakana.png';

  const activeSongTitleClean = cleanDisplayTitle(currentQueueItem?.song?.title);
  const displaySinger =
    overlay.singerName ||
    (playbackState === 'READY' ? currentQueueItem?.singer?.displayName : null) ||
    nextQueueItem?.singer?.displayName ||
    null;
  const displaySongTitle = cleanDisplayTitle(
    overlay.songTitle ||
      (playbackState === 'READY' ? currentQueueItem?.song?.title : null) ||
      nextQueueItem?.song?.title ||
      '',
  );

  const isCountdownActive = overlay.mode === 'COUNTDOWN' && overlay.countdownSec !== null;

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
      {/* 1. Reproducción de Vídeo a Pantalla Completa */}
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
            {currentQueueItem?.singer?.displayName && (
              <div
                style={{
                  fontSize: 'clamp(28px, 3.6vw, 54px)',
                  fontWeight: 700,
                  color: '#F5C76B',
                  textShadow: '0 4px 18px rgba(0,0,0,0.95)',
                }}
              >
                {currentQueueItem.singer.displayName}
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

      {/* Aviso discreto al inicio de vídeo (sin cajas opacas pesadas) */}
      {isVideoActive && !isAudioOnlyTrack && showIntroBanner && currentQueueItem?.singer && activeSongTitleClean && (
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
            {currentQueueItem.singer.displayName}
          </div>
          <div style={{ fontSize: '30px', color: '#FFB830', fontWeight: 700, marginTop: '4px' }}>
            {activeSongTitleClean}
          </div>
        </div>
      )}

      {/* Indicador discreto de PAUSA */}
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

      {/* 2. Vista Unificada de Llamado / Anuncio y Espera / Intervalo con Fondo Oficial Katakana */}
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

          {/* ZONA LIBRE: 34% a 88% de altura, 82% de ancho centrado (sin cajas negras opacas) */}
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
            ) : displaySinger && displaySongTitle ? (
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
                  {/* Etiqueta superior en dorado suave (#F5C76B) */}
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
                    {isCountdownActive || playbackState === 'READY'
                      ? 'A CONTINUACIÓN EN EL ESCENARIO'
                      : 'Cantado por:'}
                  </div>

                  {/* Nombre del cantante protagonista muy grande */}
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

                  {/* Título limpio sin códigos, máx. 2 líneas */}
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

                {/* Contador regresivo (76% a 88% de altura de pantalla -> bloque inferior dentro de Zona Libre) */}
                {isCountdownActive && overlay.countdownSec !== null && (
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
            ) : (
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
                    fontSize: 'clamp(36px, 4.8vw, 72px)',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    textShadow: '0 5px 24px rgba(0, 0, 0, 0.95)',
                    lineHeight: 1.15,
                  }}
                >
                  ¡El escenario está listo!
                </div>
                <div
                  style={{
                    fontSize: 'clamp(22px, 2.6vw, 40px)',
                    fontWeight: 600,
                    color: '#F5C76B',
                    textShadow: '0 3px 16px rgba(0, 0, 0, 0.95)',
                  }}
                >
                  Pide tu canción y sube a cantar
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
