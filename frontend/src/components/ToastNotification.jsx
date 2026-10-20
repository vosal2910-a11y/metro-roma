import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function ToastNotification({ toast, onDismiss }) {
  if (!toast) return null;

  const { text, type = 'info' } = toast;

  return (
    <div className={`toast-notification toast-${type}`} role="status" aria-live="polite">
      <div className="toast-content">
        {type === 'success' && <CheckCircle2 size={18} className="toast-icon-status" />}
        {type === 'error' && <AlertCircle size={18} className="toast-icon-status" />}
        {type === 'info' && <Info size={18} className="toast-icon-status" />}
        <span className="toast-text">{text}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="toast-close-btn"
          onClick={onDismiss}
          aria-label="Chiudi notifica"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
