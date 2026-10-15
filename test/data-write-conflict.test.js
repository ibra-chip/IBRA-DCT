// End-to-end: hits the real server.js against a fake Supabase PostgREST endpoint to prove the
// optimistic-concurrency (compare-and-swap on data.__rev) write path actually does what it's for -
// a write based on data another writer already superseded is rejected with 409, not silently accepted
// and overwriting the other writer's change - instead of just trusting the implementation by reading it.
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
const port = 9500 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir, fakeSupabase, fakeSupabasePort;

// A minimal in-process stand-in for the handful of Supabase REST behaviors server.js relies on for
// the app_state singleton row: select, upsert (seed), and a conditional PATCH keyed on data->>__rev.
function fakeSupabaseServer() {
	const store = { data: undefined };
	const readBody = (request) => new Promise((resolve) => { const chunks = []; request.on('data', (c) => chunks.push(c)); request.on('end', () => resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : null)); });
	const server = http.createServer(async (request, response) => {
		const [pathname, query = ''] = request.url.split('?');
		const params = new URLSearchParams(query);
		if (pathname === '/rest/v1/app_state' && request.method === 'GET') {
			response.writeHead(200, { 'Content-Type': 'application/json' });
			return response.end(JSON.stringify(store.data !== undefined ? [{ data: store.data }] : []));
		}
		if (pathname === '/rest/v1/app_state' && request.method === 'POST') {
			const body = await readBody(request);
			if (body?.id === 'singleton') store.data = body.data;
			response.writeHead(201, { 'Content-Type': 'application/json' });
			return response.end('[]');
		}
		if (pathname === '/rest/v1/app_state' && request.method === 'PATCH') {
			const revFilter = params.get('data->>__rev');
			const currentRev = store.data?.__rev;
			const matches = revFilter === 'is.null' ? currentRev === undefined : revFilter === `eq.${currentRev}`;
			if (!matches) { response.writeHead(200, { 'Content-Type': 'application/json' }); return response.end('[]'); }
			const body = await readBody(request);
			store.data = body.data;
			response.writeHead(200, { 'Content-Type': 'application/json' });
			return response.end(JSON.stringify([{ id: 'singleton', data: store.data }]));
		}
		// Storage bucket existence checks etc: harmless 404, ensureBuckets() tolerates this.
		response.writeHead(404, { 'Content-Type': 'application/json' });
		response.end('{}');
	});
	return { server, store, bumpRevExternally: (change) => { store.data = { ...store.data, ...change, __rev: (store.data?.__rev ?? 0) + 1 }; } };
}

const get = (requestPath, headers = {}) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path: requestPath, headers }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body }));
	}).on('error', reject);
});

const patchJson = (requestPath, token, payload) => new Promise((resolve, reject) => {
	const body = Buffer.from(JSON.stringify(payload));
	const request = http.request({ host: '127.0.0.1', port, path: requestPath, method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': body.length } }, (response) => {
		let data = '';
		response.on('data', (chunk) => (data += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(data || '{}') }));
	});
	request.on('error', reject);
	request.end(body);
});

before(async () => {
	const fake = fakeSupabaseServer();
	fakeSupabase = fake;
	await new Promise((resolve) => fake.server.listen(0, '127.0.0.1', resolve));
	fakeSupabasePort = fake.server.address().port;

	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-conflict-test-'));
	const userId = 'user-1';
	const seed = {
		users: [{ id: userId, name: 'Test User', email: 'test@example.com', role: 'gerant', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0 }],
		projects: [{ id: 'proj-1', name: 'Test Project', location: '', progress: 0, status: 'active', manager: 'Test User', ownerId: userId }],
		documents: [{ id: 'doc-1', originalName: 'original.pdf', storedName: 'stored.pdf', mimeType: 'application/pdf', size: 3, evidenceType: 'other', projectId: 'proj-1', uploadedBy: userId, uploadedAt: new Date().toISOString() }],
	};
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));

	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: {
			...process.env, PORT: String(port), NODE_ENV: 'production', IBRA_DATA_DIR: dataDir,
			SUPABASE_URL: `http://127.0.0.1:${fakeSupabasePort}`, SUPABASE_SERVICE_ROLE_KEY: 'test-key',
			DAILY_BACKUP: 'off', DATA_CACHE_TTL_MS: '60000', REQUIRE_SUPABASE: 'false',
		},
		stdio: 'ignore',
	});
	for (let i = 0; i < 100; i += 1) {
		try { if ((await get('/api/health')).status === 200) return; } catch { /* not up yet */ }
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error('server did not start');
});

after(() => { child?.kill(); fakeSupabase?.server.close(); });

const token = () => jwt.sign({ sub: 'user-1', name: 'Test User', email: 'test@example.com', role: 'gerant', company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: [], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

test('a normal write succeeds and bootstraps the revision counter from a legacy no-__rev blob', async () => {
	const response = await patchJson('/api/documents/doc-1', token(), { name: 'Renamed once' });
	assert.equal(response.status, 200);
	assert.equal(response.body.originalName, 'Renamed once');
	assert.equal(fakeSupabase.store.data.__rev, 1, 'first write after a rev-less blob should set __rev to 1, not spuriously conflict');
});

test('a write based on data another writer already superseded is rejected with 409, not silently overwritten', async () => {
	// Prime this server's cache with the current (rev=1) snapshot.
	const primed = await get('/api/documents', { Authorization: `Bearer ${token()}` });
	assert.equal(primed.status, 200);

	// Simulate another Cloud Run instance writing in between, invisible to this instance's cache.
	fakeSupabase.bumpRevExternally({ documents: [{ ...fakeSupabase.store.data.documents[0], originalName: 'Changed by someone else' }] });
	assert.equal(fakeSupabase.store.data.__rev, 2);

	// This instance still thinks the data is at rev=1 (cached), so its write's CAS condition (eq.1) no
	// longer matches the real stored rev (2) - it must be rejected, not silently clobber the other write.
	const conflicted = await patchJson('/api/documents/doc-1', token(), { name: 'My conflicting rename' });
	assert.equal(conflicted.status, 409);
	assert.ok(conflicted.body.error);
	assert.equal(fakeSupabase.store.data.documents[0].originalName, 'Changed by someone else', 'the other writer\'s change must survive the rejected write');

	// The conflict must have invalidated this instance's cache, so an immediate retry of the exact same
	// request (exactly what the frontend's auto-retry-once does) now reads fresh data and succeeds.
	const retried = await patchJson('/api/documents/doc-1', token(), { name: 'My conflicting rename' });
	assert.equal(retried.status, 200);
	assert.equal(retried.body.originalName, 'My conflicting rename');
	assert.equal(fakeSupabase.store.data.__rev, 3);
});
