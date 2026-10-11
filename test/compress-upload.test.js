import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { compressUpload } from '../lib/compress-upload.js';

async function makePhotoBuffer(width, height) {
	const raw = Buffer.alloc(width * height * 3);
	for (let i = 0; i < raw.length; i++) raw[i] = (i * 37 + (i >> 3) * 13) % 256;
	return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}

async function makePdfBuffer(photoBuffer, pages) {
	const pdfDoc = await PDFDocument.create();
	const image = await pdfDoc.embedJpg(photoBuffer);
	for (let i = 0; i < pages; i++) {
		const page = pdfDoc.addPage([image.width / 4, image.height / 4]);
		page.drawImage(image, { x: 0, y: 0, width: image.width / 4, height: image.height / 4 });
	}
	return Buffer.from(await pdfDoc.save());
}

test('compressUpload shrinks a large photo-heavy PDF while keeping it a valid, smaller PDF', async () => {
	const photo = await makePhotoBuffer(4000, 3000);
	const pdf = await makePdfBuffer(photo, 6);
	const compressed = await compressUpload(pdf, 'application/pdf');
	assert.ok(compressed.length < pdf.length * 0.5, `expected meaningful shrinkage, got ${pdf.length} -> ${compressed.length}`);
	assert.equal(compressed.subarray(0, 4).toString(), '%PDF');
});

test('compressUpload shrinks an oversized JPEG and caps its dimensions', async () => {
	const photo = await makePhotoBuffer(4000, 3000);
	const compressed = await compressUpload(photo, 'image/jpeg');
	assert.ok(compressed.length < photo.length, `expected smaller output, got ${photo.length} -> ${compressed.length}`);
	const metadata = await sharp(compressed).metadata();
	assert.ok(metadata.width <= 1920 && metadata.height <= 1920);
});

test('compressUpload never enlarges an already-small image', async () => {
	const tiny = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } }).jpeg().toBuffer();
	const result = await compressUpload(tiny, 'image/jpeg');
	assert.ok(result.length <= tiny.length * 1.1, 'small images should not grow noticeably');
});

test('compressUpload falls back to the original buffer, never throwing, for a corrupt PDF', async () => {
	const garbage = Buffer.from('this is not a real pdf');
	const result = await compressUpload(garbage, 'application/pdf');
	assert.ok(result.equals(garbage));
});

test('compressUpload falls back to the original buffer for an unsupported mimetype', async () => {
	const buffer = Buffer.from('plain text content');
	const result = await compressUpload(buffer, 'text/plain');
	assert.ok(result.equals(buffer));
});

test('compressUpload leaves svg images untouched', async () => {
	const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
	const result = await compressUpload(svg, 'image/svg+xml');
	assert.ok(result.equals(svg));
});
