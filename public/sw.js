self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = typeof payload.title === 'string' && payload.title ? payload.title : '共享日历';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const tag = typeof payload.tag === 'string' ? payload.tag : 'shared-calendar-test';

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    data: { url: '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const applicationWindow = windowClients.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });

    if (applicationWindow) {
      await applicationWindow.focus();
      return;
    }

    await self.clients.openWindow('/');
  })());
});
