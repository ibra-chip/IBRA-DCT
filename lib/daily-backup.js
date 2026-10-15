const BACKUP_ID = /^backup-(\d{4})-(\d{2})-(\d{2})$/;
const dayOf = (date) => date.toISOString().slice(0, 10);

export function createDailyBackup({ readRow, rowExists, writeRow, listBackupIds, deleteRow, retainDays = 14, now = () => new Date(), log = console }) {
	let doneDay = null;
	let running = null;

	async function run(day) {
		const id = `backup-${day}`;
		if (!(await rowExists(id))) {
			const current = await readRow('singleton');
			if (current) await writeRow(id, current);
		}
		doneDay = day;
		const cutoff = dayOf(new Date(Date.parse(`${day}T00:00:00Z`) - retainDays * 86400000));
		for (const existing of await listBackupIds()) {
			const match = BACKUP_ID.exec(existing);
			if (match && `${match[1]}-${match[2]}-${match[3]}` < cutoff) await deleteRow(existing);
		}
	}

	return {
		async beforeWrite() {
			const day = dayOf(now());
			if (doneDay === day) return;
			if (!running) {
				running = run(day)
					.catch((error) => log.error('Daily backup failed (write continues):', error.message))
					.finally(() => { running = null; });
			}
			await running;
		},
	};
}
