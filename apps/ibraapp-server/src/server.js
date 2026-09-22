import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { Server as SocketIOServer } from 'socket.io';
import { db, uid } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.IBRAAPP_JWT_SECRET || 'ibraapp-dev-secret-change-in-production';
const PORT = process.env.PORT || process.env.IBRAAPP_PORT || 4001;
const storageRoot = process.env.IBRAAPP_STORAGE_DIR || path.join(__dirname, '..');
const uploadsDir = path.join(storageRoot, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const webDir = path.join(__dirname, '..', '..', 'ibraapp');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(webDir));
app.get('/api/health', (req, res) => res.json({ ok: true }));

const upload = multer({ storage: multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${uid()}${path.extname(file.originalname)}`),
}), limits: { fileSize: 20 * 1024 * 1024 } });

/* ===================== HELPERS ===================== */
const publicUser = (row) => row && ({
  email: row.email, name: row.name, avatarData: row.avatar_data || '', avatarColor: row.avatar_color,
  statusText: row.status_text || '', showOnline: !!row.show_online, showReadReceipts: !!row.show_read_receipts,
  online: !!row.online, isBot: !!row.is_bot,
});
const colorFor = (seed) => { let hash = 0; for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360; return `hsl(${hash} 60% 42%)`; };

const getChatMembers = db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND left_chat = 0');
const chatToJson = (row) => {
  const members = getChatMembers.all(row.id);
  return {
    id: row.id, type: row.type, name: row.name, avatarColor: row.avatar_color, createdBy: row.created_by, createdAt: row.created_at,
    disappearing: row.disappearing || null, pinnedMessageIds: JSON.parse(row.pinned_message_ids || '[]'),
    memberEmails: members.map((m) => m.email),
    admins: members.filter((m) => m.is_admin).map((m) => m.email),
    pinned: members.filter((m) => m.pinned).map((m) => m.email),
    muted: members.filter((m) => m.muted).map((m) => m.email),
    archived: members.filter((m) => m.archived).map((m) => m.email),
    deletedFor: members.filter((m) => m.deleted_for).map((m) => m.email),
  };
};
const messageToJson = (row) => ({
  id: row.id, chatId: row.chat_id, sender: row.sender, type: row.type, text: row.text || '',
  attachment: row.attachment ? JSON.parse(row.attachment) : null,
  replyTo: row.reply_to || null,
  poll: row.poll ? JSON.parse(row.poll) : null,
  call: row.call ? JSON.parse(row.call) : null,
  reactions: JSON.parse(row.reactions || '{}'),
  readBy: JSON.parse(row.read_by || '[]'),
  edited: !!row.edited, deleted: !!row.deleted, createdAt: row.created_at,
});

const getUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const insertUser = db.prepare('INSERT INTO users (email,name,password_hash,avatar_color,status_text,created_at) VALUES (?,?,?,?,?,?)');
const insertBot = db.prepare('INSERT INTO users (email,name,password_hash,avatar_color,status_text,is_bot,bot_replies,online,created_at) VALUES (?,?,?,?,?,1,?,1,?)');

function seedDemoUsers() {
  const bots = [
    { email: 'sanja@ibra-ba.net', name: 'Sanja M.', replies: ['Može, javljam se za pola sata.', 'Vidio/la sam, hvala!', 'Ok, dogovoreno 👍', 'Poslaću ti danas fotke sa gradilišta.', 'Provjeriću i javim ti.'] },
    { email: 'marko@ibra-ba.net', name: 'Marko P.', replies: ['Jasno, krećem odmah.', 'Treba mi još malo materijala.', '👍', 'U redu, sutra ujutro sam tamo.', 'Šaljem izvještaj za danas.'] },
    { email: 'ekipa@ibra-ba.net', name: 'Ekipa — gradilište', replies: ['Svi smo stigli na gradilište.', 'Kraj smjene, sve po planu.', 'Treba nam odobrenje za nabavku.'] },
  ];
  bots.forEach((bot) => {
    if (!getUserByEmail.get(bot.email)) insertBot.run(bot.email, bot.name, bcrypt.hashSync(uid(), 10), colorFor(bot.email), 'Dostupan/na', JSON.stringify(bot.replies), Date.now());
  });
}
seedDemoUsers();

/* ===================== AUTH MIDDLEWARE ===================== */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserByEmail.get(payload.email);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.userEmail = user.email;
    req.userRow = user;
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}
const issueToken = (email) => jwt.sign({ email }, JWT_SECRET, { expiresIn: '30d' });

/* ===================== AUTH ROUTES ===================== */
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, statusText } = req.body || {};
  const normalized = String(email || '').trim().toLowerCase();
  if (!name?.trim() || !normalized || !password || password.length < 4) return res.status(400).json({ error: 'Nedostaju podaci ili je lozinka prekratka.' });
  if (getUserByEmail.get(normalized)) return res.status(409).json({ error: 'Nalog sa ovim emailom već postoji.' });
  insertUser.run(normalized, name.trim(), bcrypt.hashSync(password, 10), colorFor(normalized), (statusText || 'Dostupan/na').trim(), Date.now());
  const user = getUserByEmail.get(normalized);
  res.json({ token: issueToken(normalized), user: publicUser(user) });
});
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const normalized = String(email || '').trim().toLowerCase();
  const user = getUserByEmail.get(normalized);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return res.status(401).json({ error: 'Pogrešan email ili lozinka.' });
  db.prepare('UPDATE users SET online = 1 WHERE email = ?').run(normalized);
  res.json({ token: issueToken(normalized), user: publicUser(getUserByEmail.get(normalized)) });
});
app.get('/api/me', authMiddleware, (req, res) => res.json(publicUser(req.userRow)));
app.patch('/api/me', authMiddleware, (req, res) => {
  const { name, statusText, showOnline, showReadReceipts, avatarData } = req.body || {};
  db.prepare('UPDATE users SET name = COALESCE(?,name), status_text = COALESCE(?,status_text), show_online = COALESCE(?,show_online), show_read_receipts = COALESCE(?,show_read_receipts), avatar_data = COALESCE(?,avatar_data) WHERE email = ?')
    .run(name?.trim() || null, statusText?.trim() ?? null, showOnline === undefined ? null : (showOnline ? 1 : 0), showReadReceipts === undefined ? null : (showReadReceipts ? 1 : 0), avatarData || null, req.userEmail);
  const user = publicUser(getUserByEmail.get(req.userEmail));
  io.emit('user:update', user);
  res.json(user);
});
app.get('/api/users/lookup', authMiddleware, (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const user = getUserByEmail.get(email);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json(publicUser(user));
});
app.get('/api/users/batch', authMiddleware, (req, res) => {
  const emails = String(req.query.emails || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  res.json(emails.map((email) => publicUser(getUserByEmail.get(email))).filter(Boolean));
});
app.get('/api/users/contacts', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT DISTINCT u.* FROM users u
    JOIN chat_members cm ON cm.email = u.email
    WHERE u.email != ? AND cm.chat_id IN (SELECT chat_id FROM chat_members WHERE email = ?)
  `).all(req.userEmail, req.userEmail);
  const demo = db.prepare("SELECT * FROM users WHERE email LIKE '%@ibra-ba.net' AND email != ?").all(req.userEmail);
  const byEmail = new Map();
  [...demo, ...rows].forEach((row) => byEmail.set(row.email, publicUser(row)));
  res.json([...byEmail.values()]);
});

