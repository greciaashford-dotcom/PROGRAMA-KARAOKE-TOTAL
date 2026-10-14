import React, { useState } from 'react';
import { X, ExternalLink, RefreshCw, FileText } from 'lucide-react';
import { SongDTO } from '@karaoke/contracts';

interface SongDetailsModalProps {
  song: SongDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onLocateInExplorer: (mediaAssetId: string) => Promise<void>;
  onReanalyze: (mediaAssetId: string) => Promise<void>;
}

export const SongDetailsModal: React.FC<SongDetailsModalProps> = ({
  song,
  isOpen,
  onClose,
  onLocateInExplorer,
  onReanalyze,
}) => {
  const [reanalyzing, setReanalyzing] = useState(false);

  if (!isOpen || !song || !song.asset) return null;

  const asset = song.asset;
  const sizeMb = (asset.sizeBytes / (1024 * 1024)).toFixed(2);
  const durationSec = asset.durationMs ? Math.round(asset.durationMs / 1000) : 0;
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const formattedDuration = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      await onReanalyze(asset.id);
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="details-modal-title">
      <div className="modal-content" style={{ width: '560px' }}>
        <div className="modal-header">
          <h2 id="details-modal-title" style={{ fontSize: '18px', fontWeight: 600 }}>
            Detalles Técnicos del Archivo
          </h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <FileText size={32} color="var(--accent-warm)" />
            <div>
              <strong style={{ fontSize: '17px' }}>{song.title}</strong>
              <div style={{ color: 'var(--text-secondary)' }}>{song.artist}</div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>Archivo:</td>
                <td style={{ padding: '8px 0', fontWeight: 500 }}>{asset.filename}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>Estado:</td>
                <td style={{ padding: '8px 0' }}>
                  <span
                    className="pill"
                    style={{
                      fontSize: '12px',
                      backgroundColor:
                        asset.status === 'AVAILABLE'
                          ? 'var(--status-ready)'
                          : asset.status === 'MISSING'
                            ? 'var(--status-warning)'
                            : 'var(--status-error)',
                      color: '#18181b',
                    }}
                  >
                    {asset.status}
                  </span>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>Duración:</td>
                <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{formattedDuration}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>Tamaño:</td>
                <td style={{ padding: '8px 0' }}>{sizeMb} MB</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>Contenedor:</td>
                <td style={{ padding: '8px 0' }}>{asset.container || 'Desconocido'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>Códec de Vídeo:</td>
                <td style={{ padding: '8px 0' }}>{asset.videoCodec || 'Solo Audio'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>Códec de Audio:</td>
                <td style={{ padding: '8px 0' }}>{asset.audioCodec || 'Desconocido'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>Resolución:</td>
                <td style={{ padding: '8px 0' }}>
                  {asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'N/A'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>Canales de Audio:</td>
                <td style={{ padding: '8px 0' }}>{asset.audioChannels ? `${asset.audioChannels} canales` : 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn"
              onClick={() => onLocateInExplorer(asset.id)}
              title="Abrir carpeta en el Explorador de Windows"
            >
              <ExternalLink size={16} />
              Localizar en Explorador
            </button>

            <button
              className="btn"
              onClick={handleReanalyze}
              disabled={reanalyzing}
              title="Volver a ejecutar ffprobe sobre este activo"
            >
              <RefreshCw size={16} className={reanalyzing ? 'spin' : ''} />
              {reanalyzing ? 'Analizando...' : 'Volver a analizar'}
            </button>
          </div>

          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
