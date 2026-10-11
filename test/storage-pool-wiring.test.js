// Exercises uploadFile/downloadFile/deleteFile exactly as every existing call site in server.js does
// (devis, invoices, documents, photos) — none of those call sites changed at all; only what happens
// inside lib/storage.js did.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';

function fakeProvider() {
	const files = new Map();
	const server = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const body = Buffer.concat(chunks);
			const [pathname, query = ''] = request.url.split('?');
			const key = decodeURIComponent(pathname.replace(/^\/ibra-ba-test\//, ''));
			const headerSigned = (request.headers.authorization || '').startsWith('AWS4-HMAC-SHA256 Credential=testkey/');
			const presigned = /X-Amz-Signature=[0-9a-f]{64}/.test(query) && query.includes('Credential=testkey');
			if (!headerSigned && !presigned) { response.statusCode = 403; return response.end(); }
			if (request.method === 'PUT') { files.set(key, { body, type: request.headers['content-type'] }); return response.end(); }
			if (request.method === 'DELETE') { files.delete(key); return response.end(); }
			const file = files.get(key);
			if (!file) { response.statusCode = 404; return response.end(); }
			if (request.method === 'HEAD') { response.statusCode = 200; return response.end(); }
			response.setHeader('content-type', file.type);
			response.end(file.body);
		});
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, files, port: server.address().port })));
}

// A fake Supabase Storage sign endpoint, just enough to exercise the fallback path.
function fakeSupabase() {
	const server = http.createServer((request, response) => {
		if (request.url.startsWith('/storage/v1/object/sign/')) {
			response.setHeader('content-type', 'application/json');
			const path = request.url.replace('/storage/v1/object/sign/', '');
			return response.end(JSON.stringify({ signedURL: `/object/sign/${path}?token=fake-token` }));
		}
		response.statusCode = 404;
		response.end();
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

test('uploadFile/downloadFile/deleteFile route through the free pool without callers changing anything', async () => {
	const provider = await fakeProvider();
	process.env.STORAGE_POOL = 'b2';
	process.env.B2_ENDPOINT = `http://127.0.0.1:${provider.port}`;
	process.env.B2_REGION = 'eu';
	process.env.B2_KEY_ID = 'testkey';
	process.env.B2_SECRET = 'testsecret';
	process.env.B2_BUCKET = 'ibra-ba-test';
	process.env.SUPABASE_URL = ''; // no Supabase available in this test, so a fallback would visibly throw
	process.env.SUPABASE_SERVICE_ROLE_KEY = '';
	try {
		const storage = await import(`../lib/storage.js?t=${Date.now()}`); // fresh module instance for this test's env
		await storage.ensureBuckets();

		await storage.uploadFile(storage.UPLOADS_BUCKET, 'devis/2026-01/devis-12.pdf', Buffer.from('PDF bytes here'), 'application/pdf');
		assert.equal(provider.files.size, 1, 'the document reached the provider, not Supabase (which would have thrown)');

		const back = await storage.downloadFile(storage.UPLOADS_BUCKET, 'devis/2026-01/devis-12.pdf');
		assert.equal(back.toString(), 'PDF bytes here');

		await storage.deleteFile(storage.UPLOADS_BUCKET, 'devis/2026-01/devis-12.pdf');
		assert.equal(provider.files.size, 0);

		// A file that predates the pool (never uploaded through it) must not be silently "found":
		// downloadFile falls through to Supabase, which is unreachable here, so it throws — exactly the
		// same failure shape as before this change, not a new one.
		await assert.rejects(() => storage.downloadFile(storage.UPLOADS_BUCKET, 'devis/2026-01/an-old-one.pdf'));
	} finally {
		provider.server.close();
		for (const key of ['STORAGE_POOL', 'B2_ENDPOINT', 'B2_REGION', 'B2_KEY_ID', 'B2_SECRET', 'B2_BUCKET']) delete process.env[key];
	}
});

test('getDownloadUrl hands back a direct pool URL for an object the pool has, bypassing this server for the bytes', async () => {
	const provider = await fakeProvider();
	process.env.STORAGE_POOL = 'b2';
	process.env.B2_ENDPOINT = `http://127.0.0.1:${provider.port}`;
	process.env.B2_REGION = 'eu';
	process.env.B2_KEY_ID = 'testkey';
	process.env.B2_SECRET = 'testsecret';
	process.env.B2_BUCKET = 'ibra-ba-test';
	process.env.SUPABASE_URL = '';
	process.env.SUPABASE_SERVICE_ROLE_KEY = '';
	try {
		const storage = await import(`../lib/storage.js?t=${Date.now()}`);
		await storage.ensureBuckets();
		await storage.uploadFile(storage.UPLOADS_BUCKET, 'photos/site-42.jpg', Buffer.from('site photo bytes'), 'image/jpeg');

		const url = await storage.getDownloadUrl(storage.UPLOADS_BUCKET, 'photos/site-42.jpg', 300);
		assert.ok(url?.startsWith(`http://127.0.0.1:${provider.port}/`), 'expected a direct URL to the provider, not this server');
		const response = await fetch(url);
		assert.equal(await response.text(), 'site photo bytes');
	} finally {
		provider.server.close();
		for (const key of ['STORAGE_POOL', 'B2_ENDPOINT', 'B2_REGION', 'B2_KEY_ID', 'B2_SECRET', 'B2_BUCKET']) delete process.env[key];
	}
});

test('getDownloadUrl falls back to a Supabase signed URL when the pool does not have the object', async () => {
	const supabase = await fakeSupabase();
	process.env.STORAGE_POOL = '';
	process.env.SUPABASE_URL = `http://127.0.0.1:${supabase.port}`;
	process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
	try {
		const storage = await import(`../lib/storage.js?t=${Date.now()}`);
		const url = await storage.getDownloadUrl(storage.UPLOADS_BUCKET, 'devis/old-one.pdf', 300);
		assert.equal(url, `http://127.0.0.1:${supabase.port}/storage/v1/object/sign/${storage.UPLOADS_BUCKET}/devis%2Fold-one.pdf?token=fake-token`);
	} finally {
		supabase.server.close();
		for (const key of ['STORAGE_POOL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[key];
	}
});

test('getDownloadUrl returns null (so the caller can proxy the bytes itself) when nothing is configured', async () => {
	process.env.STORAGE_POOL = '';
	process.env.SUPABASE_URL = '';
	process.env.SUPABASE_SERVICE_ROLE_KEY = '';
	try {
		const storage = await import(`../lib/storage.js?t=${Date.now()}`);
		assert.equal(await storage.getDownloadUrl(storage.UPLOADS_BUCKET, 'whatever.pdf', 300), null);
	} finally {
		for (const key of ['STORAGE_POOL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) delete process.env[key];
	}
});
