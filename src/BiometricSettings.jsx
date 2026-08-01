import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { hasPin } from './SecurityGate';
import { hasBiometric, isBiometricAvailable, registerBiometric, removeBiometric } from './biometricAuth';

export default function BiometricSettings() {
  const [target, setTarget] = useState(null);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(hasBiometric);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const refreshTarget = () => setTarget(document.querySelector('.product-panel-body'));
    refreshTarget();
    const observer = new MutationObserver(refreshTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    isBiometricAvailable().then(setAvailable);
    return () => observer.disconnect();
  }, []);

  async function enable() {
    if (!hasPin()) {
      setMessage('Activa primero un PIN para conservar un método de respaldo.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await registerBiometric();
      setEnabled(true);
      setMessage('Biometría activada en este dispositivo.');
    } catch (error) {
      if (error?.name !== 'NotAllowedError') setMessage(error.message || 'No se pudo activar la biometría.');
    } finally {
      setBusy(false);
    }
  }

  function disable() {
    removeBiometric();
    setEnabled(false);
    setMessage('Biometría desactivada. El PIN sigue activo.');
  }

  if (!target) return null;

  return createPortal(
    <section className="product-setting-card product-stack biometric-setting-card">
      <div>
        <h3>Huella o reconocimiento facial</h3>
        <p>{available ? 'Desbloquea con la seguridad integrada del dispositivo. El PIN permanece como respaldo.' : 'Este dispositivo o navegador no ofrece biometría web compatible.'}</p>
      </div>
      {available && (
        <button type="button" className={enabled ? 'product-secondary' : ''} onClick={enabled ? disable : enable} disabled={busy}>
          {busy ? 'Configurando…' : enabled ? 'Desactivar biometría' : 'Activar biometría'}
        </button>
      )}
      {message && <small className="biometric-setting-message">{message}</small>}
    </section>,
    target
  );
}
