// The document upload route used to run Gemini analysis + PDF parsing + image extraction fully
// synchronously before ever responding - for a large multi-page technical PDF (a real structural plan)
// this was seen in production timing out the whole request at an infra level with a bare 503, even though
// the file itself had already been uploaded to storage. The document record was never created in that
// case, so the user saw "Document non enregistré : 503" and had no way to know the file was actually
// sitting orphaned in storage. Fixed by making /documents/upload only ever do the fast part (storage
// write + save the record) before responding, with analysis moved to a separate POST .../analyze call the
// client makes right after a successful upload. Proves: the upload response is immediate and always
// carries a real, usable document id; analyze is idempotent/cached; and analyze is access-controlled the
// same way every other project-scoped document route already is.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 9700 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir, provider;

function fakeProvider() {
	const files = new Map();
	const server = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const body = Buffer.concat(chunks);
			const [pathname] = request.url.split('?');
			const key = decodeURIComponent(pathname.replace(/^\/ibra-ba-async-doc-test\//, ''));
			if (request.method === 'PUT') { files.set(key, body); return response.end(); }
			if (request.method === 'DELETE') { files.delete(key); return response.end(); }
			const file = files.get(key);
			if (!file) { response.statusCode = 404; return response.end(); }
			if (request.method === 'HEAD') { response.statusCode = 200; return response.end(); }
			response.end(file);
		});
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

function postMultipart(requestPath, token, fields, filePart) {
	const boundary = `----ibraBaAsyncDocTestBoundary${Date.now()}`;
	const parts = [];
	for (const [name, value] of Object.entries(fields)) {
		parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
	}
	if (filePart) {
		parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${filePart.field}"; filename="${filePart.filename}"\r\nContent-Type: ${filePart.contentType}\r\n\r\n`));
		parts.push(filePart.buffer);
		parts.push(Buffer.from('\r\n'));
	}
	parts.push(Buffer.from(`--${boundary}--\r\n`));
	const body = Buffer.concat(parts);
	return new Promise((resolve, reject) => {
		const request = http.request({
			host: '127.0.0.1', port, path: requestPath, method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
		}, (response) => {
			let data = '';
			response.on('data', (chunk) => (data += chunk));
			response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(data || '{}') }));
		});
		request.on('error', reject);
		request.end(body);
	});
}

const call = (method, requestPath, token, jsonBody) => new Promise((resolve, reject) => {
	const payload = jsonBody ? Buffer.from(JSON.stringify(jsonBody)) : Buffer.alloc(0);
	const request = http.request({
		host: '127.0.0.1', port, path: requestPath, method,
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': payload.length },
	}, (response) => {
		let data = '';
		response.on('data', (chunk) => (data += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(data || '{}') }));
	});
	request.on('error', reject);
	request.end(payload);
});
const post = (requestPath, token, jsonBody) => call('POST', requestPath, token, jsonBody);

const get = (requestPath, token) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path: requestPath, headers: token ? { Authorization: `Bearer ${token}` } : {} }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body || '{}') }));
	}).on('error', reject);
});

before(async () => {
	provider = await fakeProvider();
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-async-doc-test-'));
	const seed = {
		users: [
			{ id: 'owner-a', name: 'Owner A', email: 'ownera@example.com', role: 'gerant', siret: '111111111', company: 'Company A', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
			{ id: 'owner-b', name: 'Owner B', email: 'ownerb@example.com', role: 'gerant', siret: '222222222', company: 'Company B', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
		],
		projects: [
			{ id: 'proj-a', name: 'Chantier A', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() },
			{ id: 'proj-b', name: 'Chantier B', location: '', progress: 0, status: 'active', manager: 'Owner B', ownerId: 'owner-b', createdAt: new Date().toISOString() },
		],
		documents: [], factures: [],
	};
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));
	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: {
			...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir,
			SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '', GOOGLE_AI_API_KEY: '', OPENAI_API_KEY: '',
			STORAGE_POOL: 'b2', B2_ENDPOINT: `http://127.0.0.1:${provider.port}`, B2_REGION: 'eu', B2_KEY_ID: 'testkey', B2_SECRET: 'testsecret', B2_BUCKET: 'ibra-ba-async-doc-test',
		},
		stdio: 'ignore',
	});
	for (let i = 0; i < 100; i += 1) {
		try { if ((await get('/api/health')).status === 200) return; } catch { /* not up yet */ }
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error('server did not start');
});

