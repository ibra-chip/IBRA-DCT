// Plans, devis and factures used to require a real PDF everywhere a file was accepted, even though a
// phone photo of a paper plan/devis/facture (never scanned to PDF) is the common real case, and the
// Gemini-vision analysis/inspection paths already read an image buffer exactly as well as a PDF buffer
// (same inlineData mechanism, just a different mimeType). The PDF-only gate at the door was the only
// thing actually blocking that case — this proves it's gone, for both the /inspect preview routes and
// the real save routes (/documents/upload with evidenceType=plan, and /projects/:id/budget).
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
let child, dataDir, provider;

function fakeProvider() {
	const files = new Map();
	const server = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const body = Buffer.concat(chunks);
			const [pathname] = request.url.split('?');
			const key = decodeURIComponent(pathname.replace(/^\/ibra-ba-photo-test\//, ''));
			if (request.method === 'PUT') { files.set(key, body); return response.end(); }
			if (request.method === 'DELETE') { files.delete(key); return response.end(); }
			const file = files.get(key);
			if (!file) { response.statusCode = 404; return response.end(); }
			if (request.method === 'HEAD') { response.statusCode = 200; return response.end(); }
			response.end(file);
		});
	});
	return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

function postMultipart(requestPath, token, fields, filePart) {
	const boundary = `----ibraBaPhotoTestBoundary${Date.now()}`;
	const parts = [];
	for (const [name, value] of Object.entries(fields)) {
		parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
	}
	if (filePart) {
		parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${filePart.field}"; filename="${filePart.filename}"\r\nContent-Type: ${filePart.contentType}\r\n\r\n`));
		parts.push(filePart.buffer);
		parts.push(Buffer.from('\r\n'));
	}
	parts.push(Buffer.from(`--${boundary}--\r\n`));
	const body = Buffer.concat(parts);
	return new Promise((resolve, reject) => {
		const request = http.request({
			host: '127.0.0.1', port, path: requestPath, method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
		}, (response) => {
			let data = '';
			response.on('data', (chunk) => (data += chunk));
			response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(data || '{}') }));
		});
		request.on('error', reject);
		request.end(body);
	});
}

const get = (requestPath) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path: requestPath }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body }));
	}).on('error', reject);
});

before(async () => {
	provider = await fakeProvider();
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-photo-test-'));
	const seed = {
		users: [{ id: 'owner-1', name: 'Owner', email: 'owner@example.com', role: 'gerant', siret: '111111111', company: 'Company', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() }],
		projects: [{ id: 'proj-1', name: 'Chantier Test', location: '', progress: 0, status: 'active', manager: 'Owner', ownerId: 'owner-1', createdAt: new Date().toISOString() }],
		documents: [],
		factures: [],
	};
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));
	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: {
			...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir,
			SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '', GOOGLE_AI_API_KEY: '', OPENAI_API_KEY: '',
			STORAGE_POOL: 'b2', B2_ENDPOINT: `http://127.0.0.1:${provider.port}`, B2_REGION: 'eu', B2_KEY_ID: 'testkey', B2_SECRET: 'testsecret', B2_BUCKET: 'ibra-ba-photo-test',
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

const token = () => jwt.sign({ sub: 'owner-1', name: 'Owner', email: 'owner@example.com', role: 'gerant', company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: [], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

test('/api/documents/upload accepts a photographed plan (carnet de détail), not only a PDF', async () => {
	const result = await postMultipart('/api/documents/upload', token(), { projectId: 'proj-1', evidenceType: 'plan' }, { field: 'file', filename: 'carnet-detail.jpg', contentType: 'image/jpeg', buffer: Buffer.from('fake-plan-photo-bytes') });
	assert.equal(result.status, 201, `expected the plan photo to be accepted, got ${result.status}: ${JSON.stringify(result.body)}`);
	assert.equal(result.body.evidenceType, 'plan');
});

test('/api/documents/upload still accepts a real PDF plan as before', async () => {
	const result = await postMultipart('/api/documents/upload', token(), { projectId: 'proj-1', evidenceType: 'plan' }, { field: 'file', filename: 'plan.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake plan pdf') });
	assert.equal(result.status, 201);
});

test('/api/documents/upload still rejects a plan upload with no file', async () => {
	const result = await postMultipart('/api/documents/upload', token(), { projectId: 'proj-1', evidenceType: 'plan' }, null);
	assert.equal(result.status, 400);
});

test('/api/budget/inspect accepts a photographed devis instead of requiring a PDF', async () => {
	const result = await postMultipart('/api/budget/inspect', token(), {}, { field: 'file', filename: 'devis-photo.jpg', contentType: 'image/jpeg', buffer: Buffer.from('fake-devis-photo-bytes') });
	assert.equal(result.status, 200, `expected the devis photo to be accepted, got ${result.status}: ${JSON.stringify(result.body)}`);
	assert.equal(result.body.textFound, false, 'a photo has no PDF text layer, so textFound must stay false (no crash attempting to parse it as a PDF)');
});

test('/api/factures/inspect accepts a photographed facture instead of requiring a PDF', async () => {
	const result = await postMultipart('/api/factures/inspect', token(), {}, { field: 'file', filename: 'facture-photo.png', contentType: 'image/png', buffer: Buffer.from('fake-facture-photo-bytes') });
	assert.equal(result.status, 200, `expected the facture photo to be accepted, got ${result.status}: ${JSON.stringify(result.body)}`);
});

test('/api/projects/:id/budget saves a photographed devis as the source file', async () => {
	const result = await postMultipart('/api/projects/proj-1/budget', token(), { devisNumber: 'DEV-1', client: 'Client Test', chantierName: 'Chantier Test', total: '1000' }, { field: 'file', filename: 'devis-photo.jpg', contentType: 'image/jpeg', buffer: Buffer.from('fake-devis-photo-bytes-save') });
	assert.equal(result.status, 201, `expected the devis photo save to succeed, got ${result.status}: ${JSON.stringify(result.body)}`);
	assert.match(result.body.sourceFile, /devis-photo\.jpg$/);
});
