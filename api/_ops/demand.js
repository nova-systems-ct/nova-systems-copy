// Nova Demand — attributable acquisition campaigns (master execution prompt 2026-10-17, section 8).
// This layer prepares and tracks campaigns; it never sends outreach itself. Prospects need a real source and fit
// evidence; contact is permitted only after owner approval, only through approved channels and within the approved
// volume. Inquiries carrying the campaign code are attributed to it; outcomes come from real job/booking/deposit rows.
import crypto from 'node:crypto';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso } from '../_sales/core.js';
import { sanitize } from '../_sanitize.js';
import * as S from './service.js';

const ERR = (status, message) => Object.assign(new Error(message), { status, expose: true });
const CHANNELS = ['email', 'phone', 'in_person', 'referral', 'partner', 'social', 'letter'];
const dedupe = (name, website) => `${String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '')}|${String(website || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')}`;
const event = (orgId, campaignId, prospectId, kind, detail, actor) => dbInsert('demand_events', { organization_id: orgId, campaign_id: campaignId, prospect_id: prospectId, kind, detail: detail || {}, actor_id: actor?.id ? String(actor.id) : actor?.type || null });

async function campaign(orgId, id) {
  const c = await dbOne(`demand_campaigns?id=eq.${enc(id)}&organization_id=eq.${enc(orgId)}&select=*`);
  if (!c) throw ERR(404, 'Campaign not found');
  return c;
}

// Funnel from real records. Recovered (Revive) and repeat customers are not counted: only jobs carrying this campaign.
export async function funnel(orgId, c) {
  // Same rule as the weekly scoreboard: a real business never counts test records; a Nova-owned TEST business counts its own.
  const testBiz = !!(await dbOne(`ops_business_settings?organization_id=eq.${enc(orgId)}&is_test=eq.true&select=organization_id`));
  const [prospects, jobs] = await Promise.all([
    dbGet(`demand_prospects?campaign_id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}&select=status`),
    dbGet(`ops_jobs?demand_campaign_id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}${testBiz ? '' : '&is_test=eq.false'}&select=id,state,fulfillment_status,total_cents`),
  ]);
  const count = (st) => prospects.filter((p) => st.includes(p.status)).length;
  const jobIds = jobs.map((j) => j.id);
  const deposits = jobIds.length ? await dbGet(`ops_deposits?organization_id=eq.${enc(orgId)}&job_id=in.(${jobIds.map(enc).join(',')})&select=status,amount_cents,refunded_cents`) : [];
  const completed = jobs.filter((j) => j.fulfillment_status === 'completed');
  return {
    prospects: prospects.length, approved_for_contact: count(['approved_for_contact', 'contacted', 'replied', 'qualified', 'booked', 'won', 'lost']), contacted: count(['contacted', 'replied', 'qualified', 'booked', 'won', 'lost']), replied: count(['replied', 'qualified', 'booked', 'won']), do_not_contact: count(['do_not_contact']),
    inquiries: jobs.length, quoted: jobs.filter((j) => !['new', 'qualifying', 'escalated', 'lost', 'cancelled'].includes(j.state)).length, booked: jobs.filter((j) => j.state === 'confirmed').length,
    completed_jobs: completed.length, completed_job_value_cents: completed.reduce((a, j) => a + (j.total_cents || 0), 0),
    deposits_collected_cents: deposits.filter((d) => ['paid', 'partially_refunded', 'refunded'].includes(d.status)).reduce((a, d) => a + d.amount_cents, 0),
    refunds_cents: deposits.reduce((a, d) => a + (d.refunded_cents || 0), 0),
    note: `Completed-job value is not profit, and deposits are part of job value (not added to it). ${testBiz ? 'This is a TEST business: its own test records are shown.' : 'Test records are excluded.'}`,
  };
}

