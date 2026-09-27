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
			const key = decodeURIComponent(request.url.replace(/^\/ibra-ba-test\//, ''));
			const signed = (request.headers.authorization || '').startsWith('AWS4-HMAC-SHA256 Credential=testkey/');
			if (!signed) { response.statusCode = 403; return response.end(); }
			if (request.method === 'PUT') { files.set(key, { body, type: request.headers['content-type'] }); return response.end(); }
			if (request.method === 'DELETE') { files.delete(key); return response.end(); }
			const file = files.get(key);
			if (!file) { response.statusCode = 404; return response.end(); }
			response.setHeader('content-type', file.type);
			response.end(file.body);
		});
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, files, port: server.address().port })));
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
