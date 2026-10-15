import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import { headObject, presignGetUrl } from '../lib/s3.js';

// Independently re-derives the expected AWS SigV4 presigned-URL signature (not by calling s3.js's own
// helpers) so this actually catches a mistake in the canonical-request format, not just a typo shared
// between the implementation and the test.
function expectedSignature({ keyId, secret, region, bucket, key, expiresSeconds, now }) {
	const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
	const hmac = (k, data) => crypto.createHmac('sha256', k).update(data).digest();
	const stamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
	const day = stamp.slice(0, 8);
	const scope = `${day}/${region}/s3/aws4_request`;
	const host = 'example-endpoint.test';
	const query = [
		`X-Amz-Algorithm=AWS4-HMAC-SHA256`,
		`X-Amz-Credential=${encodeURIComponent(`${keyId}/${scope}`)}`,
		`X-Amz-Date=${stamp}`,
		`X-Amz-Expires=${expiresSeconds}`,
		`X-Amz-SignedHeaders=host`,
	].join('&');
	const canonical = ['GET', `/${bucket}/${key}`, query, `host:${host}`, '', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
	const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n');
	const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), 's3'), 'aws4_request');
	return { signature: crypto.createHmac('sha256', signingKey).update(toSign).digest('hex'), query };
}

test('presignGetUrl matches an independently-derived AWS SigV4 query signature', () => {
	const now = new Date('2026-01-15T10:00:00Z');
	const config = { endpoint: 'https://example-endpoint.test', region: 'eu-central-1', keyId: 'AKIDEXAMPLE', secret: 'secretkey123', bucket: 'ibra-ba-uploads' };
	const url = presignGetUrl(config, 'devis/2026-01/devis-12.pdf', 300, now);
	const { signature, query } = expectedSignature({ ...config, key: 'devis/2026-01/devis-12.pdf', expiresSeconds: 300, now });

	assert.equal(url, `https://example-endpoint.test/ibra-ba-uploads/devis/2026-01/devis-12.pdf?${query}&X-Amz-Signature=${signature}`);
	assert.ok(url.includes('X-Amz-Expires=300'));
	assert.ok(!url.includes(config.secret), 'the secret itself must never appear in the URL');
});

test('presignGetUrl stays stable across repeated calls at the same instant (same signature)', () => {
	const now = new Date('2026-01-15T10:00:00Z');
	const config = { endpoint: 'https://example-endpoint.test', region: 'auto', keyId: 'KEY', secret: 'secret', bucket: 'b' };
	const a = presignGetUrl(config, 'x.jpg', 300, now);
	const b = presignGetUrl(config, 'x.jpg', 300, now);
	assert.equal(a, b);
});

// A fake private bucket that only answers signed GET/HEAD requests — same shape as free-pool.test.js's
// fakeProvider, extended to accept query-string (presigned) signatures and HEAD requests.
function fakeProvider() {
	const files = new Map();
	const server = http.createServer((request, response) => {
		const [pathname, query = ''] = request.url.split('?');
		const key = decodeURIComponent(pathname.replace(/^\/bucket\//, ''));
		const presigned = /X-Amz-Signature=[0-9a-f]{64}/.test(query) && query.includes('Credential=testkey');
		const headerSigned = (request.headers.authorization || '').startsWith('AWS4-HMAC-SHA256 Credential=testkey/');
		if (!presigned && !headerSigned) { response.statusCode = 403; return response.end(); }
		const file = files.get(key);
		if (!file) { response.statusCode = 404; return response.end(); }
		if (request.method === 'HEAD') { response.statusCode = 200; return response.end(); }
		response.setHeader('content-type', file.type);
		response.end(file.body);
	});
	return { server, files, listen: () => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port))) };
}

test('headObject finds an existing key and reports a missing one as absent, without transferring bytes', async () => {
	const provider = fakeProvider();
	const port = await provider.listen();
	try {
		const config = { endpoint: `http://127.0.0.1:${port}`, region: 'eu', keyId: 'testkey', secret: 'testsecret', bucket: 'bucket' };
		provider.files.set('present.pdf', { body: Buffer.from('hi'), type: 'application/pdf' });
		assert.equal(await headObject(config, 'present.pdf'), true);
		assert.equal(await headObject(config, 'missing.pdf'), false);
	} finally { provider.server.close(); }
});

test('a presigned URL from presignGetUrl is actually accepted by the (fake) provider', async () => {
	const provider = fakeProvider();
	const port = await provider.listen();
	try {
		const config = { endpoint: `http://127.0.0.1:${port}`, region: 'eu', keyId: 'testkey', secret: 'testsecret', bucket: 'bucket' };
		provider.files.set('photo.jpg', { body: Buffer.from('a real jpg, pretend'), type: 'image/jpeg' });
		const url = presignGetUrl(config, 'photo.jpg', 300);
		const response = await fetch(url);
		assert.equal(response.status, 200);
		assert.equal(await response.text(), 'a real jpg, pretend');
	} finally { provider.server.close(); }
});
