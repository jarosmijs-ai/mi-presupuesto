import React, {
  useEffect,
  useState
} from 'react';

export default function InstallAppButton() {
  const [
    installPrompt,
    setInstallPrompt
  ] = useState(null);

  const [
    isInstalled,
    setIsInstalled
  ] = useState(() =>
    window.matchMedia(
      '(display-mode: standalone)'
    ).matches
  );

  useEffect(() => {
    function handleBeforeInstall(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setIsInstalled(true);
    }

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstall
    );

    window.addEventListener(
      'appinstalled',
      handleInstalled
    );

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstall
      );

      window.removeEventListener(
        'appinstalled',
        handleInstalled
      );
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();

    await installPrompt.userChoice;

    setInstallPrompt(null);
  }

  if (isInstalled) {
    return (
      <section className="install-app-card installed">
        <div className="install-app-icon">
          ✓
        </div>

        <div>
          <span className="eyebrow">
            APP INSTALADA
          </span>

          <h2>Mi Presupuesto</h2>

          <p>
            Ya puedes abrirla desde la pantalla
            de inicio de tu teléfono.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="install-app-card">
      <div className="install-app-copy">
        <span className="eyebrow">
          APLICACIÓN MÓVIL
        </span>

        <h2>Instalar Mi Presupuesto</h2>

        <p>
          Agrégala a la pantalla de inicio y
          úsala en modo de aplicación.
        </p>
      </div>

      <button
        type="button"
        className="install-app-button"
        onClick={installApp}
        disabled={!installPrompt}
      >
        <span aria-hidden="true">↓</span>

        {installPrompt
          ? 'Instalar aplicación'
          : 'Instalación disponible al publicar'}
      </button>
    </section>
  );
}