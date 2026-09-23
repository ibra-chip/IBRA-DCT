import bcrypt from 'bcryptjs';
import cors from 'cors';
import crypto from 'node:crypto';
import 'dotenv/config';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { analyzeConstructionDocument, analyzeConstructionPhoto, formatConstructionAnalysis } from './lib/document-auto-analysis.js';
import { attachReferenceLinks } from './lib/reference-library.js';
import { extractPdfRules } from './lib/rule-extraction.js';
import { findFacadeKnowledge, formatOfflineFacadeAnswer, loadFacadeKnowledge } from './lib/facade-knowledge.js';
import { cleanSiret, companyKeyForUser, isAllowedIdentityAsset, normalizeProjectIds } from './lib/workforce-domain.js';
import { UPLOADS_BUCKET, IDENTITY_BUCKET, ensureBuckets, uploadFile, downloadFile, deleteFile, publicUrl } from './lib/storage.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import webpush from 'web-push';

const vapidPublicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
const vapidPrivateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
const vapidKeyPattern = /^[A-Za-z0-9_-]+$/;
let pushEnabled = Boolean(vapidPublicKey && vapidPrivateKey && vapidKeyPattern.test(vapidPublicKey) && vapidKeyPattern.test(vapidPrivateKey));
if (pushEnabled) {
	try { webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@ibra-ba.net', vapidPublicKey, vapidPrivateKey); }
	catch (error) { console.error('VAPID keys invalid, push notifications disabled:', error.message); pushEnabled = false; }
} else {
	const publicOk = vapidKeyPattern.test(vapidPublicKey);
	const privateOk = vapidKeyPattern.test(vapidPrivateKey);
	console.warn(
		`Push notifications disabled. publicKey: present=${Boolean(vapidPublicKey)} length=${vapidPublicKey.length} validChars=${publicOk}; ` +
		`privateKey: present=${Boolean(vapidPrivateKey)} length=${vapidPrivateKey.length} validChars=${privateOk}`
	);
}
async function sendPushToUser(data, userId, payload) {
	if (!pushEnabled) return;
	const subscriptions = (data.pushSubscriptions || []).filter((item) => item.userId === userId);
	if (!subscriptions.length) return;
	const expired = [];
	await Promise.all(subscriptions.map(async (subscription) => {
		try { await webpush.sendNotification(subscription.subscription, JSON.stringify(payload)); }
		catch (error) { if (error.statusCode === 404 || error.statusCode === 410) expired.push(subscription.endpoint); }
	}));
	if (expired.length) data.pushSubscriptions = (data.pushSubscriptions || []).filter((item) => !expired.includes(item.endpoint));
}

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
const parsePdf = async (buffer) => { const parser = new PDFParse({ data: buffer }); return parser.getText(); };
const extractPdfImages = async (buffer, { maxImages = 6, maxPages = 12 } = {}) => {
	const parser = new PDFParse({ data: buffer });
	try {
		const result = await parser.getImage({ imageThreshold: 120, first: maxPages });
		const images = [];
		for (const page of result.pages || []) {
			for (const image of page.images || []) {
				images.push({ page: page.pageNumber, dataUrl: image.dataUrl, width: image.width, height: image.height });
				if (images.length >= maxImages) return images;
			}
		}
		return images;
	} finally {
		await parser.destroy();
	}
};
const extractPdfImagesWithTimeout = (buffer, options, timeoutMs = 8000) => Promise.race([
	extractPdfImages(buffer, options),
	new Promise((resolve) => setTimeout(() => resolve([]), timeoutMs))
]);

const app = express();
const root = process.env.IBRA_APP_ROOT ? path.resolve(process.env.IBRA_APP_ROOT) : process.cwd();
const persistentRoot = process.env.IBRA_DATA_DIR || root;
const dataPath = path.join(persistentRoot, 'data.json');
const secret = process.env.IBRA_JWT_SECRET || 'local-development-secret-change-before-deploy';
const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);
const renderBranch = process.env.RENDER_GIT_BRANCH || process.env.RENDER_BRANCH || '';
const strictSupabaseRequired = process.env.NODE_ENV === 'production' && (!renderBranch || renderBranch === 'main' || process.env.REQUIRE_SUPABASE === 'true');
const facadeKnowledge = await loadFacadeKnowledge(root);
console.log('IBRA app root:', root);
if (!supabaseConfigured) {
	const message = 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured; using local data.json fallback.';
	if (strictSupabaseRequired) throw new Error(`${message} Set both variables on the main Render service.`);
	console.warn(message);
}
const storageKeyFor = (originalName) => `${Date.now()}-${String(originalName || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
const fixUploadFilenameEncoding = (request, _response, next) => { if (request.file?.originalname) request.file.originalname = Buffer.from(request.file.originalname, 'latin1').toString('utf8'); next(); };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const identityUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_request, file, callback) => callback(isAllowedIdentityAsset(file) ? null : new Error('Choisissez un fichier JPG ou PNG de 5 Mo maximum.'), true) });
const identityUploadMiddleware = (field) => (request, response, next) => identityUpload.single(field)(request, response, async (error) => {
	if (error) return response.status(400).json({ error: 'Choisissez un fichier JPG ou PNG de 5 Mo maximum.' });
	if (request.file) {
		request.file.originalname = Buffer.from(request.file.originalname, 'latin1').toString('utf8');
		request.file.filename = storageKeyFor(request.file.originalname);
		try { await uploadFile(IDENTITY_BUCKET, request.file.filename, request.file.buffer, request.file.mimetype); } catch (uploadError) { return response.status(502).json({ error: 'Photo upload failed: ' + uploadError.message }); }
	}
	next();
});
app.use(cors());
app.use(express.json());
app.use(express.static(root, {
	setHeaders(response, filePath) {
		if (/\.(?:html|js|css|json|webmanifest)$/i.test(filePath)) response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
	}
}));
app.get('/identity-assets/:filename', (request, response) => response.redirect(publicUrl(request.params.filename)));

const readLocalData = async () => JSON.parse(await fs.readFile(dataPath, 'utf8'));
let supabaseWarningShown = false;
const readData = async () => {
	if (!supabaseConfigured) return readLocalData();
	try {
		const result = await fetch(`${supabaseUrl}/rest/v1/app_state?id=eq.singleton&select=data`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
		if (!result.ok) throw new Error(`Supabase read failed with ${result.status}`);
		const rows = await result.json();
		if (rows[0]?.data) return rows[0].data;
		const local = await readLocalData();
		const seed = await fetch(`${supabaseUrl}/rest/v1/app_state`, { method: 'POST', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: 'singleton', data: local }) });
		if (!seed.ok) throw new Error(`Supabase seed failed with ${seed.status}`);
		return local;
	} catch (error) {
		if (!supabaseWarningShown) { console.error('Supabase persistence unavailable:', error.message); supabaseWarningShown = true; }
		if (process.env.NODE_ENV === 'production') throw error;
		return readLocalData();
	}
};
const writeData = async (data) => {
	const serialized = `${JSON.stringify(data, null, 2)}\n`;
	const backupPath = `${dataPath}.bak`;
	const temporaryPath = `${dataPath}.tmp`;
	await fs.copyFile(dataPath, backupPath).catch(() => {});
	await fs.writeFile(temporaryPath, serialized, 'utf8');
	await fs.rename(temporaryPath, dataPath);
	if (supabaseConfigured) {
		const result = await fetch(`${supabaseUrl}/rest/v1/app_state`, { method: 'POST', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 'singleton', data }) });
		if (!result.ok) throw new Error(`Supabase write failed with ${result.status}`);
	}
};
const tokenFrom = (request) => (request.headers.authorization || '').replace(/^Bearer /, '') || null;
const changedAtSeconds = (value) => { const number = Number(value || 0); return number > 100000000000 ? Math.floor(number / 1000) : Math.floor(number); };
const ownerRoles = ['admin', 'gerant', 'manager'];
const workerRoles = ['user', 'worker'];
const isOwnerRole = (role) => ownerRoles.includes(role);
const isWorkerRole = (role) => workerRoles.includes(role);
const identityFileUrl = (fileName) => fileName ? `/identity-assets/${encodeURIComponent(fileName)}` : '';
const companyOwnerForUser = (data, user) => {
	if (!user) return null;
	if (isOwnerRole(user.role)) return user;
	const invitedOwner = (data.users || []).find((item) => item.id === user.invitedBy && isOwnerRole(item.role));
	if (invitedOwner) return invitedOwner;
	const employerSiret = cleanSiret(user.employerSiret);
	return (data.users || []).find((item) => isOwnerRole(item.role) && employerSiret && cleanSiret(item.siret) === employerSiret) || (data.users || []).find((item) => isOwnerRole(item.role) && user.employerCompany && item.company === user.employerCompany) || null;
};
const companyProfileForUser = (data, user) => {
	const owner = companyOwnerForUser(data, user) || user;
	const key = companyKeyForUser(owner);
	const profile = (data.companyProfiles || []).find((item) => item.key === key || (owner?.siret && cleanSiret(item.siret) === cleanSiret(owner.siret)));
	return profile || { key, name: owner?.company || owner?.employerCompany || '', siret: owner?.siret || owner?.employerSiret || '', logoFile: '', logoUrl: '' };
};
const publicCompanyProfile = (profile) => ({ id: profile.key || profile.id || '', name: profile.name || '', siret: profile.siret || '', logoFile: profile.logoFile || '', logoUrl: profile.logoUrl || identityFileUrl(profile.logoFile), updatedAt: profile.updatedAt || '' });
const publicUser = (user, companyProfile = null) => ({ id: user.id, name: user.name, email: user.email, role: user.role, company: user.company || '', siret: user.siret || '', employerCompany: user.employerCompany || '', employerSiret: user.employerSiret || '', projectIds: user.projectIds || [], avatarUrl: user.avatarUrl || identityFileUrl(user.avatarFile), companyLogoUrl: companyProfile?.logoUrl || user.companyLogoUrl || '', companyName: companyProfile?.name || user.company || user.employerCompany || '' });
const issueAuthToken = (user, companyProfile = null) => jwt.sign({ sub: user.id, name: user.name, email: user.email, role: user.role, company: user.company || '', siret: user.siret || '', employerCompany: user.employerCompany || '', employerSiret: user.employerSiret || '', projectIds: user.projectIds || [], avatarUrl: user.avatarUrl || identityFileUrl(user.avatarFile), companyLogoUrl: companyProfile?.logoUrl || user.companyLogoUrl || '', companyName: companyProfile?.name || user.company || user.employerCompany || '' }, secret, { expiresIn: '8h' });
const projectById = (data, projectId) => (data.projects || []).find((project) => project.id === String(projectId || '')) || null;
const projectBudgetFor = (data, projectId) => (data.projectBudgets || []).find((budget) => budget.projectId === projectId) || null;
const projectContextFor = (data, projectId) => { const project = projectById(data, projectId); const budget = projectBudgetFor(data, projectId); return { project, budget, projectName: project?.name || '', budgetId: budget?.id || '', devisNumber: budget?.devisNumber || '' }; };
const canAccessProject = (data, requestUser, projectId) => {
	const project = projectById(data, projectId);
	return Boolean(project && project.status !== 'archived' && (isOwnerRole(requestUser.role) || (requestUser.projectIds || []).includes(project.id)));
};
const assertProjectAccess = (data, requestUser, projectId, worker = null) => {
	const project = projectById(data, projectId);
	if (!project) { const error = new Error('Chantier not found'); error.status = 404; throw error; }
	if (project.status === 'archived') { const error = new Error('This chantier is archived'); error.status = 400; throw error; }
	const actorCanAccess = isOwnerRole(requestUser.role) || (requestUser.projectIds || []).includes(project.id);
	const workerCanAccess = !worker || isOwnerRole(worker.role) || (worker.projectIds || []).includes(project.id);
	if (!actorCanAccess || !workerCanAccess) { const error = new Error(`Le chantier sélectionné n’est pas accessible à cet ouvrier: ${project.name}`); error.status = 403; throw error; }
	return project;
};
const tokenIssuedBeforePasswordChange = (payload, user) => { const changedAt = changedAtSeconds(user.passwordChangedAt); return Boolean(changedAt && Number(payload.iat || 0) < changedAt); };
const configuredMailFrom = () => {
	const explicit = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM;
	if (explicit) return explicit;
	try { const host = new URL(process.env.PUBLIC_URL || '').hostname.replace(/^www\./, ''); if (host) return `noreply@${host}`; } catch {}
	return '';
};
const normalizeQuestion = (question) => question.toLowerCase().replace(/\s+/g, ' ').trim();
const answerCacheKey = (userId, projectId, question, sourceVersion) => `${userId}:${projectId}:${sourceVersion}:${normalizeQuestion(question)}`;
const saveCachedAnswer = async (data, entry) => {
	data.aiAnswers = [...(data.aiAnswers || []).filter((item) => item.key !== entry.key), entry].slice(-200);
	await writeData(data);
};
async function analyzePhotoWithVision({ buffer, mimeType, fileName, evidenceType, language }) {
	const aiBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
	const aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
	const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
	if (!aiApiKey && !geminiApiKey) return { status: 'not_configured', vision: null };
	const french = language === 'fr';
	const base64Image = buffer.toString('base64');
	const image = `data:${mimeType};base64,${base64Image}`;
	const prompt = `${french ? 'Analyse cette photo de chantier façade/ITE/bardage' : 'Analiziraj ovu fotografiju chantier fasade/ITE/bardage'}.
Réponds uniquement en JSON avec: workType string, systems array, materials array, howTo array, controls array, evidence array, risks array, confidence number 0-1.
Ne devine jamais les mesures, marques ou performances non visibles. Si un élément n'est pas clairement visible, écris qu'il faut confirmer par plan/fiche technique/DTA.
File: ${fileName}. Type preuve: ${evidenceType}. Langue de réponse: ${french ? 'français' : 'bosnien/serbe latin'}.`;
	const parseVisionJson = (text) => {
		const clean = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
		return JSON.parse(clean);
	};
	if (geminiApiKey) {
		const model = (process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').replace(/^models\//, '');
		const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				generationConfig: { temperature: 0, responseMimeType: 'application/json' },
				contents: [{
					role: 'user',
					parts: [
						{ text: `Tu es un assistant chantier RGE/QUALIBAT. Analyse prudemment, sans inventer, et demande confirmation humaine.\n\n${prompt}` },
						{ inlineData: { mimeType, data: base64Image } }
					]
				}]
			})
		});
		if (geminiResponse.ok) {
			const result = await geminiResponse.json();
			try { return { status: 'ai_analyzed', provider: 'gemini', vision: parseVisionJson(result.candidates?.[0]?.content?.parts?.[0]?.text) }; }
			catch { return { status: 'invalid_ai_response', provider: 'gemini', vision: null }; }
		}
		const details = await geminiResponse.text();
		console.error('Gemini Vision rejected document photo analysis', geminiResponse.status, details.slice(0, 500));
		if (!aiApiKey) return { status: 'provider_unavailable', provider: 'gemini', vision: null };
	}
	if (aiApiKey) {
		const aiResponse = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${aiApiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
				temperature: 0,
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: 'Tu es un assistant chantier RGE/QUALIBAT. Tu analyses les photos prudemment, sans inventer, et tu demandes confirmation humaine.' },
					{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image, detail: 'high' } }] }
				]
			})
		});
		if (aiResponse.ok) {
			const result = await aiResponse.json();
			try { return { status: 'ai_analyzed', provider: 'openai', vision: parseVisionJson(result.choices?.[0]?.message?.content) }; }
			catch { return { status: 'invalid_ai_response', provider: 'openai', vision: null }; }
		}
		const details = await aiResponse.text();
		console.error('OpenAI Vision rejected document photo analysis', aiResponse.status, details.slice(0, 500));
	}
	return { status: 'provider_unavailable', vision: null };
}
async function analyzeDocumentWithGemini({ buffer, mimeType, fileName, evidenceType, language, text }) {
	const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
	if (!geminiApiKey) return null;
	const french = language === 'fr';
	const model = (process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').replace(/^models\//, '');
	const prompt = `${french ? 'Analyse ce document chantier RGE/QUALIBAT' : 'Analiziraj ovaj chantier dokument RGE/QUALIBAT'}: ${fileName}.
