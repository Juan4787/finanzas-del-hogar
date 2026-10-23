import React from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isDestructive = true,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div
        className="modal-content confirm-modal-card animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
      >
        <div className="confirm-icon-box">
          {isDestructive ? (
            <Trash2 size={24} className="text-danger" />
          ) : (
            <AlertCircle size={24} className="text-amber" />
          )}
        </div>

        <h3 className="confirm-modal-title">{title}</h3>
        <p className="confirm-modal-message">{message}</p>

        <div className="confirm-modal-actions">
          <button type="button" className="btn-confirm-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn-confirm-action ${isDestructive ? 'btn-action-danger' : 'btn-action-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
