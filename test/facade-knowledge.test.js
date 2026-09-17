import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFacadeKnowledge, findFacadeKnowledge, formatOfflineFacadeAnswer } from '../lib/facade-knowledge.js';

test('local facade knowledge covers the requested construction domains', async () => {
  const knowledge = await loadFacadeKnowledge(process.cwd());
  const text = knowledge.entries.flatMap((entry) => [entry.id, ...entry.topics]).join(' ');
  for (const term of ['bardage', 'condensation', 'pont', 'fixation', 'contrôle', 'séquence']) {
    assert.match(text, new RegExp(term, 'i'));
  }
  assert.ok(knowledge.entries.length >= 10);
});

test('retrieval returns cited, concise offline guidance', async () => {
  const knowledge = await loadFacadeKnowledge(process.cwd());
  const entries = findFacadeKnowledge(knowledge, 'Comment contrôler les fixations et les ponts thermiques en bardage ?');
  assert.ok(entries.length > 0);
  assert.ok(entries.every((entry) => entry.sources?.[0]?.pages));
  assert.match(formatOfflineFacadeAnswer(entries), /Réponse locale/);
  assert.doesNotMatch(formatOfflineFacadeAnswer(entries), /Conducteur/);
});

test('retrieval changes with the question topic', async () => {
  const knowledge = await loadFacadeKnowledge(process.cwd());
  const support = findFacadeKnowledge(knowledge, 'Kako pripremiti vlažan i ispucan zid pre izolacije?');
  const ventilation = findFacadeKnowledge(knowledge, 'Kako proveriti ventilisanu lame d’air kod bardage fasade?');
  assert.equal(support[0].id, 'facade-diagnostic');
  assert.equal(ventilation[0].id, 'ventilated-cladding');
});
