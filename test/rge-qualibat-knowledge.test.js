import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const knowledge = JSON.parse(fs.readFileSync(new URL('../knowledge-base/rge-qualibat-ite.json', import.meta.url), 'utf8'));

test('RGE Qualibat knowledge base exposes modules, checklist and questions', () => {
	assert.equal(knowledge.modules.length, 12);
	assert.ok(knowledge.checklist.length >= 10);
	assert.ok(knowledge.questions.length >= 100);
});

test('RGE Qualibat knowledge base includes critical ITE topics', () => {
	const text = JSON.stringify(knowledge).toLowerCase();
	for (const term of ['rge', 'qualibat', 'bar-en-102', 'pare-vapeur', "lame d'air", 'maprimerenov']) {
		assert.ok(text.includes(term), `Missing ${term}`);
	}
});
