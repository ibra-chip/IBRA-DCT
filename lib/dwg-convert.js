// Converts an uploaded AutoCAD .dwg file to .dxf (a plain-text format) via LibreDWG's dwg2dxf,
// built from source into the production image (see Dockerfile). Unlike compressUpload's
// best-effort "fall back to the original on failure" pattern, a DWG that fails to convert must
// NOT be stored as-is: nothing downstream (plan viewer, measurement tool) can read raw DWG bytes,
// so storing them unconverted would silently look like a successful upload while being unusable.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DWG2DXF_BIN = process.env.DWG2DXF_BIN || '/usr/local/bin/dwg2dxf';
const DWG2DXF_TIMEOUT_MS = 30_000;

export async function convertDwgToDxf(buffer) {
	const dir = await mkdtemp(path.join(tmpdir(), 'ibra-dwg-'));
	const inputPath = path.join(dir, 'in.dwg');
	const outputPath = path.join(dir, 'in.dxf');
	try {
		await writeFile(inputPath, buffer);
		await new Promise((resolve, reject) => {
			const child = spawn(DWG2DXF_BIN, [inputPath, '-o', outputPath, '-y']);
			const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('dwg2dxf timed out')); }, DWG2DXF_TIMEOUT_MS);
			let stderr = '';
			child.stderr.on('data', (chunk) => { stderr += chunk; });
			child.on('error', (error) => { clearTimeout(timer); reject(new Error(`dwg2dxf failed to start: ${error.message}`)); });
			// LibreDWG logs "Unstable Class object" and similar warnings to stderr even on a fully
			// successful conversion - those are informational, not failures, so only a non-zero exit
			// code (or a missing/empty output file, checked below) is treated as an error.
			child.on('close', (code) => {
				clearTimeout(timer);
				if (code === 0) resolve();
				else reject(new Error(`dwg2dxf exited with code ${code}: ${stderr.slice(0, 500)}`));
			});
		});
		const dxf = await readFile(outputPath);
		if (!dxf.length) throw new Error('dwg2dxf produced an empty file');
		return dxf;
	} finally {
		await rm(dir, { recursive: true, force: true }).catch(() => {});
	}
}
