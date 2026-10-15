import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import { initFreePool, poolConfigured, poolDelete, poolGet, poolPut, poolSignedUrl } from '../lib/free-pool.js';
import { signRequest } from '../lib/s3.js';

test('request signing matches the published AWS Signature V4 example', () => {
	const { signature } = signRequest({
		method: 'GET', path: '/', query: 'Action=ListUsers&Version=2010-05-08',
		headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8', host: 'iam.amazonaws.com' },
		payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		keyId: 'AKIDEXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', region: 'us-east-1', service: 'iam', now: new Date('2015-08-30T12:36:00Z'),
	});
	assert.equal(signature, '5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7');
});

// A fake private S3 bucket: only answers to correctly signed requests.
function fakeProvider({ failPut = false } = {}) {
	const files = new Map();
	const bad = [];
	const server = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const body = Buffer.concat(chunks);
			const [pathname, query = ''] = request.url.split('?');
			const key = decodeURIComponent(pathname.replace(/^\/bucket\//, ''));
			const auth = request.headers.authorization || '';
			const headerSigned = auth.startsWith('AWS4-HMAC-SHA256 Credential=KEY/') && request.headers['x-amz-content-sha256'] === crypto.createHash('sha256').update(body).digest('hex');
			const presigned = /X-Amz-Signature=[0-9a-f]{64}/.test(query) && query.includes('Credential=KEY');
			if (!headerSigned && !presigned) { bad.push(`${request.method} ${key}`); response.statusCode = 403; return response.end(); }
			if (failPut && request.method === 'PUT') { response.statusCode = 500; return response.end('boom'); }
			if (request.method === 'PUT') { files.set(key, { body, type: request.headers['content-type'] }); return response.end(); }
			if (request.method === 'DELETE') { files.delete(key); return response.end(); }
			const file = files.get(key);
			if (!file) { response.statusCode = 404; return response.end(); }
			if (request.method === 'HEAD') { response.statusCode = 200; return response.end(); }
			response.setHeader('content-type', file.type);
			response.end(file.body);
		});
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, files, bad, port: server.address().port })));
}

const envFor = (names, ports) => {
	const env = { STORAGE_POOL: names.join(',') };
	names.forEach((name, i) => {
		const p = name.toUpperCase();
		Object.assign(env, { [`${p}_ENDPOINT`]: `http://127.0.0.1:${ports[i]}`, [`${p}_REGION`]: 'eu', [`${p}_KEY_ID`]: 'KEY', [`${p}_SECRET`]: 'secret', [`${p}_BUCKET`]: 'bucket' });
	});
	return env;
};

test('with no settings the pool is simply off', async () => {
	assert.equal(poolConfigured(), false);
	await initFreePool({});
	assert.equal(await poolPut('ibra-uploads/x.pdf', Buffer.from('x'), 'application/pdf'), false);
	assert.equal(await poolGet('ibra-uploads/x.pdf'), null);
});

test('a healthy provider stores and serves a document without ever making the bucket public', async () => {
	const a = await fakeProvider();
	try {
		await initFreePool(envFor(['b2'], [a.port]));
		assert.equal(poolConfigured(), true);
		assert.equal(a.files.size, 0, 'the self-test file was cleaned up');
		const stored = await poolPut('ibra-uploads/12-devis.pdf', Buffer.from('un devis'), 'application/pdf');
		assert.equal(stored, true);
		assert.ok(a.bad.length === 0, a.bad.join('\n'));
		const back = await poolGet('ibra-uploads/12-devis.pdf');
		assert.equal(back.body.toString(), 'un devis');
		assert.equal(back.contentType, 'application/pdf');
		await poolDelete('ibra-uploads/12-devis.pdf');
		assert.equal(await poolGet('ibra-uploads/12-devis.pdf'), null);
	} finally { a.server.close(); }
});

test('a file never sent to the pool (already in Supabase from before) reads back as "not found" so the caller falls back', async () => {
	const a = await fakeProvider();
	try {
		await initFreePool(envFor(['b2'], [a.port]));
		assert.equal(await poolGet('ibra-uploads/an-old-file-from-before.pdf'), null);
	} finally { a.server.close(); }
});

test('a provider that fails its self-test is never written to, and uploads fall back cleanly', async () => {
	const a = await fakeProvider({ failPut: true });
	try {
		await initFreePool(envFor(['b2'], [a.port]));
		assert.equal(await poolPut('ibra-uploads/x.pdf', Buffer.from('x'), 'application/pdf'), false);
	} finally { a.server.close(); }
});

test('when a write fails mid-flight, poolPut reports it instead of throwing, so the caller can fall back to Supabase', async () => {
	const a = await fakeProvider();
	try {
		await initFreePool(envFor(['b2'], [a.port]));
		await a.server.close();
		assert.equal(await poolPut('ibra-uploads/x.pdf', Buffer.from('x'), 'application/pdf'), false);
	} finally { a.server.close(); }
});

test('poolSignedUrl finds the provider that actually has the object and hands back a working URL', async () => {
	const a = await fakeProvider();
	try {
		await initFreePool(envFor(['b2'], [a.port]));
		await poolPut('ibra-uploads/devis-9.pdf', Buffer.from('un devis'), 'application/pdf');
		const url = await poolSignedUrl('ibra-uploads/devis-9.pdf', 300);
		assert.ok(url, 'expected a signed URL for an object the provider has');
		const response = await fetch(url);
		assert.equal(response.status, 200);
		assert.equal(await response.text(), 'un devis');
	} finally { a.server.close(); }
});

test('poolSignedUrl returns null (not a broken URL) when nobody in the pool has the object', async () => {
	const a = await fakeProvider();
	try {
		await initFreePool(envFor(['b2'], [a.port]));
		assert.equal(await poolSignedUrl('ibra-uploads/never-uploaded.pdf', 300), null);
	} finally { a.server.close(); }
});
