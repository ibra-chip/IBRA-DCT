// End-to-end: hits the real server.js route (not just the lib functions) to prove a document download
// actually redirects the browser straight to the storage provider instead of this server streaming the
// bytes, and that it still works the old way (proxying bytes) when no provider has the object.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 8900 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir, provider, providerPort;

function fakeProvider() {
	const files = new Map();
	const server = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const [pathname, query = ''] = request.url.split('?');
			const key = decodeURIComponent(pathname.replace(/^\/ibra-ba-test\//, ''));
			const headerSigned = (request.headers.authorization || '').startsWith('AWS4-HMAC-SHA256 Credential=testkey/');
			const presigned = /X-Amz-Signature=[0-9a-f]{64}/.test(query) && query.includes('Credential=testkey');
			if (!headerSigned && !presigned) { response.statusCode = 403; return response.end(); }
			if (request.method === 'HEAD') { response.statusCode = files.has(key) ? 200 : 404; return response.end(); }
			const file = files.get(key);
			if (!file) { response.statusCode = 404; return response.end(); }
			response.setHeader('content-type', file.type);
			response.end(file.body);
		});
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, files, port: server.address().port })));
}

const get = (requestPath, headers = {}) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path: requestPath, headers }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, location: response.headers.location, body }));
	}).on('error', reject);
});

before(async () => {
	provider = await fakeProvider();
	providerPort = provider.port;

	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-download-test-'));
	const userId = 'user-test-1';
	const seed = {
		users: [{ id: userId, name: 'Test User', email: 'test@example.com', role: 'gerant', passwordHash: 'unused', projectIds: ['proj-1'], dailyRate: 0, hourlyRate: 0 }],
		projects: [{ id: 'proj-1', name: 'Test Project', location: '', progress: 0, status: 'active', manager: 'Test User' }],
		projectBudgets: [], projectDelays: [], projectSchedules: [], purchases: [], chantierControls: [], controlHistory: [],
		rendezvous: [], messages: [], timeEntries: [],
		documents: [
			{ id: 'doc-on-provider', originalName: 'plan.pdf', storedName: 'plan-on-provider.pdf', mimeType: 'application/pdf', size: 3, projectId: 'proj-1', uploadedBy: userId, uploadedAt: new Date().toISOString() },
			{ id: 'doc-not-on-provider', originalName: 'old.pdf', storedName: 'old-not-anywhere.pdf', mimeType: 'application/pdf', size: 3, projectId: 'proj-1', uploadedBy: userId, uploadedAt: new Date().toISOString() },
		],
		complianceDocuments: [], passwordResets: [],
	};
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));
	provider.files.set('ibra-uploads/plan-on-provider.pdf', { body: Buffer.from('pdf'), type: 'application/pdf' });

	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: {
			...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir,
			SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '',
			STORAGE_POOL: 'b2', B2_ENDPOINT: `http://127.0.0.1:${providerPort}`, B2_REGION: 'eu', B2_KEY_ID: 'testkey', B2_SECRET: 'testsecret', B2_BUCKET: 'ibra-ba-test',
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

const token = () => jwt.sign({ sub: 'user-test-1', name: 'Test User', email: 'test@example.com', role: 'gerant', company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: ['proj-1'], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

test('downloading a document the pool provider has redirects the browser straight to the provider, not through this server', async () => {
	const response = await get('/api/documents/doc-on-provider/download', { Authorization: `Bearer ${token()}` });
	assert.equal(response.status, 302);
	assert.ok(response.location.startsWith(`http://127.0.0.1:${providerPort}/`), `expected a redirect to the provider, got: ${response.location}`);
	assert.ok(response.location.includes('response-content-disposition'), 'expected the original filename to be preserved via response-content-disposition');
});

test('downloading a document nobody has falls back to the old proxy behavior and reports a clean error, not a crash', async () => {
	const response = await get('/api/documents/doc-not-on-provider/download', { Authorization: `Bearer ${token()}` });
	assert.equal(response.status, 502);
	assert.ok(JSON.parse(response.body).error, 'expected a JSON error body, same shape as before this change');
});
