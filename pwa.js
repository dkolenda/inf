// Rejestracja service workera (sw.js): praca offline i wykrywanie nowej wersji aplikacji.
(() => {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
  let lastCheck = 0;

  function send(type) {
    navigator.serviceWorker.controller?.postMessage({ type });
  }

  function checkForUpdate(registration) {
    if (!navigator.onLine) return;
    lastCheck = Date.now();
    registration.update().catch(() => {});
    send('check-update');
  }

  function showUpdateBanner() {
    if (document.querySelector('.pwa-update')) return;
    const banner = document.createElement('div');
    banner.className = 'pwa-update';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
      <span>Jest nowa wersja aplikacji.</span>
      <button class="primary-button" type="button">Odśwież</button>`;
    banner.querySelector('button').addEventListener('click', () => location.reload());
    document.body.append(banner);
  }

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'update-available') showUpdateBanner();
  });

  window.addEventListener('load', async () => {
    let registration;
    try {
      registration = await navigator.serviceWorker.register('sw.js');
    } catch {
      return;
    }
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
    if (!navigator.connection?.saveData) send('precache');
    checkForUpdate(registration);

    window.addEventListener('online', () => checkForUpdate(registration));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > 60 * 1000) checkForUpdate(registration);
    });
    setInterval(() => checkForUpdate(registration), UPDATE_CHECK_INTERVAL_MS);
  });
})();
