// Team and job dispatch (system 24) and the pay split (system 25): api/_team.js and the finance
// step in api/_journey.js. In-memory store; no database, provider or person is contacted, and
// nobody is paid. Prices, people and splits are TEST FIXTURES, not anyone's real terms.
import crypto from 'node:crypto';
import { startJourney, acceptQuote, chooseSlot, recordPayment, advance, handleJourney } from '../api/_journey.js';
import { saveWorker, newWorkerLink, workerByToken, assignJob, crewJobs, crewDone, validateShares, saveSplitRule, markPaidOut, teamView } from '../api/_team.js';

const CC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NOW = new Date('2026-11-24T14:00:00Z');
const UNIQUE = { journeys: ['organization_id', 'source_channel', 'source_event_id'], journey_events: ['idempotency_key'], journey_documents: ['journey_id', 'kind', 'seq'], business_services: ['organization_id', 'name'], pay_split_entries: ['journey_id', 'label'], pay_split_rules: ['organization_id'] };
function memoryDb() {
  const t = {}; const rows = (n) => (t[n] ||= []);
  const hit = (r, f) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
  return { t,
    select: async (n, f = {}, { order = 'created_at.asc', limit = 500 } = {}) => { const [c, d] = order.split('.'); return rows(n).filter((r) => hit(r, f)).sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : a._n - b._n) * (d === 'desc' ? -1 : 1)).slice(0, limit).map((r) => ({ ...r })); },
    insert: async (n, row) => { const u = UNIQUE[n]; if (u && rows(n).some((r) => u.every((k) => r[k] === row[k]))) throw Object.assign(new Error('conflict'), { status: 409 }); if (n === 'job_assignments' && row.status === 'assigned' && rows(n).some((r) => r.journey_id === row.journey_id && r.status === 'assigned')) throw Object.assign(new Error('conflict'), { status: 409 }); const full = { id: crypto.randomUUID(), created_at: new Date(NOW.getTime() + rows(n).length).toISOString(), _n: rows(n).length, ...row }; rows(n).push(full); return { ...full }; },
    update: async (n, f, p) => rows(n).filter((r) => hit(r, f)).map((r) => ({ ...Object.assign(r, p) })),
  };
}
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const expectFail = async (p, code) => { try { await p; return false; } catch (e) { return e.code === code; } };
const fresh = async (db, id) => (await db.select('journeys', { id }))[0];
const opts = { now: NOW };

async function seed(priceCents = 4000) {
  const db = memoryDb();
  await db.insert('business_services', { organization_id: CC, name: 'Car detail', keywords: ['detail'], price_cents: priceCents, price_approved: true, deposit_cents: null, active: true });
  const slot = await db.insert('voice_calendar_slots', { organization_id: CC, service_name: 'Detail', start_at: '2026-11-25T15:00:00Z', end_at: '2026-11-25T17:00:00Z', status: 'open' });
  return { db, slot };
}
async function bookedJob(db, slot, name = 'Dana Ruiz') {
  const s = await startJourney(db, { orgId: CC, channel: 'web', eventId: crypto.randomUUID(), name, phone: '(203) 555-0142', text: 'Full detail please, the SUV in the driveway', address: '12 Shore Rd, Westport, CT', now: NOW });
  await acceptQuote(db, s.journey, { quoteId: s.next.quote.id, typedName: name }, opts);
  const n = await chooseSlot(db, await fresh(db, s.journey.id), slot.id, opts);
  return { id: s.journey.id, token: s.token, stage: n.stage };
}

