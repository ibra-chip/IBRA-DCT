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

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
const parsePdf = async (buffer) => { const parser = new PDFParse({ data: buffer }); return parser.getText(); };

const app = express();
const root = process.env.IBRA_APP_ROOT ? path.resolve(process.env.IBRA_APP_ROOT) : process.cwd();
const persistentRoot = process.env.IBRA_DATA_DIR || root;
const dataPath = path.join(persistentRoot, 'data.json');
const uploadDir = process.env.IBRA_UPLOAD_DIR || path.join(persistentRoot, 'uploads');
const secret = process.env.IBRA_JWT_SECRET || 'local-development-secret-change-before-deploy';
console.log('IBRA app root:', root);
const upload = multer({ dest: uploadDir, limits: { fileSize: 25 * 1024 * 1024 } });
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
app.use(cors());
app.use(express.json());
app.use(express.static(root));

const readData = async () => JSON.parse(await fs.readFile(dataPath, 'utf8'));
const writeData = async (data) => {
	const serialized = `${JSON.stringify(data, null, 2)}\n`;
	const backupPath = `${dataPath}.bak`;
	const temporaryPath = `${dataPath}.tmp`;
	await fs.copyFile(dataPath, backupPath).catch(() => {});
	await fs.writeFile(temporaryPath, serialized, 'utf8');
	await fs.rename(temporaryPath, dataPath);
};
const tokenFrom = (request) => (request.headers.authorization || '').replace(/^Bearer /, '') || null;
function auth(request, response, next) {
	try { request.user = jwt.verify(tokenFrom(request), secret); next(); }
	catch { response.status(401).json({ error: 'Authentication required' }); }
}
function manager(request, response, next) {
	if (!['admin', 'gerant', 'manager', 'conducteur'].includes(request.user.role)) return response.status(403).json({ error: 'Access denied' });
	next();
}
const allowedWorkEvidenceTypes = ['plan', 'photo-before', 'photo-during', 'photo-after'];
function isAllowedWorkDocument(file, evidenceType) {
	const type = String(evidenceType || '');
	const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
	const isImage = file.mimetype.startsWith('image/');
	return (type === 'plan' && isPdf) || (allowedWorkEvidenceTypes.includes(type) && type !== 'plan' && isImage);
}

