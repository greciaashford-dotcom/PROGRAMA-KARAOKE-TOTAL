import React, { useState } from 'react';
import { X, FolderPlus, RefreshCw, Trash2, Folder } from 'lucide-react';
import { MediaFolderDTO } from '@karaoke/contracts';

interface FolderManagerModalProps {
  isOpen: boolean;
  folders: MediaFolderDTO[];
  onClose: () => void;
  onSelectFolder: () => Promise<void>;
  onScanFolder: (folderId: string) => Promise<void>;
  onRemoveFolder: (folderId: string) => Promise<void>;
}

export const FolderManagerModal: React.FC<FolderManagerModalProps> = ({
  isOpen,
  folders,
  onClose,
  onSelectFolder,
  onScanFolder,
  onRemoveFolder,
}) => {
  const [busyFolderId, setBusyFolderId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleScan = async (folderId: string) => {
    setBusyFolderId(folderId);
    try {
      await onScanFolder(folderId);
    } finally {
      setBusyFolderId(null);
    }
  };

  const handleRemove = async (folderId: string) => {
    if (window.confirm('¿Deseas desautorizar esta carpeta? Los archivos físicos no se borrarán del disco.')) {
      setBusyFolderId(folderId);
      try {
        await onRemoveFolder(folderId);
      } finally {
        setBusyFolderId(null);
      }
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="folder-modal-title">
      <div className="modal-content" style={{ width: '650px' }}>
        <div className="modal-header">
          <h2 id="folder-modal-title" style={{ fontSize: '18px', fontWeight: 600 }}>
            Gestión de Carpetas Autorizadas
          </h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Solo los vídeos de las carpetas explícitamente autorizadas se indexan y reproducen.
            </p>
            <button className="btn btn-primary" onClick={onSelectFolder}>
              <FolderPlus size={18} />
              Añadir Carpeta
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
            {folders.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  border: '1px dashed var(--border-strong)',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                }}
              >
                <Folder size={36} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p>No hay ninguna carpeta de karaoke autorizada.</p>
                <p style={{ fontSize: '13px' }}>Pulsa &quot;Añadir Carpeta&quot; para seleccionar vídeos del ordenador.</p>
              </div>
            ) : (
              folders.map((folder) => {
                const isScanning = folder.scanStatus === 'SCANNING' || busyFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--bg-surface-raised)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '12px 16px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Folder size={18} color="var(--accent-warm)" />
                        <span>{folder.displayName}</span>
                        <span
                          className="pill"
                          style={{
                            fontSize: '11px',
                            backgroundColor:
                              folder.scanStatus === 'SCANNING'
                                ? 'var(--status-warning)'
                                : folder.scanStatus === 'COMPLETED'
                                  ? 'var(--status-ready)'
                                  : 'var(--bg-surface-hover)',
                            color: '#18181b',
                          }}
                        >
                          {folder.scanStatus}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {folder.lastScanCompletedAt
                          ? `Último escaneo: ${new Date(folder.lastScanCompletedAt).toLocaleString('es-ES')}`
                          : 'Pendiente de escaneo'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn"
                        onClick={() => handleScan(folder.id)}
                        disabled={isScanning}
                        title="Reescanear carpeta"
                      >
                        <RefreshCw size={16} className={isScanning ? 'spin' : ''} />
                        Reescanear
                      </button>

                      <button
                        className="btn"
                        onClick={() => handleRemove(folder.id)}
                        disabled={isScanning}
                        title="Desautorizar carpeta"
                        style={{ color: 'var(--status-error)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
