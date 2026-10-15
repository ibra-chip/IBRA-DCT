// End-to-end: hits the real /api/budget/inspect and /api/factures/inspect routes with real generated
// PDFs (actual text layout, actual line breaks via pdf-lib + pdf-parse) to prove the regex field
// extraction pulls the right client name / chantier / invoice fields - not a mangled, run-on string
// that swallowed the next line, and not an empty field when the label is clearly on its own line.
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
const port = 9300 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir;

async function makeTextPdf(lines) {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const page = doc.addPage([420, 560]);
	let y = 520;
	for (const line of lines) {
		page.drawText(line, { x: 40, y, size: 11, font });
		y -= 18;
	}
	return Buffer.from(await doc.save());
}

function postFile(requestPath, fieldName, filename, fileBuffer, token) {
	const boundary = `----ibraBaTestBoundary${Date.now()}`;
	const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`);
	const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
	const body = Buffer.concat([head, fileBuffer, tail]);
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
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-extraction-test-'));
	const seed = { users: [{ id: 'user-1', name: 'Test User', email: 'test@example.com', role: 'gerant', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0 }], projects: [] };
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));
	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: { ...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '' },
		stdio: 'ignore',
	});
	for (let i = 0; i < 100; i += 1) {
		try { if ((await get('/api/health')).status === 200) return; } catch { /* not up yet */ }
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error('server did not start');
});

after(() => child?.kill());

const token = (role = 'gerant') => jwt.sign({ sub: 'user-1', name: 'Test User', email: 'test@example.com', role, company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: [], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

test('devis inspect pulls client and chantier from their own labeled lines, not a run-on string', async () => {
	const pdf = await makeTextPdf([
		'IBRA-BA SARL',
		'Devis N DEV-2026-0042',
		'Date: 15/03/2026',
		'Client: Jean Dupont',
		'Adresse du projet: 12 Rue de la Paix, 75002 Paris',
		'Chantier: Renovation facade',
		'Total TTC: 9350.00',
		'Net a payer: 9350.00',
	]);
	const result = await postFile('/api/budget/inspect', 'file', 'devis.pdf', pdf, token());
	assert.equal(result.status, 200);
	assert.equal(result.body.extracted.number, 'DEV-2026-0042');
	assert.equal(result.body.extracted.client, 'Jean Dupont');
	assert.equal(result.body.extracted.chantier, 'Renovation facade');
	assert.equal(result.body.extracted.total, 9350);
});

test('devis inspect prefers a Chantier: label over an earlier Reference chantier: line, and keeps client clean of its following address lines', async () => {
	const pdf = await makeTextPdf([
		'Devis n: 2026-DV-118',
		'Reference chantier: REF-998',
		'Client : SARL MARTIN CONSTRUCTION',
		'12 avenue des Lilas',
		'69000 Lyon',
		"Chantier : Isolation thermique exterieure - 45 rue Victor Hugo",
		'Total TTC: 16720.55',
	]);
	const result = await postFile('/api/budget/inspect', 'file', 'devis2.pdf', pdf, token());
	assert.equal(result.status, 200);
	assert.equal(result.body.extracted.client, 'SARL MARTIN CONSTRUCTION');
	assert.equal(result.body.extracted.chantier, "Isolation thermique exterieure - 45 rue Victor Hugo");
});

test('a "Chantier ::" stray-double-colon label never leaves chantier as the literal ":" garbage value', async () => {
	// A PDF export quirk can put a blank field out as "Label ::" — the first colon is the label
	// separator the regex already expects, so (.+) used to grab the second colon as if it were real
	// content. That falsy-looking-but-truthy ":" then silently blocked the Gemini fallback in
	// /api/budget/inspect from ever filling in the real chantier address, with no error anywhere.
	const pdf = await makeTextPdf([
		'Devis n: 2026-DV-200',
		'Client : SMAC',
		'Chantier ::',
		'Total TTC: 14200.00',
	]);
	const result = await postFile('/api/budget/inspect', 'file', 'devis-colon.pdf', pdf, token());
	assert.equal(result.status, 200);
	assert.notEqual(result.body.extracted.chantier, ':', 'the stray double colon must never surface as the chantier value');
	assert.equal(result.body.extracted.chantier, '');
	assert.equal(result.body.needsConfirmation, true);
});

test('the same stray-colon protection applies to Client: and to facture clientName, not just Chantier:', async () => {
	const devisPdf = await makeTextPdf(['Devis n: 2026-DV-201', 'Client ::', 'Chantier : 10 rue de Paris', 'Total TTC: 500.00']);
	const devisResult = await postFile('/api/budget/inspect', 'file', 'devis-client-colon.pdf', devisPdf, token());
	assert.equal(devisResult.status, 200);
	assert.notEqual(devisResult.body.extracted.client, ':');
	assert.equal(devisResult.body.extracted.client, '');

	const facturePdf = await makeTextPdf(['Facture n 2026-77', 'Client ::', 'Total TTC: 999.00']);
	const factureResult = await postFile('/api/factures/inspect', 'file', 'facture-client-colon.pdf', facturePdf, token());
	assert.equal(factureResult.status, 200);
	assert.notEqual(factureResult.body.extracted.clientName, ':');
	assert.equal(factureResult.body.extracted.clientName, '');
});

test('facture inspect keeps the client name clean of a following unrelated date line', async () => {
	const pdf = await makeTextPdf([
		'Facture n 2026-55',
		'Client: ETS ROBERT',
		'le 10/01/2026',
		'Total TTC: 12345.67',
	]);
	const result = await postFile('/api/factures/inspect', 'file', 'facture.pdf', pdf, token());
	assert.equal(result.status, 200);
	assert.equal(result.body.extracted.clientName, 'ETS ROBERT');
	assert.equal(result.body.extracted.amount, 12345.67);
});
