(() => {
'use strict';

/* ===================== STORAGE ===================== */
const KEY = {
  users: 'ibraapp_users',
  chats: 'ibraapp_chats',
  messages: 'ibraapp_messages',
  session: 'ibraapp_session',
  theme: 'ibraapp_theme',
};
const load = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = escapeHtml;

let users = load(KEY.users, {});
let chats = load(KEY.chats, {});
let messages = load(KEY.messages, {});
const persistUsers = () => save(KEY.users, users);
const persistChats = () => save(KEY.chats, chats);
const persistMessages = () => save(KEY.messages, messages);

/* ===================== DEMO SEED ===================== */
const DEMO_BOTS = [
  { email: 'sanja@ibra-ba.net', name: 'Sanja M.', color: '#ff7a59', replies: ['Može, javljam se za pola sata.', 'Vidio/la sam, hvala!', 'Ok, dogovoreno 👍', 'Poslaću ti danas fotke sa gradilišta.', 'Provjeriću i javim ti.'] },
  { email: 'marko@ibra-ba.net', name: 'Marko P.', color: '#5b8def', replies: ['Jasno, krećem odmah.', 'Treba mi još malo materijala.', '👍', 'U redu, sutra ujutro sam tamo.', 'Šaljem izvještaj za danas.'] },
  { email: 'ekipa@ibra-ba.net', name: 'Ekipa — gradilište', color: '#9b6bd6', replies: ['Svi smo stigli na gradilište.', 'Kraj smjene, sve po planu.', 'Treba nam odobrenje za nabavku.'] },
];

function seedIfEmpty() {
  if (Object.keys(users).length) return;
  DEMO_BOTS.forEach((bot) => {
    users[bot.email] = { email: bot.email, name: bot.name, avatarColor: bot.color, avatarData: '', statusText: 'Dostupan/na', online: Math.random() > 0.4, showOnline: true, showReadReceipts: true, isBot: true, replies: bot.replies };
  });
  persistUsers();
}
seedIfEmpty();

/* ===================== SESSION / AUTH ===================== */
let session = load(KEY.session, null);
let currentUser = session ? users[session.email] : null;

function colorFor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) hash = (hash * 31 + email.charCodeAt(i)) % 360;
  return `hsl(${hash} 60% 42%)`;
}

function registerUser({ name, email, password, statusText }) {
  const normalized = email.trim().toLowerCase();
  if (users[normalized]) throw new Error('Nalog sa ovim emailom već postoji.');
  users[normalized] = { email: normalized, name: name.trim(), password, avatarColor: colorFor(normalized), avatarData: '', statusText: statusText?.trim() || 'Dostupan/na', online: true, showOnline: true, showReadReceipts: true, isBot: false };
  persistUsers();
  return users[normalized];
}
function loginUser({ email, password }) {
  const normalized = email.trim().toLowerCase();
  const user = users[normalized];
  if (!user || user.isBot || user.password !== password) throw new Error('Pogrešan email ili lozinka.');
  return user;
}
function startSession(user) {
  currentUser = user;
  currentUser.online = true;
  persistUsers();
  session = { email: user.email };
  save(KEY.session, session);
}
function endSession() {
  if (currentUser) { currentUser.online = false; persistUsers(); }
  session = null;
  localStorage.removeItem(KEY.session);
  currentUser = null;
}

/* ===================== DATA HELPERS ===================== */
function userChats(email) {
  return Object.values(chats).filter((chat) => chat.memberEmails.includes(email) && !chat.deletedFor?.includes(email));
}
function chatMessages(chatId) {
  return Object.values(messages).filter((message) => message.chatId === chatId).sort((first, second) => first.createdAt - second.createdAt);
}
function lastMessageOf(chatId) {
  const list = chatMessages(chatId);
  return list[list.length - 1] || null;
}
function unreadCount(chat) {
  return chatMessages(chat.id).filter((message) => message.sender !== currentUser.email && !message.readBy.includes(currentUser.email) && !isExpired(chat, message)).length;
}
function isExpired(chat, message) {
  if (!chat.disappearing) return false;
  return Date.now() > message.createdAt + chat.disappearing * 1000;
}
function otherMember(chat) {
  if (chat.type !== 'direct') return null;
  const otherEmail = chat.memberEmails.find((email) => email !== currentUser.email);
  return users[otherEmail] || { email: otherEmail, name: otherEmail, avatarColor: colorFor(otherEmail) };
}
function chatDisplayName(chat) {
  if (chat.type === 'group') return chat.name;
  return otherMember(chat)?.name || chat.name;
}
function findOrCreateDirectChat(otherEmail) {
  const existing = Object.values(chats).find((chat) => chat.type === 'direct' && chat.memberEmails.includes(currentUser.email) && chat.memberEmails.includes(otherEmail));
  if (existing) { existing.deletedFor = (existing.deletedFor || []).filter((email) => email !== currentUser.email); persistChats(); return existing; }
  const chat = { id: uid(), type: 'direct', name: otherEmail, memberEmails: [currentUser.email, otherEmail], pinned: [], muted: [], archived: [], disappearing: null, wallpaper: '', createdAt: Date.now(), createdBy: currentUser.email, pinnedMessageIds: [] };
  chats[chat.id] = chat;
  persistChats();
  return chat;
}
function createGroupChat(name, memberEmails) {
  const chat = { id: uid(), type: 'group', name, avatarColor: colorFor(name + Date.now()), memberEmails: [currentUser.email, ...memberEmails], admins: [currentUser.email], pinned: [], muted: [], archived: [], disappearing: null, wallpaper: '', createdAt: Date.now(), createdBy: currentUser.email, pinnedMessageIds: [] };
  chats[chat.id] = chat;
  persistChats();
  addSystemMessage(chat.id, `${currentUser.name} je napravio/la grupu "${name}"`);
  return chat;
}
function addSystemMessage(chatId, text) {
  const message = { id: uid(), chatId, sender: 'system', type: 'system', text, createdAt: Date.now(), readBy: [], reactions: {} };
  messages[message.id] = message;
  persistMessages();
}

/* ===================== MESSAGE SENDING ===================== */
function sendMessage(chatId, partial) {
  const chat = chats[chatId];
  const message = {
    id: uid(), chatId, sender: currentUser.email, type: partial.type || 'text', text: partial.text || '', attachment: partial.attachment || null, poll: partial.poll || null,
    replyTo: partial.replyTo || null, reactions: {}, edited: false, deleted: false, createdAt: Date.now(), readBy: [currentUser.email],
  };
  messages[message.id] = message;
  persistMessages();
  renderChatList();
  if (state.activeChatId === chatId) renderMessages(chatId);
  maybeSimulateBotReply(chat);
  return message;
}

