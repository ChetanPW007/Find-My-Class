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
  // Handle push notifications from a server if needed in future
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'FindMyClass Alert';
  const options = {
    body: data.body || 'New update available.',
    icon: '/icons.svg',
    badge: '/favicon.svg'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
