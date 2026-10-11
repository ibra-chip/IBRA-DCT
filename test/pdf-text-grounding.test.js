import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { cleanExtractedPdfText } from '../lib/pdf-text-grounding.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
const parsePdf = async (buffer) => new PDFParse({ data: buffer }).getText();

test('cleanExtractedPdfText strips pdf-parse page separators and leaves nothing for a fully blank/scanned document', async () => {
	// Mirrors a real scanned plan: no embedded text layer, just raster images - pdf-parse still
	// emits "-- N of M --" markers per page, which must never be mistaken for real document content.
	const doc = await PDFDocument.create();
	for (let i = 0; i < 10; i += 1) doc.addPage([400, 300]);
	const buffer = Buffer.from(await doc.save());
	const { text } = await parsePdf(buffer);
	assert.ok(text.length > 20, 'sanity check: raw pdf-parse output on its own would wrongly look "textful"');
	assert.equal(cleanExtractedPdfText(text), '');
});

test('cleanExtractedPdfText preserves real text found anywhere across a multi-page document', async () => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let i = 0; i < 5; i += 1) {
		const page = doc.addPage([400, 300]);
		if (i === 3) page.drawText("Lame d'air ventilee de 2 cm minimum", { x: 20, y: 200, size: 10, font });
	}
	const buffer = Buffer.from(await doc.save());
	const { text } = await parsePdf(buffer);
	const cleaned = cleanExtractedPdfText(text);
	assert.ok(cleaned.includes('2 cm minimum'), 'the real dimension text must survive cleaning');
	assert.ok(!/--\s*\d+\s+of\s+\d+\s*--/.test(cleaned), 'page-separator artifacts must not remain');
});

test('cleanExtractedPdfText handles null/undefined/empty input without throwing', () => {
	assert.equal(cleanExtractedPdfText(null), '');
	assert.equal(cleanExtractedPdfText(undefined), '');
	assert.equal(cleanExtractedPdfText(''), '');
});
