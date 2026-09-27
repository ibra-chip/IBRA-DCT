import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { putObject } from '../lib/s3.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 8900 + Math.floor(Math.random() * 200);
let child, fake;
const badRequests = [];
const files = new Map();
let fakePort;

const get = (path) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path, headers: { Accept: 'text/html' } }, (response) => {
		let body = [];
		response.on('data', (chunk) => body.push(chunk));
		response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(body) }));
	}).on('error', reject);
});

const provider = { name: 'b2', endpoint: '', region: 'eu', keyId: 'testkey', secret: 'testsecret', bucket: 'ibra-ba-test' };

before(async () => {
	fake = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const body = Buffer.concat(chunks);
			const key = decodeURIComponent(request.url.replace(/^\/ibra-ba-test\//, ''));
			const signed = (request.headers.authorization || '').startsWith('AWS4-HMAC-SHA256 Credential=testkey/');
			if (!signed) { badRequests.push(`${request.method} ${key}`); response.statusCode = 403; return response.end(); }
			if (request.method === 'GET') {
				const file = files.get(key);
				if (!file) { response.statusCode = 404; return response.end(); }
				response.setHeader('content-type', file.type);
				return response.end(file.body);
			}
			response.statusCode = 200;
			response.end();
		});
	});
	await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
	fakePort = fake.address().port;
	provider.endpoint = `http://127.0.0.1:${fakePort}`;
	// Pre-populate an identity photo directly at the provider, as if a prior upload had already pooled it.
	await putObject(provider, 'ibra-identity/logo-test.png', Buffer.from('fake png bytes'), 'image/png');
	files.set('ibra-identity/logo-test.png', { body: Buffer.from('fake png bytes'), type: 'image/png' });

	child = spawn(process.execPath, ['server.js'], {
		cwd: root, env: {
			...process.env, PORT: String(port), NODE_ENV: 'test', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: '',
			STORAGE_POOL: 'b2', B2_ENDPOINT: `http://127.0.0.1:${fakePort}`, B2_REGION: 'eu', B2_KEY_ID: 'testkey', B2_SECRET: 'testsecret', B2_BUCKET: 'ibra-ba-test',
		}, stdio: 'ignore',
	});
	for (let i = 0; i < 100; i += 1) {
		try { if ((await get('/api/health')).status === 200) return; } catch { /* not up yet */ }
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error('server did not start');
});

after(() => { child?.kill(); fake?.close(); });

test('an identity photo already in the free pool is served directly, with a long cache lifetime', async () => {
	const response = await get('/identity-assets/logo-test.png');
	assert.equal(response.status, 200);
	assert.equal(response.body.toString(), 'fake png bytes');
	assert.equal(response.headers['content-type'], 'image/png');
	assert.match(response.headers['cache-control'] || '', /immutable/);
});

test('an identity photo not in the pool falls back to the original Supabase redirect, unchanged', async () => {
	const response = await get('/identity-assets/never-uploaded-to-the-pool.png');
	assert.ok([301, 302, 303, 307, 308].includes(response.status), `expected a redirect, got ${response.status}`);
	assert.match(response.headers.location || '', /example\.supabase\.co.*ibra-identity.*never-uploaded-to-the-pool\.png/);
});

test('the provider bucket only ever answered signed requests — nothing was made public', () => {
	assert.deepEqual(badRequests, []);
});
