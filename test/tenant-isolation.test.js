// End-to-end: proves company A's owner can never see or touch company B's data - projects, users,
// and anything project-scoped. This used to be wide open: canAccessProject granted any owner-role
// user access to every project in the whole database regardless of which company it belonged to, and
// GET /api/projects, GET /api/users returned every company's records to any manager. Found while
// adding facture/purchase delete routes and confirmed with a real cross-company request before fixing
// it, not assumed from reading the code.
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
let child, dataDir;

const call = (method, requestPath, token, payload) => new Promise((resolve, reject) => {
	const body = payload ? Buffer.from(JSON.stringify(payload)) : null;
	const headers = { Authorization: `Bearer ${token}` };
	if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = body.length; }
	const request = http.request({ host: '127.0.0.1', port, path: requestPath, method, headers }, (response) => {
		let data = '';
		response.on('data', (chunk) => (data += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(data || '{}') }));
	});
	request.on('error', reject);
	if (body) request.write(body);
	request.end();
});
const get = (requestPath, token) => call('GET', requestPath, token);

before(async () => {
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-tenant-test-'));
	const seed = {
		users: [
			{ id: 'owner-a', name: 'Owner A', email: 'ownera@example.com', role: 'gerant', siret: '111111111', company: 'Company A', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: '2026-01-01T00:00:00.000Z' },
			{ id: 'worker-a', name: 'Worker A', email: 'workera@example.com', role: 'user', invitedBy: 'owner-a', employerSiret: '111111111', employerCompany: 'Company A', passwordHash: 'unused', projectIds: ['proj-a'], dailyRate: 0, hourlyRate: 0, createdAt: '2026-01-01T00:00:00.000Z' },
			{ id: 'owner-b', name: 'Owner B', email: 'ownerb@example.com', role: 'gerant', siret: '222222222', company: 'Company B', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: '2026-01-02T00:00:00.000Z' },
		],
		projects: [
			{ id: 'proj-a', name: 'Chantier A', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() },
			{ id: 'proj-b', name: 'Chantier B', location: '', progress: 0, status: 'active', manager: 'Owner B', ownerId: 'owner-b', createdAt: new Date().toISOString() },
			{ id: 'proj-legacy', name: 'Chantier Legacy', location: '', progress: 0, status: 'active', manager: 'Owner A', createdAt: new Date().toISOString() },
			{ id: 'proj-a-doomed', name: 'Chantier A a supprimer', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() },
		],
		documents: [{ id: 'doc-a', originalName: 'plan-a.pdf', storedName: 'plan-a-stored.pdf', mimeType: 'application/pdf', size: 3, evidenceType: 'plan', projectId: 'proj-a', uploadedBy: 'owner-a', uploadedAt: new Date().toISOString() }],
		chantierControls: [{ id: 'control-a', projectId: 'proj-a', name: 'Controle A', status: 'review', owner: 'Owner A' }],
		timeEntries: [{ id: 'time-a', workerId: 'worker-a', workerName: 'Worker A', enteredBy: 'worker-a', projectId: 'proj-a', date: '2026-01-05', start: '08:00', end: '16:00', breakMinutes: 60, hours: 7, rateType: 'daily', rate: 100, workAmount: 100, status: 'pending' }],
		rendezvous: [{ id: 'rdv-a', projectId: null, workerId: 'worker-a', ownerId: 'owner-a', absenceDate: '2026-02-01', date: '2026-02-01', time: '08:00', reason: 'conge', type: 'absence', createdAt: new Date().toISOString() }],
		payoutRequests: [{ id: 'payout-a', userId: 'worker-a', userName: 'Worker A', month: '2026-01', days: 5, dailyRate: 100, amount: 500, submissionDate: '2026-01-01', paymentDate: '2026-01-15', status: 'pending', createdAt: new Date().toISOString() }],
	};
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));
	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: { ...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
		stdio: 'ignore',
	});
	for (let i = 0; i < 100; i += 1) {
		try { if ((await get('/api/health')).status === 200) return; } catch { /* not up yet */ }
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error('server did not start');
});

after(() => child?.kill());

