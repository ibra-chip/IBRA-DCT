// Optional free storage (Backblaze B2 and friends) that sits *in front of* Supabase Storage, without
// changing anything about how the rest of the app calls uploadFile/downloadFile/deleteFile.
//
// This app keeps its data as one JSON file, not a SQL database, so — unlike the sibling IBRA App —
// there is nowhere safe to keep a running "how many bytes used" counter without touching that file.
// Instead this module is deliberately simple and stateless: every new upload is tried on the free
// provider first; if that fails for any reason (provider full, provider down, bad settings), the
// call falls straight back to Supabase and nothing else notices. A file already living in Supabase
// from before this was turned on is never touched — reads try the free provider first and fall back
// to Supabase automatically when the object isn't there.
//
// Nothing here is public at the provider: every read is our own signed request, never the
// provider's own public-bucket feature (some providers now charge for that).
import crypto from 'node:crypto';
import { putObject, deleteObject, getObject, headObject, presignGetUrl } from './s3.js';

// STORAGE_POOL=b2 and, e.g., B2_ENDPOINT, B2_REGION, B2_KEY_ID, B2_SECRET, B2_BUCKET.
function readProviders(env = process.env) {
	const names = String(env.STORAGE_POOL || '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
	const providers = [];
	for (const name of names) {
		if (!/^[a-z0-9]+$/.test(name)) continue;
		const get = (field) => env[`${name.toUpperCase()}_${field}`] || '';
		const provider = { name, endpoint: get('ENDPOINT'), region: get('REGION'), keyId: get('KEY_ID'), secret: get('SECRET'), bucket: get('BUCKET') };
		if (provider.endpoint && provider.keyId && provider.secret && provider.bucket) providers.push(provider);
		else console.warn(`Storage provider "${name}" is missing settings and is ignored.`);
	}
	return providers;
}

let providers = [];
const healthy = new Set();

export const poolConfigured = () => providers.length > 0;

async function selfTest(provider) {
	const key = `selftest/${crypto.randomUUID()}.txt`;
	const text = `ibra-ba-${Date.now()}`;
	await putObject(provider, key, Buffer.from(text), 'text/plain');
	try {
		const back = await getObject(provider, key);
		if (!back || back.body.toString('utf8') !== text) throw new Error(`${provider.name}: the uploaded test file could not be read back`);
	} finally {
		await deleteObject(provider, key).catch(() => {});
	}
}

export async function initFreePool(env = process.env) {
	providers = readProviders(env);
	healthy.clear();
	for (const provider of providers) {
		try {
			await selfTest(provider);
			healthy.add(provider.name);
			console.log(`Free storage provider "${provider.name}" is ready.`);
		} catch (error) {
			console.error(`Free storage provider "${provider.name}" failed its self-test and will not be used:`, error.message);
		}
	}
}

// Tries every healthy provider in order for a write; returns true if one accepted it.
export async function poolPut(fullKey, buffer, contentType) {
	for (const provider of providers) {
		if (!healthy.has(provider.name)) continue;
		try {
			await putObject(provider, fullKey, buffer, contentType);
			return true;
		} catch (error) {
			console.error(`Free storage upload to "${provider.name}" failed, trying the next option:`, error.message);
		}
	}
	return false;
}

// Tries every provider (even one not marked healthy right now — it may have recovered) for a read;
// returns { contentType, body } or null when nobody has it, so the caller can fall back to Supabase.
export async function poolGet(fullKey) {
	for (const provider of providers) {
		try {
			const object = await getObject(provider, fullKey);
			if (object) return object;
		} catch (error) {
			console.error(`Free storage read from "${provider.name}" failed:`, error.message);
		}
	}
	return null;
}

// Best-effort delete from every provider (a file's exact location isn't tracked, so this is safe: a
// delete for a key a provider never had is simply a no-op there).
export async function poolDelete(fullKey) {
	await Promise.all(providers.map((provider) => deleteObject(provider, fullKey).catch(() => {})));
}

// Finds which provider actually has this object (a cheap HEAD, no bytes transferred) and hands back a
// short-lived signed URL for it, so the browser can download directly from the provider instead of the
// object's bytes round-tripping through this server. Returns null when no pool provider has it, so the
// caller can fall back to Supabase (or to proxying the bytes itself).
export async function poolSignedUrl(fullKey, expiresSeconds, filename) {
	const extraQuery = filename ? { 'response-content-disposition': `attachment; filename="${filename.replace(/["\r\n]/g, '_')}"` } : {};
	for (const provider of providers) {
		try {
			if (await headObject(provider, fullKey)) return presignGetUrl(provider, fullKey, expiresSeconds, new Date(), extraQuery);
		} catch (error) {
			console.error(`Free storage existence check on "${provider.name}" failed:`, error.message);
		}
	}
	return null;
}
