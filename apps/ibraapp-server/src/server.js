import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { Server as SocketIOServer } from 'socket.io';
import { dbGet, dbAll, dbRun, initSchema, uid } from './db.js';
import { ensureBucket, uploadBuffer } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.IBRAAPP_JWT_SECRET || 'ibraapp-dev-secret-change-in-production';
const PORT = process.env.PORT || process.env.IBRAAPP_PORT || 4001;
const webDir = path.join(__dirname, '..', '..', 'ibraapp');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(webDir));
app.get('/api/health', (req, res) => res.json({ ok: true }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ===================== HELPERS ===================== */
const publicUser = (row) => row && ({
  email: row.email, name: row.name, avatarData: row.avatar_data || '', avatarColor: row.avatar_color,
  statusText: row.status_text || '', showOnline: !!row.show_online, showReadReceipts: !!row.show_read_receipts,
  online: !!row.online, isBot: !!row.is_bot,
});
const colorFor = (seed) => { let hash = 0; for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360; return `hsl(${hash} 60% 42%)`; };

const getUserByEmail = (email) => dbGet('SELECT * FROM users WHERE email = $1', [email]);
const insertUser = (email, name, passwordHash, avatarColor, statusText, createdAt) =>
  dbRun('INSERT INTO users (email,name,password_hash,avatar_color,status_text,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [email, name, passwordHash, avatarColor, statusText, createdAt]);
const getChatMembers = (chatId) => dbAll('SELECT * FROM chat_members WHERE chat_id = $1 AND left_chat = FALSE', [chatId]);
async function chatToJson(row) {
  const members = await getChatMembers(row.id);
  return {
    id: row.id, type: row.type, name: row.name, avatarColor: row.avatar_color, createdBy: row.created_by, createdAt: Number(row.created_at),
    disappearing: row.disappearing ? Number(row.disappearing) : null, pinnedMessageIds: row.pinned_message_ids || [],
    memberEmails: members.map((m) => m.email),
    admins: members.filter((m) => m.is_admin).map((m) => m.email),
    pinned: members.filter((m) => m.pinned).map((m) => m.email),
    muted: members.filter((m) => m.muted).map((m) => m.email),
    archived: members.filter((m) => m.archived).map((m) => m.email),
    deletedFor: members.filter((m) => m.deleted_for).map((m) => m.email),
  };
}
const messageToJson = (row) => ({
  id: row.id, chatId: row.chat_id, sender: row.sender, type: row.type, text: row.text || '',
  attachment: row.attachment || null,
  replyTo: row.reply_to || null,
  poll: row.poll || null,
  call: row.call || null,
  reactions: row.reactions || {},
  readBy: row.read_by || [],
  edited: !!row.edited, deleted: !!row.deleted, createdAt: Number(row.created_at),
});

async function seedDemoUsers() {
  const bots = [
    { email: 'sanja@ibra-ba.net', name: 'Sanja M.', replies: ['Može, javljam se za pola sata.', 'Vidio/la sam, hvala!', 'Ok, dogovoreno 👍', 'Poslaću ti danas fotke sa gradilišta.', 'Provjeriću i javim ti.'] },
    { email: 'marko@ibra-ba.net', name: 'Marko P.', replies: ['Jasno, krećem odmah.', 'Treba mi još malo materijala.', '👍', 'U redu, sutra ujutro sam tamo.', 'Šaljem izvještaj za danas.'] },
    { email: 'ekipa@ibra-ba.net', name: 'Ekipa — gradilište', replies: ['Svi smo stigli na gradilište.', 'Kraj smjene, sve po planu.', 'Treba nam odobrenje za nabavku.'] },
  ];
  for (const bot of bots) {
    if (!(await getUserByEmail(bot.email))) {
      await dbRun(
        'INSERT INTO users (email,name,password_hash,avatar_color,status_text,is_bot,bot_replies,online,created_at) VALUES ($1,$2,$3,$4,$5,TRUE,$6,TRUE,$7)',
        [bot.email, bot.name, bcrypt.hashSync(uid(), 10), colorFor(bot.email), 'Dostupan/na', JSON.stringify(bot.replies), Date.now()],
      );
    }
  }
}

/* ===================== AUTH MIDDLEWARE ===================== */
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserByEmail(payload.email);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.userEmail = user.email;
    req.userRow = user;
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}
const issueToken = (email) => jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });

