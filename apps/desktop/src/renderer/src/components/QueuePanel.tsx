import React from 'react';
import {
  ListOrdered,
  ArrowUp,
  ArrowDown,
  Undo2,
  Clock,
  PhoneCall,
  CheckCircle,
  SkipForward,
  XCircle,
  Volume2,
} from 'lucide-react';
import { QueueItemDTO, QueueStatus } from '@karaoke/contracts';

interface QueuePanelProps {
  queue: QueueItemDTO[];
  hasUndo: boolean;
  onUndoReorder: () => Promise<void>;
  onMoveItem: (index: number, direction: 'UP' | 'DOWN') => Promise<void>;
  onTransitionItem: (itemId: string, nextStatus: QueueStatus, reason?: string) => Promise<void>;
  onPrepareForPlayback?: (item: QueueItemDTO) => Promise<void>;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  queue,
  hasUndo,
  onUndoReorder,
  onMoveItem,
  onTransitionItem,
  onPrepareForPlayback,
}) => {
  const activeItems = queue.filter(
    (item) => !['COMPLETED', 'CANCELLED', 'SKIPPED'].includes(item.status),
  );

  const nextUp = activeItems.find((item) => item.status !== 'PLAYING');

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
        return { label: 'Sonando', bg: 'var(--status-ready)', text: '#18181b' };
      case 'READY':
        return { label: 'Listo', bg: 'var(--status-ready)', text: '#18181b' };
      case 'PREPARING':
        return { label: 'Preparando', bg: 'var(--accent-warm)', text: '#18181b' };
      case 'CALLED':
        return { label: 'Llamado', bg: 'var(--status-warning)', text: '#18181b' };
      case 'QUEUED':
        return { label: 'En Cola', bg: 'var(--bg-surface-hover)', text: 'var(--text-secondary)' };
      case 'COMPLETED':
        return { label: 'Completado', bg: 'var(--border-subtle)', text: 'var(--text-muted)' };
      case 'SKIPPED':
        return { label: 'Saltado', bg: 'var(--border-subtle)', text: 'var(--text-muted)' };
      case 'CANCELLED':
        return { label: 'Cancelado', bg: 'rgba(239, 68, 68, 0.2)', text: 'var(--status-error)' };
      case 'FAILED':
        return { label: 'Fallo', bg: 'var(--status-error)', text: '#ffffff' };
      default:
        return { label: status, bg: 'var(--bg-surface-hover)', text: 'var(--text-secondary)' };
    }
  };

  return (
    <section className="panel" aria-label="Cola de actuaciones">
      <div className="panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ListOrdered size={18} color="var(--accent-warm)" />
          Cola de Actuaciones ({activeItems.length} en espera)
        </span>

        {hasUndo && (
          <button
            className="btn"
            onClick={onUndoReorder}
            title="Deshacer el último reordenamiento de la cola"
            style={{ height: '32px', minHeight: '32px', fontSize: '13px', padding: '0 10px' }}
          >
            <Undo2 size={14} />
            Deshacer orden
          </button>
        )}
      </div>

      {nextUp && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface-raised)',
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '14px',
          }}
        >
          <div>
            <span style={{ color: 'var(--accent-warm)', fontWeight: 700, marginRight: '8px' }}>
              SIGUIENTE TURNO:
            </span>
            <strong>{nextUp.singer?.displayName}</strong>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>
              ({nextUp.song?.title} — {nextUp.song?.artist})
            </span>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Turno #{nextUp.position}
          </span>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {queue.length === 0 ? (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <ListOrdered size={40} style={{ opacity: 0.4, marginBottom: '8px' }} />
            <p>La cola de actuaciones está vacía.</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              Selecciona una canción en el Catálogo y pulsa &quot;+&quot; para asignarle un cantante.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue.map((item, index) => {
              const badge = getStatusBadge(item.status);
              const isPlaying = item.status === 'PLAYING';

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: isPlaying ? 'rgba(217, 119, 6, 0.1)' : 'var(--bg-surface-raised)',
                    border: isPlaying ? '2px solid var(--accent-warm)' : '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  {/* Posición y Controles de movimiento accesible */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        minWidth: '28px',
                        textAlign: 'center',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: isPlaying ? 'var(--accent-warm)' : 'var(--text-muted)',
                      }}
                    >
                      #{item.position}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button
                        className="btn btn-icon"
                        onClick={() => onMoveItem(index, 'UP')}
                        disabled={index === 0 || isPlaying}
                        style={{ width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', padding: 0 }}
                        title="Mover arriba"
                        aria-label={`Mover arriba turno ${item.position}`}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        className="btn btn-icon"
                        onClick={() => onMoveItem(index, 'DOWN')}
                        disabled={index === queue.length - 1 || isPlaying}
                        style={{ width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', padding: 0 }}
                        title="Mover abajo"
                        aria-label={`Mover abajo turno ${item.position}`}
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Cantante, Canción y Detalles */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                        {item.singer?.displayName}
                      </strong>
                      {item.singer?.tableOrLocation && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          • {item.singer.tableOrLocation}
                        </span>
                      )}
                      {item.keyShift !== 0 && (
                        <span
                          className="pill"
                          style={{
                            fontSize: '11px',
                            backgroundColor: 'var(--bg-surface-hover)',
                            color: 'var(--accent-warm)',
                          }}
                        >
                          {item.keyShift > 0 ? `+${item.keyShift}` : item.keyShift} semitonos
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.song?.title} — {item.song?.artist}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>{formatDuration(item.song?.asset?.durationMs)}</span>
                      {item.estimatedWaitMs !== undefined && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={12} />
                          {formatWaitTime(item.estimatedWaitMs)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Estado y Acciones de la máquina de estados */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className="pill"
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.text,
                        fontSize: '11px',
                      }}
                    >
                      {badge.label}
                    </span>

                    {/* Botones de acción contextual según estado */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {item.status === 'QUEUED' && (
                        <>
                          <button
                            className="btn btn-icon"
                            onClick={() => onTransitionItem(item.id, 'CALLED')}
                            title="Llamar al cantante al escenario"
                            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }}
                          >
                            <PhoneCall size={16} color="var(--status-warning)" />
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => onTransitionItem(item.id, 'PREPARING')}
                            title="Preparar canción"
                            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }}
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => onTransitionItem(item.id, 'SKIPPED')}
                            title="Saltar turno (no se presentó)"
                            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }}
                          >
                            <SkipForward size={16} />
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => onTransitionItem(item.id, 'CANCELLED')}
                            title="Cancelar petición"
                            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }}
                          >
                            <XCircle size={16} color="var(--status-error)" />
                          </button>
                        </>
                      )}

                      {item.status === 'CALLED' && (
                        <>
                          <button
                            className="btn"
                            onClick={() => onTransitionItem(item.id, 'PREPARING')}
                            style={{ height: '34px', minHeight: '34px', padding: '0 10px', fontSize: '13px' }}
                          >
                            Preparar
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => onTransitionItem(item.id, 'SKIPPED')}
                            title="Saltar turno"
                            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }}
                          >
                            <SkipForward size={16} />
                          </button>
                        </>
                      )}

                      {item.status === 'PREPARING' && (
                        <>
                          {onPrepareForPlayback && (
                            <button
                              className="btn btn-primary"
                              onClick={() => onPrepareForPlayback(item)}
                              title="Cargar en el reproductor"
                              style={{ height: '34px', minHeight: '34px', padding: '0 10px', fontSize: '13px' }}
                            >
                              Cargar
                            </button>
                          )}
                          <button
                            className="btn"
                            onClick={() => onTransitionItem(item.id, 'READY')}
                            style={{ height: '34px', minHeight: '34px', padding: '0 10px', fontSize: '13px' }}
                          >
                            Listo
                          </button>
                        </>
                      )}

                      {item.status === 'READY' && (
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            if (onPrepareForPlayback) {
                              onPrepareForPlayback(item);
                            } else {
                              onTransitionItem(item.id, 'PLAYING');
                            }
                          }}
                          title="Cargar y poner en directo"
                          style={{ height: '34px', minHeight: '34px', padding: '0 10px', fontSize: '13px' }}
                        >
                          <Volume2 size={16} />
                          Cargar
                        </button>
                      )}

                      {item.status === 'PLAYING' && (
                        <>
                          <button
                            className="btn"
                            onClick={() => onTransitionItem(item.id, 'COMPLETED')}
                            title="Marcar como completada"
                            style={{ height: '34px', minHeight: '34px', padding: '0 10px', fontSize: '13px' }}
                          >
                            Completar
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => onTransitionItem(item.id, 'SKIPPED')}
                            title="Saltar canción"
                            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }}
                          >
                            <SkipForward size={16} />
                          </button>
                        </>
                      )}

                      {(item.status === 'SKIPPED' || item.status === 'CANCELLED') && (
                        <button
                          className="btn"
                          onClick={() => onTransitionItem(item.id, 'QUEUED')}
                          title="Reincorporar a la cola"
                          style={{ height: '34px', minHeight: '34px', padding: '0 8px', fontSize: '12px' }}
                        >
                          Reencolar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
