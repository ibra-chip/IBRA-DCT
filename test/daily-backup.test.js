import assert from 'node:assert/strict';
import test from 'node:test';
import { createDailyBackup } from '../lib/daily-backup.js';

function fakeStore(initial = {}) {
	const rows = new Map(Object.entries(initial));
	const calls = { writes: [], deletes: [] };
	return {
		rows, calls,
		api: {
			readRow: async (id) => rows.get(id) ?? null,
			rowExists: async (id) => rows.has(id),
			writeRow: async (id, data) => { calls.writes.push(id); rows.set(id, structuredClone(data)); },
			listBackupIds: async () => [...rows.keys()].filter((id) => id.startsWith('backup-')),
			deleteRow: async (id) => { calls.deletes.push(id); rows.delete(id); },
		},
	};
}
const at = (iso) => () => new Date(iso);
const silent = { error() {} };

test('first write of the day snapshots the current state; later writes the same day do not', async () => {
	const store = fakeStore({ singleton: { v: 'morning' } });
	const backup = createDailyBackup({ ...store.api, now: at('2026-09-26T08:00:00Z'), log: silent });
	await backup.beforeWrite();
	store.rows.set('singleton', { v: 'afternoon' });
	await backup.beforeWrite();
	assert.deepEqual(store.calls.writes, ['backup-2026-09-26']);
	assert.deepEqual(store.rows.get('backup-2026-09-26'), { v: 'morning' });
});

test('a new day produces a new snapshot', async () => {
	const store = fakeStore({ singleton: { v: 1 } });
	let current = '2026-09-26T08:00:00Z';
	const backup = createDailyBackup({ ...store.api, now: () => new Date(current), log: silent });
	await backup.beforeWrite();
	current = '2026-09-27T08:00:00Z';
	store.rows.set('singleton', { v: 2 });
	await backup.beforeWrite();
	assert.deepEqual(store.rows.get('backup-2026-09-27'), { v: 2 });
	assert.equal(store.calls.writes.length, 2);
});

test('skips creating a snapshot if another instance already made today\'s', async () => {
	const store = fakeStore({ singleton: { v: 'x' }, 'backup-2026-09-26': { v: 'earlier' } });
	const backup = createDailyBackup({ ...store.api, now: at('2026-09-26T10:00:00Z'), log: silent });
	await backup.beforeWrite();
	assert.deepEqual(store.calls.writes, []);
	assert.deepEqual(store.rows.get('backup-2026-09-26'), { v: 'earlier' });
});

test('prunes snapshots older than the retention window and never touches other rows', async () => {
	const store = fakeStore({
		singleton: { v: 1 },
		'backup-2026-09-01': {}, 'backup-2026-09-11': {}, 'backup-2026-09-12': {}, 'backup-2026-09-20': {},
		'backup-notadate': { keep: true }, 'other-row': { keep: true },
	});
	const backup = createDailyBackup({ ...store.api, retainDays: 14, now: at('2026-09-26T10:00:00Z'), log: silent });
	await backup.beforeWrite();
	assert.deepEqual(store.calls.deletes.sort(), ['backup-2026-09-01', 'backup-2026-09-11']);
	assert.ok(store.rows.has('singleton'));
	assert.ok(store.rows.has('backup-notadate'));
	assert.ok(store.rows.has('other-row'));
	assert.ok(store.rows.has('backup-2026-09-12'));
});

test('a failing backup never throws into the write path and is retried on the next write', async () => {
	const store = fakeStore({ singleton: { v: 1 } });
	let fail = true;
	const api = { ...store.api, writeRow: async (id, data) => { if (fail) throw new Error('storage down'); return store.api.writeRow(id, data); } };
	const backup = createDailyBackup({ ...api, now: at('2026-09-26T10:00:00Z'), log: silent });
	await assert.doesNotReject(() => backup.beforeWrite());
	assert.equal(store.rows.has('backup-2026-09-26'), false);
	fail = false;
	await backup.beforeWrite();
	assert.equal(store.rows.has('backup-2026-09-26'), true);
});

test('concurrent writes trigger the snapshot only once', async () => {
	const store = fakeStore({ singleton: { v: 1 } });
	const slow = { ...store.api, readRow: async (id) => { await new Promise((r) => setTimeout(r, 20)); return store.api.readRow(id); } };
	const backup = createDailyBackup({ ...slow, now: at('2026-09-26T10:00:00Z'), log: silent });
	await Promise.all([backup.beforeWrite(), backup.beforeWrite(), backup.beforeWrite()]);
	assert.equal(store.calls.writes.length, 1);
});

test('does nothing harmful when there is no data yet', async () => {
	const store = fakeStore({});
	const backup = createDailyBackup({ ...store.api, now: at('2026-09-26T10:00:00Z'), log: silent });
	await backup.beforeWrite();
	assert.deepEqual(store.calls.writes, []);
});
