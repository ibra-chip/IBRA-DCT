// A tiny S3 client (AWS Signature V4) for free storage providers such as Backblaze B2, IDrive e2 or
// Cloudflare R2. Only what the app needs: put, get and delete one object. No third-party package.
import crypto from 'node:crypto';

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const encodeSegment = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
export const encodePath = (path) => path.split('/').map(encodeSegment).join('/');

const amzDate = (now) => now.toISOString().replace(/[:-]|\.\d{3}/g, '');

// Signs a request. `headers` must already contain `host` (and any other header to be signed).
export function signRequest({ method, path, query = '', headers, payloadHash, keyId, secret, region, service = 's3', now = new Date() }) {
	const stamp = amzDate(now);
	const day = stamp.slice(0, 8);
	const signed = { ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value).trim()])), 'x-amz-date': stamp };
	const names = Object.keys(signed).sort();
	const canonical = [method, path, query, ...names.map((name) => `${name}:${signed[name]}`), '', names.join(';'), payloadHash].join('\n');
	const scope = `${day}/${region}/${service}/aws4_request`;
	const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n');
	const key = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), service), 'aws4_request');
	const signature = crypto.createHmac('sha256', key).update(toSign).digest('hex');
	return { signature, stamp, headers: { ...signed, authorization: `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` } };
}

const baseOf = (endpoint) => (/^https?:\/\//i.test(endpoint) ? endpoint.replace(/\/$/, '') : `https://${endpoint}`);

function signedRequest(config, method, key, payload, contentType) {
	const base = baseOf(config.endpoint);
	const path = `/${encodeSegment(config.bucket)}/${encodePath(key)}`;
	const payloadHash = sha256(payload);
	const host = new URL(base).host;
	const { headers } = signRequest({
		method, path, headers: { host, 'x-amz-content-sha256': payloadHash, ...(contentType ? { 'content-type': contentType } : {}) },
		payloadHash, keyId: config.keyId, secret: config.secret, region: config.region || 'us-east-1',
	});
	delete headers.host;
	return { url: base + path, headers };
}

async function send(config, method, key, body, contentType) {
	const payload = body || Buffer.alloc(0);
	const { url, headers } = signedRequest(config, method, key, payload, method === 'PUT' ? contentType : undefined);
	const response = await fetch(url, { method, headers, body: method === 'PUT' ? payload : undefined, signal: AbortSignal.timeout(30000) });
	if (!response.ok && !(method === 'DELETE' && response.status === 404)) {
		const details = await response.text().catch(() => '');
		throw new Error(`${config.name || 'S3'} ${method} failed (${response.status}): ${details.slice(0, 200)}`);
	}
}

export const putObject = (config, key, body, contentType) => send(config, 'PUT', key, body, contentType);
export const deleteObject = (config, key) => send(config, 'DELETE', key);

// Reads a (private) object back with our own signed request — this is how the app serves a file to a
// viewer without ever making the provider's bucket public. Returns null when the object is missing.
export async function getObject(config, key) {
	const { url, headers } = signedRequest(config, 'GET', key, Buffer.alloc(0));
	const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(30000) });
	if (!response.ok) return null;
	return { contentType: response.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await response.arrayBuffer()) };
}

// Cheap existence check (no body transferred) — used to find which provider actually has an object
// before handing the browser a presigned URL for it.
export async function headObject(config, key) {
	const { url, headers } = signedRequest(config, 'HEAD', key, Buffer.alloc(0));
	const response = await fetch(url, { method: 'HEAD', headers, signal: AbortSignal.timeout(10000) });
	return response.ok;
}

// A presigned GET URL: signed in the query string (not a header), exactly like signRequest but with
// AWS's "UNSIGNED-PAYLOAD" convention for presigned requests, so the browser can fetch it directly —
// no server round-trip for the file bytes, and the bucket itself never has to be public.
export function presignGetUrl(config, key, expiresSeconds = 300, now = new Date(), extraQuery = {}) {
	const base = baseOf(config.endpoint);
	const path = `/${encodeSegment(config.bucket)}/${encodePath(key)}`;
	const host = new URL(base).host;
	const region = config.region || 'us-east-1';
	const stamp = amzDate(now);
	const day = stamp.slice(0, 8);
	const scope = `${day}/${region}/s3/aws4_request`;
	const query = {
		'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
		'X-Amz-Credential': `${config.keyId}/${scope}`,
		'X-Amz-Date': stamp,
		'X-Amz-Expires': String(expiresSeconds),
		'X-Amz-SignedHeaders': 'host',
		...extraQuery,
	};
	const canonicalQuery = Object.keys(query).sort().map((name) => `${encodeSegment(name)}=${encodeSegment(query[name])}`).join('&');
	const canonical = ['GET', path, canonicalQuery, `host:${host}`, '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
	const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n');
	const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secret}`, day), region), 's3'), 'aws4_request');
	const signature = crypto.createHmac('sha256', signingKey).update(toSign).digest('hex');
	return `${base}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
