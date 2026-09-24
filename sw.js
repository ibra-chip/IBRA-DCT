const CACHE_NAME = 'ibra-ba-v1';

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		const keys = await caches.keys();
		await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
		await self.clients.claim();
	})());
});

// Network-first, cache-fallback: always serves the freshest version when
// online (no manual cache-busting needed), and falls back to the last
// successfully loaded response when the network fails, so the app shell
// and last-known data remain visible offline instead of showing a blank
// page. Only GET requests are cached; writes always hit the network so
// they correctly fail (rather than silently appear to succeed) offline.
self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
	event.respondWith((async () => {
		const cache = await caches.open(CACHE_NAME);
		try {
			const response = await fetch(request);
			if (response.ok) cache.put(request, response.clone());
			return response;
		} catch (error) {
			const cached = await cache.match(request);
			if (cached) return cached;
			throw error;
		}
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
