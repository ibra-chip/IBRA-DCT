// End-to-end: hits the real server.js to prove script.js/styles.css are cached for a year when
// requested with the ?v=<content-hash> query the HTML links them with (so a repeat app open skips
// re-downloading ~250KB of JS), but still revalidate every time when hit without that query.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 9100 + Math.floor(Math.random() * 100);
let child, dataDir;

const get = (requestPath) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path: requestPath }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, cacheControl: response.headers['cache-control'], body }));
	}).on('error', reject);
});

before(async () => {
	dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ibra-ba-static-test-'));
	await fs.writeFile(path.join(dataDir, 'data.json'), JSON.stringify({ users: [], projects: [] }, null, 2));
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

test('index.html links script.js/styles.css with a ?v= content-hash query', async () => {
	const response = await get('/');
	assert.match(response.body, /src="script\.js\?v=[0-9a-f]{10}"/);
	assert.match(response.body, /href="styles\.css\?v=[0-9a-f]{10}"/);
});

test('script.js and styles.css are cached for a year when requested with ?v=', async () => {
	const index = await get('/');
	const [, scriptVersion] = index.body.match(/src="script\.js\?v=([0-9a-f]{10})"/);
	const [, stylesVersion] = index.body.match(/href="styles\.css\?v=([0-9a-f]{10})"/);

	const script = await get(`/script.js?v=${scriptVersion}`);
	assert.equal(script.status, 200);
	assert.equal(script.cacheControl, 'public, max-age=31536000, immutable');

	const styles = await get(`/styles.css?v=${stylesVersion}`);
	assert.equal(styles.status, 200);
	assert.equal(styles.cacheControl, 'public, max-age=31536000, immutable');
});

test('script.js and styles.css still revalidate every time when requested without ?v=', async () => {
	const script = await get('/script.js');
	assert.equal(script.status, 200);
	assert.equal(script.cacheControl, 'no-cache, must-revalidate');

	const styles = await get('/styles.css');
	assert.equal(styles.status, 200);
	assert.equal(styles.cacheControl, 'no-cache, must-revalidate');
});

test('index.html itself is never long-cached, so deploys are always picked up', async () => {
	const response = await get('/');
	assert.equal(response.cacheControl, 'no-cache, must-revalidate');
});
