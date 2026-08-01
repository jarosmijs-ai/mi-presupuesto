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
  const [showPin, setShowPin] = useState(false);
  const inputRef = useRef(null);
  const attemptRef = useRef(0);
  const biometricAttemptedRef = useRef(false);

  function finishUnlock() {
    setError('');
    setUnlocked(true);
    sessionStorage.setItem(UNLOCK_KEY, 'true');
    window.setTimeout(() => setLocked(false), 520);
  }

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden' && hasLocalLock()) {
        sessionStorage.removeItem(UNLOCK_KEY);
        biometricAttemptedRef.current = false;
        setLocked(true);
        setUnlocked(false);
        setShowPin(false);
        setPin('');
        setError('');
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  async function unlockWithBiometric({ automatic = false } = {}) {
    if (biometricBusy || unlocked) return;
    setBiometricBusy(true);
    setError('');
    try {
      const verified = await authenticateBiometric();
      if (verified) {
        finishUnlock();
        return;
      }
      setShowPin(hasPin());
    } catch (biometricError) {
      setShowPin(hasPin());
      if (!automatic && biometricError?.name !== 'NotAllowedError') {
        setError('No se pudo verificar el dispositivo. Usa tu PIN.');
      }
    } finally {
      setBiometricBusy(false);
    }
  }

  useEffect(() => {
    if (!locked) return;
    let cancelled = false;
    isBiometricAvailable().then((available) => {
      if (cancelled) return;
      const ready = available && hasBiometric();
      setBiometricAvailable(ready);
      if (ready && !biometricAttemptedRef.current) {
        biometricAttemptedRef.current = true;
        window.setTimeout(() => unlockWithBiometric({ automatic: true }), 250);
      } else if (!ready) {
        setShowPin(hasPin());
        window.setTimeout(() => inputRef.current?.focus(), 120);
      }
    });
    return () => { cancelled = true; };
  }, [locked]);

  useEffect(() => {
    if (!locked || !showPin || !hasPin() || pin.length < 4 || unlocked) return undefined;
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
      setError('El PIN no coincide.');
      window.setTimeout(() => {
        setPin('');
        inputRef.current?.focus();
      }, 240);
    }, 360);
    return () => window.clearTimeout(timer);
  }, [pin, locked, unlocked, showPin]);

  if (!locked) return children;

  const biometricPrimary = biometricAvailable && !showPin;

  return (
    <main className={`security-screen ${unlocked ? 'is-unlocked' : ''}`}>
      <div className="security-ambient security-ambient-one" />
      <div className="security-ambient security-ambient-two" />
      <section className={`security-card ${biometricPrimary ? 'biometric-primary' : ''}`} aria-labelledby="security-title">
        <div className="security-brand-row">
          <div className="security-logo" aria-hidden="true">Q</div>
          <div><span>MI PRESUPUESTO</span><small>Acceso protegido</small></div>
        </div>

        <div className="security-copy">
          <h1 id="security-title">{unlocked ? 'Acceso confirmado' : biometricPrimary ? 'Verifica tu identidad' : 'Ingresa tu PIN'}</h1>
          <p>{unlocked ? 'Abriendo tu presupuesto…' : biometricPrimary ? 'Usando la seguridad de este dispositivo.' : 'El PIN se valida automáticamente.'}</p>
        </div>

        {biometricPrimary && !unlocked && (
          <>
            <div className="security-biometric-status" aria-live="polite">
              <div className="security-biometric-pulse" aria-hidden="true">◎</div>
              <strong>{biometricBusy ? 'Esperando verificación…' : 'Biometría lista'}</strong>
            </div>
            <button type="button" className="security-biometric-button" onClick={() => unlockWithBiometric()} disabled={biometricBusy}>
              {biometricBusy ? 'Verificando…' : 'Intentar nuevamente'}
            </button>
            {hasPin() && <button type="button" className="security-pin-fallback" onClick={() => { setShowPin(true); window.setTimeout(() => inputRef.current?.focus(), 80); }}>Usar PIN</button>}
          </>
        )}

        {showPin && hasPin() && !unlocked && (
          <div className="security-auto-form is-fallback">
            {biometricAvailable && <button type="button" className="security-pin-fallback" onClick={() => { setShowPin(false); unlockWithBiometric(); }}>Volver a biometría</button>}
            <div className={`security-pin-field ${error ? 'has-error' : ''}`} onClick={() => inputRef.current?.focus()}>
              <div className="security-pin-dots" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => <span key={index} className={pin.length > index ? 'filled' : ''} />)}
                {pin.length > 4 && <b>+{pin.length - 4}</b>}
              </div>
              <input ref={inputRef} id="security-pin" autoComplete="current-password" inputMode="numeric" type="password" minLength="4" maxLength="8" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }} />
            </div>
            <div className="security-helper-row"><small>{checking ? 'Verificando…' : 'PIN de respaldo'}</small><small>{pin.length}/8</small></div>
          </div>
        )}

        {unlocked && <div className="security-biometric-status"><div className="security-biometric-pulse">✓</div></div>}
        {error && <div id="security-error" className="security-error" role="alert"><span>!</span>{error}</div>}
      </section>
    </main>
  );
}
