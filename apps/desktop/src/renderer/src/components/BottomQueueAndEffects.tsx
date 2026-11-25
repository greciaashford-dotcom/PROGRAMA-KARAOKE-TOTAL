import React, { useState } from 'react';
import {
  ListOrdered,
  History,
  Play,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  PartyPopper,
  Smile,
  RotateCcw,
  BookmarkCheck,
} from 'lucide-react';
import { QueueItemDTO, QueueStatus } from '@karaoke/contracts';
import { cleanDisplayTitle } from '../utils/title-cleaner.js';

export interface BottomQueueAndEffectsProps {
  queue: QueueItemDTO[];
  memorizedSongs: Record<string, number>;
  defaultKaraokeVolume: number;
  onLaunchItem: (item: QueueItemDTO) => Promise<void>;
  onEditItem: (item: QueueItemDTO) => void;
  onRemoveItem: (item: QueueItemDTO) => Promise<void>;
  onMoveItem: (index: number, direction: 'UP' | 'DOWN') => Promise<void>;
  onRequeueItem: (itemId: string, nextStatus: QueueStatus) => Promise<void>;
  onTriggerApplause: () => void;
  onTriggerCheers: () => void;
  onTriggerLaughter: () => void;
}

export const BottomQueueAndEffects: React.FC<BottomQueueAndEffectsProps> = ({
  queue,
  memorizedSongs,
  defaultKaraokeVolume,
  onLaunchItem,
  onEditItem,
  onRemoveItem,
  onMoveItem,
  onRequeueItem,
  onTriggerApplause,
  onTriggerCheers,
  onTriggerLaughter,
}) => {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  const safeQueue = Array.isArray(queue) ? queue : [];
  const activeItems = safeQueue.filter(
    (item) => !['COMPLETED', 'CANCELLED', 'SKIPPED'].includes(item.status),
  );
  const historyItems = safeQueue.filter((item) =>
    ['COMPLETED', 'CANCELLED', 'SKIPPED', 'FAILED'].includes(item.status),
  );

  return (
    <section className="katakana-bottom-section" aria-label="Cola de Escenario y Efectos Rápidos">
      <div className="katakana-panel" style={{ flex: 1 }}>
        {/* Cabecera compartida: Cola + Pestañas + Barra de Efectos Rápidos */}
        <div className="katakana-panel-header" style={{ padding: '6px 12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListOrdered size={20} />
            <span style={{ fontSize: '18px', fontWeight: 900 }}>
              COLA Y ESCENARIO ({activeItems.length})
            </span>

            <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
              <button
                type="button"
                className={`btn btn-compact ${activeTab === 'ACTIVE' ? 'btn-surf' : ''}`}
                onClick={() => setActiveTab('ACTIVE')}
              >
                Activos ({activeItems.length})
              </button>
              <button
                type="button"
                className={`btn btn-compact ${activeTab === 'HISTORY' ? 'btn-surf' : ''}`}
                onClick={() => setActiveTab('HISTORY')}
              >
                <History size={15} />
                Historial ({historyItems.length})
              </button>
            </div>
          </div>

          {/* Barra compacta de efectos rápidos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink-secondary)', marginRight: '2px' }}>
              EFECTOS:
            </span>
            <button
              type="button"
              className="btn btn-compact"
              onClick={onTriggerApplause}
              title="Reproducir efecto de Aplausos (6s)"
            >
              <Sparkles size={16} />
              Aplausos
            </button>
            <button
              type="button"
              className="btn btn-compact"
              onClick={onTriggerCheers}
              title="Reproducir efecto de Ovaciones y Vítores"
            >
              <PartyPopper size={16} />
              Ovaciones
            </button>
            <button
              type="button"
              className="btn btn-compact"
              onClick={onTriggerLaughter}
              title="Reproducir efecto de Risas de sala"
            >
              <Smile size={16} />
              Risas
            </button>
          </div>
        </div>

        {/* Tabla de Cola */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {activeTab === 'ACTIVE' ? (
            activeItems.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ink-muted)',
                  fontSize: '18px',
                  fontWeight: 700,
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                La Cola está vacía. Pulsa &quot;Abrir Catálogo / Buscar&quot; (F2) para agregar cantantes.
              </div>
            ) : (
              <table className="katakana-table">
                <thead>
                  <tr>
                    <th style={{ width: '108px' }}>Orden</th>
                    <th>Título</th>
                    <th style={{ width: '220px' }}>Cantante</th>
                    <th style={{ width: '112px', textAlign: 'center' }}>Tono</th>
                    <th style={{ width: '125px', textAlign: 'center' }}>Volumen</th>
                    <th style={{ width: '270px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {safeQueue.map((item, globalIndex) => {
                    if (['COMPLETED', 'CANCELLED', 'SKIPPED'].includes(item.status)) return null;
                    const isPlaying = item.status === 'PLAYING';
                    const cleanTitle = cleanDisplayTitle(item.song?.title);
                    const assetKey = item.song?.mediaAssetId || '';
                    const memVol = assetKey && memorizedSongs[assetKey] !== undefined ? memorizedSongs[assetKey] : null;
                    const displayVol = memVol !== null ? memVol : defaultKaraokeVolume;

                    return (
                      <tr key={item.id} className={isPlaying ? 'row-selected' : ''}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 900,
                                fontSize: '18px',
                                minWidth: '30px',
                              }}
                            >
                              #{item.position}
                            </span>
                            <button
                              type="button"
                              className="btn btn-compact"
                              onClick={() => onMoveItem(globalIndex, 'UP')}
                              disabled={globalIndex === 0 || isPlaying}
                              style={{ minWidth: '28px', height: '28px', minHeight: '28px', padding: 0 }}
                              title="Subir en la cola"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-compact"
                              onClick={() => onMoveItem(globalIndex, 'DOWN')}
                              disabled={globalIndex === safeQueue.length - 1 || isPlaying}
                              style={{ minWidth: '28px', height: '28px', minHeight: '28px', padding: 0 }}
                              title="Bajar en la cola"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '18px' }}>{cleanTitle}</span>
                            {isPlaying && (
                              <span
                                className="pill"
                                style={{
                                  backgroundColor: 'var(--accent-surf)',
                                  color: 'var(--ink-piano)',
                                  border: '1.5px solid var(--ink-piano)',
                                }}
                              >
                                EN ESCENARIO
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ fontWeight: 800, fontSize: '18px' }}>
                          {item.singer?.displayName || 'Cantante'}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="pill"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '15px',
                              backgroundColor:
                                item.keyShift !== 0 ? 'var(--accent-surf)' : 'var(--bg-surface-warm)',
                              color: 'var(--ink-piano)',
                              border: '1.5px solid var(--ink-piano)',
                            }}
                          >
                            {item.keyShift > 0 ? `+${item.keyShift}` : item.keyShift}
                          </span>
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '16px',
                              fontWeight: 800,
                              color: memVol !== null ? 'var(--accent-surf-dark)' : 'var(--ink-secondary)',
                            }}
                            title={memVol !== null ? 'Volumen memorizado para esta canción' : 'Volumen general'}
                          >
                            {memVol !== null && <BookmarkCheck size={15} />}
                            {displayVol}%
                          </span>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-surf btn-compact"
                              onClick={() => onLaunchItem(item)}
                              title="Lanzar este turno al escenario ahora"
                            >
                              <Play size={15} fill="currentColor" />
                              Lanzar
                            </button>

                            <button
                              type="button"
                              className="btn btn-compact"
                              onClick={() => onEditItem(item)}
                              title="Editar cantante o tono de este turno"
                            >
                              <Edit2 size={15} />
                              Editar
                            </button>

                            <button
                              type="button"
                              className="btn btn-danger btn-compact"
                              onClick={() => onRemoveItem(item)}
                              title="Quitar de la cola (si está sonando también la detiene)"
                            >
                              <Trash2 size={15} />
                              Quitar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : historyItems.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ink-muted)',
                fontSize: '17px',
                fontWeight: 600,
              }}
            >
              Aún no hay actuaciones finalizadas en esta sesión.
            </div>
          ) : (
            <table className="katakana-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Orden</th>
                  <th>Título</th>
                  <th style={{ width: '220px' }}>Cantante</th>
                  <th style={{ width: '140px' }}>Estado</th>
                  <th style={{ width: '160px', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>#{item.position}</td>
                    <td>{cleanDisplayTitle(item.song?.title)}</td>
                    <td>{item.singer?.displayName}</td>
                    <td>
                      <span className="pill" style={{ backgroundColor: 'var(--bg-surface-warm)', border: '1px solid var(--ink-piano)' }}>
                        {item.status === 'COMPLETED'
                          ? 'COMPLETADO'
                          : item.status === 'SKIPPED'
                            ? 'SALTADO'
                            : item.status === 'CANCELLED'
                              ? 'QUITADO'
                              : 'ERROR'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {item.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          className="btn btn-compact"
                          onClick={() => onRequeueItem(item.id, 'QUEUED')}
                        >
                          <RotateCcw size={14} />
                          Reencolar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
};
