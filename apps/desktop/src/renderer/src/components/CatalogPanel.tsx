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
  Play,
  StopCircle,
  Film,
  X,
} from 'lucide-react';
import { SongDTO, MediaFolderDTO, MediaStatus } from '@karaoke/contracts';

interface CatalogPanelProps {
  folders: MediaFolderDTO[];
  onOpenFolderManager: () => void;
  onEditSong: (song: SongDTO) => void;
  onViewDetails: (song: SongDTO) => void;
  onAddToQueue: (song: SongDTO) => void;
  onPlayNow: (song: SongDTO) => void;
  onCancelScan?: (folderId: string) => void;
  refreshTrigger?: number;
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
  onPlayNow,
  onCancelScan,
  refreshTrigger = 0,
  scanProgress,
}) => {
  const [songs, setSongs] = useState<SongDTO[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(50);
  const [search, setSearch] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedExtension, setSelectedExtension] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const fetchSongs = async () => {
    if (!window.karaokeAPI) return;
    setLoading(true);
    try {
      const res = await window.karaokeAPI.listAssets({
        page,
        pageSize,
        category: 'KARAOKE',
        search: search.trim() || undefined,
        folderId: selectedFolderId || undefined,
        status: (selectedStatus as MediaStatus) || undefined,
        extension: selectedExtension || undefined,
        language: selectedLanguage.trim() || undefined,
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
  }, [page, selectedFolderId, selectedStatus, selectedExtension, refreshTrigger]);

  // Debounce para búsqueda e idioma en vivo
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchSongs();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedLanguage]);

  // Si el escaneo progresa o termina, refrescar catálogo
  useEffect(() => {
    if (
      scanProgress?.status === 'COMPLETED' ||
      (scanProgress?.processed && scanProgress.processed % 10 === 0)
    ) {
      fetchSongs();
    }
  }, [scanProgress?.status, scanProgress?.processed]);

  const totalPages = Math.ceil(total / pageSize) || 1;
  const karaokeFolders = folders.filter((f) => f.category === 'KARAOKE');

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
          <Music size={17} color="#FFB100" />
          CATÁLOGO LOCAL ({total.toLocaleString('es-ES')} PISTAS)
        </span>
        <button
          className="btn"
          onClick={onOpenFolderManager}
          title="Administrar carpetas de karaoke del PC"
          style={{ height: '30px', minHeight: '30px', fontSize: '12px', padding: '0 10px' }}
        >
          <FolderPlus size={14} />
          Carpetas ({karaokeFolders.length})
        </button>
      </div>

      {scanProgress && scanProgress.status === 'SCANNING' && (
        <div
          style={{
            backgroundColor: 'rgba(255, 177, 0, 0.12)',
            padding: '8px 14px',
            borderBottom: '1px solid #FFB100',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span>
              <strong>Escaneando biblioteca:</strong> {scanProgress.processed} / {scanProgress.discovered} analizados
              {scanProgress.errors > 0 ? ` (${scanProgress.errors} advertencias)` : ''}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {scanProgress.currentFile || ''}
              </span>
              {onCancelScan && (
                <button
                  className="btn"
                  onClick={() => onCancelScan(scanProgress.folderId)}
                  style={{ height: '24px', minHeight: '24px', padding: '0 8px', fontSize: '11px', color: 'var(--status-warning)' }}
                >
                  <StopCircle size={12} />
                  Cancelar
                </button>
              )}
            </div>
          </div>
          <div
            style={{
              height: '4px',
              backgroundColor: 'var(--bg-app)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: '#FFB100',
                width: `${scanProgress.discovered ? Math.round((scanProgress.processed / scanProgress.discovered) * 100) : 0}%`,
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div style={{ position: 'relative', width: '100%' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '11px',
              top: '9px',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por canción o artista (sin importar tildes o mayúsculas)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '34px',
              paddingRight: search ? '32px' : '10px',
              minHeight: '34px',
              height: '34px',
              fontSize: '12.5px',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '6px',
                top: '6px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
              title="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr 0.85fr', gap: '5px' }}>
          <select
            className="form-input"
            value={selectedFolderId}
            onChange={(e) => {
              setSelectedFolderId(e.target.value);
              setPage(1);
            }}
            style={{ minHeight: '29px', height: '29px', padding: '0 6px', fontSize: '11.5px' }}
            title="Filtrar por carpeta"
          >
            <option value="">📁 Todas las carpetas</option>
            {karaokeFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.displayName}
              </option>
            ))}
          </select>

          <select
            className="form-input"
            value={selectedExtension}
            onChange={(e) => {
              setSelectedExtension(e.target.value);
              setPage(1);
            }}
            style={{ minHeight: '29px', height: '29px', padding: '0 6px', fontSize: '11.5px' }}
            title="Filtrar por formato de archivo"
          >
            <option value="">🎬 Todos los formatos</option>
            <option value=".mp4">Vídeo MP4</option>
            <option value=".mkv">Vídeo MKV</option>
            <option value=".webm">Vídeo WEBM</option>
            <option value=".mov">Vídeo MOV</option>
            <option value=".mp3">Audio MP3</option>
            <option value=".wav">Audio WAV</option>
            <option value=".flac">Audio FLAC</option>
          </select>

          <select
            className="form-input"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            style={{ minHeight: '29px', height: '29px', padding: '0 6px', fontSize: '11.5px' }}
            title="Filtrar por estado técnico"
          >
            <option value="">⚡ Todos los estados</option>
            <option value="AVAILABLE">Disponibles</option>
            <option value="MISSING">Ausentes en disco</option>
            <option value="INCOMPATIBLE">Incompatibles</option>
          </select>

          <input
            type="text"
            className="form-input"
            placeholder="🌐 Idioma..."
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={{ minHeight: '29px', height: '29px', padding: '0 6px', fontSize: '11.5px' }}
            title="Filtrar por idioma"
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {songs.length === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            {loading ? (
              <p>Cargando catálogo...</p>
            ) : karaokeFolders.length === 0 ? (
              <div>
                <Music size={36} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  No hay ninguna carpeta de karaoke agregada.
                </p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  Selecciona la carpeta donde guardas tus vídeos o canciones en tu PC para reproducirlos al instante.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={onOpenFolderManager}
                  style={{ marginTop: '12px' }}
                >
                  <FolderPlus size={16} />
                  Autorizar Carpeta de mi PC
                </button>
              </div>
            ) : (
              <p>No se encontraron canciones que coincidan con los filtros seleccionados.</p>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-surface-raised)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  fontSize: '11.5px',
                }}
              >
                <th style={{ padding: '7px 12px' }}>Título / Artista</th>
                <th style={{ padding: '7px 8px', width: '62px' }}>Duración</th>
                <th style={{ padding: '7px 8px', width: '64px' }}>Formato</th>
                <th style={{ padding: '7px 12px', width: '142px', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => {
                const isMissing = song.asset?.status === 'MISSING';

                return (
                  <tr
                    key={song.id}
                    onDoubleClick={() => {
                      if (!isMissing) onPlayNow(song);
                    }}
                    title="Doble clic para reproducir inmediatamente"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.12s ease',
                      cursor: isMissing ? 'not-allowed' : 'pointer',
                      opacity: isMissing ? 0.65 : 1,
                    }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-surface-raised)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Film size={14} />
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                lineHeight: 1.25,
                              }}
                            >
                              {song.title}
                            </span>
                            {song.language && (
                              <span
                                className="pill"
                                style={{
                                  fontSize: '9px',
                                  backgroundColor: 'var(--bg-surface-hover)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {song.language}
                              </span>
                            )}
                            {isMissing && (
                              <span
                                className="pill"
                                style={{
                                  fontSize: '9px',
                                  backgroundColor: 'var(--status-error)',
                                  color: '#ffffff',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                AUSENTE
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-secondary)',
                              marginTop: '1px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {song.artist}
                            {song.genre ? ` • ${song.genre}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td
                      style={{
                        padding: '8px 8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {formatDuration(song.asset?.durationMs)}
                    </td>

                    <td style={{ padding: '8px 8px' }}>
                      <span
                        className="pill"
                        style={{
                          fontSize: '10px',
                          backgroundColor: 'rgba(255, 177, 0, 0.14)',
                          border: '1px solid rgba(255, 177, 0, 0.35)',
                          color: '#FFB100',
                          padding: '2px 7px',
                        }}
                      >
                        {(song.asset?.extension?.replace('.', '') || 'MEDIA').toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div
                        style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn btn-success"
                          onClick={() => onPlayNow(song)}
                          disabled={isMissing}
                          title="Reproducir este vídeo/canción ahora mismo en el reproductor"
                          style={{
                            width: '30px',
                            height: '28px',
                            minWidth: '30px',
                            minHeight: '28px',
                            padding: 0,
                          }}
                        >
                          <Play size={13} fill="currentColor" />
                        </button>

                        <button
                          className="btn btn-icon btn-primary"
                          onClick={() => onAddToQueue(song)}
                          disabled={isMissing}
                          title="Añadir a la cola de cantantes"
                          style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>

                        <button
                          className="btn btn-icon"
                          onClick={() => onEditSong(song)}
                          title="Editar título, artista, género o idioma"
                          style={{ width: '26px', height: '28px', minWidth: '26px', minHeight: '28px' }}
                        >
                          <Edit2 size={12} />
                        </button>

                        <button
                          className="btn btn-icon"
                          onClick={() => onViewDetails(song)}
                          title="Ver detalles técnicos y ubicación en disco"
                          style={{ width: '26px', height: '28px', minWidth: '26px', minHeight: '28px' }}
                        >
                          <Info size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          backgroundColor: 'var(--bg-surface-raised)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '11.5px',
          color: 'var(--text-secondary)',
        }}
      >
        <span>
          Página {page} de {totalPages} • Doble clic o botón <strong>Play</strong> para reproducir al instante
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="btn btn-icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ width: '26px', height: '26px', minWidth: '26px', minHeight: '26px' }}
            aria-label="Página anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="btn btn-icon"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ width: '26px', height: '26px', minWidth: '26px', minHeight: '26px' }}
            aria-label="Página siguiente"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
};