let typingTimers = {};
function maybeSimulateBotReply(chat) {
  if (!chat || chat.type !== 'direct') return;
  const other = otherMember(chat);
  if (!other || !other.isBot) return;
  clearTimeout(typingTimers[chat.id]);
  setTimeout(() => {
    if (state.activeChatId === chat.id) showTyping(other.name);
  }, 500);
  typingTimers[chat.id] = setTimeout(() => {
    hideTyping();
    const reply = other.replies[Math.floor(Math.random() * other.replies.length)];
    const message = { id: uid(), chatId: chat.id, sender: other.email, type: 'text', text: reply, replyTo: null, reactions: {}, edited: false, deleted: false, createdAt: Date.now(), readBy: state.activeChatId === chat.id ? [other.email, currentUser.email] : [other.email] };
    messages[message.id] = message;
    persistMessages();
    renderChatList();
    if (state.activeChatId === chat.id) renderMessages(chat.id);
    else notifyToast(`${other.name}: ${reply}`);
  }, 1600 + Math.random() * 1400);
}
function showTyping(name) { els.typingWho.textContent = `${name} kuca...`; els.typingIndicator.hidden = false; els.messages.scrollTop = els.messages.scrollHeight; }
function hideTyping() { els.typingIndicator.hidden = true; }

/* ===================== UI STATE ===================== */
const state = { activeChatId: null, authTab: 'login', chatFilter: 'all', replyTo: null, mediaRecorder: null, mediaChunks: [], recordStart: 0, recordTimer: null, call: null };

const els = {};
function cacheEls() {
  document.querySelectorAll('[id]').forEach((element) => { els[toCamel(element.id)] = element; });
}
function toCamel(value) { return value.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()); }

/* ===================== AUTH SCREEN ===================== */
function initAuth() {
  document.querySelectorAll('.auth-tab').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.toggle('active', t === tab));
    const isLogin = tab.dataset.authTab === 'login';
    els.loginForm.hidden = !isLogin;
    els.registerForm.hidden = isLogin;
  }));
  els.fillDemo?.addEventListener('click', () => {
    els.loginForm.elements.email.value = 'demo@ibra-ba.net';
    els.loginForm.elements.password.value = 'demo1234';
    if (!users['demo@ibra-ba.net']) registerUser({ name: 'Demo Korisnik', email: 'demo@ibra-ba.net', password: 'demo1234', statusText: 'Testiram IbraApp' });
  });
  els.loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    els.loginError.textContent = '';
    const data = Object.fromEntries(new FormData(els.loginForm).entries());
    try { startSession(loginUser(data)); enterApp(); } catch (error) { els.loginError.textContent = error.message; }
  });
  els.registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    els.registerError.textContent = '';
    const data = Object.fromEntries(new FormData(els.registerForm).entries());
    try { startSession(registerUser(data)); enterApp(); } catch (error) { els.registerError.textContent = error.message; }
  });
}

function enterApp() {
  els.authScreen.hidden = true;
  els.appShell.hidden = false;
  renderMe();
  renderChatList();
  applyTheme(load(KEY.theme, 'dark'));
  startPresenceLoop();
}

