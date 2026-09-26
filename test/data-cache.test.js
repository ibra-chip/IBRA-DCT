import assert from 'node:assert/strict';
import test from 'node:test';
import { createDataCache } from '../lib/data-cache.js';

const clock = () => { let t = 0; return { now: () => t, advance: (ms) => { t += ms; } }; };

test('serves repeated reads from memory within the TTL', async () => {
	const c = clock();
	const cache = createDataCache({ ttlMs: 2000, now: c.now });
	let loads = 0;
	const load = async () => { loads += 1; return { n: 1 }; };
	await cache.read(load); await cache.read(load); await cache.read(load);
	assert.equal(loads, 1);
});

test('returns independent copies so callers cannot corrupt the cache', async () => {
	const cache = createDataCache({ ttlMs: 2000 });
	const load = async () => ({ users: [{ id: 'a' }] });
	const first = await cache.read(load);
	first.users.push({ id: 'evil' });
	const second = await cache.read(load);
	assert.deepEqual(second.users, [{ id: 'a' }]);
});

test('reloads after the TTL expires', async () => {
	const c = clock();
	const cache = createDataCache({ ttlMs: 2000, now: c.now });
	let loads = 0;
	const load = async () => { loads += 1; return { loads }; };
	await cache.read(load);
	c.advance(2001);
	const second = await cache.read(load);
	assert.equal(loads, 2);
	assert.equal(second.loads, 2);
});

test('concurrent misses share a single load', async () => {
	const cache = createDataCache({ ttlMs: 2000 });
	let loads = 0;
	const load = async () => { loads += 1; await new Promise((r) => setTimeout(r, 20)); return { ok: true }; };
	const results = await Promise.all([cache.read(load), cache.read(load), cache.read(load)]);
	assert.equal(loads, 1);
	assert.equal(results.length, 3);
});

test('write-through: set() is visible to the next read without reloading', async () => {
	const cache = createDataCache({ ttlMs: 2000 });
	let loads = 0;
	const load = async () => { loads += 1; return { v: 'old' }; };
	await cache.read(load);
	cache.set({ v: 'new' });
	assert.deepEqual(await cache.read(load), { v: 'new' });
	assert.equal(loads, 1);
});

test('a slow read that started before a write cannot overwrite the newer data', async () => {
	const cache = createDataCache({ ttlMs: 2000 });
	let release;
	const slowOld = () => new Promise((resolve) => { release = () => resolve({ v: 'old' }); });
	const pending = cache.read(slowOld);
	cache.set({ v: 'new' });
	release();
	await pending;
	assert.deepEqual(await cache.read(async () => ({ v: 'should-not-load' })), { v: 'new' });
});

test('serves stale data when the source fails, within the stale window', async () => {
	const c = clock();
	const cache = createDataCache({ ttlMs: 2000, staleMs: 60000, now: c.now });
	await cache.read(async () => ({ v: 'good' }));
	c.advance(5000);
	const result = await cache.read(async () => { throw new Error('supabase down'); });
	assert.deepEqual(result, { v: 'good' });
});

test('throws once stale data is older than the stale window', async () => {
	const c = clock();
	const cache = createDataCache({ ttlMs: 2000, staleMs: 60000, now: c.now });
	await cache.read(async () => ({ v: 'good' }));
	c.advance(61000);
	await assert.rejects(() => cache.read(async () => { throw new Error('supabase down'); }), /supabase down/);
});

test('throws when the very first load fails (nothing to fall back on)', async () => {
	const cache = createDataCache({ ttlMs: 2000 });
	await assert.rejects(() => cache.read(async () => { throw new Error('boom'); }), /boom/);
});

test('invalidate() forces the next read to reload', async () => {
	const cache = createDataCache({ ttlMs: 2000 });
	let loads = 0;
	const load = async () => { loads += 1; return { loads }; };
	await cache.read(load);
	cache.invalidate();
	await cache.read(load);
	assert.equal(loads, 2);
});

test('ttlMs of 0 disables caching entirely', async () => {
	const cache = createDataCache({ ttlMs: 0 });
	let loads = 0;
	const load = async () => { loads += 1; return { loads }; };
	await cache.read(load); await cache.read(load); await cache.read(load);
	cache.set({ ignored: true });
	await cache.read(load);
	assert.equal(loads, 4);
});
