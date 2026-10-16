// A plan is very often already a native .dxf (exported straight from AutoCAD), not only a .dwg that
// needs server-side conversion. The exact-geometry "Analyser l'ossature" tool already reads DXF layers
// regardless of how the document got there (see isDxfDocument in server.js), but the upload gate only
// accepted .dwg for a plan - a .dxf upload was silently rejected even though nothing downstream needed
// the DWG round-trip. This proves the gate now accepts .dxf directly, tags it the same way a converted
// DWG is tagged (mimeType application/dxf), and that the layer-reading endpoint reads it correctly.
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
let child, dataDir, provider;

function fakeProvider() {
	const files = new Map();
	const server = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const body = Buffer.concat(chunks);
			const [pathname] = request.url.split('?');
			const key = decodeURIComponent(pathname.replace(/^\/ibra-ba-dxf-test\//, ''));
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
	const boundary = `----ibraBaDxfTestBoundary${Date.now()}`;
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

const get = (requestPath, token) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path: requestPath, headers: token ? { Authorization: `Bearer ${token}` } : {} }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body || '{}') }));
	}).on('error', reject);
});

before(async () => {
	provider = await fakeProvider();
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-dxf-test-'));
	const seed = {
		users: [{ id: 'owner-1', name: 'Owner', email: 'owner@example.com', role: 'gerant', siret: '111111111', company: 'Company', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() }],
		projects: [{ id: 'proj-1', name: 'Chantier Test', location: '', progress: 0, status: 'active', manager: 'Owner', ownerId: 'owner-1', createdAt: new Date().toISOString() }],
		documents: [],
	};
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));
	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: {
			...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir,
			SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '', GOOGLE_AI_API_KEY: '', OPENAI_API_KEY: '',
			STORAGE_POOL: 'b2', B2_ENDPOINT: `http://127.0.0.1:${provider.port}`, B2_REGION: 'eu', B2_KEY_ID: 'testkey', B2_SECRET: 'testsecret', B2_BUCKET: 'ibra-ba-dxf-test',
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

const sampleDxf = Buffer.from([
	'0', 'SECTION', '2', 'ENTITIES',
	'0', 'INSERT', '8', 'OSSATURE', '10', '100.0', '20', '200.0',
	'0', 'INSERT', '8', 'OSSATURE', '10', '160.0', '20', '200.0',
	'0', 'INSERT', '8', 'OSSATURE', '10', '220.0', '20', '200.0',
	'0', 'ENDSEC',
].join('\n'));

test('/api/documents/upload accepts a native .dxf plan directly, not only a converted .dwg', async () => {
	const result = await postMultipart('/api/documents/upload', token(), { projectId: 'proj-1', evidenceType: 'plan' }, { field: 'file', filename: 'ossature.dxf', contentType: 'application/octet-stream', buffer: sampleDxf });
	assert.equal(result.status, 201, `expected the native .dxf plan to be accepted, got ${result.status}: ${JSON.stringify(result.body)}`);
	assert.equal(result.body.mimeType, 'application/dxf', 'a native .dxf upload must be tagged the same way a DWG-converted one is, so downstream DXF-reading code treats it identically');
	assert.equal(result.body.convertedFromDwg, false, 'it was uploaded as .dxf directly - nothing was converted');
});

test('the exact-geometry layer reader works on a native .dxf, not only on a DWG-converted one', async () => {
	const upload = await postMultipart('/api/documents/upload', token(), { projectId: 'proj-1', evidenceType: 'plan' }, { field: 'file', filename: 'ossature-2.dxf', contentType: 'application/octet-stream', buffer: sampleDxf });
	assert.equal(upload.status, 201);
	const layers = await get(`/api/documents/${upload.body.id}/dxf-layers`, token());
	assert.equal(layers.status, 200);
	assert.equal(layers.body.layers.length, 1, 'the one OSSATURE layer in the sample file must be found');
	assert.equal(layers.body.layers[0].layer, 'OSSATURE');
	assert.equal(layers.body.layers[0].byType.INSERT, 3, 'all three INSERT block placements on that layer must be counted');
});

test('/api/documents/upload still rejects a .dxf for an evidenceType that only takes PDF/photo (fiche-technique)', async () => {
	const result = await postMultipart('/api/documents/upload', token(), { projectId: 'proj-1', evidenceType: 'fiche-technique' }, { field: 'file', filename: 'fiche.dxf', contentType: 'application/octet-stream', buffer: sampleDxf });
	assert.equal(result.status, 400, 'a fiche-technique is never a CAD file, so the .dxf allowance must stay scoped to evidenceType=plan only');
});
