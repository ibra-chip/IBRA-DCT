export function createDataCache({ ttlMs = 2000, staleMs = 300000, now = Date.now } = {}) {
	let json = null;
	let loadedAt = 0;
	let inflight = null;
	let version = 0;

	const fresh = () => json !== null && now() - loadedAt < ttlMs;

	return {
		async read(load) {
			if (ttlMs <= 0) return load();
			if (fresh()) return JSON.parse(json);
			if (!inflight) {
				const startVersion = version;
				inflight = (async () => {
					const data = await load();
					const serialized = JSON.stringify(data);
					if (version === startVersion) {
						json = serialized;
						loadedAt = now();
					}
					return serialized;
				})().finally(() => { inflight = null; });
			}
			try {
				return JSON.parse(await inflight);
			} catch (error) {
				if (json !== null && now() - loadedAt < staleMs) return JSON.parse(json);
				throw error;
			}
		},
		set(data) {
			if (ttlMs <= 0) return;
			version += 1;
			json = JSON.stringify(data);
			loadedAt = now();
		},
		invalidate() {
			version += 1;
			json = null;
			loadedAt = 0;
		},
	};
}