export async function handleDemand(req, res, s, isOwner) {
  const b = req.body || {}; const q = req.query || {}; const orgId = s.orgId; const actor = s.actor;
  const action = sanitize(req.method === 'GET' ? q.action : b.action, 30) || 'list';
  if (action === 'list') {
    const rows = await dbGet(`demand_campaigns?organization_id=eq.${enc(orgId)}&select=*&order=created_at.desc`);
    return { campaigns: await Promise.all(rows.map(async (c) => ({ ...c, funnel: await funnel(orgId, c) }))) };
  }
  if (action === 'detail') {
    const c = await campaign(orgId, sanitize(q.id, 60));
    const [prospects, events] = await Promise.all([dbGet(`demand_prospects?campaign_id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}&select=*&order=created_at.asc`), dbGet(`demand_events?campaign_id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}&select=*&order=at.desc&limit=100`)]);
    return { campaign: c, prospects, events, funnel: await funnel(orgId, c) };
  }
  if (action === 'create') {
    const svc = (await S.approvedServices(orgId)).find((p) => p.service_key === sanitize(b.service_key, 40));
    if (!svc) throw ERR(400, 'Choose one of the business’s approved services. Demand only sells what the business has approved.');
    const name = sanitize(b.name, 120); const objective = sanitize(b.objective, 300); const offer = sanitize(b.offer_text, 1000);
    if (!name || !objective || !offer) throw ERR(400, 'Name, objective and offer are required.');
    const channels = (Array.isArray(b.channels) ? b.channels : []).map((x) => sanitize(x, 20)).filter((x) => CHANNELS.includes(x));
    if (!channels.length) throw ERR(400, `Choose at least one permitted channel (${CHANNELS.join(', ')}).`);
    for (let i = 0; i < 5; i++) {
      const code = crypto.randomBytes(4).toString('base64url').replace(/[-_]/g, 'x').slice(0, 6).toUpperCase();
      const ins = await dbInsert('demand_campaigns', { organization_id: orgId, code, name, objective, service_key: svc.service_key, offer_text: offer, capacity_note: sanitize(b.capacity_note, 300) || null, audience: { criteria: sanitize(b.audience, 600) || '', area: sanitize(b.area, 200) || '' }, channels, volume_limit: Number(b.volume_limit) > 0 ? Math.min(5000, Math.round(Number(b.volume_limit))) : null, cost_limit_cents: Number(b.cost_limit_cents) >= 0 && b.cost_limit_cents !== '' && b.cost_limit_cents != null ? Math.round(Number(b.cost_limit_cents)) : null, starts_on: sanitize(b.starts_on, 10) || null, ends_on: sanitize(b.ends_on, 10) || null, created_by: actor.id });
      if (!ins.conflict) { await event(orgId, ins.row.id, null, 'note', { created: true }, actor); return { campaign: ins.row }; }
    }
    throw ERR(500, 'Could not allocate a campaign code');
  }
  const c = await campaign(orgId, sanitize(b.id || b.campaign_id, 60));
  if (action === 'submit') { if (c.status !== 'draft') throw ERR(409, 'Only a draft can be submitted.'); const [r] = await dbPatch('demand_campaigns', `id=eq.${enc(c.id)}&status=eq.draft`, { status: 'pending_approval', updated_at: nowIso() }); return { campaign: r }; }
  if (action === 'approve') {
    if (!isOwner) throw ERR(403, 'Only the business owner can approve a Demand campaign.');
    if (!['draft', 'pending_approval'].includes(c.status)) throw ERR(409, `Campaign is ${c.status}.`);
    const svc = (await S.approvedServices(orgId)).find((p) => p.service_key === c.service_key);
    if (!svc) throw ERR(409, 'The campaign’s service is no longer approved.');
    const prospects = await dbGet(`demand_prospects?campaign_id=eq.${enc(c.id)}&select=id`);
    const snap = { offer_sha256: crypto.createHash('sha256').update(c.offer_text).digest('hex'), service: { key: svc.service_key, name: svc.name, price_cents: svc.price_cents, version: svc.version }, audience: c.audience, channels: c.channels, volume_limit: c.volume_limit, cost_limit_cents: c.cost_limit_cents, starts_on: c.starts_on, ends_on: c.ends_on, attribution_rule: c.attribution_rule, prospects_at_approval: prospects.length };
    const [r] = await dbPatch('demand_campaigns', `id=eq.${enc(c.id)}&status=in.(draft,pending_approval)`, { status: 'approved', approval_snapshot: snap, approved_by: actor.id, approved_at: nowIso(), updated_at: nowIso() });
    await event(orgId, c.id, null, 'approved', snap, actor);
    return { campaign: r };
  }
  if (['pause', 'complete', 'cancel', 'resume'].includes(action)) {
    const to = { pause: 'paused', complete: 'completed', cancel: 'cancelled', resume: 'approved' }[action];
    const from = { pause: ['approved'], complete: ['approved', 'paused'], cancel: ['draft', 'pending_approval', 'approved', 'paused'], resume: ['paused'] }[action];
    if (!from.includes(c.status)) throw ERR(409, `Cannot ${action} a ${c.status} campaign.`);
    const [r] = await dbPatch('demand_campaigns', `id=eq.${enc(c.id)}&status=eq.${enc(c.status)}`, { status: to, updated_at: nowIso() });
    await event(orgId, c.id, null, 'note', { status: to }, actor); return { campaign: r };
  }
  if (action === 'add-prospect') {
    if (['completed', 'cancelled'].includes(c.status)) throw ERR(409, 'This campaign is closed.');
    const bn = sanitize(b.business_name, 160); const src = sanitize(b.source, 400); const fit = sanitize(b.fit_evidence, 800);
    if (!bn || !src || !fit) throw ERR(400, 'Business name, source and fit evidence are required — prospects are never added without where they came from and why they fit.');
    const ins = await dbInsert('demand_prospects', { organization_id: orgId, campaign_id: c.id, business_name: bn, website: sanitize(b.website, 300) || null, contact_name: sanitize(b.contact_name, 120) || null, contact_route: sanitize(b.contact_route, 200) || null, source: src, fit_evidence: fit, verified_at: b.verified === true ? nowIso() : null, dedupe_key: dedupe(bn, b.website), created_by: actor.id });
    if (ins.conflict) throw ERR(409, 'This business is already in the campaign.');
    await event(orgId, c.id, ins.row.id, 'researched', { source: src }, actor); return { prospect: ins.row };
  }
  if (action === 'approve-prospects') {
    if (c.status !== 'approved') throw ERR(409, 'Approve the campaign first. No prospect may be contacted before that.');
    const current = (await dbGet(`demand_prospects?campaign_id=eq.${enc(c.id)}&status=neq.researched&status=neq.do_not_contact&select=id`)).length;
    const room = c.volume_limit ? Math.max(0, c.volume_limit - current) : 1000;
    const pending = (await dbGet(`demand_prospects?campaign_id=eq.${enc(c.id)}&status=eq.researched&select=id&order=created_at.asc&limit=${room}`));
    for (const p of pending) { await dbPatch('demand_prospects', `id=eq.${enc(p.id)}&status=eq.researched`, { status: 'approved_for_contact', last_event_at: nowIso() }); await event(orgId, c.id, p.id, 'approved', {}, actor); }
    return { approved: pending.length, limit_reached: c.volume_limit ? current + pending.length >= c.volume_limit : false };
  }
  if (action === 'prospect-event') {
    const p = await dbOne(`demand_prospects?id=eq.${enc(sanitize(b.prospect_id, 60))}&campaign_id=eq.${enc(c.id)}&organization_id=eq.${enc(orgId)}&select=*`);
    if (!p) throw ERR(404, 'Prospect not found');
    const kind = sanitize(b.kind, 20);
    const allowed = { contacted: ['approved_for_contact', 'contacted'], replied: ['contacted', 'replied'], qualified: ['replied', 'contacted'], lost: ['approved_for_contact', 'contacted', 'replied', 'qualified'], do_not_contact: ['researched', 'approved_for_contact', 'contacted', 'replied', 'qualified', 'lost'] }[kind];
    if (!allowed) throw ERR(400, 'Unknown event');
    if (p.status === 'do_not_contact') throw ERR(409, 'This prospect asked not to be contacted.');
    if (!allowed.includes(p.status)) throw ERR(409, `Cannot record "${kind}" for a prospect who is ${p.status.replace(/_/g, ' ')}.`);
    if (kind === 'contacted') {
      if (c.status !== 'approved') throw ERR(409, 'The campaign is not approved (or is paused); no contact may be recorded.');
      const ch = sanitize(b.channel, 20); if (!c.channels.includes(ch)) throw ERR(409, `"${ch}" is not an approved channel for this campaign.`);
    }
    const [row] = await dbPatch('demand_prospects', `id=eq.${enc(p.id)}&status=eq.${enc(p.status)}`, { status: kind === 'contacted' && p.status === 'contacted' ? 'contacted' : kind, last_event_at: nowIso() });
    if (!row) throw ERR(409, 'The prospect changed meanwhile; reload.');
    await event(orgId, c.id, p.id, kind, { channel: sanitize(b.channel, 20) || null, note: sanitize(b.note, 400) || null }, actor);
    return { prospect: row };
  }
  throw ERR(400, 'Unknown Demand action');
}

// Called by the web-inquiry intake: link an inquiry that carries an approved campaign's code.
export async function attributeInquiry({ orgId, jobId, code }) {
  const c = code ? await dbOne(`demand_campaigns?organization_id=eq.${enc(orgId)}&code=eq.${enc(String(code).toUpperCase().slice(0, 12))}&status=in.(approved,paused)&select=id`) : null;
  if (!c) return null;
  await dbPatch('ops_jobs', `id=eq.${enc(jobId)}&organization_id=eq.${enc(orgId)}&demand_campaign_id=is.null`, { demand_campaign_id: c.id });
  await event(orgId, c.id, null, 'inquiry', { job_id: jobId }, { type: 'system' });
  return c.id;
}
