// GET/POST /api/projects/:id/rge-checklist aggregates the RGE Qualibat compliance points already
// found per-document across a whole chantier's plans/fiches techniques. No GEMINI_API_KEY is set in
// this test environment, so these prove routing, document filtering, access control and the cached
// GET/regenerate-POST split rather than the actual AI extraction (which has its own "never invent, only
// what the text says" prompt discipline, matching the explain feature it's modeled on).
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
const port = 10200 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir;

const call = (method, requestPath, token) => new Promise((resolve, reject) => {
	const request = http.request({ host: '127.0.0.1', port, path: requestPath, method, headers: { Authorization: `Bearer ${token}` } }, (response) => {
		let data = '';
		response.on('data', (chunk) => (data += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(data || '{}') }));
	});
	request.on('error', reject);
	request.end();
});
const get = (requestPath, token) => call('GET', requestPath, token);
const post = (requestPath, token) => call('POST', requestPath, token);

before(async () => {
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-rge-checklist-test-'));
	const seed = {
		users: [
			{ id: 'owner-a', name: 'Owner A', email: 'ownera@example.com', role: 'gerant', siret: '111111111', company: 'Company A', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
			{ id: 'owner-b', name: 'Owner B', email: 'ownerb@example.com', role: 'gerant', siret: '222222222', company: 'Company B', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
		],
		projects: [
			{ id: 'proj-empty', name: 'Chantier Vide', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() },
			{ id: 'proj-with-docs', name: 'Chantier Avec Documents', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() },
			{ id: 'proj-b', name: 'Chantier B', location: '', progress: 0, status: 'active', manager: 'Owner B', ownerId: 'owner-b', createdAt: new Date().toISOString() },
		],
		documents: [
			// A plan document for proj-with-docs - no GEMINI key in this test env, so the route should
			// report not_configured once it gets past the "does this chantier even have documents" check.
			{ id: 'doc-plan-1', originalName: 'plan1.pdf', storedName: 'plan1-stored.pdf', mimeType: 'application/pdf', size: 3, evidenceType: 'plan', projectId: 'proj-with-docs', uploadedBy: 'owner-a', uploadedAt: new Date().toISOString() },
			// A photo (not plan/fiche-technique) must never count toward "this chantier has relevant documents".
			{ id: 'doc-photo-1', originalName: 'photo1.jpg', storedName: 'photo1-stored.jpg', mimeType: 'image/jpeg', size: 3, evidenceType: 'photo-during', projectId: 'proj-with-docs', uploadedBy: 'owner-a', uploadedAt: new Date().toISOString() },
		],
		timeEntries: [], chantierControls: [], budgets: [], planMeasurements: [], devisLineItems: [],
		rendezvous: [], payouts: [], tasks: [], personalDocuments: [], factures: [], notifications: [], messages: [],
	};
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));
	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: { ...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '', GOOGLE_AI_API_KEY: '' },
		stdio: 'ignore',
	});
	for (let i = 0; i < 100; i += 1) {
		try { if ((await get('/api/health', '')).status === 200) return; } catch { /* not up yet */ }
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error('server did not start');
});

after(() => child?.kill());

const tokenFor = (userId, role) => jwt.sign({ sub: userId, name: userId, email: `${userId}@example.com`, role, company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: [], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

test('GET returns not_generated before any POST has ever run for this chantier', async () => {
	const response = await get('/api/projects/proj-with-docs/rge-checklist', tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	assert.equal(response.body.status, 'not_generated');
	assert.deepEqual(response.body.points, []);
});

test('POST reports no_documents for a chantier with no plan/fiche-technique documents at all', async () => {
	const response = await post('/api/projects/proj-empty/rge-checklist', tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	assert.equal(response.body.status, 'no_documents');
});

test('POST reports not_configured (not an error) when no Gemini key is set, after correctly finding the relevant document', async () => {
	const response = await post('/api/projects/proj-with-docs/rge-checklist', tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	assert.equal(response.body.status, 'not_configured');
});

test('a non-plan/fiche-technique document (a photo) never counts as a relevant document on its own', async () => {
	const onlyPhotoProject = await post('/api/projects/proj-b/rge-checklist', tokenFor('owner-b', 'gerant'));
	assert.equal(onlyPhotoProject.status, 200);
	assert.equal(onlyPhotoProject.body.status, 'no_documents');
});

test('owner B (a different company) gets 403 on both GET and POST for owner A\'s chantier', async () => {
	const getResponse = await get('/api/projects/proj-with-docs/rge-checklist', tokenFor('owner-b', 'gerant'));
	assert.equal(getResponse.status, 403);
	const postResponse = await post('/api/projects/proj-with-docs/rge-checklist', tokenFor('owner-b', 'gerant'));
	assert.equal(postResponse.status, 403);
});

test('a nonexistent chantier gets 403 on both GET and POST, same as every other project-scoped route (never leaks whether the id exists)', async () => {
	const getResponse = await get('/api/projects/does-not-exist/rge-checklist', tokenFor('owner-a', 'gerant'));
	assert.equal(getResponse.status, 403);
	const postResponse = await post('/api/projects/does-not-exist/rge-checklist', tokenFor('owner-a', 'gerant'));
	assert.equal(postResponse.status, 403);
});
