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

export function formatOfflineFacadeAnswer(entries, language = 'fr') {
  const bosnian = {
    'facade-diagnostic': ['Prije svake ITE treba pregledati podlogu i njena oštećenja: vrstu, ravnost, čvrstoću, vlagu, pukotine, kapilarnu vlagu, soli, stare završne slojeve i detalje. Uzroke vlage treba otkloniti, a nestabilne dijelove ukloniti ili popraviti prije ugradnje izolacije.', ['podloga zdrava i dovoljno čvrsta', 'površina čista, suha i kompatibilna sa sistemom', 'pukotine i prodori vode sanirani', 'prozori, klupice, prepusti i instalacije evidentirani']],
    'ite-systems': ['Fasada sa vanjskom izolacijom je kompletan sistem: podloga, pričvršćivanje ili lijepljenje, izolacija, zaštitni slojevi, eventualni zračni sloj, membrana, potkonstrukcija i obloga. Sve komponente moraju pripadati odobrenom sistemu i biti ugrađene prema uputstvu.', ['sistem je tačno identificiran', 'kompatibilnost svih komponenti provjerena', 'uputstvo za ugradnju dostupno na gradilištu']],
    'thermal-layers': ['Toplotni otpor zida zavisi od otpora svih slojeva; debljina i provodljivost izolacije moraju se posmatrati zajedno. Ne određujte učinak samo prema nazivnoj debljini izolacije.', ['debljina i oznaka izolacije evidentirane', 'R-vrijednost sistema provjerena', 'kontinuitet izolacije kontrolisan']],
    'materials': ['Izolacioni materijali se razlikuju po toplotnoj provodljivosti, ponašanju prema vodi, pari i požaru i po stabilnosti. Provjerite tehnički list i dozvoljenu namjenu materijala za odabrani sistem.', ['oznaka i klasifikacija proizvoda provjerene', 'potvrđena namjena ispod maltera ili iza obloge', 'uzeti u obzir voda i požar']],
    'attachments': ['Pričvršćivači i potkonstrukcija moraju biti dimenzionisani prema podlozi, opterećenjima i sistemu. Raspored, dubina sidrenja, podloška, vertikalnost i obrada glava utiču na stabilnost i toplotne mostove.', ['podloga i dubina sidrenja kompatibilne', 'broj i raspored odgovaraju sistemu', 'pričvršćivači nisu labavi ili preduboko ugrađeni', 'toplotni mostovi pričvršćivača uzeti u obzir']],
    'moisture-vapour': ['Tok vodene pare zavisi od unutrašnjih i vanjskih uslova i otpora slojeva difuziji. Parna brana i parna kočnica nisu isto. Kod drvene konstrukcije ili vlaknastih izolacija provjerite sastav zida i kontinuitet zrakonepropusnosti.', ['poznat kompletan sastav zida', 'kontinuitet membrana i spojeva kontrolisan', 'rizik kondenzacije procijenjen kada je potrebno', 'paropropusna vodonepropusna membrana i zračni sloj predviđeni']],
    'thermal-bridges': ['Toplotni mostovi nastaju na spojevima i prodorima: oko prozora, na uglovima, pločama, balkonima, podnožju i vrhu fasade te kod pričvršćivača. Osigurajte kontinuitet izolacije i pravilno odvođenje vode.', ['detalji otvora i spojeva dostupni', 'povrat izolacije kontinuiran', 'profili i opšavi povezani', 'podnožje fasade zaštićeno od prskanja vode']],
    'ventilated-cladding': ['Ventilisana fasada zahtijeva neprekidan zračni sloj, zaštićene donje i gornje otvore, pravilno nivelisanu potkonstrukciju i oblogu pričvršćenu prema sistemu. Ne zatvarajte ventilaciju izolacijom, opšavima ili rešetkama.', ['zračni sloj neprekidan i prohodan', 'donja i gornja ventilacija zaštićene', 'potkonstrukcija poravnata i usidrena', 'obloga i spojevi ugrađeni prema uputstvu']],
    'under-render': ['Kod fasade ispod maltera zaštita izolacije se izvodi kompatibilnim slojevima: armirani osnovni sloj, pravilno utopljena mrežica i obrađeni preklopi, zatim završni sloj. Uglovi, otvori i opterećene zone zahtijevaju predviđena ojačanja.', ['izolacija ravna i spojevi zatvoreni', 'mrežica na pravilnoj dubini', 'preklopi i ojačanja izvedeni', 'vrijeme sušenja i vremenski uslovi ispoštovani']],
    'sequence': ['Siguran redoslijed je: pregled i priprema podloge, obrada detalja, ugradnja izolacije i pričvršćivača, zaštitni slojevi ili potkonstrukcija i zračni sloj, obrada otvora i spojeva, zatim završna obrada i kontrole. Fotografisati svaku fazu prije prekrivanja.', ['podloga prihvaćena prije izolacije', 'spojevi sa drugim radovima usklađeni', 'skrivene faze dokumentovane', 'međukontrola prije zatvaranja']],
    'controls-defects': ['Kontrolišite podlogu, proizvode, raspored, pričvršćivače, kontinuitet izolacije, detalje otvora, odvodnju i ventilaciju obloge. Česti nedostaci su vlažna ili slaba podloga, otvoreni spojevi, loše sidrenje, nedovoljno pokrivena mrežica i prekinut zračni sloj.', ['kontrole datirane i dodijeljene', 'odstupanja otklonjena prije prekrivanja', 'fotografije i tehnički listovi arhivirani', 'rezerva otklonjena pri prijemu']],
    'interfaces': ['Kompletna fasada mora biti usklađena sa prozorima, krovom, hidroizolacijom, ventilacijom, instalacijama, olucima i terenom. Svaki spoj mora zadržati zaštitu od vode i zraka i toplotni kontinuitet.', ['odgovornosti za spojeve pisano definisane', 'spojevi sa prozorima i krovom odobreni', 'instalacije ne oštećuju sistem', 'odvodnja vode očuvana']]
  };
  const label = language === 'bs' ? 'Lokalni odgovor zasnovan na referentnoj bazi ITE/fasada (provjeriti prema ugrađenom sistemu i ugovornoj dokumentaciji).' : 'Réponse locale fondée sur le référentiel ITE/façades (à confirmer avec le système posé et les documents contractuels).';
  return [
    label,
    ...entries.map((entry) => {
      const localized = language === 'bs' ? bosnian[entry.id] : null;
      return `• ${localized?.[0] || entry.summary}\n  ${language === 'bs' ? 'Kontrole' : 'Contrôles'} : ${(localized?.[1] || entry.checks).join('; ')}.`;
    }),
    language === 'bs' ? 'U slučaju nedoumice ne zatvarati zid; provjeriti detalj u tehničkom listu i uputstvu proizvođača.' : 'En cas de doute, ne pas fermer la paroi ; vérifier le détail dans la fiche technique et la notice du fabricant.'
  ].join('\n\n');
}