/* ===================== THEME ===================== */
function applyTheme(theme) { document.documentElement.setAttribute('data-theme', theme); save(KEY.theme, theme); els.toggleTheme.textContent = theme === 'dark' ? '🌙' : '☀️'; }
function initTheme() { els.toggleTheme.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')); }

/* ===================== SIDEBAR ===================== */
function avatarHtml(user, size) {
  const cls = size === 'lg' ? ' avatar-lg' : '';
  if (user?.avatarData) return `<span class="avatar${cls}"><img src="${user.avatarData}" alt="" /></span>`;
  const initials = (user?.name || user?.email || '?').trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const color = user?.avatarColor || colorFor(user?.email || user?.name || '?');
  return `<span class="avatar${cls}" style="background:${color}">${initials}</span>`;
}
function chatAvatarHtml(chat, size) {
  if (chat.type === 'group') { const initials = chat.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase(); return `<span class="avatar${size === 'lg' ? ' avatar-lg' : ''}" style="background:${chat.avatarColor || colorFor(chat.name)}">${initials}</span>`; }
  return avatarHtml(otherMember(chat), size);
}

/** Fills an existing avatar element in place (keeps its id/classes, unlike outerHTML replacement). */
function applyAvatar(element, user) {
  if (!element || !user) return;
  if (user.avatarData) { element.innerHTML = `<img src="${user.avatarData}" alt="" />`; element.style.background = ''; return; }
  const initials = (user.name || user.email || '?').trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  element.textContent = initials;
  element.style.background = user.avatarColor || colorFor(user.email || user.name || '?');
}
function applyChatAvatar(element, chat) {
  if (!element) return;
  if (chat.type === 'group') {
    const initials = chat.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
    element.textContent = initials;
    element.style.background = chat.avatarColor || colorFor(chat.name);
    return;
  }
  applyAvatar(element, otherMember(chat));
}

function renderMe() { applyAvatar(els.meAvatar, currentUser); }

function timeShort(timestamp) { return new Date(timestamp).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' }); }
function dayLabel(timestamp) {
  const date = new Date(timestamp); const today = new Date();
  const isSameDay = (a, b) => a.toDateString() === b.toDateString();
  if (isSameDay(date, today)) return 'Danas';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Juče';
  return date.toLocaleDateString('sr-Latn-RS', { day: '2-digit', month: 'long', year: 'numeric' });
}

function renderChatList() {
  const query = (els.chatSearch.value || '').trim().toLowerCase();
  let list = userChats(currentUser.email);
  list = list.filter((chat) => {
    if (state.chatFilter === 'unread') return unreadCount(chat) > 0;
    if (state.chatFilter === 'groups') return chat.type === 'group';
    if (state.chatFilter === 'pinned') return chat.pinned.includes(currentUser.email);
    if (state.chatFilter === 'archived') return chat.archived.includes(currentUser.email);
    return !chat.archived.includes(currentUser.email);
  });
  if (query) {
    list = list.filter((chat) => {
      if (chatDisplayName(chat).toLowerCase().includes(query)) return true;
      return chatMessages(chat.id).some((message) => (message.text || '').toLowerCase().includes(query));
    });
  }
  list.sort((first, second) => {
    const pinDiff = Number(second.pinned.includes(currentUser.email)) - Number(first.pinned.includes(currentUser.email));
    if (pinDiff) return pinDiff;
    return (lastMessageOf(second.id)?.createdAt || second.createdAt) - (lastMessageOf(first.id)?.createdAt || first.createdAt);
  });

  if (!list.length) { els.chatList.innerHTML = '<div class="chat-empty-state">Nema razgovora u ovoj kategoriji.</div>'; return; }

  els.chatList.innerHTML = list.map((chat) => {
    const last = lastMessageOf(chat.id);
    const unread = unreadCount(chat);
    const other = chat.type === 'direct' ? otherMember(chat) : null;
    const preview = last ? (last.type === 'system' ? last.text : last.deleted ? 'Poruka je obrisana' : last.type === 'image' ? '📷 Slika' : last.type === 'file' ? `📎 ${last.attachment?.name || 'Fajl'}` : last.type === 'voice' ? '🎤 Glasovna poruka' : last.type === 'poll' ? `📊 ${last.poll.question}` : last.type === 'call' ? `${last.call.kind === 'video' ? '🎥' : '📞'} ${last.call.missed ? 'Propušten poziv' : (last.call.kind === 'video' ? 'Video poziv' : 'Audio poziv')}` : last.text) : (chat.type === 'group' ? 'Grupa je napravljena' : 'Započni razgovor');
    const lastPrefix = last && last.sender === currentUser.email ? 'Ti: ' : '';
    const isMuted = chat.muted.includes(currentUser.email);
    return `<div class="chat-row${chat.id === state.activeChatId ? ' active' : ''}" data-chat-id="${chat.id}">
      <span style="position:relative">${chatAvatarHtml(chat)}${other?.showOnline && other?.online ? '<span class="presence-dot"></span>' : ''}</span>
      <div class="chat-row-body">
        <div class="chat-row-top"><strong>${escapeHtml(chatDisplayName(chat))}</strong><small>${last ? timeShort(last.createdAt) : ''}</small></div>
        <div class="chat-row-bottom"><small>${isMuted ? '🔕 ' : ''}${escapeHtml(lastPrefix + preview)}</small>${unread ? `<span class="badge">${unread}</span>` : ''}</div>
      </div>
      ${chat.pinned.includes(currentUser.email) ? '<span class="chat-row-pin">📌</span>' : ''}
    </div>`;
  }).join('');

  els.chatList.querySelectorAll('.chat-row').forEach((row) => row.addEventListener('click', () => openChat(row.dataset.chatId)));
}

/* ===================== CHAT VIEW ===================== */
function openChat(chatId) {
  state.activeChatId = chatId;
  state.replyTo = null;
  els.replyPreview.hidden = true;
  hideTyping();
  els.chatEmpty.hidden = true;
  els.chatActive.hidden = false;
  els.appShell.classList.add('chat-open');
  els.chatInfoPanel.hidden = true;
  els.chatSearchBar.hidden = true;
  const chat = chats[chatId];
  applyChatAvatar(els.chatAvatar, chat);
  els.chatTitle.textContent = chatDisplayName(chat);
  els.chatSubtitle.textContent = chat.type === 'group' ? `${chat.memberEmails.length} članova` : (otherMember(chat)?.showOnline && otherMember(chat)?.online ? 'online' : (otherMember(chat)?.email || ''));
  els.toggleMute.textContent = chat.muted.includes(currentUser.email) ? '🔕' : '🔔';
  chatMessages(chatId).forEach((message) => { if (message.sender !== currentUser.email && !message.readBy.includes(currentUser.email)) message.readBy.push(currentUser.email); });
  persistMessages();
  renderPinnedBar(chat);
  renderMessages(chatId);
  renderChatList();
  els.composerInput.focus();
}
function renderPinnedBar(chat) {
  const pinnedMessages = (chat.pinnedMessageIds || []).map((id) => messages[id]).filter(Boolean);
  if (!pinnedMessages.length) { els.pinnedBar.hidden = true; return; }
  els.pinnedBar.hidden = false;
  els.pinnedBar.innerHTML = pinnedMessages.map((message) => `<span class="pinned-chip" data-goto="${message.id}">📌 ${escapeHtml((message.text || '').slice(0, 40) || 'Prilog')}</span>`).join('');
  els.pinnedBar.querySelectorAll('.pinned-chip').forEach((chip) => chip.addEventListener('click', () => scrollToMessage(chip.dataset.goto)));
}
function scrollToMessage(messageId) {
  const node = document.querySelector(`[data-msg-id="${messageId}"]`);
  if (!node) return;
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  node.style.outline = '2px solid var(--accent-dark)';
  setTimeout(() => { node.style.outline = ''; }, 1200);
}

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];

function renderMessages(chatId, searchTerm) {
  const chat = chats[chatId];
  const list = chatMessages(chatId).filter((message) => !isExpired(chat, message) && (!message.deletedFor || !message.deletedFor.includes(currentUser.email)));
  const filtered = searchTerm ? list.filter((message) => (message.text || '').toLowerCase().includes(searchTerm.toLowerCase())) : list;
  let html = '';
  let lastDay = '';
  filtered.forEach((message) => {
    const day = dayLabel(message.createdAt);
    if (day !== lastDay) { html += `<div class="day-divider">${day}</div>`; lastDay = day; }
    html += renderMessageRow(chat, message);
  });
  els.messages.innerHTML = html || '<div class="chat-empty-state">Još nema poruka. Napiši nešto! 👋</div>';
  wireMessageActions(chat);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderMessageRow(chat, message) {
  if (message.type === 'system') return `<div class="msg-row system"><div class="msg-bubble">${escapeHtml(message.text)}</div></div>`;
  if (message.type === 'call') {
    const mins = Math.floor(message.call.duration / 60);
    const secs = message.call.duration % 60;
    const icon = message.call.kind === 'video' ? '🎥' : '📞';
    const label = message.call.missed ? 'Propušten poziv' : `${message.call.kind === 'video' ? 'Video' : 'Audio'} poziv · ${mins}:${String(secs).padStart(2, '0')}`;
    return `<div class="call-log${message.call.missed ? ' missed' : ''}" data-msg-id="${message.id}"><span>${icon} ${escapeHtml(label)}</span><button type="button" data-call-again="${escapeAttr(chat.id)}" data-call-kind="${message.call.kind}">Pozovi ponovo</button></div>`;
  }
  const out = message.sender === currentUser.email;
  const sender = users[message.sender];
  const showSender = chat.type === 'group' && !out;
  const replyMsg = message.replyTo ? messages[message.replyTo] : null;
  let body = '';
  if (message.deleted) {
    body = `<div class="msg-text deleted">🚫 Poruka je obrisana</div>`;
  } else if (message.type === 'image') {
    body = `<img class="msg-image" src="${message.attachment.url}" alt="${escapeAttr(message.attachment.name)}" data-lightbox="${message.attachment.url}" />${message.text ? `<div class="msg-text">${escapeHtml(message.text)}</div>` : ''}`;
  } else if (message.type === 'file') {
    body = `<div class="msg-file"><span class="msg-file-icon">📄</span><div><strong>${escapeHtml(message.attachment.name)}</strong><br/><small>${(message.attachment.size / 1024).toFixed(0)} KB</small></div></div>`;
  } else if (message.type === 'voice') {
    body = `<div class="msg-voice">🎤 <audio controls src="${message.attachment.url}"></audio></div>`;
  } else if (message.type === 'poll') {
    const totalVotes = message.poll.options.reduce((sum, option) => sum + option.votes.length, 0) || 1;
    body = `<div class="msg-poll"><strong>📊 ${escapeHtml(message.poll.question)}</strong>${message.poll.options.map((option, index) => { const pct = Math.round((option.votes.length / totalVotes) * 100); const voted = option.votes.includes(currentUser.email); return `<div class="poll-option${voted ? ' voted' : ''}" data-poll-msg="${message.id}" data-poll-option="${index}"><span class="poll-option-fill" style="width:${pct}%"></span><span>${escapeHtml(option.text)}</span><span>${option.votes.length} (${pct}%)</span></div>`; }).join('')}</div>`;
  } else {
    body = `<div class="msg-text">${escapeHtml(message.text)}${message.edited ? ' <small style="opacity:.6">(izmijenjeno)</small>' : ''}</div>`;
  }
  const reactions = Object.entries(message.reactions || {}).filter(([, emails]) => emails.length);
  const reactionsHtml = reactions.length ? `<div class="msg-reactions">${reactions.map(([emoji, emails]) => `<span class="reaction-pill">${emoji} ${emails.length}</span>`).join('')}</div>` : '';
  const ticks = out ? (chat.type === 'direct' ? (otherMember(chat)?.showReadReceipts !== false && message.readBy.includes(otherMember(chat)?.email) ? '<span class="ticks read">✓✓</span>' : '<span class="ticks">✓✓</span>') : `<span class="ticks${message.readBy.length > 1 ? ' read' : ''}">✓✓</span>`) : '';
  return `<div class="msg-row${out ? ' out' : ''}" data-msg-id="${message.id}">
    <div class="msg-bubble">
      <div class="reaction-quickbar">${QUICK_REACTIONS.map((emoji) => `<button type="button" data-react="${emoji}">${emoji}</button>`).join('')}</div>
      ${showSender ? `<span class="msg-sender">${escapeHtml(sender?.name || message.sender)}</span>` : ''}
      ${replyMsg ? `<div class="msg-reply-ref" data-goto="${replyMsg.id}"><strong>${escapeHtml(replyMsg.sender === currentUser.email ? 'Ti' : users[replyMsg.sender]?.name || replyMsg.sender)}</strong>${escapeHtml((replyMsg.text || (replyMsg.type === 'image' ? '📷 Slika' : replyMsg.type === 'voice' ? '🎤 Glasovna poruka' : 'Prilog')).slice(0, 60))}</div>` : ''}
      ${body}
      ${reactionsHtml}
      <div class="msg-meta"><span>${timeShort(message.createdAt)}</span>${ticks}</div>
    </div>
    ${!message.deleted ? `<div class="msg-actions">
      <button type="button" class="icon-btn" data-action="react" title="Reaguj">😊</button>
      <button type="button" class="icon-btn" data-action="reply" title="Odgovori">↩️</button>
      ${out && message.type === 'text' ? '<button type="button" class="icon-btn" data-action="edit" title="Izmijeni">✏️</button>' : ''}
      <button type="button" class="icon-btn" data-action="pin" title="Zakači">📌</button>
      <button type="button" class="icon-btn" data-action="info" title="Info">ℹ️</button>
      ${out ? '<button type="button" class="icon-btn" data-action="delete" title="Obriši">🗑️</button>' : ''}
    </div>` : ''}
  </div>`;
}

function wireMessageActions(chat) {
  els.messages.querySelectorAll('.msg-image').forEach((img) => img.addEventListener('click', () => openLightbox(img.dataset.lightbox)));
  els.messages.querySelectorAll('.msg-reply-ref').forEach((ref) => ref.addEventListener('click', () => scrollToMessage(ref.dataset.goto)));
  els.messages.querySelectorAll('.poll-option').forEach((option) => option.addEventListener('click', () => votePoll(option.dataset.pollMsg, Number(option.dataset.pollOption))));
  els.messages.querySelectorAll('[data-call-again]').forEach((button) => button.addEventListener('click', () => startCall(button.dataset.callAgain, button.dataset.callKind)));
  els.messages.querySelectorAll('.msg-row').forEach((row) => {
    const messageId = row.dataset.msgId;
    row.querySelector('[data-action="react"]')?.addEventListener('click', () => row.querySelector('.reaction-quickbar').classList.toggle('show'));
    row.querySelectorAll('[data-react]').forEach((button) => button.addEventListener('click', () => toggleReaction(messageId, button.dataset.react)));
    row.querySelector('[data-action="reply"]')?.addEventListener('click', () => setReplyTo(messageId));
    row.querySelector('[data-action="edit"]')?.addEventListener('click', () => editMessage(messageId));
    row.querySelector('[data-action="pin"]')?.addEventListener('click', () => togglePinMessage(chat.id, messageId));
    row.querySelector('[data-action="info"]')?.addEventListener('click', () => showMessageInfo(chat, messageId));
    row.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteMessage(messageId));
  });
}

function toggleReaction(messageId, emoji) {
  const message = messages[messageId];
  message.reactions[emoji] = message.reactions[emoji] || [];
  const index = message.reactions[emoji].indexOf(currentUser.email);
  if (index === -1) message.reactions[emoji].push(currentUser.email); else message.reactions[emoji].splice(index, 1);
  persistMessages();
  renderMessages(state.activeChatId);
}
function votePoll(messageId, optionIndex) {
  const message = messages[messageId];
  message.poll.options.forEach((option, index) => { const at = option.votes.indexOf(currentUser.email); if (at !== -1 && index !== optionIndex) option.votes.splice(at, 1); });
  const target = message.poll.options[optionIndex];
  const at = target.votes.indexOf(currentUser.email);
  if (at === -1) target.votes.push(currentUser.email); else target.votes.splice(at, 1);
  persistMessages();
  renderMessages(state.activeChatId);
}
function setReplyTo(messageId) {
  state.replyTo = messageId;
  const message = messages[messageId];
  els.replyPreviewName.textContent = message.sender === currentUser.email ? 'Ti' : (users[message.sender]?.name || message.sender);
  els.replyPreviewText.textContent = (message.text || (message.type === 'image' ? '📷 Slika' : message.type === 'voice' ? '🎤 Glasovna poruka' : 'Prilog')).slice(0, 80);
  els.replyPreview.hidden = false;
  els.composerInput.focus();
}
function editMessage(messageId) {
  const message = messages[messageId];
  const next = window.prompt('Izmijeni poruku:', message.text);
  if (next === null || !next.trim() || next === message.text) return;
  message.text = next.trim();
  message.edited = true;
  persistMessages();
  renderMessages(state.activeChatId);
  renderChatList();
}
function deleteMessage(messageId) {
  if (!window.confirm('Obrisati ovu poruku za sve?')) return;
  const message = messages[messageId];
  message.deleted = true;
  message.text = '';
  message.attachment = null;
  persistMessages();
  renderMessages(state.activeChatId);
  renderChatList();
}
function togglePinMessage(chatId, messageId) {
  const chat = chats[chatId];
  chat.pinnedMessageIds = chat.pinnedMessageIds || [];
  const index = chat.pinnedMessageIds.indexOf(messageId);
  if (index === -1) { if (chat.pinnedMessageIds.length >= 3) { notifyToast('Najviše 3 zakačene poruke po razgovoru.'); return; } chat.pinnedMessageIds.push(messageId); } else chat.pinnedMessageIds.splice(index, 1);
  persistChats();
  renderPinnedBar(chat);
}
function showMessageInfo(chat, messageId) {
  const message = messages[messageId];
  const readers = message.readBy.filter((email) => email !== message.sender);
  els.msgInfoBody.innerHTML = `<p><strong>Poslato:</strong> ${new Date(message.createdAt).toLocaleString('sr-Latn-RS')}</p>
    <p><strong>Pročitano od:</strong></p>
    ${readers.length ? readers.map((email) => `<div class="member-row">${avatarHtml(users[email] || { email })}<div><strong>${escapeHtml(users[email]?.name || email)}</strong></div></div>`).join('') : '<p style="color:var(--muted)">Još niko nije pročitao.</p>'}`;
  openModal(els.msgInfoModal);
}

function openLightbox(url) { els.lightboxImg.src = url; els.lightbox.hidden = false; }

/* ===================== COMPOSER ===================== */
function initComposer() {
  els.composer.addEventListener('submit', (event) => { event.preventDefault(); submitTextMessage(); });
  els.composerInput.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitTextMessage(); } });
  els.composerInput.addEventListener('input', () => { els.composerInput.style.height = 'auto'; els.composerInput.style.height = `${Math.min(els.composerInput.scrollHeight, 120)}px`; });
  els.cancelReply.addEventListener('click', () => { state.replyTo = null; els.replyPreview.hidden = true; });

  els.attachBtn.addEventListener('click', () => els.attachInput.click());
  els.attachInput.addEventListener('change', () => { handleAttachments([...els.attachInput.files]); els.attachInput.value = ''; });

  els.emojiBtn.addEventListener('click', () => { buildEmojiPicker(); els.emojiPicker.hidden = !els.emojiPicker.hidden; });
  els.pollBtn.addEventListener('click', openPollModal);

  els.voiceBtn.addEventListener('click', toggleRecording);
  els.cancelRecording.addEventListener('click', cancelRecording);
  els.stopRecording.addEventListener('click', stopRecordingAndSend);
}

