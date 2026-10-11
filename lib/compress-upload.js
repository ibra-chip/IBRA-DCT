// Shrinks files before they go to storage: PDFs via Ghostscript (downsamples embedded images to
// ~150 DPI, the same "ebook" preset most PDF tools use), images via sharp (caps the longest side
// and re-encodes). Both are best-effort: any failure, timeout, or output that isn't smaller falls
// back to the original buffer untouched, so a missing binary or a weird input never blocks an upload.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const GS_TIMEOUT_MS = 20_000;
const MAX_IMAGE_DIMENSION = 1920;

async function runGhostscript(inputPath, outputPath) {
	await new Promise((resolve, reject) => {
		const args = [
			'-sDEVICE=pdfwrite',
			'-dCompatibilityLevel=1.4',
			'-dPDFSETTINGS=/ebook',
			'-dNOPAUSE',
			'-dBATCH',
			'-dQUIET',
			`-sOutputFile=${outputPath}`,
			inputPath,
		];
		const child = spawn('gs', args);
		const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Ghostscript timed out')); }, GS_TIMEOUT_MS);
		let stderr = '';
		child.stderr.on('data', (chunk) => { stderr += chunk; });
		child.on('error', (error) => { clearTimeout(timer); reject(error); });
		child.on('close', (code) => {
			clearTimeout(timer);
			if (code === 0) resolve();
			else reject(new Error(`Ghostscript exited with code ${code}: ${stderr.slice(0, 500)}`));
		});
	});
}

async function compressPdf(buffer) {
	const dir = await mkdtemp(path.join(tmpdir(), 'ibra-pdf-'));
	const inputPath = path.join(dir, 'in.pdf');
	const outputPath = path.join(dir, 'out.pdf');
	try {
		await writeFile(inputPath, buffer);
		await runGhostscript(inputPath, outputPath);
		const compressed = await readFile(outputPath);
		return compressed.length > 0 && compressed.length < buffer.length ? compressed : buffer;
	} finally {
		await rm(dir, { recursive: true, force: true }).catch(() => {});
	}
}

async function compressImage(buffer, mimeType) {
	let pipeline = sharp(buffer, { failOn: 'none' }).rotate();
	const metadata = await pipeline.metadata().catch(() => null);
	if (metadata && (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION)) {
		pipeline = pipeline.resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true });
	}
	const isPng = mimeType === 'image/png';
	// PNG stays lossless (no palette quantization) - only the dimension cap above shrinks it.
	// JPEG quality 82 with mozjpeg is visually indistinguishable from the source at normal zoom.
	const compressed = isPng ? await pipeline.png({ compressionLevel: 9 }).toBuffer() : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
	return compressed.length > 0 && compressed.length < buffer.length ? compressed : buffer;
}

// Returns a possibly-smaller buffer for the given mimeType, or the original buffer unchanged if
// compression isn't applicable, fails, or doesn't actually help.
export async function compressUpload(buffer, mimeType) {
	try {
		if (mimeType === 'application/pdf') return await compressPdf(buffer);
		if (typeof mimeType === 'string' && mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') return await compressImage(buffer, mimeType);
	} catch (error) {
		console.warn('compressUpload: falling back to original file:', error.message);
	}
	return buffer;
}
