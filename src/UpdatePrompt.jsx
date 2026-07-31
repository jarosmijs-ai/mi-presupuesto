import React, { useEffect, useState } from 'react';
import { DownloadCloud, X } from 'lucide-react';

export default function UpdatePrompt() {
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    function handleUpdate(event) {
      setRegistration(event.detail);
    }

    window.addEventListener('budget-app-update', handleUpdate);
    return () => window.removeEventListener('budget-app-update', handleUpdate);
  }, []);

  if (!registration?.waiting) return null;

  function applyUpdate() {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  return (
    <aside className="update-toast" role="status" aria-live="polite">
      <span className="update-toast-icon"><DownloadCloud size={20} /></span>
      <span className="update-toast-copy">
        <strong>Nueva versión disponible</strong>
        <small>Actualiza para obtener las últimas mejoras.</small>
      </span>
      <button type="button" className="update-toast-primary" onClick={applyUpdate}>
        Actualizar
      </button>
      <button
        type="button"
        className="update-toast-close"
        onClick={() => setRegistration(null)}
        aria-label="Cerrar aviso"
      >
        <X size={18} />
      </button>
    </aside>
  );
}
