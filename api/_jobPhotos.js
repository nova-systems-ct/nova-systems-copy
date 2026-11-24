// Before and after photos of a job, taken on the worker's phone page (Nova system 24).
// Stored in a PRIVATE Supabase Storage bucket ('job-photos'): no photo has a public address. The
// owner sees them through links that work for one hour. Only the worker assigned to the job can
// add photos, while the job is open and for a day after it is marked done; at most 12 per job.
import crypto from 'node:crypto';

export const BUCKET = 'job-photos';
export const MAX_BYTES = 2_500_000;
export const MAX_PER_JOB = 12;
const DAY = 86_400_000;
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const fail = (code, message, status = 409) => Object.assign(new Error(message), { code, status, expected: true });

// The kind of picture from its first bytes; anything else is refused.
export function imageKind(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', type: 'image/png' };
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

function storage(env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, ''), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw fail('storage_unavailable', 'Photo storage is not set up yet.', 503);
  return { url, headers: { Authorization: `Bearer ${key}`, apikey: key } };
}

export async function savePhoto(db, worker, { assignmentId, kind, image }, { env = process.env, now = new Date(), fetchImpl = fetch } = {}) {
  if (!['before', 'after'].includes(kind)) throw fail('bad_kind', 'Choose before or after.', 400);
  const a = await one(db, 'job_assignments', { id: assignmentId, organization_id: worker.organization_id, worker_id: worker.id });
  const open = a && (a.status === 'assigned' || (a.status === 'done' && now - new Date(a.done_at) < DAY));
  if (!open) throw fail('not_your_job', 'Photos can be added only to your open jobs.', 404);
  const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(image || ''));
  const buf = m ? Buffer.from(m[1], 'base64') : null;
  const type = buf && imageKind(buf);
  if (!type) throw fail('bad_image', 'That file is not a photo. Take or choose a photo.', 400);
  if (buf.length > MAX_BYTES) throw fail('too_big', 'That photo is too large. Try again; the page makes it smaller.', 413);
  const have = await db.select('job_photos', { assignment_id: a.id, organization_id: worker.organization_id }, { limit: MAX_PER_JOB + 1 });
  if (have.length >= MAX_PER_JOB) throw fail('too_many', `A job holds at most ${MAX_PER_JOB} photos.`);
  const s = storage(env);
  const path = `${worker.organization_id}/${a.journey_id}/${a.id}/${crypto.randomUUID()}.${type.ext}`;
  const r = await fetchImpl(`${s.url}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { ...s.headers, 'Content-Type': type.type, 'x-upsert': 'false', 'Cache-Control': 'private, max-age=0' }, body: buf, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw fail('storage_refused', 'The photo could not be saved. Try again.', 502);
  return db.insert('job_photos', { organization_id: worker.organization_id, journey_id: a.journey_id, assignment_id: a.id, worker_id: worker.id, kind, storage_path: path, content_type: type.type, bytes: buf.length, created_at: now.toISOString() });
}

// The owner's view of a job's photos: one-hour links, newest last.
export async function photosFor(db, orgId, journeyId, { env = process.env, fetchImpl = fetch } = {}) {
  const rows = await db.select('job_photos', { organization_id: orgId, journey_id: journeyId }, { order: 'created_at.asc', limit: 100 });
  if (!rows.length) return [];
  const s = storage(env);
  const r = await fetchImpl(`${s.url}/storage/v1/object/sign/${BUCKET}`, { method: 'POST', headers: { ...s.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600, paths: rows.map((p) => p.storage_path) }), signal: AbortSignal.timeout(10_000) });
  const signed = r.ok ? await r.json().catch(() => []) : [];
  const by = new Map((Array.isArray(signed) ? signed : []).filter((x) => x?.signedURL && !x.error).map((x) => [x.path, `${s.url}/storage/v1${x.signedURL}`]));
  return rows.map((p) => ({ id: p.id, kind: p.kind, taken_at: p.created_at, url: by.get(p.storage_path) || null }));
}

export async function photoCount(db, orgId, assignmentId) {
  return (await db.select('job_photos', { organization_id: orgId, assignment_id: assignmentId }, { limit: MAX_PER_JOB + 1 })).length;
}
