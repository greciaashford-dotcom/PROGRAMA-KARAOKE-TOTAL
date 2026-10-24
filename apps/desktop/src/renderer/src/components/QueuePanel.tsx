import React, { useState, useEffect } from 'react';
import {
  ListOrdered,
  ArrowUp,
  ArrowDown,
  Undo2,
  Clock,
  PhoneCall,
  SkipForward,
  XCircle,
  Play,
  GripVertical,
  History,
  Users,
  UserPlus,
  Activity,
} from 'lucide-react';
import {
  QueueItemDTO,
  QueueStatus,
  SingerDTO,
  QueueEventDTO,
} from '@karaoke/contracts';

interface QueuePanelProps {
  sessionId?: string | null;
  queue: QueueItemDTO[];
  singers: SingerDTO[];
  hasUndo: boolean;
  onUndoReorder: () => Promise<void>;
  onMoveItem: (index: number, direction: 'UP' | 'DOWN') => Promise<void>;
  onReorderList?: (orderedIds: string[]) => Promise<void>;
  onTransitionItem: (itemId: string, nextStatus: QueueStatus, reason?: string) => Promise<void>;
  onPrepareForPlayback?: (item: QueueItemDTO) => Promise<void>;
  onPlayQueueItemNow?: (item: QueueItemDTO) => Promise<void>;
  onOpenAddSinger?: () => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  sessionId,
  queue,
  singers,
  hasUndo,
  onUndoReorder,
  onMoveItem,
  onReorderList,
  onTransitionItem,
  onPrepareForPlayback,
  onPlayQueueItemNow,
  onOpenAddSinger,
}) => {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY' | 'SINGERS' | 'EVENTS'>('ACTIVE');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [events, setEvents] = useState<QueueEventDTO[]>([]);

  const safeQueue = Array.isArray(queue) ? queue : [];

  const activeItems = safeQueue.filter(
    (item) => !['COMPLETED', 'CANCELLED', 'SKIPPED'].includes(item.status),
  );

  const historyItems = safeQueue.filter((item) =>
    ['COMPLETED', 'CANCELLED', 'SKIPPED', 'FAILED'].includes(item.status),
  );

  const nextUp = activeItems.find((item) => item.status !== 'PLAYING');

  useEffect(() => {
    if (activeTab === 'EVENTS' && sessionId && window.karaokeAPI) {
      window.karaokeAPI.listQueueEvents(sessionId).then((res) => {
        if (res.success) {
          setEvents(res.data);
        }
      });
    }
  }, [activeTab, sessionId, safeQueue.length]);

  const formatWaitTime = (ms?: number) => {
    if (!ms || ms <= 0) return 'Ahora';
    const mins = Math.round(ms / 60000);
    return mins <= 1 ? '~1 min' : `~${mins} min`;
  };

  const formatDuration = (ms?: number | null) => {
    if (!ms) return '--:--';
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getStatusBadge = (status: QueueStatus) => {
    switch (status) {
      case 'PLAYING':
        return { label: 'EN DIRECTO', bg: 'var(--status-ready)', text: '#18181b' };
      case 'PAUSED':
        return { label: 'PAUSADO', bg: 'var(--status-warning)', text: '#18181b' };
      case 'READY':
        return { label: 'CARGADO', bg: '#38bdf8', text: '#0f172a' };
      case 'PREPARING':
        return { label: 'PREPARANDO', bg: 'var(--accent-warm)', text: '#18181b' };
      case 'CALLED':
        return { label: 'LLAMADO', bg: 'var(--status-warning)', text: '#18181b' };
      case 'QUEUED':
        return { label: 'EN COLA', bg: 'var(--bg-surface-hover)', text: 'var(--text-secondary)' };
      case 'COMPLETED':
        return { label: 'COMPLETADO', bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--status-ready)' };
      case 'SKIPPED':
        return { label: 'SALTADO', bg: 'var(--border-subtle)', text: 'var(--text-muted)' };
      case 'CANCELLED':
        return { label: 'CANCELADO', bg: 'rgba(239, 68, 68, 0.2)', text: 'var(--status-error)' };
      case 'FAILED':
        return { label: 'ERROR ARCHIVO', bg: 'var(--status-error)', text: '#ffffff' };
      default:
        return { label: status, bg: 'var(--bg-surface-hover)', text: 'var(--text-secondary)' };
    }
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    if (itemId !== draggedItemId) {
      setDragOverItemId(itemId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    setDragOverItemId(null);
    if (!draggedItemId || draggedItemId === targetItemId || !onReorderList) {
      setDraggedItemId(null);
      return;
    }

    const fromIndex = safeQueue.findIndex((i) => i.id === draggedItemId);
    const toIndex = safeQueue.findIndex((i) => i.id === targetItemId);
    setDraggedItemId(null);

    if (fromIndex < 0 || toIndex < 0) return;

    const newList = [...safeQueue];
    const [moved] = newList.splice(fromIndex, 1);
    if (!moved) return;
    newList.splice(toIndex, 0, moved);

    await onReorderList(newList.map((i) => i.id));
  };

  return (
    <section className="panel" aria-label="Cola de actuaciones">
      <div className="panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ListOrdered size={18} color="var(--accent-warm)" />
          Cola y Escenario ({activeItems.length})
        </span>

        <div style={{ display: 'flex', gap: '6px' }}>
          {hasUndo && (
            <button
              className="btn"
              onClick={onUndoReorder}
              title="Deshacer el último reordenamiento de la cola"
              style={{ height: '30px', minHeight: '30px', fontSize: '12px', padding: '0 8px' }}
            >
              <Undo2 size={13} />
              Deshacer
            </button>
          )}
          {onOpenAddSinger && sessionId && (
            <button
              className="btn"
              onClick={onOpenAddSinger}
              title="Registrar nuevo cantante en la sesión"
              style={{ height: '30px', minHeight: '30px', fontSize: '12px', padding: '0 8px' }}
            >
              <UserPlus size={13} />
              + Cantante
            </button>
          )}
        </div>
      </div>

      {/* Pestañas de navegación de Cola / Historial / Cantantes / Auditoría */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          backgroundColor: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '4px',
          gap: '4px',
        }}
      >
        {[
          { id: 'ACTIVE', label: `Activos (${activeItems.length})`, icon: ListOrdered },
          { id: 'HISTORY', label: `Historial (${historyItems.length})`, icon: History },
          { id: 'SINGERS', label: `Cantantes (${singers.length})`, icon: Users },
          { id: 'EVENTS', label: 'Auditoría', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'ACTIVE' | 'HISTORY' | 'SINGERS' | 'EVENTS')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                height: '30px',
                borderRadius: '4px',
                border: 'none',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: isActive ? 'var(--bg-surface-raised)' : 'transparent',
                color: isActive ? 'var(--accent-warm)' : 'var(--text-muted)',
              }}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'ACTIVE' && nextUp && (
        <div
          style={{
            backgroundColor: 'rgba(217, 119, 6, 0.1)',
            padding: '8px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}
        >
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--accent-warm)', fontWeight: 800, marginRight: '6px' }}>
              SIGUIENTE:
            </span>
            <strong>{nextUp.singer?.displayName}</strong>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>
              — {nextUp.song?.title}
            </span>
          </div>

          {onPlayQueueItemNow && (
            <button
              className="btn btn-success"
              onClick={() => onPlayQueueItemNow(nextUp)}
              style={{ height: '26px', minHeight: '26px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
              title="Lanzar siguiente turno al reproductor y reproducir"
            >
              <Play size={12} fill="currentColor" />
              Lanzar
            </button>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {activeTab === 'ACTIVE' && (
          <>
            {activeItems.length === 0 ? (
              <div
                style={{
                  padding: '48px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <ListOrdered size={38} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  No hay actuaciones pendientes en la cola.
                </p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  Pulsa el botón <strong>+</strong> en cualquier canción del Catálogo para asignarla a un cantante, o pulsa <strong>Play</strong> en el catálogo para reproducir sin cola.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {safeQueue.map((item, index) => {
                  if (['COMPLETED', 'CANCELLED', 'SKIPPED'].includes(item.status)) {
                    return null;
                  }

                  const badge = getStatusBadge(item.status);
                  const isPlaying = item.status === 'PLAYING';
                  const isDragTarget = dragOverItemId === item.id;

                  return (
                    <div
                      key={item.id}
                      draggable={!isPlaying}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragOver={(e) => handleDragOver(e, item.id)}
                      onDragLeave={() => setDragOverItemId(null)}
                      onDrop={(e) => handleDrop(e, item.id)}
                      style={{
                        backgroundColor: isPlaying
                          ? 'rgba(16, 185, 129, 0.1)'
                          : isDragTarget
                            ? 'rgba(217, 119, 6, 0.16)'
                            : 'var(--bg-surface-raised)',
                        border: isPlaying
                          ? '2px solid var(--status-ready)'
                          : isDragTarget
                            ? '1px dashed var(--accent-warm)'
                            : '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {/* Drag handle + Posición + flechas accesibles */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div
                          style={{
                            cursor: isPlaying ? 'default' : 'grab',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Arrastrar para reordenar"
                        >
                          <GripVertical size={15} />
                        </div>

                        <div
                          style={{
                            minWidth: '24px',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '13px',
                            fontFamily: 'var(--font-mono)',
                            color: isPlaying ? 'var(--status-ready)' : 'var(--text-muted)',
                          }}
                        >
                          #{item.position}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <button
                            className="btn btn-icon"
                            onClick={() => onMoveItem(index, 'UP')}
                            disabled={index === 0 || isPlaying}
                            style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', padding: 0 }}
                            title="Subir turno"
                            aria-label={`Mover arriba turno ${item.position}`}
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => onMoveItem(index, 'DOWN')}
                            disabled={index === safeQueue.length - 1 || isPlaying}
                            style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', padding: 0 }}
                            title="Bajar turno"
                            aria-label={`Mover abajo turno ${item.position}`}
                          >
                            <ArrowDown size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Cantante, Canción y Detalles */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                            {item.singer?.displayName}
                          </strong>
                          {item.singer?.tableOrLocation && (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              ({item.singer.tableOrLocation})
                            </span>
                          )}
                          {item.keyShift !== 0 && (
                            <span
                              className="pill"
                              style={{
                                fontSize: '10px',
                                backgroundColor: 'var(--bg-surface-hover)',
                                color: 'var(--accent-warm)',
                              }}
                            >
                              {item.keyShift > 0 ? `+${item.keyShift}` : item.keyShift} st
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.song?.title} — {item.song?.artist}
                        </div>

                        {item.failureReason && (
                          <div style={{ fontSize: '11px', color: 'var(--status-error)', marginTop: '2px' }}>
                            ⚠️ {item.failureReason}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span>{formatDuration(item.song?.asset?.durationMs)}</span>
                          {item.estimatedWaitMs !== undefined && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Clock size={11} />
                              {formatWaitTime(item.estimatedWaitMs)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Estado y Acciones rápidas */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <span
                          className="pill"
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.text,
                            fontSize: '10px',
                          }}
                        >
                          {badge.label}
                        </span>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          {!isPlaying && onPlayQueueItemNow && (
                            <button
                              className="btn btn-success"
                              onClick={() => onPlayQueueItemNow(item)}
                              title="Cargar y reproducir inmediatamente"
                              style={{ height: '28px', minHeight: '28px', minWidth: '28px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
                            >
                              <Play size={12} fill="currentColor" />
                              Play
                            </button>
                          )}

                          {!isPlaying && onPrepareForPlayback && item.status !== 'READY' && (
                            <button
                              className="btn"
                              onClick={() => onPrepareForPlayback(item)}
                              title="Dejar preparada en el reproductor sin iniciar aún"
                              style={{ height: '28px', minHeight: '28px', minWidth: '28px', padding: '0 8px', fontSize: '11px' }}
                            >
                              Cargar
                            </button>
                          )}

                          {item.status === 'QUEUED' && (
                            <button
                              className="btn btn-icon"
                              onClick={() => onTransitionItem(item.id, 'CALLED')}
                              title="Llamar al cantante al escenario"
                              style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
                            >
                              <PhoneCall size={13} color="var(--status-warning)" />
                            </button>
                          )}

                          <button
                            className="btn btn-icon"
                            onClick={() => onTransitionItem(item.id, 'SKIPPED')}
                            title="Saltar turno"
                            style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
                          >
                            <SkipForward size={13} />
                          </button>

                          {!isPlaying && (
                            <button
                              className="btn btn-icon"
                              onClick={() => onTransitionItem(item.id, 'CANCELLED')}
                              title="Cancelar turno"
                              style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
                            >
                              <XCircle size={13} color="var(--status-error)" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'HISTORY' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {historyItems.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Aún no hay canciones completadas o saltadas en esta sesión.
              </div>
            ) : (
              historyItems.map((item) => {
                const badge = getStatusBadge(item.status);
                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: 'var(--bg-surface-raised)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>
                        #{item.position} • {item.singer?.displayName}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {item.song?.title} — {item.song?.artist}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="pill" style={{ backgroundColor: badge.bg, color: badge.text, fontSize: '10px' }}>
                        {badge.label}
                      </span>
                      {(item.status === 'SKIPPED' || item.status === 'CANCELLED' || item.status === 'FAILED') && (
                        <button
                          className="btn"
                          onClick={() => onTransitionItem(item.id, 'QUEUED')}
                          style={{ height: '26px', minHeight: '26px', padding: '0 8px', fontSize: '11px' }}
                        >
                          Reencolar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'SINGERS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {singers.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No hay cantantes registrados en esta sesión.
              </div>
            ) : (
              singers.map((s) => {
                const singerSongs = safeQueue.filter((q) => q.singerId === s.id);
                const completedCount = singerSongs.filter((q) => q.status === 'COMPLETED').length;
                return (
                  <div
                    key={s.id}
                    style={{
                      backgroundColor: 'var(--bg-surface-raised)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{s.displayName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {s.tableOrLocation ? `Ubicación: ${s.tableOrLocation}` : 'Sin mesa asignada'}
                        {s.notes ? ` • ${s.notes}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      <div>{singerSongs.length} pedidas</div>
                      <div style={{ color: 'var(--status-ready)' }}>{completedCount} cantadas</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'EVENTS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {events.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Sin eventos registrados en esta sesión.
              </div>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    backgroundColor: 'var(--bg-surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--accent-warm)' }}>{ev.eventType}</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {ev.previousState ? `${ev.previousState} → ${ev.nextState}` : ev.nextState}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {new Date(ev.createdAt).toLocaleTimeString('es-ES')}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
};
