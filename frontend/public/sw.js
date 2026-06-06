// Service Worker for FindMyClass Notifications
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Focus or open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'FindMyClass Alert';
  const options = {
    body: data.body || 'New update available.',
    icon: '/icons.svg',
    badge: '/favicon.svg'
  };

  // Broadcast to all active clients (tabs)
  if (self.clients) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      clientList.forEach(function(client) {
        client.postMessage({
          type: 'PUSH_NOTIFICATION',
          title: title,
          body: options.body
        });
      });
    });
  }

  event.waitUntil(self.registration.showNotification(title, options));
});
