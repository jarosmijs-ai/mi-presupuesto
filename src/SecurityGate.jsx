import React, { useEffect, useState } from 'react';

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

  async function unlock(event) {
    event.preventDefault();
    const expected = localStorage.getItem(PIN_KEY);
    const actual = await hashPin(pin);

    if (actual !== expected) {
      setError('PIN incorrecto.');
      setPin('');
      return;
    }

    sessionStorage.setItem(UNLOCK_KEY, 'true');
    setLocked(false);
  }

  if (!locked) return children;

  return (
    <main className="security-screen">
      <section className="security-card">
        <div className="security-logo">Q</div>
        <span>MI PRESUPUESTO</span>
        <h1>Tu información está protegida</h1>
        <p>Ingresa tu PIN para continuar.</p>
        <form onSubmit={unlock}>
          <input
            autoFocus
            inputMode="numeric"
            type="password"
            minLength="4"
            maxLength="8"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, ''));
              setError('');
            }}
            placeholder="••••"
            aria-label="PIN"
          />
          {error && <small className="security-error">{error}</small>}
          <button type="submit" disabled={pin.length < 4}>Desbloquear</button>
        </form>
      </section>
    </main>
  );
}