/* ===================== UPLOAD ===================== */
app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  res.json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname, size: req.file.size, mime: req.file.mimetype });
});

/* ===================== CHATS ===================== */
const isMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND email = ? AND left_chat = 0');
function requireMember(req, res, next) {
  const chatId = req.params.chatId || req.params.id;
  if (!isMember.get(chatId, req.userEmail)) return res.status(403).json({ error: 'not_a_member' });
  req.chatId = chatId;
  next();
}

app.get('/api/chats', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT c.* FROM chats c JOIN chat_members cm ON cm.chat_id = c.id
    WHERE cm.email = ? AND cm.left_chat = 0 AND cm.deleted_for = 0
  `).all(req.userEmail);
  res.json(rows.map(chatToJson));
});

app.post('/api/chats/direct', authMiddleware, (req, res) => {
  const otherEmail = String(req.body?.email || '').trim().toLowerCase();
  if (!otherEmail || otherEmail === req.userEmail) return res.status(400).json({ error: 'invalid_email' });
  const existing = db.prepare(`
    SELECT c.* FROM chats c
    WHERE c.type = 'direct' AND c.id IN (SELECT chat_id FROM chat_members WHERE email = ?)
      AND c.id IN (SELECT chat_id FROM chat_members WHERE email = ?)
  `).get(req.userEmail, otherEmail);
  if (existing) {
    db.prepare('UPDATE chat_members SET deleted_for = 0, left_chat = 0 WHERE chat_id = ? AND email = ?').run(existing.id, req.userEmail);
    return res.json(chatToJson(existing));
  }
  if (!getUserByEmail.get(otherEmail)) {
    insertUser.run(otherEmail, otherEmail.split('@')[0], bcrypt.hashSync(uid(), 10), colorFor(otherEmail), '', Date.now());
  }
  const chatId = uid();
  db.prepare('INSERT INTO chats (id,type,name,created_by,created_at) VALUES (?,?,?,?,?)').run(chatId, 'direct', null, req.userEmail, Date.now());
  db.prepare('INSERT INTO chat_members (chat_id,email,is_admin) VALUES (?,?,1)').run(chatId, req.userEmail);
  db.prepare('INSERT INTO chat_members (chat_id,email) VALUES (?,?)').run(chatId, otherEmail);
  const chat = chatToJson(db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId));
  io.to(`user:${otherEmail}`).emit('chat:new', chat);
  res.json(chat);
});

app.post('/api/chats/group', authMiddleware, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const memberEmails = Array.isArray(req.body?.memberEmails) ? req.body.memberEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean) : [];
  if (!name || !memberEmails.length) return res.status(400).json({ error: 'invalid_group' });
  const chatId = uid();
  db.prepare('INSERT INTO chats (id,type,name,avatar_color,created_by,created_at) VALUES (?,?,?,?,?,?)').run(chatId, 'group', name, colorFor(name + Date.now()), req.userEmail, Date.now());
  db.prepare('INSERT INTO chat_members (chat_id,email,is_admin) VALUES (?,?,1)').run(chatId, req.userEmail);
  memberEmails.forEach((email) => { if (email !== req.userEmail && getUserByEmail.get(email)) db.prepare('INSERT OR IGNORE INTO chat_members (chat_id,email) VALUES (?,?)').run(chatId, email); });
  const systemMessage = createMessage(chatId, 'system', req.userEmail, { text: `${req.userRow.name} je napravio/la grupu "${name}"` });
  const chat = chatToJson(db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId));
  getChatMembers.all(chatId).forEach((member) => io.to(`user:${member.email}`).emit('chat:new', chat));
  broadcastMessage(chatId, systemMessage);
  res.json(chat);
});

app.patch('/api/chats/:id/prefs', authMiddleware, requireMember, (req, res) => {
  const { pinned, muted, archived } = req.body || {};
  const sets = []; const values = [];
  if (pinned !== undefined) { sets.push('pinned = ?'); values.push(pinned ? 1 : 0); }
  if (muted !== undefined) { sets.push('muted = ?'); values.push(muted ? 1 : 0); }
  if (archived !== undefined) { sets.push('archived = ?'); values.push(archived ? 1 : 0); }
  if (sets.length) { values.push(req.chatId, req.userEmail); db.prepare(`UPDATE chat_members SET ${sets.join(', ')} WHERE chat_id = ? AND email = ?`).run(...values); }
  res.json(chatToJson(db.prepare('SELECT * FROM chats WHERE id = ?').get(req.chatId)));
});
app.patch('/api/chats/:id/settings', authMiddleware, requireMember, (req, res) => {
  const { disappearing } = req.body || {};
  db.prepare('UPDATE chats SET disappearing = ? WHERE id = ?').run(disappearing || null, req.chatId);
  const chat = chatToJson(db.prepare('SELECT * FROM chats WHERE id = ?').get(req.chatId));
  getChatMembers.all(req.chatId).forEach((m) => io.to(`user:${m.email}`).emit('chat:update', chat));
  res.json(chat);
});
app.post('/api/chats/:id/delete-for-me', authMiddleware, requireMember, (req, res) => {
  db.prepare('UPDATE chat_members SET deleted_for = 1 WHERE chat_id = ? AND email = ?').run(req.chatId, req.userEmail);
  res.json({ ok: true });
});
app.post('/api/chats/:id/leave', authMiddleware, requireMember, (req, res) => {
  db.prepare('UPDATE chat_members SET left_chat = 1 WHERE chat_id = ? AND email = ?').run(req.chatId, req.userEmail);
  const message = createMessage(req.chatId, 'system', req.userEmail, { text: `${req.userRow.name} je napustio/la grupu` });
  broadcastMessage(req.chatId, message);
  res.json({ ok: true });
});
app.delete('/api/chats/:id/members/:email', authMiddleware, requireMember, (req, res) => {
  const me = getChatMembers.all(req.chatId).find((m) => m.email === req.userEmail);
  if (!me?.is_admin) return res.status(403).json({ error: 'not_admin' });
  const targetEmail = req.params.email.toLowerCase();
  db.prepare('UPDATE chat_members SET left_chat = 1 WHERE chat_id = ? AND email = ?').run(req.chatId, targetEmail);
  const message = createMessage(req.chatId, 'system', req.userEmail, { text: `${getUserByEmail.get(targetEmail)?.name || targetEmail} je uklonjen/a iz grupe` });
  broadcastMessage(req.chatId, message);
  io.to(`user:${targetEmail}`).emit('chat:removed', { chatId: req.chatId });
  res.json({ ok: true });
});

/* ===================== MESSAGES ===================== */
const insertMessageStmt = db.prepare(`INSERT INTO messages (id,chat_id,sender,type,text,attachment,reply_to,poll,call,reactions,read_by,created_at)
  VALUES (@id,@chatId,@sender,@type,@text,@attachment,@replyTo,@poll,@call,@reactions,@readBy,@createdAt)`);
function createMessage(chatId, type, sender, extra = {}) {
  const row = {
    id: uid(), chatId, sender, type, text: extra.text || '', attachment: extra.attachment ? JSON.stringify(extra.attachment) : null,
    replyTo: extra.replyTo || null, poll: extra.poll ? JSON.stringify(extra.poll) : null, call: extra.call ? JSON.stringify(extra.call) : null,
    reactions: '{}', readBy: JSON.stringify(type === 'system' ? [] : [sender]), createdAt: Date.now(),
  };
  insertMessageStmt.run(row);
  return messageToJson(db.prepare('SELECT * FROM messages WHERE id = ?').get(row.id));
}
function broadcastMessage(chatId, message) {
  getChatMembers.all(chatId).forEach((member) => io.to(`user:${member.email}`).emit('message:new', { chatId, message }));
}
function broadcastMessageUpdate(chatId, message) {
  getChatMembers.all(chatId).forEach((member) => io.to(`user:${member.email}`).emit('message:update', { chatId, message }));
}

app.get('/api/chats/:id/messages', authMiddleware, requireMember, (req, res) => {
  const rows = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC').all(req.chatId);
  res.json(rows.map(messageToJson));
});
app.post('/api/chats/:id/messages', authMiddleware, requireMember, (req, res) => {
  const { type, text, attachment, replyTo, poll } = req.body || {};
  const message = createMessage(req.chatId, type || 'text', req.userEmail, { text, attachment, replyTo, poll });
  broadcastMessage(req.chatId, message);
  maybeReplyAsBot(req.chatId, req.userEmail);
  res.json(message);
});
function maybeReplyAsBot(chatId, fromEmail) {
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
  if (chat.type !== 'direct') return;
  const members = getChatMembers.all(chatId);
  const botMember = members.find((m) => m.email !== fromEmail);
  const bot = botMember && getUserByEmail.get(botMember.email);
  if (!bot?.is_bot) return;
  const replies = JSON.parse(bot.bot_replies || '[]');
  if (!replies.length) return;
  setTimeout(() => {
    io.to(`user:${fromEmail}`).emit('typing', { chatId, email: bot.email, typing: true });
    setTimeout(() => {
      io.to(`user:${fromEmail}`).emit('typing', { chatId, email: bot.email, typing: false });
      const reply = createMessage(chatId, 'text', bot.email, { text: replies[Math.floor(Math.random() * replies.length)] });
      broadcastMessage(chatId, reply);
    }, 1200 + Math.random() * 1400);
  }, 400 + Math.random() * 600);
}
app.post('/api/chats/:id/calls/log', authMiddleware, requireMember, (req, res) => {
  const { kind, duration, missed } = req.body || {};
  const message = createMessage(req.chatId, 'call', req.userEmail, { call: { kind, duration: duration || 0, missed: !!missed } });
  broadcastMessage(req.chatId, message);
  res.json(message);
});

const getMessage = db.prepare('SELECT * FROM messages WHERE id = ?');
app.patch('/api/messages/:id', authMiddleware, (req, res) => {
  const row = getMessage.get(req.params.id);
  if (!row || row.sender !== req.userEmail || row.type !== 'text') return res.status(403).json({ error: 'forbidden' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  db.prepare('UPDATE messages SET text = ?, edited = 1 WHERE id = ?').run(text, row.id);
  const message = messageToJson(getMessage.get(row.id));
  broadcastMessageUpdate(row.chat_id, message);
  res.json(message);
});
app.delete('/api/messages/:id', authMiddleware, (req, res) => {
  const row = getMessage.get(req.params.id);
  if (!row || row.sender !== req.userEmail) return res.status(403).json({ error: 'forbidden' });
  db.prepare("UPDATE messages SET deleted = 1, text = '', attachment = NULL WHERE id = ?").run(row.id);
  const message = messageToJson(getMessage.get(row.id));
  broadcastMessageUpdate(row.chat_id, message);
  res.json(message);
});
app.post('/api/messages/:id/read', authMiddleware, (req, res) => {
  const row = getMessage.get(req.params.id);
  if (!row || !isMember.get(row.chat_id, req.userEmail)) return res.status(403).json({ error: 'forbidden' });
  const readBy = JSON.parse(row.read_by || '[]');
  if (!readBy.includes(req.userEmail)) { readBy.push(req.userEmail); db.prepare('UPDATE messages SET read_by = ? WHERE id = ?').run(JSON.stringify(readBy), row.id); }
  const message = messageToJson(getMessage.get(row.id));
  broadcastMessageUpdate(row.chat_id, message);
  res.json(message);
});
app.post('/api/messages/:id/react', authMiddleware, (req, res) => {
  const row = getMessage.get(req.params.id);
  if (!row || !isMember.get(row.chat_id, req.userEmail)) return res.status(403).json({ error: 'forbidden' });
  const emoji = req.body?.emoji;
  if (!emoji) return res.status(400).json({ error: 'emoji_required' });
  const reactions = JSON.parse(row.reactions || '{}');
  reactions[emoji] = reactions[emoji] || [];
  const index = reactions[emoji].indexOf(req.userEmail);
  if (index === -1) reactions[emoji].push(req.userEmail); else reactions[emoji].splice(index, 1);
  db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), row.id);
  const message = messageToJson(getMessage.get(row.id));
  broadcastMessageUpdate(row.chat_id, message);
  res.json(message);
});
app.post('/api/messages/:id/vote', authMiddleware, (req, res) => {
  const row = getMessage.get(req.params.id);
  if (!row || row.type !== 'poll' || !isMember.get(row.chat_id, req.userEmail)) return res.status(403).json({ error: 'forbidden' });
  const optionIndex = Number(req.body?.optionIndex);
  const poll = JSON.parse(row.poll);
  poll.options.forEach((option, index) => { const at = option.votes.indexOf(req.userEmail); if (at !== -1 && index !== optionIndex) option.votes.splice(at, 1); });
  const target = poll.options[optionIndex];
  const at = target.votes.indexOf(req.userEmail);
  if (at === -1) target.votes.push(req.userEmail); else target.votes.splice(at, 1);
  db.prepare('UPDATE messages SET poll = ? WHERE id = ?').run(JSON.stringify(poll), row.id);
  const message = messageToJson(getMessage.get(row.id));
  broadcastMessageUpdate(row.chat_id, message);
  res.json(message);
});
app.post('/api/messages/:id/pin', authMiddleware, (req, res) => {
  const row = getMessage.get(req.params.id);
  if (!row || !isMember.get(row.chat_id, req.userEmail)) return res.status(403).json({ error: 'forbidden' });
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(row.chat_id);
  const pinnedIds = JSON.parse(chat.pinned_message_ids || '[]');
  const index = pinnedIds.indexOf(row.id);
  if (index === -1) { if (pinnedIds.length >= 3) return res.status(400).json({ error: 'max_pinned' }); pinnedIds.push(row.id); } else pinnedIds.splice(index, 1);
  db.prepare('UPDATE chats SET pinned_message_ids = ? WHERE id = ?').run(JSON.stringify(pinnedIds), chat.id);
  const updated = chatToJson(db.prepare('SELECT * FROM chats WHERE id = ?').get(chat.id));
  getChatMembers.all(chat.id).forEach((m) => io.to(`user:${m.email}`).emit('chat:update', updated));
  res.json(updated);
});

/* ===================== HTTP + SOCKET.IO ===================== */
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });

io.use((socket, next) => {
  try {
    const payload = jwt.verify(socket.handshake.auth?.token || '', JWT_SECRET);
    const user = getUserByEmail.get(payload.email);
    if (!user) throw new Error('no user');
    socket.userEmail = user.email;
    next();
  } catch { next(new Error('unauthorized')); }
});

const socketsPerUser = new Map();
io.on('connection', (socket) => {
  const email = socket.userEmail;
  socket.join(`user:${email}`);
  socketsPerUser.set(email, (socketsPerUser.get(email) || 0) + 1);
  db.prepare('UPDATE users SET online = 1 WHERE email = ?').run(email);
  io.emit('presence', { email, online: true });

  const relayTyping = (chatId, fromEmail, typing) => {
    if (!isMember.get(chatId, fromEmail)) return;
    getChatMembers.all(chatId).filter((m) => m.email !== fromEmail).forEach((m) => io.to(`user:${m.email}`).emit('typing', { chatId, email: fromEmail, typing }));
  };
  socket.on('typing:start', ({ chatId }) => relayTyping(chatId, email, true));
  socket.on('typing:stop', ({ chatId }) => relayTyping(chatId, email, false));

  // WebRTC signaling relay (mesh): forwards offers/answers/ICE candidates between chat members
  socket.on('call:signal', ({ chatId, toEmail, data }) => {
    if (!isMember.get(chatId, email)) return;
    io.to(`user:${toEmail}`).emit('call:signal', { chatId, fromEmail: email, data });
  });
  socket.on('call:invite', ({ chatId, kind }) => {
    if (!isMember.get(chatId, email)) return;
    getChatMembers.all(chatId).filter((m) => m.email !== email).forEach((m) => io.to(`user:${m.email}`).emit('call:invite', { chatId, kind, fromEmail: email, fromName: db.prepare('SELECT name FROM users WHERE email=?').get(email)?.name }));
  });
  socket.on('call:accept', ({ chatId, toEmail }) => io.to(`user:${toEmail}`).emit('call:accept', { chatId, fromEmail: email }));
  socket.on('call:decline', ({ chatId, toEmail }) => io.to(`user:${toEmail}`).emit('call:decline', { chatId, fromEmail: email }));
  socket.on('call:leave', ({ chatId }) => { if (isMember.get(chatId, email)) getChatMembers.all(chatId).filter((m) => m.email !== email).forEach((m) => io.to(`user:${m.email}`).emit('call:peer-left', { chatId, fromEmail: email })); });

  socket.on('disconnect', () => {
    const remaining = (socketsPerUser.get(email) || 1) - 1;
    socketsPerUser.set(email, Math.max(0, remaining));
    if (remaining <= 0) { db.prepare('UPDATE users SET online = 0 WHERE email = ?').run(email); io.emit('presence', { email, online: false }); }
  });
});

httpServer.listen(PORT, () => console.log(`IbraApp server listening on port ${PORT}`));