function submitTextMessage() {
  if (!state.activeChatId) return;
  const text = els.composerInput.value.trim();
  if (!text) return;
  sendMessage(state.activeChatId, { type: 'text', text, replyTo: state.replyTo });
  els.composerInput.value = '';
  els.composerInput.style.height = 'auto';
  state.replyTo = null;
  els.replyPreview.hidden = true;
}

function handleAttachments(files) {
  if (!state.activeChatId || !files.length) return;
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const isImage = file.type.startsWith('image/');
      sendMessage(state.activeChatId, { type: isImage ? 'image' : 'file', attachment: { name: file.name, url: reader.result, size: file.size, mime: file.type } });
    };
    reader.readAsDataURL(file);
  });
}

const EMOJIS = ['😀','😂','🥰','😎','😢','😮','😡','👍','👎','🙏','👏','🔥','🎉','❤️','💪','✅','⚠️','📌','📷','📎','🎤','⏰','☕','🏗️','🔧','📋','🚗','✈️','🌧️','☀️','🌙','💯'];
function buildEmojiPicker() {
  if (els.emojiPicker.childElementCount) return;
  els.emojiPicker.innerHTML = EMOJIS.map((emoji) => `<button type="button">${emoji}</button>`).join('');
  els.emojiPicker.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    els.composerInput.value += button.textContent;
    els.composerInput.focus();
    els.emojiPicker.hidden = true;
  }));
}

