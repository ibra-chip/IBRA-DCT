// Calibrated on-screen takeoff for plans: no AI involved anywhere here, just geometry. A user clicks two
// points of a known real-world distance to set pixelsPerMeter, then traces a line (ml) or a polygon (m2)
// on the plan image; the server recomputes the value from the raw points + calibration rather than
// trusting whatever number the client sends, so these tests prove the math (distance / shoelace area)
// against exact, hand-picked pixel coordinates, not just that the endpoints respond.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 9800 + Math.floor(Math.random() * 100);
const secret = 'local-development-secret-change-before-deploy';
let child, dataDir, provider;

function fakeProvider() {
	const files = new Map();
	const server = http.createServer((request, response) => {
		const chunks = []; request.on('data', (c) => chunks.push(c));
		request.on('end', () => {
			const body = Buffer.concat(chunks);
			const [pathname] = request.url.split('?');
			const key = decodeURIComponent(pathname.replace(/^\/ibra-ba-plan-test\//, ''));
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
	const boundary = `----ibraBaPlanTestBoundary${Date.now()}`;
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
			const chunks = [];
			response.on('data', (chunk) => chunks.push(chunk));
			response.on('end', () => { const buffer = Buffer.concat(chunks); resolve({ status: response.statusCode, contentType: response.headers['content-type'], buffer, body: (() => { try { return JSON.parse(buffer.toString('utf8') || '{}'); } catch { return null; } })() }); });
		});
		request.on('error', reject);
		request.end(body);
	});
}

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
	provider = await fakeProvider();
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-plan-test-'));
	const seed = {
		users: [
			{ id: 'owner-a', name: 'Owner A', email: 'ownera@example.com', role: 'gerant', siret: '111111111', company: 'Company A', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
			{ id: 'owner-b', name: 'Owner B', email: 'ownerb@example.com', role: 'gerant', siret: '222222222', company: 'Company B', passwordHash: 'unused', projectIds: [], dailyRate: 0, hourlyRate: 0, createdAt: new Date().toISOString() },
		],
		projects: [{ id: 'proj-a', name: 'Chantier A', location: '', progress: 0, status: 'active', manager: 'Owner A', ownerId: 'owner-a', createdAt: new Date().toISOString() }],
		documents: [],
	};
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(seed, null, 2));
	child = spawn(process.execPath, ['server.js'], {
		cwd: root,
		env: {
			...process.env, PORT: String(port), NODE_ENV: 'test', IBRA_DATA_DIR: dataDir,
			SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', GEMINI_API_KEY: '', GOOGLE_AI_API_KEY: '', OPENAI_API_KEY: '',
			STORAGE_POOL: 'b2', B2_ENDPOINT: `http://127.0.0.1:${provider.port}`, B2_REGION: 'eu', B2_KEY_ID: 'testkey', B2_SECRET: 'testsecret', B2_BUCKET: 'ibra-ba-plan-test',
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

const tokenFor = (userId, role) => jwt.sign({ sub: userId, name: userId, email: `${userId}@example.com`, role, company: '', siret: '', employerCompany: '', employerSiret: '', projectIds: [], avatarUrl: '', companyLogoUrl: '', companyName: '' }, secret, { expiresIn: '8h' });

let documentId;

test('uploading a plan image creates a document we can calibrate', async () => {
	const result = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan' }, { field: 'file', filename: 'plan-facade.jpg', contentType: 'image/jpeg', buffer: Buffer.from('fake-plan-image-bytes') });
	assert.equal(result.status, 201);
	documentId = result.body.id;
	assert.ok(documentId);
});

test('measuring before calibration is rejected', async () => {
	const response = await call('POST', `/api/documents/${documentId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'line', label: 'Bavette', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
	assert.equal(response.status, 400);
});

test('calibration rejects reference points that are too close together', async () => {
	const response = await call('PATCH', `/api/documents/${documentId}/calibration`, tokenFor('owner-a', 'gerant'), { pointA: { x: 0, y: 0 }, pointB: { x: 0.5, y: 0 }, realDistanceM: 2 });
	assert.equal(response.status, 400);
});

test('calibrating the plan scale computes pixelsPerMeter from the two reference points', async () => {
	// 100px represents 2m of real distance -> 50 pixels per meter.
	const response = await call('PATCH', `/api/documents/${documentId}/calibration`, tokenFor('owner-a', 'gerant'), { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, realDistanceM: 2 });
	assert.equal(response.status, 200);
	assert.equal(response.body.calibration.pixelsPerMeter, 50);
});

test('a traced line is measured in exact ml from the calibration, not guessed', async () => {
	// 150px straight line at 50px/m -> exactly 3.00 ml.
	const response = await call('POST', `/api/documents/${documentId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'line', label: 'Bavette fenêtre 1', points: [{ x: 0, y: 0 }, { x: 150, y: 0 }] });
	assert.equal(response.status, 201);
	assert.equal(response.body.unit, 'ml');
	assert.equal(response.body.value, 3);
});

test('a traced polygon is measured in exact m2 via the shoelace formula', async () => {
	// 100px x 50px rectangle = 5000 px^2; at (50px/m)^2 = 2500 px^2/m^2 -> exactly 2.00 m2.
	const response = await call('POST', `/api/documents/${documentId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'polygon', label: 'Façade Nord', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] });
	assert.equal(response.status, 201);
	assert.equal(response.body.unit, 'm2');
	assert.equal(response.body.value, 2);
});

test('a line needs at least 2 points and a polygon needs at least 3', async () => {
	const lineResponse = await call('POST', `/api/documents/${documentId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'line', label: 'x', points: [{ x: 0, y: 0 }] });
	assert.equal(lineResponse.status, 400);
	const polygonResponse = await call('POST', `/api/documents/${documentId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'polygon', label: 'x', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
	assert.equal(polygonResponse.status, 400);
});

test('GET measurements returns the calibration plus every saved measurement for the plan', async () => {
	const response = await get(`/api/documents/${documentId}/measurements`, tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	assert.equal(response.body.calibration.pixelsPerMeter, 50);
	assert.equal(response.body.measurements.length, 2);
	assert.ok(response.body.measurements.some((item) => item.unit === 'ml' && item.value === 3));
	assert.ok(response.body.measurements.some((item) => item.unit === 'm2' && item.value === 2));
});

test('a measurement can be deleted', async () => {
	const list = await get(`/api/documents/${documentId}/measurements`, tokenFor('owner-a', 'gerant'));
	const target = list.body.measurements[0];
	const response = await call('DELETE', `/api/measurements/${target.id}`, tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	const after2 = await get(`/api/documents/${documentId}/measurements`, tokenFor('owner-a', 'gerant'));
	assert.equal(after2.body.measurements.length, 1);
});

test('owner B cannot calibrate, measure, or read measurements on owner A\'s plan', async () => {
	const calibrate = await call('PATCH', `/api/documents/${documentId}/calibration`, tokenFor('owner-b', 'gerant'), { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, realDistanceM: 2 });
	assert.equal(calibrate.status, 403);
	const measure = await call('POST', `/api/documents/${documentId}/measurements`, tokenFor('owner-b', 'gerant'), { type: 'line', label: 'x', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] });
	assert.equal(measure.status, 403);
	const list = await get(`/api/documents/${documentId}/measurements`, tokenFor('owner-b', 'gerant'));
	assert.equal(list.status, 403);
	const image = await get(`/api/documents/${documentId}/plan-image`, tokenFor('owner-b', 'gerant'));
	assert.equal(image.status, 403);
});

test('/plan-image serves the original bytes directly for an image-type plan', async () => {
	const response = await new Promise((resolve, reject) => {
		http.get({ host: '127.0.0.1', port, path: `/api/documents/${documentId}/plan-image`, headers: { Authorization: `Bearer ${tokenFor('owner-a', 'gerant')}` } }, (res) => {
			const chunks = [];
			res.on('data', (c) => chunks.push(c));
			res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'], buffer: Buffer.concat(chunks) }));
		}).on('error', reject);
	});
	assert.equal(response.status, 200);
	assert.equal(response.contentType, 'image/jpeg');
	assert.equal(response.buffer.toString('utf8'), 'fake-plan-image-bytes');
});

test('/plan-image rasterizes page 1 for a PDF-type plan and caches it', async () => {
	const pdfDoc = await PDFDocument.create();
	pdfDoc.addPage([200, 150]);
	const pdfBytes = Buffer.from(await pdfDoc.save());
	const upload = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan' }, { field: 'file', filename: 'plan-pdf.pdf', contentType: 'application/pdf', buffer: pdfBytes });
	assert.equal(upload.status, 201);
	const pdfDocumentId = upload.body.id;
	const fetchImage = () => new Promise((resolve, reject) => {
		http.get({ host: '127.0.0.1', port, path: `/api/documents/${pdfDocumentId}/plan-image`, headers: { Authorization: `Bearer ${tokenFor('owner-a', 'gerant')}` } }, (res) => {
			const chunks = [];
			res.on('data', (c) => chunks.push(c));
			res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'], length: Buffer.concat(chunks).length }));
		}).on('error', reject);
	});
	const first = await fetchImage();
	assert.equal(first.status, 200);
	assert.equal(first.contentType, 'image/png');
	assert.ok(first.length > 0, 'expected a non-empty rasterized PNG');
	const second = await fetchImage();
	assert.equal(second.status, 200);
	assert.equal(second.length, first.length, 'the cached raster should be served identically on a second request');
});

test('plan-info reports not_configured without a Gemini key rather than crashing', async () => {
	const response = await call('POST', `/api/documents/${documentId}/plan-info`, tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	assert.equal(response.body.status, 'not_configured');
	assert.equal(response.body.planInfo, null);
});

test('plan-info is cached on the document once generated, served without calling Gemini again', async () => {
	// Seed a cached result directly (as if a previous call with a real key had already run) and confirm
	// the route returns it as "cached" without needing GEMINI_API_KEY at all.
	const raw = JSON.parse(await fs.readFile(path.join(dataDir, 'data.json'), 'utf8'));
	const doc = raw.documents.find((item) => item.id === documentId);
	doc.planInfo = { subject: 'Façade Nord - Détail fenêtre', chantierAddress: '12 Rue de la Paix, 75002 Paris', clientName: 'Jean Dupont', architecte: 'Cabinet Martin' };
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify(raw, null, 2));
	const response = await call('POST', `/api/documents/${documentId}/plan-info`, tokenFor('owner-a', 'gerant'));
	assert.equal(response.status, 200);
	assert.equal(response.body.status, 'cached');
	assert.equal(response.body.planInfo.clientName, 'Jean Dupont');
	assert.equal(response.body.planInfo.subject, 'Façade Nord - Détail fenêtre');
});

test('owner B cannot read or trigger plan-info on owner A\'s plan', async () => {
	const response = await call('POST', `/api/documents/${documentId}/plan-info`, tokenFor('owner-b', 'gerant'));
	assert.equal(response.status, 403);
});

// A real CAD-exported PDF prints its plot scale as actual text ("Échelle 1:50") - this is read with a
// regex over the PDF's real text layer, not AI, and turned into an exact pixelsPerMeter using the fixed
// rasterization DPI: no two-point clicking needed for this common case, and still zero guessing.
test('a PDF plan with a printed "Échelle 1:50" is detected via text, not AI, as a scale suggestion', async () => {
	const { PDFDocument: PDFDoc, StandardFonts } = await import('pdf-lib');
	const pdfDoc = await PDFDoc.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const page = pdfDoc.addPage([400, 300]);
	page.drawText('CARNET DE DETAIL - FACADE NORD', { x: 20, y: 270, size: 10, font });
	page.drawText('Échelle 1:50', { x: 20, y: 20, size: 10, font });
	const pdfBytes = Buffer.from(await pdfDoc.save());
	const upload = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan' }, { field: 'file', filename: 'carnet-detail.pdf', contentType: 'application/pdf', buffer: pdfBytes });
	assert.equal(upload.status, 201);
	const scalePlanId = upload.body.id;
	const suggestion = await get(`/api/documents/${scalePlanId}/plan-scale-suggestion`, tokenFor('owner-a', 'gerant'));
	assert.equal(suggestion.status, 200);
	assert.equal(suggestion.body.scaleDenominator, 50);
});

// Proves the scale reader is general-purpose, not hardcoded to 1:50 - every common architectural plan
// scale is read the same way, straight from whatever the plan's own title block actually prints.
for (const denominator of [20, 25, 100, 200, 500, 1000]) {
	test(`a PDF plan printed at 1:${denominator} is detected at exactly that scale, not just 1:50`, async () => {
		const { PDFDocument: PDFDoc, StandardFonts } = await import('pdf-lib');
		const pdfDoc = await PDFDoc.create();
		const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
		pdfDoc.addPage([400, 300]).drawText(`Échelle 1:${denominator}`, { x: 20, y: 20, size: 10, font });
		const pdfBytes = Buffer.from(await pdfDoc.save());
		const upload = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan' }, { field: 'file', filename: `plan-1-${denominator}.pdf`, contentType: 'application/pdf', buffer: pdfBytes });
		assert.equal(upload.status, 201);
		const suggestion = await get(`/api/documents/${upload.body.id}/plan-scale-suggestion`, tokenFor('owner-a', 'gerant'));
		assert.equal(suggestion.status, 200);
		assert.equal(suggestion.body.scaleDenominator, denominator);
	});
}

// "éch." is the standard French abbreviation for "échelle" and is at least as common on real title
// blocks as the full word - a real plan reading "PIGNON NORD éch. 1/250" was missed entirely before this
// fix, silently falling back to asking for manual calibration even though the scale was right there.
test('the abbreviated "éch." label is recognized, not only the full word "échelle"', async () => {
	const { PDFDocument: PDFDoc, StandardFonts } = await import('pdf-lib');
	const pdfDoc = await PDFDoc.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	pdfDoc.addPage([400, 300]).drawText('PIGNON NORD éch. 1/250', { x: 20, y: 20, size: 10, font });
	const pdfBytes = Buffer.from(await pdfDoc.save());
	const upload = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan' }, { field: 'file', filename: 'plan-ech-abbrev.pdf', contentType: 'application/pdf', buffer: pdfBytes });
	assert.equal(upload.status, 201);
	const suggestion = await get(`/api/documents/${upload.body.id}/plan-scale-suggestion`, tokenFor('owner-a', 'gerant'));
	assert.equal(suggestion.status, 200);
	assert.equal(suggestion.body.scaleDenominator, 250);
});

test('the "ech" substring inside an unrelated word never triggers a false scale match', async () => {
	const { PDFDocument: PDFDoc, StandardFonts } = await import('pdf-lib');
	const pdfDoc = await PDFDoc.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	pdfDoc.addPage([400, 300]).drawText('Fiche technique - recherche 1/2 page', { x: 20, y: 20, size: 10, font });
	const pdfBytes = Buffer.from(await pdfDoc.save());
	const upload = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan' }, { field: 'file', filename: 'plan-no-echelle.pdf', contentType: 'application/pdf', buffer: pdfBytes });
	assert.equal(upload.status, 201);
	const suggestion = await get(`/api/documents/${upload.body.id}/plan-scale-suggestion`, tokenFor('owner-a', 'gerant'));
	assert.equal(suggestion.status, 200);
	assert.equal(suggestion.body.scaleDenominator, null);
});

test('plan-scale-suggestion returns null for an image plan (no PDF text layer to read)', async () => {
	const suggestion = await get(`/api/documents/${documentId}/plan-scale-suggestion`, tokenFor('owner-a', 'gerant'));
	assert.equal(suggestion.status, 200);
	assert.equal(suggestion.body.scaleDenominator, null);
});

test('accepting a 1:50 PDF scale calibrates to the exact expected pixelsPerMeter, no manual clicking', async () => {
	const { PDFDocument: PDFDoc, StandardFonts } = await import('pdf-lib');
	const pdfDoc = await PDFDoc.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	pdfDoc.addPage([400, 300]).drawText('Échelle 1:50', { x: 20, y: 20, size: 10, font });
	const pdfBytes = Buffer.from(await pdfDoc.save());
	const upload = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan' }, { field: 'file', filename: 'carnet-detail-2.pdf', contentType: 'application/pdf', buffer: pdfBytes });
	const planId = upload.body.id;
	const response = await call('PATCH', `/api/documents/${planId}/calibration`, tokenFor('owner-a', 'gerant'), { scaleDenominator: 50 });
	assert.equal(response.status, 200);
	// PLAN_RASTER_DPI (150) / (0.0254m/inch * 50) = exactly ~117.19 px/m - deterministic from the DPI
	// and the scale alone, independent of page size.
	assert.ok(Math.abs(response.body.calibration.pixelsPerMeter - (150 / (0.0254 * 50))) < 1e-9);
	assert.equal(response.body.calibration.method, 'pdf-scale');
});

test('scale-based calibration is rejected for an image plan (no real paper-space page to trust)', async () => {
	const response = await call('PATCH', `/api/documents/${documentId}/calibration`, tokenFor('owner-a', 'gerant'), { scaleDenominator: 50 });
	assert.equal(response.status, 400);
});

// "Plan existant" (démolition) vs "Plan nouveau" (construction) - no AI diffing between the two
// drawings, just a label on each so a devis line item built from a measurement on either one lands
// under the right category automatically.
test('an uploaded plan tagged "existant" or "nouveau" keeps that tag, both documents independently measurable', async () => {
	const existing = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan', planType: 'existant' }, { field: 'file', filename: 'avant.jpg', contentType: 'image/jpeg', buffer: Buffer.from('plan-avant-bytes') });
	assert.equal(existing.status, 201);
	assert.equal(existing.body.planType, 'existant');

	const nouveau = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan', planType: 'nouveau' }, { field: 'file', filename: 'apres.jpg', contentType: 'image/jpeg', buffer: Buffer.from('plan-apres-bytes') });
	assert.equal(nouveau.status, 201);
	assert.equal(nouveau.body.planType, 'nouveau');

	// Each plan calibrates and measures completely independently of the other.
	await call('PATCH', `/api/documents/${existing.body.id}/calibration`, tokenFor('owner-a', 'gerant'), { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, realDistanceM: 2 });
	const demolition = await call('POST', `/api/documents/${existing.body.id}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'line', label: 'Mur à démolir', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
	assert.equal(demolition.status, 201);
	assert.equal(demolition.body.value, 2);

	await call('PATCH', `/api/documents/${nouveau.body.id}/calibration`, tokenFor('owner-a', 'gerant'), { pointA: { x: 0, y: 0 }, pointB: { x: 50, y: 0 }, realDistanceM: 2 });
	const construction = await call('POST', `/api/documents/${nouveau.body.id}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'line', label: 'Nouvelle cloison', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] });
	assert.equal(construction.status, 201);
	assert.equal(construction.body.value, 2);
});

test('planType is ignored (stays null) for a non-plan evidenceType, and for a bogus value', async () => {
	const photo = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'photo-during', planType: 'existant' }, { field: 'file', filename: 'site.jpg', contentType: 'image/jpeg', buffer: Buffer.from('site-photo-bytes') });
	assert.equal(photo.status, 201);
	assert.equal(photo.body.planType, null);

	const bogus = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan', planType: 'not-a-real-value' }, { field: 'file', filename: 'plan.jpg', contentType: 'image/jpeg', buffer: Buffer.from('bogus-plantype-bytes') });
	assert.equal(bogus.status, 201);
	assert.equal(bogus.body.planType, null);
});

// Window/door openings: traced the same way as any other polygon, just tagged role: 'opening' so the
// client can subtract them from a wall's gross area (net = gross surfaces - openings) instead of the
// user doing that arithmetic by hand for every window. Own document + calibration, independent of the
// shared `documentId` used by the earlier count-sensitive tests above.
let openingsDocId;

test('setup: a fresh calibrated plan for the opening/deduction tests', async () => {
	const upload = await postMultipart('/api/documents/upload', tokenFor('owner-a', 'gerant'), { projectId: 'proj-a', evidenceType: 'plan' }, { field: 'file', filename: 'plan-openings.jpg', contentType: 'image/jpeg', buffer: Buffer.from('fake-plan-openings-bytes') });
	assert.equal(upload.status, 201);
	openingsDocId = upload.body.id;
	// 100px represents 10m -> exactly 10 pixels per meter, for round numbers below.
	const calibration = await call('PATCH', `/api/documents/${openingsDocId}/calibration`, tokenFor('owner-a', 'gerant'), { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, realDistanceM: 10 });
	assert.equal(calibration.status, 200);
	assert.equal(calibration.body.calibration.pixelsPerMeter, 10);
});

test('a polygon marked role: opening is stored as an opening', async () => {
	const response = await call('POST', `/api/documents/${openingsDocId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'polygon', role: 'opening', label: 'Fenêtre salon', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }] });
	assert.equal(response.status, 201);
	assert.equal(response.body.role, 'opening');
	// 20x20px at 10px/m -> 2x2m -> exactly 4.00 m2, same shoelace math as any other polygon.
	assert.equal(response.body.value, 4);
});

test('a polygon with no role, or an unrecognized role, defaults to surface (never silently becomes a deduction)', async () => {
	const noRole = await call('POST', `/api/documents/${openingsDocId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'polygon', label: 'Mur', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] });
	assert.equal(noRole.body.role, 'surface');
	const junkRole = await call('POST', `/api/documents/${openingsDocId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'polygon', role: 'not-a-real-role', label: 'Mur', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] });
	assert.equal(junkRole.body.role, 'surface');
});

test('role is ignored for a line - a length has nothing to deduct from, so it always stays surface', async () => {
	const response = await call('POST', `/api/documents/${openingsDocId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'line', role: 'opening', label: 'Bavette', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] });
	assert.equal(response.status, 201);
	assert.equal(response.body.role, 'surface');
});

test('net area (gross wall minus two windows) matches hand-computed expectation', async () => {
	// Wall: 100x50px at 10px/m -> 10x5m -> 50 m2 gross. Two 20x20px (2x2m) windows -> 4 m2 each -> 8 m2 total.
	// Net = 50 - 8 = 42 m2. This is the exact arithmetic the client's "Total net" / "Ajouter le total net
	// au devis" button performs over whatever the server has stored - proven here against the real
	// persisted measurements rather than assumed.
	const wall = await call('POST', `/api/documents/${openingsDocId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'polygon', label: 'Mur pignon', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] });
	assert.equal(wall.body.value, 50);
	const window2 = await call('POST', `/api/documents/${openingsDocId}/measurements`, tokenFor('owner-a', 'gerant'), { type: 'polygon', role: 'opening', label: 'Fenêtre cuisine', points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }] });
	assert.equal(window2.body.value, 4);

	const all = await get(`/api/documents/${openingsDocId}/measurements`, tokenFor('owner-a', 'gerant'));
	const surfaces = all.body.measurements.filter((item) => item.unit === 'm2' && item.role !== 'opening' && item.label === 'Mur pignon');
	const openings = all.body.measurements.filter((item) => item.unit === 'm2' && item.role === 'opening');
	const gross = surfaces.reduce((sum, item) => sum + item.value, 0);
	const deducted = openings.reduce((sum, item) => sum + item.value, 0);
	assert.equal(gross, 50);
	assert.equal(deducted, 8);
	assert.equal(gross - deducted, 42);
});
