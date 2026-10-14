import React, { useState, useEffect } from 'react';
import {
  Search,
  FolderPlus,
  Edit2,
  Info,
  ChevronLeft,
  ChevronRight,
  Music,
  Plus,
} from 'lucide-react';
import { SongDTO, MediaFolderDTO, MediaStatus } from '@karaoke/contracts';

interface CatalogPanelProps {
  folders: MediaFolderDTO[];
  onOpenFolderManager: () => void;
  onEditSong: (song: SongDTO) => void;
  onViewDetails: (song: SongDTO) => void;
  onAddToQueue: (song: SongDTO) => void;
  scanProgress: {
    folderId: string;
    discovered: number;
    processed: number;
    errors: number;
    status: string;
    currentFile?: string;
  } | null;
}

export const CatalogPanel: React.FC<CatalogPanelProps> = ({
  folders,
  onOpenFolderManager,
  onEditSong,
  onViewDetails,
  onAddToQueue,
  scanProgress,
}) => {
  const [songs, setSongs] = useState<SongDTO[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(50);
  const [search, setSearch] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const fetchSongs = async () => {
    if (!window.karaokeAPI) return;
    setLoading(true);
    try {
      const res = await window.karaokeAPI.listAssets({
        page,
        pageSize,
        search: search.trim() || undefined,
        folderId: selectedFolderId || undefined,
        status: (selectedStatus as MediaStatus) || undefined,
        sortBy: 'title',
        sortOrder: 'asc',
      });

      if (res.success) {
        setSongs(res.data.items);
        setTotal(res.data.total);
      }
    } catch (err) {
      console.error('Error cargando catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, [page, selectedFolderId, selectedStatus]);

  // Debounce para búsqueda en vivo
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchSongs();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Si el escaneo progresa o termina, refrescar catálogo
  useEffect(() => {
    if (scanProgress?.status === 'COMPLETED') {
      fetchSongs();
    }
  }, [scanProgress?.status]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const formatDuration = (ms?: number | null) => {
    if (!ms) return '--:--';
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <section className="panel" aria-label="Catálogo de canciones">
      <div className="panel-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Music size={18} color="var(--accent-warm)" />
          Catálogo Local ({total.toLocaleString('es-ES')} canciones)
        </span>
        <button
          className="btn"
          onClick={onOpenFolderManager}
          title="Administrar carpetas de karaoke"
          style={{ height: '36px', minHeight: '36px', fontSize: '13px' }}
        >
          <FolderPlus size={16} />
          Carpetas ({folders.length})
        </button>
      </div>

      {scanProgress && scanProgress.status === 'SCANNING' && (
        <div
          style={{
            backgroundColor: 'var(--bg-surface-raised)',
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>
              <strong>Escaneando biblioteca:</strong> {scanProgress.processed} / {scanProgress.discovered} analizados
              {scanProgress.errors > 0 ? ` (${scanProgress.errors} errores)` : ''}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{scanProgress.currentFile || ''}</span>
          </div>
          <div
            style={{
              height: '4px',
              backgroundColor: 'var(--border-strong)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: 'var(--accent-warm)',
                width: `${scanProgress.discovered ? Math.round((scanProgress.processed / scanProgress.discovered) * 100) : 0}%`,
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}

      <div style={{ padding: '12px 16px', display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ position: 'relative', flex: 2 }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '13px',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por artista o título (ej. Queen, Corazón)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '40px' }}
          />
        </div>

        <select
          className="form-input"
          value={selectedFolderId}
          onChange={(e) => {
            setSelectedFolderId(e.target.value);
            setPage(1);
          }}
          style={{ flex: 1 }}
        >
          <option value="">Todas las carpetas</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.displayName}
            </option>
          ))}
        </select>

        <select
          className="form-input"
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          style={{ flex: 1 }}
        >
          <option value="">Todos los estados</option>
          <option value="AVAILABLE">Disponibles</option>
          <option value="MISSING">Ausentes</option>
          <option value="INCOMPATIBLE">Incompatibles</option>
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {songs.length === 0 ? (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            {loading ? (
              <p>Cargando catálogo...</p>
            ) : folders.length === 0 ? (
              <div>
                <Music size={40} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <p>No hay ninguna carpeta de karaoke agregada.</p>
                <button
                  className="btn btn-primary"
                  onClick={onOpenFolderManager}
                  style={{ marginTop: '12px' }}
                >
                  <FolderPlus size={18} />
                  Autorizar mi primera carpeta
                </button>
              </div>
            ) : (
              <p>No se encontraron canciones que coincidan con la búsqueda.</p>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 16px' }}>Título / Artista</th>
                <th style={{ padding: '10px 16px', width: '80px' }}>Duración</th>
                <th style={{ padding: '10px 16px', width: '80px' }}>Formato</th>
                <th style={{ padding: '10px 16px', width: '110px' }}>Estado</th>
                <th style={{ padding: '10px 16px', width: '90px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr
                  key={song.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background-color 0.1s ease',
                  }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{song.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{song.artist}</div>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>
                    {formatDuration(song.asset?.durationMs)}
                  </td>
                  <td style={{ padding: '10px 16px', textTransform: 'uppercase', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {song.asset?.extension?.replace('.', '') || 'N/A'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span
                      className="pill"
                      style={{
                        fontSize: '11px',
                        backgroundColor:
                          song.asset?.status === 'AVAILABLE'
                            ? 'var(--status-ready)'
                            : song.asset?.status === 'MISSING'
                              ? 'var(--status-warning)'
                              : 'var(--status-error)',
                        color: '#18181b',
                      }}
                    >
                      {song.asset?.status || 'UNKNOWN'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      <button
                        className="btn btn-icon btn-primary"
                        onClick={() => onAddToQueue(song)}
                        title="Añadir canción a la cola de cantantes"
                        style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        className="btn btn-icon"
                        onClick={() => onEditSong(song)}
                        title="Corregir artista o título manualmente"
                        style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="btn btn-icon"
                        onClick={() => onViewDetails(song)}
                        title="Ver detalles técnicos del archivo"
                        style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}
                      >
                        <Info size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: 'var(--bg-surface-raised)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '13px',
        }}
      >
        <span>
          Página {page} de {totalPages} ({total} canciones)
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
            aria-label="Página anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="btn btn-icon"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
            aria-label="Página siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
};
