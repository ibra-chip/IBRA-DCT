// Curated, verified reference links (video/guide) from authoritative French
// construction-quality bodies, matched to the work type an analysis detects.
// Deliberately not AI-generated or guessed: construction technique accuracy
// matters for RGE/Qualibat compliance, so every URL here was checked by hand.
const REFERENCE_SETS = [
	{
		id: 'bardage',
		test: /bardage|vêtur|vetur|clin bois|fibro.?ciment|\bhpl\b|trespa/i,
		references: [
			{ title: 'ITE par bardage ventilé — nouveau calepin de chantier (Profeel)', url: 'https://programmeprofeel.fr/journal/ite-par-bardage-ventile-un-nouveau-calepin-de-chantier-disponible/' },
			{ title: "Procédés d'ITE par bardage ventilé — calepin de chantier (Pro'Réno)", url: 'https://www.proreno.fr/documents/procedes-ite-par-bardage-ventile-calepin-chantier' }
		]
	},
	{
		id: 'ite-enduit',
		test: /\bite\b|isolation thermique|sous.?enduit|etics|enduit/i,
		references: [
			{ title: "L'ITE en rénovation : préparer le support et choisir un procédé (AQC, vidéo)", url: 'https://qualiteconstruction.com/ressource/rex-batiments-performants/tuto-ite-renovation-preparer-support-choisir-procede-isolation-adapte/' },
			{ title: "Systèmes ETICS en pose initiale — fiche pathologie (Agence Qualité Construction)", url: 'https://qualiteconstruction.com/ressource/fiches-pathologie-batiment/systemes-isolation-thermique-exterieur-etics-pose-initiale/' }
		]
	}
];

const GENERAL_REFERENCE = { title: 'Fiches pathologie bâtiment et bonnes pratiques (Agence Qualité Construction)', url: 'https://qualiteconstruction.com/' };

export function attachReferenceLinks(analysis) {
	if (!analysis) return analysis;
	const haystack = `${analysis.workType || ''} ${(analysis.systems || []).join(' ')} ${(analysis.materials || []).join(' ')}`;
	const matched = REFERENCE_SETS.filter((set) => set.test.test(haystack));
	analysis.references = matched.length ? matched.flatMap((set) => set.references) : [GENERAL_REFERENCE];
	return analysis;
}