// ============ 1. Workers and their private phone links =====================================
{
  const { db } = await seed();
  const a = await saveWorker(db, CC, { name: 'Marco Pro', phone: '+12035550199', kind: 'contractor' });
  check('adding a worker gives a private link once; only its hash is stored', /^[0-9a-f]{64}$/.test(a.token) && !JSON.stringify(db.t.business_workers).includes(a.token) && db.t.business_workers[0].link_token_hash.length === 64);
  check('what the owner sees never includes the hash', !('link_token_hash' in a.worker) && a.worker.has_link === true && a.worker.kind === 'contractor');
  check('the link finds the worker; a wrong one finds nobody', (await workerByToken(db, a.token))?.name === 'Marco Pro' && !(await workerByToken(db, 'f'.repeat(64))) && !(await workerByToken(db, 'short')));
  const fresh2 = await newWorkerLink(db, CC, a.worker.id);
  check('a new link replaces the old one at once', !(await workerByToken(db, a.token)) && (await workerByToken(db, fresh2.token))?.id === a.worker.id);
  await saveWorker(db, CC, { workerId: a.worker.id, name: 'Marco Pro', kind: 'contractor', active: false });
  check('a worker who is turned off cannot open the page', !(await workerByToken(db, fresh2.token)));
  check('a worker needs a name', await expectFail(saveWorker(db, CC, { name: '  ' }), 'name_required'));
}

// ============ 2. Assigning a booked job, and the worker's phone page =======================
{
  const { db, slot } = await seed();
  const marco = await saveWorker(db, CC, { name: 'Marco Pro', phone: '+12035550199', kind: 'contractor' });
  const lee = await saveWorker(db, CC, { name: 'Lee Crew', kind: 'employee' });
  const outsider = await saveWorker(db, OTHER, { name: 'Other Shop Worker' });
  const s = await startJourney(db, { orgId: CC, channel: 'web', eventId: crypto.randomUUID(), name: 'Pat', email: 'pat@example.invalid', text: 'detail', now: NOW });
  check('a job that is only quoted cannot be assigned', await expectFail(assignJob(db, CC, { journeyId: s.journey.id, workerId: marco.worker.id }), 'wrong_stage'));
  const job = await bookedJob(db, slot);
  check('the booked job is scheduled', job.stage === 'scheduled');
  check('another business\'s worker cannot be given this job', await expectFail(assignJob(db, CC, { journeyId: job.id, workerId: outsider.worker.id }), 'unknown_worker'));
  await assignJob(db, CC, { journeyId: job.id, workerId: lee.worker.id, by: 'owner@example.invalid' });
  await assignJob(db, CC, { journeyId: job.id, workerId: marco.worker.id, by: 'owner@example.invalid' });
  const live = db.t.job_assignments.filter((x) => x.journey_id === job.id && x.status === 'assigned');
  check('reassigning leaves exactly one live assignment, with the new worker', live.length === 1 && live[0].worker_id === marco.worker.id && db.t.job_assignments.find((x) => x.worker_id === lee.worker.id).status === 'cancelled');
  check('the assignment is in the job\'s history', db.t.journey_events.some((e) => e.journey_id === job.id && e.action === 'job_assigned'));

  const page = await crewJobs(db, await workerByToken(db, marco.token), NOW);
  const card = page.jobs[0];
  check('the worker\'s phone shows the job, time, address and request', page.jobs.length === 1 && card.service === 'Car detail' && card.start_at === slot.start_at && card.address === '12 Shore Rd, Westport, CT' && /SUV/.test(card.request));
  check('it shows only the customer\'s first name and phone, nothing else about them', card.customer === 'Dana' && card.customer_phone === '+12035550142' && !JSON.stringify(page).includes('Ruiz') && !JSON.stringify(page).includes('@'));
  check('a worker who was taken off the job no longer sees it', (await crewJobs(db, await workerByToken(db, lee.token), NOW)).jobs.length === 0);
  check('another worker cannot mark someone else\'s job done', await expectFail(crewDone(db, await workerByToken(db, lee.token), { assignmentId: card.assignment_id, note: 'Did the whole thing, inside and out.' }, opts), 'not_your_job'));
  check('Done needs a sentence about what was done', await expectFail(crewDone(db, await workerByToken(db, marco.token), { assignmentId: card.assignment_id, note: 'done' }, opts), 'evidence_required'));
  const out = await crewDone(db, await workerByToken(db, marco.token), { assignmentId: card.assignment_id, note: 'Full interior and exterior detail. Photos sent to the owner.' }, opts);
  const after = await fresh(db, job.id);
  check('Done on the phone records the work and the balance is invoiced at once', out.stage === 'balance_due' && after.stage === 'balance_due' && db.t.journey_documents.some((d) => d.journey_id === job.id && d.kind === 'balance_invoice' && d.amount_cents === 4000));
  check('the completion says who did it and as what', db.t.journey_documents.find((d) => d.kind === 'completion').body.includes('Recorded by: Marco Pro (independent pro)'));
  check('the assignment is marked done, with the time', db.t.job_assignments.find((x) => x.id === card.assignment_id).status === 'done' && !!db.t.job_assignments.find((x) => x.id === card.assignment_id).done_at);
  check('pressing Done twice changes nothing', await expectFail(crewDone(db, await workerByToken(db, marco.token), { assignmentId: card.assignment_id, note: 'Again, the whole thing done.' }, opts), 'not_your_job'));
}