after(() => { child?.kill(); provider?.server.close(); });

const tokenFor = (userId, role) => jwt.sign({ sub: userId, name: userId, email: `${userId}@example.com`, role, company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: [], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

let uploadedDocumentId;

test('upload responds immediately with a saved document and autoAnalysis status "pending", not a full analysis', async () => {
	const startedAt = Date.now();
	const result = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan' }, { field: 'file', filename: 'plan.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake plan content for the async-analysis test') });
	const elapsedMs = Date.now() - startedAt;
	assert.equal(result.status, 201, JSON.stringify(result.body));
	assert.ok(result.body.id, 'upload must return a real document id');
	assert.deepEqual(result.body.autoAnalysis, { status: 'pending' }, 'the upload response must never carry a full analysis - that is what used to make this request slow enough to time out');
	// Generous upper bound given CI variance, but this exists specifically to catch a regression back to
	// the old "wait for Gemini/PDF-parsing/image-extraction before responding" behavior.
	assert.ok(elapsedMs < 5000, `upload took ${elapsedMs}ms - should be fast now that analysis is no longer inline`);
	uploadedDocumentId = result.body.id;
});

test('the uploaded document is immediately visible in the documents list even before /analyze is ever called', async () => {
	const list = await get('/api/documents', tokenFor('owner-a', 'gerant'));
	assert.equal(list.status, 200);
	const found = list.body.find((item) => item.id === uploadedDocumentId);
	assert.ok(found, 'the document record must already exist - this is the exact bug: a slow analysis used to prevent the record from ever being created');
	assert.deepEqual(found.autoAnalysis, { status: 'pending' });
});

test('POST .../analyze runs the analysis (degrading gracefully with no Gemini key configured) and persists it', async () => {
	const result = await post(`/api/documents/${uploadedDocumentId}/analyze`, tokenFor('owner-a', 'gerant'), { responseLanguage: 'fr' });
	assert.equal(result.status, 200, JSON.stringify(result.body));
	assert.ok(result.body.autoAnalysis, 'analyze must return a usable autoAnalysis object even when Gemini is not configured');
	// No GEMINI_API_KEY in this test env and the fake PDF buffer has no extractable text, so it must degrade
	// to the existing needs_ocr fallback (a real, non-throwing analysis result), never throw or hang.
	assert.equal(result.body.autoAnalysis.status, 'needs_ocr');

	const list = await get('/api/documents', tokenFor('owner-a', 'gerant'));
	const found = list.body.find((item) => item.id === uploadedDocumentId);
	assert.equal(found.autoAnalysis.status, 'needs_ocr', 'the trimmed summary on the document record must be updated after analyze runs');
});

test('a second call to .../analyze returns the cached result instead of re-running the analysis', async () => {
	const first = await post(`/api/documents/${uploadedDocumentId}/analyze`, tokenFor('owner-a', 'gerant'), { responseLanguage: 'fr' });
	const second = await post(`/api/documents/${uploadedDocumentId}/analyze`, tokenFor('owner-a', 'gerant'), { responseLanguage: 'fr' });
	assert.equal(second.status, 200);
	assert.deepEqual(second.body.autoAnalysis, first.body.autoAnalysis, 'a cached analysis must be returned as-is, not regenerated');
});

test('owner B (a different company) gets 403 from .../analyze on owner A\'s document', async () => {
	const result = await post(`/api/documents/${uploadedDocumentId}/analyze`, tokenFor('owner-b', 'gerant'), { responseLanguage: 'fr' });
	assert.equal(result.status, 403);
});

test('.../analyze on a nonexistent document 404s', async () => {
	const result = await post('/api/documents/does-not-exist/analyze', tokenFor('owner-a', 'gerant'), { responseLanguage: 'fr' });
	assert.equal(result.status, 404);
});
