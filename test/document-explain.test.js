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
import { PDFDocument, StandardFonts } from 'pdf-lib';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 9400 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir, provider;

function fakeProvider() {
	const files = new Map();
	const server = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const body = Buffer.concat(chunks);
			const [pathname] = request.url.split('?');
			const key = decodeURIComponent(pathname.replace(/^\/ibra-ba-explain-test\//, ''));
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
	const boundary = `----ibraBaExplainTestBoundary${Date.now()}`;
	const parts = [];
	for (const [name, value] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
	if (filePart) {
		parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${filePart.field}"; filename="${filePart.filename}"\r\nContent-Type: ${filePart.contentType}\r\n\r\n`));
		parts.push(filePart.buffer);
		parts.push(Buffer.from('\r\n'));
	}
	parts.push(Buffer.from(`--${boundary}--\r\n`));
	const body = Buffer.concat(parts);
	return new Promise((resolve, reject) => {
		const request = http.request({ host: '127.0.0.1', port, path: requestPath, method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length } }, (response) => {
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
	provider = await fakeProvider();
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
		env: {
			...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir,
			SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '', GOOGLE_AI_API_KEY: '',
			STORAGE_POOL: 'b2', B2_ENDPOINT: `http://127.0.0.1:${provider.port}`, B2_REGION: 'eu', B2_KEY_ID: 'testkey', B2_SECRET: 'testsecret', B2_BUCKET: 'ibra-ba-explain-test',
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
	assert.deepEqual(response.body.textCallouts, [], 'doc-plan has no real file in storage, so the best-effort callout read must degrade to empty, not fail the request');
});

test('explain reads real technical callouts straight off a PDF text layer, even with no Gemini key set', async () => {
	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const page = pdfDoc.addPage([400, 300]);
	page.drawText('Fiche technique bardage', { x: 40, y: 260, size: 14, font });
	page.drawText('Entraxe montants 400mm', { x: 40, y: 220, size: 11, font });
	page.drawText('ep.130mm - R=3,70', { x: 40, y: 200, size: 11, font });
	const pdfBytes = Buffer.from(await pdfDoc.save());
	const upload = await postMultipart('/api/documents/upload', token(), { projectId: 'proj-1', evidenceType: 'fiche-technique' }, { field: 'file', filename: 'fiche.pdf', contentType: 'application/pdf', buffer: pdfBytes });
	assert.equal(upload.status, 201);
	const response = await post(`/api/documents/${upload.body.id}/explain`, token());
	assert.equal(response.status, 200);
	assert.equal(response.body.status, 'not_configured', 'no Gemini key in this test env - the AI explanation stays unavailable, but the callouts below must not depend on it');
	const texts = response.body.textCallouts.map((entry) => entry.text);
	assert.ok(texts.includes('Entraxe montants 400mm'), `expected the printed entraxe note to be read verbatim, got ${JSON.stringify(texts)}`);
	assert.ok(texts.includes('ep.130mm - R=3,70'), `expected the printed thickness/R-value note to be read verbatim, got ${JSON.stringify(texts)}`);
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
