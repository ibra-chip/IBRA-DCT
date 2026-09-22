import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (a Supabase/Postgres connection string).');
}

const isLocalDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

export const query = (text, params) => pool.query(text, params);
export const dbGet = async (text, params) => (await pool.query(text, params)).rows[0];
export const dbAll = async (text, params) => (await pool.query(text, params)).rows;
export const dbRun = async (text, params) => { await pool.query(text, params); };

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_data TEXT,
      avatar_color TEXT,
      status_text TEXT DEFAULT '',
      show_online BOOLEAN DEFAULT TRUE,
      show_read_receipts BOOLEAN DEFAULT TRUE,
      online BOOLEAN DEFAULT FALSE,
      is_bot BOOLEAN DEFAULT FALSE,
      bot_replies JSONB,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT,
      avatar_color TEXT,
      created_by TEXT,
      created_at BIGINT NOT NULL,
      disappearing BIGINT,
      pinned_message_ids JSONB DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id TEXT NOT NULL REFERENCES chats(id),
      email TEXT NOT NULL REFERENCES users(email),
      is_admin BOOLEAN DEFAULT FALSE,
      pinned BOOLEAN DEFAULT FALSE,
      muted BOOLEAN DEFAULT FALSE,
      archived BOOLEAN DEFAULT FALSE,
      deleted_for BOOLEAN DEFAULT FALSE,
      left_chat BOOLEAN DEFAULT FALSE,
      PRIMARY KEY (chat_id, email)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      type TEXT NOT NULL,
      text TEXT DEFAULT '',
      attachment JSONB,
      reply_to TEXT,
      poll JSONB,
      call JSONB,
      reactions JSONB DEFAULT '{}',
      read_by JSONB DEFAULT '[]',
      edited BOOLEAN DEFAULT FALSE,
      deleted BOOLEAN DEFAULT FALSE,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
  `);
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
