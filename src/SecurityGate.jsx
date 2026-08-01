import React, { useEffect, useRef, useState } from 'react';
import { authenticateBiometric, hasBiometric, isBiometricAvailable, removeBiometric } from './biometricAuth';

const PIN_KEY = 'app-pin-hash';
const UNLOCK_KEY = 'app-session-unlocked';

async function hashPin(pin) {
  const bytes = new TextEncoder().encode(`mi-presupuesto:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function savePin(pin) {
  localStorage.setItem(PIN_KEY, await hashPin(pin));
  sessionStorage.setItem(UNLOCK_KEY, 'true');
}

export function removePin() {
  localStorage.removeItem(PIN_KEY);
  sessionStorage.removeItem(UNLOCK_KEY);
  removeBiometric();
}

export function hasPin() {
  return Boolean(localStorage.getItem(PIN_KEY));
}

function hasLocalLock() {
  return hasPin() || hasBiometric();
}

export default function SecurityGate({ children }) {
  const [locked, setLocked] = useState(() => hasLocalLock() && sessionStorage.getItem(UNLOCK_KEY) !== 'true');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const inputRef = useRef(null);
  const attemptRef = useRef(0);

  function finishUnlock() {
    setError('');
    setUnlocked(true);
    sessionStorage.setItem(UNLOCK_KEY, 'true');
    window.setTimeout(() => setLocked(false), 620);
  }

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden' && hasLocalLock()) {
        sessionStorage.removeItem(UNLOCK_KEY);
        setLocked(true);
        setUnlocked(false);
        setPin('');
        setError('');
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!locked) return;
    isBiometricAvailable().then((available) => setBiometricAvailable(available && hasBiometric()));
    window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [locked]);

  useEffect(() => {
    if (!locked || !hasPin() || pin.length < 4 || unlocked) return undefined;
    const attempt = ++attemptRef.current;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      const expected = localStorage.getItem(PIN_KEY);
      const actual = await hashPin(pin);
      if (attempt !== attemptRef.current) return;
      if (actual === expected) {
        finishUnlock();
        return;
      }
      setChecking(false);
      setError('El PIN no coincide. Inténtalo nuevamente.');
      window.setTimeout(() => {
        setPin('');
        inputRef.current?.focus();
      }, 260);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [pin, locked, unlocked]);

  async function unlockWithBiometric() {
    setBiometricBusy(true);
    setError('');
    try {
      const verified = await authenticateBiometric();
      if (verified) finishUnlock();
    } catch (biometricError) {
      if (biometricError?.name !== 'NotAllowedError') {
        setError('No se pudo verificar la biometría. Usa tu PIN.');
      }
    } finally {
      setBiometricBusy(false);
    }
  }

  if (!locked) return children;

  return (
    <main className={`security-screen ${unlocked ? 'is-unlocked' : ''}`}>
      <div className="security-ambient security-ambient-one" />
      <div className="security-ambient security-ambient-two" />
      <section className="security-card" aria-labelledby="security-title">
        <div className="security-brand-row">
          <div className="security-logo" aria-hidden="true">Q</div>
          <div><span>MI PRESUPUESTO</span><small>Acceso protegido</small></div>
        </div>
        <div className="security-copy">
          <div className="security-lock-icon" aria-hidden="true">{unlocked ? '✓' : biometricAvailable ? '◎' : '⌁'}</div>
          <h1 id="security-title">{unlocked ? 'Acceso confirmado' : 'Bienvenido de nuevo'}</h1>
          <p>{unlocked ? 'Protección verificada. Abriendo tu presupuesto…' : biometricAvailable ? 'Usa la biometría del dispositivo o ingresa tu PIN.' : 'Ingresa tu PIN para consultar tu información financiera.'}</p>
        </div>

        {biometricAvailable && !unlocked && (
          <button type="button" className="security-biometric-button" onClick={unlockWithBiometric} disabled={biometricBusy}>
            <span aria-hidden="true">◎</span>
            {biometricBusy ? 'Verificando…' : 'Desbloquear con biometría'}
          </button>
        )}

        {hasPin() && (
          <div className="security-auto-form">
            {biometricAvailable && <div className="security-divider"><span>o usa tu PIN</span></div>}
            <label htmlFor="security-pin">PIN de seguridad</label>
            <div className={`security-pin-field ${error ? 'has-error' : ''} ${unlocked ? 'is-success' : ''}`} onClick={() => inputRef.current?.focus()}>
              <div className="security-pin-dots" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => <span key={index} className={pin.length > index ? 'filled' : ''} />)}
                {pin.length > 4 && <b>+{pin.length - 4}</b>}
              </div>
              <input ref={inputRef} id="security-pin" autoComplete="current-password" inputMode="numeric" type="password" minLength="4" maxLength="8" value={pin} disabled={unlocked} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }} aria-describedby={error ? 'security-error' : undefined} />
            </div>
            <div className="security-helper-row"><small>{checking ? 'Verificando automáticamente…' : 'Se desbloquea al reconocer el PIN'}</small><small>{pin.length}/8</small></div>
          </div>
        )}

        {error && <div id="security-error" className="security-error" role="alert"><span>!</span>{error}</div>}
        <p className="security-privacy-note">La huella o rostro permanecen dentro del dispositivo.</p>
      </section>
    </main>
  );
}
