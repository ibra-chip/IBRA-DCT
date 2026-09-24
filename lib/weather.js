// Free, keyless weather lookup (Open-Meteo) for a chantier's free-text
// location string. Geocodes once per project (server.js caches the
// resulting lat/lon on the project) rather than on every request.
const WEATHER_CODE_LABELS = {
	0: { icon: '☀️', label: 'Ciel dégagé' },
	1: { icon: '🌤️', label: 'Peu nuageux' },
	2: { icon: '⛅', label: 'Partiellement nuageux' },
	3: { icon: '☁️', label: 'Couvert' },
	45: { icon: '🌫️', label: 'Brouillard' },
	48: { icon: '🌫️', label: 'Brouillard givrant' },
	51: { icon: '🌦️', label: 'Bruine légère' },
	53: { icon: '🌦️', label: 'Bruine' },
	55: { icon: '🌦️', label: 'Bruine forte' },
	61: { icon: '🌧️', label: 'Pluie légère' },
	63: { icon: '🌧️', label: 'Pluie' },
	65: { icon: '🌧️', label: 'Pluie forte' },
	71: { icon: '🌨️', label: 'Neige légère' },
	73: { icon: '🌨️', label: 'Neige' },
	75: { icon: '🌨️', label: 'Neige forte' },
	80: { icon: '🌦️', label: 'Averses légères' },
	81: { icon: '🌦️', label: 'Averses' },
	82: { icon: '⛈️', label: 'Averses violentes' },
	95: { icon: '⛈️', label: 'Orage' },
	96: { icon: '⛈️', label: 'Orage avec grêle' },
	99: { icon: '⛈️', label: 'Orage avec grêle forte' },
};
const FALLBACK_LABEL = { icon: '🌡️', label: 'Prévision indisponible' };

export function weatherCodeLabel(code) {
	return WEATHER_CODE_LABELS[code] || FALLBACK_LABEL;
}

export async function geocodeLocation(query) {
	const text = String(query || '').trim();
	if (!text) return null;
	try {
		const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=1&language=fr&format=json`;
		const response = await fetch(url);
		if (!response.ok) return null;
		const data = await response.json();
		const first = data?.results?.[0];
		if (!first) return null;
		return { lat: first.latitude, lon: first.longitude, label: [first.name, first.admin1, first.country].filter(Boolean).join(', ') };
	} catch (error) {
		console.warn('Weather geocoding failed:', error.message);
		return null;
	}
}

export async function fetchForecast(lat, lon) {
	const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`;
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Open-Meteo forecast failed (${response.status})`);
	const data = await response.json();
	const daily = data?.daily;
	if (!daily?.time) return { days: [] };
	const days = daily.time.map((date, index) => ({
		date,
		code: daily.weather_code?.[index] ?? null,
		tempMax: daily.temperature_2m_max?.[index] ?? null,
		tempMin: daily.temperature_2m_min?.[index] ?? null,
		precipProbability: daily.precipitation_probability_max?.[index] ?? null,
	}));
	return { days };
}