/* ===================== AUTH ROUTES ===================== */
app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const { name, email, password, statusText } = req.body || {};
  const normalized = String(email || '').trim().toLowerCase();
  if (!name?.trim() || !normalized || !password || password.length < 4) return res.status(400).json({ error: 'Nedostaju podaci ili je lozinka prekratka.' });
  if (await getUserByEmail(normalized)) return res.status(409).json({ error: 'Nalog sa ovim emailom već postoji.' });
  await insertUser(normalized, name.trim(), bcrypt.hashSync(password, 10), colorFor(normalized), (statusText || 'Dostupan/na').trim(), Date.now());
  const user = await getUserByEmail(normalized);
  res.json({ token: issueToken(normalized), user: publicUser(user) });
}));
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const normalized = String(email || '').trim().toLowerCase();
  const user = await getUserByEmail(normalized);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return res.status(401).json({ error: 'Pogrešan email ili lozinka.' });
  await dbRun('UPDATE users SET online = TRUE WHERE email = $1', [normalized]);
  res.json({ token: issueToken(normalized), user: publicUser(await getUserByEmail(normalized)) });
}));
app.get('/api/me', authMiddleware, (req, res) => res.json(publicUser(req.userRow)));
app.patch('/api/me', authMiddleware, asyncHandler(async (req, res) => {
  const { name, statusText, showOnline, showReadReceipts, avatarData } = req.body || {};
  await dbRun(
    `UPDATE users SET name = COALESCE($1,name), status_text = COALESCE($2,status_text), show_online = COALESCE($3,show_online), show_read_receipts = COALESCE($4,show_read_receipts), avatar_data = COALESCE($5,avatar_data) WHERE email = $6`,
    [name?.trim() || null, statusText?.trim() ?? null, showOnline === undefined ? null : !!showOnline, showReadReceipts === undefined ? null : !!showReadReceipts, avatarData || null, req.userEmail],
  );
  const user = publicUser(await getUserByEmail(req.userEmail));
  io.emit('user:update', user);
  res.json(user);
}));
app.get('/api/users/lookup', authMiddleware, asyncHandler(async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const user = await getUserByEmail(email);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json(publicUser(user));
}));
app.get('/api/users/batch', authMiddleware, asyncHandler(async (req, res) => {
  const emails = String(req.query.emails || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const rows = await Promise.all(emails.map((email) => getUserByEmail(email)));
  res.json(rows.filter(Boolean).map(publicUser));
}));
app.get('/api/users/contacts', authMiddleware, asyncHandler(async (req, res) => {
  const rows = await dbAll(`
    SELECT DISTINCT u.* FROM users u
    JOIN chat_members cm ON cm.email = u.email
    WHERE u.email != $1 AND cm.chat_id IN (SELECT chat_id FROM chat_members WHERE email = $1)
  `, [req.userEmail]);
  const demo = await dbAll("SELECT * FROM users WHERE email LIKE '%@ibra-ba.net' AND email != $1", [req.userEmail]);
  const byEmail = new Map();
  [...demo, ...rows].forEach((row) => byEmail.set(row.email, publicUser(row)));
  res.json([...byEmail.values()]);
}));

/* ===================== UPLOAD ===================== */
app.post('/api/upload', authMiddleware, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const url = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
  res.json({ url, name: req.file.originalname, size: req.file.size, mime: req.file.mimetype });
}));

/* ===================== CHATS ===================== */
const isMember = (chatId, email) => dbGet('SELECT 1 FROM chat_members WHERE chat_id = $1 AND email = $2 AND left_chat = FALSE', [chatId, email]);
const requireMember = asyncHandler(async (req, res, next) => {
  const chatId = req.params.chatId || req.params.id;
  if (!(await isMember(chatId, req.userEmail))) return res.status(403).json({ error: 'not_a_member' });
  req.chatId = chatId;
  next();
});

app.get('/api/chats', authMiddleware, asyncHandler(async (req, res) => {
  const rows = await dbAll(`
    SELECT c.* FROM chats c JOIN chat_members cm ON cm.chat_id = c.id
    WHERE cm.email = $1 AND cm.left_chat = FALSE AND cm.deleted_for = FALSE
  `, [req.userEmail]);
  res.json(await Promise.all(rows.map(chatToJson)));
}));

