/* Kibou service worker — background Web Push notifications.
   Shows seeker alerts even when the site tab / browser is closed. */

self.addEventListener('push', (event) => {
  let data = { title: 'Kibou', body: 'Someone needs support. Tap to help.', tag: 'kibou', url: '/' };
  try {
    if (event.data) {
      const incoming = event.data.json();
      data = { ...data, ...incoming };
    }
  } catch (e) {}

  const options = {
    body: data.body,
    icon: '/kibou-logo.png',
    badge: '/kibou-logo.png',
    tag: data.tag || 'kibou',
    renotify: true,
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Kibou', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        try {
          await client.focus();
          return;
        } catch (e) {}
      }
      try {
        await self.clients.openWindow(url);
      } catch (e) {}
    })()
  );
});
