// End-to-end: factures and purchases could be created but never removed - no DELETE route existed for
// either, so a data-entry mistake (wrong amount, wrong client) was permanent. Proves the new routes
// actually remove the record (and stay access-controlled the same way the rest of the API is).
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
const port = 9600 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir;

const get = (requestPath, token) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path: requestPath, headers: token ? { Authorization: `Bearer ${token}` } : {} }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body || '{}') }));
	}).on('error', reject);
});

const del = (requestPath, token) => new Promise((resolve, reject) => {
	const request = http.request({ host: '127.0.0.1', port, path: requestPath, method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body || '{}') }));
	});
	request.on('error', reject);
	request.end();
});

before(async () => {
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-delete-test-'));
	const ownerId = 'user-owner';
	const otherOwnerId = 'user-other-owner';
	const seed = {
		users: [
			{ id: ownerId, name: 'Owner', email: 'owner@example.com', role: 'gerant', passwordHash: 'unused', projectIds: ['proj-1'], dailyRate: 0, hourlyRate: 0 },
			{ id: otherOwnerId, name: 'Other Owner', email: 'other@example.com', role: 'gerant', passwordHash: 'unused', projectIds: ['proj-2'], dailyRate: 0, hourlyRate: 0 },
		],
		projects: [
			{ id: 'proj-1', name: 'Project One', location: '', progress: 0, status: 'active', manager: 'Owner' },
			{ id: 'proj-2', name: 'Project Two', location: '', progress: 0, status: 'active', manager: 'Other Owner' },
		],
		factures: [{ id: 'facture-1', projectId: 'proj-1', invoiceNumber: 'FAC-1', clientName: 'Client', clientEmail: '', amount: 100, issuedDate: '2026-01-01', dueDate: '2026-02-01', status: 'pending', paidAt: null, lastRelanceAt: null, sourceFile: null, sourceName: '', createdBy: ownerId, createdAt: new Date().toISOString() }],
		purchases: [{ id: 'purchase-1', projectId: 'proj-1', projectName: 'Project One', category: 'material', supplier: 'Supplier', description: 'Cement', amount: 50, purchaseDate: '2026-01-01', invoiceFile: null, invoiceName: '', createdBy: ownerId, createdAt: new Date().toISOString() }],
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

const tokenFor = (userId, role, projectIds) => jwt.sign({ sub: userId, name: 'Test', email: 'test@example.com', role, company: '', siret: '', employerCompany: '', employerSiret: '', projectIds, avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

test('a manager from a different company cannot delete someone else\'s facture', async () => {
	const response = await del('/api/factures/facture-1', tokenFor('user-other-owner', 'gerant', ['proj-2']));
	assert.equal(response.status, 403);
});

test('deleting a facture actually removes it', async () => {
	const response = await del('/api/factures/facture-1', tokenFor('user-owner', 'gerant', ['proj-1']));
	assert.equal(response.status, 200);
	assert.equal(response.body.deleted, true);
	const list = await get('/api/projects/proj-1/factures', tokenFor('user-owner', 'gerant', ['proj-1']));
	assert.equal(list.body.length, 0);
});

test('deleting an already-deleted facture 404s instead of silently succeeding', async () => {
	const response = await del('/api/factures/facture-1', tokenFor('user-owner', 'gerant', ['proj-1']));
	assert.equal(response.status, 404);
});

test('a manager from a different company cannot delete someone else\'s purchase', async () => {
	const response = await del('/api/purchases/purchase-1', tokenFor('user-other-owner', 'gerant', ['proj-2']));
	assert.equal(response.status, 403);
});

test('deleting a purchase actually removes it', async () => {
	const response = await del('/api/purchases/purchase-1', tokenFor('user-owner', 'gerant', ['proj-1']));
	assert.equal(response.status, 200);
	assert.equal(response.body.deleted, true);
	const list = await get('/api/purchases', tokenFor('user-owner', 'gerant', ['proj-1']));
	assert.equal(list.body.length, 0);
});
