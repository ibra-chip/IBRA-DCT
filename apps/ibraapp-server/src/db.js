import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storageRoot = process.env.IBRAAPP_STORAGE_DIR || path.join(__dirname, '..');
const dataDir = path.join(storageRoot, 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'ibraapp.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_data TEXT,
  avatar_color TEXT,
  status_text TEXT DEFAULT '',
  show_online INTEGER DEFAULT 1,
  show_read_receipts INTEGER DEFAULT 1,
  online INTEGER DEFAULT 0,
  is_bot INTEGER DEFAULT 0,
  bot_replies TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT,
  avatar_color TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  disappearing INTEGER,
  pinned_message_ids TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id TEXT NOT NULL REFERENCES chats(id),
  email TEXT NOT NULL REFERENCES users(email),
  is_admin INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  muted INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  deleted_for INTEGER DEFAULT 0,
  left_chat INTEGER DEFAULT 0,
  PRIMARY KEY (chat_id, email)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  type TEXT NOT NULL,
  text TEXT DEFAULT '',
  attachment TEXT,
  reply_to TEXT,
  poll TEXT,
  call TEXT,
  reactions TEXT DEFAULT '{}',
  read_by TEXT DEFAULT '[]',
  edited INTEGER DEFAULT 0,
  deleted INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
`);

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
