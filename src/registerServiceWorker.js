export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  async function initializeServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none'
      });

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      await registration.update();
    } catch (error) {
      console.error('No se pudo registrar el service worker:', error);
    }
  }

  if (document.readyState === 'complete') {
    void initializeServiceWorker();
  } else {
    window.addEventListener('load', initializeServiceWorker, { once: true });
  }
}
