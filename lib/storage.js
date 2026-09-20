const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const storageConfigured = Boolean(supabaseUrl && supabaseKey);

export const UPLOADS_BUCKET = process.env.SUPABASE_UPLOADS_BUCKET || 'ibra-uploads';
export const IDENTITY_BUCKET = process.env.SUPABASE_IDENTITY_BUCKET || 'ibra-identity';

const authHeaders = () => ({ apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` });

async function ensureBucket(id, isPublic) {
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
  if (!storageConfigured) {
    console.warn('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not configured; file uploads will not persist across deploys.');
    return;
  }
  await ensureBucket(UPLOADS_BUCKET, false);
  await ensureBucket(IDENTITY_BUCKET, true);
}

export async function uploadFile(bucket, key, buffer, contentType) {
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

export async function downloadFile(bucket, key) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(key)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Supabase Storage download failed (${response.status}) for ${bucket}/${key}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteFile(bucket, key) {
  await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).catch(() => {});
}

export function publicUrl(key) {
  return `${supabaseUrl}/storage/v1/object/public/${IDENTITY_BUCKET}/${encodeURIComponent(key)}`;
}