// ============ 3. The split rule ===========================================================
{
  check('a split must add up to exactly 100%', validateShares([{ label: 'A', percent: 50 }, { label: 'B', percent: 40 }]).includes('90.00%'));
  check('two decimals are fine (33.33 / 33.33 / 33.34)', validateShares([{ label: 'A', percent: 33.33 }, { label: 'B', percent: 33.33 }, { label: 'C', percent: 33.34 }]) === null);
  check('three decimals, zero or negative percents are refused', !!validateShares([{ label: 'A', percent: 33.333 }, { label: 'B', percent: 66.667 }]) && !!validateShares([{ label: 'A', percent: 0 }, { label: 'B', percent: 100 }]) && !!validateShares([{ label: 'A', percent: -10 }, { label: 'B', percent: 110 }]));
  check('names must differ, and only one share goes to the worker', !!validateShares([{ label: 'A', percent: 50 }, { label: 'a', percent: 50 }]) && !!validateShares([{ label: 'A', percent: 50, to_worker: true }, { label: 'B', percent: 50, to_worker: true }]));
  check('at most six shares', !!validateShares(Array.from({ length: 7 }, (_, i) => ({ label: `S${i}`, percent: i ? 10 : 40 }))));
}

// ============ 4. A paid $40 test job shows each share ======================================
{
  const { db, slot } = await seed(4000);
  const marco = await saveWorker(db, CC, { name: 'Marco Pro', kind: 'contractor' });
  await saveSplitRule(db, CC, { shares: [{ label: 'Worker', percent: 50, to_worker: true }, { label: 'Isaac', percent: 25 }, { label: 'Company', percent: 25 }], approved: true, by: 'owner@example.invalid' });
  const job = await bookedJob(db, slot);
  await assignJob(db, CC, { journeyId: job.id, workerId: marco.worker.id });
  const card = (await crewJobs(db, await workerByToken(db, marco.token), NOW)).jobs[0];
  await crewDone(db, await workerByToken(db, marco.token), { assignmentId: card.assignment_id, note: 'Exterior wash and interior vacuum done.' }, opts);
  await recordPayment(db, await fresh(db, job.id), { amountCents: 4000, source: 'owner_recorded', reference: 'cash-40' }, opts);
  const e = db.t.pay_split_entries || [];
  const share = (label) => e.find((x) => x.label === label);
  check('a paid $40 job shows each share: $20, $10, $10', e.length === 3 && share('Worker').amount_cents === 2000 && share('Isaac').amount_cents === 1000 && share('Company').amount_cents === 1000);
  check('the worker\'s share is tied to the worker who did the job', share('Worker').worker_id === marco.worker.id && share('Isaac').worker_id === null);
  check('every share records the money it came from and the rule used', e.every((x) => x.basis_cents === 4000 && Array.isArray(x.rule_snapshot) && x.rule_snapshot.length === 3));
  check('the job closed normally, with the split in its history', (await fresh(db, job.id)).stage === 'closed' && db.t.journey_events.some((x) => x.action === 'pay_split_recorded'));
  await advance(db, await fresh(db, job.id), opts);
  check('nothing is recorded twice', (db.t.pay_split_entries || []).length === 3);
  const view = await teamView(db, CC);
  check('the owner sees what each worker has not been paid yet', view.workers.find((w) => w.id === marco.worker.id).unpaid_cents === 2000);
  await markPaidOut(db, CC, share('Worker').id, 'owner@example.invalid');
  check('a person marks the worker paid; Nova pays no one', !!(db.t.pay_split_entries.find((x) => x.label === 'Worker').paid_out_at) && (await teamView(db, CC)).workers[0].unpaid_cents === 0);
  check('it cannot be marked paid out twice', await expectFail(markPaidOut(db, CC, share('Worker').id, 'x'), 'not_found'));
}

