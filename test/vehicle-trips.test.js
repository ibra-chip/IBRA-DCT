// End-to-end: Carnet de bord (vehicles + vehicle trips). Proves the same cross-company isolation the
// rest of the app relies on (see tenant-isolation.test.js) also holds for these brand-new routes, that
// a trip's distance is always recomputed server-side from startKm/endKm (never trusted from the client,
// same principle as the plan measurement tool), and that basic validation rejects an impossible trip.
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
const port = 9800 + Math.floor(Math.random() * 100);
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
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-vehicle-test-'));
	const seed = {
		users: [
			{ id: 'owner-a', name: 'Owner A', email: 'ownera@example.com', role: 'gerant', siret: '111111111', company: 'Company A', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: '2026-01-01T00:00:00.000Z' },
			{ id: 'owner-b', name: 'Owner B', email: 'ownerb@example.com', role: 'gerant', siret: '222222222', company: 'Company B', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: '2026-01-02T00:00:00.000Z' },
		],
		projects: [
			{ id: 'proj-a', name: 'Chantier A', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() },
			{ id: 'proj-b', name: 'Chantier B', location: '', progress: 0, status: 'active', manager: 'Owner B', ownerId: 'owner-b', createdAt: new Date().toISOString() },
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

let vehicleAId;

test('owner A can create a vehicle', async () => {
	const response = await call('POST', '/api/vehicles', tokenFor('owner-a', 'gerant'), { name: 'Camionnette TASH', plate: 'AB-123-CD' });
	assert.equal(response.status, 201);
	assert.equal(response.body.name, 'Camionnette TASH');
	vehicleAId = response.body.id;
});

test('owner B never sees owner A\'s vehicle in the list', async () => {
	const response = await get('/api/vehicles', tokenFor('owner-b', 'gerant'));
	assert.equal(response.status, 200);
	assert.ok(!response.body.some((item) => item.id === vehicleAId), 'company B must never see company A\'s vehicle');
});

test('owner B cannot delete owner A\'s vehicle', async () => {
	const response = await call('DELETE', `/api/vehicles/${vehicleAId}`, tokenFor('owner-b', 'gerant'));
	assert.equal(response.status, 403);
});

test('distance is always recomputed server-side from startKm/endKm, never trusted from the client', async () => {
	const response = await call('POST', '/api/vehicle-trips', tokenFor('owner-a', 'gerant'), { vehicleId: vehicleAId, projectId: 'proj-a', type: 'professionnel', date: '2026-03-01', startKm: 1000, endKm: 1042.5, distanceKm: 999999, note: 'Livraison' });
	assert.equal(response.status, 201);
	assert.equal(response.body.distanceKm, 42.5, 'the client-sent distanceKm (999999) must be ignored - only startKm/endKm are trusted');
});

test('a trip with endKm not greater than startKm is rejected', async () => {
	const response = await call('POST', '/api/vehicle-trips', tokenFor('owner-a', 'gerant'), { vehicleId: vehicleAId, projectId: 'proj-a', type: 'professionnel', date: '2026-03-01', startKm: 100, endKm: 100 });
	assert.equal(response.status, 400);
});

test('owner A cannot log a trip against owner B\'s chantier', async () => {
	const response = await call('POST', '/api/vehicle-trips', tokenFor('owner-a', 'gerant'), { vehicleId: vehicleAId, projectId: 'proj-b', type: 'professionnel', date: '2026-03-01', startKm: 0, endKm: 10 });
	assert.equal(response.status, 403);
});

test('owner B never sees owner A\'s trip in the list, and cannot delete it', async () => {
	const list = await get('/api/vehicle-trips', tokenFor('owner-b', 'gerant'));
	assert.equal(list.status, 200);
	assert.equal(list.body.length, 0, 'company B must never see company A\'s trips');
	const all = await get('/api/vehicle-trips', tokenFor('owner-a', 'gerant'));
	const tripId = all.body[0].id;
	const del = await call('DELETE', `/api/vehicle-trips/${tripId}`, tokenFor('owner-b', 'gerant'));
	assert.equal(del.status, 403);
});

test('deleting a vehicle cascades to remove its trips too', async () => {
	const before = await get('/api/vehicle-trips', tokenFor('owner-a', 'gerant'));
	assert.ok(before.body.length > 0);
	const del = await call('DELETE', `/api/vehicles/${vehicleAId}`, tokenFor('owner-a', 'gerant'));
	assert.equal(del.status, 200);
	const after = await get('/api/vehicle-trips', tokenFor('owner-a', 'gerant'));
	assert.equal(after.body.length, 0, 'trips referencing the deleted vehicle must not survive it');
});
