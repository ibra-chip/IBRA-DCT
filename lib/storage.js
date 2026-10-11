import { initFreePool, poolPut, poolGet, poolDelete, poolSignedUrl } from './free-pool.js';

const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const storageConfigured = Boolean(supabaseUrl && supabaseKey);

export const UPLOADS_BUCKET = process.env.SUPABASE_UPLOADS_BUCKET || 'ibra-uploads';
export const IDENTITY_BUCKET = process.env.SUPABASE_IDENTITY_BUCKET || 'ibra-identity';

const authHeaders = () => ({ apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` });

async function ensureBucket(id, isPublic) {
  const existing = await fetch(`${supabaseUrl}/storage/v1/bucket/${id}`, { headers: authHeaders() }).catch(() => null);
  if (existing?.ok) return;
  const create = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name: id, public: isPublic }),
  });
  if (create.ok || create.status === 409) return;
  const details = await create.text().catch(() => '');
  if (details.includes('already exists')) return;
  console.error(`Supabase Storage bucket "${id}" could not be created:`, create.status, details.slice(0, 300));
}

export async function ensureBuckets() {
  // Reads STORAGE_POOL etc. fresh and self-tests it; a missing/bad setting just means poolConfigured()
  // stays false afterwards, so uploadFile/downloadFile/deleteFile silently use Supabase, as before.
  await initFreePool().catch((error) => console.error('Free storage pool init failed (Supabase Storage still works as before):', error.message));
  if (!storageConfigured) {
    console.warn('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not configured; file uploads will not persist across deploys.');
    return;
  }
  await ensureBucket(UPLOADS_BUCKET, false);
  await ensureBucket(IDENTITY_BUCKET, true);
}

async function uploadToSupabase(bucket, key, buffer, contentType) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' },
    body: buffer,
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Supabase Storage upload failed (${response.status}): ${details.slice(0, 300)}`);
  }
}

// Tries the free provider pool first (10 GB/provider, at no cost); Supabase Storage is the fallback,
// exactly as it worked before this pool existed. Callers never see the difference.
export async function uploadFile(bucket, key, buffer, contentType) {
  if (await poolPut(`${bucket}/${key}`, buffer, contentType)) return;
  await uploadToSupabase(bucket, key, buffer, contentType);
}

export async function downloadFile(bucket, key) {
  const pooled = await poolGet(`${bucket}/${key}`);
  if (pooled) return pooled.body;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(key)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Supabase Storage download failed (${response.status}) for ${bucket}/${key}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteFile(bucket, key) {
  await poolDelete(`${bucket}/${key}`).catch(() => {});
  await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).catch(() => {});
}

// A short-lived URL the browser can download directly, bypassing this server for the file bytes
// entirely. Tries the free pool first (checks which provider actually has it, then signs for that
// one), then falls back to Supabase Storage's own signed-URL endpoint. Returns null if neither has
// the object (or Supabase isn't configured), so the caller can fall back to proxying the bytes itself.
export async function getDownloadUrl(bucket, key, expiresSeconds = 300, filename) {
  const pooled = await poolSignedUrl(`${bucket}/${key}`, expiresSeconds, filename).catch(() => null);
  if (pooled) return pooled;
  if (!storageConfigured) return null;
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: expiresSeconds, ...(filename ? { download: filename } : {}) }),
  }).catch(() => null);
  if (!response?.ok) return null;
  const { signedURL } = await response.json().catch(() => ({}));
  return signedURL ? `${supabaseUrl}/storage/v1${signedURL}` : null;
}

export function publicUrl(key) {
  return `${supabaseUrl}/storage/v1/object/public/${IDENTITY_BUCKET}/${encodeURIComponent(key)}`;
}

// Used by GET /identity-assets/:filename: if the pool has this identity photo, its bytes are served
// directly ({ contentType, body }); otherwise the route redirects to Supabase's public URL as before.
export const poolAsset = (key) => poolGet(`${IDENTITY_BUCKET}/${key}`);
