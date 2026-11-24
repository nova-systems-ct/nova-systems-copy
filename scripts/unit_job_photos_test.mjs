// Before and after photos from the worker's phone (api/_jobPhotos.js). In-memory store and a
// stubbed Supabase Storage; no bucket, database or network is contacted.
import crypto from 'node:crypto';
import { imageKind, savePhoto, photosFor, MAX_PER_JOB } from '../api/_jobPhotos.js';

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = new Date('2026-11-24T15:00:00Z');
const ENV = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const rejects = async (p, code) => { try { await p; return false; } catch (e) { return e.code === code; } };
function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => r[k] === v);
  return { t,
    select: async (n, f = {}, { limit = 500 } = {}) => rows(n).filter((r) => hit(r, f)).slice(0, limit).map((r) => ({ ...r })),
    insert: async (n, row) => { const full = { id: crypto.randomUUID(), created_at: NOW.toISOString(), ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, patch) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, patch) })) };
}
const jpeg = (size = 2000) => { const b = Buffer.alloc(size, 7); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; return b; };
const dataUrl = (buf, type = 'jpeg') => `data:image/${type};base64,${buf.toString('base64')}`;
const calls = [];
const storageOk = async (url, opts) => { calls.push({ url: String(url), opts }); return { ok: true, status: 200, json: async () => JSON.parse(opts.body).paths?.map((p) => ({ path: p, signedURL: `/object/sign/job-photos/${p}?token=t`, error: null })) || {} }; };

const db = memoryDb();
const worker = await db.insert('business_workers', { organization_id: ORG, name: 'Ana Lopez', kind: 'contractor', active: true });
const other = await db.insert('business_workers', { organization_id: ORG, name: 'Ben', kind: 'employee', active: true });
const job = await db.insert('job_assignments', { organization_id: ORG, journey_id: crypto.randomUUID(), worker_id: worker.id, status: 'assigned' });
const save = (w, extra = {}, fetchImpl = storageOk, env = ENV, now = NOW) => savePhoto(db, w, { assignmentId: job.id, kind: 'before', image: dataUrl(jpeg()), ...extra }, { env, now, fetchImpl });

check('photos are recognized by their first bytes, not by their name', imageKind(jpeg())?.type === 'image/jpeg' && imageKind(Buffer.from('89504e470d0a1a0a00000000', 'hex'))?.ext === 'png' && imageKind(Buffer.from('RIFF0000WEBPVP8 ', 'latin1'))?.ext === 'webp' && imageKind(Buffer.from('<svg></svg>')) === null);
const row = await save(worker);
const up = calls.at(-1);
check('a photo goes to the private bucket under the business, request and job', up.url === `https://db.test/storage/v1/object/job-photos/${ORG}/${job.journey_id}/${job.id}/${row.storage_path.split('/').pop()}` && /\.jpg$/.test(row.storage_path) && up.opts.method === 'POST');
check('uploaded with the server key, never replacing a file', up.opts.headers.Authorization === 'Bearer service-key' && up.opts.headers['x-upsert'] === 'false' && up.opts.headers['Content-Type'] === 'image/jpeg');
check('the photo is recorded on the job with its kind and size', row.kind === 'before' && row.bytes === 2000 && row.organization_id === ORG && row.worker_id === worker.id);
check('another worker cannot add photos to this job', await rejects(save(other), 'not_your_job'));
check('only before or after', await rejects(save(worker, { kind: 'selfie' }), 'bad_kind'));
check('a file that is not a photo is refused', await rejects(save(worker, { image: `data:image/jpeg;base64,${Buffer.from('<script>x</script>').toString('base64')}` }), 'bad_image'));
check('a photo over 2.5 MB is refused', await rejects(save(worker, { image: dataUrl(jpeg(2_600_000)) }), 'too_big'));
const before = db.t.job_photos.length;
check('a storage refusal saves nothing', (await rejects(save(worker, {}, async () => ({ ok: false, status: 400 })), 'storage_refused')) && db.t.job_photos.length === before);
check('no storage set up: refused plainly', await rejects(save(worker, {}, storageOk, {}), 'storage_unavailable'));
while (db.t.job_photos.length < MAX_PER_JOB) await save(worker, { kind: 'after' });
check(`at most ${MAX_PER_JOB} photos a job`, await rejects(save(worker), 'too_many'));
db.t.job_photos.length = 1;
job.status = 'done'; db.t.job_assignments[0].status = 'done'; db.t.job_assignments[0].done_at = new Date(NOW.getTime() - 3600_000).toISOString();
check('photos can still be added the same day the job is marked done', !!(await save(worker, { kind: 'after' })));
db.t.job_assignments[0].done_at = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
check('but not days later', await rejects(save(worker), 'not_your_job'));

await db.insert('job_photos', { organization_id: OTHER, journey_id: job.journey_id, assignment_id: crypto.randomUUID(), kind: 'before', storage_path: 'other/x.jpg', content_type: 'image/jpeg', bytes: 5 });
calls.length = 0;
const list = await photosFor(db, ORG, job.journey_id, { env: ENV, fetchImpl: storageOk });
const signReq = JSON.parse(calls[0].opts.body);
check('the owner sees this business\'s photos only, as one-hour links', list.length === 2 && list.every((p) => p.url.startsWith('https://db.test/storage/v1/object/sign/job-photos/')) && signReq.expiresIn === 3600 && !signReq.paths.includes('other/x.jpg'));
check('no photos: no request to storage at all', (await photosFor(db, ORG, crypto.randomUUID(), { env: ENV, fetchImpl: async () => { throw new Error('should not be called'); } })).length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
