import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeConstructionDocument, formatConstructionAnalysis } from '../lib/document-auto-analysis.js';

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