// ============ 5. Rounding, no rule, and the Crystal Clear pro split ======================
{
  const { db, slot } = await seed(19900);
  await saveSplitRule(db, CC, { shares: [{ label: 'Pro', percent: 50, to_worker: true }, { label: 'Crystal Clear', percent: 50 }], approved: false });
  const job = await bookedJob(db, slot);
  const w = await saveWorker(db, CC, { name: 'Pro One' });
  await assignJob(db, CC, { journeyId: job.id, workerId: w.worker.id });
  await crewDone(db, await workerByToken(db, w.token), { assignmentId: db.t.job_assignments[0].id, note: 'Full detail on the SUV, inside and out.' }, opts);
  await recordPayment(db, await fresh(db, job.id), { amountCents: 19900, source: 'owner_recorded', reference: 'link-1' }, opts);
  check('a split the owner has not approved is never used', !(db.t.pay_split_entries || []).length && (await fresh(db, job.id)).stage === 'closed');
  const { db: db2, slot: s2 } = await seed(19900);
  await saveSplitRule(db2, CC, { shares: [{ label: 'Pro', percent: 50, to_worker: true }, { label: 'Crystal Clear', percent: 50 }], approved: true });
  const j2 = await bookedJob(db2, s2);
  const w2 = await saveWorker(db2, CC, { name: 'Pro One' });
  await assignJob(db2, CC, { journeyId: j2.id, workerId: w2.worker.id });
  await crewDone(db2, await workerByToken(db2, w2.token), { assignmentId: db2.t.job_assignments[0].id, note: 'Full detail on the SUV, inside and out.' }, opts);
  await recordPayment(db2, await fresh(db2, j2.id), { amountCents: 19900, source: 'owner_recorded', reference: 'link-1' }, opts);
  check('a $199 job split 50/50 with the pro: $99.50 each', db2.t.pay_split_entries.map((x) => x.amount_cents).join(',') === '9950,9950');
  const { db: db3, slot: s3 } = await seed(4999);
  await saveSplitRule(db3, CC, { shares: [{ label: 'A', percent: 33.33 }, { label: 'B', percent: 33.33 }, { label: 'C', percent: 33.34 }], approved: true });
  const j3 = await bookedJob(db3, s3);
  const w3 = await saveWorker(db3, CC, { name: 'W' });
  await assignJob(db3, CC, { journeyId: j3.id, workerId: w3.worker.id });
  await crewDone(db3, await workerByToken(db3, w3.token), { assignmentId: db3.t.job_assignments[0].id, note: 'Job finished, customer happy.' }, opts);
  await recordPayment(db3, await fresh(db3, j3.id), { amountCents: 4999, source: 'owner_recorded', reference: 'r' }, opts);
  const amounts = db3.t.pay_split_entries.map((x) => x.amount_cents);
  check('shares always add up to the money received; the last share takes the leftover cent', amounts.reduce((n, x) => n + x, 0) === 4999 && amounts[0] === 1666 && amounts[2] === 1667);
}