app.post('/api/chats/direct', authMiddleware, asyncHandler(async (req, res) => {
  const otherEmail = String(req.body?.email || '').trim().toLowerCase();
  if (!otherEmail || otherEmail === req.userEmail) return res.status(400).json({ error: 'invalid_email' });
  const existing = await dbGet(`
    SELECT c.* FROM chats c
    WHERE c.type = 'direct' AND c.id IN (SELECT chat_id FROM chat_members WHERE email = $1)
      AND c.id IN (SELECT chat_id FROM chat_members WHERE email = $2)
  `, [req.userEmail, otherEmail]);
  if (existing) {
    await dbRun('UPDATE chat_members SET deleted_for = FALSE, left_chat = FALSE WHERE chat_id = $1 AND email = $2', [existing.id, req.userEmail]);
    return res.json(await chatToJson(existing));
  }
  if (!(await getUserByEmail(otherEmail))) {
    await insertUser(otherEmail, otherEmail.split('@')[0], bcrypt.hashSync(uid(), 10), colorFor(otherEmail), '', Date.now());
  }
  const chatId = uid();
  await dbRun('INSERT INTO chats (id,type,name,created_by,created_at) VALUES ($1,$2,$3,$4,$5)', [chatId, 'direct', null, req.userEmail, Date.now()]);
  await dbRun('INSERT INTO chat_members (chat_id,email,is_admin) VALUES ($1,$2,TRUE)', [chatId, req.userEmail]);
  await dbRun('INSERT INTO chat_members (chat_id,email) VALUES ($1,$2)', [chatId, otherEmail]);
  const chat = await chatToJson(await dbGet('SELECT * FROM chats WHERE id = $1', [chatId]));
  io.to(`user:${otherEmail}`).emit('chat:new', chat);
  res.json(chat);
}));

app.post('/api/chats/group', authMiddleware, asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const memberEmails = Array.isArray(req.body?.memberEmails) ? req.body.memberEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean) : [];
  if (!name || !memberEmails.length) return res.status(400).json({ error: 'invalid_group' });
  const chatId = uid();
  await dbRun('INSERT INTO chats (id,type,name,avatar_color,created_by,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [chatId, 'group', name, colorFor(name + Date.now()), req.userEmail, Date.now()]);
  await dbRun('INSERT INTO chat_members (chat_id,email,is_admin) VALUES ($1,$2,TRUE)', [chatId, req.userEmail]);
  for (const memberEmail of memberEmails) {
    if (memberEmail !== req.userEmail && (await getUserByEmail(memberEmail))) {
      await dbRun('INSERT INTO chat_members (chat_id,email) VALUES ($1,$2) ON CONFLICT (chat_id,email) DO NOTHING', [chatId, memberEmail]);
    }
  }
  const systemMessage = await createMessage(chatId, 'system', req.userEmail, { text: `${req.userRow.name} je napravio/la grupu "${name}"` });
  const chat = await chatToJson(await dbGet('SELECT * FROM chats WHERE id = $1', [chatId]));
  const members = await getChatMembers(chatId);
  members.forEach((member) => io.to(`user:${member.email}`).emit('chat:new', chat));
  await broadcastMessage(chatId, systemMessage);
  res.json(chat);
}));

