import React, { useState } from 'react';
import {
  ListOrdered,
  Users,
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
            <ListOrdered size={20} color="#F3D285" />
            <span style={{ fontSize: '18px', fontWeight: 900 }}>
              COLA Y ESCENARIO ({activeItems.length})
            </span>

            <div style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
              <button
                type="button"
                className={`btn btn-compact ${activeTab === 'ACTIVE' ? 'btn-surf' : 'btn-dark'}`}
                onClick={() => setActiveTab('ACTIVE')}
              >
                <Users size={15} />
                Activos ({activeItems.length})
              </button>
              <button
                type="button"
                className={`btn btn-compact ${activeTab === 'HISTORY' ? 'btn-surf' : 'btn-dark'}`}
                onClick={() => setActiveTab('HISTORY')}
              >
                <History size={15} />
                Historial ({historyItems.length})
              </button>
            </div>
          </div>

          {/* Barra compacta de efectos rápidos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#D4DCE8', marginRight: '2px' }}>
              EFECTOS:
            </span>
            <button
              type="button"
              className="btn btn-dark btn-compact"
              onClick={onTriggerApplause}
              title="Reproducir efecto de Aplausos (6s)"
            >
              <Sparkles size={15} color="#F3D285" />
              Aplausos
            </button>
            <button
              type="button"
              className="btn btn-dark btn-compact"
              onClick={onTriggerCheers}
              title="Reproducir efecto de Ovaciones y Vítores"
            >
              <PartyPopper size={15} color="#F3D285" />
              Ovaciones
            </button>
            <button
              type="button"
              className="btn btn-dark btn-compact"
              onClick={onTriggerLaughter}
              title="Reproducir efecto de Risas de sala"
            >
              <Smile size={15} color="#F3D285" />
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
                  color: '#95A3B8',
                  fontSize: '17px',
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
                    <th style={{ width: '115px' }}>Orden</th>
                    <th>Título</th>
                    <th style={{ width: '210px' }}>Cantante</th>
                    <th style={{ width: '105px', textAlign: 'center' }}>Tono</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Volumen</th>
                    <th style={{ width: '285px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {safeQueue.map((item, globalIndex) => {
                    if (['COMPLETED', 'CANCELLED', 'SKIPPED'].includes(item.status)) return null;
                    const isPlaying = item.status === 'PLAYING';
                    const cleanTitle = cleanDisplayTitle(item.song?.title);
                    const assetKey = item.song?.mediaAssetId || '';
                    const memVol =
                      assetKey && memorizedSongs[assetKey] !== undefined
                        ? memorizedSongs[assetKey]
                        : null;
                    const displayVol = memVol !== null ? memVol : defaultKaraokeVolume;

                    return (
                      <tr key={item.id} className={isPlaying ? 'row-selected' : ''}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 900,
                                fontSize: '18px',
                                minWidth: '30px',
                                color: '#151515',
                              }}
                            >
                              #{item.position}
                            </span>
                            <button
                              type="button"
                              className="btn btn-dark btn-compact"
                              onClick={() => onMoveItem(globalIndex, 'UP')}
                              disabled={globalIndex === 0 || isPlaying}
                              style={{
                                minWidth: '28px',
                                height: '28px',
                                minHeight: '28px',
                                padding: 0,
                              }}
                              title="Subir en la cola"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-dark btn-compact"
                              onClick={() => onMoveItem(globalIndex, 'DOWN')}
                              disabled={globalIndex === safeQueue.length - 1 || isPlaying}
                              style={{
                                minWidth: '28px',
                                height: '28px',
                                minHeight: '28px',
                                padding: 0,
                              }}
                              title="Bajar en la cola"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 900, fontSize: '18px', color: '#151515' }}>
                              {cleanTitle}
                            </span>
                            {isPlaying && (
                              <span
                                className="pill"
                                style={{
                                  backgroundColor: '#00E5D1',
                                  color: '#071F1D',
                                  border: '1.5px solid #071F1D',
                                }}
                              >
                                EN ESCENARIO
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ fontWeight: 900, fontSize: '18px', color: '#151515' }}>
                          {item.singer?.displayName || 'Cantante'}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <span className="katakana-value-box">
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
                              fontSize: '17px',
                              fontWeight: 900,
                              color: '#151515',
                            }}
                            title={
                              memVol !== null
                                ? 'Volumen memorizado para esta canción'
                                : 'Volumen general'
                            }
                          >
                            {memVol !== null && <BookmarkCheck size={15} color="#007F77" />}
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
                              className="btn btn-dark btn-compact"
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
                color: '#95A3B8',
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
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#151515' }}>
                      #{item.position}
                    </td>
                    <td style={{ color: '#151515' }}>{cleanDisplayTitle(item.song?.title)}</td>
                    <td style={{ color: '#151515' }}>{item.singer?.displayName}</td>
                    <td>
                      <span className="katakana-value-box" style={{ fontSize: '12px' }}>
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
                          className="btn btn-dark btn-compact"
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
