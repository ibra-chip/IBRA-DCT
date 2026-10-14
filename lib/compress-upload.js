// Shrinks files before they go to storage: PDFs via Ghostscript (downsamples embedded images to
// ~300 DPI, the "printer" preset - the app's AI document reading relies on fine print like glossary
// diagrams and dimension tables staying legible, so this trades some of the "ebook" preset's extra
// savings for that), images via sharp (caps the longest side and re-encodes). Both are best-effort:
// any failure, timeout, or output that isn't smaller falls back to the original buffer untouched,
// so a missing binary or a weird input never blocks an upload.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const GS_TIMEOUT_MS = 20_000;
const MAX_IMAGE_DIMENSION = 1920;
// Below these sizes the file is already small enough that spawning Ghostscript/sharp just adds
// upload latency for little to no real saving - skip straight to "use the original".
const MIN_PDF_SIZE_FOR_COMPRESSION = 800 * 1024;
const MIN_IMAGE_SIZE_FOR_COMPRESSION = 600 * 1024;

async function runGhostscript(inputPath, outputPath) {
	await new Promise((resolve, reject) => {
		const args = [
			'-sDEVICE=pdfwrite',
			'-dCompatibilityLevel=1.4',
			'-dPDFSETTINGS=/printer',
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

// Renders one page of a PDF to a PNG for the plan measurement tool (calibrated on-screen takeoff: the
// user clicks two points of a known real-world distance to set a scale, then traces lines/polygons on
// this image - no AI involved, just geometry, so it needs a real raster of the page to draw on top of).
// A real architectural PDF set is routinely many pages (a cover sheet, then each facade/floor/detail on
// its own page) - pageNumber lets the caller rasterize whichever one the gérant actually wants to measure,
// not just the first.
export async function rasterizePdfPage(buffer, dpi = 150, pageNumber = 1) {
	const dir = await mkdtemp(path.join(tmpdir(), 'ibra-pdf-raster-'));
	const inputPath = path.join(dir, 'in.pdf');
	const outputPath = path.join(dir, 'out.png');
	try {
		await writeFile(inputPath, buffer);
		await new Promise((resolve, reject) => {
			const args = ['-sDEVICE=png16m', `-r${dpi}`, `-dFirstPage=${pageNumber}`, `-dLastPage=${pageNumber}`, '-dNOPAUSE', '-dBATCH', '-dQUIET', `-sOutputFile=${outputPath}`, inputPath];
			const child = spawn('gs', args);
			const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Ghostscript rasterize timed out')); }, GS_TIMEOUT_MS);
			let stderr = '';
			child.stderr.on('data', (chunk) => { stderr += chunk; });
			child.on('error', (error) => { clearTimeout(timer); reject(error); });
			child.on('close', (code) => {
				clearTimeout(timer);
				if (code === 0) resolve();
				else reject(new Error(`Ghostscript rasterize exited with code ${code}: ${stderr.slice(0, 500)}`));
			});
		});
		const png = await readFile(outputPath);
		if (!png.length) throw new Error('Ghostscript produced an empty PNG');
		return png;
	} finally {
		await rm(dir, { recursive: true, force: true }).catch(() => {});
	}
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
		if (mimeType === 'application/pdf' && buffer.length >= MIN_PDF_SIZE_FOR_COMPRESSION) return await compressPdf(buffer);
		if (typeof mimeType === 'string' && mimeType.startsWith('image/') && mimeType !== 'image/svg+xml' && buffer.length >= MIN_IMAGE_SIZE_FOR_COMPRESSION) return await compressImage(buffer, mimeType);
	} catch (error) {
		console.warn('compressUpload: falling back to original file:', error.message);
	}
	return buffer;
}
