// A facture 30+ days past its due date should be flagged red (already existed) and should trigger
// exactly one notification the first time it's seen that way, never a repeat on later reads. There was
// no automatic notification path before this: colorStatus was only ever computed on the fly for display,
// so an owner who didn't happen to reopen that chantier's factures tab would never be told a client
// invoice had gone overdue. Verified against the persisted notifiedOverdueAt flag rather than the push
// payload itself, since push is disabled in tests (no VAPID keys) and the flag is what makes the repeat
// read a no-op.
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
const port = 9900 + Math.floor(Math.random() * 100);
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
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-facture-overdue-test-'));
	const longAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	const recentDue = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	const seed = {
		users: [{ id: 'owner-a', name: 'Owner A', email: 'ownera@example.com', role: 'gerant', siret: '111111111', company: 'Company A', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: '2026-01-01T00:00:00.000Z' }],
		projects: [{ id: 'proj-a', name: 'Chantier A', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() }],
		factures: [
			{ id: 'facture-overdue', projectId: 'proj-a', invoiceNumber: 'F-1', clientName: 'Client Retard', clientEmail: '', amount: 1000, issuedDate: longAgo, dueDate: longAgo, status: 'pending', paidAt: null, lastRelanceAt: null, notifiedOverdueAt: null, createdBy: 'owner-a', createdAt: new Date().toISOString() },
			{ id: 'facture-not-yet-overdue', projectId: 'proj-a', invoiceNumber: 'F-2', clientName: 'Client OK', clientEmail: '', amount: 500, issuedDate: recentDue, dueDate: recentDue, status: 'pending', paidAt: null, lastRelanceAt: null, notifiedOverdueAt: null, createdBy: 'owner-a', createdAt: new Date().toISOString() },
		],
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

const tokenFor = (userId, role) => jwt.sign({ sub: userId, name: userId, email: `${userId}@example.com`, role, company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: [], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

const readFacture = async (id) => {
	const raw = JSON.parse(await fs.readFile(path.join(dataDir, 'data.json'), 'utf8'));
	return raw.factures.find((item) => item.id === id);
};

test('a facture 30+ days past due is colored red and gets notified exactly once', async () => {
	const response = await get('/api/projects/proj-a/factures', tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	const overdue = response.body.find((item) => item.id === 'facture-overdue');
	const notYet = response.body.find((item) => item.id === 'facture-not-yet-overdue');
	assert.equal(overdue.colorStatus, 'red');
	assert.equal(notYet.colorStatus, 'orange');

	await new Promise((resolve) => setTimeout(resolve, 400));
	const afterFirstRead = await readFacture('facture-overdue');
	assert.ok(afterFirstRead.notifiedOverdueAt, 'the first read past the 30-day mark should record a notification timestamp');

	await get('/api/projects/proj-a/factures', tokenFor('owner-a', 'gerant'));
	await new Promise((resolve) => setTimeout(resolve, 400));
	const afterSecondRead = await readFacture('facture-overdue');
	assert.equal(afterSecondRead.notifiedOverdueAt, afterFirstRead.notifiedOverdueAt, 'reopening the tab again must not re-trigger a second notification');

	const stillNotYet = await readFacture('facture-not-yet-overdue');
	assert.equal(stillNotYet.notifiedOverdueAt, null, 'a facture that is not yet 30 days overdue must never be flagged as notified');
});
