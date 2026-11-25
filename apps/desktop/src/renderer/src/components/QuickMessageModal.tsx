import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Send, Trash2 } from 'lucide-react';

interface QuickMessageModalProps {
  isOpen: boolean;
  currentMessage: string | null;
  onClose: () => void;
  onSendMessage: (msg: string | null) => Promise<void>;
}

const PRESETS = [
  '¡Feliz Cumpleaños en Katakana Karaoke!',
  '¡Un fuerte aplauso para nuestro cantante!',
  '¡Última ronda de canciones de la noche!',
  'Pide tu canción en cabina — ¡Anímate a cantar!',
];

export const QuickMessageModal: React.FC<QuickMessageModalProps> = ({
  isOpen,
  currentMessage,
  onClose,
  onSendMessage,
}) => {
  const [text, setText] = useState(currentMessage || '');

  useEffect(() => {
    if (isOpen) {
      setText(currentMessage || '');
    }
  }, [isOpen, currentMessage]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSendMessage(text.trim() || null);
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="quick-msg-title">
      <div className="modal-content" style={{ width: '580px' }}>
        <div className="modal-header">
          <span id="quick-msg-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={22} color="var(--accent-surf)" />
            Mensaje Rápido en Pantalla Pública
          </span>
          <button type="button" className="btn btn-icon" onClick={onClose} style={{ backgroundColor: '#f6efe0' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Texto del aviso en pantalla:</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. ¡Feliz Cumpleaños Ana!"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
                style={{ fontSize: '18px', minHeight: '48px' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mensajes rápidos sugeridos:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="btn"
                    onClick={() => setText(preset)}
                    style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            {currentMessage ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await onSendMessage(null);
                  onClose();
                }}
              >
                <Trash2 size={17} />
                Quitar Mensaje Actual
              </button>
            ) : (
              <span />
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-surf">
                <Send size={17} />
                Mostrar en Pantalla
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
