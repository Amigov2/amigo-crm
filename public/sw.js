// AMIGO Service Worker — Web Push notifs pour messages WhatsApp LABO 3D
// Écoute les push events depuis /api/wa-labo3d-webhook via web-push server

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = { title: 'AMIGO', body: 'Nouveau message', url: '/', badgeCount: 1 };
  try { data = { ...data, ...event.data.json() }; } catch {}

  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: data.tag || 'amigo-msg',
      renotify: true,
      requireInteraction: false,
      data: { url: data.url || '/' }
    }),
    (typeof self.navigator?.setAppBadge === 'function')
      ? self.navigator.setAppBadge(data.badgeCount).catch(() => {})
      : Promise.resolve()
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
