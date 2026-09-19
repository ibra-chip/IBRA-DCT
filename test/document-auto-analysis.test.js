import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeConstructionDocument, analyzeConstructionPhoto, formatConstructionAnalysis } from '../lib/document-auto-analysis.js';

test('automatic document analysis detects ITE sous enduit work', () => {
	const analysis = analyzeConstructionDocument({
		fileName: 'fiche-technique-ite-pse.pdf',
		evidenceType: 'fiche-technique',
		text: 'Système ITE sous enduit mince avec PSE, collage calage, chevilles, treillis armature, appuis de baie, CPT 3714 feu façade.',
		language: 'sr'
	});
	assert.match(analysis.workType, /ITE/);
	assert.ok(analysis.materials.some((item) => item.includes('PSE')));
	assert.ok(analysis.howTo.some((item) => item.includes('Ploče') || item.includes('lijepljenje')));
	assert.ok(analysis.risks.some((item) => item.includes('požara')));
	assert.match(formatConstructionAnalysis(analysis, 'sr'), /U čemu se radi/);
});

test('automatic document analysis detects bardage ventilated work in French', () => {
	const analysis = analyzeConstructionDocument({
		fileName: 'plan-bardage-trespa.pdf',
		evidenceType: 'plan',
		text: "Bardage ventilé HPL Trespa sur ossature métallique avec équerres, pare-pluie HPV, lame d air 20 mm et double tasseautage.",
		language: 'fr'
	});
	assert.match(analysis.workType, /Bardage|ITE/);
	assert.ok(analysis.materials.some((item) => item.includes('Trespa')));
	assert.ok(analysis.controls.some((item) => item.includes("lame d’air")));
	assert.match(formatConstructionAnalysis(analysis, 'fr'), /Type de travaux/);
});

test('automatic photo analysis returns chantier controls without vision AI', () => {
	const analysis = analyzeConstructionPhoto({
		fileName: 'photo-pendant-travaux.jpg',
		evidenceType: 'photo-during',
		language: 'sr',
		visionStatus: 'not_configured'
	});
	assert.match(analysis.workType, /Fotografija tokom radova/);
	assert.ok(analysis.controls.some((item) => item.includes('bardage')));
	assert.ok(analysis.evidence.some((item) => item.includes('izolator')));
	assert.match(formatConstructionAnalysis(analysis, 'sr'), /Šta slikati kao dokaz/);
});

test('automatic photo analysis uses vision AI details when available', () => {
	const analysis = analyzeConstructionPhoto({
		fileName: 'photo-bardage.jpg',
		evidenceType: 'photo-during',
		language: 'fr',
		vision: {
			workType: 'Bardage ventilé en cours',
			systems: ['Ossature métallique avec lame d’air'],
			materials: ['HPL / Trespa'],
			howTo: ['Respecter les jeux de dilatation.'],
			controls: ['Contrôler les fixations visibles.'],
			evidence: ['Photo de la lame d’air.'],
			risks: ['Confirmer le DTA.'],
			confidence: 0.76
		}
	});
	assert.equal(analysis.status, 'photo_ai_analyzed');
	assert.equal(analysis.confidence, 0.76);
	assert.ok(analysis.materials.includes('HPL / Trespa'));
	assert.match(formatConstructionAnalysis(analysis, 'fr'), /Bardage ventilé/);
});
