import { createClient } from '@supabase/supabase-js';
import { uid } from './db.js';

const BUCKET = 'ibraapp-uploads';
let supabase = null;

function client() {
  if (supabase) return supabase;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for file uploads.');
  }
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return supabase;
}

export async function ensureBucket() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — file uploads will fail until configured.');
    return;
  }
  const { data: buckets } = await client().storage.listBuckets();
  if (buckets?.some((bucket) => bucket.name === BUCKET)) return;
  const { error } = await client().storage.createBucket(BUCKET, { public: true, fileSizeLimit: '20MB' });
  if (error && !/already exists/i.test(error.message || '')) throw error;
}

export async function uploadBuffer(buffer, originalName, mimeType) {
  const ext = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.')) : '';
  const path = `${uid()}${ext}`;
  const { error } = await client().storage.from(BUCKET).upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) throw error;
  const { data } = client().storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
