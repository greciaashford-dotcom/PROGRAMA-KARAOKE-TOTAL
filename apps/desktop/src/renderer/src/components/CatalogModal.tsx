import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  FolderPlus,
  Play,
  ListPlus,
  ChevronLeft,
  ChevronRight,
  Music,
  Minus,
  Plus,
  Edit2,
  BookmarkCheck,
} from 'lucide-react';
import { SongDTO, MediaFolderDTO, MediaStatus, SingerDTO } from '@karaoke/contracts';
import { cleanDisplayTitle, cleanDisplayArtist, formatTimeMMSS } from '../utils/title-cleaner.js';

export interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: MediaFolderDTO[];
  singers: SingerDTO[];
  memorizedSongs: Record<string, number>;
  refreshTrigger: number;
  scanProgress: {
    folderId: string;
    discovered: number;
    processed: number;
    errors: number;
    status: string;
    currentFile?: string;
  } | null;
  onOpenFolderManager: () => void;
  onPlayNow: (song: SongDTO) => Promise<void>;
  onEnqueueWithSingerAndPitch: (
    song: SongDTO,
    singerName: string,
    keyShift: number,
  ) => Promise<void>;
  onEditSong: (song: SongDTO) => void;
}

export const CatalogModal: React.FC<CatalogModalProps> = ({
  isOpen,
  onClose,
  folders,
  singers,
  memorizedSongs,
  refreshTrigger,
  scanProgress,
  onOpenFolderManager,
  onPlayNow,
  onEnqueueWithSingerAndPitch,
  onEditSong,
}) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [songs, setSongs] = useState<SongDTO[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(40);
  const [search, setSearch] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedExtension, setSelectedExtension] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Estado del formulario rápido para añadir a la Cola con Cantante + Tono (-6..+6)
  const [queueDraftSong, setQueueDraftSong] = useState<SongDTO | null>(null);
  const [singerName, setSingerName] = useState<string>('');
  const [keyShift, setKeyShift] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);

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
        sortBy: 'title',
        sortOrder: 'asc',
      });
      if (res.success) {
        setSongs(res.data.items);
        setTotal(res.data.total);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchSongs();
  }, [isOpen, page, selectedFolderId, selectedStatus, selectedExtension, refreshTrigger]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchSongs();
    }, 180);
    return () => clearTimeout(timer);
  }, [search, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } else {
      setQueueDraftSong(null);
      setKeyShift(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const karaokeFolders = folders.filter((f) => f.category === 'KARAOKE');
  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleConfirmAddToQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueDraftSong || !singerName.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onEnqueueWithSingerAndPitch(queueDraftSong, singerName.trim(), keyShift);
      setQueueDraftSong(null);
      setSingerName('');
      setKeyShift(0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalog-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{ width: '92vw', maxWidth: '1180px', height: '88vh' }}
      >
        {/* Cabecera Modal */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Music size={24} color="var(--accent-surf)" />
            <h2 id="catalog-modal-title" style={{ fontSize: '22px', fontWeight: 900 }}>
              CATÁLOGO DE KARAOKE ({total.toLocaleString('es-ES')} canciones)
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-surf"
              onClick={onOpenFolderManager}
              style={{ minHeight: '38px' }}
            >
              <FolderPlus size={18} />
              Carpetas ({karaokeFolders.length})
            </button>
            <button
              type="button"
              className="btn btn-dark btn-icon"
              onClick={onClose}
              aria-label="Cerrar catálogo"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Barra de progreso si hay escaneo activo */}
        {scanProgress && scanProgress.status === 'SCANNING' && (
          <div
            style={{
              padding: '8px 18px',
              backgroundColor: 'rgba(0, 229, 209, 0.16)',
              borderBottom: '1px solid rgba(201, 160, 80, 0.5)',
              fontSize: '15px',
              fontWeight: 700,
              color: '#F3EFE6',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              Indexando canciones: {scanProgress.processed} / {scanProgress.discovered}
            </span>
            <span>{scanProgress.currentFile || ''}</span>
          </div>
        )}

        {/* Buscador gigante + Filtros */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#111722',
            borderBottom: '1px solid rgba(201, 160, 80, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ position: 'relative' }}>
            <Search
              size={22}
              style={{ position: 'absolute', left: '14px', top: '12px', color: '#F3D285' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              className="form-input"
              placeholder="Escribe el nombre de la canción o artista (sin tildes ni códigos)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                minHeight: '48px',
                fontSize: '19px',
                paddingLeft: '46px',
                paddingRight: search ? '44px' : '14px',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '10px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
            <select
              className="form-input"
              value={selectedFolderId}
              onChange={(e) => {
                setSelectedFolderId(e.target.value);
                setPage(1);
              }}
              style={{ minHeight: '38px', fontSize: '15px' }}
            >
              <option value="">Todas las carpetas</option>
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
              style={{ minHeight: '38px', fontSize: '15px' }}
            >
              <option value="">Todos los formatos</option>
              <option value=".dat">VCD Karaoke (.DAT)</option>
              <option value=".mp4">Vídeo (.MP4)</option>
              <option value=".mkv">Vídeo (.MKV)</option>
              <option value=".avi">Vídeo (.AVI)</option>
              <option value=".cdg">CD+G Karaoke (.CDG)</option>
              <option value=".mp3">Audio (.MP3)</option>
            </select>

            <select
              className="form-input"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              style={{ minHeight: '38px', fontSize: '15px' }}
            >
              <option value="">Todos los estados</option>
              <option value="AVAILABLE">Disponibles</option>
              <option value="MISSING">Ausentes</option>
            </select>
          </div>
        </div>

        {/* Panel rápido integrado para elegir Cantante + Tono (-6 a +6) al agregar a la Cola */}
        {queueDraftSong && (
          <form
            onSubmit={handleConfirmAddToQueue}
            style={{
              padding: '14px 18px',
              backgroundColor: '#151515',
              color: '#f6efe0',
              borderBottom: '3px solid var(--accent-surf)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-surf)', textTransform: 'uppercase' }}>
                  AGREGAR A LA COLA DE ESCENARIO
                </div>
                <div style={{ fontSize: '21px', fontWeight: 900 }}>
                  {cleanDisplayTitle(queueDraftSong.title)}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-compact"
                onClick={() => setQueueDraftSong(null)}
              >
                <X size={16} />
                Cancelar
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '12px', alignItems: 'end' }}>
              <div className="form-group">
                <label style={{ fontSize: '15px', fontWeight: 700, color: '#f6efe0' }}>
                  Nombre del Cantante *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. María, Carlos, Mesa 4..."
                  value={singerName}
                  onChange={(e) => setSingerName(e.target.value)}
                  autoFocus
                  required
                  style={{ fontSize: '18px', minHeight: '44px' }}
                />
                {singers.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {singers.slice(0, 8).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSingerName(s.displayName)}
                        style={{
                          backgroundColor:
                            singerName === s.displayName ? 'var(--accent-surf)' : '#2b2b2b',
                          color: singerName === s.displayName ? '#151515' : '#f6efe0',
                          border: '1px solid #555',
                          borderRadius: '6px',
                          padding: '3px 9px',
                          fontSize: '14px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {s.displayName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label style={{ fontSize: '15px', fontWeight: 700, color: '#f6efe0' }}>
                  Tono Inicial ({keyShift > 0 ? `+${keyShift}` : keyShift} semitonos)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setKeyShift((k) => Math.max(-6, k - 1))}
                    disabled={keyShift <= -6}
                    style={{ minWidth: '44px' }}
                  >
                    <Minus size={18} />
                  </button>
                  <div
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '20px',
                      fontWeight: 900,
                      color: keyShift !== 0 ? 'var(--accent-surf)' : '#f6efe0',
                      backgroundColor: '#252525',
                      borderRadius: '8px',
                      padding: '6px 0',
                    }}
                  >
                    {keyShift === 0 ? '0 (Original)' : keyShift > 0 ? `+${keyShift} st` : `${keyShift} st`}
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setKeyShift((k) => Math.min(6, k + 1))}
                    disabled={keyShift >= 6}
                    style={{ minWidth: '44px' }}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-surf"
                disabled={submitting || !singerName.trim()}
                style={{ minHeight: '48px', fontSize: '17px', padding: '0 20px' }}
              >
                <ListPlus size={20} />
                {submitting ? 'Agregando...' : 'Confirmar a la Cola'}
              </button>
            </div>
          </form>
        )}

        {/* Tabla grande y legible del Catálogo */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-surface)' }}>
          {songs.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', fontSize: '19px', fontWeight: 700 }}>
              {loading ? (
                'Cargando canciones...'
              ) : karaokeFolders.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                  <span>No hay carpetas de karaoke configuradas todavía.</span>
                  <button type="button" className="btn btn-surf" onClick={onOpenFolderManager}>
                    <FolderPlus size={20} />
                    Seleccionar Carpeta de Karaoke del PC
                  </button>
                </div>
              ) : (
                'No se encontraron canciones con ese filtro.'
              )}
            </div>
          ) : (
            <table className="katakana-table">
              <thead>
                <tr>
                  <th>Canción</th>
                  <th style={{ width: '95px' }}>Duración</th>
                  <th style={{ width: '95px' }}>Formato</th>
                  <th style={{ width: '320px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {songs.map((song) => {
                  const isMissing = song.asset?.status === 'MISSING';
                  const cleanTitle = cleanDisplayTitle(song.title);
                  const cleanArtist = cleanDisplayArtist(song.artist);
                  const memVol =
                    memorizedSongs[song.mediaAssetId] !== undefined
                      ? memorizedSongs[song.mediaAssetId]
                      : null;

                  return (
                    <tr
                      key={song.id}
                      style={{ opacity: isMissing ? 0.55 : 1 }}
                      onDoubleClick={() => {
                        if (!isMissing) {
                          setQueueDraftSong(song);
                          setKeyShift(0);
                        }
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800 }}>{cleanTitle}</span>
                          {memVol !== null && (
                            <span
                              className="pill"
                              style={{
                                backgroundColor: 'var(--accent-surf-soft)',
                                border: '1px solid var(--accent-surf-dark)',
                                color: 'var(--ink-piano)',
                                gap: '3px',
                              }}
                            >
                              <BookmarkCheck size={12} />
                              {memVol}%
                            </span>
                          )}
                          {isMissing && (
                            <span className="pill" style={{ backgroundColor: 'var(--status-error)', color: '#fff' }}>
                              AUSENTE
                            </span>
                          )}
                        </div>
                        {cleanArtist && (
                          <div style={{ fontSize: '15px', color: 'var(--ink-muted)', fontWeight: 600 }}>
                            {cleanArtist}
                          </div>
                        )}
                      </td>

                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '16px' }}>
                        {song.asset?.durationMs ? formatTimeMMSS(song.asset.durationMs) : '--:--'}
                      </td>

                      <td>
                        <span
                          className="pill"
                          style={{
                            backgroundColor: 'var(--ink-piano)',
                            color: '#f6efe0',
                            fontSize: '13px',
                          }}
                        >
                          {(song.asset?.extension?.replace('.', '') || 'MEDIA').toUpperCase()}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-surf btn-compact"
                            disabled={isMissing}
                            onClick={() => {
                              setQueueDraftSong(song);
                              setKeyShift(0);
                            }}
                          >
                            <ListPlus size={16} />
                            + A la Cola
                          </button>

                          <button
                            type="button"
                            className="btn btn-dark btn-compact"
                            disabled={isMissing}
                            onClick={async () => {
                              await onPlayNow(song);
                              onClose();
                            }}
                            title="Reproducir directamente sin encolar"
                          >
                            <Play size={15} fill="currentColor" />
                            Play ya
                          </button>

                          <button
                            type="button"
                            className="btn btn-compact"
                            onClick={() => onEditSong(song)}
                            title="Editar título o artista"
                            style={{ minWidth: '38px', padding: 0 }}
                          >
                            <Edit2 size={15} />
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

        {/* Pie de paginación */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: '15px', fontWeight: 700 }}>
            Página {page} de {totalPages} • Doble clic en cualquier canción para agregar a la Cola
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={18} />
              Anterior
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
