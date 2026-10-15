// Re-uploading the exact same photo/plan, or billing the same invoice number twice, used to go in
// silently with zero signal to the owner. Flags it instead (never auto-deletes: a wrong guess deleting
// real evidence is worse than a stray warning) via duplicateOfId on the new record, computed from a
// SHA-256 of the original upload bytes (documents) or the invoice number first, file hash as fallback
// (factures, since the same invoice number billed twice is the real-world duplicate to catch even if the
// PDF itself differs slightly).
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
const port = 9500 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir, provider;

function fakeProvider() {
	const files = new Map();
	const server = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const body = Buffer.concat(chunks);
			const [pathname] = request.url.split('?');
			const key = decodeURIComponent(pathname.replace(/^\/ibra-ba-dup-test\//, ''));
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
	const boundary = `----ibraBaDupTestBoundary${Date.now()}`;
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
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-dup-test-'));
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
			STORAGE_POOL: 'b2', B2_ENDPOINT: `http://127.0.0.1:${provider.port}`, B2_REGION: 'eu', B2_KEY_ID: 'testkey', B2_SECRET: 'testsecret', B2_BUCKET: 'ibra-ba-dup-test',
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

test('uploading the exact same photo twice to the same chantier flags the second as a duplicate', async () => {
	const bytes = Buffer.from('same-photo-bytes-xyz');
	const first = await postMultipart('/api/documents/upload', token(), { projectId: 'proj-1', evidenceType: 'photo-during' }, { field: 'file', filename: 'site.jpg', contentType: 'image/jpeg', buffer: bytes });
	assert.equal(first.status, 201);
	assert.equal(first.body.duplicateOfId, null);

	const second = await postMultipart('/api/documents/upload', token(), { projectId: 'proj-1', evidenceType: 'photo-during' }, { field: 'file', filename: 'site-copy.jpg', contentType: 'image/jpeg', buffer: bytes });
	assert.equal(second.status, 201);
	assert.equal(second.body.duplicateOfId, first.body.id, 'identical bytes re-uploaded to the same chantier must be flagged against the original');
	assert.equal(second.body.duplicateOfName, 'site.jpg');
});

test('uploading a genuinely different photo is never flagged', async () => {
	const result = await postMultipart('/api/documents/upload', token(), { projectId: 'proj-1', evidenceType: 'photo-before' }, { field: 'file', filename: 'other.jpg', contentType: 'image/jpeg', buffer: Buffer.from('totally-different-bytes') });
	assert.equal(result.status, 201);
	assert.equal(result.body.duplicateOfId, null);
});

test('billing the same invoice number twice on the same chantier is flagged even with a different PDF', async () => {
	const first = await postMultipart('/api/projects/proj-1/factures', token(), { invoiceNumber: 'FAC-001', clientName: 'Client A', amount: '500' }, { field: 'file', filename: 'fac1.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 version one') });
	assert.equal(first.status, 201);
	assert.equal(first.body.duplicateOfId, null);

	const second = await postMultipart('/api/projects/proj-1/factures', token(), { invoiceNumber: 'FAC-001', clientName: 'Client A', amount: '500' }, { field: 'file', filename: 'fac1-rescanned.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 a different scan of the same invoice') });
	assert.equal(second.status, 201);
	assert.equal(second.body.duplicateOfId, first.body.id, 'the same invoice number billed again must be flagged, even though the file bytes differ');
});

test('two different invoice numbers on the same chantier are never flagged against each other', async () => {
	const result = await postMultipart('/api/projects/proj-1/factures', token(), { invoiceNumber: 'FAC-999', clientName: 'Client B', amount: '750' }, { field: 'file', filename: 'fac2.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 unrelated invoice') });
	assert.equal(result.status, 201);
	assert.equal(result.body.duplicateOfId, null);
});
