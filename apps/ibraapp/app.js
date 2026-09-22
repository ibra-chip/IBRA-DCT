(() => {
'use strict';

/* ===================== API CLIENT ===================== */
const TOKEN_KEY = 'ibraapp_token';
const THEME_KEY = 'ibraapp_theme';
let authToken = localStorage.getItem(TOKEN_KEY) || null;
let socket = null;

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = escapeHtml;

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`/api${path}`, { ...options, headers, body });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error === 'invalid_email' ? 'Unesi validan email.' : (typeof err.error === 'string' && !/_/.test(err.error) ? err.error : `Greška (${res.status})`)); }
  return res.status === 204 ? null : res.json();
}
async function uploadFile(fileOrBlob, filename) {
  const form = new FormData();
  form.append('file', fileOrBlob, filename || fileOrBlob.name || 'file');
  return api('/upload', { method: 'POST', body: form });
}

/* ===================== IN-MEMORY DATA (server-backed) ===================== */
let users = {};
let chats = {};
let messages = {};
let currentUser = null;

function colorFor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${hash} 60% 42%)`;
}
function mergeUser(user) { if (user) users[user.email] = user; return user; }

/* ===================== AUTH ===================== */
async function registerUser({ name, email, password, statusText }) {
  const { token, user } = await api('/auth/register', { method: 'POST', body: { name, email: email.trim().toLowerCase(), password, statusText } });
  return { token, user };
}
async function loginUser({ email, password }) {
  const { token, user } = await api('/auth/login', { method: 'POST', body: { email: email.trim().toLowerCase(), password } });
  return { token, user };
}
function startSession(token, user) {
  authToken = token;
  localStorage.setItem(TOKEN_KEY, token);
  currentUser = user;
  mergeUser(user);
}
function endSession() {
  socket?.disconnect();
  authToken = null;
  localStorage.removeItem(TOKEN_KEY);
  currentUser = null;
  users = {}; chats = {}; messages = {};
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
async function ensureUsersForChats(chatList) {
  const emails = new Set();
  chatList.forEach((chat) => chat.memberEmails.forEach((email) => { if (!users[email]) emails.add(email); }));
  if (!emails.size) return;
  const fetched = await api(`/users/batch?emails=${encodeURIComponent([...emails].join(','))}`);
  fetched.forEach(mergeUser);
}
async function findOrCreateDirectChat(otherEmail) {
  const chat = await api('/chats/direct', { method: 'POST', body: { email: otherEmail } });
  chats[chat.id] = chat;
  await ensureUsersForChats([chat]);
  return chat;
}
async function createGroupChat(name, memberEmails) {
  const chat = await api('/chats/group', { method: 'POST', body: { name, memberEmails } });
  chats[chat.id] = chat;
  await ensureUsersForChats([chat]);
  return chat;
}

/* ===================== MESSAGE SENDING ===================== */
async function sendMessage(chatId, partial) {
  await api(`/chats/${chatId}/messages`, { method: 'POST', body: { type: partial.type || 'text', text: partial.text || '', attachment: partial.attachment || null, poll: partial.poll || null, replyTo: partial.replyTo || null } });
  socket?.emit('typing:stop', { chatId });
}
function showTyping(name) { els.typingWho.textContent = `${name} kuca...`; els.typingIndicator.hidden = false; els.messages.scrollTop = els.messages.scrollHeight; }
function hideTyping() { els.typingIndicator.hidden = true; }

async function markVisibleMessagesRead(chatId) {
  const unread = chatMessages(chatId).filter((message) => message.sender !== currentUser.email && !message.readBy.includes(currentUser.email));
  await Promise.all(unread.map((message) => api(`/messages/${message.id}/read`, { method: 'POST' }).catch(() => {})));
}

/* ===================== UI STATE ===================== */
const state = { activeChatId: null, chatFilter: 'all', replyTo: null, mediaRecorder: null, mediaChunks: [], recordStart: 0, recordTimer: null, call: null, incomingCall: null, typingStopTimer: null };

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
  });
  els.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.loginError.textContent = '';
    const submitBtn = els.loginForm.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(els.loginForm).entries());
    submitBtn.disabled = true;
    try { const { token, user } = await loginUser(data); startSession(token, user); await enterApp(); }
    catch (error) {
      if (/Pogrešan/.test(error.message) && data.email === 'demo@ibra-ba.net') {
        try { const { token, user } = await registerUser({ name: 'Demo Korisnik', email: 'demo@ibra-ba.net', password: 'demo1234', statusText: 'Testiram IbraApp' }); startSession(token, user); await enterApp(); return; }
        catch (registerError) { els.loginError.textContent = registerError.message; }
      } else els.loginError.textContent = error.message;
    } finally { submitBtn.disabled = false; }
  });
  els.registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.registerError.textContent = '';
    const submitBtn = els.registerForm.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(els.registerForm).entries());
    submitBtn.disabled = true;
    try { const { token, user } = await registerUser(data); startSession(token, user); await enterApp(); }
    catch (error) { els.registerError.textContent = error.message; }
    finally { submitBtn.disabled = false; }
  });
}

async function enterApp() {
  els.authScreen.hidden = true;
  els.appShell.hidden = false;
  renderMe();
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  connectSocket();
  await loadInitialData();
  startExpiryLoop();
}
async function loadInitialData() {
  const chatList = await api('/chats');
  chats = {}; chatList.forEach((chat) => { chats[chat.id] = chat; });
  await ensureUsersForChats(chatList);
  const contacts = await api('/users/contacts');
  contacts.forEach(mergeUser);
  const messageLists = await Promise.all(chatList.map((chat) => api(`/chats/${chat.id}/messages`)));
  messages = {};
  messageLists.forEach((list) => list.forEach((message) => { messages[message.id] = message; }));
  renderChatList();
}

function connectSocket() {
  socket = io({ auth: { token: authToken } });
  socket.on('message:new', ({ chatId, message }) => {
    messages[message.id] = message;
    if (message.sender !== currentUser.email && chats[chatId] && !chats[chatId].muted.includes(currentUser.email)) hideTyping();
    if (state.activeChatId === chatId) { renderMessages(chatId); markVisibleMessagesRead(chatId); }
    renderChatList();
  });
  socket.on('message:update', ({ chatId, message }) => {
    messages[message.id] = message;
    if (state.activeChatId === chatId) renderMessages(chatId, els.inChatSearch?.value || '');
    renderChatList();
  });
  socket.on('chat:new', async (chat) => { chats[chat.id] = chat; await ensureUsersForChats([chat]); renderChatList(); notifyToast(`Novi razgovor: ${chatDisplayName(chat)}`); });
  socket.on('chat:update', (chat) => {
    chats[chat.id] = chat;
    if (state.activeChatId === chat.id) { renderPinnedBar(chat); if (!els.chatInfoPanel.hidden) renderChatInfoPanel(); }
    renderChatList();
  });
  socket.on('chat:removed', ({ chatId }) => {
    delete chats[chatId];
    if (state.activeChatId === chatId) { state.activeChatId = null; els.chatActive.hidden = true; els.chatEmpty.hidden = false; els.appShell.classList.remove('chat-open'); }
    renderChatList();
  });
  socket.on('user:update', (user) => { mergeUser(user); if (user.email === currentUser.email) { currentUser = user; renderMe(); } renderChatList(); if (state.activeChatId) renderMessages(state.activeChatId); });
  socket.on('presence', ({ email, online }) => {
    if (users[email]) users[email].online = online;
    renderChatList();
    if (state.activeChatId) { const chat = chats[state.activeChatId]; if (chat?.type === 'direct' && otherMember(chat)?.email === email) els.chatSubtitle.textContent = online && otherMember(chat)?.showOnline ? 'online' : email; }
  });
  socket.on('typing', ({ chatId, email, typing }) => {
    if (state.activeChatId !== chatId || email === currentUser.email) return;
    if (typing) showTyping(users[email]?.name || email); else hideTyping();
  });
  socket.on('call:invite', (payload) => handleIncomingCallInvite(payload));
  socket.on('call:accept', (payload) => handleCallAccept(payload));
  socket.on('call:decline', (payload) => handleCallDecline(payload));
  socket.on('call:signal', (payload) => handleCallSignal(payload));
  socket.on('call:peer-left', (payload) => handlePeerLeft(payload));
}

/* ===================== THEME ===================== */
function applyTheme(theme) { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem(THEME_KEY, theme); els.toggleTheme.textContent = theme === 'dark' ? '🌙' : '☀️'; }
function initTheme() { els.toggleTheme.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')); }

/* ===================== AVATARS ===================== */
function avatarUrl(user) { return user?.avatarData ? (user.avatarData.startsWith('http') || user.avatarData.startsWith('/') ? user.avatarData : user.avatarData) : ''; }
function avatarHtml(user) {
  const url = avatarUrl(user);
  if (url) return `<span class="avatar"><img src="${escapeAttr(url)}" alt="" /></span>`;
  const initials = (user?.name || user?.email || '?').trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const color = user?.avatarColor || colorFor(user?.email || user?.name || '?');
  return `<span class="avatar" style="background:${color}">${initials}</span>`;
}
function chatAvatarHtml(chat, size) {
  if (chat.type === 'group') { const initials = chat.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase(); return `<span class="avatar${size === 'lg' ? ' avatar-lg' : ''}" style="background:${chat.avatarColor || colorFor(chat.name)}">${initials}</span>`; }
  return avatarHtml(otherMember(chat));
}
function applyAvatar(element, user) {
  if (!element || !user) return;
  const url = avatarUrl(user);
  if (url) { element.innerHTML = `<img src="${escapeAttr(url)}" alt="" />`; element.style.background = ''; return; }
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

/* ===================== SIDEBAR ===================== */
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
async function openChat(chatId) {
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
  renderPinnedBar(chat);
  renderMessages(chatId);
  renderChatList();
  els.composerInput.focus();
  await markVisibleMessagesRead(chatId);
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
    body = `<img class="msg-image" src="${escapeAttr(message.attachment.url)}" alt="${escapeAttr(message.attachment.name)}" data-lightbox="${escapeAttr(message.attachment.url)}" />${message.text ? `<div class="msg-text">${escapeHtml(message.text)}</div>` : ''}`;
  } else if (message.type === 'file') {
    body = `<div class="msg-file"><span class="msg-file-icon">📄</span><div><strong>${escapeHtml(message.attachment.name)}</strong><br/><small>${(message.attachment.size / 1024).toFixed(0)} KB</small></div></div>`;
  } else if (message.type === 'voice') {
    body = `<div class="msg-voice">🎤 <audio controls src="${escapeAttr(message.attachment.url)}"></audio></div>`;
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

async function toggleReaction(messageId, emoji) { await api(`/messages/${messageId}/react`, { method: 'POST', body: { emoji } }); }
async function votePoll(messageId, optionIndex) { await api(`/messages/${messageId}/vote`, { method: 'POST', body: { optionIndex } }); }
function setReplyTo(messageId) {
  state.replyTo = messageId;
  const message = messages[messageId];
  els.replyPreviewName.textContent = message.sender === currentUser.email ? 'Ti' : (users[message.sender]?.name || message.sender);
  els.replyPreviewText.textContent = (message.text || (message.type === 'image' ? '📷 Slika' : message.type === 'voice' ? '🎤 Glasovna poruka' : 'Prilog')).slice(0, 80);
  els.replyPreview.hidden = false;
  els.composerInput.focus();
}
async function editMessage(messageId) {
  const message = messages[messageId];
  const next = window.prompt('Izmijeni poruku:', message.text);
  if (next === null || !next.trim() || next === message.text) return;
  await api(`/messages/${messageId}`, { method: 'PATCH', body: { text: next.trim() } });
}
async function deleteMessage(messageId) {
  if (!window.confirm('Obrisati ovu poruku za sve?')) return;
  await api(`/messages/${messageId}`, { method: 'DELETE' });
}
async function togglePinMessage(chatId, messageId) {
  try { await api(`/messages/${messageId}/pin`, { method: 'POST' }); }
  catch { notifyToast('Najviše 3 zakačene poruke po razgovoru.'); }
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
  els.composerInput.addEventListener('input', () => {
    els.composerInput.style.height = 'auto'; els.composerInput.style.height = `${Math.min(els.composerInput.scrollHeight, 120)}px`;
    if (!state.activeChatId) return;
    socket?.emit('typing:start', { chatId: state.activeChatId });
    clearTimeout(state.typingStopTimer);
    state.typingStopTimer = setTimeout(() => socket?.emit('typing:stop', { chatId: state.activeChatId }), 1800);
  });
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
  const replyTo = state.replyTo;
  els.composerInput.value = '';
  els.composerInput.style.height = 'auto';
  state.replyTo = null;
  els.replyPreview.hidden = true;
  sendMessage(state.activeChatId, { type: 'text', text, replyTo }).catch(() => notifyToast('Poruka nije poslata.'));
}

function handleAttachments(files) {
  if (!state.activeChatId || !files.length) return;
  files.forEach(async (file) => {
    try {
      const uploaded = await uploadFile(file);
      const isImage = file.type.startsWith('image/');
      await sendMessage(state.activeChatId, { type: isImage ? 'image' : 'file', attachment: uploaded });
    } catch { notifyToast('Slanje fajla nije uspjelo.'); }
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
  state.mediaRecorder.onstop = async () => {
    const blob = new Blob(state.mediaChunks, { type: 'audio/webm' });
    try { const uploaded = await uploadFile(blob, 'glasovna-poruka.webm'); await sendMessage(state.activeChatId, { type: 'voice', attachment: uploaded }); }
    catch { notifyToast('Slanje glasovne poruke nije uspjelo.'); }
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
  els.openNewChat.addEventListener('click', () => { renderContactList(); els.newChatEmail.value = ''; openModal(els.newChatModal); });
  els.newChatStart.addEventListener('click', async () => {
    const email = els.newChatEmail.value.trim().toLowerCase();
    if (!email || !email.includes('@')) { notifyToast('Unesi validan email.'); return; }
    if (email === currentUser.email) { notifyToast('To si ti 🙂'); return; }
    try { const chat = await findOrCreateDirectChat(email); closeModals(); renderChatList(); openChat(chat.id); }
    catch { notifyToast('Razgovor nije mogao biti napravljen.'); }
  });
}
function knownContacts() {
  const chatContacts = userChats(currentUser.email).filter((chat) => chat.type === 'direct').map((chat) => otherMember(chat)).filter(Boolean);
  const byEmail = new Map();
  [...Object.values(users).filter((user) => user.email !== currentUser.email), ...chatContacts].forEach((user) => byEmail.set(user.email, user));
  return [...byEmail.values()];
}
function renderContactList() {
  const list = knownContacts();
  els.demoContactList.innerHTML = list.map((user) => `<div class="contact-row" data-email="${escapeAttr(user.email)}">${avatarHtml(user)}<div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></div></div>`).join('') || '<p style="color:var(--muted);font-size:.85rem">Nema još kontakata.</p>';
  els.demoContactList.querySelectorAll('.contact-row').forEach((row) => row.addEventListener('click', () => { els.newChatEmail.value = row.dataset.email; els.newChatStart.click(); }));
}

function initNewGroup() {
  els.openNewGroup.addEventListener('click', () => { els.groupNameInput.value = ''; renderGroupMemberPicker(); openModal(els.newGroupModal); });
  els.createGroupBtn.addEventListener('click', async () => {
    const name = els.groupNameInput.value.trim();
    const selected = [...els.groupMemberList.querySelectorAll('.contact-row.selected')].map((row) => row.dataset.email);
    if (!name) { notifyToast('Unesi naziv grupe.'); return; }
    if (selected.length < 1) { notifyToast('Izaberi bar jednog člana.'); return; }
    try { const chat = await createGroupChat(name, selected); closeModals(); renderChatList(); openChat(chat.id); }
    catch { notifyToast('Grupa nije napravljena.'); }
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
  els.toggleMute.addEventListener('click', async () => {
    const chat = chats[state.activeChatId];
    const nextMuted = !chat.muted.includes(currentUser.email);
    await api(`/chats/${chat.id}/prefs`, { method: 'PATCH', body: { muted: nextMuted } });
    els.toggleMute.textContent = nextMuted ? '🔕' : '🔔';
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

  if (media.length) html += `<div class="info-section"><h4>Deljeni mediji</h4><div class="media-grid">${media.slice(-9).reverse().map((message) => `<img src="${escapeAttr(message.attachment.url)}" data-lightbox-thumb="${escapeAttr(message.attachment.url)}" />`).join('')}</div></div>`;

  html += `<div class="info-section">
    ${chat.type === 'group' && chat.admins.includes(currentUser.email) === false ? `<div class="info-row danger" id="leave-group"><span>🚪 Napusti grupu</span></div>` : ''}
    <div class="info-row danger" id="delete-chat"><span>🗑️ Obriši razgovor (samo za tebe)</span></div>
  </div>`;

  els.chatInfoBody.innerHTML = html;

  document.getElementById('cfg-pin').addEventListener('change', (event) => api(`/chats/${chat.id}/prefs`, { method: 'PATCH', body: { pinned: event.target.checked } }));
  document.getElementById('cfg-archive').addEventListener('change', (event) => api(`/chats/${chat.id}/prefs`, { method: 'PATCH', body: { archived: event.target.checked } }));
  document.getElementById('cfg-disappear').addEventListener('change', async (event) => { await api(`/chats/${chat.id}/settings`, { method: 'PATCH', body: { disappearing: event.target.value ? Number(event.target.value) : null } }); notifyToast(event.target.value ? 'Nestajuće poruke uključene.' : 'Nestajuće poruke isključene.'); });
  document.getElementById('delete-chat').addEventListener('click', async () => {
    if (!window.confirm('Obrisati ovaj razgovor za tebe?')) return;
    await api(`/chats/${chat.id}/delete-for-me`, { method: 'POST' });
    delete chats[chat.id];
    els.chatInfoPanel.hidden = true; els.chatActive.hidden = true; els.chatEmpty.hidden = false; state.activeChatId = null;
    renderChatList();
  });
  document.getElementById('leave-group')?.addEventListener('click', async () => {
    await api(`/chats/${chat.id}/leave`, { method: 'POST' });
    delete chats[chat.id];
    els.chatInfoPanel.hidden = true; els.chatActive.hidden = true; els.chatEmpty.hidden = false; state.activeChatId = null;
    renderChatList();
  });
  els.chatInfoBody.querySelectorAll('[data-remove-member]').forEach((button) => button.addEventListener('click', async () => { await api(`/chats/${chat.id}/members/${encodeURIComponent(button.dataset.removeMember)}`, { method: 'DELETE' }); }));
  els.chatInfoBody.querySelectorAll('[data-lightbox-thumb]').forEach((img) => img.addEventListener('click', () => openLightbox(img.dataset.lightboxThumb)));
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
  els.avatarInput.addEventListener('change', async () => {
    const file = els.avatarInput.files[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file);
      els.settingsAvatar.innerHTML = `<img src="${escapeAttr(uploaded.url)}" alt="" />`;
      els.settingsAvatar.dataset.pending = uploaded.url;
    } catch { notifyToast('Slika nije mogla biti otpremljena.'); }
  });
  els.saveSettings.addEventListener('click', async () => {
    const body = { name: els.settingsName.value.trim() || currentUser.name, statusText: els.settingsStatus.value.trim(), showReadReceipts: els.settingsReadReceipts.checked, showOnline: els.settingsOnlineStatus.checked };
    if (els.settingsAvatar.dataset.pending) body.avatarData = els.settingsAvatar.dataset.pending;
    const user = await api('/me', { method: 'PATCH', body });
    currentUser = user; mergeUser(user);
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

function startExpiryLoop() {
  setInterval(() => { if (state.activeChatId) renderMessages(state.activeChatId, els.inChatSearch?.value || ''); }, 20000);
}

/* ===================== CALLS (real WebRTC + simulated bots) ===================== */
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
async function logCall(chatId, { kind, duration, missed }) {
  try { await api(`/chats/${chatId}/calls/log`, { method: 'POST', body: { kind, duration, missed } }); } catch { /* best-effort */ }
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
    let statusText = '';
    if (participant.declined) statusText = 'Odbio/la poziv';
    else if (!participant.connected) statusText = 'Zove se...';
    participant.els.label.textContent = `${isLocal ? 'Ti' : (user.name || email)}${participant.micOn === false ? ' 🔇' : ''}`;
    participant.els.status.textContent = statusText;
    participant.els.status.hidden = !statusText;
    const showVideo = call.kind === 'video' && participant.connected && participant.camOn && participant.stream;
    participant.els.video.hidden = !showVideo;
    participant.els.avatar.hidden = showVideo;
    if (showVideo && participant.els.video.srcObject !== participant.stream) participant.els.video.srcObject = participant.stream;
    if (!showVideo && !isLocal) participant.els.video.srcObject = null;
  });
}
function updateCallControlButtons() {
  const participant = state.call.participants.get(currentUser.email);
  els.callToggleMic.classList.toggle('off', !participant.micOn);
  els.callToggleCam.classList.toggle('off', !participant.camOn);
  els.callToggleShare.classList.toggle('active-share', state.call.sharing);
}
function activateCallIfReady() {
  if (!state.call || state.call.status === 'active') return;
  const someoneElseConnected = state.call.order.some((email) => email !== currentUser.email && state.call.participants.get(email).connected);
  if (!someoneElseConnected) return;
  state.call.status = 'active';
  els.callStatusText.textContent = '00:00';
  state.call.timerInterval = setInterval(() => {
    const seconds = Math.floor((Date.now() - state.call.startedAt) / 1000);
    els.callStatusText.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }, 1000);
}

function createPeerConnection(remoteEmail) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  state.call.localStream.getTracks().forEach((track) => pc.addTrack(track, state.call.localStream));
  pc.onicecandidate = (event) => { if (event.candidate) socket.emit('call:signal', { chatId: state.call.chatId, toEmail: remoteEmail, data: { type: 'ice', candidate: event.candidate } }); };
  pc.ontrack = (event) => {
    const participant = state.call.participants.get(remoteEmail);
    if (!participant) return;
    participant.stream = event.streams[0];
    participant.connected = true;
    updateCallTilesUI();
    activateCallIfReady();
  };
  pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) { const p = state.call?.participants.get(remoteEmail); if (p) { p.connected = false; updateCallTilesUI(); } } };
  state.call.peers.set(remoteEmail, pc);
  return pc;
}
async function callAsOfferer(remoteEmail) {
  const pc = createPeerConnection(remoteEmail);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('call:signal', { chatId: state.call.chatId, toEmail: remoteEmail, data: { type: 'offer', sdp: offer } });
}
async function handleCallSignal({ chatId, fromEmail, data }) {
  if (!state.call || state.call.chatId !== chatId) return;
  let pc = state.call.peers.get(fromEmail);
  if (data.type === 'offer') {
    if (!pc) pc = createPeerConnection(fromEmail);
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('call:signal', { chatId, toEmail: fromEmail, data: { type: 'answer', sdp: answer } });
  } else if (data.type === 'answer' && pc) {
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  } else if (data.type === 'ice' && pc) {
    try { await pc.addIceCandidate(data.candidate); } catch { /* ignore late candidates */ }
  }
}
function handleCallAccept({ chatId, fromEmail }) {
  if (!state.call || state.call.chatId !== chatId) return;
  const participant = state.call.participants.get(fromEmail);
  if (participant) { participant.declined = false; }
  callAsOfferer(fromEmail);
}
function handleCallDecline({ chatId, fromEmail }) {
  if (!state.call || state.call.chatId !== chatId) return;
  const participant = state.call.participants.get(fromEmail);
  if (participant) participant.declined = true;
  const stillPossible = state.call.order.some((email) => email !== currentUser.email && !state.call.participants.get(email).declined);
  if (!stillPossible && state.call.status !== 'active') {
    const chatId = state.call.chatId; const kind = state.call.kind;
    closeCallUiOnly();
    logCall(chatId, { kind, duration: 0, missed: true });
    notifyToast(`${users[fromEmail]?.name || fromEmail} je odbio/la poziv.`);
    return;
  }
  updateCallTilesUI();
}
function handlePeerLeft({ chatId, fromEmail }) {
  if (!state.call || state.call.chatId !== chatId) return;
  const participant = state.call.participants.get(fromEmail);
  const pc = state.call.peers.get(fromEmail);
  pc?.close();
  state.call.peers.delete(fromEmail);
  if (participant) { participant.connected = false; participant.stream = null; }
  const anyoneElseLeft = state.call.order.some((email) => email !== currentUser.email && state.call.participants.get(email).connected);
  if (!anyoneElseLeft) { closeCallUiOnly(); notifyToast('Poziv je završen.'); return; }
  updateCallTilesUI();
}
function handleIncomingCallInvite({ chatId, kind, fromEmail, fromName }) {
  if (state.call) { socket.emit('call:decline', { chatId, toEmail: fromEmail }); return; }
  state.incomingCall = { chatId, kind, fromEmail, fromName };
  applyAvatar(els.incomingCallAvatar, users[fromEmail] || { email: fromEmail, name: fromName });
  els.incomingCallName.textContent = fromName || fromEmail;
  els.incomingCallKind.textContent = kind === 'video' ? 'Video poziv...' : 'Audio poziv...';
  openModal(els.incomingCallModal);
}
function initIncomingCall() {
  els.acceptCall.addEventListener('click', async () => {
    const invite = state.incomingCall;
    if (!invite) return;
    closeModals();
    state.incomingCall = null;
    await joinCallAsCallee(invite);
  });
  els.declineCall.addEventListener('click', () => {
    const invite = state.incomingCall;
    if (!invite) return;
    socket.emit('call:decline', { chatId: invite.chatId, toEmail: invite.fromEmail });
    closeModals();
    state.incomingCall = null;
  });
}
async function joinCallAsCallee({ chatId, kind, fromEmail }) {
  const chat = chats[chatId];
  if (!chat) return;
  let localStream;
  try { localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' }); }
  catch { notifyToast('Nije moguće pristupiti mikrofonu/kameri.'); socket.emit('call:decline', { chatId, toEmail: fromEmail }); return; }
  const order = [currentUser.email, ...chat.memberEmails.filter((email) => email !== currentUser.email)];
  const participants = new Map();
  order.forEach((email) => participants.set(email, { stream: email === currentUser.email ? localStream : null, connected: email === currentUser.email, micOn: true, camOn: kind === 'video', declined: false }));
  state.call = { chatId, kind, status: 'ringing', startedAt: Date.now(), order, participants, peers: new Map(), localStream, screenStream: null, sharing: false, timerInterval: null };
  openCallScreen(chat);
  socket.emit('call:accept', { chatId, toEmail: fromEmail });
}
function openCallScreen(chat) {
  els.callTitleName.textContent = chatDisplayName(chat);
  els.callStatusText.textContent = 'Pozivanje...';
  els.callReactionBar.classList.add('hidden');
  els.callChatPanel.hidden = true;
  els.callChatMessages.innerHTML = '';
  els.callScreen.hidden = false;
  buildCallTiles();
  updateCallControlButtons();
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
  order.forEach((email) => participants.set(email, { stream: email === currentUser.email ? localStream : null, connected: email === currentUser.email, micOn: true, camOn: kind === 'video', declined: false }));
  state.call = { chatId, kind, status: 'ringing', startedAt: Date.now(), order, participants, peers: new Map(), localStream, screenStream: null, sharing: false, timerInterval: null };
  openCallScreen(chat);

  otherEmails.forEach((email) => {
    if (users[email]?.isBot) {
      setTimeout(() => {
        if (!state.call || state.call.chatId !== chatId) return;
        const participant = state.call.participants.get(email);
        if (!participant) return;
        participant.connected = true;
        updateCallTilesUI();
        activateCallIfReady();
      }, 900 + Math.random() * 1800);
    }
  });
  const humanEmails = otherEmails.filter((email) => !users[email]?.isBot);
  if (humanEmails.length) socket.emit('call:invite', { chatId, kind });
}
function closeCallUiOnly() {
  const call = state.call;
  if (!call) return;
  call.peers.forEach((pc) => pc.close());
  call.localStream?.getTracks().forEach((track) => track.stop());
  call.screenStream?.getTracks().forEach((track) => track.stop());
  clearInterval(call.timerInterval);
  els.callScreen.hidden = true;
  els.callVideoGrid.innerHTML = '';
  state.call = null;
}
function endCall() {
  if (!state.call) return;
  const call = state.call;
  const wasActive = call.status === 'active';
  const duration = wasActive ? Math.floor((Date.now() - call.startedAt) / 1000) : 0;
  socket.emit('call:leave', { chatId: call.chatId });
  logCall(call.chatId, { kind: call.kind, duration, missed: !wasActive });
  closeCallUiOnly();
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
    await replaceOutgoingVideoTrack(call.localStream.getVideoTracks()[0] || null);
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
    await replaceOutgoingVideoTrack(screenStream.getVideoTracks()[0]);
    screenStream.getVideoTracks()[0].addEventListener('ended', () => { if (state.call === call && call.sharing) toggleScreenShare(); });
    updateCallTilesUI();
    updateCallControlButtons();
  } catch { /* user cancelled the screen picker */ }
}
async function replaceOutgoingVideoTrack(track) {
  if (!state.call) return;
  await Promise.all([...state.call.peers.values()].map((pc) => {
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    return sender && track ? sender.replaceTrack(track).catch(() => {}) : Promise.resolve();
  }));
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
  els.callChatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = els.callChatInput.value.trim();
    if (!text || !state.call) return;
    els.callChatInput.value = '';
    appendCallChatBubble(currentUser, text, true);
    try { await sendMessage(state.call.chatId, { type: 'text', text }); } catch { notifyToast('Poruka nije poslata.'); }
  });
  initIncomingCall();
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
  if (authToken) { api('/me').then(async (user) => { currentUser = user; mergeUser(user); await enterApp(); }).catch(() => { authToken = null; localStorage.removeItem(TOKEN_KEY); }); }
}

document.addEventListener('DOMContentLoaded', init);
})();
