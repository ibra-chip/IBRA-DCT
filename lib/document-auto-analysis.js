const includesAny = (text, terms) => terms.some((term) => text.includes(term));
const unique = (items) => [...new Set(items.filter(Boolean))];

const detectedMaterials = (normalizedText) => {
	const materials = [
		[/\bpse\b|polystyr[èe]ne|polystyrene/, 'PSE / polystyrène'],
		[/\bxps\b|extrud[ée]e|extrude/, 'XPS'],
		[/laine de roche|rockwool|min[ée]rale|mineral/, 'laine minérale / laine de roche'],
		[/fibre de bois|bois fibre/, 'fibre de bois'],
		[/li[èe]ge|liege/, 'liège expansé'],
		[/mousse r[ée]solique|resolique/, 'mousse résolique'],
		[/enduit|sous-enduit|sous enduit|mortier/, 'enduit / sous-enduit'],
		[/treillis|armature|trame|mesh/, 'armature / treillis'],
		[/cheville|fixation|equerre|[ée]querre|rail|tasseau/, 'fixations / ossature'],
		[/bardage bois|clin bois|lame bois/, 'bardage bois'],
		[/m[ée]tallique|metal|acier|aluminium|alu/, 'bardage métallique'],
		[/fibro.?ciment|fibre.?ciment/, 'fibro-ciment'],
		[/trespa|\bhpl\b|stratifi[ée]/, 'HPL / Trespa'],
		[/pare.?pluie|hpv/, 'pare-pluie HPV'],
		[/pare.?vapeur|frein.?vapeur/, 'pare-vapeur / frein-vapeur']
	];
	return materials.filter(([pattern]) => pattern.test(normalizedText)).map(([, label]) => label);
};

const baseResponse = (language) => ({
	summary: language === 'fr' ? 'Le document a été analysé automatiquement à partir du texte PDF disponible.' : 'Dokument je automatski analiziran iz dostupnog PDF teksta.',
	workType: language === 'fr' ? 'Travaux de façade / isolation à confirmer' : 'Fasadni / izolaterski radovi za potvrdu',
	systems: [],
	materials: [],
	howTo: [],
	controls: [],
	evidence: [],
	risks: [],
	confidence: 0.45
});

