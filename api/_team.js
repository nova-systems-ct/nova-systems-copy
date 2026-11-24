// Team and job dispatch (Nova system 24) and the pay split rule (system 25).
//
// The owner adds the people who do the jobs (employees or independent pros) and assigns each
// booked job to one of them. A worker gets a private link to a phone page that lists their jobs;
// pressing "Done" there records the completion through the same journey step the owner uses
// (completeWork), so the balance is invoiced at once. The link is the worker's only key, and
// only its SHA-256 is stored; a new link replaces the old one.
//
// The pay split is each business's own rule, approved by the owner. When a job is fully paid,
// the finance step records each person's share of the money actually received (see
// recordSplit in _journey.js). It is a record only: paying anyone is done by a person.
import crypto from 'node:crypto';
import { completeWork, recordStep } from './_journey.js';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const fail = (code, message, status = 409) => Object.assign(new Error(message), { code, status, expected: true });
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const TOKEN_RE = /^[0-9a-f]{64}$/;
const DAY = 86400000;
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'Customer';
const publicWorker = ({ link_token_hash, ...w }) => ({ ...w, has_link: !!link_token_hash });

// ---- workers -------------------------------------------------------------------------------

export async function saveWorker(db, orgId, { workerId, name, phone, email, kind, active }) {
  const clean = String(name || '').trim().slice(0, 100);
  if (!clean) throw fail('name_required', 'Enter the worker\'s name.', 422);
  const row = { organization_id: orgId, name: clean, phone: phone || null, email: email || null, kind: kind === 'employee' ? 'employee' : 'contractor', active: active !== false, updated_at: new Date().toISOString() };
  if (workerId) {
    const rows = await db.update('business_workers', { id: workerId, organization_id: orgId }, row);
    if (!rows.length) throw fail('not_found', 'That worker was not found.', 404);
    if (row.active === false) await cancelOpenAssignments(db, orgId, { worker_id: workerId });
    return { worker: publicWorker(rows[0]) };
  }
  const worker = await db.insert('business_workers', row);
  const link = await newWorkerLink(db, orgId, worker.id);
  return { worker: publicWorker({ ...worker, link_token_hash: 'set' }), token: link.token };
}

// A fresh private link for a worker. The old link stops working at once.
export async function newWorkerLink(db, orgId, workerId) {
  const token = crypto.randomBytes(32).toString('hex');
  const rows = await db.update('business_workers', { id: workerId, organization_id: orgId }, { link_token_hash: sha(token), updated_at: new Date().toISOString() });
  if (!rows.length) throw fail('not_found', 'That worker was not found.', 404);
  return { token };
}

export async function workerByToken(db, token) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  const w = await one(db, 'business_workers', { link_token_hash: sha(token) });
  return w && w.active !== false ? w : null;
}

async function cancelOpenAssignments(db, orgId, filter) {
  return db.update('job_assignments', { organization_id: orgId, status: 'assigned', ...filter }, { status: 'cancelled', updated_at: new Date().toISOString() });
}

// ---- dispatch ------------------------------------------------------------------------------

export async function assignJob(db, orgId, { journeyId, workerId, by }) {
  const j = await one(db, 'journeys', { id: journeyId, organization_id: orgId });
  if (!j) throw fail('not_found', 'That job was not found.', 404);
  if (!['scheduling', 'scheduled'].includes(j.stage)) throw fail('wrong_stage', 'Only a job that is booked, or being booked, can be assigned.');
  const worker = await one(db, 'business_workers', { id: workerId, organization_id: orgId });
  if (!worker || worker.active === false) throw fail('unknown_worker', 'Choose one of your active workers.', 422);
  await cancelOpenAssignments(db, orgId, { journey_id: j.id });
  const a = await db.insert('job_assignments', { organization_id: orgId, journey_id: j.id, worker_id: worker.id, status: 'assigned', assigned_by: by || null });
  await recordStep(db, j, { agent: 'owner', action: 'job_assigned', key: `assign:${a.id}`, detail: { worker: worker.name, worker_kind: worker.kind } });
  return { assignment: a, worker: publicWorker(worker) };
}

// What a worker sees on their phone: their open jobs, soonest first, and what they finished in
// the last week. Only what the job needs: the customer's first name, phone, request and address.
export async function crewJobs(db, worker, now = new Date()) {
  const mine = await db.select('job_assignments', { organization_id: worker.organization_id, worker_id: worker.id });
  const jobs = [];
  for (const a of mine) {
    if (a.status === 'cancelled' || (a.status === 'done' && now - new Date(a.done_at) > 7 * DAY)) continue;
    const j = await one(db, 'journeys', { id: a.journey_id, organization_id: worker.organization_id });
    if (!j) continue;
    const [svc, slot, contact] = await Promise.all([
      j.service_id ? one(db, 'business_services', { id: j.service_id, organization_id: j.organization_id }) : null,
      j.slot_id ? one(db, 'voice_calendar_slots', { id: j.slot_id, organization_id: j.organization_id }) : null,
      one(db, 'crm_contacts', { id: j.contact_id, organization_id: j.organization_id }),
    ]);
    jobs.push({
      assignment_id: a.id, status: a.status, done_at: a.done_at || null,
      photos: (await db.select('job_photos', { organization_id: worker.organization_id, assignment_id: a.id }, { limit: 13 })).length,
      service: svc?.name || 'Job', start_at: slot?.start_at || null, end_at: slot?.end_at || null,
      customer: firstName(contact?.name), customer_phone: contact?.phone || null,
      request: j.request_text || null, address: j.service_address || null,
      can_mark_done: a.status === 'assigned' && j.stage === 'scheduled' && !j.paused,
    });
  }
  const t = (x) => (x.start_at ? new Date(x.start_at).getTime() : Infinity);
  return { worker: { name: worker.name }, jobs: jobs.sort((a, b) => (a.status === b.status ? t(a) - t(b) : a.status === 'assigned' ? -1 : 1)) };
}

