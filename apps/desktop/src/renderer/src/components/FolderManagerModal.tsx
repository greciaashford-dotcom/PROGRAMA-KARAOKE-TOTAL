import React, { useState } from 'react';
import {
  X,
  FolderPlus,
  RefreshCw,
  Trash2,
  Folder,
  StopCircle,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import { MediaFolderDTO } from '@karaoke/contracts';

interface FolderManagerModalProps {
  isOpen: boolean;
  folders: MediaFolderDTO[];
  onClose: () => void;
  onSelectFolder: () => Promise<void>;
  onScanFolder: (folderId: string) => Promise<void>;
  onCancelScan: (folderId: string) => Promise<void>;
  onToggleFolder: (folderId: string, enabled: boolean) => Promise<void>;
  onRemoveFolder: (folderId: string) => Promise<void>;
}

export const FolderManagerModal: React.FC<FolderManagerModalProps> = ({
  isOpen,
  folders,
  onClose,
  onSelectFolder,
  onScanFolder,
  onCancelScan,
  onToggleFolder,
  onRemoveFolder,
}) => {
  const [busyFolderId, setBusyFolderId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleScan = async (folderId: string) => {
    setBusyFolderId(folderId);
    try {
      await onScanFolder(folderId);
    } finally {
      setBusyFolderId(null);
    }
  };

  const handleCancel = async (folderId: string) => {
    await onCancelScan(folderId);
  };

  const handleToggle = async (folderId: string, enabled: boolean) => {
    setBusyFolderId(folderId);
    try {
      await onToggleFolder(folderId, enabled);
    } finally {
      setBusyFolderId(null);
    }
  };

  const handleConfirmRemove = async (folderId: string) => {
    setBusyFolderId(folderId);
    setConfirmRemoveId(null);
    try {
      await onRemoveFolder(folderId);
    } finally {
      setBusyFolderId(null);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="folder-modal-title">
      <div className="modal-content" style={{ width: '780px', maxWidth: '94vw' }}>
        <div className="modal-header">
          <h2 id="folder-modal-title" style={{ fontSize: '20px', fontWeight: 900 }}>
            Carpetas del Catálogo y Música de Ambiente
          </h2>
          <button
            type="button"
            className="btn btn-icon"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{ backgroundColor: '#f6efe0' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <p style={{ fontSize: '15px', color: 'var(--ink-secondary)', fontWeight: 600, flex: 1 }}>
              Agrega, reescanea o quita carpetas del catálogo. Quitar una carpeta <strong>NUNCA borra tus archivos del disco duro</strong>.
            </p>
            <button type="button" className="btn btn-surf" onClick={onSelectFolder} style={{ whiteSpace: 'nowrap' }}>
              <FolderPlus size={18} />
              Añadir Carpeta de Karaoke
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {folders.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  border: '2px dashed var(--border-strong)',
                  borderRadius: '10px',
                  color: 'var(--ink-muted)',
                  fontSize: '16px',
                  fontWeight: 700,
                }}
              >
                <Folder size={36} style={{ marginBottom: '8px', opacity: 0.6 }} />
                <p>No hay ninguna carpeta agregada.</p>
              </div>
            ) : (
              folders.map((folder) => {
                const isScanning = folder.scanStatus === 'SCANNING' || busyFolderId === folder.id;
                const isConfirming = confirmRemoveId === folder.id;

                return (
                  <div
                    key={folder.id}
                    className="katakana-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '12px 14px',
                      opacity: folder.enabled ? 1 : 0.65,
                      border: '2px solid var(--ink-piano)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Folder size={18} />
                        <span>{folder.displayName}</span>
                        <span
                          className="pill"
                          style={{
                            backgroundColor: folder.category === 'AMBIENT' ? '#0284c7' : 'var(--accent-surf)',
                            color: folder.category === 'AMBIENT' ? '#ffffff' : 'var(--ink-piano)',
                            border: '1px solid var(--ink-piano)',
                          }}
                        >
                          {folder.category === 'AMBIENT' ? 'AMBIENTE MP3' : 'KARAOKE'}
                        </span>
                        {!folder.enabled && (
                          <span className="pill" style={{ backgroundColor: '#555', color: '#fff' }}>
                            OCULTA
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--ink-muted)', marginTop: '4px', fontWeight: 600 }}>
                        Estado: {folder.scanStatus}
                        {folder.lastScanCompletedAt
                          ? ` • Último escaneo: ${new Date(folder.lastScanCompletedAt).toLocaleString('es-ES')}`
                          : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      {isConfirming ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-danger btn-compact"
                            onClick={() => handleConfirmRemove(folder.id)}
                            disabled={busyFolderId === folder.id}
                          >
                            <Check size={15} />
                            Sí, quitar
                          </button>
                          <button
                            type="button"
                            className="btn btn-compact"
                            onClick={() => setConfirmRemoveId(null)}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-compact"
                            onClick={() => handleToggle(folder.id, !folder.enabled)}
                            disabled={isScanning}
                            title={folder.enabled ? 'Ocultar temporalmente' : 'Mostrar en el catálogo'}
                          >
                            {folder.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                            {folder.enabled ? 'Activa' : 'Oculta'}
                          </button>

                          {folder.scanStatus === 'SCANNING' ? (
                            <button
                              type="button"
                              className="btn btn-compact"
                              onClick={() => handleCancel(folder.id)}
                            >
                              <StopCircle size={15} />
                              Cancelar
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-compact"
                              onClick={() => handleScan(folder.id)}
                              disabled={isScanning}
                            >
                              <RefreshCw size={15} className={isScanning ? 'spin' : ''} />
                              Reescanear
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-danger btn-compact"
                            onClick={() => setConfirmRemoveId(folder.id)}
                            disabled={busyFolderId === folder.id}
                            title="Quitar esta carpeta del programa (tus archivos en disco NO se borran)"
                          >
                            <Trash2 size={15} />
                            Quitar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-dark" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