export function analyzeConstructionDocument({ text = '', fileName = '', evidenceType = 'plan', language = 'sr' } = {}) {
	const normalizedText = `${fileName} ${text}`.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
	const french = language === 'fr';
	const result = baseResponse(language);
	const hasIte = includesAny(normalizedText, ['ite', 'isolation thermique par l exterieur', 'isolation thermique des murs par l exterieur', 'etics', 'sous enduit', 'enduit mince', 'pse', 'laine de roche', 'cheville']);
	const hasBardage = includesAny(normalizedText, ['bardage', 'lame d air', 'ossature', 'tasseau', 'equerre', 'clin', 'trespa', 'hpl', 'fibro ciment', 'fibro-ciment']);
	const hasEnduit = includesAny(normalizedText, ['enduit', 'sous enduit', 'treillis', 'armature', 'marouflage']);
	const hasVentilation = includesAny(normalizedText, ['ventilation', 'entree d air', 'entrees d air', 'vmc', 'lame d air']);
	const hasFire = includesAny(normalizedText, ['incendie', 'feu', 'cpt 3714', 'bande filante', 'reaction au feu']);
	const hasMoisture = includesAny(normalizedText, ['pare vapeur', 'frein vapeur', 'pare pluie', 'hpv', 'sd', 'condensation', 'humidite']);

	if (hasIte && hasBardage) {
		result.workType = french ? 'ITE avec bardage ventilé / vêture à confirmer' : 'ITE sa ventilisanim bardage sistemom / oblogom za potvrdu';
		result.confidence = 0.82;
	} else if (hasBardage) {
		result.workType = french ? 'Bardage ventilé de façade' : 'Ventilisani bardage fasade';
		result.confidence = 0.8;
	} else if (hasIte || hasEnduit) {
		result.workType = french ? 'ITE sous enduit' : 'ITE sous enduit - spoljašnja izolacija pod završnim malterom';
		result.confidence = 0.78;
	}

	result.materials = detectedMaterials(normalizedText);
	if (!result.materials.length) result.materials = [french ? 'Matériaux non clairement identifiés dans le texte PDF' : 'Materijali nisu jasno prepoznati u PDF tekstu'];

	if (hasIte || hasEnduit) {
		result.systems.push(french ? 'Système ITE : support + isolant + collage/calage + chevilles si prévues + armature + sous-enduit + finition.' : 'ITE sistem: podloga + izolator + lijepljenje/calage + tiplovi ako su predviđeni + mrežica/armatura + sous-enduit + završni sloj.');
		result.howTo.push(
			french ? 'Vérifier le support : portance, humidité, fissures, planéité et compatibilité avec le système.' : 'Provjeriti podlogu: nosivost, vlagu, pukotine, ravnost i kompatibilnost sa sistemom.',
			french ? 'Poser les panneaux bord à bord, sans interstice et sans lame d’air parasite derrière l’isolant.' : 'Ploče postaviti bord à bord, bez fuga i bez parazitske lame d’air iza izolatora.',
			french ? 'Réaliser collage/calage et fixations exactement selon Avis Technique/DTA/fabricant.' : 'Lijepljenje/calage i tiplovanje raditi tačno po Avis Technique/DTA/proizvođaču.',
			french ? 'Traiter les points singuliers : soubassement, appuis de baie, angles, tableaux, toiture, descentes EP.' : 'Obraditi kritične detalje: sokl, appuis de baie, uglovi, špalete, krovni spoj, oluci/cijevi.'
		);
		result.controls.push(
			french ? 'Contrôler R/lambda/épaisseur de l’isolant et garder les fiches techniques.' : 'Kontrolisati R/lambda/debljinu izolatora i sačuvati fiche technique.',
			french ? 'Contrôler continuité de l’isolation et absence de ponts thermiques visibles.' : 'Kontrolisati kontinuitet izolacije i da nema vidljivih ponts thermiques.',
			french ? 'Contrôler armature, recouvrements, renforts d’angles et ouvertures avant finition.' : 'Kontrolisati mrežicu/armaturu, preklop, uglove i otvore prije završnog sloja.'
		);
	}

	if (hasBardage) {
		result.systems.push(french ? 'Système bardage ventilé : support + équerres/ossature + isolant + pare-pluie si requis + lame d’air + revêtement.' : 'Bardage ventilé sistem: podloga + équerres/ossature + izolator + pare-pluie ako treba + lame d’air + obloga.');
		result.howTo.push(
			french ? 'Respecter l’entraxe de l’ossature, les fixations et le calcul au vent selon DTU/DTA/fabricant.' : 'Poštovati razmak ossature, fixations i proračun vjetra prema DTU/DTA/proizvođaču.',
			french ? 'Conserver une lame d’air continue, avec entrée basse et sortie haute non bouchées.' : 'Ostaviti kontinuiranu lame d’air, sa donjim ulazom i gornjim izlazom zraka bez blokade.',
			french ? 'Pour bardage bois vertical, prévoir double tasseautage.' : 'Za vertikalni bardage bois predvidjeti double tasseautage.',
			french ? 'Pour panneaux métal/fibro-ciment/HPL/Trespa, respecter jeux de dilatation et points fixes/coulissants.' : 'Za metal/fibro-ciment/HPL/Trespa panele poštovati dilataciju i tačke fiksiranja/klizanja.'
		);
		result.controls.push(
			french ? 'Contrôler la lame d’air minimale de 2 cm, sauf exigence supérieure du système.' : 'Kontrolisati minimalnu lame d’air 2 cm, osim ako sistem traži više.',
			french ? 'Contrôler pare-pluie HPV, recouvrements et évacuation d’eau lorsque requis.' : 'Kontrolisati pare-pluie HPV, preklop i odvod vode kada je predviđeno.',
			french ? 'Contrôler fixations, corrosion, coupes, angles, soubassement et tableaux.' : 'Kontrolisati fixations, koroziju, rezove, uglove, sokl i špalete.'
		);
	}

	if (hasVentilation) result.controls.push(french ? 'Ne pas supprimer les entrées d’air sans solution VMC/ventilation équivalente.' : 'Ne uklanjati entrées d’air bez zamjenskog VMC/ventilacionog rješenja.');
	if (hasFire) result.risks.push(french ? 'Risque incendie : vérifier règles feu façade, catégorie du bâtiment, bandes filantes/CPT 3714 si PSE.' : 'Rizik požara: provjeriti règles feu façade, kategoriju zgrade, bandes filantes/CPT 3714 ako je PSE.');
	if (hasMoisture) result.risks.push(french ? 'Risque humidité/condensation : vérifier Sd, pare-vapeur/frein-vapeur/pare-pluie et capacité de séchage du mur.' : 'Rizik vlage/kondenzacije: provjeriti Sd, pare-vapeur/frein-vapeur/pare-pluie i mogućnost sušenja zida.');

	result.evidence.push(
		french ? 'Photo du support avant travaux.' : 'Fotografija podloge prije radova.',
		french ? 'Photo des étiquettes isolant, épaisseur, R/lambda et fiches techniques.' : 'Fotografija etiketa izolatora, debljine, R/lambda i fiches techniques.',
		french ? 'Photo collage/calage/fixations/ossature avant fermeture.' : 'Fotografija collage/calage/fixations/ossature prije zatvaranja.',
		french ? 'Photo des points singuliers : baies, angles, soubassement, toiture, ventilation.' : 'Fotografija kritičnih detalja: otvori, uglovi, sokl, krovni spoj, ventilacija.',
		french ? 'PV de réception et réserves éventuelles.' : 'PV réception i eventualne rezerve.'
	);
	if (!result.risks.length) result.risks.push(french ? 'Si une information manque dans le PDF, ne pas deviner : demander la fiche technique, DTA/Avis Technique ou validation Conducteur/Gérant.' : 'Ako podatak nije u PDF-u, ne nagađati: tražiti fiche technique, DTA/Avis Technique ili potvrdu Conducteur/Gérant.');

	return {
		status: text.trim() ? 'auto_analyzed' : 'needs_ocr',
		fileName,
		evidenceType,
		...result,
		systems: unique(result.systems),
		materials: unique(result.materials),
		howTo: unique(result.howTo),
		controls: unique(result.controls),
		evidence: unique(result.evidence),
		risks: unique(result.risks),
		requiresHumanConfirmation: true
	};
}

