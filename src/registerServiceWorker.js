export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      function announceUpdate() {
        if (!registration.waiting) return;
        window.dispatchEvent(
          new CustomEvent('budget-app-update', {
            detail: registration
          })
        );
      }

      if (registration.waiting) announceUpdate();

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            announceUpdate();
          }
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      registration.update();
    } catch (error) {
      console.error('No se pudo registrar el service worker:', error);
    }
  });
}
