// GET /api/attention-items aggregates three things that already exist and are already trusted
// elsewhere - overdue factures (factureColorStatus), devis lines missing a price (unitPrice), and
// AI-read devis lines nobody has touched since (source + editedAt) - into one cross-chantier view, so a
// gerant doesn't have to open every chantier's Factures/Devis tab one by one to notice something is
// waiting. Nothing new is tracked or guessed here; this only proves the aggregation and its scoping.
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
const port = 10100 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir;

const get = (requestPath, token) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path: requestPath, headers: { Authorization: `Bearer ${token}` } }, (response) => {
		let data = '';
		response.on('data', (chunk) => (data += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(data || '{}') }));
	}).on('error', reject);
});

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

before(async () => {
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-attention-test-'));
	const seed = {
		users: [
			{ id: 'owner-a', name: 'Owner A', email: 'ownera@example.com', role: 'gerant', siret: '111111111', company: 'Company A', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
			{ id: 'owner-b', name: 'Owner B', email: 'ownerb@example.com', role: 'gerant', siret: '222222222', company: 'Company B', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
			{ id: 'worker-a', name: 'Worker A', email: 'workera@example.com', role: 'worker', siret: '', company: '', employerSiret: '111111111', employerCompany: 'Company A', passwordHash: 'unused', projectIds: ['proj-a1'], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
		],
		projects: [
			{ id: 'proj-a1', name: 'Chantier A1', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() },
			{ id: 'proj-a2', name: 'Chantier A2', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() },
			{ id: 'proj-b1', name: 'Chantier B1', location: '', progress: 0, status: 'active', manager: 'Owner B', ownerId: 'owner-b', createdAt: new Date().toISOString() },
		],
		factures: [
			// 45 days overdue (dueDate 45 days ago, unpaid) -> red/overdue, must appear for owner A.
			{ id: 'facture-overdue', projectId: 'proj-a1', clientName: 'Client Retard', invoiceNumber: 'F-001', amount: 1500, status: 'pending', issuedDate: daysAgo(80), dueDate: daysAgo(45), paidAt: null },
			// Only 10 days overdue -> orange, not red, must NOT appear.
			{ id: 'facture-recent', projectId: 'proj-a1', clientName: 'Client Recent', invoiceNumber: 'F-002', amount: 500, status: 'pending', issuedDate: daysAgo(40), dueDate: daysAgo(10), paidAt: null },
			// 60 days overdue but already paid -> green, must NOT appear.
			{ id: 'facture-paid', projectId: 'proj-a2', clientName: 'Client Paye', invoiceNumber: 'F-003', amount: 800, status: 'paid', issuedDate: daysAgo(90), dueDate: daysAgo(60), paidAt: daysAgo(5) },
			// Owner B's own overdue facture - must never appear for owner A.
			{ id: 'facture-b-overdue', projectId: 'proj-b1', clientName: 'Client B', invoiceNumber: 'F-B01', amount: 999, status: 'pending', issuedDate: daysAgo(80), dueDate: daysAgo(45), paidAt: null },
		],
		devisLineItems: [
			{ id: 'item-unpriced', projectId: 'proj-a1', description: 'Isolation sans prix', quantity: 10, unit: 'm²', unitPrice: 0, lineTotal: 0, category: 'Devis', source: 'manual', createdAt: new Date().toISOString() },
			{ id: 'item-priced', projectId: 'proj-a1', description: 'Isolation avec prix', quantity: 10, unit: 'm²', unitPrice: 50, lineTotal: 500, category: 'Devis', source: 'manual', createdAt: new Date().toISOString() },
			{ id: 'item-ai-unverified', projectId: 'proj-a2', description: 'Fenetre lue par IA', quantity: 3, unit: 'unité', unitPrice: 200, lineTotal: 600, category: 'Devis', source: 'ai', editedAt: null, createdAt: new Date().toISOString() },
			{ id: 'item-ai-verified', projectId: 'proj-a2', description: 'Porte lue par IA mais verifiee', quantity: 1, unit: 'unité', unitPrice: 300, lineTotal: 300, category: 'Devis', source: 'ai', editedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
			{ id: 'item-b-ai-unverified', projectId: 'proj-b1', description: 'Stavka B lue par IA', quantity: 1, unit: 'm²', unitPrice: 100, lineTotal: 100, category: 'Devis', source: 'ai', editedAt: null, createdAt: new Date().toISOString() },
		],
		documents: [], timeEntries: [], chantierControls: [], budgets: [], planMeasurements: [],
		rendezvous: [], payouts: [], tasks: [], personalDocuments: [], notifications: [], messages: [],
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

const tokenFor = (userId, role) => jwt.sign({ sub: userId, name: userId, email: `${userId}@example.com`, role, company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: userId === 'worker-a' ? ['proj-a1'] : [], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

test('overdueFactures includes only the 30+ day unpaid one, not the recent or paid ones', async () => {
	const response = await get('/api/attention-items', tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	assert.equal(response.body.overdueFactures.length, 1);
	assert.equal(response.body.overdueFactures[0].id, 'facture-overdue');
	assert.equal(response.body.overdueFactures[0].projectName, 'Chantier A1');
	assert.ok(response.body.overdueFactures[0].daysOverdue >= 45);
});

test('unpricedLineItems includes only the unitPrice: 0 line, not the priced one', async () => {
	const response = await get('/api/attention-items', tokenFor('owner-a', 'gerant'));
	assert.equal(response.body.unpricedLineItems.length, 1);
	assert.equal(response.body.unpricedLineItems[0].id, 'item-unpriced');
});

test('unverifiedAiLineItems includes only the AI-sourced line with no editedAt, not the one already touched by a human', async () => {
	const response = await get('/api/attention-items', tokenFor('owner-a', 'gerant'));
	assert.equal(response.body.unverifiedAiLineItems.length, 1);
	assert.equal(response.body.unverifiedAiLineItems[0].id, 'item-ai-unverified');
});

test('every category is scoped to the caller\'s own company across ALL its chantiers, never another company\'s', async () => {
	const forA = await get('/api/attention-items', tokenFor('owner-a', 'gerant'));
	assert.ok(!forA.body.overdueFactures.some((item) => item.id === 'facture-b-overdue'));
	assert.ok(!forA.body.unverifiedAiLineItems.some((item) => item.id === 'item-b-ai-unverified'));

	const forB = await get('/api/attention-items', tokenFor('owner-b', 'gerant'));
	assert.equal(forB.body.overdueFactures.length, 1);
	assert.equal(forB.body.overdueFactures[0].id, 'facture-b-overdue');
	assert.equal(forB.body.unverifiedAiLineItems.length, 1);
	assert.equal(forB.body.unverifiedAiLineItems[0].id, 'item-b-ai-unverified');
	assert.ok(!forB.body.overdueFactures.some((item) => item.id === 'facture-overdue'), 'owner B must never see owner A\'s overdue facture');
});

test('a worker (non-manager role) cannot read the attention items - prices and client data are gerant-only', async () => {
	const response = await get('/api/attention-items', tokenFor('worker-a', 'worker'));
	assert.equal(response.status, 403);
});