// "Done" on the worker's phone. The note is the completion evidence; the journey then invoices
// whatever balance is left, by itself.
export async function crewDone(db, worker, { assignmentId, note }, opts = {}) {
  const a = await one(db, 'job_assignments', { id: assignmentId, organization_id: worker.organization_id, worker_id: worker.id });
  if (!a || a.status !== 'assigned') throw fail('not_your_job', 'This job is not open for you.', 404);
  const j = await one(db, 'journeys', { id: a.journey_id, organization_id: worker.organization_id });
  if (!j || j.paused) throw fail('not_your_job', 'The business is handling this job personally.');
  const next = await completeWork(db, j, { note, by: `${worker.name} (${worker.kind === 'employee' ? 'employee' : 'independent pro'})` }, opts);
  const now = (opts.now || new Date()).toISOString();
  await db.update('job_assignments', { id: a.id, organization_id: worker.organization_id, status: 'assigned' }, { status: 'done', note: String(note).trim().slice(0, 2000), done_at: now, updated_at: now });
  return { stage: next.stage };
}

// ---- pay split -----------------------------------------------------------------------------

// Up to six shares, each with a label and a percent (up to two decimals), totalling exactly 100;
// at most one share goes to whoever did the job.
export function validateShares(shares) {
  if (!Array.isArray(shares) || shares.length < 1 || shares.length > 6) return 'Add between one and six shares.';
  const labels = new Set(); let total = 0, toWorker = 0;
  for (const s of shares) {
    const label = String(s?.label || '').trim();
    const pct = Number(s?.percent);
    if (!label || label.length > 60) return 'Give every share a short name.';
    if (labels.has(label.toLowerCase())) return 'Each share needs a different name.';
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100 || Math.abs(pct * 100 - Math.round(pct * 100)) > 1e-6) return 'Each percent is above 0, at most 100, with up to two decimals.';
    labels.add(label.toLowerCase()); total += Math.round(pct * 100); if (s.to_worker === true) toWorker++;
  }
  if (total !== 10000) return `The shares add up to ${(total / 100).toFixed(2)}%. They must add up to exactly 100%.`;
  if (toWorker > 1) return 'Only one share can go to the person who did the job.';
  return null;
}

export async function saveSplitRule(db, orgId, { shares, approved, by }) {
  const problem = validateShares(shares);
  if (problem) throw fail('bad_split', problem, 422);
  const row = { organization_id: orgId, shares: shares.map((s) => ({ label: String(s.label).trim(), percent: Number(s.percent), to_worker: s.to_worker === true })), approved: approved === true, approved_by: approved === true ? by || null : null, updated_at: new Date().toISOString() };
  const existing = await one(db, 'pay_split_rules', { organization_id: orgId });
  return existing ? (await db.update('pay_split_rules', { organization_id: orgId }, row))[0] : db.insert('pay_split_rules', row);
}

export async function markPaidOut(db, orgId, entryId, by) {
  const rows = await db.update('pay_split_entries', { id: entryId, organization_id: orgId, paid_out_at: null }, { paid_out_at: new Date().toISOString(), paid_out_by: by || null });
  if (!rows.length) throw fail('not_found', 'That share was not found or is already marked paid out.', 404);
  return rows[0];
}

// The owner's Team & pay tab.
export async function teamView(db, orgId) {
  const [workers, rule, open, entries] = await Promise.all([
    db.select('business_workers', { organization_id: orgId }, { order: 'created_at.asc', limit: 200 }),
    one(db, 'pay_split_rules', { organization_id: orgId }),
    db.select('job_assignments', { organization_id: orgId, status: 'assigned' }, { order: 'created_at.desc', limit: 200 }),
    db.select('pay_split_entries', { organization_id: orgId }, { order: 'created_at.desc', limit: 300 }),
  ]);
  const owed = entries.filter((e) => e.worker_id && !e.paid_out_at).reduce((m, e) => { m[e.worker_id] = (m[e.worker_id] || 0) + e.amount_cents; return m; }, {});
  return { workers: workers.map((w) => ({ ...publicWorker(w), unpaid_cents: owed[w.id] || 0 })), rule, assignments: open, entries };
}