// ============ 6. HTTP: the worker page and the owner's buttons =============================
{
  const { db, slot } = await seed();
  process.env.SUPABASE_URL = 'https://db.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'; process.env.APP_BASE_URL = 'https://preview.example.invalid';
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url)), table = u.pathname.replace('/rest/v1/', ''), f = {};
    for (const [k, v] of u.searchParams) if (!['order', 'limit'].includes(k)) f[k] = v === 'is.null' ? null : (v.slice(3) === 'true' ? true : v.slice(3) === 'false' ? false : decodeURIComponent(v.slice(3)));
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    try {
      if (!init.method) return json(200, await db.select(table, f, { order: u.searchParams.get('order') || 'created_at.asc', limit: Number(u.searchParams.get('limit')) || 500 }));
      if (init.method === 'POST') return json(201, [await db.insert(table, JSON.parse(init.body))]);
      return json(200, await db.update(table, f, JSON.parse(init.body)));
    } catch (e) { return json(e.status || 500, {}); }
  };
  const perms = [];
  const deps = (allowed = true) => ({ requireStaff: async () => ({ id: 'u1', email: 'owner@example.invalid' }), requireOrgAccess: async (_r, res, _o, perm) => { perms.push(perm); if (!allowed) res.status(403).json({ error: 'no' }); return allowed; }, sanitize: (v, n = 2000) => (typeof v === 'string' ? v.trim().slice(0, n) : ''), sanitizeEmail: (v) => (typeof v === 'string' && /^\S+@\S+\.\S+$/.test(v) ? v.trim().toLowerCase() : ''), rateLimit: () => true });
  const call = async (method, op, payload, d = deps()) => { const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; } }; await handleJourney({ method, query: method === 'GET' ? payload : {}, body: method === 'POST' ? payload : undefined }, res, op, d); return res; };

  let r = await call('POST', 'start', { organization_id: CC, submission_id: crypto.randomUUID(), name: 'Rae', phone: '2035550177', message: 'detail', address: '9 Beach Rd, Fairfield, CT' });
  check('the customer page saves the job address', r.code === 200 && db.t.journeys.find((j) => j.id === r.body.journey_id).service_address === '9 Beach Rd, Fairfield, CT');
  r = await call('POST', 'save-worker', { organization_id: CC, name: 'Marco Pro', phone: '(203) 555-0199', kind: 'contractor' });
  const link = r.body.link;
  check('adding a worker returns their phone link once', r.code === 200 && /^https:\/\/preview\.example\.invalid\/crew\?t=[0-9a-f]{64}$/.test(link) && perms.at(-1) === 'business.manage');
  r = await call('GET', 'team', { organization_id: CC });
  check('the Team tab lists workers without any link secret', r.code === 200 && r.body.workers.length === 1 && !JSON.stringify(r.body).includes('link_token_hash'));
  const job = await bookedJob(db, slot);
  r = await call('POST', 'assign', { organization_id: CC, journey_id: job.id, worker_id: r.body.workers[0].id });
  check('assigning a job needs only the scheduling permission', r.code === 200 && perms.at(-1) === 'growth.view');
  r = await call('POST', 'assign', { organization_id: CC, journey_id: job.id, worker_id: db.t.business_workers[0].id }, deps(false));
  check('staff from outside the business cannot assign its jobs', r.code === 403);
  const t = link.split('t=')[1];
  r = await call('POST', 'crew-jobs', { t: 'f'.repeat(64) });
  check('a wrong worker link shows nothing', r.code === 404);
  r = await call('POST', 'crew-jobs', { t });
  check('the worker\'s link shows the job', r.code === 200 && r.body.jobs.length === 1 && r.body.jobs[0].can_mark_done === true);
  r = await call('POST', 'crew-done', { t, assignment_id: r.body.jobs[0].assignment_id, note: 'Full detail done, keys returned to the owner.' });
  check('Done from the phone moves the job to its invoice and refreshes the list', r.code === 200 && r.body.stage === 'balance_due' && r.body.jobs[0].status === 'done');
  r = await call('POST', 'save-split', { organization_id: CC, shares: [{ label: 'Pro', percent: 60, to_worker: true }, { label: 'Business', percent: 30 }], approved: true });
  check('a split that does not add up is refused with the reason', r.code === 422 && /90\.00%/.test(r.body.error));
  r = await call('POST', 'save-split', { organization_id: CC, shares: [{ label: 'Pro', percent: 50, to_worker: true }, { label: 'Business', percent: 50 }], approved: true });
  check('a valid split is saved and approved by the owner', r.code === 200 && r.body.rule.approved === true && r.body.rule.approved_by === 'owner@example.invalid');
}

console.log(`\n${pass}/${pass + fail} team and pay checks passed (in-memory store, test people and prices — no database contacted, nobody paid)`);
process.exit(fail ? 1 : 0);
