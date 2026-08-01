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
  const [locked, setLocked] = useState(
    () => hasPin() && sessionStorage.getItem(UNLOCK_KEY) !== 'true'
  );
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden' && hasPin()) {
        sessionStorage.removeItem(UNLOCK_KEY);
        setLocked(true);
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

  async function unlock(event) {
    event.preventDefault();
    if (pin.length < 4 || checking) return;

    setChecking(true);
    const expected = localStorage.getItem(PIN_KEY);
    const actual = await hashPin(pin);

    if (actual !== expected) {
      setError('El PIN no coincide. Inténtalo nuevamente.');
      setPin('');
      setChecking(false);
      inputRef.current?.focus();
      return;
    }

    sessionStorage.setItem(UNLOCK_KEY, 'true');
    setLocked(false);
    setChecking(false);
  }

  if (!locked) return children;

  return (
    <main className="security-screen">
      <div className="security-ambient security-ambient-one" />
      <div className="security-ambient security-ambient-two" />

      <section className="security-card" aria-labelledby="security-title">
        <div className="security-brand-row">
          <div className="security-logo" aria-hidden="true">Q</div>
          <div>
            <span>MI PRESUPUESTO</span>
            <small>Acceso protegido</small>
          </div>
        </div>

        <div className="security-copy">
          <div className="security-lock-icon" aria-hidden="true">⌁</div>
          <h1 id="security-title">Bienvenido de nuevo</h1>
          <p>Ingresa tu PIN para consultar tu información financiera.</p>
        </div>

        <form onSubmit={unlock}>
          <label htmlFor="security-pin">PIN de seguridad</label>
          <div
            className={`security-pin-field ${error ? 'has-error' : ''}`}
            onClick={() => inputRef.current?.focus()}
          >
            <div className="security-pin-dots" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => (
                <span key={index} className={pin.length > index ? 'filled' : ''} />
              ))}
              {pin.length > 4 && <b>+{pin.length - 4}</b>}
            </div>
            <input
              ref={inputRef}
              id="security-pin"
              autoComplete="current-password"
              inputMode="numeric"
              type="password"
              minLength="4"
              maxLength="8"
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, '').slice(0, 8));
                setError('');
              }}
              aria-describedby={error ? 'security-error' : undefined}
            />
          </div>

          <div className="security-helper-row">
            <small>De 4 a 8 dígitos</small>
            <small>{pin.length}/8</small>
          </div>

          {error && (
            <div id="security-error" className="security-error" role="alert">
              <span>!</span>{error}
            </div>
          )}

          <button type="submit" disabled={pin.length < 4 || checking}>
            {checking ? 'Verificando…' : 'Desbloquear'}
          </button>
        </form>

        <p className="security-privacy-note">
          Tus datos permanecen guardados en este dispositivo.
        </p>
      </section>
    </main>
  );
}
