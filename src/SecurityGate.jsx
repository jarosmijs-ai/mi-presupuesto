import React, { useEffect, useRef, useState } from 'react';

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
}

export function hasPin() {
  return Boolean(localStorage.getItem(PIN_KEY));
}

export default function SecurityGate({ children }) {
  const [locked, setLocked] = useState(() => hasPin() && sessionStorage.getItem(UNLOCK_KEY) !== 'true');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const inputRef = useRef(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden' && hasPin()) {
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
    if (locked) window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [locked]);

  useEffect(() => {
    if (!locked || pin.length < 4 || unlocked) return undefined;
    const attempt = ++attemptRef.current;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      const expected = localStorage.getItem(PIN_KEY);
      const actual = await hashPin(pin);
      if (attempt !== attemptRef.current) return;
      if (actual === expected) {
        setError('');
        setUnlocked(true);
        sessionStorage.setItem(UNLOCK_KEY, 'true');
        window.setTimeout(() => setLocked(false), 620);
        return;
      }
      setChecking(false);
      if (pin.length === 8 || pin.length >= 4) {
        setError('El PIN no coincide. Inténtalo nuevamente.');
        window.setTimeout(() => {
          setPin('');
          inputRef.current?.focus();
        }, 260);
      }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [pin, locked, unlocked]);

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
          <div className="security-lock-icon" aria-hidden="true">{unlocked ? '✓' : '⌁'}</div>
          <h1 id="security-title">{unlocked ? 'Acceso confirmado' : 'Bienvenido de nuevo'}</h1>
          <p>{unlocked ? 'Protección verificada. Abriendo tu presupuesto…' : 'Ingresa tu PIN para consultar tu información financiera.'}</p>
        </div>
        <div className="security-auto-form">
          <label htmlFor="security-pin">PIN de seguridad</label>
          <div className={`security-pin-field ${error ? 'has-error' : ''} ${unlocked ? 'is-success' : ''}`} onClick={() => inputRef.current?.focus()}>
            <div className="security-pin-dots" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => <span key={index} className={pin.length > index ? 'filled' : ''} />)}
              {pin.length > 4 && <b>+{pin.length - 4}</b>}
            </div>
            <input ref={inputRef} id="security-pin" autoComplete="current-password" inputMode="numeric" type="password" minLength="4" maxLength="8" value={pin} disabled={unlocked} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }} aria-describedby={error ? 'security-error' : undefined} />
          </div>
          <div className="security-helper-row"><small>{checking ? 'Verificando automáticamente…' : 'Se desbloquea al reconocer el PIN'}</small><small>{pin.length}/8</small></div>
          {error && <div id="security-error" className="security-error" role="alert"><span>!</span>{error}</div>}
        </div>
        <p className="security-privacy-note">Tus datos permanecen guardados en este dispositivo.</p>
      </section>
    </main>
  );
}