app.patch('/api/chats/:id/prefs', authMiddleware, requireMember, asyncHandler(async (req, res) => {
  const { pinned, muted, archived } = req.body || {};
  const sets = []; const values = []; let idx = 1;
  if (pinned !== undefined) { sets.push(`pinned = $${idx++}`); values.push(!!pinned); }
  if (muted !== undefined) { sets.push(`muted = $${idx++}`); values.push(!!muted); }
  if (archived !== undefined) { sets.push(`archived = $${idx++}`); values.push(!!archived); }
  if (sets.length) {
    values.push(req.chatId, req.userEmail);
    await dbRun(`UPDATE chat_members SET ${sets.join(', ')} WHERE chat_id = $${idx++} AND email = $${idx++}`, values);
  }
  res.json(await chatToJson(await dbGet('SELECT * FROM chats WHERE id = $1', [req.chatId])));
}));
app.patch('/api/chats/:id/settings', authMiddleware, requireMember, asyncHandler(async (req, res) => {
  const { disappearing } = req.body || {};
  await dbRun('UPDATE chats SET disappearing = $1 WHERE id = $2', [disappearing || null, req.chatId]);
  const chat = await chatToJson(await dbGet('SELECT * FROM chats WHERE id = $1', [req.chatId]));
  const members = await getChatMembers(req.chatId);
  members.forEach((m) => io.to(`user:${m.email}`).emit('chat:update', chat));
  res.json(chat);
}));
app.post('/api/chats/:id/delete-for-me', authMiddleware, requireMember, asyncHandler(async (req, res) => {
  await dbRun('UPDATE chat_members SET deleted_for = TRUE WHERE chat_id = $1 AND email = $2', [req.chatId, req.userEmail]);
  res.json({ ok: true });
}));
app.post('/api/chats/:id/leave', authMiddleware, requireMember, asyncHandler(async (req, res) => {
  await dbRun('UPDATE chat_members SET left_chat = TRUE WHERE chat_id = $1 AND email = $2', [req.chatId, req.userEmail]);
  const message = await createMessage(req.chatId, 'system', req.userEmail, { text: `${req.userRow.name} je napustio/la grupu` });
  await broadcastMessage(req.chatId, message);
  res.json({ ok: true });
}));
app.delete('/api/chats/:id/members/:email', authMiddleware, requireMember, asyncHandler(async (req, res) => {
  const members = await getChatMembers(req.chatId);
  const me = members.find((m) => m.email === req.userEmail);
  if (!me?.is_admin) return res.status(403).json({ error: 'not_admin' });
  const targetEmail = req.params.email.toLowerCase();
  await dbRun('UPDATE chat_members SET left_chat = TRUE WHERE chat_id = $1 AND email = $2', [req.chatId, targetEmail]);
  const targetUser = await getUserByEmail(targetEmail);
  const message = await createMessage(req.chatId, 'system', req.userEmail, { text: `${targetUser?.name || targetEmail} je uklonjen/a iz grupe` });
  await broadcastMessage(req.chatId, message);
  io.to(`user:${targetEmail}`).emit('chat:removed', { chatId: req.chatId });
  res.json({ ok: true });
}));

