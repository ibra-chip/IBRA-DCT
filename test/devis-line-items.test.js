// Devis line items feed two features that both depend on being scoped to exactly the right chantier:
// the plan-measure tool's "Ajouter au devis" buttons, and the discrepancy check that warns when adding
// a plan measurement contradicts an existing line (the real case this protects: a small firm acting as
// a subcontractor verifying a prime contractor's devis against the real plan, since under-quoting
// m2/ml/unite is a way to shortchange a subcontractor). Mixing chantiers here would either hide a real
// discrepancy or raise a false one against the wrong site entirely - so this proves the server-side
// projectId scoping holds for both same-company cross-chantier and cross-company access.
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
	const body = payload !== undefined ? Buffer.from(JSON.stringify(payload)) : null;
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
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-line-items-test-'));
	const seed = {
		users: [
			{ id: 'owner-a', name: 'Owner A', email: 'ownera@example.com', role: 'gerant', siret: '111111111', company: 'Company A', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
			{ id: 'owner-b', name: 'Owner B', email: 'ownerb@example.com', role: 'gerant', siret: '222222222', company: 'Company B', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
		],
		projects: [
			{ id: 'proj-a1', name: 'Chantier A1', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() },
			{ id: 'proj-a2', name: 'Chantier A2', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() },
		],
		documents: [], devisLineItems: [],
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

const tokenFor = (userId, role) => jwt.sign({ sub: userId, name: userId, email: `${userId}@example.com`, role, company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: [], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

test('a line item created for one chantier never appears when listing a different chantier of the same company', async () => {
	const created = await call('POST', '/api/projects/proj-a1/budget/line-items', tokenFor('owner-a', 'gerant'), { items: [{ description: 'Mur pignon', quantity: 38, unit: 'm²', unitPrice: 50, lineTotal: 1900, category: 'Devis' }] });
	assert.equal(created.status, 201);

	const sameProject = await get('/api/projects/proj-a1/budget/line-items', tokenFor('owner-a', 'gerant'));
	assert.equal(sameProject.status, 200);
	assert.ok(sameProject.body.some((item) => item.description === 'Mur pignon'));

	const otherProject = await get('/api/projects/proj-a2/budget/line-items', tokenFor('owner-a', 'gerant'));
	assert.equal(otherProject.status, 200);
	assert.equal(otherProject.body.length, 0, 'Chantier A2 must never see Chantier A1 devis lines');
});

test('owner B (a different company) cannot read or create line items on owner A\'s chantier', async () => {
	const readAttempt = await get('/api/projects/proj-a1/budget/line-items', tokenFor('owner-b', 'gerant'));
	assert.equal(readAttempt.status, 403);
	const writeAttempt = await call('POST', '/api/projects/proj-a1/budget/line-items', tokenFor('owner-b', 'gerant'), { items: [{ description: 'Intrusion', quantity: 1, unit: 'm²' }] });
	assert.equal(writeAttempt.status, 403);
});

test('source defaults to "manual" when absent or not a recognized value', async () => {
	const noSource = await call('POST', '/api/projects/proj-a2/budget/line-items', tokenFor('owner-a', 'gerant'), { items: [{ description: 'Ligne A', quantity: 1, unit: 'm²' }] });
	assert.equal(noSource.body[0].source, 'manual');
	const junkSource = await call('POST', '/api/projects/proj-a2/budget/line-items', tokenFor('owner-a', 'gerant'), { items: [{ description: 'Ligne B', quantity: 1, unit: 'm²' }], source: 'not-a-real-source' });
	assert.equal(junkSource.body[0].source, 'manual');
});

test('source is stored exactly as given for excel, ai, and plan-measure', async () => {
	const excel = await call('POST', '/api/projects/proj-a2/budget/line-items', tokenFor('owner-a', 'gerant'), { items: [{ description: 'Ligne Excel', quantity: 1, unit: 'm²' }], source: 'excel' });
	assert.equal(excel.body[0].source, 'excel');
	const ai = await call('POST', '/api/projects/proj-a2/budget/line-items', tokenFor('owner-a', 'gerant'), { items: [{ description: 'Ligne IA', quantity: 1, unit: 'm²' }], source: 'ai' });
	assert.equal(ai.body[0].source, 'ai');
	const planMeasure = await call('POST', '/api/projects/proj-a2/budget/line-items', tokenFor('owner-a', 'gerant'), { items: [{ description: 'Ligne Plan', quantity: 1, unit: 'm²' }], source: 'plan-measure' });
	assert.equal(planMeasure.body[0].source, 'plan-measure');
});

test('all items in one batch POST share the same source - a mixed-source batch is never silently split', async () => {
	const response = await call('POST', '/api/projects/proj-a1/budget/line-items', tokenFor('owner-a', 'gerant'), { items: [{ description: 'Ligne 1', quantity: 1, unit: 'm²' }, { description: 'Ligne 2', quantity: 2, unit: 'm²' }], source: 'excel' });
	assert.equal(response.status, 201);
	assert.ok(response.body.every((item) => item.source === 'excel'));
});