const tokenFor = (userId, role, projectIds = []) => jwt.sign({ sub: userId, name: userId, email: `${userId}@example.com`, role, company: '', siret: '', employerCompany: '', employerSiret: '', projectIds, avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

test('a pre-existing project with no ownerId is migrated to its creating owner at startup, not left unreachable', async () => {
	const response = await get('/api/projects/proj-legacy/financial-summary', tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200, 'owner-a created this legacy project (by name match) and must still be able to open it after the migration');
});

test('GET /api/projects only lists the caller\'s own company\'s chantiers', async () => {
	const asA = await get('/api/projects', tokenFor('owner-a', 'gerant'));
	assert.ok(asA.body.some((p) => p.id === 'proj-a'));
	assert.ok(!asA.body.some((p) => p.id === 'proj-b'), 'owner-a must never see company B\'s chantier in the list');
});

test('owner B cannot read owner A\'s project financial summary', async () => {
	const response = await get('/api/projects/proj-a/financial-summary', tokenFor('owner-b', 'gerant'));
	assert.equal(response.status, 403);
});

test('owner B cannot read owner A\'s project document list access (canAccessProject gate)', async () => {
	const response = await get('/api/projects/proj-a/evidence-summary', tokenFor('owner-b', 'gerant'));
	assert.equal(response.status, 403);
});

test('a worker assigned to company A\'s project cannot be reached by company B\'s owner at all', async () => {
	const response = await get('/api/projects/proj-a/chantier-controls', tokenFor('owner-b', 'gerant'));
	assert.equal(response.status, 403);
});

test('GET /api/users only lists the caller\'s own company\'s people', async () => {
	const asA = await get('/api/users', tokenFor('owner-a', 'gerant'));
	assert.ok(asA.body.some((u) => u.id === 'worker-a'));
	assert.ok(!asA.body.some((u) => u.id === 'owner-b'), 'owner-a must never see company B\'s users');
});

test('owner B cannot edit owner A\'s worker', async () => {
	const response = await call('PATCH', '/api/users/worker-a', tokenFor('owner-b', 'gerant'), { name: 'Hijacked' });
	assert.equal(response.status, 403);
});

test('owner B cannot trigger a password reset for owner A\'s worker', async () => {
	const response = await call('POST', '/api/users/worker-a/password-reset', tokenFor('owner-b', 'gerant'), {});
	assert.equal(response.status, 403);
});

test('owner B cannot delete owner A\'s worker', async () => {
	const response = await call('DELETE', '/api/users/worker-a', tokenFor('owner-b', 'gerant'));
	assert.equal(response.status, 403);
});

test('creating a new chantier only adds it to the creating company\'s own owners, not every company', async () => {
	const created = await call('POST', '/api/projects', tokenFor('owner-a', 'gerant'), { name: 'Nouveau Chantier A2' });
	assert.equal(created.status, 201);
	const usersAfter = await get('/api/users', tokenFor('owner-a', 'gerant'));
	// owner-a itself is not returned by GET /api/users (it lists others), so check via the project list instead.
	const projectsForB = await get('/api/projects', tokenFor('owner-b', 'gerant'));
	assert.ok(!projectsForB.body.some((p) => p.id === created.body.id), 'company B must never see company A\'s brand-new chantier either');
	assert.ok(usersAfter.body.every((u) => u.id !== 'owner-b'));
});

test('owner B cannot change the progress percentage of owner A\'s chantier', async () => {
	const response = await call('PATCH', '/api/projects/proj-a/progress', tokenFor('owner-b', 'gerant'), { progress: 99 });
	assert.equal(response.status, 403);
});

test('owner B cannot rename, copy, or delete owner A\'s document', async () => {
	const rename = await call('PATCH', '/api/documents/doc-a', tokenFor('owner-b', 'gerant'), { name: 'Hijacked.pdf' });
	assert.equal(rename.status, 403);
	const copy = await call('POST', '/api/documents/doc-a/copy', tokenFor('owner-b', 'gerant'));
	assert.equal(copy.status, 403);
	const del = await call('DELETE', '/api/documents/doc-a', tokenFor('owner-b', 'gerant'));
	assert.equal(del.status, 403);
});

test('owner B cannot update a chantier-control that belongs to owner A\'s chantier', async () => {
	const response = await call('PATCH', '/api/chantier-controls/control-a', tokenFor('owner-b', 'gerant'), { status: 'complete' });
	assert.equal(response.status, 403);
});

test('owner B cannot approve or reject owner A\'s worker\'s time entry', async () => {
	const response = await call('PATCH', '/api/time-entries/time-a/status', tokenFor('owner-b', 'gerant'), { status: 'approved' });
	assert.equal(response.status, 403);
});

test('owner B cannot delete owner A\'s worker\'s rendezvous', async () => {
	const response = await call('DELETE', '/api/rendezvous/rdv-a', tokenFor('owner-b', 'gerant'));
	assert.equal(response.status, 403);
});

test('owner B cannot mark owner A\'s worker\'s payout as paid', async () => {
	const response = await call('POST', '/api/payout-requests/mark-paid', tokenFor('owner-b', 'gerant'), { userId: 'worker-a', month: '2026-01' });
	assert.equal(response.status, 403);
});

test('payroll summary only includes the caller\'s own company\'s people', async () => {
	const response = await get('/api/payroll/summary?month=2026-01', tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	assert.ok(response.body.summary.some((item) => item.userId === 'worker-a'));
	assert.ok(!response.body.summary.some((item) => item.userId === 'owner-b'));
});

test('owner A can still delete owner A\'s own chantier (no false positive from the new check)', async () => {
	const response = await call('DELETE', '/api/projects/proj-a-doomed', tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	assert.equal(response.body.removed, true);
});