export function analyzeConstructionPhoto({ fileName = '', evidenceType = 'photo-during', language = 'sr', vision = null, visionStatus = 'not_configured' } = {}) {
	const french = language === 'fr';
	const phase = {
		'photo-before': french ? 'Photo avant travaux' : 'Fotografija prije radova',
		'photo-during': french ? 'Photo pendant travaux' : 'Fotografija tokom radova',
		'photo-after': french ? 'Photo après travaux' : 'Fotografija poslije radova'
	}[evidenceType] || (french ? 'Photo chantier' : 'Fotografija chantier-a');
	const result = {
		status: vision ? 'photo_ai_analyzed' : `photo_${visionStatus}`,
		fileName,
		evidenceType,
		summary: french ? 'La photo a été analysée automatiquement.' : 'Fotografija je automatski analizirana.',
		workType: vision?.workType || (french ? `${phase} - travaux de façade/ITE/bardage à confirmer` : `${phase} - fasada/ITE/bardage za potvrdu`),
		systems: vision?.systems || [],
		materials: vision?.materials || [],
		howTo: vision?.howTo || [],
		controls: vision?.controls || [],
		evidence: vision?.evidence || [],
		risks: vision?.risks || [],
		confidence: Number.isFinite(Number(vision?.confidence)) ? Number(vision.confidence) : 0.45,
		requiresHumanConfirmation: true
	};
	if (!result.systems.length) result.systems.push(french ? 'Identifier visuellement si la photo montre ITE sous enduit, bardage ventilé, support, isolant, ossature ou finition.' : 'Vizuelno potvrditi da li slika pokazuje ITE sous enduit, bardage ventilé, podlogu, izolator, ossature ili završni sloj.');
	if (!result.materials.length) result.materials.push(french ? 'Matériaux à confirmer par fiche technique/DTA : isolant, enduit, pare-pluie, fixations, bardage.' : 'Materijale potvrditi kroz fiche technique/DTA: izolator, enduit, pare-pluie, fixations, bardage.');
	if (!result.howTo.length) {
		result.howTo.push(
			french ? 'Comparer la photo avec le plan et la fiche technique avant de valider la phase.' : 'Uporediti sliku sa planom i fiche technique prije potvrde faze.',
			french ? 'Ne pas accepter une phase cachée sans photo claire du support, isolant, fixations/ossature et détails.' : 'Ne prihvatati skrivenu fazu bez jasne slike podloge, izolatora, fixations/ossature i detalja.'
		);
	}
	if (!result.controls.length) {
		result.controls.push(
			french ? 'Contrôler continuité de l’isolation, ponts thermiques, alignement, fixations et détails autour des baies.' : 'Kontrolisati kontinuitet izolacije, ponts thermiques, ravninu, fixations i detalje oko otvora.',
			french ? 'Pour bardage, contrôler lame d’air continue, entrée/sortie d’air et pare-pluie.' : 'Za bardage kontrolisati kontinuiranu lame d’air, ulaz/izlaz zraka i pare-pluie.',
			french ? 'Pour ITE sous enduit, contrôler collage/calage, chevilles, armature, recouvrements et finition.' : 'Za ITE sous enduit kontrolisati collage/calage, tiplove, armaturu, preklop i završni sloj.'
		);
	}
	if (!result.evidence.length) {
		if (evidenceType === 'photo-before') result.evidence.push(french ? 'Garder une photo large du support avant travaux, avec défauts, humidité, fissures et points singuliers.' : 'Sačuvati široku sliku podloge prije radova, sa vlagom, pukotinama i kritičnim detaljima.');
		if (evidenceType === 'photo-during') result.evidence.push(french ? 'Garder des photos avant fermeture : isolant, étiquettes, épaisseur, fixations, ossature, pare-pluie ou armature.' : 'Sačuvati slike prije zatvaranja: izolator, etikete, debljina, fixations, ossature, pare-pluie ili armatura.');
		if (evidenceType === 'photo-after') result.evidence.push(french ? 'Garder des photos finales : façade complète, baies, angles, soubassement, toiture et finitions.' : 'Sačuvati završne slike: cijela fasada, otvori, uglovi, sokl, krovni spoj i završni detalji.');
	}
	if (!result.risks.length) result.risks.push(french ? 'Une photo seule ne prouve pas les performances : garder aussi plan, fiche technique, R/lambda, DTA/Avis Technique et PV de réception.' : 'Sama slika ne dokazuje performanse: sačuvati i plan, fiche technique, R/lambda, DTA/Avis Technique i PV réception.');
	return {
		...result,
		systems: unique(result.systems),
		materials: unique(result.materials),
		howTo: unique(result.howTo),
		controls: unique(result.controls),
		evidence: unique(result.evidence),
		risks: unique(result.risks)
	};
}

export function formatConstructionAnalysis(analysis, language = 'sr') {
	const french = language === 'fr';
	const section = (title, items) => `${title}\n${items.map((item) => `- ${item}`).join('\n')}`;
	return [
		`${french ? 'Type de travaux' : 'U čemu se radi'}: ${analysis.workType}`,
		section(french ? 'Système / matériaux détectés' : 'Sistem / materijali koji su prepoznati', [...analysis.systems, ...analysis.materials]),
		section(french ? 'Comment exécuter' : 'Kako se radi', analysis.howTo),
		section(french ? 'Contrôles obligatoires' : 'Šta kontrolisati', analysis.controls),
		section(french ? 'Preuves à photographier' : 'Šta slikati kao dokaz', analysis.evidence),
		section(french ? 'Risques / points à confirmer' : 'Rizici / šta potvrditi', analysis.risks)
	].join('\n\n');
}