Tu dois répondre SPECIFIQUEMENT selon ce plan/fiche, pas avec un texte générique.
Si le document parle de bardage ventilé, explique exactement par où commencer, l'ordre logique: support, calepinage, ossature/équerres/tasseaux, isolant, pare-pluie, lame d'air, profils départ/angles/tableaux, pose du parement, contrôles et photos preuve.
Si une information précise n'est pas dans le document, écris "à confirmer dans le plan/fiche/DTA" au lieu d'inventer.
Réponds uniquement en JSON avec:
summary string, workType string, systems array, materials array, howTo array, controls array, evidence array, risks array, confidence number 0-1, answer string.
Langue de réponse: ${french ? 'français' : 'bosnien/serbe latin'}.
Texte extrait du PDF si disponible:
${String(text || '').slice(0, 18000)}`;
	const parse = (value) => JSON.parse(String(value || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim());
	const asArray = (value) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];
	const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
			contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: mimeType || 'application/pdf', data: buffer.toString('base64') } }] }]
		}),
		signal: AbortSignal.timeout(25000)
	});
	if (!geminiResponse.ok) {
		const details = await geminiResponse.text();
		console.error('Gemini document analysis rejected', geminiResponse.status, details.slice(0, 500));
		return null;
	}
	const result = await geminiResponse.json();
	try {
		const parsed = parse(result.candidates?.[0]?.content?.parts?.[0]?.text);
		return {
			status: 'document_ai_analyzed',
			fileName,
			evidenceType,
			summary: String(parsed.summary || (french ? 'Analyse spécifique du document.' : 'Specifična analiza dokumenta.')),
			workType: String(parsed.workType || (french ? 'Travaux à confirmer selon le plan' : 'Radovi za potvrdu prema planu')),
			systems: asArray(parsed.systems),
			materials: asArray(parsed.materials),
			howTo: asArray(parsed.howTo),
			controls: asArray(parsed.controls),
			evidence: asArray(parsed.evidence),
			risks: asArray(parsed.risks),
			confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0.65,
			answer: String(parsed.answer || ''),
			requiresHumanConfirmation: true
		};
	} catch {
		return null;
	}
}
async function answerQuestionWithGemini({ question, sources, language }) {
	const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
	if (!geminiApiKey) return null;
	const model = (process.env.GEMINI_MODEL || process.env.GEMINI_VISION_MODEL || 'gemini-3.1-flash-lite').replace(/^models\//, '');
	const languageName = language === 'fr' ? 'francuskom' : language === 'bs' ? 'bosanskom' : 'srpskom';
	const sourceText = sources.filter((source) => source.text).map((source) => `SOURCE: ${source.file} | TYPE: ${source.type} | PAGE: ${source.page}\n${source.text}`).join('\n\n');
	const prompt = `Odgovori samo na osnovu dostavljenog SOURCE teksta i fotografija. Ne izmišljaj mere, tolerancije ili pravila. Ako podatak nije jasno vidljiv ili naveden, reci: "Podatak nije pronađen u dokumentaciji ili fotografiji." Uvek navedi source file i page ako postoji. Odgovor treba da bude tehnički jasan na ${languageName} jeziku. Pitanje: ${question}\n\n${sourceText}`;
	const parts = [{ text: prompt }];
	for (const source of sources.filter((item) => item.image)) {
		const match = /^data:([^;]+);base64,(.+)$/.exec(source.image);
		if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
	}
	const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ generationConfig: { temperature: 0 }, contents: [{ role: 'user', parts }] }),
		signal: AbortSignal.timeout(25000)
	});
	if (!geminiResponse.ok) {
		const details = await geminiResponse.text();
		console.error('Gemini technical-answer rejected', geminiResponse.status, details.slice(0, 500));
		return null;
	}
	const result = await geminiResponse.json();
	const answer = result.candidates?.[0]?.content?.parts?.[0]?.text;
	return answer ? String(answer).trim() : null;
}
async function answerWorkSequenceWithGemini({ sourceText }) {
	const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
	if (!geminiApiKey) return null;
	const model = (process.env.GEMINI_MODEL || process.env.GEMINI_VISION_MODEL || 'gemini-3.1-flash-lite').replace(/^models\//, '');
	const prompt = `Na osnovu isključivo SOURCE teksta napravi redosled izvođenja radova. Vrati JSON sa steps nizom; svaki korak mora imati order, title, instruction, requiredEvidence i sourcePage. Ne izmišljaj radove. Ako podatak nije u izvoru, navedi da nije pronađen. Gerant mora potvrditi svaki korak.\n\n${sourceText}`;
	const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ generationConfig: { temperature: 0, responseMimeType: 'application/json' }, contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
		signal: AbortSignal.timeout(25000)
	});
	if (!geminiResponse.ok) {
		const details = await geminiResponse.text();
		console.error('Gemini work-sequence rejected', geminiResponse.status, details.slice(0, 500));
		return null;
	}
	const result = await geminiResponse.json();
	try {
		const parsed = JSON.parse(String(result.candidates?.[0]?.content?.parts?.[0]?.text || '{}').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim());
		return Array.isArray(parsed.steps) ? parsed.steps : [];
	} catch {
		return null;
	}
}
async function auth(request, response, next) {
	try {
		const payload = jwt.verify(tokenFrom(request), secret);
		const data = await readData();
		const user = data.users.find((item) => item.id === payload.sub);
		if (!user || tokenIssuedBeforePasswordChange(payload, user)) return response.status(401).json({ error: 'Session expired. Please sign in again.' });
		const profile = companyProfileForUser(data, user);
		request.user = { ...payload, ...publicUser(user, profile), sub: user.id };
		request.userRecord = user;
		request.companyProfile = profile;
		request.data = data;
		next();
	} catch { response.status(401).json({ error: 'Authentication required' }); }
}
function manager(request, response, next) {
	if (!isOwnerRole(request.user.role)) return response.status(403).json({ error: 'Access denied' });
	next();
}
function workerSelf(request, response, next) {
	if (!isWorkerRole(request.user.role)) return response.status(403).json({ error: 'Only workers can update their own photo' });
	if (request.params.id && request.params.id !== request.user.sub) return response.status(403).json({ error: 'Workers can only update their own photo' });
	next();
}
const allowedWorkEvidenceTypes = ['plan', 'fiche-technique', 'photo-before', 'photo-during', 'photo-after'];
function isAllowedWorkDocument(file, evidenceType) {
	const type = String(evidenceType || '');
	const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
	const isImage = file.mimetype.startsWith('image/');
	return (['plan', 'fiche-technique'].includes(type) && isPdf) || (allowedWorkEvidenceTypes.includes(type) && !['plan', 'fiche-technique'].includes(type) && isImage);
}

async function sendMailSafe({ to, subject, text, attachments = [] }) {
	const from = configuredMailFrom();
	if (process.env.BREVO_API_KEY && from) {
		const apiResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
			method: 'POST',
			headers: { accept: 'application/json', 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
			body: JSON.stringify({
				sender: { name: 'IBRA-BA', email: from },
				to: [{ email: to }],
				subject,
				textContent: text,
				...(attachments.length ? { attachment: attachments.map(({ filename, content }) => ({ name: filename, content: Buffer.isBuffer(content) ? content.toString('base64') : content })) } : {})
			})
		});
		if (!apiResponse.ok) {
			const details = await apiResponse.text();
			throw new Error(`Brevo API returned ${apiResponse.status}: ${details.slice(0, 240)}`);
		}
		return { skipped: false };
	}
	if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return { skipped: true };
	const nodemailer = await import('nodemailer');
	const transporter = nodemailer.default.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
	await transporter.sendMail({
		from: `IBRA-BA <${from}>`,
		to,
		subject,
		text,
		attachments
	});
	return { skipped: false };
}
async function sendSmsSafe({ to, text }) {
	const accountSid = process.env.TWILIO_ACCOUNT_SID;
	const authToken = process.env.TWILIO_AUTH_TOKEN;
	const twilioFrom = process.env.TWILIO_FROM;
	if (accountSid && authToken && twilioFrom) {
		const body = new URLSearchParams({ To: to, From: twilioFrom, Body: text });
		const apiResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
			method: 'POST',
			headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
			body
		});
		if (!apiResponse.ok) throw new Error(`Twilio API returned ${apiResponse.status}`);
		return { skipped: false, provider: 'twilio' };
	}
	const brevoSender = process.env.BREVO_SMS_SENDER || process.env.SMS_SENDER || 'IBRABA';
	if (process.env.BREVO_API_KEY && brevoSender) {
		const apiResponse = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
			method: 'POST',
			headers: { accept: 'application/json', 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
			body: JSON.stringify({ sender: brevoSender, recipient: to.replace(/[\s()-]/g, ''), content: text, type: 'transactional', tag: 'ibra-ba-auth' })
		});
		if (!apiResponse.ok) {
			const details = await apiResponse.text();
			throw new Error(`Brevo SMS returned ${apiResponse.status}: ${details.slice(0, 240)}`);
		}
		return { skipped: false, provider: 'brevo-sms' };
	}
	return { skipped: true };
}
async function resolveCompanyFromSiret(value) {
	const digits = cleanSiret(value);
	if (![9, 14].includes(digits.length)) {
		const error = new Error('SIRET/SIREN must contain 9 or 14 digits');
		error.status = 400;
		throw error;
	}
	const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(digits)}&per_page=1`);
	if (!response.ok) {
		const error = new Error('Company registry is unavailable');
		error.status = 502;
		throw error;
	}
	const payload = await response.json();
	const company = payload.results?.[0];
	if (!company) {
		const error = new Error('No company found for this SIRET/SIREN');
		error.status = 404;
		throw error;
	}
	const establishment = digits.length === 14
		? (company.matching_etablissements || []).find((item) => item.siret === digits) || (company.siege?.siret === digits ? company.siege : null)
		: company.siege;
	if (digits.length === 14 && !establishment) {
		const error = new Error('No establishment found for this SIRET');
		error.status = 404;
		throw error;
	}
	return {
		name: company.nom_raison_sociale || company.nom_complet || establishment?.nom_commercial || `SIRET ${digits}`,
		siren: company.siren || digits.slice(0, 9),
		siret: establishment?.siret || company.siege?.siret || digits,
		address: establishment?.adresse || company.siege?.adresse || '',
		active: (establishment?.etat_administratif || company.etat_administratif) === 'A'
	};
}
function buildPayoutPdf(item) {
	const escapePdf = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
	const lines = [
		'IBRA-BA - ZAHTEV ZA ISPLATU PLATE',
		`Radnik: ${item.userName}`,
		`Mesec: ${item.month}`,
		`Broj dana: ${item.days}`,
		`Dnevnica: ${Number(item.dailyRate || 0).toFixed(2)} EUR`,
		`Ukupan zahtev: ${Number(item.amount || 0).toFixed(2)} EUR`,
		`Status: ${item.status}`,
		`Datum slanja: ${item.createdAt || item.submissionDate}`
	];
	const commands = ['BT', '/F1 12 Tf', '50 780 Td', ...lines.flatMap((line, index) => [index ? '0 -28 Td' : '', `(${escapePdf(line)}) Tj`]).filter(Boolean), 'ET'].join('\n');
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
		`<< /Length ${Buffer.byteLength(commands, 'utf8')} >>\nstream\n${commands}\nendstream`,
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
	];
	let pdf = '%PDF-1.4\n'; const offsets = [0];
	objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, 'utf8'); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
	const xref = Buffer.byteLength(pdf, 'utf8'); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
	return Buffer.from(pdf, 'utf8');
}
const frenchMonthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const formatMonthFrench = (month) => {
	const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
	if (!match) return String(month || '');
	const [, year, monthNumber] = match;
	const name = frenchMonthNames[Number(monthNumber) - 1];
	return name ? `${name} ${year}` : String(month);
};
async function buildHoursPdf({ worker, companyName, companyAddress, logoBuffer, month, entries, total }) {
	const doc = await PDFDocument.create();
	const pageSize = [595.28, 841.89];
	let page = doc.addPage(pageSize);
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
	const marginX = 40;
	const rightEdge = pageSize[0] - marginX;
	let y = 800;
	const truncate = (value, max) => { const text = String(value || ''); return text.length > max ? `${text.slice(0, max - 1)}…` : text; };
	const headerTop = y;
	let brandY = headerTop;
	if (logoBuffer) {
		try {
			let image;
			try { image = await doc.embedPng(logoBuffer); } catch { image = await doc.embedJpg(logoBuffer); }
			const maxWidth = 100; const maxHeight = 50;
			const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
			const width = image.width * scale; const height = image.height * scale;
			page.drawImage(image, { x: rightEdge - width, y: brandY - height, width, height });
			brandY -= height + 6;
		} catch { /* logo unreadable, continue without it */ }
	}
	const drawRight = (text, size, useFont, color) => {
		if (!text) return;
		const width = useFont.widthOfTextAtSize(text, size);
		page.drawText(text, { x: rightEdge - width, y: brandY, size, font: useFont, color });
		brandY -= size + 5;
	};
	drawRight(companyName, 11, fontBold);
	drawRight(truncate(companyAddress, 50), 8, font, rgb(0.45, 0.45, 0.45));
	let leftY = headerTop;
	page.drawText("Bulletin d'heures", { x: marginX, y: leftY, size: 18, font: fontBold });
	leftY -= 30;
	page.drawText(`Ouvrier : ${worker.name || ''}`, { x: marginX, y: leftY, size: 11, font: fontBold });
	leftY -= 16;
	page.drawText(`Mois : ${formatMonthFrench(month)}`, { x: marginX, y: leftY, size: 11, font });
	y = Math.min(leftY, brandY) - 14;
	const columns = [{ label: 'Date', x: marginX }, { label: 'Chantier / Adresse', x: marginX + 65 }, { label: 'Heures', x: marginX + 285 }, { label: 'Taux', x: marginX + 340 }, { label: 'Montant', x: rightEdge - 65 }];
	const drawHeader = () => {
		columns.forEach((column) => page.drawText(column.label, { x: column.x, y, size: 9, font: fontBold }));
		y -= 6;
		page.drawLine({ start: { x: marginX, y }, end: { x: rightEdge, y }, thickness: 0.6, color: rgb(0.6, 0.6, 0.6) });
		y -= 14;
	};
	drawHeader();
	for (const entry of entries) {
		if (y < 70) { page = doc.addPage(pageSize); y = 800; drawHeader(); }
		page.drawText(entry.date || '', { x: columns[0].x, y, size: 9, font });
		page.drawText(truncate(entry.projectLabel, 42), { x: columns[1].x, y, size: 9, font });
		page.drawText(`${Number(entry.hours || 0).toFixed(2)} h`, { x: columns[2].x, y, size: 9, font });
		page.drawText(`${entry.rateType === 'hourly' ? 'Horaire' : 'Journalier'} ${Number(entry.rate || 0).toFixed(2)} €`, { x: columns[3].x, y, size: 8, font });
		page.drawText(`${Number(entry.workAmount || 0).toFixed(2)} €`, { x: columns[4].x, y, size: 9, font });
		y -= 16;
	}
	y -= 8;
	page.drawLine({ start: { x: marginX, y }, end: { x: rightEdge, y }, thickness: 0.6, color: rgb(0.6, 0.6, 0.6) });
	y -= 22;
	page.drawText(`TOTAL : ${Number(total || 0).toFixed(2)} €`, { x: marginX, y, size: 13, font: fontBold });
	return Buffer.from(await doc.save());
}
const previousMonthKey = (date = new Date()) => {
	const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
	return previous.toISOString().slice(0, 7);
};
const projectLabelFor = (data, projectId) => { const project = projectById(data, projectId); return project ? [project.name, project.location].filter(Boolean).join(' - ') : String(projectId || ''); };
const companyBrandingForPdf = async (data, worker) => {
	const profile = companyProfileForUser(data, worker);
	const owner = companyOwnerForUser(data, worker);
	let logoBuffer = null;
	if (profile.logoFile) { try { logoBuffer = await downloadFile(IDENTITY_BUCKET, profile.logoFile); } catch { logoBuffer = null; } }
	return { companyName: profile.name || worker?.employerCompany || worker?.company || '', companyAddress: owner?.companyAddress || '', logoBuffer };
};

