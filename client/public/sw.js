// Inks by Trackify - Service Worker for PWA & APK Wrapper
const CACHE_NAME = 'inks-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Let network directly handle non-GET, non-http, API, or third-party tracking/auth requests
  if (
    event.request.method !== 'GET' ||
    !url.startsWith('http') ||
    url.includes('/api/') ||
    url.includes('clarity.ms') ||
    url.includes('google-analytics') ||
    url.includes('googletagmanager') ||
    url.includes('accounts.google.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response('', { status: 408, statusText: 'Network offline' });
    })
  );
});
