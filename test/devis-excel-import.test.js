// A devis bill-of-quantities in Excel is read directly, cell by cell - no AI, no text-pattern guessing,
// the most precise source available since a cell either holds "45" or it doesn't. These tests build real
// .xlsx workbooks with exceljs and check the parsed numbers match exactly, then exercise the real
// /api/budget/inspect and /api/projects/:id/budget routes end to end.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { parseDevisExcel } from '../lib/devis-excel.js';

test('parses a French-header devis workbook into exact line items', async () => {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Devis');
	sheet.addRow(['Lot', 'Désignation', 'Quantité', 'Unité', 'Prix unitaire', 'Total']);
	sheet.addRow(['Démolition', 'Dépose carrelage existant', 45, 'm2', 12, 540]);
	sheet.addRow(['Démolition', 'Évacuation gravats', 1, 'forfait', 300, 300]);
	sheet.addRow(['ITE', 'Pose isolant PSE 140mm', 120, 'm2', 55, 6600]);
	const buffer = await workbook.xlsx.writeBuffer();

	const result = await parseDevisExcel(Buffer.from(buffer));
	assert.equal(result.error, null);
	assert.equal(result.items.length, 3);
	assert.deepEqual(result.items[0], { description: 'Dépose carrelage existant', quantity: 45, unit: 'm2', unitPrice: 12, lineTotal: 540, category: 'Démolition' });
	assert.equal(result.items[2].lineTotal, 6600);
});

test('computes lineTotal from quantity x unitPrice when the Total column is blank', async () => {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Devis');
	sheet.addRow(['Description', 'Quantité', 'Unité', 'Prix unitaire']);
	sheet.addRow(['Bardage HPL', 30, 'm2', 85]);
	const buffer = await workbook.xlsx.writeBuffer();

	const result = await parseDevisExcel(Buffer.from(buffer));
	assert.equal(result.error, null);
	assert.equal(result.items[0].lineTotal, 2550);
});

test('recognizes English headers too, not only French', async () => {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Sheet1');
	sheet.addRow(['Description', 'Qty', 'Unit', 'Unit Price', 'Total']);
	sheet.addRow(['Window flashing', 12, 'ml', 18, 216]);
	const buffer = await workbook.xlsx.writeBuffer();

	const result = await parseDevisExcel(Buffer.from(buffer));
	assert.equal(result.error, null);
	assert.equal(result.items[0].description, 'Window flashing');
	assert.equal(result.items[0].lineTotal, 216);
});

test('finds the header row even when it is not the very first row', async () => {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Devis');
	sheet.addRow(['DEVIS N DEV-2026-0042']);
	sheet.addRow(['Client: Jean Dupont']);
	sheet.addRow([]);
	sheet.addRow(['Désignation', 'Quantité', 'Unité', 'Prix unitaire', 'Total']);
	sheet.addRow(['Chape fluide', 80, 'm2', 22, 1760]);
	const buffer = await workbook.xlsx.writeBuffer();

	const result = await parseDevisExcel(Buffer.from(buffer));
	assert.equal(result.error, null);
	assert.equal(result.items.length, 1);
	assert.equal(result.items[0].lineTotal, 1760);
});

test('reports a clear error instead of guessing when no recognizable headers exist', async () => {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Devis');
	sheet.addRow(['Foo', 'Bar', 'Baz']);
	sheet.addRow(['x', 1, 2]);
	const buffer = await workbook.xlsx.writeBuffer();

	const result = await parseDevisExcel(Buffer.from(buffer));
	assert.equal(result.items.length, 0);
	assert.match(result.error, /Colonnes non reconnues/);
});

test('rejects a file that is not a valid Excel workbook, rather than crashing', async () => {
	const result = await parseDevisExcel(Buffer.from('not an excel file at all'));
	assert.equal(result.items.length, 0);
	assert.match(result.error, /illisible/);
});

// --- End-to-end: real HTTP routes ---

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 9900 + Math.floor(Math.random() * 90);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir, provider;

function fakeProvider() {
	const files = new Map();
	const server = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const body = Buffer.concat(chunks);
			const [pathname] = request.url.split('?');
			const key = decodeURIComponent(pathname.replace(/^\/ibra-ba-excel-test\//, ''));
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
	const boundary = `----ibraBaExcelTestBoundary${Date.now()}`;
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

const get = (requestPath, token) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path: requestPath, headers: { Authorization: `Bearer ${token}` } }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body }));
	}).on('error', reject);
});

before(async () => {
	provider = await fakeProvider();
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-excel-test-'));
	const seed = {
		users: [{ id: 'owner-1', name: 'Owner', email: 'owner@example.com', role: 'gerant', siret: '111111111', company: 'Company', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() }],
		projects: [{ id: 'proj-1', name: 'Chantier Test', location: '', progress: 0, status: 'active', manager: 'Owner', ownerId: 'owner-1', createdAt: new Date().toISOString() }],
	};
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));
	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: {
			...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir,
			SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '', GOOGLE_AI_API_KEY: '',
			STORAGE_POOL: 'b2', B2_ENDPOINT: `http://127.0.0.1:${provider.port}`, B2_REGION: 'eu', B2_KEY_ID: 'testkey', B2_SECRET: 'testsecret', B2_BUCKET: 'ibra-ba-excel-test',
		},
		stdio: 'ignore',
	});
	for (let i = 0; i < 100; i += 1) {
		try { if ((await get('/api/health', '')).status === 200) return; } catch { /* not up yet */ }
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error('server did not start');
});

after(() => { child?.kill(); provider?.server.close(); });

const token = () => jwt.sign({ sub: 'owner-1', name: 'Owner', email: 'owner@example.com', role: 'gerant', company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: [], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

async function makeDevisWorkbookBuffer() {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Devis');
	sheet.addRow(['Désignation', 'Quantité', 'Unité', 'Prix unitaire', 'Total']);
	sheet.addRow(['Dépose carrelage existant', 45, 'm2', 12, 540]);
	sheet.addRow(['Pose isolant PSE 140mm', 120, 'm2', 55, 6600]);
	return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('/api/budget/inspect reads an uploaded Excel devis into exact line items', async () => {
	const buffer = await makeDevisWorkbookBuffer();
	const result = await postMultipart('/api/budget/inspect', token(), {}, { field: 'file', filename: 'devis.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
	assert.equal(result.status, 200);
	assert.equal(result.body.lineItems.length, 2);
	assert.equal(result.body.extracted.total, 7140);
	assert.equal(result.body.aiFallbackUsed, false);
});

test('/api/projects/:id/budget accepts an Excel file as the devis source', async () => {
	const buffer = await makeDevisWorkbookBuffer();
	const result = await postMultipart('/api/projects/proj-1/budget', token(), { devisNumber: 'DEV-XL-1', client: 'Client Excel', chantierName: 'Chantier Test', total: '7140' }, { field: 'file', filename: 'devis.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
	assert.equal(result.status, 201, `expected the Excel devis save to succeed, got ${result.status}: ${JSON.stringify(result.body)}`);
	assert.match(result.body.sourceFile, /devis\.xlsx$/);
});
