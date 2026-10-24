import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { SongDTO, UpdateSongDTO } from '@karaoke/contracts';

interface EditSongModalProps {
  song: SongDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: UpdateSongDTO) => Promise<void>;
}

export const EditSongModal: React.FC<EditSongModalProps> = ({
  song,
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [language, setLanguage] = useState('');
  const [genre, setGenre] = useState('');
  const [collection, setCollection] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (song) {
      setTitle(song.title);
      setArtist(song.artist);
      setLanguage(song.language || '');
      setGenre(song.genre || '');
      setCollection(song.collection || '');
    }
  }, [song]);

  if (!isOpen || !song) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;

    setSaving(true);
    try {
      await onSave({
        songId: song.id,
        title: title.trim(),
        artist: artist.trim(),
        language: language.trim() || null,
        genre: genre.trim() || null,
        collection: collection.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-song-title">
      <div className="modal-content" style={{ width: '540px' }}>
        <div className="modal-header">
          <h2 id="edit-song-title" style={{ fontSize: '18px', fontWeight: 600 }}>
            Editar Metadatos de Canción
          </h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Esta corrección se guardará permanentemente en el catálogo local (fuente MANUAL) sin renombrar ni alterar el archivo en disco.
            </p>

            <div className="form-group">
              <label className="form-label">Título de la Canción *</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Artista / Intérprete *</label>
              <input
                type="text"
                className="form-input"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Idioma (ej. Español, Inglés)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Opcional"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Género (ej. Pop, Rock, Balada)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Opcional"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Colección / Disco</label>
              <input
                type="text"
                className="form-input"
                placeholder="Opcional"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar Corrección'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
