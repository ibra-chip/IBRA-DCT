import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const knowledge = JSON.parse(fs.readFileSync(new URL('../knowledge-base/rge-qualibat-ite.json', import.meta.url), 'utf8'));

test('RGE Qualibat knowledge base exposes modules, checklist and questions', () => {
	assert.ok(knowledge.modules.length >= 17);
	assert.ok(knowledge.checklist.length >= 25);
	assert.ok(knowledge.questions.length >= 160);
});

test('RGE Qualibat knowledge base includes critical ITE topics', () => {
	const text = JSON.stringify(knowledge).toLowerCase();
	for (const term of ['rge', 'qualibat', 'bar-en-102', 'pare-vapeur', "lame d'air", 'maprimerenov']) {
		assert.ok(text.includes(term), `Missing ${term}`);
	}
});

test('RGE Qualibat knowledge base includes detailed bardage guidance', () => {
	const text = JSON.stringify(knowledge).toLowerCase();
	for (const term of ['bardage bois', 'bardage metallique', 'trespa', 'fibro-ciment', 'double tasseautage', 'ossature', 'dtu 41.2', 'dtu 45.4']) {
		assert.ok(text.includes(term), `Missing ${term}`);
	}
});