/* ---- voice recording ---- */
async function toggleRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state === 'recording') { stopRecordingAndSend(); return; }
  if (!navigator.mediaDevices?.getUserMedia) { notifyToast('Snimanje zvuka nije podržano u ovom browseru.'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaChunks = [];
    state.mediaRecorder = new MediaRecorder(stream);
    state.mediaRecorder.ondataavailable = (event) => state.mediaChunks.push(event.data);
    state.mediaRecorder.start();
    state.recordStart = Date.now();
    els.recordingBar.hidden = false;
    els.voiceBtn.classList.add('active');
    state.recordTimer = setInterval(() => {
      const seconds = Math.floor((Date.now() - state.recordStart) / 1000);
      els.recordingTime.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }, 250);
  } catch { notifyToast('Dozvola za mikrofon nije data.'); }
}
function stopRecordingCommon() {
  clearInterval(state.recordTimer);
  els.recordingBar.hidden = true;
  els.voiceBtn.classList.remove('active');
  state.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
}
function cancelRecording() {
  if (!state.mediaRecorder) return;
  state.mediaRecorder.onstop = null;
  state.mediaRecorder.stop();
  stopRecordingCommon();
  state.mediaRecorder = null;
}
function stopRecordingAndSend() {
  if (!state.mediaRecorder) return;
  state.mediaRecorder.onstop = () => {
    const blob = new Blob(state.mediaChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onload = () => sendMessage(state.activeChatId, { type: 'voice', attachment: { url: reader.result, name: 'Glasovna poruka' } });
    reader.readAsDataURL(blob);
  };
  state.mediaRecorder.stop();
  stopRecordingCommon();
  state.mediaRecorder = null;
}

/* ---- polls ---- */
function openPollModal() {
  if (!state.activeChatId) return;
  els.pollQuestion.value = '';
  els.pollOptionsList.innerHTML = '';
  [1, 2].forEach(() => addPollOptionInput());
  openModal(els.pollModal);
}
function addPollOptionInput() {
  const wrapper = document.createElement('input');
  wrapper.type = 'text';
  wrapper.placeholder = `Opcija ${els.pollOptionsList.children.length + 1}`;
  wrapper.maxLength = 60;
  els.pollOptionsList.appendChild(wrapper);
}
function initPoll() {
  els.pollAddOption.addEventListener('click', addPollOptionInput);
  els.pollCreateBtn.addEventListener('click', () => {
    const question = els.pollQuestion.value.trim();
    const options = [...els.pollOptionsList.querySelectorAll('input')].map((input) => input.value.trim()).filter(Boolean);
    if (!question || options.length < 2) { notifyToast('Unesi pitanje i bar 2 opcije.'); return; }
    sendMessage(state.activeChatId, { type: 'poll', poll: { question, options: options.map((text) => ({ text, votes: [] })) } });
    closeModals();
  });
}

/* ===================== NEW CHAT / GROUP ===================== */
function initNewChat() {
  els.openNewChat.addEventListener('click', () => { renderDemoContactList(); els.newChatEmail.value = ''; openModal(els.newChatModal); });
  els.newChatStart.addEventListener('click', () => {
    const email = els.newChatEmail.value.trim().toLowerCase();
    if (!email || !email.includes('@')) { notifyToast('Unesi validan email.'); return; }
    if (email === currentUser.email) { notifyToast('To si ti 🙂'); return; }
    const chat = findOrCreateDirectChat(email);
    closeModals();
    renderChatList();
    openChat(chat.id);
    if (!users[email]) notifyToast('Ovaj email još nije registrovan u IbraApp — razgovor je spreman, poruke čekaju da se pridruži.');
  });
}
function knownContacts() {
  const chatContacts = userChats(currentUser.email).filter((chat) => chat.type === 'direct').map((chat) => otherMember(chat)).filter(Boolean);
  const byEmail = new Map();
  [...Object.values(users).filter((user) => user.email !== currentUser.email), ...chatContacts].forEach((user) => byEmail.set(user.email, user));
  return [...byEmail.values()];
}
function renderDemoContactList() {
  const list = knownContacts();
  els.demoContactList.innerHTML = list.map((user) => `<div class="contact-row" data-email="${escapeAttr(user.email)}">${avatarHtml(user)}<div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></div></div>`).join('') || '<p style="color:var(--muted);font-size:.85rem">Nema još kontakata.</p>';
  els.demoContactList.querySelectorAll('.contact-row').forEach((row) => row.addEventListener('click', () => { els.newChatEmail.value = row.dataset.email; els.newChatStart.click(); }));
}

function initNewGroup() {
  els.openNewGroup.addEventListener('click', () => { els.groupNameInput.value = ''; renderGroupMemberPicker(); openModal(els.newGroupModal); });
  els.createGroupBtn.addEventListener('click', () => {
    const name = els.groupNameInput.value.trim();
    const selected = [...els.groupMemberList.querySelectorAll('.contact-row.selected')].map((row) => row.dataset.email);
    if (!name) { notifyToast('Unesi naziv grupe.'); return; }
    if (selected.length < 1) { notifyToast('Izaberi bar jednog člana.'); return; }
    const chat = createGroupChat(name, selected);
    closeModals();
    renderChatList();
    openChat(chat.id);
  });
}
function renderGroupMemberPicker() {
  const list = knownContacts();
  els.groupMemberList.innerHTML = list.map((user) => `<div class="contact-row" data-email="${escapeAttr(user.email)}">${avatarHtml(user)}<div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></div></div>`).join('') || '<p style="color:var(--muted);font-size:.85rem">Nema još kontakata — prvo započni 1-na-1 razgovor.</p>';
  els.groupMemberList.querySelectorAll('.contact-row').forEach((row) => row.addEventListener('click', () => row.classList.toggle('selected')));
}

/* ===================== CHAT INFO PANEL ===================== */
function initChatInfo() {
  els.openChatInfo.addEventListener('click', () => toggleInfoPanel());
  els.openChatInfoBtn.addEventListener('click', () => toggleInfoPanel());
  els.closeChatInfo.addEventListener('click', () => { els.chatInfoPanel.hidden = true; });
  els.toggleMute.addEventListener('click', () => {
    const chat = chats[state.activeChatId];
    const index = chat.muted.indexOf(currentUser.email);
    if (index === -1) chat.muted.push(currentUser.email); else chat.muted.splice(index, 1);
    persistChats();
    els.toggleMute.textContent = chat.muted.includes(currentUser.email) ? '🔕' : '🔔';
    renderChatList();
  });
  els.chatBack.addEventListener('click', () => { els.appShell.classList.remove('chat-open'); });
  els.openChatSearch.addEventListener('click', () => { els.chatSearchBar.hidden = !els.chatSearchBar.hidden; if (!els.chatSearchBar.hidden) els.inChatSearch.focus(); else renderMessages(state.activeChatId); });
  els.closeChatSearch.addEventListener('click', () => { els.chatSearchBar.hidden = true; els.inChatSearch.value = ''; renderMessages(state.activeChatId); });
  els.inChatSearch.addEventListener('input', () => renderMessages(state.activeChatId, els.inChatSearch.value));
}
function toggleInfoPanel() {
  if (!els.chatInfoPanel.hidden) { els.chatInfoPanel.hidden = true; return; }
  renderChatInfoPanel();
  els.chatInfoPanel.hidden = false;
}
function renderChatInfoPanel() {
  const chat = chats[state.activeChatId];
  const isPinned = chat.pinned.includes(currentUser.email);
  const isArchived = chat.archived.includes(currentUser.email);
  const media = chatMessages(chat.id).filter((message) => message.type === 'image' && !message.deleted);
  let html = `${chatAvatarHtml(chat, 'lg')}<h3 style="text-align:center">${escapeHtml(chatDisplayName(chat))}</h3>`;
  if (chat.type === 'direct') { const other = otherMember(chat); html += `<p class="center">${escapeHtml(other?.email || '')}${other?.statusText ? ` · ${escapeHtml(other.statusText)}` : ''}</p>`; }
  else html += `<p class="center">Grupa · ${chat.memberEmails.length} članova</p>`;

  html += `<div class="info-section"><h4>Postavke</h4>
    <div class="info-row"><span>📌 Zakači razgovor</span><input type="checkbox" id="cfg-pin" ${isPinned ? 'checked' : ''} /></div>
    <div class="info-row"><span>🗄️ Arhiviraj</span><input type="checkbox" id="cfg-archive" ${isArchived ? 'checked' : ''} /></div>
    <div class="info-row"><span>⏳ Nestajuće poruke</span><select id="cfg-disappear">
      <option value="">Isključeno</option>
      <option value="86400" ${chat.disappearing === 86400 ? 'selected' : ''}>24 sata</option>
      <option value="604800" ${chat.disappearing === 604800 ? 'selected' : ''}>7 dana</option>
      <option value="90" ${chat.disappearing === 90 ? 'selected' : ''}>90 sekundi (test)</option>
    </select></div>
  </div>`;

  if (chat.type === 'group') {
    html += `<div class="info-section"><h4>Članovi</h4>${chat.memberEmails.map((email) => { const user = users[email] || { email, name: email }; const isAdmin = chat.admins.includes(email); const canRemove = chat.admins.includes(currentUser.email) && email !== currentUser.email; return `<div class="member-row">${avatarHtml(user)}<div style="flex:1"><strong>${escapeHtml(user.name)}${isAdmin ? ' · admin' : ''}</strong><small>${escapeHtml(email)}</small></div>${canRemove ? `<button type="button" class="icon-btn" data-remove-member="${escapeAttr(email)}" title="Ukloni">✕</button>` : ''}</div>`; }).join('')}</div>`;
  }

  if (media.length) html += `<div class="info-section"><h4>Deljeni mediji</h4><div class="media-grid">${media.slice(-9).reverse().map((message) => `<img src="${message.attachment.url}" data-lightbox-thumb="${message.attachment.url}" />`).join('')}</div></div>`;

  html += `<div class="info-section">
    ${chat.type === 'group' && chat.admins.includes(currentUser.email) === false ? `<div class="info-row danger" id="leave-group"><span>🚪 Napusti grupu</span></div>` : ''}
    <div class="info-row danger" id="delete-chat"><span>🗑️ Obriši razgovor (samo za tebe)</span></div>
  </div>`;

  els.chatInfoBody.innerHTML = html;

  document.getElementById('cfg-pin').addEventListener('change', (event) => { toggleArrayMembership(chat.pinned, currentUser.email, event.target.checked); persistChats(); renderChatList(); });
  document.getElementById('cfg-archive').addEventListener('change', (event) => { toggleArrayMembership(chat.archived, currentUser.email, event.target.checked); persistChats(); renderChatList(); });
  document.getElementById('cfg-disappear').addEventListener('change', (event) => { chat.disappearing = event.target.value ? Number(event.target.value) : null; persistChats(); notifyToast(chat.disappearing ? 'Nestajuće poruke uključene.' : 'Nestajuće poruke isključene.'); });
  document.getElementById('delete-chat').addEventListener('click', () => { if (!window.confirm('Obrisati ovaj razgovor za tebe?')) return; chat.deletedFor = chat.deletedFor || []; chat.deletedFor.push(currentUser.email); persistChats(); els.chatInfoPanel.hidden = true; els.chatActive.hidden = true; els.chatEmpty.hidden = false; state.activeChatId = null; renderChatList(); });
  document.getElementById('leave-group')?.addEventListener('click', () => { chat.memberEmails = chat.memberEmails.filter((email) => email !== currentUser.email); addSystemMessage(chat.id, `${currentUser.name} je napustio/la grupu`); persistChats(); els.chatInfoPanel.hidden = true; els.chatActive.hidden = true; els.chatEmpty.hidden = false; state.activeChatId = null; renderChatList(); });
  els.chatInfoBody.querySelectorAll('[data-remove-member]').forEach((button) => button.addEventListener('click', () => { const email = button.dataset.removeMember; chat.memberEmails = chat.memberEmails.filter((item) => item !== email); addSystemMessage(chat.id, `${users[email]?.name || email} je uklonjen/a iz grupe`); persistChats(); renderChatInfoPanel(); }));
  els.chatInfoBody.querySelectorAll('[data-lightbox-thumb]').forEach((img) => img.addEventListener('click', () => openLightbox(img.dataset.lightboxThumb)));
}
function toggleArrayMembership(array, value, shouldContain) {
  const index = array.indexOf(value);
  if (shouldContain && index === -1) array.push(value);
  if (!shouldContain && index !== -1) array.splice(index, 1);
}

/* ===================== SETTINGS ===================== */
function initSettings() {
  els.openSettings.addEventListener('click', () => {
    applyAvatar(els.settingsAvatar, currentUser);
    delete els.settingsAvatar.dataset.pending;
    els.settingsName.value = currentUser.name;
    els.settingsStatus.value = currentUser.statusText || '';
    els.settingsEmail.value = currentUser.email;
    els.settingsReadReceipts.checked = currentUser.showReadReceipts !== false;
    els.settingsOnlineStatus.checked = currentUser.showOnline !== false;
    openModal(els.settingsModal);
  });
  els.avatarInput.addEventListener('change', () => {
    const file = els.avatarInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { els.settingsAvatar.innerHTML = `<img src="${reader.result}" alt="" />`; els.settingsAvatar.dataset.pending = reader.result; };
    reader.readAsDataURL(file);
  });
  els.saveSettings.addEventListener('click', () => {
    currentUser.name = els.settingsName.value.trim() || currentUser.name;
    currentUser.statusText = els.settingsStatus.value.trim();
    currentUser.showReadReceipts = els.settingsReadReceipts.checked;
    currentUser.showOnline = els.settingsOnlineStatus.checked;
    if (els.settingsAvatar.dataset.pending) currentUser.avatarData = els.settingsAvatar.dataset.pending;
    persistUsers();
    renderMe();
    renderChatList();
    closeModals();
    notifyToast('Podešavanja su sačuvana.');
  });
  els.logoutBtn.addEventListener('click', () => {
    if (!window.confirm('Odjaviti se?')) return;
    endSession();
    location.reload();
  });
}

/* ===================== MODALS ===================== */
function openModal(modal) { closeModals(); els.modalBackdrop.hidden = false; modal.hidden = false; }
function closeModals() { els.modalBackdrop.hidden = true; document.querySelectorAll('.modal').forEach((modal) => { modal.hidden = true; }); }
function initModals() {
  els.modalBackdrop.addEventListener('click', closeModals);
  document.querySelectorAll('.close-modal').forEach((button) => button.addEventListener('click', closeModals));
  els.closeLightbox.addEventListener('click', () => { els.lightbox.hidden = true; });
  els.lightbox.addEventListener('click', (event) => { if (event.target === els.lightbox) els.lightbox.hidden = true; });
}

/* ===================== MISC ===================== */
function notifyToast(text) { els.toast.textContent = text; els.toast.classList.add('show'); clearTimeout(notifyToast._t); notifyToast._t = setTimeout(() => els.toast.classList.remove('show'), 3200); }

function initFilters() {
  document.querySelectorAll('.filter-chip').forEach((chip) => chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach((c) => c.classList.toggle('active', c === chip));
    state.chatFilter = chip.dataset.filter;
    renderChatList();
  }));
  els.chatSearch.addEventListener('input', renderChatList);
}