app.get('/api/health', (_request, response) => response.json({
	status: 'ok',
	service: 'ibra-ba-api',
	commit: process.env.RENDER_GIT_COMMIT || '',
}));
app.get('/', (_request, response) => response.sendFile(path.join(root, 'index.html')));
app.get('/api/siret/:siret', async (request, response) => {
	try {
		response.json(await resolveCompanyFromSiret(request.params.siret));
	} catch (error) {
		response.status(error.status || 500).json({ error: error.message || 'Company lookup failed' });
	}
});
app.get('/api/auth/identity-preview', async (request, response) => {
	const data = await readData();
	const identifier = String(request.query.identifier || request.query.email || '').trim();
	const role = String(request.query.role || 'user');
	const normalizedEmail = identifier.toLowerCase();
	const normalizedPhone = identifier.replace(/[\s()-]/g, '');
	const user = isWorkerRole(role)
		? (data.users || []).find((item) => item.email && item.email.toLowerCase() === normalizedEmail)
		: (data.users || []).find((item) => (item.email && item.email.toLowerCase() === normalizedEmail) || (item.phone && item.phone.replace(/[\s()-]/g, '') === normalizedPhone));
	if (!user || (isWorkerRole(role) && !isWorkerRole(user.role)) || (isOwnerRole(role) && !isOwnerRole(user.role))) return response.json({ matched: false, companyName: '', companyLogoUrl: '' });
	if (isOwnerRole(role) && user.siret && cleanSiret(request.query.siret) && cleanSiret(user.siret) !== cleanSiret(request.query.siret)) return response.json({ matched: false, companyName: '', companyLogoUrl: '' });
	const profile = companyProfileForUser(data, user);
	response.json({ matched: true, companyName: profile.name || user.company || user.employerCompany || '', companyLogoUrl: profile.logoUrl || identityFileUrl(profile.logoFile), role: user.role });
});
const createPasswordSetupUrl = (data, userId) => {
	const token = crypto.randomBytes(32).toString('hex');
	const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
	data.passwordResets = [...(data.passwordResets || []).filter((item) => item.userId !== userId), { token, userId, expiresAt }];
	return `${process.env.PUBLIC_URL || 'http://localhost:3000'}/?reset=${token}`;
};
app.post('/api/auth/login', async (request, response) => {
	const data = await readData();
	const identifier = String(request.body.phone || request.body.email || '').trim();
	const requestedRole = String(request.body.role || 'user');
	const normalizedPhone = identifier.replace(/[\s()-]/g, '');
	const user = isWorkerRole(requestedRole)
		? data.users.find((item) => item.email && item.email.toLowerCase() === identifier.toLowerCase())
		: data.users.find((item) => item.phone && item.phone.replace(/[\s()-]/g, '') === normalizedPhone) || data.users.find((item) => item.email === identifier.toLowerCase());
	if (!user || !(await bcrypt.compare(String(request.body.password || ''), user.passwordHash))) return response.status(401).json({ error: isWorkerRole(requestedRole) ? 'Invalid email or password' : 'Invalid phone or password' });
	if (requestedRole === 'gerant') {
		if (!isOwnerRole(user.role)) return response.status(403).json({ error: 'SIRET owner access only' });
		if (!user.siret || cleanSiret(user.siret) !== cleanSiret(request.body.siret)) return response.status(403).json({ error: 'Invalid SIRET for this owner account' });
	} else if (isWorkerRole(requestedRole) && !isWorkerRole(user.role)) {
		return response.status(403).json({ error: 'Selected profile does not match this account' });
	}
	const profile = companyProfileForUser(data, user);
	const token = issueAuthToken(user, profile);
	response.json({ token, user: publicUser(user, profile) });
});
app.post('/api/auth/register', async (request, response) => {
	const data = await readData();
	const role = 'gerant';
	const contact = String(request.body.contact || request.body.email || request.body.phone || '').trim();
	const isEmail = /^\S+@\S+\.\S+$/.test(contact);
	const email = isEmail ? contact.toLowerCase() : '';
	const name = String(request.body.name || '').trim() || (isEmail ? email.split('@')[0] : contact);
	const phone = isEmail ? '' : contact;
	const siret = String(request.body.siret || '').trim();
	const manualCompany = String(request.body.company || '').trim();
	const requestedPassword = String(request.body.password || '');
	const existingUser = data.users.find((user) => (email && user.email && user.email.toLowerCase() === email) || (phone && user.phone && user.phone.replace(/[\s()-]/g, '') === phone.replace(/[\s()-]/g, '')));
	if (requestedPassword && existingUser) {
		if (requestedPassword.length < 10) return response.status(400).json({ error: 'Password must be at least 10 characters' });
		if (!isOwnerRole(existingUser.role)) return response.status(403).json({ error: 'Only invited users can reset worker access' });
		if (cleanSiret(existingUser.siret) !== cleanSiret(siret)) return response.status(403).json({ error: 'SIRET does not match this owner account' });
		existingUser.passwordHash = await bcrypt.hash(requestedPassword, 12);
		existingUser.passwordChangedAt = Math.floor(Date.now() / 1000);
		await writeData(data);
		return response.status(200).json({ message: 'Password updated for existing account', email: existingUser.email || null, phone: existingUser.phone || null, role: existingUser.role, delivery: 'password-set' });
	}
	if (!contact || (!isEmail && !phone) || !siret || !manualCompany) return response.status(400).json({ error: 'Email or phone, SIRET, and company name are required for owner registration' });
	let companyInfo;
	try { companyInfo = await resolveCompanyFromSiret(siret); }
	catch { companyInfo = { name: manualCompany, siren: cleanSiret(siret).slice(0, 9), siret: cleanSiret(siret), address: '', active: null }; }
	if (data.users.some((user) => isOwnerRole(user.role) && cleanSiret(user.siret) === cleanSiret(siret))) return response.status(409).json({ error: 'SIRET owner already exists' });
	if (existingUser) return response.status(409).json({ error: 'User already exists' });
	if (requestedPassword.length < 10) return response.status(400).json({ error: 'Password must be at least 10 characters' });
	const user = { id: `user-${Date.now()}`, name, email, phone, role, siret: companyInfo.siret, siren: companyInfo.siren, company: manualCompany || companyInfo.name, companyRegistryName: companyInfo.name, companyAddress: companyInfo.address, projectIds: [], dailyRate: 0, hourlyRate: 0, passwordHash: await bcrypt.hash(requestedPassword, 12), passwordChangedAt: Math.floor(Date.now() / 1000) };
	data.users.push(user); await writeData(data);
	response.status(201).json({ message: 'Owner account created with chosen password', email: email || null, phone: phone || null, role, delivery: 'password-set' });
});
app.post('/api/auth/request-reset', async (request, response) => {
	const contact = String(request.body.contact || request.body.email || request.body.phone || '').trim(); const email = contact.toLowerCase(); const normalizedPhone = contact.replace(/[\s()-]/g, ''); const data = await readData(); const user = data.users.find((item) => (item.email && item.email.trim().toLowerCase() === email) || (item.phone && item.phone.replace(/[\s()-]/g, '') === normalizedPhone));
	if (!user) return response.status(404).json({ error: 'Aucun compte trouvé avec cet e-mail ou ce téléphone.' });
	const token = crypto.randomBytes(32).toString('hex'); const expiresAt = Date.now() + 15 * 60 * 1000; data.passwordResets = [...(data.passwordResets || []).filter((item) => item.userId !== user.id), { token, userId: user.id, expiresAt }]; await writeData(data);
	const resetUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/?reset=${token}`;
	let mailResult;
	try {
		if (user.email) mailResult = await sendMailSafe({ to: user.email, subject: 'IBRA-BA - réinitialisation du mot de passe', text: `Ouvrez ce lien pour définir un nouveau mot de passe : ${resetUrl}` });
		else { const smsResult = await sendSmsSafe({ to: user.phone, text: `IBRA-BA: otvorite reset link ${resetUrl}` }); mailResult = { skipped: smsResult.skipped }; }
	} catch (error) {
		console.error('Password reset delivery failed:', error.message);
		return response.status(502).json({ error: user.email ? 'Password reset email could not be sent' : 'Password reset SMS could not be sent' });
	}
	if (mailResult.skipped && process.env.NODE_ENV === 'production') return response.status(503).json({ error: user.email ? 'Password reset email is not configured' : 'Password reset SMS is not configured' });
	response.json({ message: mailResult.skipped ? 'Reset instructions prepared for local testing.' : 'Reset instructions sent.', ...(mailResult.skipped ? { resetUrl } : {}) });
});
app.post('/api/auth/reset-password', async (request, response) => {
	const token = String(request.body.token || ''); const password = String(request.body.password || ''); if (password.length < 10) return response.status(400).json({ error: 'Password must be at least 10 characters' }); const data = await readData(); const reset = (data.passwordResets || []).find((item) => item.token === token && item.expiresAt > Date.now()); if (!reset) return response.status(400).json({ error: 'Reset link is invalid or expired' }); const user = data.users.find((item) => item.id === reset.userId); user.passwordHash = await bcrypt.hash(password, 12); user.passwordChangedAt = Math.floor(Date.now() / 1000); data.passwordResets = (data.passwordResets || []).filter((item) => item.token !== token); await writeData(data); response.json({ message: 'Password updated' });
});
app.post('/api/auth/change-password', auth, async (request, response) => {
	const currentPassword = String(request.body.currentPassword || ''); const newPassword = String(request.body.newPassword || '');
	if (newPassword.length < 10) return response.status(400).json({ error: 'New password must be at least 10 characters' });
	const data = await readData(); const user = data.users.find((item) => item.id === request.user.sub);
	if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return response.status(401).json({ error: 'Current password is incorrect' });
	user.passwordHash = await bcrypt.hash(newPassword, 12); user.passwordChangedAt = Math.floor(Date.now() / 1000); await writeData(data); const profile = companyProfileForUser(data, user); response.json({ message: 'Password changed', token: issueAuthToken(user, profile), user: publicUser(user, profile) });
});
app.get('/api/me', auth, (request, response) => response.json({ user: publicUser(request.userRecord, request.companyProfile), company: publicCompanyProfile(request.companyProfile) }));
app.patch('/api/me', auth, async (request, response) => {
	const data = await readData();
	const user = data.users.find((item) => item.id === request.user.sub);
	if (!user) return response.status(404).json({ error: 'User not found' });
	const name = String(request.body.name ?? user.name).trim();
	const contact = String(request.body.contact || '').trim();
	const email = contact ? (/^\S+@\S+\.\S+$/.test(contact) ? contact.toLowerCase() : '') : String(user.email || '').trim().toLowerCase();
	const phone = contact ? (email ? '' : contact) : String(user.phone || '').trim();
	const normalizedPhone = phone.replace(/[\s()-]/g, '');
	if (!name || (!email && !phone)) return response.status(400).json({ error: 'Name and phone or email are required' });
	if ((email && data.users.some((item) => item.id !== user.id && item.email && item.email.toLowerCase() === email)) || (phone && data.users.some((item) => item.id !== user.id && item.phone && item.phone.replace(/[\s()-]/g, '') === normalizedPhone))) return response.status(409).json({ error: 'User already exists' });
	user.name = name;
	user.email = email;
	user.phone = phone;
	data.timeEntries = (data.timeEntries || []).map((entry) => entry.workerId === user.id ? { ...entry, workerName: user.name } : entry);
	await writeData(data);
	const profile = companyProfileForUser(data, user);
	response.json({ user: publicUser(user, profile) });
});
app.get('/api/users', auth, manager, async (request, response) => { const data = await readData(); response.json(data.users.map((user) => publicUser(user, companyProfileForUser(data, user)))); });
app.get('/api/contacts', auth, async (request, response) => {
	const data = await readData(); const financialView = isOwnerRole(request.user.role);
	const myOwner = companyOwnerForUser(data, request.userRecord) || request.userRecord;
	const scoped = request.user.role === 'admin' ? data.users : data.users.filter((user) => (companyOwnerForUser(data, user) || user).id === myOwner.id);
	response.json(scoped.map((user) => ({ ...publicUser(user, companyProfileForUser(data, user)), ...(financialView ? { dailyRate: user.dailyRate || 0, hourlyRate: user.hourlyRate || 0 } : {}) })));
});
app.get('/api/company/profile', auth, async (request, response) => response.json(publicCompanyProfile(companyProfileForUser(await readData(), request.userRecord))));
app.patch('/api/company/profile', auth, manager, identityUploadMiddleware('logo'), async (request, response) => {
	const data = request.data || await readData();
	const owner = data.users.find((user) => user.id === request.user.sub) || request.userRecord;
	const existing = companyProfileForUser(data, owner);
	const name = String(request.body.name ?? existing.name ?? owner?.company ?? '').trim();
	if (!name) return response.status(400).json({ error: 'Company name is required' });
	const removeLogo = String(request.body.removeLogo || '').toLowerCase() === 'true';
	if (removeLogo && existing.logoFile) await deleteFile(IDENTITY_BUCKET, existing.logoFile);
	if (request.file && existing.logoFile && existing.logoFile !== request.file.filename) await deleteFile(IDENTITY_BUCKET, existing.logoFile);
	const profile = { key: existing.key || companyKeyForUser(owner), name, siret: owner?.siret || existing.siret || '', logoFile: removeLogo ? '' : (request.file?.filename || existing.logoFile || ''), updatedBy: request.user.sub, updatedAt: new Date().toISOString() };
	data.companyProfiles = [...(data.companyProfiles || []).filter((item) => item.key !== profile.key), profile];
	data.users = data.users.map((user) => {
		if (companyKeyForUser(companyOwnerForUser(data, user) || user) !== profile.key) return user;
		return isOwnerRole(user.role) ? { ...user, company: name } : { ...user, employerCompany: name, company: name };
	});
	await writeData(data);
	response.json(publicCompanyProfile(profile));
});
app.post('/api/users/:id/avatar', auth, workerSelf, identityUploadMiddleware('avatar'), async (request, response) => {
	const data = request.data || await readData();
	const target = data.users.find((user) => user.id === request.params.id);
	if (!target || !isWorkerRole(target.role)) return response.status(404).json({ error: 'Worker not found' });
	if (request.user.role !== 'admin' && companyKeyForUser(companyOwnerForUser(data, target) || target) !== companyKeyForUser(companyOwnerForUser(data, request.userRecord) || request.userRecord)) return response.status(403).json({ error: 'Access denied for this worker' });
	if (!request.file) return response.status(400).json({ error: 'Photo de l’ouvrier requise' });
	if (target.avatarFile) await deleteFile(IDENTITY_BUCKET, target.avatarFile);
	target.avatarFile = request.file.filename;
	target.avatarUrl = identityFileUrl(target.avatarFile);
	await writeData(data);
	response.json({ avatarUrl: target.avatarUrl });
});
app.delete('/api/users/:id/avatar', auth, workerSelf, async (request, response) => {
	const data = request.data || await readData();
	const target = data.users.find((user) => user.id === request.params.id);
	if (!target || !isWorkerRole(target.role)) return response.status(404).json({ error: 'Worker not found' });
	if (request.user.role !== 'admin' && companyKeyForUser(companyOwnerForUser(data, target) || target) !== companyKeyForUser(companyOwnerForUser(data, request.userRecord) || request.userRecord)) return response.status(403).json({ error: 'Access denied for this worker' });
	if (target.avatarFile) await deleteFile(IDENTITY_BUCKET, target.avatarFile);
	target.avatarFile = '';
	target.avatarUrl = '';
	await writeData(data);
	response.json({ avatarUrl: '' });
});
app.post('/api/me/avatar', auth, workerSelf, identityUploadMiddleware('avatar'), async (request, response) => {
	const data = request.data || await readData();
	const worker = data.users.find((user) => user.id === request.user.sub);
	if (!worker || !isWorkerRole(worker.role)) return response.status(403).json({ error: 'Only workers can update their own photo' });
	if (!request.file) return response.status(400).json({ error: 'Choisissez une photo JPG ou PNG de 5 Mo maximum.' });
	if (worker.avatarFile) await deleteFile(IDENTITY_BUCKET, worker.avatarFile);
	worker.avatarFile = request.file.filename;
	worker.avatarUrl = identityFileUrl(worker.avatarFile);
	await writeData(data);
	response.json({ avatarUrl: worker.avatarUrl });
});
app.delete('/api/me/avatar', auth, workerSelf, async (request, response) => {
	const data = request.data || await readData();
	const worker = data.users.find((user) => user.id === request.user.sub);
	if (!worker || !isWorkerRole(worker.role)) return response.status(403).json({ error: 'Only workers can remove their own photo' });
	if (worker.avatarFile) await deleteFile(IDENTITY_BUCKET, worker.avatarFile);
	worker.avatarFile = '';
	worker.avatarUrl = '';
	await writeData(data);
	response.json({ avatarUrl: '' });
});
app.post('/api/users', auth, manager, async (request, response) => {
	const data = await readData();
	const owner = data.users.find((item) => item.id === request.user.sub);
	const ownerCompany = owner?.company || request.user.company || request.user.name;
	const ownerSiret = owner?.siret || request.user.siret || '';
	const name = String(request.body.name || '').trim();
	const email = String(request.body.email || '').trim().toLowerCase();
	const deliveryMethod = 'email';
	const role = String(request.body.role || 'user').trim() === 'gerant' ? 'gerant' : 'user';
	const siret = String(request.body.siret || '').trim(); const phone = String(request.body.phone || '').trim();
	const normalizedPhone = phone.replace(/[\s()-]/g, '');
	const company = String(request.body.company || '').trim();
	const selectedProjectIds = role === 'user' ? normalizeProjectIds(request.body.projectIds, data.projects) : (data.projects || []).map((project) => project.id);
	if (!name || !/^\S+@\S+\.\S+$/.test(email) || (role === 'gerant' && (!siret || !company)) || (role === 'user' && (!ownerSiret || !ownerCompany || !selectedProjectIds.length))) return response.status(400).json({ error: 'Name, email, company/SIRET details, and at least one chantier are required' });
	if ((email && data.users.some((user) => user.email && user.email.toLowerCase() === email)) || (phone && data.users.some((user) => user.phone && user.phone.replace(/[\s()-]/g, '') === normalizedPhone))) return response.status(409).json({ error: 'User already exists' });
	if (role === 'gerant' && data.users.some((user) => isOwnerRole(user.role) && cleanSiret(user.siret) === cleanSiret(siret))) return response.status(409).json({ error: 'SIRET owner already exists' });
	let companyInfo = null;
	if (role === 'gerant') {
		try { companyInfo = await resolveCompanyFromSiret(siret); }
		catch { companyInfo = { name: company, siren: cleanSiret(siret).slice(0, 9), siret: cleanSiret(siret), address: '' }; }
	}
	const user = { id: `user-${Date.now()}`, name, email, phone, deliveryMethod, role, siret: role === 'gerant' ? companyInfo.siret : '', siren: role === 'gerant' ? companyInfo.siren : '', company: role === 'gerant' ? company : ownerCompany, companyRegistryName: role === 'gerant' ? companyInfo.name : '', companyAddress: role === 'gerant' ? companyInfo.address : '', employerSiret: role === 'user' ? ownerSiret : '', employerCompany: role === 'user' ? ownerCompany : '', invitedBy: request.user.sub, projectIds: selectedProjectIds, dailyRate: Number(request.body.dailyRate || 0), hourlyRate: Number(request.body.hourlyRate || 0), passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12), passwordChangedAt: Math.floor(Date.now() / 1000) };
	const setupUrl = createPasswordSetupUrl(data, user.id);
	const assignedProjectNames = selectedProjectIds.map((projectId) => (data.projects || []).find((project) => project.id === projectId)?.name || projectId).join(', ');
	const credentialsText = `Bonjour ${name},\n\nVotre compte IBRA-BA est prêt pour ${user.employerCompany || user.company}.\nSIRET: ${user.employerSiret || user.siret || 'N/A'}\nChantiers attribués: ${assignedProjectNames || 'N/A'}\nIdentifiant : ${email || phone}\n\nCliquez ici pour choisir votre mot de passe : ${setupUrl}\n\nCe lien est valable 7 jours.`;
	let delivery = 'manual';
	const mailResult = await sendMailSafe({ to: email, subject: 'IBRA-BA - votre accès', text: credentialsText });
	if (!mailResult.skipped) delivery = 'email';
	if (delivery === 'manual' && process.env.NODE_ENV === 'production') return response.status(503).json({ error: 'Configure email delivery before creating users' });
	data.users.push(user); await writeData(data);
	const { passwordHash, ...safeUser } = user;
	response.status(201).json({ ...safeUser, delivery, ...(delivery === 'manual' ? { setupUrl } : {}) });
});
app.post('/api/workers', auth, manager, async (request, response) => {
	const data = await readData();
	const owner = data.users.find((item) => item.id === request.user.sub);
	const ownerCompany = owner?.company || request.user.company || request.user.name;
	const ownerSiret = owner?.siret || request.user.siret || '';
	const name = String(request.body.name || '').trim();
	const email = String(request.body.email || request.body.contact || '').trim().toLowerCase();
	const phone = String(request.body.phone || '').trim();
	const normalizedPhone = phone.replace(/[\s()-]/g, '');
	const dailyRate = Number(request.body.dailyRate || 0);
	const hourlyRate = Number(request.body.hourlyRate || 0);
	const selectedProjectIds = normalizeProjectIds(request.body.projectIds, data.projects);
	if (!name || !/^\S+@\S+\.\S+$/.test(email) || !ownerSiret || !ownerCompany || !selectedProjectIds.length || dailyRate < 0 || hourlyRate < 0) return response.status(400).json({ error: 'Name, worker email, owner company/SIRET, at least one chantier, daily rate, and hourly rate are required' });
	if ((email && data.users.some((user) => user.email && user.email.toLowerCase() === email)) || (phone && data.users.some((user) => user.phone && user.phone.replace(/[\s()-]/g, '') === normalizedPhone))) return response.status(409).json({ error: 'Worker already exists' });
	const user = { id: `user-${Date.now()}`, name, email, phone, deliveryMethod: 'email', role: 'user', siret: '', company: ownerCompany, employerSiret: ownerSiret, employerCompany: ownerCompany, invitedBy: request.user.sub, projectIds: selectedProjectIds, dailyRate, hourlyRate, passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12), passwordChangedAt: Math.floor(Date.now() / 1000) };
	const setupUrl = createPasswordSetupUrl(data, user.id);
	const assignedProjectNames = selectedProjectIds.map((projectId) => (data.projects || []).find((project) => project.id === projectId)?.name || projectId).join(', ');
	const credentialsText = `Bonjour ${name},\n\n${request.user.name} vous a invité dans IBRA-BA pour la société ${ownerCompany}.\nSIRET: ${ownerSiret}\nChantiers attribués: ${assignedProjectNames}\nIdentifiant : ${email}\n\nCliquez ici pour choisir votre mot de passe : ${setupUrl}\n\nVous pourrez ensuite saisir vos jours de travail et vos rendez-vous/absences. Ce lien est valable 7 jours.`;
	const mailResult = await sendMailSafe({ to: email, subject: 'IBRA-BA - invitation ouvrier', text: credentialsText });
	if (mailResult.skipped && process.env.NODE_ENV === 'production') return response.status(503).json({ error: 'Email delivery is not configured' });
	data.users.push(user);
	await writeData(data);
	const { passwordHash, ...safeUser } = user;
	response.status(201).json({ ...safeUser, delivery: mailResult.skipped ? 'manual' : 'email', ...(mailResult.skipped ? { setupUrl } : {}) });
});
app.patch('/api/users/:id', auth, manager, async (request, response) => {
	const data = await readData();
	const user = data.users.find((item) => item.id === request.params.id);
	if (!user) return response.status(404).json({ error: 'User not found' });
	if (user.id === request.user.sub) return response.status(400).json({ error: 'Edit your own account through the account flow' });
	const name = String(request.body.name ?? user.name).trim();
	const contact = String(request.body.contact || '').trim();
	const email = contact ? (/^\S+@\S+\.\S+$/.test(contact) ? contact.toLowerCase() : '') : String(request.body.email ?? user.email ?? '').trim().toLowerCase();
	const phone = contact ? (email ? '' : contact) : String(request.body.phone ?? user.phone ?? '').trim();
	const normalizedPhone = phone.replace(/[\s()-]/g, '');
	if (!name || (!email && !phone)) return response.status(400).json({ error: 'Name and phone or email are required' });
	if ((email && data.users.some((item) => item.id !== user.id && item.email && item.email.toLowerCase() === email)) || (phone && data.users.some((item) => item.id !== user.id && item.phone && item.phone.replace(/[\s()-]/g, '') === normalizedPhone))) return response.status(409).json({ error: 'User already exists' });
	const isWorker = isWorkerRole(user.role);
	const hasProjectAssignment = request.body.projectIds !== undefined;
	const projectIds = hasProjectAssignment ? normalizeProjectIds(request.body.projectIds, data.projects) : (user.projectIds || []);
	if (isWorker && hasProjectAssignment && !projectIds.length) return response.status(400).json({ error: 'At least one chantier is required for a worker' });
	const dailyRate = request.body.dailyRate === undefined ? user.dailyRate : Number(request.body.dailyRate);
	const hourlyRate = request.body.hourlyRate === undefined ? user.hourlyRate : Number(request.body.hourlyRate);
	if (!Number.isFinite(dailyRate) || dailyRate < 0 || !Number.isFinite(hourlyRate) || hourlyRate < 0) return response.status(400).json({ error: 'Rates must be non-negative numbers' });
	user.name = name;
	user.email = email;
	user.phone = phone;
	user.dailyRate = dailyRate;
	user.hourlyRate = hourlyRate;
	if (isWorker && hasProjectAssignment) user.projectIds = projectIds;
	data.timeEntries = (data.timeEntries || []).map((entry) => entry.workerId === user.id ? { ...entry, workerName: user.name } : entry);
	await writeData(data);
	const { passwordHash, ...safeUser } = user;
	response.json(safeUser);
});
app.post('/api/users/:id/password-reset', auth, manager, async (request, response) => {
	const data = await readData();
	const user = data.users.find((item) => item.id === request.params.id);
	if (!user) return response.status(404).json({ error: 'User not found' });
	if (user.id === request.user.sub) return response.status(400).json({ error: 'Use the account password flow for your own account' });
	if (!user.email) return response.status(400).json({ error: 'This user has no email address for password reset' });
	const setupUrl = createPasswordSetupUrl(data, user.id);
	try {
		const mailResult = await sendMailSafe({ to: user.email, subject: 'IBRA-BA - nouveau lien de mot de passe', text: `Bonjour ${user.name},\n\nUn nouveau lien de configuration de mot de passe a été demandé pour votre accès IBRA-BA :\n\n${setupUrl}\n\nCe lien est valable 7 jours.` });
		if (mailResult.skipped && process.env.NODE_ENV === 'production') return response.status(503).json({ error: 'Email delivery is not configured' });
		await writeData(data);
		return response.json({ message: mailResult.skipped ? 'Reset link prepared for local testing.' : 'Reset link sent.', delivery: mailResult.skipped ? 'manual' : 'email', ...(mailResult.skipped ? { setupUrl } : {}) });
	} catch (error) {
		return response.status(502).json({ error: error.message || 'Password reset delivery failed' });
	}
});
app.get('/api/worker-assignments', auth, manager, async (request, response) => {
	const data = await readData();
	const managerUser = data.users.find((user) => user.id === request.user.sub) || request.userRecord;
	const ownerUsers = (data.users || []).filter((user) => isOwnerRole(user.role));
	const managerOwnsWorker = (worker) => {
		if (request.user.role === 'admin') return true;
		const owner = companyOwnerForUser(data, worker);
		return owner?.id === managerUser.id || (ownerUsers.length === 1 && !worker.invitedBy && !worker.employerSiret && !worker.employerCompany);
	};
	const projects = (data.projects || []).filter((project) => project.status !== 'archived' && (request.user.role === 'admin' || !(managerUser.projectIds || []).length || (managerUser.projectIds || []).includes(project.id)));
	const workers = (data.users || []).filter((user) => isWorkerRole(user.role) && managerOwnsWorker(user));
	response.json({ workers: workers.map((user) => ({ ...publicUser(user, companyProfileForUser(data, user)), dailyRate: user.dailyRate || 0, hourlyRate: user.hourlyRate || 0 })), projects, assignments: workers.map((user) => ({ userId: user.id, projectIds: user.projectIds || [] })) });
});
app.put('/api/worker-assignments', auth, manager, async (request, response) => {
	const data = await readData();
	const assignments = Array.isArray(request.body.assignments) ? request.body.assignments : null;
	if (!assignments) return response.status(400).json({ error: 'Assignments must be an array' });
	const managerUser = data.users.find((user) => user.id === request.user.sub) || request.userRecord;
	const ownerUsers = (data.users || []).filter((user) => isOwnerRole(user.role));
	const managerOwnsWorker = (worker) => request.user.role === 'admin' || companyOwnerForUser(data, worker)?.id === managerUser.id || (ownerUsers.length === 1 && !worker.invitedBy && !worker.employerSiret && !worker.employerCompany);
	const projects = (data.projects || []).filter((project) => project.status !== 'archived' && (request.user.role === 'admin' || !(managerUser.projectIds || []).length || (managerUser.projectIds || []).includes(project.id)));
	const availableIds = new Set(projects.map((project) => project.id));
	const updateMap = new Map();
	for (const assignment of assignments) {
		const worker = data.users.find((user) => user.id === assignment?.userId);
		if (!worker || !isWorkerRole(worker.role) || !managerOwnsWorker(worker)) return response.status(403).json({ error: 'Access denied for this worker' });
		const requested = Array.isArray(assignment.projectIds) ? [...new Set(assignment.projectIds.map(String))] : [];
		if (requested.some((projectId) => !availableIds.has(projectId))) return response.status(400).json({ error: 'One or more chantier assignments are invalid' });
		updateMap.set(worker.id, requested);
	}
	for (const [workerId, projectIds] of updateMap) {
		const worker = data.users.find((user) => user.id === workerId);
		worker.projectIds = projectIds;
	}
	await writeData(data);
	response.json({ assignments: [...updateMap].map(([userId, projectIds]) => ({ userId, projectIds })) });
});
app.delete('/api/users/:id', auth, manager, async (request, response) => {
	if (request.params.id === request.user.sub) return response.status(400).json({ error: 'You cannot remove your own active account' });
	const data = await readData();
	const user = data.users.find((item) => item.id === request.params.id);
	if (!user) return response.status(404).json({ error: 'User not found' });
	if (isOwnerRole(user.role)) {
		const remainingManagers = data.users.filter((item) => item.id !== user.id && isOwnerRole(item.role));
		if (!remainingManagers.length) return response.status(400).json({ error: 'At least one manager/admin account must remain' });
	}
	data.users = data.users.filter((item) => item.id !== user.id);
	data.messages = (data.messages || []).filter((item) => item.senderId !== user.id && item.recipientId !== user.id);
	await writeData(data);
	response.json({ removed: true, id: user.id, name: user.name });
});
const slugifyProjectId = (value) => {
	const base = String(value || 'chantier').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'chantier';
	return base;
};
const defaultControlsForProject = (projectId) => [
	{ id: `${projectId}-execution-quality`, projectId, name: 'Radovi izvedeni prema projektu i pravilima struke', status: 'review', owner: 'Gérant' },
	{ id: `${projectId}-site-safety`, projectId, name: 'Bezbednost na gradilištu i zaštitna oprema', status: 'review', owner: 'Gérant' },
	{ id: `${projectId}-material-traceability`, projectId, name: 'Materijali, ugradnja i sledljivost', status: 'review', owner: 'Gérant' },
	{ id: `${projectId}-photo-evidence`, projectId, name: 'Fotografije i dokazi po fazama rada', status: 'incomplete', owner: 'Gérant' }
];
app.get('/api/projects', auth, async (request, response) => {
	const projects = (await readData()).projects || [];
	const visible = isOwnerRole(request.user.role) ? projects : projects.filter((project) => (request.user.projectIds || []).includes(project.id));
	response.json(visible);
});
app.post('/api/projects', auth, manager, async (request, response) => {
	const name = String(request.body.name || request.body.chantierName || '').trim();
	if (!name) return response.status(400).json({ error: 'Chantier name is required' });
	const data = await readData();
	let id = slugifyProjectId(name);
	if ((data.projects || []).some((project) => project.id === id)) id = `${id}-${Date.now()}`;
	const project = { id, name, location: String(request.body.location || '').trim(), progress: 0, status: 'active', manager: request.user.name || request.user.sub, createdAt: new Date().toISOString() };
	data.projects = [...(data.projects || []), project];
	data.chantierControls = [...(data.chantierControls || []), ...defaultControlsForProject(id)];
	data.users = (data.users || []).map((user) => isOwnerRole(user.role) ? { ...user, projectIds: [...new Set([...(user.projectIds || []), id])] } : user);
	await writeData(data);
	response.status(201).json(project);
});
app.patch('/api/projects/:id/progress', auth, manager, async (request, response) => {
	const progress = Number(request.body.progress);
	if (!Number.isFinite(progress) || progress < 0 || progress > 100) return response.status(400).json({ error: 'Progress must be a number between 0 and 100' });
	const data = await readData();
	const project = (data.projects || []).find((item) => item.id === request.params.id);
	if (!project) return response.status(404).json({ error: 'Chantier not found' });
	project.progress = Math.round(progress);
	project.progressUpdatedAt = new Date().toISOString();
	project.progressUpdatedBy = request.user.sub;
	await writeData(data);
	response.json(project);
});
app.delete('/api/projects/:id', auth, manager, async (request, response) => {
	if (request.params.id === 'lot-a') return response.status(400).json({ error: 'Default chantier cannot be removed' });
	const data = await readData();
	const project = (data.projects || []).find((item) => item.id === request.params.id);
	if (!project) return response.status(404).json({ error: 'Chantier not found' });
	data.projects = (data.projects || []).filter((item) => item.id !== request.params.id);
	data.projectBudgets = (data.projectBudgets || []).filter((item) => item.projectId !== request.params.id);
	data.projectSchedules = (data.projectSchedules || []).filter((item) => item.projectId !== request.params.id);
	data.projectDelays = (data.projectDelays || []).filter((item) => item.projectId !== request.params.id);
	data.chantierControls = (data.chantierControls || []).filter((item) => item.projectId !== request.params.id);
	data.controlHistory = (data.controlHistory || []).filter((item) => item.projectId !== request.params.id);
	data.documents = (data.documents || []).filter((item) => item.projectId !== request.params.id);
	data.purchases = (data.purchases || []).filter((item) => item.projectId !== request.params.id);
	data.workReports = (data.workReports || []).filter((item) => item.projectId !== request.params.id);
	data.messages = (data.messages || []).filter((item) => item.projectId !== request.params.id);
	data.rendezvous = (data.rendezvous || []).filter((item) => item.projectId !== request.params.id);
	data.timeEntries = (data.timeEntries || []).filter((item) => item.projectId !== request.params.id);
	data.users = (data.users || []).map((user) => ({ ...user, projectIds: (user.projectIds || []).filter((id) => id !== request.params.id) }));
	await writeData(data);
	response.json({ removed: true, id: project.id, name: project.name });
});
app.get('/api/projects/:id/schedule', auth, async (request, response) => {
	const data = await readData();
	if (!canAccessProject(data, request.user, request.params.id)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const schedule = (data.projectSchedules || []).find((item) => item.projectId === request.params.id);
	const delays = (data.projectDelays || []).filter((item) => item.projectId === request.params.id);
	const delayDays = delays.reduce((sum, item) => sum + Number(item.days || 0), 0);
	const plannedEnd = schedule?.plannedEndDate ? new Date(`${schedule.plannedEndDate}T00:00:00Z`) : null;
	const adjustedEnd = plannedEnd ? new Date(plannedEnd.getTime() + delayDays * 86400000).toISOString().slice(0, 10) : null;
	response.json({ ...(schedule || { projectId: request.params.id }), delayDays, adjustedEndDate: adjustedEnd, delays });
});
app.post('/api/projects/:id/schedule', auth, manager, async (request, response) => {
	const data = await readData();
	if (!canAccessProject(data, request.user, request.params.id)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const startDate = String(request.body.startDate || '').trim(); const plannedEndDate = String(request.body.plannedEndDate || '').trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(plannedEndDate) || new Date(`${plannedEndDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) return response.status(400).json({ error: 'Valid start and planned end dates are required' });
	const schedule = { projectId: request.params.id, startDate, plannedEndDate, updatedBy: request.user.sub, updatedAt: new Date().toISOString() };
	data.projectSchedules = [...(data.projectSchedules || []).filter((item) => item.projectId !== request.params.id), schedule]; await writeData(data); response.status(201).json(schedule);
});
app.post('/api/projects/:id/delays', auth, manager, async (request, response) => {
	const data = await readData();
	if (!canAccessProject(data, request.user, request.params.id)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const days = Number(request.body.days || 0); const reason = String(request.body.reason || '').trim();
	if (!Number.isFinite(days) || days <= 0 || !['weather', 'materials', 'client', 'technical', 'other'].includes(request.body.category) || !reason) return response.status(400).json({ error: 'Delay category, positive days, and reason are required' });
	const delay = { id: `delay-${Date.now()}`, projectId: request.params.id, category: request.body.category, days, reason, createdBy: request.user.sub, createdAt: new Date().toISOString() };
	data.projectDelays = [...(data.projectDelays || []), delay]; await writeData(data); response.status(201).json(delay);
});
app.get('/api/projects/:id/budget', auth, async (request, response) => {
	const data = await readData();
	if (!canAccessProject(data, request.user, request.params.id)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const budget = (data.projectBudgets || []).find((item) => item.projectId === request.params.id);
	response.json(budget || { projectId: request.params.id, status: 'missing', total: 0, spent: 0, remaining: 0 });
});
const parseAmount = (value) => {
	const number = Number(String(value || '').replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
	return Number.isFinite(number) ? number : 0;
};
const extractDevisFields = (text) => {
	const normalized = String(text || '').replace(/\s+/g, ' ').trim();
	const amountMatches = [...normalized.matchAll(/(?:net à payer|total\s+(?:ttc|t\.t\.c\.)|montant\s+total|total)\s*[:=]?\s*([\d\s.,]+)\s*(?:€|eur)?/gi)];
	const rawAmount = amountMatches.at(-1)?.[1] || '';
	return {
		number: normalized.match(/(?:devis|devis n(?:°|o)?|référence|reference)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_.-]{2,})/i)?.[1] || '',
		client: normalized.match(/(?:client|donneur d'ordre)\s*[:#-]?\s*([^|;]{2,80}?)(?=\s+(?:adresse|chantier|travaux|total|montant)\b|$)/i)?.[1]?.trim() || '',
		chantier: normalized.match(/(?:adresse du projet|adresse chantier|chantier|projet|lieu des travaux)\s*[:#-]?\s*([^|;]{2,160}?)(?=\s+(?:adresse|travaux|total|montant|net à payer|devis)\b|$)/i)?.[1]?.trim() || '',
		total: parseAmount(rawAmount)
	};
};
const inspectDevisWithGemini = async (file) => {
	const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
	if (!geminiApiKey) return null;
	const model = (process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').replace(/^models\//, '');
	const prompt = 'Read this French construction quote/devis PDF. Return only JSON with fields: number string, client string, chantier string, total number. Use the final TTC/net payable total when available. If a field is not visible, use empty string or 0.';
	const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			generationConfig: { temperature: 0, responseMimeType: 'application/json' },
			contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: file.mimetype || 'application/pdf', data: file.buffer.toString('base64') } }] }]
		})
	});
	if (!geminiResponse.ok) {
		const details = await geminiResponse.text();
		console.error('Gemini devis inspect rejected', geminiResponse.status, details.slice(0, 500));
		return null;
	}
	const result = await geminiResponse.json();
	try { return JSON.parse(String(result.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()); } catch { return null; }
};
app.post('/api/budget/inspect', auth, memoryUpload.single('file'), fixUploadFilenameEncoding, async (request, response) => {
	if (!request.file || (request.file.mimetype !== 'application/pdf' && !request.file.originalname.toLowerCase().endsWith('.pdf'))) return response.status(400).json({ error: 'A Devis PDF is required' });
	let text = '';
	try { text = (await parsePdf(request.file.buffer)).text.replace(/\s+/g, ' ').trim(); } catch (error) { console.error('Devis PDF text parse failed:', error.message); }
	const extracted = extractDevisFields(text);
	let source = request.file.originalname;
	if (!extracted.number || !extracted.client || !extracted.chantier || !extracted.total) {
		const ai = await inspectDevisWithGemini(request.file);
		if (ai) {
			extracted.number = extracted.number || String(ai.number || '');
			extracted.client = extracted.client || String(ai.client || '');
			extracted.chantier = extracted.chantier || String(ai.chantier || '');
			extracted.total = extracted.total || parseAmount(ai.total);
			source = `${request.file.originalname} · Gemini`;
		}
	}
	response.json({ extracted, textFound: text.length > 0, needsConfirmation: !extracted.number || !extracted.client || !extracted.chantier || !extracted.total, source, aiFallbackUsed: source.includes('Gemini') });
});
app.post('/api/pdf/inspect', auth, memoryUpload.single('file'), fixUploadFilenameEncoding, async (request, response) => {
	if (!request.file || request.file.mimetype !== 'application/pdf') return response.status(400).json({ error: 'A PDF file is required' });
	const parsed = await parsePdf(request.file.buffer);
	const text = parsed.text.replace(/\s+/g, ' ').trim();
	const amountMatch = text.match(/(?:total|montant|amount|ukupno)\s*(?:ttc|t\.t\.c\.|eur|€)?\s*[:=]?\s*([\d\s.,]+)/i);
	const dateMatch = text.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/);
	const supplier = text.match(/(?:fournisseur|supplier|dobavljač|vendeur)\s*[:=-]?\s*([^|;]{2,80})/i)?.[1]?.trim() || '';
	const number = text.match(/(?:facture|invoice|facture n|račun|devis)\s*(?:n°|no|br\.?|#)?\s*[:=-]?\s*([A-Z0-9][A-Z0-9/_.-]{2,})/i)?.[1] || '';
	const amount = amountMatch ? Number(amountMatch[1].replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')) : 0;
	response.json({ textFound: text.length > 0, extracted: { number, supplier, date: dateMatch?.[1] || '', amount: Number.isFinite(amount) ? amount : 0 }, source: request.file.originalname, needsOcr: text.length === 0 });
});
app.get('/api/projects/:id/financial-summary', auth, async (request, response) => {
	const data = await readData();
	if (!canAccessProject(data, request.user, request.params.id)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const budget = (data.projectBudgets || []).find((item) => item.projectId === request.params.id);
	const purchases = (data.purchases || []).filter((item) => item.projectId === request.params.id);
	const approvedHours = (data.timeEntries || []).filter((item) => item.projectId === request.params.id && item.status === 'approved');
	const laborCosts = (data.projectLaborCosts || []).filter((item) => item.projectId === request.params.id);
	const usersById = new Map((data.users || []).map((user) => [user.id, user]));
	const purchaseCategories = ['material', 'tools', 'machines', 'workers', 'subcontracting', 'other'];
	const purchaseTotals = Object.fromEntries(purchaseCategories.map((category) => [category, purchases.filter((item) => item.category === category).reduce((sum, item) => sum + Number(item.amount || 0), 0)]));
	const purchaseTotal = Object.values(purchaseTotals).reduce((sum, amount) => sum + amount, 0);
	const approvedWorkHours = approvedHours.reduce((sum, item) => sum + Number(item.hours || 0), 0);
	const approvedWorkAmount = approvedHours.reduce((sum, item) => sum + Number(item.workAmount || 0), 0);
	const approvedLaborTotal = laborCosts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
	const spent = purchaseTotal + approvedLaborTotal + approvedWorkAmount;
	const breakdown = { ...purchaseTotals, approvedLabor: approvedLaborTotal, approvedWorkHours, approvedWorkAmount };
	response.json({ projectId: request.params.id, budget: budget?.total || 0, purchases: purchaseTotal, approvedWorkHours, approvedWorkAmount, approvedLaborTotal, laborCosts, breakdown, spent, remaining: budget ? budget.total - spent : null, budgetStatus: budget ? 'available' : 'missing' });
});
app.post('/api/projects/:id/labor-costs', auth, manager, async (request, response) => {
	const data = await readData();
	if (!canAccessProject(data, request.user, request.params.id)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const month = String(request.body.month || '');
	const amount = Number(request.body.amount || 0);
	const description = String(request.body.description || '').trim();
	if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(amount) || amount < 0) return response.status(400).json({ error: 'Month and a non-negative final worker amount are required' });
	const existing = (data.projectLaborCosts || []).find((item) => item.projectId === request.params.id && item.month === month);
	const laborCost = { id: existing?.id || `labor-cost-${Date.now()}`, projectId: request.params.id, month, amount, description, status: 'final', enteredBy: request.user.sub, updatedAt: new Date().toISOString() };
	data.projectLaborCosts = [...(data.projectLaborCosts || []).filter((item) => item.id !== existing?.id), laborCost];
	await writeData(data);
	response.status(existing ? 200 : 201).json(laborCost);
});
app.post('/api/projects/:id/budget', auth, manager, upload.single('file'), fixUploadFilenameEncoding, async (request, response) => {
	const uploadedPdf = request.file?.buffer || null;
	if (!request.file || !(request.file.mimetype === 'application/pdf' || request.file.originalname.toLowerCase().endsWith('.pdf') || uploadedPdf?.subarray(0, 5).toString() === '%PDF-')) return response.status(400).json({ error: 'A Devis PDF is required' });
	const total = Number(request.body.total || 0);
	if (!Number.isFinite(total) || total <= 0) return response.status(400).json({ error: 'Devis total is required' });
	const data = await readData();
	let context;
	try { assertProjectAccess(data, request.user, request.params.id); context = projectContextFor(data, request.params.id); } catch (error) { return response.status(error.status || 500).json({ error: error.message }); }
	const existing = (data.projectBudgets || []).find((item) => item.projectId === request.params.id);
	if (existing && existing.devisNumber && String(request.body.devisNumber || '') !== existing.devisNumber && request.body.replaceExisting !== 'true') return response.status(409).json({ error: 'An active Devis already exists. Confirm replacement explicitly.' });
	const sourceFile = storageKeyFor(request.file.originalname);
	try { await uploadFile(UPLOADS_BUCKET, sourceFile, request.file.buffer, request.file.mimetype); } catch (uploadError) { return response.status(502).json({ error: 'Devis upload failed: ' + uploadError.message }); }
	const budget = { id: existing?.id || `budget-${Date.now()}`, projectId: request.params.id, projectName: context.projectName, chantierName: String(request.body.chantierName || context.projectName), devisNumber: String(request.body.devisNumber || ''), client: String(request.body.client || ''), total, spent: existing?.spent || 0, remaining: total - (existing?.spent || 0), sourceFile, sourceName: request.file.originalname, status: 'uploaded', uploadedBy: request.user.sub, updatedAt: new Date().toISOString() };
	data.projectBudgets = [...(data.projectBudgets || []).filter((item) => item.projectId !== request.params.id), budget];
	await writeData(data); response.status(201).json(budget);
});
app.get('/api/purchases', auth, async (request, response) => {
	const data = await readData();
	response.json((data.purchases || []).filter((item) => canAccessProject(data, request.user, item.projectId)));
});
app.post('/api/purchases', auth, manager, upload.single('invoice'), fixUploadFilenameEncoding, async (request, response) => {
	if (!request.file || request.file.mimetype !== 'application/pdf') return response.status(400).json({ error: 'A purchase invoice PDF is required' });
	const amount = Number(request.body.amount || 0);
	const category = String(request.body.category || 'other');
	if (!request.body.projectId || !request.body.supplier || !request.body.description || !Number.isFinite(amount) || amount <= 0 || !['material', 'tools', 'machines', 'workers', 'subcontracting', 'other'].includes(category)) return response.status(400).json({ error: 'Purchase fields are incomplete' });
	const data = await readData();
	let context;
	try { assertProjectAccess(data, request.user, request.body.projectId); context = projectContextFor(data, request.body.projectId); } catch (error) { return response.status(error.status || 500).json({ error: error.message }); }
	const invoiceFile = storageKeyFor(request.file.originalname);
	try { await uploadFile(UPLOADS_BUCKET, invoiceFile, request.file.buffer, request.file.mimetype); } catch (uploadError) { return response.status(502).json({ error: 'Invoice upload failed: ' + uploadError.message }); }
	const purchase = { id: `purchase-${Date.now()}`, projectId: String(request.body.projectId), projectName: context.projectName, budgetId: context.budgetId, devisNumber: context.devisNumber, category, supplier: String(request.body.supplier), description: String(request.body.description), amount, purchaseDate: String(request.body.purchaseDate || new Date().toISOString().slice(0, 10)), invoiceFile, invoiceName: request.file.originalname, createdBy: request.user.sub, createdAt: new Date().toISOString() };
	data.purchases = [...(data.purchases || []), purchase]; await writeData(data); response.status(201).json(purchase);
});
app.get('/api/projects/:id/chantier-controls', auth, async (request, response) => {
	if (!isOwnerRole(request.user.role) && !(request.user.projectIds || []).includes(request.params.id)) return response.status(403).json({ error: 'Access denied' });
	response.json((await readData()).chantierControls.filter((item) => item.projectId === request.params.id));
});
app.patch('/api/chantier-controls/:id', auth, async (request, response) => {
	if (!isOwnerRole(request.user.role)) return response.status(403).json({ error: 'Only owners can update controls' });
	const data = await readData(); const control = data.chantierControls.find((item) => item.id === request.params.id);
	if (!control) return response.status(404).json({ error: 'Control not found' });
	const status = String(request.body.status || '');
	if (!['complete', 'review', 'incomplete'].includes(status)) return response.status(400).json({ error: 'Invalid control status' });
	if (status === 'complete') {
		const documents = data.documents.filter((item) => item.projectId === control.projectId);
		const required = ['plan', 'fiche-technique', 'photo-before', 'photo-during', 'photo-after'];
		const missing = required.filter((type) => !documents.some((item) => item.evidenceType === type));
		if (missing.length) return response.status(409).json({ error: 'Evidence package is incomplete', missing });
	}
	const previousStatus = control.status;
	const changedAt = new Date().toISOString();
	control.status = status; control.updatedBy = request.user.sub; control.updatedAt = changedAt;
	data.controlHistory = [...(data.controlHistory || []), { id: `control-history-${Date.now()}`, controlId: control.id, projectId: control.projectId, from: previousStatus, to: status, changedBy: request.user.sub, changedAt }];
	await writeData(data); response.json(control);
});
app.get('/api/projects/:id/control-history', auth, async (request, response) => {
	const data = await readData();
	if (!canAccessProject(data, request.user, request.params.id)) return response.status(403).json({ error: 'Access denied for this chantier' });
	response.json((data.controlHistory || []).filter((item) => item.projectId === request.params.id));
});
app.get('/api/messages', auth, async (request, response) => {
	const data = await readData();
	response.json((data.messages || []).filter((item) => (item.senderId === request.user.sub || item.recipientId === request.user.sub) && (!item.projectId || canAccessProject(data, request.user, item.projectId))));
});
app.post('/api/messages', auth, async (request, response) => {
	const data = await readData(); const text = String(request.body.text || '').trim();
	if (!text || !request.body.recipientId) return response.status(400).json({ error: 'Message fields required' });
	const recipient = data.users.find((item) => item.id === request.body.recipientId); if (!recipient) return response.status(404).json({ error: 'Recipient not found' });
	const projectId = String(request.body.projectId || '').trim();
	let context = { projectName: '', budgetId: null, devisNumber: null };
	if (projectId) {
		try { context = projectContextFor(data, projectId); assertProjectAccess(data, request.user, projectId, isWorkerRole(request.user.role) ? request.userRecord : null); if (isWorkerRole(recipient.role) && !(recipient.projectIds || []).includes(projectId)) throw Object.assign(new Error('Recipient is not assigned to this chantier'), { status: 403 }); } catch (error) { return response.status(error.status || 500).json({ error: error.message }); }
	} else {
		const senderOwner = companyOwnerForUser(data, request.userRecord) || request.userRecord;
		const recipientOwner = companyOwnerForUser(data, recipient) || recipient;
		if (senderOwner.id !== recipientOwner.id) return response.status(403).json({ error: 'Access denied for this recipient' });
	}
	const message = { id: `message-${Date.now()}`, senderId: request.user.sub, senderName: request.user.name, recipientId: recipient.id, recipientName: recipient.name, projectId: projectId || null, projectName: context.projectName, budgetId: context.budgetId, devisNumber: context.devisNumber, text, createdAt: new Date().toISOString(), read: false };
	data.messages.push(message); await writeData(data);
	await sendPushToUser(data, recipient.id, { title: request.user.name, body: text, tag: 'ibra-message', url: '/' }).catch(() => {});
	response.status(201).json(message);
});
app.delete('/api/messages/:id', auth, async (request, response) => {
	const data = await readData();
	const message = (data.messages || []).find((item) => item.id === request.params.id);
	if (!message) return response.status(404).json({ error: 'Message not found' });
	if (message.senderId !== request.user.sub && !isOwnerRole(request.user.role)) return response.status(403).json({ error: 'Access denied' });
	data.messages = (data.messages || []).filter((item) => item.id !== message.id);
	await writeData(data);
	response.json({ deleted: true, id: message.id });
});
app.post('/api/messages/read', auth, async (request, response) => {
	const partnerId = String(request.body.partnerId || '');
	const data = await readData();
	const updatedIds = [];
	(data.messages || []).forEach((item) => {
		if (item.recipientId === request.user.sub && item.senderId === partnerId && !item.read) { item.read = true; updatedIds.push(item.id); }
	});
	if (updatedIds.length) await writeData(data);
	response.json({ updated: updatedIds });
});
app.get('/api/push/public-key', (_request, response) => response.json({
	publicKey: vapidPublicKey,
	enabled: pushEnabled,
}));
app.post('/api/push/subscribe', auth, async (request, response) => {
	const subscription = request.body.subscription;
	if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return response.status(400).json({ error: 'Invalid push subscription' });
	const data = await readData();
	data.pushSubscriptions = (data.pushSubscriptions || []).filter((item) => item.endpoint !== subscription.endpoint);
	data.pushSubscriptions.push({ userId: request.user.sub, endpoint: subscription.endpoint, subscription, createdAt: new Date().toISOString() });
	await writeData(data);
	response.status(201).json({ subscribed: true });
});
app.post('/api/push/unsubscribe', auth, async (request, response) => {
	const endpoint = String(request.body.endpoint || '');
	const data = await readData();
	data.pushSubscriptions = (data.pushSubscriptions || []).filter((item) => !(item.endpoint === endpoint && item.userId === request.user.sub));
	await writeData(data);
	response.json({ unsubscribed: true });
});
const dateOnlyTimestamp = (value) => {
	const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return Number.NaN;
	const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : Number.NaN;
};
const resolveRendezvousOwner = (data, worker) => {
	if (!worker) return null;
	const invitedOwner = data.users.find((user) => user.id === worker.invitedBy && isOwnerRole(user.role));
	if (invitedOwner) return invitedOwner;
	const employerSiret = cleanSiret(worker.employerSiret);
	return employerSiret ? data.users.find((user) => isOwnerRole(user.role) && cleanSiret(user.siret) === employerSiret) || null : null;
};
app.get('/api/rendezvous', auth, async (request, response) => {
	const data = await readData(); const canSeeAll = isOwnerRole(request.user.role);
	response.json((data.rendezvous || []).filter((item) => (canSeeAll || item.workerId === request.user.sub) && (!item.projectId || canAccessProject(data, request.user, item.projectId))));
});
app.post('/api/rendezvous', auth, async (request, response) => {
	const isOwnerActor = isOwnerRole(request.user.role);
	const type = String(request.body.type || 'rdv').trim() === 'absence' ? 'absence' : 'rdv';
	const projectId = String(request.body.projectId || '').trim();
	const absenceDate = String(request.body.absenceDate || request.body.date || '').trim();
	const date = String(request.body.date || absenceDate).trim();
	const time = String(request.body.time || '').trim();
	const reason = String(request.body.reason || '').trim();
	const todayTimestamp = dateOnlyTimestamp(new Date().toISOString().slice(0, 10));
	const absenceTimestamp = dateOnlyTimestamp(absenceDate);
	const dateTimestamp = dateOnlyTimestamp(date);
	const days = Number.isFinite(absenceTimestamp) && Number.isFinite(todayTimestamp) ? Math.floor((absenceTimestamp - todayTimestamp) / 86400000) : -1;
	if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(absenceTimestamp) || !Number.isFinite(dateTimestamp) || (type !== 'absence' && !isOwnerActor && days < 3)) return response.status(400).json({ error: 'RDV must be declared at least 3 days ahead' });
	const data = await readData();
	const worker = isOwnerActor && request.body.workerId ? data.users.find((user) => user.id === request.body.workerId) : data.users.find((user) => user.id === request.user.sub);
	if (!worker) return response.status(404).json({ error: 'Worker account not found' });
	let context = { projectName: '', budgetId: null, devisNumber: null };
	if (projectId) {
		if (!isOwnerActor && !(request.user.projectIds || []).includes(projectId)) return response.status(403).json({ error: 'Access denied for this chantier' });
		try { context = projectContextFor(data, projectId); assertProjectAccess(data, request.user, projectId, worker); } catch (error) { return response.status(error.status || 500).json({ error: error.message }); }
	} else {
		const actorOwner = companyOwnerForUser(data, request.userRecord) || request.userRecord;
		const workerOwner = companyOwnerForUser(data, worker) || worker;
		if (actorOwner.id !== workerOwner.id) return response.status(403).json({ error: 'Access denied for this worker' });
	}
	const owner = resolveRendezvousOwner(data, worker);
	const item = { id: `rendezvous-${Date.now()}`, projectId: projectId || null, projectName: context.projectName, budgetId: context.budgetId, devisNumber: context.devisNumber, workerId: worker.id, workerName: worker.name, date, time, absenceDate, reason, type, ownerId: owner?.id || null, createdAt: new Date().toISOString() };
	data.rendezvous = [...(data.rendezvous || []), item];
	const notificationText = `Absence/RDV ${absenceDate} à ${time} | ${reason}`;
	data.messages = [...(data.messages || []), ...(owner ? [{ id: `notification-${Date.now()}-${owner.id}`, senderId: 'system', senderName: 'IBRA-BA', recipientId: owner.id, recipientName: owner.name, projectId: projectId || null, text: notificationText, createdAt: new Date().toISOString(), read: false, type: 'rendezvous-notification' }] : [])];
	await writeData(data);
	response.status(201).json(item);
});
app.patch('/api/rendezvous/:id', auth, async (request, response) => {
	const data = await readData();
	const item = (data.rendezvous || []).find((entry) => entry.id === request.params.id);
	if (!item) return response.status(404).json({ error: 'Rendezvous not found' });
	if (!isOwnerRole(request.user.role) && item.workerId !== request.user.sub) return response.status(403).json({ error: 'Access denied' });
	const absenceDate = String(request.body.absenceDate || request.body.date || item.absenceDate).trim();
	const time = String(request.body.time || item.time).trim();
	const reason = request.body.reason !== undefined ? String(request.body.reason).trim() : item.reason;
	if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) || !absenceDate) return response.status(400).json({ error: 'A valid date and time are required' });
	item.absenceDate = absenceDate; item.date = absenceDate; item.time = time; item.reason = reason; item.updatedBy = request.user.sub; item.updatedAt = new Date().toISOString();
	await writeData(data);
	response.json(item);
});
app.delete('/api/rendezvous/:id', auth, async (request, response) => {
	const data = await readData();
	const item = (data.rendezvous || []).find((entry) => entry.id === request.params.id);
	if (!item) return response.status(404).json({ error: 'Rendezvous not found' });
	if (!isOwnerRole(request.user.role) && item.workerId !== request.user.sub) return response.status(403).json({ error: 'Access denied' });
	data.rendezvous = (data.rendezvous || []).filter((entry) => entry.id !== item.id);
	await writeData(data);
	response.json({ deleted: true, id: item.id });
});
app.get('/api/time-entries', auth, async (request, response) => {
	const data = await readData();
	response.json((data.timeEntries || []).filter((item) => (isOwnerRole(request.user.role) || item.workerId === request.user.sub) && (!item.projectId || canAccessProject(data, request.user, item.projectId))));
});
app.post('/api/time-entries', auth, async (request, response) => {
	const [startH,startM] = String(request.body.start || '').split(':').map(Number); const [endH,endM] = String(request.body.end || '').split(':').map(Number); const hours = ((endH * 60 + endM) - (startH * 60 + startM) - Number(request.body.breakMinutes || 0)) / 60;
	const rateType = String(request.body.rateType || 'daily'); const data = await readData(); const canAssignWorker = isOwnerRole(request.user.role); const requestedWorkerId = String(request.body.workerId || '').trim(); const worker = canAssignWorker && requestedWorkerId ? data.users.find((item) => item.id === requestedWorkerId) : data.users.find((item) => item.id === request.user.sub); const profileRate = rateType === 'hourly' ? Number(worker?.hourlyRate || 0) : Number(worker?.dailyRate || 0); const rate = Number(request.body.rate || profileRate);
	if (!worker) return response.status(404).json({ error: 'Worker not found' });
	const projectId = String(request.body.projectId || '').trim();
	if (!request.body.date || !hours || hours < 0 || !['daily', 'hourly'].includes(rateType) || !Number.isFinite(rate) || rate <= 0) return response.status(400).json({ error: 'Date, work time, rate type, and a positive rate are required' });
	let context = { projectName: '', budgetId: null, devisNumber: null };
	if (projectId) {
		try { context = projectContextFor(data, projectId); assertProjectAccess(data, request.user, projectId, worker); } catch (error) { return response.status(error.status || 500).json({ error: error.message }); }
	} else {
		const actorOwner = companyOwnerForUser(data, request.userRecord) || request.userRecord;
		const workerOwner = companyOwnerForUser(data, worker) || worker;
		if (actorOwner.id !== workerOwner.id) return response.status(403).json({ error: 'Access denied for this worker' });
	}
	const isDuplicate = (data.timeEntries || []).some((entry) => entry.workerId === worker.id && entry.projectId === (projectId || null) && entry.date === request.body.date && entry.start === request.body.start && entry.end === request.body.end);
	if (isDuplicate && request.body.confirmDuplicate !== 'true') return response.status(409).json({ error: 'An identical entry already exists for this worker, chantier, date and hours', duplicate: true });
	const workAmount = rateType === 'hourly' ? hours * rate : rate;
	const item = { id: `time-${Date.now()}`, workerId: worker.id, workerName: worker.name, enteredBy: request.user.sub, projectId: projectId || null, projectName: context.projectName, budgetId: context.budgetId, devisNumber: context.devisNumber, date: request.body.date, start: request.body.start, end: request.body.end, breakMinutes: Number(request.body.breakMinutes || 0), hours, rateType, rate, workAmount, status: 'approved' };
	data.timeEntries.push(item); await writeData(data); response.status(201).json(item);
});
app.delete('/api/time-entries/:id', auth, async (request, response) => {
	const data = await readData();
	const entry = data.timeEntries.find((item) => item.id === request.params.id);
	if (!entry) return response.status(404).json({ error: 'Time entry not found' });
	if (!isOwnerRole(request.user.role) && entry.workerId !== request.user.sub) return response.status(403).json({ error: 'Access denied' });
	data.timeEntries = data.timeEntries.filter((item) => item.id !== entry.id);
	await writeData(data);
	response.json({ deleted: true, id: entry.id });
});
app.patch('/api/time-entries/:id', auth, async (request, response) => {
	const data = await readData();
	const entry = data.timeEntries.find((item) => item.id === request.params.id);
	if (!entry) return response.status(404).json({ error: 'Time entry not found' });
	if (!isOwnerRole(request.user.role) && entry.workerId !== request.user.sub) return response.status(403).json({ error: 'Access denied' });
	const date = request.body.date || entry.date;
	const breakMinutes = request.body.breakMinutes !== undefined ? Number(request.body.breakMinutes || 0) : entry.breakMinutes;
	const rateType = ['daily', 'hourly'].includes(request.body.rateType) ? request.body.rateType : entry.rateType;
	const rate = request.body.rate !== undefined ? Number(request.body.rate) : entry.rate;
	let start = request.body.start || entry.start;
	let end = request.body.end || entry.end;
	let hours;
	if (request.body.hours !== undefined && request.body.start === undefined && request.body.end === undefined) {
		hours = Number(request.body.hours);
		const [startH, startM] = String(start || '08:00').split(':').map(Number);
		const endMinutesTotal = (startH * 60 + startM) + hours * 60 + Number(breakMinutes || 0);
		start = start || '08:00';
		end = `${String(Math.floor((endMinutesTotal / 60) % 24)).padStart(2, '0')}:${String(Math.round(endMinutesTotal % 60)).padStart(2, '0')}`;
	} else {
		const [startH, startM] = String(start || '').split(':').map(Number);
		const [endH, endM] = String(end || '').split(':').map(Number);
		hours = ((endH * 60 + endM) - (startH * 60 + startM) - Number(breakMinutes || 0)) / 60;
	}
	if (!date || !hours || hours < 0 || !Number.isFinite(rate) || rate <= 0) return response.status(400).json({ error: 'Date, work time, and a positive rate are required' });
	entry.date = date; entry.start = start; entry.end = end; entry.breakMinutes = Number(breakMinutes || 0); entry.rateType = rateType; entry.rate = rate; entry.hours = hours; entry.workAmount = rateType === 'hourly' ? hours * rate : rate;
	entry.editedBy = request.user.sub; entry.editedAt = new Date().toISOString();
	await writeData(data);
	response.json(entry);
});
app.post('/api/time-entries/pdf/send', auth, async (request, response) => {
	const month = String(request.body.month || previousMonthKey());
	const data = await readData();
	const worker = data.users.find((user) => user.id === request.user.sub);
	const entries = data.timeEntries.filter((entry) => entry.workerId === request.user.sub && entry.date.startsWith(month) && entry.status === 'approved');
	if (!entries.length) return response.status(400).json({ error: 'No approved work entries found for this month' });
	const ownerSiret = worker?.employerSiret || '';
	const managers = data.users.filter((user) => isOwnerRole(user.role) && user.email && (user.id === worker?.invitedBy || (ownerSiret && cleanSiret(user.siret) === cleanSiret(ownerSiret))));
	const recipients = managers.length ? managers : data.users.filter((user) => isOwnerRole(user.role) && user.email);
	if (!recipients.length) return response.status(503).json({ error: 'No owner email is configured' });
	const detailedEntries = entries.map((entry) => ({ ...entry, workAmount: entryAmount(entry, worker), projectLabel: projectLabelFor(data, entry.projectId) }));
	const total = detailedEntries.reduce((sum, entry) => sum + entry.workAmount, 0);
	const days = new Set(detailedEntries.map((entry) => entry.date)).size;
	const branding = await companyBrandingForPdf(data, worker);
	const pdf = await buildHoursPdf({ worker: { name: request.user.name }, ...branding, month, entries: detailedEntries, total });
	const results = await Promise.all(recipients.map((owner) => sendMailSafe({
		to: owner.email,
		subject: `IBRA-BA - lista dana ${request.user.name} - ${month}`,
		text: `Bonjour ${owner.name},\n\n${request.user.name} vous envoie la liste PDF des jours travaillés pour ${month}.\nEntreprise: ${worker?.employerCompany || worker?.company || 'N/A'}\nSIRET: ${worker?.employerSiret || 'N/A'}\nJours: ${days}\nHeures: ${detailedEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0).toFixed(2)}\nMontant: ${total.toFixed(2)} EUR\n\nLe PDF est en pièce jointe.`,
		attachments: [{ filename: `ibra-days-${month}-${request.user.sub}.pdf`, content: pdf }]
	})));
	if (results.every((result) => result.skipped)) return response.status(503).json({ error: 'Email delivery is not configured' });
	data.monthlyPdfSubmissions = [...(data.monthlyPdfSubmissions || []), { id: `hours-pdf-${Date.now()}`, workerId: request.user.sub, workerName: request.user.name, employerSiret: worker?.employerSiret || '', employerCompany: worker?.employerCompany || worker?.company || '', month, days, hours: detailedEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0), amount: total, recipients: recipients.map((user) => user.email), sentAt: new Date().toISOString() }];
	await writeData(data);
	response.json({ message: 'Hours PDF sent to owner', month, days, amount: total, recipients: recipients.map((user) => user.email) });
});
app.get('/api/time-entries/pdf/download', auth, async (request, response) => {
	const month = String(request.query.month || previousMonthKey());
	const requestedWorkerId = String(request.query.workerId || request.user.sub);
	if (requestedWorkerId !== request.user.sub && !isOwnerRole(request.user.role)) return response.status(403).json({ error: 'Access denied' });
	const data = await readData();
	const worker = data.users.find((user) => user.id === requestedWorkerId);
	if (!worker) return response.status(404).json({ error: 'Worker not found' });
	const entries = data.timeEntries.filter((entry) => entry.workerId === requestedWorkerId && entry.date.startsWith(month) && entry.status === 'approved');
	const detailedEntries = entries.map((entry) => ({ ...entry, workAmount: entryAmount(entry, worker), projectLabel: projectLabelFor(data, entry.projectId) }));
	const total = detailedEntries.reduce((sum, entry) => sum + entry.workAmount, 0);
	const branding = await companyBrandingForPdf(data, worker);
	const pdf = await buildHoursPdf({ worker, ...branding, month, entries: detailedEntries, total });
	response.setHeader('Content-Type', 'application/pdf');
	response.setHeader('Content-Disposition', `attachment; filename="ibra-lista-plate-${month}-${worker.name.replace(/[^a-zA-Z0-9]+/g, '-')}.pdf"`);
	response.send(pdf);
});
app.patch('/api/time-entries/:id/status', auth, async (request, response) => {
	if (!isOwnerRole(request.user.role)) return response.status(403).json({ error: 'Only owners can approve time' });
	const data = await readData(); const entry = data.timeEntries.find((item) => item.id === request.params.id);
	if (!entry) return response.status(404).json({ error: 'Time entry not found' });
	const status = String(request.body.status || ''); if (!['approved', 'rejected', 'pending'].includes(status)) return response.status(400).json({ error: 'Invalid time status' });
	entry.status = status; entry.reviewedBy = request.user.sub; entry.reviewedAt = new Date().toISOString(); await writeData(data); response.json(entry);
});
const entryAmount = (entry, user) => Number(entry.workAmount ?? (entry.rateType === 'hourly' ? Number(entry.hours || 0) * Number(entry.rate || user?.hourlyRate || 0) : Number(entry.rate || user?.dailyRate || 0)));
app.get('/api/payroll/summary', auth, manager, async (request, response) => {
	const data = await readData();
	const month = String(request.query.month || new Date().toISOString().slice(0, 7));
	const entries = data.timeEntries.filter((entry) => entry.date.startsWith(month) && entry.status === 'approved');
	const summary = data.users.map((user) => {
		const workerEntries = entries.filter((entry) => entry.workerId === user.id);
		const hours = workerEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
		const days = new Set(workerEntries.map((entry) => entry.date)).size;
		const estimatedTotal = workerEntries.reduce((sum, entry) => sum + entryAmount(entry, user), 0);
		return { userId: user.id, workerName: user.name, dailyRate: user.dailyRate || 0, hourlyRate: user.hourlyRate || 0, days, hours, estimatedTotal, entries: workerEntries.map((entry) => ({ date: entry.date, projectId: entry.projectId, rateType: entry.rateType || 'daily', rate: entry.rate || 0, workAmount: entry.workAmount || 0 })) };
	});
	response.json({ month, summary, total: summary.reduce((sum, item) => sum + item.estimatedTotal, 0) });
});
app.get('/api/my-payroll-summary', auth, async (request, response) => {
	const data = await readData();
	const month = String(request.query.month || new Date().toISOString().slice(0, 7));
	const user = data.users.find((item) => item.id === request.user.sub);
	const entries = data.timeEntries.filter((entry) => entry.workerId === request.user.sub && entry.date.startsWith(month) && entry.status === 'approved');
	const hours = entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
	const days = new Set(entries.map((entry) => entry.date)).size;
	const estimatedTotal = entries.reduce((sum, entry) => sum + entryAmount(entry, user), 0);
	response.json({ month, days, hours, dailyRate: user?.dailyRate || 0, hourlyRate: user?.hourlyRate || 0, estimatedTotal, entries: entries.map((entry) => ({ date: entry.date, projectId: entry.projectId, rateType: entry.rateType || 'daily', rate: entry.rate || 0, workAmount: entry.workAmount || 0 })) });
});
app.get('/api/payout-requests', auth, async (request, response) => {
	const data = await readData(); const managerView = isOwnerRole(request.user.role); response.json((data.payoutRequests || []).filter((item) => managerView || item.userId === request.user.sub));
});
app.post('/api/payout-requests', auth, async (request, response) => {
	const month = String(request.body.month || ''); const days = Number(request.body.days || 0); if (!/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(days) || days < 0) return response.status(400).json({ error: 'Month and a non-negative integer number of days are required' });
	const data = await readData(); const duplicate = (data.payoutRequests || []).find((item) => item.userId === request.user.sub && item.month === month && item.status !== 'rejected'); if (duplicate) return response.status(409).json({ error: 'Payout request already exists for this month' }); const user = data.users.find((item) => item.id === request.user.sub); const amount = days * Number(user?.dailyRate || 0); const item = { id: `payout-${Date.now()}`, userId: request.user.sub, userName: request.user.name, month, days, dailyRate: Number(user?.dailyRate || 0), amount, submissionDate: `${month}-01`, paymentDate: `${month}-15`, status: 'pending', createdAt: new Date().toISOString() }; data.payoutRequests = [...(data.payoutRequests || []), item]; await writeData(data); response.status(201).json(item);
});
app.post('/api/payout-requests/mark-paid', auth, manager, async (request, response) => {
	const userId = String(request.body.userId || '');
	const month = String(request.body.month || '');
	if (!userId || !/^\d{4}-\d{2}$/.test(month)) return response.status(400).json({ error: 'A worker and month are required' });
	const data = await readData();
	const worker = data.users.find((item) => item.id === userId);
	if (!worker) return response.status(404).json({ error: 'Worker not found' });
	const entries = (data.timeEntries || []).filter((entry) => entry.workerId === userId && String(entry.date || '').startsWith(month));
	const days = new Set(entries.map((entry) => entry.date)).size;
	const amount = entries.reduce((sum, entry) => sum + entryAmount(entry, worker), 0);
	let item = (data.payoutRequests || []).find((entry) => entry.userId === userId && entry.month === month && entry.status !== 'rejected');
	const today = new Date().toISOString().slice(0, 10);
	if (item) {
		item.status = 'paid'; item.amount = amount || item.amount; item.days = days || item.days; item.reviewedBy = request.user.sub; item.reviewedAt = new Date().toISOString(); item.paymentDate = today;
	} else {
		item = { id: `payout-${Date.now()}`, userId, userName: worker.name, month, days, dailyRate: Number(worker.dailyRate || 0), amount, submissionDate: `${month}-01`, paymentDate: today, status: 'paid', createdAt: new Date().toISOString(), reviewedBy: request.user.sub, reviewedAt: new Date().toISOString() };
		data.payoutRequests = [...(data.payoutRequests || []), item];
	}
	await writeData(data);
	response.json(item);
});
app.post('/api/payout-requests/set-status', auth, manager, async (request, response) => {
	const userId = String(request.body.userId || '');
	const month = String(request.body.month || '');
	const status = String(request.body.status || '');
	if (!userId || !/^\d{4}-\d{2}$/.test(month) || !['pending', 'critical', 'paid'].includes(status)) return response.status(400).json({ error: 'A worker, month and valid status (pending, critical, paid) are required' });
	const data = await readData();
	const worker = data.users.find((item) => item.id === userId);
	if (!worker) return response.status(404).json({ error: 'Worker not found' });
	const entries = (data.timeEntries || []).filter((entry) => entry.workerId === userId && String(entry.date || '').startsWith(month));
	const days = new Set(entries.map((entry) => entry.date)).size;
	const amount = entries.reduce((sum, entry) => sum + entryAmount(entry, worker), 0);
	let item = (data.payoutRequests || []).find((entry) => entry.userId === userId && entry.month === month && entry.status !== 'rejected');
	const today = new Date().toISOString().slice(0, 10);
	if (item) {
		item.status = status; item.manualOverride = true; item.amount = amount || item.amount; item.days = days || item.days; item.reviewedBy = request.user.sub; item.reviewedAt = new Date().toISOString(); if (status === 'paid') item.paymentDate = today;
	} else {
		item = { id: `payout-${Date.now()}`, userId, userName: worker.name, month, days, dailyRate: Number(worker.dailyRate || 0), amount, submissionDate: `${month}-01`, paymentDate: status === 'paid' ? today : '', status, manualOverride: true, createdAt: new Date().toISOString(), reviewedBy: request.user.sub, reviewedAt: new Date().toISOString() };
		data.payoutRequests = [...(data.payoutRequests || []), item];
	}
	await writeData(data);
	response.json(item);
});
app.get('/api/payout-requests/:id/pdf', auth, async (request, response) => {
	const data = await readData(); const item = (data.payoutRequests || []).find((entry) => entry.id === request.params.id);
	if (!item || (!isOwnerRole(request.user.role) && item.userId !== request.user.sub)) return response.status(404).json({ error: 'Payout request not found' });
	response.setHeader('Content-Type', 'application/pdf'); response.setHeader('Content-Disposition', `attachment; filename="ibra-payout-${item.month}-${item.userId}.pdf"`); response.send(buildPayoutPdf(item));
});
app.patch('/api/payout-requests/:id/status', auth, manager, async (request, response) => {
	const status = String(request.body.status || ''); if (!['approved', 'rejected', 'paid', 'pending'].includes(status)) return response.status(400).json({ error: 'Invalid payout status' }); const data = await readData(); const item = (data.payoutRequests || []).find((entry) => entry.id === request.params.id); if (!item) return response.status(404).json({ error: 'Payout request not found' }); item.status = status; item.reviewedBy = request.user.sub; item.reviewedAt = new Date().toISOString(); await writeData(data); response.json(item);
});
app.get('/api/work-reports', auth, async (request, response) => {
	const data = await readData(); const managerView = isOwnerRole(request.user.role);
	const reports = (data.workReports || []).filter((item) => (managerView || item.workerId === request.user.sub) && canAccessProject(data, request.user, item.projectId)); const financialView = isOwnerRole(request.user.role);
	response.json(financialView ? reports : reports.map(({ unitRate: _unitRate, calculatedAmount: _calculatedAmount, ...report }) => report));
});
app.post('/api/ai/estimate-area', auth, memoryUpload.single('photo'), fixUploadFilenameEncoding, async (request, response) => {
	if (!request.file || !request.file.mimetype.startsWith('image/')) return response.status(400).json({ error: 'A work photo is required' });
	const quantityUnit = request.body.quantityUnit === 'ml' ? 'ml' : 'm2';
	const projectId = String(request.body.projectId || '');
	const projectData = await readData();
	try { assertProjectAccess(projectData, request.user, projectId, isWorkerRole(request.user.role) ? request.userRecord : null); } catch (error) { return response.status(error.status || 500).json({ error: error.message }); }
	const base64Image = request.file.buffer.toString('base64');
	const parseEstimate = (text) => {
		try { return JSON.parse(String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()); } catch { return {}; }
	};
	const normalizeEstimate = (parsed, status = 'estimated') => {
		const rawQuantity = parsed.estimatedQuantity ?? (quantityUnit === 'm2' ? parsed.estimatedM2 : parsed.estimatedMl);
		const estimatedQuantity = Number.isFinite(Number(rawQuantity)) ? Number(rawQuantity) : null;
		return {
			status,
			quantityUnit,
			estimatedQuantity,
			estimatedM2: quantityUnit === 'm2' ? estimatedQuantity : null,
			estimatedMl: quantityUnit === 'ml' ? estimatedQuantity : null,
			confidence: Number(parsed.confidence || 0),
			answer: parsed.reason || parsed.answer || 'Nema pouzdane procene. Dodajte mjeru, metar, laser, plan ili poznatu referencu pa potvrdite ručno.',
			requiresHumanConfirmation: true
		};
	};
	const unitLabel = quantityUnit === 'ml' ? 'linear meters / mètres linéaires / ml' : 'square meters / mètres carrés / m²';
	const data = await readData();
	const sourceDocuments = [];
	for (const document of (data.documents || []).filter((item) => item.projectId === projectId && item.uploadedBy === request.user.sub && ['plan', 'fiche-technique'].includes(item.evidenceType) && item.mimeType?.includes('pdf')).slice(-4)) {
		try {
			const buffer = await downloadFile(UPLOADS_BUCKET, document.storedName);
			const parsed = await parsePdf(buffer);
			if (parsed.text?.trim()) sourceDocuments.push(`File: ${document.originalName}\nType: ${document.evidenceType}\nText:\n${parsed.text.slice(0, 6000)}`);
		} catch (error) {
			console.error('Quantity estimate source document read failed:', error.message);
		}
	}
	const documentContext = sourceDocuments.length ? `\n\nProject documents already uploaded in the app. Use these as dimensional references when they match the photo. Do not use a dimension from the documents unless the photographed façade/zone/detail can be matched to it.\n${sourceDocuments.join('\n\n---\n\n')}` : '\n\nNo plan/fiche technique text is available for this project. If the photo has no visible or known reference, return null.';
	const prompt = `Analyze the work photo and estimate the executed quantity in ${unitLabel}.
Return only JSON with: estimatedQuantity number or null, confidence number 0-1, reason string.
Never invent dimensions. Estimate if the photo can be matched to uploaded project documents with dimensions, a known façade zone/detail, a visible measuring tool, known module size, or clearly countable repeated elements. If there is no visible reference and no matching plan/document dimension, estimatedQuantity must be null and reason must say which plan dimension or photo angle is required.
For m² use visible height x width of executed work. For ml use visible linear length of executed work such as joints, rails, profiles, flashing, bands, base rails, edge trims or linear façade elements.${documentContext}`;
	const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
	if (geminiApiKey) {
		const model = (process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').replace(/^models\//, '');
		const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				generationConfig: { temperature: 0, responseMimeType: 'application/json' },
				contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: request.file.mimetype, data: base64Image } }] }]
			})
		});
		if (geminiResponse.ok) {
			const result = await geminiResponse.json();
			return response.json(normalizeEstimate(parseEstimate(result.candidates?.[0]?.content?.parts?.[0]?.text), 'estimated'));
		}
		const details = await geminiResponse.text();
		console.error('Gemini quantity estimate rejected', geminiResponse.status, details.slice(0, 500));
	}
	const aiBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1'; const aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
	if (!aiApiKey) return response.json(normalizeEstimate({}, 'not_configured'));
	const image = `data:${request.file.mimetype};base64,${base64Image}`; const aiResponse = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${aiApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Estimate construction quantities only with reliable visible scale. Never guess. Return JSON only.' }, { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }] }) });
	if (!aiResponse.ok) return response.status(502).json({ error: 'Vision AI provider unavailable' }); const result = await aiResponse.json(); return response.json(normalizeEstimate(parseEstimate(result.choices?.[0]?.message?.content), 'estimated'));
});
app.post('/api/work-reports', auth, upload.single('photo'), fixUploadFilenameEncoding, async (request, response) => {
	const projectId = String(request.body.projectId || ''); const description = String(request.body.description || '').trim(); const dateInput = String(request.body.date || ''); const capturedAtInput = String(request.body.capturedAt || ''); const locationName = String(request.body.locationName || '').trim(); const latitudeInput = request.body.latitude !== undefined && request.body.latitude !== '' ? Number(request.body.latitude) : null; const longitudeInput = request.body.longitude !== undefined && request.body.longitude !== '' ? Number(request.body.longitude) : null; const latitude = Number.isFinite(latitudeInput) && latitudeInput >= -90 && latitudeInput <= 90 ? latitudeInput : null; const longitude = Number.isFinite(longitudeInput) && longitudeInput >= -180 && longitudeInput <= 180 ? longitudeInput : null; const quantityUnit = request.body.quantityUnit === 'ml' ? 'ml' : 'm2'; const quantity = Number(request.body.quantity || request.body.quantityM2 || 0); const quantityM2 = quantityUnit === 'm2' ? quantity : 0; const quantityMl = quantityUnit === 'ml' ? quantity : 0; const unitRate = Number(request.body.unitRate || 0); const m2Source = String(request.body.m2Source || request.body.quantitySource || '');
	const date = /^\d{4}-\d{2}-\d{2}$/.test(dateInput) ? dateInput : new Date().toISOString().slice(0, 10);
	const capturedAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(capturedAtInput) ? capturedAtInput : new Date().toISOString();
	if (!projectId || (request.file && !request.file.mimetype.startsWith('image/')) || !description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitRate) || unitRate < 0) return response.status(400).json({ error: 'Chantier, description, AI quantity estimate, and unit rate are required' });
	const data = await readData(); const user = data.users.find((item) => item.id === request.user.sub);
	let context;
	try { context = projectContextFor(data, projectId); assertProjectAccess(data, request.user, projectId, user); } catch (error) { return response.status(error.status || 500).json({ error: error.message }); }
	const photoFile = request.file ? storageKeyFor(request.file.originalname) : null;
	if (request.file) { try { await uploadFile(UPLOADS_BUCKET, photoFile, request.file.buffer, request.file.mimetype); } catch (uploadError) { return response.status(502).json({ error: 'Photo upload failed: ' + uploadError.message }); } }
	const report = { id: `work-report-${Date.now()}`, projectId, projectName: context.projectName, budgetId: context.budgetId, devisNumber: context.devisNumber, workerId: request.user.sub, workerName: user?.name || request.user.name, date, capturedAt, locationName, latitude, longitude, description, quantityUnit, quantity, quantityM2, quantityMl, m2Source, quantitySource: m2Source, unitRate, calculatedAmount: quantity * unitRate, photoFile, photoName: request.file?.originalname || '', aiStatus: 'estimated', aiEstimatedM2: quantityM2 || null, aiEstimatedMl: quantityMl || null, status: 'pending', pricingSource: context.budget ? `Devis ${context.devisNumber || context.budget.id}` : 'Devis - à confirmer par Gérant', createdAt: new Date().toISOString() };
	data.workReports = [...(data.workReports || []), report]; await writeData(data); response.status(201).json(report);
});
app.patch('/api/work-reports/:id/status', auth, manager, async (request, response) => {
	const status = String(request.body.status || ''); if (!['approved', 'rejected', 'pending'].includes(status)) return response.status(400).json({ error: 'Invalid work report status' });
	const data = await readData(); const report = (data.workReports || []).find((item) => item.id === request.params.id); if (!report) return response.status(404).json({ error: 'Work report not found' }); report.status = status; report.reviewedBy = request.user.sub; report.reviewedAt = new Date().toISOString(); await writeData(data); response.json(report);
});
app.get('/api/projects/:id/situation-summary', auth, async (request, response) => {
	const data = await readData();
	if (!canAccessProject(data, request.user, request.params.id)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const month = String(request.query.month || new Date().toISOString().slice(0, 7)); const date = String(request.query.date || ''); const reports = (data.workReports || []).filter((item) => item.projectId === request.params.id && (date ? item.date === date : item.date.startsWith(month)) && item.status === 'approved'); const quantityM2 = reports.reduce((sum, item) => sum + Number(item.quantityM2 || (item.quantityUnit === 'm2' ? item.quantity : 0) || 0), 0); const quantityMl = reports.reduce((sum, item) => sum + Number(item.quantityMl || (item.quantityUnit === 'ml' ? item.quantity : 0) || 0), 0); const amount = reports.reduce((sum, item) => sum + Number(item.calculatedAmount || 0), 0); const byWorker = Object.values(reports.reduce((groups, item) => { const group = groups[item.workerId] || { workerId: item.workerId, workerName: item.workerName, quantityM2: 0, quantityMl: 0, amount: 0, reportCount: 0 }; group.quantityM2 += Number(item.quantityM2 || (item.quantityUnit === 'm2' ? item.quantity : 0) || 0); group.quantityMl += Number(item.quantityMl || (item.quantityUnit === 'ml' ? item.quantity : 0) || 0); group.amount += Number(item.calculatedAmount || 0); group.reportCount += 1; groups[item.workerId] = group; return groups; }, {})); const managerView = isOwnerRole(request.user.role); response.json({ projectId: request.params.id, month, date: date || null, reportCount: reports.length, quantityM2, quantityMl, amount: managerView ? amount : null, byWorker: managerView ? byWorker : byWorker.map(({ amount: _amount, ...worker }) => worker), requiresHumanConfirmation: true });
});
app.post('/api/documents/upload', auth, upload.single('file'), fixUploadFilenameEncoding, async (request, response) => {
	if (!request.file) return response.status(400).json({ error: 'File required' });
	if (!isAllowedWorkDocument(request.file, request.body.evidenceType)) return response.status(400).json({ error: 'Only construction plans in PDF format and worksite photos are allowed' });
	const evidenceType = request.body.evidenceType || 'other';
	const projectId = String(request.body.projectId || '');
	console.log(`[documents/upload] evidenceType=${evidenceType} mimetype=${request.file.mimetype} name=${request.file.originalname}`);
	const data = await readData();
	let context;
	try { context = projectContextFor(data, projectId); assertProjectAccess(data, request.user, projectId, isWorkerRole(request.user.role) ? request.userRecord : null); } catch (error) { return response.status(error.status || 500).json({ error: error.message }); }
	const storedName = storageKeyFor(request.file.originalname);
	try { await uploadFile(UPLOADS_BUCKET, storedName, request.file.buffer, request.file.mimetype); } catch (uploadError) { return response.status(502).json({ error: 'Document upload failed: ' + uploadError.message }); }
	let autoAnalysis = null;
	const language = request.body.responseLanguage || 'sr';
	try {
		if (['plan', 'fiche-technique'].includes(evidenceType) && (request.file.mimetype === 'application/pdf' || request.file.originalname.toLowerCase().endsWith('.pdf'))) {
			const buffer = request.file.buffer;
			let parsed = { text: '' };
			try { parsed = await parsePdf(buffer); } catch (error) { console.error('Document PDF text parse failed:', error.message); }
			try { autoAnalysis = await analyzeDocumentWithGemini({ buffer, mimeType: request.file.mimetype, fileName: request.file.originalname, evidenceType, language, text: parsed.text || '' }); } catch (error) { console.error('Gemini document analysis threw:', error.message); autoAnalysis = null; }
			if (!autoAnalysis) {
				autoAnalysis = analyzeConstructionDocument({ text: parsed.text || '', fileName: request.file.originalname, evidenceType, language });
				autoAnalysis.answer = formatConstructionAnalysis(autoAnalysis, language);
			} else if (!autoAnalysis.answer) {
				autoAnalysis.answer = formatConstructionAnalysis(autoAnalysis, language);
			}
			if (parsed.text) {
				const rules = extractPdfRules(parsed.text, { max: 10 });
				if (rules.length) autoAnalysis.extractedRules = rules;
			}
			try {
				const images = await extractPdfImagesWithTimeout(buffer, { maxImages: 6, maxPages: 12 });
				if (images.length) autoAnalysis.referenceImages = images;
			} catch (error) {
				console.error('PDF image extraction failed:', error.message);
			}
		} else if (request.file.mimetype.startsWith('image/')) {
			const buffer = request.file.buffer;
			let visionResult = { vision: null, status: 'not_configured' };
			try { visionResult = await analyzePhotoWithVision({ buffer, mimeType: request.file.mimetype, fileName: request.file.originalname, evidenceType, language }); } catch (error) { console.error('Vision analysis threw:', error.message); }
			autoAnalysis = analyzeConstructionPhoto({ fileName: request.file.originalname, evidenceType, language, vision: visionResult.vision, visionStatus: visionResult.status });
			autoAnalysis.answer = formatConstructionAnalysis(autoAnalysis, language);
		}
	} catch (error) {
		console.error('Document auto-analysis failed unexpectedly:', error.message, error.stack);
		autoAnalysis = null;
	}
	if (!autoAnalysis) {
		console.warn(`[documents/upload] no analysis branch matched or all fallbacks failed for evidenceType=${evidenceType} mimetype=${request.file.mimetype}`);
		const french = language === 'fr';
		autoAnalysis = { status: 'analysis_error', fileName: request.file.originalname, evidenceType, summary: '', workType: french ? 'Analyse indisponible' : 'Analiza nedostupna', systems: [], materials: [], howTo: [], controls: [], evidence: [], risks: [], confidence: 0, answer: french ? 'Le document est enregistré, mais son analyse automatique a échoué. Ouvrez-le manuellement pour vérifier son contenu.' : 'Dokument je sačuvan, ali automatska analiza nije uspjela. Otvorite ga ručno da provjerite sadržaj.', requiresHumanConfirmation: true };
	}
	attachReferenceLinks(autoAnalysis);
	const item = { id: `document-${Date.now()}`, originalName: request.file.originalname, storedName, mimeType: request.file.mimetype, size: request.file.size, projectId, projectName: context.projectName, budgetId: context.budgetId, devisNumber: context.devisNumber, evidenceType, phase: request.body.phase || 'general', uploadedBy: request.user.sub, uploadedAt: new Date().toISOString(), autoAnalysis: autoAnalysis ? { status: autoAnalysis.status, workType: autoAnalysis.workType, confidence: autoAnalysis.confidence } : undefined };
	data.documents.push(item); await writeData(data); response.status(201).json({ ...item, autoAnalysis });
});
app.get('/api/documents', auth, async (request, response) => {
	const data = await readData();
	response.json(data.documents.filter((document) => canAccessProject(data, request.user, document.projectId)));
});
app.patch('/api/documents/:id', auth, manager, async (request, response) => {
	const name = String(request.body.name || '').trim();
	if (!name || name.length > 180) return response.status(400).json({ error: 'A document name up to 180 characters is required' });
	const data = await readData(); const item = data.documents.find((document) => document.id === request.params.id);
	if (!item) return response.status(404).json({ error: 'Document not found' });
	item.originalName = name; item.renamedAt = new Date().toISOString(); item.renamedBy = request.user.sub;
	await writeData(data); response.json(item);
});
app.post('/api/documents/:id/copy', auth, manager, async (request, response) => {
	const data = await readData(); const source = data.documents.find((document) => document.id === request.params.id);
	if (!source) return response.status(404).json({ error: 'Document not found' });
	const storedName = `${Date.now()}-${source.storedName}`; const sourceBuffer = await downloadFile(UPLOADS_BUCKET, source.storedName); await uploadFile(UPLOADS_BUCKET, storedName, sourceBuffer, source.mimeType);
	const copy = { ...source, id: `document-${Date.now()}-copy`, originalName: `Kopija - ${source.originalName}`, storedName, uploadedBy: request.user.sub, uploadedAt: new Date().toISOString(), copiedFrom: source.id };
	data.documents.push(copy); await writeData(data); response.status(201).json(copy);
});
app.delete('/api/documents/:id', auth, manager, async (request, response) => {
	const data = await readData(); const item = data.documents.find((document) => document.id === request.params.id);
	if (!item) return response.status(404).json({ error: 'Document not found' });
	await deleteFile(UPLOADS_BUCKET, item.storedName);
	data.documents = data.documents.filter((document) => document.id !== item.id); await writeData(data); response.json({ deleted: true, id: item.id });
});
app.post('/api/ai/technical-answer', auth, async (request, response) => {
	const question = String(request.body.question || '').trim();
	const projectId = String(request.body.projectId || '').trim();
	const responseLanguage = ['sr', 'bs', 'fr'].includes(request.body.responseLanguage) ? request.body.responseLanguage : 'sr';
	if (!question) return response.status(400).json({ error: 'A technical question is required' });
	if (!projectId) return response.status(400).json({ error: 'A chantier is required' });
	const aiBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
	const aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
	const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
	const data = await readData();
	if (!canAccessProject(data, request.user, projectId)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const documents = (data.documents || []).filter((item) => item.projectId === projectId && allowedWorkEvidenceTypes.includes(item.evidenceType));
	const sourceVersion = crypto.createHash('sha256').update(documents.map((item) => `${item.id}:${item.updatedAt || item.uploadedAt || ''}`).join('|')).digest('hex');
	const cacheKey = answerCacheKey(request.user.sub, projectId, question, sourceVersion);
	const sources = [];
	for (const document of documents) {
		if (!document.storedName) continue;
		let buffer;
		try { buffer = await downloadFile(UPLOADS_BUCKET, document.storedName); } catch { continue; }
		if (document.mimeType.includes('pdf')) {
			const parsed = await parsePdf(buffer); const pages = parsed.text.split('\f');
			pages.forEach((text, index) => { if (text.trim()) sources.push({ file: document.originalName, type: document.evidenceType, page: index + 1, text: text.slice(0, 12000) }); });
		} else if (document.mimeType.startsWith('image/')) {
			sources.push({ file: document.originalName, type: document.evidenceType, page: null, image: `data:${document.mimeType};base64,${buffer.toString('base64')}` });
		}
	}
	if (!sources.length) {
		const localEntries = findFacadeKnowledge(facadeKnowledge, question);
		if (localEntries.length) return response.json({ status: 'offline_grounded', answer: formatOfflineFacadeAnswer(localEntries, responseLanguage), sources: localEntries.flatMap((entry) => entry.sources.map((source) => ({ ...source, title: entry.id }))), knowledgeBase: facadeKnowledge.title, requiresHumanConfirmation: false });
		return response.json({ status: 'no_source', answer: 'Nije pronađen plan, fiche technique ili fotografija za ovaj chantier.', sources: [], requiresHumanConfirmation: true });
	}
	const cached = (data.aiAnswers || []).find((item) => item.key === cacheKey);
	const responseSources = sources.map(({ file, type, page }) => ({ file, type, page }));
	if (geminiApiKey) {
		try {
			const answer = await answerQuestionWithGemini({ question, sources, language: responseLanguage });
			if (answer) {
				await saveCachedAnswer(data, { key: cacheKey, userId: request.user.sub, projectId, question, answer, sources: responseSources, requiresHumanConfirmation: false, savedAt: new Date().toISOString() });
				return response.json({ status: 'grounded', answer, sources: responseSources, requiresHumanConfirmation: false, cached: false });
			}
		} catch (error) { console.error('Gemini technical-answer threw', error.message); }
	}
	if (aiApiKey) {
		const sourceText = sources.filter((source) => source.text).map((source) => `SOURCE: ${source.file} | TYPE: ${source.type} | PAGE: ${source.page}\n${source.text}`).join('\n\n');
		const languageName = responseLanguage === 'fr' ? 'francuskom' : responseLanguage === 'bs' ? 'bosanskom' : 'srpskom';
		const prompt = `Odgovori samo na osnovu dostavljenog SOURCE teksta i fotografija. Ne izmišljaj mere, tolerancije ili pravila. Ako podatak nije jasno vidljiv ili naveden, reci: "Podatak nije pronađen u dokumentaciji ili fotografiji." Uvek navedi source file i page ako postoji. Odgovor treba da bude tehnički jasan na ${languageName} jeziku. Pitanje: ${question}\n\n${sourceText}`;
		const userContent = [{ type: 'text', text: prompt }, ...sources.filter((source) => source.image).map((source) => ({ type: 'text', text: `PHOTO SOURCE: ${source.file} | TYPE: ${source.type}` })), ...sources.filter((source) => source.image).map((source) => ({ type: 'image_url', image_url: { url: source.image, detail: 'high' } }))];
		try {
			const aiResponse = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${aiApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0, messages: [{ role: 'system', content: 'Ti si tehnički pomoćnik za chantier. Radiš isključivo sa dostavljenim izvorima i fotografijama i nikada ne nagađaš.' }, { role: 'user', content: userContent }] }) });
			if (aiResponse.ok) {
				const result = await aiResponse.json();
				const answer = result.choices?.[0]?.message?.content || 'Nema odgovora.';
				await saveCachedAnswer(data, { key: cacheKey, userId: request.user.sub, projectId, question, answer, sources: responseSources, requiresHumanConfirmation: false, savedAt: new Date().toISOString() });
				return response.json({ status: 'grounded', answer, sources: responseSources, requiresHumanConfirmation: false, cached: false });
			}
			const providerStatus = aiResponse.status; const providerBody = await aiResponse.text();
			console.error('AI provider rejected technical-answer request', providerStatus, providerBody.slice(0, 500));
		} catch (error) { console.error('OpenAI technical-answer threw', error.message); }
	}
	if (cached) return response.json({ ...cached, status: 'cached', cached: true });
	const localEntries = findFacadeKnowledge(facadeKnowledge, question);
	if (localEntries.length) {
		const answer = formatOfflineFacadeAnswer(localEntries, responseLanguage);
		await saveCachedAnswer(data, { key: cacheKey, userId: request.user.sub, projectId, question, answer, sources: responseSources, requiresHumanConfirmation: false, savedAt: new Date().toISOString(), mode: 'offline_grounded' });
		return response.json({ status: 'offline_grounded', answer, sources: localEntries.flatMap((entry) => entry.sources.map((source) => ({ ...source, title: entry.id }))), knowledgeBase: facadeKnowledge.title, requiresHumanConfirmation: false });
	}
	return response.json({ status: 'not_configured', answer: 'AI nije konfigurisan. Podesite GEMINI_API_KEY ili OPENAI_API_KEY. Lokalna baza nema dovoljno podataka za ovo pitanje.', sources: [], requiresHumanConfirmation: false });
});
app.get('/api/projects/:id/work-sequence', auth, async (request, response) => {
	const data = await readData();
	if (!canAccessProject(data, request.user, request.params.id)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const aiBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
	const aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
	const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
	if (!aiApiKey && !geminiApiKey) return response.json({ status: 'not_configured', steps: [], answer: 'AI za redosled radova nije konfigurisan. Ne započinjite rad bez Gerant-a i plana potvrđenog od Gérant-a.', sources: [], requiresHumanConfirmation: true });
	const documents = (data.documents || []).filter((item) => item.projectId === request.params.id && ['plan', 'fiche-technique'].includes(item.evidenceType) && item.mimeType.includes('pdf')); const sources = [];
	for (const document of documents) { try { const buffer = await downloadFile(UPLOADS_BUCKET, document.storedName); const parsed = await parsePdf(buffer); parsed.text.split('\f').forEach((text, index) => { if (text.trim()) sources.push({ file: document.originalName, page: index + 1, text: text.slice(0, 12000) }); }); } catch (error) { console.warn('Skipping unavailable work-sequence source', document.storedName, error.message); } }
	if (!sources.length) return response.json({ status: 'no_source', steps: [], answer: 'Nije pronađen plan ili fiche technique PDF. Redosled radova ne može biti određen.', sources: [], requiresHumanConfirmation: true });
	const sourceText = sources.map((source) => `SOURCE: ${source.file} | PAGE: ${source.page}\n${source.text}`).join('\n\n');
	const responseSources = sources.map(({ file, page }) => ({ file, page }));
	if (geminiApiKey) {
		try {
			const steps = await answerWorkSequenceWithGemini({ sourceText });
			if (steps) return response.json({ status: 'grounded', steps, answer: 'Redosled je izveden iz dostavljene dokumentacije. Gerant potvrđuje svaki korak.', sources: responseSources, requiresHumanConfirmation: true });
		} catch (error) { console.error('Gemini work-sequence threw', error.message); }
	}
	if (!aiApiKey) return response.status(502).json({ error: 'AI provider unavailable' });
	const prompt = `Na osnovu isključivo SOURCE teksta napravi redosled izvođenja radova. Vrati JSON sa steps nizom; svaki korak mora imati order, title, instruction, requiredEvidence i sourcePage. Ne izmišljaj radove. Ako podatak nije u izvoru, navedi da nije pronađen. Gerant mora potvrditi svaki korak.\n\n${sourceText}`;
	const aiResponse = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${aiApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Ti si pomoćnik za pravilno izvođenje chantier radova i radiš samo iz izvora.' }, { role: 'user', content: prompt }] }) });
	if (!aiResponse.ok) { const providerStatus = aiResponse.status; const providerBody = await aiResponse.text(); console.error('AI provider rejected work-sequence request', providerStatus, providerBody.slice(0, 500)); return response.status(502).json({ error: 'AI provider unavailable', providerStatus }); }
	const result = await aiResponse.json(); let parsed; try { parsed = JSON.parse(result.choices?.[0]?.message?.content || '{}'); } catch { parsed = {}; }
	response.json({ status: 'grounded', steps: Array.isArray(parsed.steps) ? parsed.steps : [], answer: 'Redosled je izveden iz dostavljene dokumentacije. Gerant potvrđuje svaki korak.', sources: responseSources, requiresHumanConfirmation: true });
});
app.get('/api/projects/:id/evidence-summary', auth, async (request, response) => {
	const data = await readData();
	if (!canAccessProject(data, request.user, request.params.id)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const documents = (data.documents || []).filter((item) => item.projectId === request.params.id);
	const required = ['plan', 'fiche-technique', 'photo-before', 'photo-during', 'photo-after'];
	const present = required.filter((type) => documents.some((item) => item.evidenceType === type));
	response.json({ projectId: request.params.id, required, present, missing: required.filter((type) => !present.includes(type)), complete: present.length === required.length });
});
await fs.mkdir(persistentRoot, { recursive: true });
await ensureBuckets();
if (persistentRoot !== root) {
	const seedDataPath = path.join(root, 'data.json');
	try { await fs.access(dataPath); } catch { await fs.copyFile(seedDataPath, dataPath); }
}
app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`IBRA-BA web app listening on port ${process.env.PORT || 3000} at ${root}`));
