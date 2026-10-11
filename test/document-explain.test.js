// End-to-end: hits the real /api/documents/:id/explain route to prove the plan/fiche-technique
// "explain simply" feature is scoped correctly (plan/fiche-technique only, not any document type),
// reports cleanly when Gemini isn't configured instead of erroring, and serves a cached explanation
// straight from the stored document record without needing Gemini again.
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
const port = 9400 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir;

const get = (requestPath) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path: requestPath }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body }));
	}).on('error', reject);
});

const post = (requestPath, token) => new Promise((resolve, reject) => {
	const request = http.request({ host: '127.0.0.1', port, path: requestPath, method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': 2 } }, (response) => {
		let data = '';
		response.on('data', (chunk) => (data += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(data || '{}') }));
	});
	request.on('error', reject);
	request.end('{}');
});

before(async () => {
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-explain-test-'));
	const userId = 'user-1';
	const seed = {
		users: [{ id: userId, name: 'Test User', email: 'test@example.com', role: 'gerant', passwordHash: 'unused', projectIds: ['proj-1'], dailyRate: 0, hourlyRate: 0 }],
		projects: [{ id: 'proj-1', name: 'Test Project', location: '', progress: 0, status: 'active', manager: 'Test User' }],
		documents: [
			{ id: 'doc-plan', originalName: 'plan.pdf', storedName: 'plan-stored.pdf', mimeType: 'application/pdf', size: 3, evidenceType: 'plan', projectId: 'proj-1', uploadedBy: userId, uploadedAt: new Date().toISOString() },
			{ id: 'doc-plan-cached', originalName: 'plan2.pdf', storedName: 'plan2-stored.pdf', mimeType: 'application/pdf', size: 3, evidenceType: 'plan', projectId: 'proj-1', uploadedBy: userId, uploadedAt: new Date().toISOString(), plainExplanation: 'Ovo je tlocrt prizemlja sa oznacenim zidovima.' },
			{ id: 'doc-photo', originalName: 'photo.jpg', storedName: 'photo-stored.jpg', mimeType: 'image/jpeg', size: 3, evidenceType: 'avancement', projectId: 'proj-1', uploadedBy: userId, uploadedAt: new Date().toISOString() },
		],
	};
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));

	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: { ...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '', GOOGLE_AI_API_KEY: '' },
		stdio: 'ignore',
	});
	for (let i = 0; i < 100; i += 1) {
		try { if ((await get('/api/health')).status === 200) return; } catch { /* not up yet */ }
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error('server did not start');
});

after(() => child?.kill());

const token = () => jwt.sign({ sub: 'user-1', name: 'Test User', email: 'test@example.com', role: 'gerant', company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: ['proj-1'], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

test('explain is rejected for a document type other than plan/fiche-technique', async () => {
	const response = await post('/api/documents/doc-photo/explain', token());
	assert.equal(response.status, 400);
	assert.ok(response.body.error);
});

test('explain reports not_configured cleanly (not an error) when no Gemini key is set', async () => {
	const response = await post('/api/documents/doc-plan/explain', token());
	assert.equal(response.status, 200);
	assert.equal(response.body.status, 'not_configured');
	assert.equal(response.body.explanation, null);
});

test('explain serves an already-generated explanation straight from the document record, no AI call needed', async () => {
	const response = await post('/api/documents/doc-plan-cached/explain', token());
	assert.equal(response.status, 200);
	assert.equal(response.body.status, 'cached');
	assert.equal(response.body.explanation, 'Ovo je tlocrt prizemlja sa oznacenim zidovima.');
});

test('explain 404s for a document that does not exist', async () => {
	const response = await post('/api/documents/does-not-exist/explain', token());
	assert.equal(response.status, 404);
});
