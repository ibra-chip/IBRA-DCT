// Real road-routing distance (not straight-line) between two coordinates, via OSRM's free public
// routing server - same "free, keyless" posture already used for weather (Open-Meteo). This is always
// an ESTIMATE (OSRM's own suggested route, not necessarily the road actually taken), so every caller
// must present it as a suggestion to compare against the vehicle's real odometer reading, never as the
// recorded distance itself - the recorded distanceKm on a trip always comes from startKm/endKm only.
export async function estimateRoadDistanceKm(from, to) {
	if (!from || !to || from.lat == null || from.lon == null || to.lat == null || to.lon == null) return null;
	const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		const data = await response.json();
		const meters = data?.routes?.[0]?.distance;
		return Number.isFinite(meters) ? Math.round((meters / 1000) * 10) / 10 : null;
	} catch {
		return null;
	}
}
