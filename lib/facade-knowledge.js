import fs from 'node:fs/promises';
import path from 'node:path';

let cachedKnowledge;

export async function loadFacadeKnowledge(root) {
  if (!cachedKnowledge) {
    const file = path.join(root, 'knowledge-base', 'ite-facades.json');
    cachedKnowledge = JSON.parse(await fs.readFile(file, 'utf8'));
  }
  return cachedKnowledge;
}

export function findFacadeKnowledge(knowledge, question, limit = 3) {
  const normalized = String(question || '').toLowerCase();
  const tokens = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  return knowledge.entries
    .map((entry) => {
      const haystack = `${entry.id} ${entry.topics.join(' ')} ${entry.summary} ${entry.checks.join(' ')}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? (entry.topics.some((topic) => topic.includes(token)) ? 3 : 1) : 0), 0);
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export function formatOfflineFacadeAnswer(entries) {
  return [
    'Réponse locale fondée sur le référentiel ITE/façades (à confirmer avec le système posé et les documents contractuels).',
    ...entries.map((entry) => `• ${entry.summary}\n  Contrôles : ${entry.checks.join('; ')}.`),
    'En cas de doute, arrêter la fermeture de la paroi et faire valider le détail par le Conducteur de travaux ou le fabricant.'
  ].join('\n\n');
}
