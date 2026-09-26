import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 8700 + Math.floor(Math.random() * 200);
let child;

const get = (path) => new Promise((resolve, reject) => {
	http.get({ host: '127.0.0.1', port, path }, (response) => {
		let body = '';
		response.on('data', (chunk) => (body += chunk));
		response.on('end', () => resolve({ status: response.statusCode, body }));
	}).on('error', reject);
});

before(async () => {
	child = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), NODE_ENV: 'test', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' }, stdio: 'ignore' });
	for (let i = 0; i < 100; i += 1) {
		try { if ((await get('/api/health')).status === 200) return; } catch { /* not up yet */ }
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error('server did not start');
});

after(() => child?.kill());

test('the files the app needs are served', async () => {
	for (const path of ['/', '/index.html', '/script.js', '/styles.css', '/logo.svg', '/manifest.webmanifest', '/sw.js', '/knowledge-base/rge-qualibat-ite.json']) {
		assert.equal((await get(path)).status, 200, `${path} should be public`);
	}
});

test('data, source code and config files are never served', async () => {
	const blocked = [
		'/data.json', '/data.json.bak', '/server.js', '/package.json', '/package-lock.json', '/Dockerfile', '/render.yaml', '/README.md',
		'/lib/storage.js', '/lib/data-cache.js', '/test/data-cache.test.js', '/.env', '/.env.example', '/.git/config',
		'/node_modules/express/package.json', '/uploads/', '/prisma/schema.prisma', '/knowledge-base/', '/DATA.JSON',
		'/%64ata.json', '/..%2fdata.json', '/%2e%2e/data.json', '/data.json%00', '//data.json', '/./data.json', '/index.html/../data.json',
	];
	for (const path of blocked) {
		const { status, body } = await get(path);
		assert.notEqual(status, 200, `${path} must not be served`);
		assert.ok(!body.includes('passwordHash'), `${path} leaked data`);
	}
});
