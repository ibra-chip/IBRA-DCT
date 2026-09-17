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
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const stopWords = new Set(['avec', 'dans', 'pour', 'comment', 'quelle', 'quelles', 'quel', 'quels', 'est', 'sont', 'faire', 'faire', 'avant', 'apres', 'entre', 'sur', 'les', 'des', 'une', 'aux', 'the', 'and']);
  const aliases = new Map([
    ['fasade', 'facade'], ['fasadu', 'facade'], ['zid', 'support'], ['zidovi', 'support'],
    ['vlazan', 'humidite'], ['vlazna', 'humidite'], ['ispucan', 'pathologie'], ['ispucala', 'pathologie'],
    ['pripremiti', 'preparation'], ['priprema', 'preparation'],
    ['izolacija', 'isolant'], ['izolaciju', 'isolant'], ['stiropor', 'pse'], ['kamena', 'laine'],
    ['vuna', 'laine'], ['tiplovi', 'chevilles'], ['tipl', 'chevilles'], ['srafovi', 'fixations'],
    ['sraf', 'fixations'], ['kacenje', 'fixations'], ['ventilacija', 'lame'], ['vazduh', 'lame'],
    ['malter', 'enduit'], ['mreza', 'treillis'], ['sloj', 'couches'], ['red', 'sequence'],
    ['redosled', 'sequence'], ['vlaga', 'humidite'], ['most', 'pont'], ['spojevi', 'interfaces'],
    ['prozor', 'baie'], ['prozori', 'baie'], ['kontrola', 'controle'], ['provera', 'controle']
  ]);
  const tokens = normalize(question).split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token))
    .map((token) => aliases.get(token) || token);
  if (!tokens.length) return [];
  return knowledge.entries
    .map((entry) => {
      const topics = entry.topics.map(normalize);
      const haystack = normalize(`${entry.id} ${entry.topics.join(' ')} ${entry.summary} ${entry.checks.join(' ')}`);
      const topicScore = tokens.reduce((total, token) => total + (topics.some((topic) => topic === token || topic.includes(token) || token.includes(topic)) ? 5 : 0), 0);
      const contentScore = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { entry, score: topicScore + contentScore, topicScore };
    })
    .filter(({ score, topicScore }) => topicScore > 0 || score >= 3)
    .sort((a, b) => b.score - a.score || b.topicScore - a.topicScore)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export function formatOfflineFacadeAnswer(entries) {
  return [
    'Réponse locale fondée sur le référentiel ITE/façades (à confirmer avec le système posé et les documents contractuels).',
    ...entries.map((entry) => `• ${entry.summary}\n  Contrôles : ${entry.checks.join('; ')}.`),
    'En cas de doute, ne pas fermer la paroi ; vérifier le détail dans la fiche technique et la notice du fabricant.'
  ].join('\n\n');
}