function startPresenceLoop() {
  setInterval(() => {
    let changed = false;
    Object.values(users).forEach((user) => { if (user.isBot && Math.random() < 0.15) { user.online = !user.online; changed = true; } });
    if (changed) { persistUsers(); renderChatList(); if (state.activeChatId) { const chat = chats[state.activeChatId]; if (chat?.type === 'direct') els.chatSubtitle.textContent = otherMember(chat)?.showOnline && otherMember(chat)?.online ? 'online' : (otherMember(chat)?.email || ''); } }
    if (state.activeChatId) renderMessages(state.activeChatId, els.inChatSearch?.value || '');
  }, 12000);
}

/* ===================== CALLS ===================== */
function addCallLogMessage(chatId, { kind, duration, missed }) {
  const message = { id: uid(), chatId, sender: currentUser.email, type: 'call', call: { kind, duration, missed }, createdAt: Date.now(), readBy: [currentUser.email], reactions: {} };
  messages[message.id] = message;
  persistMessages();
  renderChatList();
  if (state.activeChatId === chatId) renderMessages(chatId);
}

function buildCallTiles() {
  const call = state.call;
  els.callVideoGrid.innerHTML = '';
  els.callVideoGrid.className = `call-video-grid count-${call.order.length}`;
  call.order.forEach((email) => {
    const participant = call.participants.get(email);
    const isLocal = email === currentUser.email;
    const tile = document.createElement('div');
    tile.className = `call-tile${isLocal ? ' local' : ''}`;
    tile.dataset.email = email;
    const video = document.createElement('video');
    video.autoplay = true; video.playsInline = true; video.hidden = true;
    if (isLocal) { video.muted = true; video.classList.add('mirrored'); }
    const avatar = document.createElement('div');
    avatar.className = 'call-tile-avatar';
    applyAvatar(avatar, users[email] || { email, name: email });
    const label = document.createElement('div');
    label.className = 'call-tile-label';
    const status = document.createElement('div');
    status.className = 'call-tile-status';
    tile.append(video, avatar, label, status);
    els.callVideoGrid.appendChild(tile);
    participant.els = { tile, video, avatar, label, status };
  });
  updateCallTilesUI();
}
function updateCallTilesUI() {
  const call = state.call;
  if (!call) return;
  call.order.forEach((email) => {
    const participant = call.participants.get(email);
    const user = users[email] || { email, name: email };
    const isLocal = email === currentUser.email;
    participant.els.label.textContent = `${isLocal ? 'Ti' : (user.name || email)}${participant.micOn === false ? ' 🔇' : ''}`;
    participant.els.status.textContent = 'Zove se...';
    participant.els.status.hidden = participant.connected;
    const showVideo = call.kind === 'video' && participant.connected && participant.camOn && participant.stream;
    participant.els.video.hidden = !showVideo;
    participant.els.avatar.hidden = showVideo;
    if (showVideo && participant.els.video.srcObject !== participant.stream) participant.els.video.srcObject = participant.stream;
    if (!showVideo) participant.els.video.srcObject = null;
  });
}
function updateCallControlButtons() {
  const participant = state.call.participants.get(currentUser.email);
  els.callToggleMic.classList.toggle('off', !participant.micOn);
  els.callToggleCam.classList.toggle('off', !participant.camOn);
  els.callToggleShare.classList.toggle('active-share', state.call.sharing);
}
function activateCall() {
  if (!state.call || state.call.status === 'active') return;
  state.call.status = 'active';
  els.callStatusText.textContent = '00:00';
  state.call.timerInterval = setInterval(() => {
    const seconds = Math.floor((Date.now() - state.call.startedAt) / 1000);
    els.callStatusText.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }, 1000);
}
async function startCall(chatId, kind) {
  if (state.call) { notifyToast('Već si na pozivu.'); return; }
  const chat = chats[chatId];
  if (!chat) return;
  const otherEmails = chat.memberEmails.filter((email) => email !== currentUser.email);
  if (!otherEmails.length) { notifyToast('Nema drugih članova za poziv.'); return; }
  let localStream;
  try { localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' }); }
  catch { notifyToast('Nije moguće pristupiti mikrofonu/kameri (provjeri dozvole browsera).'); return; }

  const order = [currentUser.email, ...otherEmails];
  const participants = new Map();
  order.forEach((email) => participants.set(email, { stream: email === currentUser.email ? localStream : null, connected: email === currentUser.email, micOn: true, camOn: kind === 'video' }));
  state.call = { chatId, kind, status: 'ringing', startedAt: Date.now(), order, participants, localStream, screenStream: null, sharing: false, timerInterval: null };

  els.callTitleName.textContent = chatDisplayName(chat);
  els.callStatusText.textContent = 'Pozivanje...';
  els.callReactionBar.classList.add('hidden');
  els.callChatPanel.hidden = true;
  els.callChatMessages.innerHTML = '';
  els.callScreen.hidden = false;
  buildCallTiles();
  updateCallControlButtons();

  otherEmails.forEach((email) => {
    setTimeout(() => {
      if (!state.call || state.call.chatId !== chatId) return;
      const participant = state.call.participants.get(email);
      if (!participant) return;
      participant.connected = true;
      updateCallTilesUI();
      if (state.call.order.every((item) => state.call.participants.get(item).connected)) activateCall();
    }, 900 + Math.random() * 1800);
  });
}
function endCall() {
  if (!state.call) return;
  const call = state.call;
  const wasActive = call.status === 'active';
  const duration = wasActive ? Math.floor((Date.now() - call.startedAt) / 1000) : 0;
  call.localStream?.getTracks().forEach((track) => track.stop());
  call.screenStream?.getTracks().forEach((track) => track.stop());
  clearInterval(call.timerInterval);
  els.callScreen.hidden = true;
  els.callVideoGrid.innerHTML = '';
  addCallLogMessage(call.chatId, { kind: call.kind, duration, missed: !wasActive });
  state.call = null;
}
function toggleMic() {
  if (!state.call) return;
  const participant = state.call.participants.get(currentUser.email);
  participant.micOn = !participant.micOn;
  state.call.localStream.getAudioTracks().forEach((track) => { track.enabled = participant.micOn; });
  updateCallTilesUI();
  updateCallControlButtons();
}
function toggleCam() {
  if (!state.call) return;
  if (state.call.kind !== 'video') { notifyToast('Kamera nije dostupna u audio pozivu.'); return; }
  const participant = state.call.participants.get(currentUser.email);
  participant.camOn = !participant.camOn;
  state.call.localStream.getVideoTracks().forEach((track) => { track.enabled = participant.camOn; });
  updateCallTilesUI();
  updateCallControlButtons();
}
async function toggleScreenShare() {
  if (!state.call) return;
  const call = state.call;
  const localParticipant = call.participants.get(currentUser.email);
  if (call.sharing) {
    call.screenStream?.getTracks().forEach((track) => track.stop());
    call.screenStream = null;
    call.sharing = false;
    localParticipant.stream = call.localStream;
    updateCallTilesUI();
    updateCallControlButtons();
    return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia) { notifyToast('Dijeljenje ekrana nije podržano u ovom browseru.'); return; }
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    call.screenStream = screenStream;
    call.sharing = true;
    localParticipant.stream = screenStream;
    localParticipant.camOn = true;
    screenStream.getVideoTracks()[0].addEventListener('ended', () => { if (state.call === call && call.sharing) toggleScreenShare(); });
    updateCallTilesUI();
    updateCallControlButtons();
  } catch { /* user cancelled the screen picker */ }
}
function sendCallReaction(emoji) {
  const span = document.createElement('span');
  span.className = 'call-reaction-float';
  span.textContent = emoji;
  span.style.left = `${20 + Math.random() * 60}%`;
  els.callReactionsLayer.appendChild(span);
  setTimeout(() => span.remove(), 2500);
  els.callReactionBar.classList.add('hidden');
}
function appendCallChatBubble(user, text, out) {
  const bubble = document.createElement('div');
  bubble.className = `call-chat-msg${out ? ' out' : ''}`;
  bubble.innerHTML = `<strong>${escapeHtml(out ? 'Ti' : user.name)}</strong>${escapeHtml(text)}`;
  els.callChatMessages.appendChild(bubble);
  els.callChatMessages.scrollTop = els.callChatMessages.scrollHeight;
}
function initCalls() {
  els.startAudioCall.addEventListener('click', () => state.activeChatId && startCall(state.activeChatId, 'audio'));
  els.startVideoCall.addEventListener('click', () => state.activeChatId && startCall(state.activeChatId, 'video'));
  els.callEnd.addEventListener('click', endCall);
  els.callToggleMic.addEventListener('click', toggleMic);
  els.callToggleCam.addEventListener('click', toggleCam);
  els.callToggleShare.addEventListener('click', toggleScreenShare);
  els.callToggleReactions.addEventListener('click', () => els.callReactionBar.classList.toggle('hidden'));
  els.callReactionBar.querySelectorAll('[data-call-react]').forEach((button) => button.addEventListener('click', () => sendCallReaction(button.dataset.callReact)));
  els.toggleCallChat.addEventListener('click', () => { els.callChatPanel.hidden = !els.callChatPanel.hidden; });
  els.closeCallChat.addEventListener('click', () => { els.callChatPanel.hidden = true; });
  els.callChatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = els.callChatInput.value.trim();
    if (!text || !state.call) return;
    sendMessage(state.call.chatId, { type: 'text', text });
    appendCallChatBubble(currentUser, text, true);
    els.callChatInput.value = '';
  });
}

/* ===================== INIT ===================== */
function init() {
  cacheEls();
  initAuth();
  initTheme();
  initComposer();
  initPoll();
  initNewChat();
  initNewGroup();
  initChatInfo();
  initSettings();
  initModals();
  initFilters();
  initCalls();
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#emoji-btn') && !event.target.closest('#emoji-picker')) els.emojiPicker.hidden = true;
    if (!event.target.closest('.msg-actions') && !event.target.closest('[data-action="react"]')) document.querySelectorAll('.reaction-quickbar.show').forEach((bar) => bar.classList.remove('show'));
  });
  if (currentUser) enterApp();
}

document.addEventListener('DOMContentLoaded', init);
})();