/* ===================== MESSAGES ===================== */
async function createMessage(chatId, type, sender, extra = {}) {
  const id = uid();
  const createdAt = Date.now();
  await dbRun(
    `INSERT INTO messages (id,chat_id,sender,type,text,attachment,reply_to,poll,call,reactions,read_by,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, chatId, sender, type, extra.text || '', extra.attachment ? JSON.stringify(extra.attachment) : null,
      extra.replyTo || null, extra.poll ? JSON.stringify(extra.poll) : null, extra.call ? JSON.stringify(extra.call) : null,
      JSON.stringify({}), JSON.stringify(type === 'system' ? [] : [sender]), createdAt],
  );
  return messageToJson(await dbGet('SELECT * FROM messages WHERE id = $1', [id]));
}
async function broadcastMessage(chatId, message) {
  const members = await getChatMembers(chatId);
  members.forEach((member) => io.to(`user:${member.email}`).emit('message:new', { chatId, message }));
}
async function broadcastMessageUpdate(chatId, message) {
  const members = await getChatMembers(chatId);
  members.forEach((member) => io.to(`user:${member.email}`).emit('message:update', { chatId, message }));
}

app.get('/api/chats/:id/messages', authMiddleware, requireMember, asyncHandler(async (req, res) => {
  const rows = await dbAll('SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC', [req.chatId]);
  res.json(rows.map(messageToJson));
}));
app.post('/api/chats/:id/messages', authMiddleware, requireMember, asyncHandler(async (req, res) => {
  const { type, text, attachment, replyTo, poll } = req.body || {};
  const message = await createMessage(req.chatId, type || 'text', req.userEmail, { text, attachment, replyTo, poll });
  await broadcastMessage(req.chatId, message);
  maybeReplyAsBot(req.chatId, req.userEmail).catch((err) => console.error('bot reply failed', err));
  res.json(message);
}));
async function maybeReplyAsBot(chatId, fromEmail) {
  const chat = await dbGet('SELECT * FROM chats WHERE id = $1', [chatId]);
  if (chat.type !== 'direct') return;
  const members = await getChatMembers(chatId);
  const botMember = members.find((m) => m.email !== fromEmail);
  const bot = botMember && (await getUserByEmail(botMember.email));
  if (!bot?.is_bot) return;
  const replies = bot.bot_replies || [];
  if (!replies.length) return;
  setTimeout(() => {
    io.to(`user:${fromEmail}`).emit('typing', { chatId, email: bot.email, typing: true });
    setTimeout(async () => {
      io.to(`user:${fromEmail}`).emit('typing', { chatId, email: bot.email, typing: false });
      const reply = await createMessage(chatId, 'text', bot.email, { text: replies[Math.floor(Math.random() * replies.length)] });
      await broadcastMessage(chatId, reply);
    }, 1200 + Math.random() * 1400);
  }, 400 + Math.random() * 600);
}
app.post('/api/chats/:id/calls/log', authMiddleware, requireMember, asyncHandler(async (req, res) => {
  const { kind, duration, missed } = req.body || {};
  const message = await createMessage(req.chatId, 'call', req.userEmail, { call: { kind, duration: duration || 0, missed: !!missed } });
  await broadcastMessage(req.chatId, message);
  res.json(message);
}));

app.patch('/api/messages/:id', authMiddleware, asyncHandler(async (req, res) => {
  const row = await dbGet('SELECT * FROM messages WHERE id = $1', [req.params.id]);
  if (!row || row.sender !== req.userEmail || row.type !== 'text') return res.status(403).json({ error: 'forbidden' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  await dbRun('UPDATE messages SET text = $1, edited = TRUE WHERE id = $2', [text, row.id]);
  const message = messageToJson(await dbGet('SELECT * FROM messages WHERE id = $1', [row.id]));
  await broadcastMessageUpdate(row.chat_id, message);
  res.json(message);
}));
app.delete('/api/messages/:id', authMiddleware, asyncHandler(async (req, res) => {
  const row = await dbGet('SELECT * FROM messages WHERE id = $1', [req.params.id]);
  if (!row || row.sender !== req.userEmail) return res.status(403).json({ error: 'forbidden' });
  await dbRun("UPDATE messages SET deleted = TRUE, text = '', attachment = NULL WHERE id = $1", [row.id]);
  const message = messageToJson(await dbGet('SELECT * FROM messages WHERE id = $1', [row.id]));
  await broadcastMessageUpdate(row.chat_id, message);
  res.json(message);
}));
app.post('/api/messages/:id/read', authMiddleware, asyncHandler(async (req, res) => {
  const row = await dbGet('SELECT * FROM messages WHERE id = $1', [req.params.id]);
  if (!row || !(await isMember(row.chat_id, req.userEmail))) return res.status(403).json({ error: 'forbidden' });
  const readBy = row.read_by || [];
  if (!readBy.includes(req.userEmail)) {
    readBy.push(req.userEmail);
    await dbRun('UPDATE messages SET read_by = $1 WHERE id = $2', [JSON.stringify(readBy), row.id]);
  }
  const message = messageToJson(await dbGet('SELECT * FROM messages WHERE id = $1', [row.id]));
  await broadcastMessageUpdate(row.chat_id, message);
  res.json(message);
}));
app.post('/api/messages/:id/react', authMiddleware, asyncHandler(async (req, res) => {
  const row = await dbGet('SELECT * FROM messages WHERE id = $1', [req.params.id]);
  if (!row || !(await isMember(row.chat_id, req.userEmail))) return res.status(403).json({ error: 'forbidden' });
  const emoji = req.body?.emoji;
  if (!emoji) return res.status(400).json({ error: 'emoji_required' });
  const reactions = row.reactions || {};
  reactions[emoji] = reactions[emoji] || [];
  const index = reactions[emoji].indexOf(req.userEmail);
  if (index === -1) reactions[emoji].push(req.userEmail); else reactions[emoji].splice(index, 1);
  await dbRun('UPDATE messages SET reactions = $1 WHERE id = $2', [JSON.stringify(reactions), row.id]);
  const message = messageToJson(await dbGet('SELECT * FROM messages WHERE id = $1', [row.id]));
  await broadcastMessageUpdate(row.chat_id, message);
  res.json(message);
}));
app.post('/api/messages/:id/vote', authMiddleware, asyncHandler(async (req, res) => {
  const row = await dbGet('SELECT * FROM messages WHERE id = $1', [req.params.id]);
  if (!row || row.type !== 'poll' || !(await isMember(row.chat_id, req.userEmail))) return res.status(403).json({ error: 'forbidden' });
  const optionIndex = Number(req.body?.optionIndex);
  const poll = row.poll;
  poll.options.forEach((option, index) => { const at = option.votes.indexOf(req.userEmail); if (at !== -1 && index !== optionIndex) option.votes.splice(at, 1); });
  const target = poll.options[optionIndex];
  const at = target.votes.indexOf(req.userEmail);
  if (at === -1) target.votes.push(req.userEmail); else target.votes.splice(at, 1);
  await dbRun('UPDATE messages SET poll = $1 WHERE id = $2', [JSON.stringify(poll), row.id]);
  const message = messageToJson(await dbGet('SELECT * FROM messages WHERE id = $1', [row.id]));
  await broadcastMessageUpdate(row.chat_id, message);
  res.json(message);
}));
app.post('/api/messages/:id/pin', authMiddleware, asyncHandler(async (req, res) => {
  const row = await dbGet('SELECT * FROM messages WHERE id = $1', [req.params.id]);
  if (!row || !(await isMember(row.chat_id, req.userEmail))) return res.status(403).json({ error: 'forbidden' });
  const chat = await dbGet('SELECT * FROM chats WHERE id = $1', [row.chat_id]);
  const pinnedIds = chat.pinned_message_ids || [];
  const index = pinnedIds.indexOf(row.id);
  if (index === -1) { if (pinnedIds.length >= 3) return res.status(400).json({ error: 'max_pinned' }); pinnedIds.push(row.id); } else pinnedIds.splice(index, 1);
  await dbRun('UPDATE chats SET pinned_message_ids = $1 WHERE id = $2', [JSON.stringify(pinnedIds), chat.id]);
  const updated = await chatToJson(await dbGet('SELECT * FROM chats WHERE id = $1', [chat.id]));
  const members = await getChatMembers(chat.id);
  members.forEach((m) => io.to(`user:${m.email}`).emit('chat:update', updated));
  res.json(updated);
}));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'server_error' }); });

/* ===================== HTTP + SOCKET.IO ===================== */
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });

io.use(async (socket, next) => {
  try {
    const payload = jwt.verify(socket.handshake.auth?.token || '', JWT_SECRET);
    const user = await getUserByEmail(payload.email);
    if (!user) throw new Error('no user');
    socket.userEmail = user.email;
    next();
  } catch { next(new Error('unauthorized')); }
});

const socketsPerUser = new Map();
io.on('connection', async (socket) => {
  const email = socket.userEmail;
  socket.join(`user:${email}`);
  socketsPerUser.set(email, (socketsPerUser.get(email) || 0) + 1);
  await dbRun('UPDATE users SET online = TRUE WHERE email = $1', [email]);
  io.emit('presence', { email, online: true });

  const relayTyping = async (chatId, fromEmail, typing) => {
    if (!(await isMember(chatId, fromEmail))) return;
    const members = await getChatMembers(chatId);
    members.filter((m) => m.email !== fromEmail).forEach((m) => io.to(`user:${m.email}`).emit('typing', { chatId, email: fromEmail, typing }));
  };
  socket.on('typing:start', ({ chatId }) => relayTyping(chatId, email, true));
  socket.on('typing:stop', ({ chatId }) => relayTyping(chatId, email, false));

  // WebRTC signaling relay (mesh): forwards offers/answers/ICE candidates between chat members
  socket.on('call:signal', async ({ chatId, toEmail, data }) => {
    if (!(await isMember(chatId, email))) return;
    io.to(`user:${toEmail}`).emit('call:signal', { chatId, fromEmail: email, data });
  });
  socket.on('call:invite', async ({ chatId, kind }) => {
    if (!(await isMember(chatId, email))) return;
    const members = await getChatMembers(chatId);
    const caller = await getUserByEmail(email);
    members.filter((m) => m.email !== email).forEach((m) => io.to(`user:${m.email}`).emit('call:invite', { chatId, kind, fromEmail: email, fromName: caller?.name }));
  });
  socket.on('call:accept', ({ chatId, toEmail }) => io.to(`user:${toEmail}`).emit('call:accept', { chatId, fromEmail: email }));
  socket.on('call:decline', ({ chatId, toEmail }) => io.to(`user:${toEmail}`).emit('call:decline', { chatId, fromEmail: email }));
  socket.on('call:leave', async ({ chatId }) => {
    if (!(await isMember(chatId, email))) return;
    const members = await getChatMembers(chatId);
    members.filter((m) => m.email !== email).forEach((m) => io.to(`user:${m.email}`).emit('call:peer-left', { chatId, fromEmail: email }));
  });

  socket.on('disconnect', async () => {
    const remaining = (socketsPerUser.get(email) || 1) - 1;
    socketsPerUser.set(email, Math.max(0, remaining));
    if (remaining <= 0) { await dbRun('UPDATE users SET online = FALSE WHERE email = $1', [email]); io.emit('presence', { email, online: false }); }
  });
});

await initSchema();
await ensureBucket();
await seedDemoUsers();
httpServer.listen(PORT, () => console.log(`IbraApp server listening on port ${PORT}`));
