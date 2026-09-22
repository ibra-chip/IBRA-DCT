self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		const keys = await caches.keys();
		await Promise.all(keys.map((key) => caches.delete(key)));
		await self.clients.claim();
	})());
});

self.addEventListener('push', (event) => {
	let payload = { title: 'IBRA-BA', body: 'Nouvelle notification' };
	try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch { /* keep default */ }
	event.waitUntil(
		self.registration.showNotification(payload.title || 'IBRA-BA', {
			body: payload.body || '',
			tag: payload.tag || 'ibra-notification',
			data: { url: payload.url || '/' },
			renotify: true,
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const targetUrl = event.notification.data?.url || '/';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if ('focus' in client) return client.focus();
			}
			if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
		})
	);
});
