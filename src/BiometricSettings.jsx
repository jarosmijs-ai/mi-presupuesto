import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { hasPin } from './SecurityGate';
import { authenticateBiometric, hasBiometric, isBiometricAvailable, registerBiometric, removeBiometric } from './biometricAuth';

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
      setMessage('Configura primero un PIN de respaldo.');
      return;
    }
    setBusy(true);
    setMessage('Abriendo la seguridad del dispositivo…');
    try {
      await registerBiometric();
      const verified = await authenticateBiometric();
      if (!verified) throw new Error('La biometría se registró, pero no pudo verificarse. Inténtalo otra vez.');
      setEnabled(true);
      setMessage('Biometría verificada. Será el método principal al abrir la app.');
    } catch (error) {
      setEnabled(hasBiometric());
      if (error?.name === 'NotAllowedError') {
        setMessage('La verificación fue cancelada o bloqueada por el navegador.');
      } else {
        setMessage(error.message || 'No se pudo activar la biometría.');
      }
    } finally {
      setBusy(false);
    }
  }

  function disable() {
    removeBiometric();
    setEnabled(false);
    setMessage('Biometría desactivada. El PIN queda como método principal.');
  }

  if (!target) return null;

  return createPortal(
    <section className="product-setting-card product-stack biometric-setting-card">
      <div>
        <h3>Acceso biométrico</h3>
        <p>{available ? 'Será la verificación principal. El PIN solo aparecerá como respaldo.' : 'Este navegador no ofrece un autenticador integrado compatible.'}</p>
      </div>
      {available && (
        <button type="button" className={enabled ? 'product-secondary' : ''} onClick={enabled ? disable : enable} disabled={busy}>
          {busy ? 'Verificando…' : enabled ? 'Desactivar biometría' : 'Activar y comprobar biometría'}
        </button>
      )}
      {message && <small className="biometric-setting-message">{message}</small>}
    </section>,
    target
  );
}
