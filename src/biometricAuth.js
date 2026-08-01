const CREDENTIAL_KEY = 'app-biometric-credential-id';

function toBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export function hasBiometric() {
  return Boolean(localStorage.getItem(CREDENTIAL_KEY));
}

export function removeBiometric() {
  localStorage.removeItem(CREDENTIAL_KEY);
}

export async function isBiometricAvailable() {
  if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerBiometric() {
  if (!(await isBiometricAvailable())) throw new Error('La biometría no está disponible en este dispositivo o navegador.');

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Mi Presupuesto' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'usuario-local',
        displayName: 'Usuario de Mi Presupuesto'
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    }
  });

  if (!credential) throw new Error('No se pudo registrar la biometría.');
  localStorage.setItem(CREDENTIAL_KEY, toBase64(credential.rawId));
  return true;
}

export async function authenticateBiometric() {
  const stored = localStorage.getItem(CREDENTIAL_KEY);
  if (!stored) return false;

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{
        type: 'public-key',
        id: fromBase64(stored),
        transports: ['internal']
      }],
      userVerification: 'required',
      timeout: 60000
    }
  });

  return Boolean(assertion && toBase64(assertion.rawId) === stored);
}
