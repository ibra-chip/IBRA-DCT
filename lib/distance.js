// Real road-routing distance (not straight-line) between two coordinates, via OSRM's free public
// routing server - same "free, keyless" posture already used for weather (Open-Meteo). This is always
// an ESTIMATE (OSRM's own suggested route, not necessarily the road actually taken), so every caller
// must present it as a suggestion to compare against the vehicle's real odometer reading, never as the
// recorded distance itself - the recorded distanceKm on a trip always comes from startKm/endKm only.
export async function estimateRoadDistanceKm(from, to) {
	const routes = await estimateRoadRoutes(from, to);
	return routes?.[0]?.distanceKm ?? null;
}
// Same OSRM call, but with alternatives=true so the caller can offer a short pick-list ("route A: 12.4
// km via the bypass, route B: 14.1 km via the centre") instead of a single number - still always an
// estimate to compare against the real odometer, never the recorded distance itself. OSRM returns at
// most a handful of genuinely different routes (often just one on a simple A-to-B); sorted shortest
// first and deduplicated to the nearest 100 m since OSRM sometimes repeats near-identical alternatives.
export async function estimateRoadRoutes(from, to) {
	if (!from || !to || from.lat == null || from.lon == null || to.lat == null || to.lon == null) return null;
	const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&alternatives=true`;
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		const data = await response.json();
		const routes = (data?.routes || [])
			.map((route) => ({ distanceKm: Math.round((route.distance / 1000) * 10) / 10, durationMin: Math.round(route.duration / 60) }))
			.filter((route) => Number.isFinite(route.distanceKm));
		if (!routes.length) return null;
		const seen = new Set();
		const deduped = routes.filter((route) => { const key = Math.round(route.distanceKm * 10); if (seen.has(key)) return false; seen.add(key); return true; });
		return deduped.sort((first, second) => first.distanceKm - second.distanceKm).slice(0, 3);
	} catch {
		return null;
	}
}