async function sendMailSafe({ to, subject, text, attachments = [] }) {
	const from = process.env.SMTP_FROM || process.env.SMTP_USER;
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
	const from = process.env.TWILIO_FROM;
	if (!accountSid || !authToken || !from) return { skipped: true };
	const body = new URLSearchParams({ To: to, From: from, Body: text });
	const apiResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
		method: 'POST',
		headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!apiResponse.ok) throw new Error(`Twilio API returned ${apiResponse.status}`);
	return { skipped: false };
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
function buildHoursPdf({ workerName, month, entries, total }) {
	const escapePdf = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
	const lines = ['IBRA-BA - EVIDENCIJA RADNIH SATI', `Radnik: ${workerName}`, `Mesec: ${month}`, ...entries.map((entry) => `${entry.date} | ${entry.projectId} | ${Number(entry.hours || 0).toFixed(2)} h | ${entry.rateType === 'hourly' ? 'Satnica' : 'Dnevnica'} ${Number(entry.rate || 0).toFixed(2)} EUR | ${Number(entry.workAmount || 0).toFixed(2)} EUR`), `UKUPNO: ${Number(total || 0).toFixed(2)} EUR`];
	const commands = ['BT', '/F1 10 Tf', '40 780 Td', ...lines.flatMap((line, index) => [index ? '0 -24 Td' : '', `(${escapePdf(line)}) Tj`]).filter(Boolean), 'ET'].join('\n');
	const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${Buffer.byteLength(commands, 'utf8')} >>\nstream\n${commands}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
	let pdf = '%PDF-1.4\n'; const offsets = [0]; objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, 'utf8'); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }); const xref = Buffer.byteLength(pdf, 'utf8'); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(pdf, 'utf8');
}

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'ibra-ba-api' }));
app.get('/', (_request, response) => response.sendFile(path.join(root, 'index.html')));
app.post('/api/auth/login', async (request, response) => {
	const data = await readData();
	const identifier = String(request.body.phone || request.body.email || '').trim();
	const normalizedPhone = identifier.replace(/[\s()-]/g, '');
	const user = data.users.find((item) => item.phone && item.phone.replace(/[\s()-]/g, '') === normalizedPhone) || data.users.find((item) => item.email === identifier.toLowerCase());
	if (!user || !(await bcrypt.compare(String(request.body.password || ''), user.passwordHash))) return response.status(401).json({ error: 'Invalid phone or password' });
	const requestedRole = String(request.body.role || '').trim(); const roleMatches = user.role === requestedRole || (requestedRole === 'gerant' && ['admin', 'gerant', 'manager'].includes(user.role));
	if (!roleMatches) return response.status(403).json({ error: 'Selected profile does not match this account' });
	const token = jwt.sign({ sub: user.id, name: user.name, email: user.email, role: user.role, projectIds: user.projectIds || [] }, secret, { expiresIn: '8h' });
	response.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
app.post('/api/auth/register', async (request, response) => {
	const data = await readData();
	const role = String(request.body.role || 'user').trim();
	const contact = String(request.body.contact || request.body.email || request.body.phone || '').trim();
	const isEmail = /^\S+@\S+\.\S+$/.test(contact);
	const email = isEmail ? contact.toLowerCase() : '';
	const name = String(request.body.name || '').trim() || (isEmail ? email.split('@')[0] : contact);
	const phone = isEmail ? '' : contact;
	const siret = String(request.body.siret || '').trim();
	const company = String(request.body.company || '').trim();
	const allowedRoles = ['gerant', 'conducteur', 'user'];
	if (!contact || (!isEmail && !phone) || !allowedRoles.includes(role) || (role === 'gerant' && !siret) || (role === 'conducteur' && !company)) return response.status(400).json({ error: 'Valid email or phone, role, and role-specific company details are required' });
	if (data.users.some((user) => user.email && user.email.toLowerCase() === email) || (phone && data.users.some((user) => user.phone && user.phone.replace(/[\s()-]/g, '') === phone.replace(/[\s()-]/g, '')))) return response.status(409).json({ error: 'User already exists' });
	const password = crypto.randomBytes(9).toString('base64url');
	const user = { id: `user-${Date.now()}`, name, email, phone, role, siret: ['gerant', 'conducteur'].includes(role) ? siret : '', company: role === 'conducteur' ? company : '', projectIds: ['lot-a'], dailyRate: 0, hourlyRate: 0, passwordHash: await bcrypt.hash(password, 12) };
	const credentialsText = `Bonjour ${name},\n\nVotre compte IBRA-BA est prêt.\nIdentifiant : ${email || phone}\nMot de passe temporaire : ${password}\n\nChangez ce mot de passe après votre première connexion.`;
	try {
		if (isEmail) {
			const mailResult = await sendMailSafe({ to: email, subject: 'IBRA-BA - votre accès', text: credentialsText });
			if (mailResult.skipped) return response.status(503).json({ error: 'Email delivery is not configured' });
		} else {
			const smsResult = await sendSmsSafe({ to: phone, text: `IBRA-BA: privremena lozinka ${password}. Korisnički ID: ${phone}.` });
			if (smsResult.skipped) return response.status(503).json({ error: 'SMS delivery is not configured' });
		}
	} catch (error) {
		console.error('Registration email failed:', error.message);
		return response.status(502).json({ error: 'Registration email could not be sent' });
	}
	data.users.push(user); await writeData(data);
	response.status(201).json({ message: isEmail ? 'Password sent by email' : 'Password sent by SMS', email: email || null, phone: phone || null });
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
		console.error('Password reset email failed:', error.message);
		return response.status(502).json({ error: 'Password reset email could not be sent' });
	}
	if (mailResult.skipped && process.env.NODE_ENV === 'production') return response.status(503).json({ error: 'Password reset email is not configured' });
	response.json({ message: mailResult.skipped ? 'Reset instructions prepared for local testing.' : 'Reset instructions sent.', ...(mailResult.skipped ? { resetUrl } : {}) });
});
app.post('/api/auth/reset-password', async (request, response) => {
	const token = String(request.body.token || ''); const password = String(request.body.password || ''); if (password.length < 10) return response.status(400).json({ error: 'Password must be at least 10 characters' }); const data = await readData(); const reset = (data.passwordResets || []).find((item) => item.token === token && item.expiresAt > Date.now()); if (!reset) return response.status(400).json({ error: 'Reset link is invalid or expired' }); const user = data.users.find((item) => item.id === reset.userId); user.passwordHash = await bcrypt.hash(password, 12); data.passwordResets = (data.passwordResets || []).filter((item) => item.token !== token); await writeData(data); response.json({ message: 'Password updated' });
});
app.post('/api/auth/change-password', auth, async (request, response) => {
	const currentPassword = String(request.body.currentPassword || ''); const newPassword = String(request.body.newPassword || '');
	if (newPassword.length < 10) return response.status(400).json({ error: 'New password must be at least 10 characters' });
	const data = await readData(); const user = data.users.find((item) => item.id === request.user.sub);
	if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return response.status(401).json({ error: 'Current password is incorrect' });
	user.passwordHash = await bcrypt.hash(newPassword, 12); await writeData(data); response.json({ message: 'Password changed' });
});
app.get('/api/me', auth, (request, response) => response.json({ user: request.user }));
app.get('/api/users', auth, manager, async (_request, response) => response.json((await readData()).users.map(({ passwordHash, ...user }) => user)));
app.get('/api/contacts', auth, async (request, response) => {
	const data = await readData(); const financialView = ['admin', 'gerant', 'manager'].includes(request.user.role);
	response.json(data.users.map(({ passwordHash, dailyRate, hourlyRate, ...user }) => ({ ...user, ...(financialView ? { dailyRate, hourlyRate } : {}) })));
});
app.post('/api/users', auth, manager, async (request, response) => {
	const data = await readData();
	const name = String(request.body.name || '').trim();
	const email = String(request.body.email || '').trim().toLowerCase();
	const deliveryMethod = String(request.body.deliveryMethod || '').trim();
	const role = String(request.body.role || 'user').trim();
	const password = String(request.body.password || '') || crypto.randomBytes(9).toString('base64url');
	const allowedRoles = ['gerant', 'conducteur', 'worker', 'user'];
	const siret = String(request.body.siret || '').trim(); const company = String(request.body.company || '').trim(); const phone = String(request.body.phone || '').trim();
	const normalizedPhone = phone.replace(/[\s()-]/g, '');
	if (!name || !['email', 'sms'].includes(deliveryMethod) || (deliveryMethod === 'email' && !/^\S+@\S+\.\S+$/.test(email)) || (deliveryMethod === 'sms' && !phone) || !allowedRoles.includes(role) || password.length < 10 || (role === 'gerant' && !siret) || (role === 'conducteur' && !company)) return response.status(400).json({ error: 'Name, delivery method, matching email or phone, role, and role-specific company details are required' });
	if ((email && data.users.some((user) => user.email && user.email.toLowerCase() === email)) || (phone && data.users.some((user) => user.phone && user.phone.replace(/[\s()-]/g, '') === normalizedPhone))) return response.status(409).json({ error: 'User already exists' });
	const user = { id: `user-${Date.now()}`, name, email, phone, deliveryMethod, role, siret: role === 'gerant' ? siret : '', company: role === 'conducteur' ? company : '', projectIds: ['lot-a'], dailyRate: Number(request.body.dailyRate || 0), hourlyRate: Number(request.body.hourlyRate || 0), passwordHash: await bcrypt.hash(password, 12) };
	const credentialsText = `Bonjour ${name},\n\nVotre compte IBRA-BA est prêt.\nIdentifiant : ${email || phone}\nMot de passe temporaire : ${password}\n\nChangez ce mot de passe après votre première connexion.`;
	let delivery = 'manual';
	if (deliveryMethod === 'email') {
		const mailResult = await sendMailSafe({ to: email, subject: 'IBRA-BA - votre accès', text: credentialsText });
		if (!mailResult.skipped) delivery = 'email';
	}
	if (deliveryMethod === 'sms') {
		const smsResult = await sendSmsSafe({ to: phone, text: `IBRA-BA : identifiant ${email || phone}, mot de passe temporaire ${password}. Changez-le après connexion.` });
		if (!smsResult.skipped) delivery = 'sms';
	}
	if (delivery === 'manual' && process.env.NODE_ENV === 'production') return response.status(503).json({ error: 'Configure email or SMS delivery before creating users' });
	data.users.push(user); await writeData(data);
	const { passwordHash, ...safeUser } = user;
	response.status(201).json({ ...safeUser, delivery, ...(delivery === 'manual' ? { temporaryPassword: password } : {}) });
});
app.get('/api/projects', auth, async (_request, response) => response.json((await readData()).projects));
app.get('/api/projects/:id/schedule', auth, async (request, response) => {
	const data = await readData(); const schedule = (data.projectSchedules || []).find((item) => item.projectId === request.params.id);
	const delays = (data.projectDelays || []).filter((item) => item.projectId === request.params.id);
	const delayDays = delays.reduce((sum, item) => sum + Number(item.days || 0), 0);
	const plannedEnd = schedule?.plannedEndDate ? new Date(`${schedule.plannedEndDate}T00:00:00Z`) : null;
	const adjustedEnd = plannedEnd ? new Date(plannedEnd.getTime() + delayDays * 86400000).toISOString().slice(0, 10) : null;
	response.json({ ...(schedule || { projectId: request.params.id }), delayDays, adjustedEndDate: adjustedEnd, delays });
});
app.post('/api/projects/:id/schedule', auth, manager, async (request, response) => {
	const startDate = String(request.body.startDate || '').trim(); const plannedEndDate = String(request.body.plannedEndDate || '').trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(plannedEndDate) || new Date(`${plannedEndDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) return response.status(400).json({ error: 'Valid start and planned end dates are required' });
	const data = await readData(); const schedule = { projectId: request.params.id, startDate, plannedEndDate, updatedBy: request.user.sub, updatedAt: new Date().toISOString() };
	data.projectSchedules = [...(data.projectSchedules || []).filter((item) => item.projectId !== request.params.id), schedule]; await writeData(data); response.status(201).json(schedule);
});
app.post('/api/projects/:id/delays', auth, manager, async (request, response) => {
	const days = Number(request.body.days || 0); const reason = String(request.body.reason || '').trim();
	if (!Number.isFinite(days) || days <= 0 || !['weather', 'materials', 'client', 'technical', 'other'].includes(request.body.category) || !reason) return response.status(400).json({ error: 'Delay category, positive days, and reason are required' });
	const data = await readData(); const delay = { id: `delay-${Date.now()}`, projectId: request.params.id, category: request.body.category, days, reason, createdBy: request.user.sub, createdAt: new Date().toISOString() };
	data.projectDelays = [...(data.projectDelays || []), delay]; await writeData(data); response.status(201).json(delay);
});
app.get('/api/projects/:id/budget', auth, async (request, response) => {
	const data = await readData();
	const budget = (data.projectBudgets || []).find((item) => item.projectId === request.params.id);
	response.json(budget || { projectId: request.params.id, status: 'missing', total: 0, spent: 0, remaining: 0 });
});
app.post('/api/budget/inspect', auth, memoryUpload.single('file'), async (request, response) => {
	if (!request.file || (request.file.mimetype !== 'application/pdf' && !request.file.originalname.toLowerCase().endsWith('.pdf'))) return response.status(400).json({ error: 'A Devis PDF is required' });
	const parsed = await parsePdf(request.file.buffer);
	const text = parsed.text.replace(/\s+/g, ' ').trim();
	const number = text.match(/(?:devis|devis n(?:°|o)?|référence|reference)\s*[:#-]?\s*([A-Z0-9][A-Z0-9/_.-]{2,})/i)?.[1] || '';
	const client = text.match(/(?:client|donneur d'ordre|client)\s*[:#-]?\s*([^|;]{2,80}?)(?=\s+(?:adresse|chantier|travaux|total|montant)\b|$)/i)?.[1]?.trim() || '';
	const chantier = text.match(/(?:adresse du projet|adresse chantier|chantier|projet|lieu des travaux)\s*[:#-]?\s*([^|;]{2,160}?)(?=\s+(?:adresse|travaux|total|montant|net à payer|devis)\b|$)/i)?.[1]?.trim() || '';
	const amountMatches = [...text.matchAll(/(?:net à payer|total\s+(?:ttc|t\.t\.c\.)|montant\s+total|total)\s*[:=]?\s*([\d\s.,]+)\s*(?:€|eur)?/gi)];
	const rawAmount = amountMatches.at(-1)?.[1] || '';
	const total = rawAmount ? Number(rawAmount.replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')) : 0;
	response.json({ extracted: { number, client, chantier, total: Number.isFinite(total) ? total : 0 }, textFound: text.length > 0, needsConfirmation: !number || !client || !chantier || !total, source: request.file.originalname });
});
app.post('/api/pdf/inspect', auth, memoryUpload.single('file'), async (request, response) => {
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
	const budget = (data.projectBudgets || []).find((item) => item.projectId === request.params.id);
	const purchases = (data.purchases || []).filter((item) => item.projectId === request.params.id);
	const approvedHours = (data.timeEntries || []).filter((item) => item.projectId === request.params.id && item.status === 'approved');
	const laborCosts = (data.projectLaborCosts || []).filter((item) => item.projectId === request.params.id);
	const usersById = new Map((data.users || []).map((user) => [user.id, user]));
	const purchaseCategories = ['material', 'tools', 'machines', 'workers', 'subcontracting', 'other'];
	const purchaseTotals = Object.fromEntries(purchaseCategories.map((category) => [category, purchases.filter((item) => item.category === category).reduce((sum, item) => sum + Number(item.amount || 0), 0)]));
	const purchaseTotal = Object.values(purchaseTotals).reduce((sum, amount) => sum + amount, 0);
	const approvedWorkHours = approvedHours.reduce((sum, item) => sum + Number(item.hours || 0), 0);
	const approvedLaborTotal = laborCosts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
	const spent = purchaseTotal + approvedLaborTotal;
	const breakdown = { ...purchaseTotals, approvedLabor: approvedLaborTotal, approvedWorkHours };
	response.json({ projectId: request.params.id, budget: budget?.total || 0, purchases: purchaseTotal, approvedWorkHours, approvedLaborTotal, laborCosts, breakdown, spent, remaining: budget ? budget.total - spent : null, budgetStatus: budget ? 'available' : 'missing' });
});
app.post('/api/projects/:id/labor-costs', auth, manager, async (request, response) => {
	const month = String(request.body.month || '');
	const amount = Number(request.body.amount || 0);
	const description = String(request.body.description || '').trim();
	if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(amount) || amount < 0) return response.status(400).json({ error: 'Month and a non-negative final worker amount are required' });
	const data = await readData();
	const existing = (data.projectLaborCosts || []).find((item) => item.projectId === request.params.id && item.month === month);
	const laborCost = { id: existing?.id || `labor-cost-${Date.now()}`, projectId: request.params.id, month, amount, description, status: 'final', enteredBy: request.user.sub, updatedAt: new Date().toISOString() };
	data.projectLaborCosts = [...(data.projectLaborCosts || []).filter((item) => item.id !== existing?.id), laborCost];
	await writeData(data);
	response.status(existing ? 200 : 201).json(laborCost);
});
app.post('/api/projects/:id/budget', auth, manager, upload.single('file'), async (request, response) => {
	const uploadedPdf = request.file ? await fs.readFile(request.file.path) : null;
	if (!request.file || !(request.file.mimetype === 'application/pdf' || request.file.originalname.toLowerCase().endsWith('.pdf') || uploadedPdf?.subarray(0, 5).toString() === '%PDF-')) return response.status(400).json({ error: 'A Devis PDF is required' });
	const total = Number(request.body.total || 0);
	if (!Number.isFinite(total) || total <= 0) return response.status(400).json({ error: 'Devis total is required' });
	const data = await readData();
	const existing = (data.projectBudgets || []).find((item) => item.projectId === request.params.id);
	if (existing && existing.devisNumber && String(request.body.devisNumber || '') !== existing.devisNumber && request.body.replaceExisting !== 'true') return response.status(409).json({ error: 'An active Devis already exists. Confirm replacement explicitly.' });
	const budget = { id: existing?.id || `budget-${Date.now()}`, projectId: request.params.id, chantierName: String(request.body.chantierName || ''), devisNumber: String(request.body.devisNumber || ''), client: String(request.body.client || ''), total, spent: existing?.spent || 0, remaining: total - (existing?.spent || 0), sourceFile: request.file.filename, sourceName: request.file.originalname, status: 'uploaded', uploadedBy: request.user.sub, updatedAt: new Date().toISOString() };
	data.projectBudgets = [...(data.projectBudgets || []).filter((item) => item.projectId !== request.params.id), budget];
	await writeData(data); response.status(201).json(budget);
});
app.get('/api/purchases', auth, async (_request, response) => response.json((await readData()).purchases || []));
app.post('/api/purchases', auth, manager, upload.single('invoice'), async (request, response) => {
	if (!request.file || request.file.mimetype !== 'application/pdf') return response.status(400).json({ error: 'A purchase invoice PDF is required' });
	const amount = Number(request.body.amount || 0);
	const category = String(request.body.category || 'other');
	if (!request.body.projectId || !request.body.supplier || !request.body.description || !Number.isFinite(amount) || amount <= 0 || !['material', 'tools', 'machines', 'workers', 'subcontracting', 'other'].includes(category)) return response.status(400).json({ error: 'Purchase fields are incomplete' });
	const data = await readData();
	const purchase = { id: `purchase-${Date.now()}`, projectId: String(request.body.projectId), category, supplier: String(request.body.supplier), description: String(request.body.description), amount, purchaseDate: String(request.body.purchaseDate || new Date().toISOString().slice(0, 10)), invoiceFile: request.file.filename, invoiceName: request.file.originalname, createdBy: request.user.sub, createdAt: new Date().toISOString() };
	data.purchases = [...(data.purchases || []), purchase]; await writeData(data); response.status(201).json(purchase);
});
app.get('/api/projects/:id/chantier-controls', auth, async (request, response) => {
	if (!['admin','gerant','manager'].includes(request.user.role) && !(request.user.projectIds || []).includes(request.params.id)) return response.status(403).json({ error: 'Access denied' });
	response.json((await readData()).chantierControls.filter((item) => item.projectId === request.params.id));
});
app.patch('/api/chantier-controls/:id', auth, async (request, response) => {
	if (!['admin', 'gerant', 'manager', 'conducteur', 'quality'].includes(request.user.role)) return response.status(403).json({ error: 'Only supervisors can update controls' });
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
	const data = await readData(); response.json((data.controlHistory || []).filter((item) => item.projectId === request.params.id));
});
app.get('/api/messages', auth, async (request, response) => response.json((await readData()).messages.filter((item) => item.senderId === request.user.sub || item.recipientId === request.user.sub)));
app.post('/api/messages', auth, async (request, response) => {
	const data = await readData(); const text = String(request.body.text || '').trim();
	if (!text || !request.body.recipientId || !request.body.projectId) return response.status(400).json({ error: 'Message fields required' });
	const recipient = data.users.find((item) => item.id === request.body.recipientId); if (!recipient) return response.status(404).json({ error: 'Recipient not found' });
	const message = { id: `message-${Date.now()}`, senderId: request.user.sub, senderName: request.user.name, recipientId: recipient.id, recipientName: recipient.name, projectId: request.body.projectId, text, createdAt: new Date().toISOString(), read: false };
	data.messages.push(message); await writeData(data);
	const mailResult = recipient.email ? await sendMailSafe({ to: recipient.email, subject: `IBRA-BA - nouvelle message de ${request.user.name}`, text: `Bonjour ${recipient.name},\n\n${request.user.name} vous a envoyé un message dans IBRA-BA :\n\n${text}\n\nConnectez-vous à ${process.env.PUBLIC_URL || 'http://localhost:3000'} pour répondre.` }) : { skipped: true };
	response.status(201).json({ ...message, emailStatus: mailResult.skipped ? 'not-sent' : 'sent' });
});
app.get('/api/rendezvous', auth, async (request, response) => {
	const data = await readData(); const canSeeAll = ['admin', 'gerant', 'manager'].includes(request.user.role); const projectIds = request.user.projectIds || [];
	response.json((data.rendezvous || []).filter((item) => canSeeAll || projectIds.includes(item.projectId)));
});
app.post('/api/rendezvous', auth, async (request, response) => {
	const date = String(request.body.date || ''); const absenceDate = String(request.body.absenceDate || ''); const days = Math.ceil((new Date(`${date}T00:00:00`) - new Date()) / 86400000);
	if (!request.body.projectId || !request.body.time || !request.body.reason || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(absenceDate) || days < 2 || days > 7) return response.status(400).json({ error: 'Rendez-vous, date d’absence, motif, and a date between 2 and 7 days ahead are required' });
	if (!['admin', 'gerant', 'manager'].includes(request.user.role) && !(request.user.projectIds || []).includes(request.body.projectId)) return response.status(403).json({ error: 'Access denied for this chantier' });
	const data = await readData(); const item = { id: `rendezvous-${Date.now()}`, projectId: request.body.projectId, workerId: request.user.sub, workerName: request.user.name, date, time: request.body.time, absenceDate, reason: request.body.reason, createdAt: new Date().toISOString() };
	data.rendezvous = [...(data.rendezvous || []), item];
	const recipients = data.users.filter((user) => (user.projectIds || []).includes(request.body.projectId));
	const notificationText = `Rendez-vous chantier ${date} à ${request.body.time} | Absence le ${absenceDate} | ${request.body.reason}`;
	data.messages = [...(data.messages || []), ...recipients.map((recipient) => ({ id: `notification-${Date.now()}-${recipient.id}`, senderId: 'system', senderName: 'IBRA-BA', recipientId: recipient.id, recipientName: recipient.name, projectId: request.body.projectId, text: notificationText, createdAt: new Date().toISOString(), read: false, type: 'rendezvous-notification' }))];
	await writeData(data); response.status(201).json(item);
});
app.get('/api/time-entries', auth, async (request, response) => response.json((await readData()).timeEntries.filter((item) => ['admin','gerant','manager','conducteur'].includes(request.user.role) || item.workerId === request.user.sub)));
app.post('/api/time-entries', auth, async (request, response) => {
	const [startH,startM] = String(request.body.start || '').split(':').map(Number); const [endH,endM] = String(request.body.end || '').split(':').map(Number); const hours = ((endH * 60 + endM) - (startH * 60 + startM) - Number(request.body.breakMinutes || 0)) / 60;
	const rateType = String(request.body.rateType || 'daily'); const data = await readData(); const worker = data.users.find((item) => item.id === request.user.sub); const profileRate = rateType === 'hourly' ? Number(worker?.hourlyRate || 0) : Number(worker?.dailyRate || 0); const rate = Number(request.body.rate || profileRate);
	if (!request.body.date || !request.body.projectId || !hours || hours < 0 || !['daily', 'hourly'].includes(rateType) || !Number.isFinite(rate) || rate <= 0) return response.status(400).json({ error: 'Date, chantier, work time, rate type, and a positive rate are required' });
	const workAmount = rateType === 'hourly' ? hours * rate : rate;
	const item = { id: `time-${Date.now()}`, workerId: request.user.sub, workerName: request.user.name, projectId: request.body.projectId, date: request.body.date, start: request.body.start, end: request.body.end, breakMinutes: Number(request.body.breakMinutes || 0), hours, rateType, rate, workAmount, status: 'pending' };
	data.timeEntries.push(item); await writeData(data); response.status(201).json(item);
});
app.post('/api/time-entries/pdf/send', auth, async (request, response) => {
	const month = String(request.body.month || new Date().toISOString().slice(0, 7)); const data = await readData(); const entries = data.timeEntries.filter((entry) => entry.workerId === request.user.sub && entry.date.startsWith(month));
	if (!entries.length) return response.status(400).json({ error: 'No work entries found for this month' });
	const managers = data.users.filter((user) => ['admin', 'gerant', 'manager'].includes(user.role) && user.email);
	if (!managers.length) return response.status(503).json({ error: 'No manager email is configured' });
	const worker = data.users.find((user) => user.id === request.user.sub); const detailedEntries = entries.map((entry) => ({ ...entry, workAmount: entryAmount(entry, worker) })); const total = detailedEntries.reduce((sum, entry) => sum + entry.workAmount, 0); const pdf = buildHoursPdf({ workerName: request.user.name, month, entries: detailedEntries, total });
	const results = await Promise.all(managers.map((managerUser) => sendMailSafe({ to: managerUser.email, subject: `IBRA-BA - sati rada ${request.user.name} - ${month}`, text: `U prilogu je PDF evidencije radnih sati za ${request.user.name}, ${month}.`, attachments: [{ filename: `ibra-hours-${month}-${request.user.sub}.pdf`, content: pdf }] })));
	if (results.every((result) => result.skipped)) return response.status(503).json({ error: 'Email delivery is not configured' }); response.json({ message: 'Hours PDF sent to manager', recipients: managers.map((user) => user.email) });
});
app.patch('/api/time-entries/:id/status', auth, async (request, response) => {
	if (!['admin', 'gerant', 'manager', 'conducteur'].includes(request.user.role)) return response.status(403).json({ error: 'Only supervisors can approve time' });
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
	const data = await readData(); const managerView = ['admin', 'gerant', 'manager'].includes(request.user.role); response.json((data.payoutRequests || []).filter((item) => managerView || item.userId === request.user.sub));
});
app.post('/api/payout-requests', auth, async (request, response) => {
	const month = String(request.body.month || ''); const days = Number(request.body.days || 0); if (!/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(days) || days < 0) return response.status(400).json({ error: 'Month and a non-negative integer number of days are required' });
	const data = await readData(); const duplicate = (data.payoutRequests || []).find((item) => item.userId === request.user.sub && item.month === month && item.status !== 'rejected'); if (duplicate) return response.status(409).json({ error: 'Payout request already exists for this month' }); const user = data.users.find((item) => item.id === request.user.sub); const amount = days * Number(user?.dailyRate || 0); const item = { id: `payout-${Date.now()}`, userId: request.user.sub, userName: request.user.name, month, days, dailyRate: Number(user?.dailyRate || 0), amount, submissionDate: `${month}-01`, paymentDate: `${month}-15`, status: 'pending', createdAt: new Date().toISOString() }; data.payoutRequests = [...(data.payoutRequests || []), item]; await writeData(data); response.status(201).json(item);
});
app.get('/api/payout-requests/:id/pdf', auth, async (request, response) => {
	const data = await readData(); const item = (data.payoutRequests || []).find((entry) => entry.id === request.params.id);
	if (!item || (!['admin', 'gerant', 'manager'].includes(request.user.role) && item.userId !== request.user.sub)) return response.status(404).json({ error: 'Payout request not found' });
	response.setHeader('Content-Type', 'application/pdf'); response.setHeader('Content-Disposition', `attachment; filename="ibra-payout-${item.month}-${item.userId}.pdf"`); response.send(buildPayoutPdf(item));
});
app.patch('/api/payout-requests/:id/status', auth, manager, async (request, response) => {
	const status = String(request.body.status || ''); if (!['approved', 'rejected', 'paid', 'pending'].includes(status)) return response.status(400).json({ error: 'Invalid payout status' }); const data = await readData(); const item = (data.payoutRequests || []).find((entry) => entry.id === request.params.id); if (!item) return response.status(404).json({ error: 'Payout request not found' }); item.status = status; item.reviewedBy = request.user.sub; item.reviewedAt = new Date().toISOString(); await writeData(data); response.json(item);
});
app.get('/api/work-reports', auth, async (request, response) => {
	const data = await readData(); const managerView = ['admin', 'gerant', 'manager', 'conducteur'].includes(request.user.role); const projectIds = request.user.projectIds || [];
	const reports = (data.workReports || []).filter((item) => managerView ? projectIds.includes(item.projectId) || ['admin', 'gerant', 'manager'].includes(request.user.role) : item.workerId === request.user.sub && projectIds.includes(item.projectId)); const financialView = ['admin', 'gerant', 'manager'].includes(request.user.role);
	response.json(financialView ? reports : reports.map(({ unitRate: _unitRate, calculatedAmount: _calculatedAmount, ...report }) => report));
});
app.post('/api/ai/estimate-area', auth, memoryUpload.single('photo'), async (request, response) => {
	if (!request.file || !request.file.mimetype.startsWith('image/')) return response.status(400).json({ error: 'A work photo is required' });
	const aiBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1'; const aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
	if (!aiApiKey) return response.json({ status: 'not_configured', estimatedM2: null, answer: 'Vision AI nije konfigurisan. Unesite m² ručno i potvrdite evidenciju.', requiresHumanConfirmation: true });
	const image = `data:${request.file.mimetype};base64,${request.file.buffer.toString('base64')}`; const aiResponse = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${aiApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Proceni površinu izvedenih radova samo ako fotografija ima pouzdanu skalu ili poznatu referencu. Nikada ne nagađaj. Vrati JSON: estimatedM2 broj ili null, confidence broj 0-1, reason tekst.' }, { role: 'user', content: [{ type: 'text', text: 'Proceni vidljivu izvedenu površinu u m². Ako nema merila, vrati null.' }, { type: 'image_url', image_url: { url: image } }] }] }) });
	if (!aiResponse.ok) return response.status(502).json({ error: 'Vision AI provider unavailable' }); const result = await aiResponse.json(); let parsed; try { parsed = JSON.parse(result.choices?.[0]?.message?.content || '{}'); } catch { parsed = {}; } response.json({ status: 'estimated', estimatedM2: Number.isFinite(Number(parsed.estimatedM2)) ? Number(parsed.estimatedM2) : null, confidence: Number(parsed.confidence || 0), answer: parsed.reason || 'Nema pouzdane procene.', requiresHumanConfirmation: true });
});
app.post('/api/work-reports', auth, upload.single('photo'), async (request, response) => {
	const projectId = String(request.body.projectId || ''); const description = String(request.body.description || '').trim(); const date = String(request.body.date || ''); const capturedAt = String(request.body.capturedAt || ''); const locationName = String(request.body.locationName || '').trim(); const latitude = Number(request.body.latitude); const longitude = Number(request.body.longitude); const quantityM2 = Number(request.body.quantityM2 || 0); const unitRate = Number(request.body.unitRate || 0); const m2Source = String(request.body.m2Source || '');
	if (!projectId || !request.file || !request.file.mimetype.startsWith('image/') || !description || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(capturedAt) || !locationName || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(quantityM2) || quantityM2 <= 0 || !Number.isFinite(unitRate) || unitRate < 0) return response.status(400).json({ error: 'Photo, date, time, location, description, square-meter estimate, and unit rate are required' });
	const data = await readData(); const user = data.users.find((item) => item.id === request.user.sub); const report = { id: `work-report-${Date.now()}`, projectId, workerId: request.user.sub, workerName: user?.name || request.user.name, date, capturedAt, locationName, latitude, longitude, description, quantityM2, m2Source, unitRate, calculatedAmount: quantityM2 * unitRate, photoFile: request.file.filename, photoName: request.file.originalname, aiStatus: 'estimated', aiEstimatedM2: quantityM2, status: 'pending', pricingSource: 'Devis - à confirmer par Gérant', createdAt: new Date().toISOString() };
	data.workReports = [...(data.workReports || []), report]; await writeData(data); response.status(201).json(report);
});
app.patch('/api/work-reports/:id/status', auth, manager, async (request, response) => {
	const status = String(request.body.status || ''); if (!['approved', 'rejected', 'pending'].includes(status)) return response.status(400).json({ error: 'Invalid work report status' });
	const data = await readData(); const report = (data.workReports || []).find((item) => item.id === request.params.id); if (!report) return response.status(404).json({ error: 'Work report not found' }); report.status = status; report.reviewedBy = request.user.sub; report.reviewedAt = new Date().toISOString(); await writeData(data); response.json(report);
});
app.get('/api/projects/:id/situation-summary', auth, async (request, response) => {
	const data = await readData(); const month = String(request.query.month || new Date().toISOString().slice(0, 7)); const date = String(request.query.date || ''); const reports = (data.workReports || []).filter((item) => item.projectId === request.params.id && (date ? item.date === date : item.date.startsWith(month)) && item.status === 'approved'); const quantityM2 = reports.reduce((sum, item) => sum + Number(item.quantityM2 || 0), 0); const amount = reports.reduce((sum, item) => sum + Number(item.calculatedAmount || 0), 0); const byWorker = Object.values(reports.reduce((groups, item) => { const group = groups[item.workerId] || { workerId: item.workerId, workerName: item.workerName, quantityM2: 0, amount: 0, reportCount: 0 }; group.quantityM2 += Number(item.quantityM2 || 0); group.amount += Number(item.calculatedAmount || 0); group.reportCount += 1; groups[item.workerId] = group; return groups; }, {})); const managerView = ['admin', 'gerant', 'manager'].includes(request.user.role); response.json({ projectId: request.params.id, month, date: date || null, reportCount: reports.length, quantityM2, amount: managerView ? amount : null, byWorker: managerView ? byWorker : byWorker.map(({ amount: _amount, ...worker }) => worker), requiresHumanConfirmation: true });
});
app.post('/api/documents/upload', auth, upload.single('file'), async (request, response) => {
	if (!request.file) return response.status(400).json({ error: 'File required' });
	if (!isAllowedWorkDocument(request.file, request.body.evidenceType)) return response.status(400).json({ error: 'Only construction plans in PDF format and worksite photos are allowed' });
	const data = await readData(); const item = { id: `document-${Date.now()}`, originalName: request.file.originalname, storedName: request.file.filename, mimeType: request.file.mimetype, size: request.file.size, projectId: request.body.projectId || 'lot-a', evidenceType: request.body.evidenceType || 'other', phase: request.body.phase || 'general', uploadedBy: request.user.sub, uploadedAt: new Date().toISOString() };
	data.documents.push(item); await writeData(data); response.status(201).json(item);
});
app.get('/api/documents', auth, async (request, response) => response.json((await readData()).documents.filter((document) => document.uploadedBy === request.user.sub)));
app.patch('/api/documents/:id', auth, manager, async (request, response) => {
	const name = String(request.body.name || '').trim();
	if (!name || name.length > 180) return response.status(400).json({ error: 'A document name up to 180 characters is required' });
	const data = await readData(); const item = data.documents.find((document) => document.id === request.params.id && document.uploadedBy === request.user.sub);
	if (!item) return response.status(404).json({ error: 'Document not found' });
	item.originalName = name; item.renamedAt = new Date().toISOString(); item.renamedBy = request.user.sub;
	await writeData(data); response.json(item);
});
app.post('/api/documents/:id/copy', auth, manager, async (request, response) => {
	const data = await readData(); const source = data.documents.find((document) => document.id === request.params.id && document.uploadedBy === request.user.sub);
	if (!source) return response.status(404).json({ error: 'Document not found' });
	const storedName = `${Date.now()}-${source.storedName}`; await fs.copyFile(path.join(uploadDir, source.storedName), path.join(uploadDir, storedName));
	const copy = { ...source, id: `document-${Date.now()}-copy`, originalName: `Kopija - ${source.originalName}`, storedName, uploadedBy: request.user.sub, uploadedAt: new Date().toISOString(), copiedFrom: source.id };
	data.documents.push(copy); await writeData(data); response.status(201).json(copy);
});
app.delete('/api/documents/:id', auth, manager, async (request, response) => {
	const data = await readData(); const item = data.documents.find((document) => document.id === request.params.id && document.uploadedBy === request.user.sub);
	if (!item) return response.status(404).json({ error: 'Document not found' });
	await fs.unlink(path.join(uploadDir, item.storedName)).catch(() => {});
	data.documents = data.documents.filter((document) => document.id !== item.id); await writeData(data); response.json({ deleted: true, id: item.id });
});
app.post('/api/ai/technical-answer', auth, async (request, response) => {
	const question = String(request.body.question || '').trim();
	const projectId = String(request.body.projectId || 'lot-a');
	if (!question) return response.status(400).json({ error: 'A technical question is required' });
	const aiBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
	const aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
	if (!aiApiKey) return response.json({ status: 'not_configured', answer: 'AI nije konfigurisan. Podesite OPENAI_API_KEY ili lokalni AI server u .env fajlu. Bez toga nema tehničkog odgovora.', sources: [], requiresHumanConfirmation: true });
	const data = await readData();
	const documents = (data.documents || []).filter((item) => item.projectId === projectId && item.uploadedBy === request.user.sub && allowedWorkEvidenceTypes.includes(item.evidenceType));
	const sources = [];
	for (const document of documents) {
		if (!document.storedName) continue;
		let buffer;
		try { buffer = await fs.readFile(path.join(uploadDir, document.storedName)); } catch (error) {
			if (error.code === 'ENOENT') continue;
			throw error;
		}
		if (document.mimeType.includes('pdf')) {
			const parsed = await parsePdf(buffer); const pages = parsed.text.split('\f');
			pages.forEach((text, index) => { if (text.trim()) sources.push({ file: document.originalName, type: document.evidenceType, page: index + 1, text: text.slice(0, 12000) }); });
		} else if (document.mimeType.startsWith('image/')) {
			sources.push({ file: document.originalName, type: document.evidenceType, page: null, image: `data:${document.mimeType};base64,${buffer.toString('base64')}` });
		}
	}
	if (!sources.length) return response.json({ status: 'no_source', answer: 'Nije pronađen plan, fiche technique ili fotografija za ovaj chantier.', sources: [], requiresHumanConfirmation: true });
	const sourceText = sources.filter((source) => source.text).map((source) => `SOURCE: ${source.file} | TYPE: ${source.type} | PAGE: ${source.page}\n${source.text}`).join('\n\n');
	const prompt = `Odgovori samo na osnovu dostavljenog SOURCE teksta i fotografija. Ne izmišljaj mere, tolerancije ili pravila. Ako podatak nije jasno vidljiv ili naveden, reci: "Podatak nije pronađen u dokumentaciji ili fotografiji." Uvek navedi source file i page ako postoji. Odgovor treba da bude tehnički jasan, na srpskom/bosanskom. Pitanje: ${question}\n\n${sourceText}`;
	const userContent = [{ type: 'text', text: prompt }, ...sources.filter((source) => source.image).map((source) => ({ type: 'text', text: `PHOTO SOURCE: ${source.file} | TYPE: ${source.type}` })), ...sources.filter((source) => source.image).map((source) => ({ type: 'image_url', image_url: { url: source.image, detail: 'high' } }))];
	const aiResponse = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${aiApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0, messages: [{ role: 'system', content: 'Ti si tehnički pomoćnik za chantier. Radiš isključivo sa dostavljenim izvorima i fotografijama i nikada ne nagađaš.' }, { role: 'user', content: userContent }] }) });
	if (!aiResponse.ok) return response.status(502).json({ error: 'AI provider unavailable' });
	const result = await aiResponse.json();
	response.json({ status: 'grounded', answer: result.choices?.[0]?.message?.content || 'Nema odgovora.', sources: sources.map(({ file, type, page }) => ({ file, type, page })), requiresHumanConfirmation: false });
});
app.get('/api/projects/:id/work-sequence', auth, async (request, response) => {
	const aiBaseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1'; const aiApiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY; if (!aiApiKey) return response.json({ status: 'not_configured', steps: [], answer: 'AI za redosled radova nije konfigurisan. Ne započinjite rad bez Conducteur-a i plana potvrđenog od Gérant-a.', sources: [], requiresHumanConfirmation: true });
	const data = await readData(); const documents = (data.documents || []).filter((item) => item.projectId === request.params.id && ['plan', 'fiche-technique'].includes(item.evidenceType) && item.mimeType.includes('pdf')); const sources = [];
	for (const document of documents) { const buffer = await fs.readFile(path.join(uploadDir, document.storedName)); const parsed = await parsePdf(buffer); parsed.text.split('\f').forEach((text, index) => { if (text.trim()) sources.push({ file: document.originalName, page: index + 1, text: text.slice(0, 12000) }); }); }
	if (!sources.length) return response.json({ status: 'no_source', steps: [], answer: 'Nije pronađen plan ili fiche technique PDF. Redosled radova ne može biti određen.', sources: [], requiresHumanConfirmation: true });
	const sourceText = sources.map((source) => `SOURCE: ${source.file} | PAGE: ${source.page}\n${source.text}`).join('\n\n'); const prompt = `Na osnovu isključivo SOURCE teksta napravi redosled izvođenja radova. Vrati JSON sa steps nizom; svaki korak mora imati order, title, instruction, requiredEvidence i sourcePage. Ne izmišljaj radove. Ako podatak nije u izvoru, navedi da nije pronađen. Conducteur mora potvrditi svaki korak.\n\n${sourceText}`; const aiResponse = await fetch(`${aiBaseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${aiApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Ti si pomoćnik za pravilno izvođenje chantier radova i radiš samo iz izvora.' }, { role: 'user', content: prompt }] }) }); if (!aiResponse.ok) return response.status(502).json({ error: 'AI provider unavailable' }); const result = await aiResponse.json(); let parsed; try { parsed = JSON.parse(result.choices?.[0]?.message?.content || '{}'); } catch { parsed = {}; } response.json({ status: 'grounded', steps: Array.isArray(parsed.steps) ? parsed.steps : [], answer: 'Redosled je izveden iz dostavljene dokumentacije. Conducteur potvrđuje svaki korak.', sources: sources.map(({ file, page }) => ({ file, page })), requiresHumanConfirmation: true });
});
app.get('/api/projects/:id/evidence-summary', auth, async (request, response) => {
	const data = await readData();
	const documents = data.documents.filter((item) => item.projectId === request.params.id && item.uploadedBy === request.user.sub);
	const required = ['plan', 'fiche-technique', 'photo-before', 'photo-during', 'photo-after'];
	const present = required.filter((type) => documents.some((item) => item.evidenceType === type));
	response.json({ projectId: request.params.id, required, present, missing: required.filter((type) => !present.includes(type)), complete: present.length === required.length });
});
await fs.mkdir(persistentRoot, { recursive: true });
await fs.mkdir(uploadDir, { recursive: true });
if (persistentRoot !== root) {
	const seedDataPath = path.join(root, 'data.json'); const seedUploadDir = path.join(root, 'uploads');
	try { await fs.access(dataPath); } catch { await fs.copyFile(seedDataPath, dataPath); }
	try { const existingUploads = await fs.readdir(uploadDir); if (!existingUploads.length) await fs.cp(seedUploadDir, uploadDir, { recursive: true, force: false }); } catch {}
}
app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`IBRA-BA web app listening on port ${process.env.PORT || 3000} at ${root}`));
