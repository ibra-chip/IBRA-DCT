// Copies exactly the files server.js already serves publicly (see `publicFiles` in server.js) into
// public-pages/, so a static host (Cloudflare Pages) can serve the frontend without ever exposing
// server.js, lib/, data.json or anything else in the repo.
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = path.join(root, 'public-pages');

const files = ['index.html', 'script.js', 'styles.css', 'logo.svg', 'manifest.webmanifest', 'sw.js', 'knowledge-base/rge-qualibat-ite.json'];

await mkdir(outDir, { recursive: true });
for (const file of files) {
	const destination = path.join(outDir, file);
	await mkdir(path.dirname(destination), { recursive: true });
	await copyFile(path.join(root, file), destination);
	console.log(`copied ${file}`);
}
