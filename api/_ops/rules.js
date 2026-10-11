// Nova Operations — pure decision logic. No I/O, no clock reads except through arguments, no network.
// Every function here DECIDES; the service layer (api/_ops/service.js) persists and acts.
// Unit-tested in scripts/unit_ops_rules_test.mjs.
import crypto from 'node:crypto';

// =============================================================================================
// Money: integer cents only. A price exists only on an APPROVED rule; options only from that rule.
// =============================================================================================
export function computeQuote(rule, optionKeys = []) {
  if (!rule || rule.status !== 'approved') return { ok: false, reason: 'no_approved_price' };
  if (rule.quote_required || rule.price_cents == null) return { ok: false, reason: 'owner_quote_required' };
  const allowed = new Map((Array.isArray(rule.options) ? rule.options : []).map((o) => [o.key, o]));
  const chosen = [];
  for (const k of [...new Set(optionKeys)]) {
    const o = allowed.get(k);
    if (!o || !Number.isInteger(o.price_cents) || o.price_cents < 0) return { ok: false, reason: 'option_not_approved', option: k };
    chosen.push({ key: o.key, name: o.name, price_cents: o.price_cents });
  }
  const subtotal = rule.price_cents + chosen.reduce((s, o) => s + o.price_cents, 0);
  const tax = Math.round((subtotal * (rule.tax_bps || 0)) / 10_000);
  const total = subtotal + tax;
  const deposit = Math.min(rule.deposit_cents || 0, total);
  return {
    ok: true, subtotal_cents: subtotal, tax_cents: tax, total_cents: total, deposit_cents: deposit, currency: rule.currency || 'usd',
    snapshot: {
      price_rule_id: rule.id, service_key: rule.service_key, service_name: rule.name, version: rule.version,
      base_cents: rule.price_cents, options: chosen, tax_bps: rule.tax_bps || 0, subtotal_cents: subtotal, tax_cents: tax,
      total_cents: total, deposit_cents: deposit, currency: rule.currency || 'usd',
      duration_minutes: rule.duration_minutes, buffer_minutes: rule.buffer_minutes || 0, approved_at: rule.approved_at,
    },
  };
}
export const formatMoney = (cents, currency = 'usd') => `${currency.toLowerCase() === 'usd' ? '$' : `${currency.toUpperCase()} `}${(cents / 100).toFixed(2)}`;

// =============================================================================================
// State machines. A transition not listed is refused.
// =============================================================================================
export const MACHINES = {
  job: {
    new: ['qualifying', 'escalated', 'lost', 'cancelled'],
    qualifying: ['quoted', 'owner_quote_required', 'escalated', 'lost', 'cancelled'],
    owner_quote_required: ['quoted', 'escalated', 'lost', 'cancelled'],
    quoted: ['booking', 'escalated', 'lost', 'cancelled'],
    booking: ['awaiting_agreement', 'quoted', 'escalated', 'lost', 'cancelled'],
    awaiting_agreement: ['awaiting_deposit', 'confirmed', 'booking', 'escalated', 'lost', 'cancelled'],
    awaiting_deposit: ['confirmed', 'booking', 'escalated', 'lost', 'cancelled'],
    escalated: ['qualifying', 'quoted', 'booking', 'awaiting_agreement', 'awaiting_deposit', 'confirmed', 'lost', 'cancelled'],
    confirmed: ['cancelled'],
    lost: [], cancelled: [],
  },
  booking: { held: ['confirmed', 'expired', 'cancelled'], confirmed: ['completed', 'no_show', 'cancelled'], expired: [], cancelled: [], completed: [], no_show: [] },
  agreement: { sent: ['signed', 'void', 'expired'], signed: ['void'], void: [], expired: [] },
  deposit: { created: ['checkout_open', 'cancelled', 'failed'], checkout_open: ['paid', 'expired', 'failed', 'cancelled'], paid: ['refunded', 'partially_refunded'], partially_refunded: ['refunded'], failed: [], expired: [], refunded: [], cancelled: [] },
  fulfillment: { not_ready: ['ready', 'cancelled'], ready: ['in_progress', 'completed', 'no_show', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: [], no_show: [], cancelled: [] },
  campaign: { draft: ['approved', 'cancelled'], approved: ['running', 'draft', 'cancelled'], running: ['paused', 'completed', 'cancelled'], paused: ['running', 'cancelled'], completed: [], cancelled: [] },
  incident: { open: ['acknowledged', 'resolved'], acknowledged: ['resolved', 'open'], resolved: [] },
};
export function canTransition(machine, from, to) { return !!MACHINES[machine]?.[from]?.includes(to); }

// =============================================================================================
// Time zones (DST-correct through Intl; no hand-rolled offsets).
// =============================================================================================
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function localParts(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24, mi: +p.minute, s: +p.second, weekday: WD.indexOf(p.weekday.slice(0, 3).toLowerCase()) };
}
function offsetMs(date, timeZone) {
  const p = localParts(date, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - (date.getTime() - date.getUTCMilliseconds());
}
// Local wall time → UTC instant. Returns null for wall times that do not exist (spring-forward gap).
export function zonedToUtc({ y, m, d, h, mi = 0 }, timeZone) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offsetMs(new Date(guess), timeZone);
  const o2 = offsetMs(new Date(t), timeZone);
  t = guess - o2;
  const back = localParts(new Date(t), timeZone);
  if (back.y !== y || back.m !== m || back.d !== d || back.h !== h || back.mi !== mi) return null;
  return new Date(t);
}
const addDaysYmd = ({ y, m, d }, n) => { const t = new Date(Date.UTC(y, m - 1, d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
const hm = (s) => { const mt = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return mt ? { h: +mt[1], mi: +mt[2] } : null; };

// Business hours: {mon:[{start:'08:00',end:'18:00'}], ...}. Unknown/empty hours produce NO slots (never assumed).
export function generateSlots({ now, timeZone, businessHours, durationMinutes, bufferMinutes = 0, intervalMinutes = 30, leadHours = 0, horizonDays = 14, busy = [], limit = 3 }) {
  if (!timeZone || !businessHours || typeof businessHours !== 'object') return [];
  const earliest = now.getTime() + leadHours * 3600_000;
  const today = localParts(now, timeZone);
  const out = [];
  for (let i = 0; i <= horizonDays && out.length < limit; i++) {
    const day = addDaysYmd(today, i);
    const wd = WD[new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()];
    for (const win of businessHours[wd] || []) {
      const a = hm(win.start), b = hm(win.end); if (!a || !b) continue;
      const winEnd = zonedToUtc({ ...day, ...b }, timeZone); if (!winEnd) continue;
      for (let minutes = a.h * 60 + a.mi; minutes + durationMinutes <= b.h * 60 + b.mi && out.length < limit; minutes += intervalMinutes) {
        const start = zonedToUtc({ ...day, h: Math.floor(minutes / 60), mi: minutes % 60 }, timeZone);
        if (!start || start.getTime() < earliest) continue;
        const end = new Date(start.getTime() + durationMinutes * 60_000);
        if (end > winEnd) continue;
        const blockEnd = end.getTime() + bufferMinutes * 60_000;
        if (busy.some((x) => start.getTime() < new Date(x.end).getTime() && new Date(x.start).getTime() < blockEnd)) continue;
        out.push({ start: start.toISOString(), end: end.toISOString(), block_end: new Date(blockEnd).toISOString() });
      }
    }
  }
  return out;
}
export function formatSlot(iso, timeZone) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

// =============================================================================================
// Conversation engine (deterministic). Inputs are data; customer text is never an instruction.
// =============================================================================================
const PROFANITY = /\b(f+u+c+k+\w*|shit\w*|bitch\w*|asshole\w*|bastard\w*|damn\s+you|piss\s+off)\b/i;
const NEGATIVE = /\b(angry|furious|terrible|awful|worst|scam|ripoff|rip[- ]off|lawyer|sue|complain\w*|refund|ridiculous|unacceptable|horrible|disgusted)\b/i;
const HUMAN = /\b(human|person|agent|representative|real\s+person|someone|call\s+me|speak\s+to|talk\s+to)\b/i;
const NEGOTIATE = /\b(discount|cheaper|deal|lower\s+price|best\s+price|negotiat\w*|coupon|match\s+(the\s+)?price|price\s+match|knock\s+off|less\s+than)\b/i;
const PRICE_Q = /\b(how\s+much|price|cost|rate|charge|quote)\b/i;
const EMERGENCY = /\b(emergency|911|fire|injur\w*|bleeding|unsafe|danger\w*)\b/i;

export function screenText(text) {
  const t = String(text || '');
  if (EMERGENCY.test(t)) return 'emergency';
  if (PROFANITY.test(t)) return 'profanity';
  if (NEGATIVE.test(t)) return 'negative_sentiment';
  if (HUMAN.test(t)) return 'human_requested';
  return null;
}
export function matchService(text, services) {
  const t = String(text || '').trim().toLowerCase();
  const n = /^\s*(\d{1,2})\s*[.)]?\s*$/.exec(t);
  if (n) { const s = services[+n[1] - 1]; return s ? { service_key: s.service_key, confidence: 1, method: 'menu_number' } : null; }
  const hits = services.filter((s) => {
    const words = [s.name, s.service_key.replace(/_/g, ' '), ...(s.keywords || [])].join(' ').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    return words.some((w) => t.includes(w));
  });
  if (hits.length === 1) return { service_key: hits[0].service_key, confidence: 0.9, method: 'keyword' };
  return null; // ambiguous or none → never guess
}
export function matchSlotChoice(text, options) {
  const n = /^\s*(\d{1,2})\s*[.)]?\s*$/.exec(String(text || ''));
  return n && options[+n[1] - 1] ? options[+n[1] - 1] : null;
}
export const CONFIDENCE_THRESHOLD = 0.85;
const serviceLine = (s, i) => `${i + 1}) ${s.name}${s.quote_required ? ' (priced by quote)' : ` ${formatMoney(s.price_cents, s.currency)}`}`;

// decide(): one inbound message → reply + next state + actions. The service layer executes actions
// (escalate, hold a slot, request an owner quote) and fills in links; prices come only from `services`.
export function decide({ state, context = {}, text, services, slots = [], slotsFor = null, business, timeZone, modelHint = null }) {
  const ctx = { ...context };
  const biz = business?.display_name || 'our team';
  const screen = screenText(text);
  if (state === 'escalated' || state === 'human') return { reply: null, nextState: state, context: ctx, actions: [] };
  if (screen) {
    const reply = screen === 'emergency'
      ? `This is an automated assistant for ${biz} and cannot help with emergencies. If anyone is in danger, call 911. A team member has been notified.`
      : `Thanks — I've asked a person from ${biz} to take it from here. They'll reply here as soon as they can.`;
    return { reply, nextState: 'escalated', context: ctx, actions: [{ type: 'escalate', reason: screen }] };
  }
  if (!services.length) return { reply: `Thanks for contacting ${biz}. A team member will reply shortly.`, nextState: 'escalated', context: ctx, actions: [{ type: 'escalate', reason: 'no_approved_services' }] };

  if (NEGOTIATE.test(text) && ctx.service_key) {
    const s = services.find((x) => x.service_key === ctx.service_key);
    const price = s && !s.quote_required ? formatMoney(s.price_cents, s.currency) : 'set by quote';
    return { reply: `Our price for ${s?.name || 'that service'} is ${price}. Prices are fixed by ${biz}; the assistant can't change them. Reply HUMAN if you'd like a person to review a special request.`, nextState: state, context: ctx, actions: [{ type: 'note', reason: 'price_negotiation_declined' }] };
  }
  const menu = services.map(serviceLine).join('\n');

  if (!state || state === 'new' || state === 'greeting') {
    ctx.attempts = 0;
    const direct = matchService(text, services);
    if (direct) return chooseService({ ctx, match: direct, services, slots, slotsFor, biz, timeZone });
    return { reply: `Hi, this is the automated assistant for ${biz}. Which service do you need?\n${menu}\nReply with a number, or HUMAN to reach a person. Reply STOP to opt out.`, nextState: 'awaiting_service', context: ctx, actions: [] };
  }
  if (state === 'awaiting_service') {
    if (PRICE_Q.test(text) && !matchService(text, services)) return { reply: `Here are our current prices:\n${menu}\nReply with a number to continue.`, nextState: state, context: ctx, actions: [] };
    let match = matchService(text, services);
    if (!match && modelHint && modelHint.confidence >= CONFIDENCE_THRESHOLD && services.some((s) => s.service_key === modelHint.service_key)) match = { ...modelHint, method: 'model_extraction' };
    if (!match) {
      ctx.attempts = (ctx.attempts || 0) + 1;
      if (ctx.attempts >= 2) return { reply: `I want to get this right, so I've asked a person from ${biz} to help. They'll reply here.`, nextState: 'escalated', context: ctx, actions: [{ type: 'escalate', reason: 'low_confidence' }] };
      return { reply: `Sorry, I didn't catch that. Please reply with the number of the service:\n${menu}`, nextState: state, context: ctx, actions: [] };
    }
    return chooseService({ ctx, match, services, slots, slotsFor, biz, timeZone });
  }
  if (state === 'awaiting_time') {
    const choice = matchSlotChoice(text, ctx.slot_options || []);
    if (!choice) {
      ctx.attempts = (ctx.attempts || 0) + 1;
      if (ctx.attempts >= 3) return { reply: `I've asked a person from ${biz} to help you find a time.`, nextState: 'escalated', context: ctx, actions: [{ type: 'escalate', reason: 'low_confidence' }] };
      return { reply: `Please reply with the number of the time you'd like:\n${(ctx.slot_options || []).map((o, i) => `${i + 1}) ${formatSlot(o.start, timeZone)}`).join('\n')}`, nextState: state, context: ctx, actions: [] };
    }
    return { reply: null, nextState: 'holding', context: ctx, actions: [{ type: 'hold_slot', slot: choice }] };
  }
  if (state === 'awaiting_completion') {
    return { reply: `Your request is in progress. Use the secure link we sent to review the agreement and deposit. Reply HUMAN to reach a person.`, nextState: state, context: ctx, actions: [] };
  }
  if (state === 'owner_quote') {
    return { reply: `A team member from ${biz} is preparing your quote and will reply here.`, nextState: state, context: ctx, actions: [] };
  }
  return { reply: null, nextState: state, context: ctx, actions: [] };
}
function chooseService({ ctx, match, services, slots: fallbackSlots, slotsFor, biz, timeZone }) {
  const s = services.find((x) => x.service_key === match.service_key);
  const slots = slotsFor ? slotsFor(s.service_key) : fallbackSlots;
  ctx.service_key = s.service_key; ctx.extraction = { method: match.method, confidence: match.confidence }; ctx.attempts = 0;
  if (s.quote_required) return { reply: `Thanks. ${s.name} is priced by quote, so a team member from ${biz} will review your request and reply here.`, nextState: 'owner_quote', context: ctx, actions: [{ type: 'owner_quote', service_key: s.service_key }] };
  if (!slots.length) return { reply: `${s.name} is ${formatMoney(s.price_cents, s.currency)}. I don't see an open time in the next few weeks, so a team member will reply with options.`, nextState: 'escalated', context: ctx, actions: [{ type: 'set_service', service_key: s.service_key }, { type: 'escalate', reason: 'no_availability' }] };
  ctx.slot_options = slots.slice(0, 3);
  const dep = s.deposit_cents ? ` A ${formatMoney(s.deposit_cents, s.currency)} deposit secures the booking.` : '';
  return {
    reply: `${s.name}: ${formatMoney(s.price_cents, s.currency)}.${dep} Available times:\n${ctx.slot_options.map((o, i) => `${i + 1}) ${formatSlot(o.start, timeZone)}`).join('\n')}\nReply with a number.`,
    nextState: 'awaiting_time', context: ctx, actions: [{ type: 'set_service', service_key: s.service_key }],
  };
}

// =============================================================================================
// Agreements: only allowlisted placeholders; an unknown placeholder blocks rendering.
// =============================================================================================
export const AGREEMENT_FIELDS = ['business_name', 'customer_name', 'service_name', 'price', 'deposit', 'appointment', 'agreement_date'];
export function renderAgreement(body, values) {
  const unknown = [...String(body).matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]).filter((k) => !AGREEMENT_FIELDS.includes(k));
  if (unknown.length) return { ok: false, reason: 'unknown_placeholder', fields: [...new Set(unknown)] };
  const missing = AGREEMENT_FIELDS.filter((k) => body.includes(`{{${k}}}`) && (values[k] == null || values[k] === ''));
  if (missing.length) return { ok: false, reason: 'missing_value', fields: missing };
  const text = String(body).replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => String(values[k]));
  return { ok: true, text, sha256: sha256(text) };
}
export const ESIGN_CONSENT = 'I agree to sign this agreement electronically. I understand my typed name and the time of signing will be recorded with the exact text shown, and that I can download a copy.';

// =============================================================================================
// Tokens / hashing
// =============================================================================================
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export function newToken() { const token = crypto.randomBytes(24).toString('base64url'); return { token, hash: sha256(token) }; }

// =============================================================================================
// Weekly scoreboard: Sunday 18:00 in the business's own time zone (DST handled by Intl).
// =============================================================================================
export function sundayEveningOnOrBefore(now, timeZone) {
  const p = localParts(now, timeZone);
  for (let back = 0; back <= 7; back++) {
    const day = addDaysYmd(p, -back);
    if (new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay() !== 0) continue;
    const t = zonedToUtc({ ...day, h: 18, mi: 0 }, timeZone);
    if (t && t <= now) return t;
  }
  return null;
}
export function nextSundayEvening(now, timeZone) {
  const p = localParts(now, timeZone);
  for (let ahead = 0; ahead <= 8; ahead++) {
    const day = addDaysYmd(p, ahead);
    if (new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay() !== 0) continue;
    const t = zonedToUtc({ ...day, h: 18, mi: 0 }, timeZone);
    if (t && t > now) return t;
  }
  return null;
}
export function weekWindowEndingAt(end, timeZone) {
  const prev = sundayEveningOnOrBefore(new Date(end.getTime() - 3600_000), timeZone); // the previous Sunday 18:00 (7 days earlier, DST-aware)
  return { start: prev, end };
}

// Aggregates persisted rows (already restricted to the window and organization). Test rows are excluded
// unless the organization itself is a test business, in which case the whole report is labeled TEST.
export function buildScoreboard({ window, org, rows }) {
  const testOrg = !!org.is_test;
  const keep = (r) => testOrg || !r.is_test;
  const msgs = (rows.messages || []).filter(keep);
  const jobs = (rows.jobs || []).filter(keep);
  const bookings = (rows.bookings || []).filter(keep);
  const jobIsTest = (id) => !!(rows.allJobsById || {})[id]?.is_test;
  const agreements = (rows.agreements || []).filter((a) => testOrg || !jobIsTest(a.job_id));
  const deposits = (rows.deposits || []).filter((d) => testOrg || !jobIsTest(d.job_id));
  const missed = msgs.filter((m) => m.purpose === 'missed_call');
  const missedKeys = new Set(missed.map((m) => String(m.idempotency_key || m.id).split(':send')[0]));
  const followSubmitted = missed.filter((m) => ['provider_accepted', 'delivered'].includes(m.status));
  const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const paid = deposits.filter((d) => ['paid', 'partially_refunded', 'refunded'].includes(d.status) && d.paid_at);
  const refunds = deposits.filter((d) => d.refunded_cents > 0);
  const confirmedJobs = jobs.filter((j) => j.confirmed_in_window);
  const attributable = (j) => ['missed_call', 'campaign'].includes(j.source_channel) || !!j.referral_code_used;
  const attributedPaid = org.attribution_method ? paid.filter((d) => { const j = (rows.allJobsById || {})[d.job_id]; return j && attributable(j); }) : null;
  const automatedInquiries = jobs.filter((j) => j.source_channel !== 'staff').length;
  const metrics = {
    label: testOrg ? 'TEST BUSINESS — not customer results' : null,
    missed_calls_detected: missedKeys.size,
    followups_submitted_to_provider: followSubmitted.length,
    followups_delivered: missed.filter((m) => m.status === 'delivered').length,
    followups_blocked_or_dry_run: missed.filter((m) => m.status === 'blocked').length,
    inquiries_handled: jobs.length,
    appointments_confirmed: bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed').length,
    agreements_signed: agreements.filter((a) => a.status === 'signed').length,
    deposits_collected_count: paid.length,
    deposits_collected_cents: sum(paid, (d) => d.amount_cents),
    deposits_livemode: paid.some((d) => d.livemode) ? 'includes_live' : 'test_mode_only',
    refunds_cents: sum(refunds, (d) => d.refunded_cents),
    failed_actions: msgs.filter((m) => ['failed', 'undelivered', 'ambiguous'].includes(m.status)).length + (rows.deadJobs || []).length,
    owner_decisions_required: (rows.openDecisions || []).length,
    booked_contract_value_cents: sum(confirmedJobs, (j) => j.total_cents),
    provider_confirmed_collections_cents: sum(paid, (d) => d.amount_cents),
    attributed_collections: attributedPaid ? { cents: sum(attributedPaid, (d) => d.amount_cents), method: org.attribution_method } : 'not_calculable: no documented attribution method',
    estimated_labor_minutes_avoided: org.labor_baseline_approved && org.labor_minutes_per_inquiry
      ? { minutes: automatedInquiries * org.labor_minutes_per_inquiry, basis: `estimated: ${automatedInquiries} automated inquiries × approved baseline of ${org.labor_minutes_per_inquiry} min` }
      : 'not_calculable: no approved labor baseline',
  };
  const weeklyFee = org.nova_fee_cents_monthly != null ? Math.round((org.nova_fee_cents_monthly * 12) / 52) : null;
  const providerCosts = sum(rows.voiceSessions || [], (v) => v.cost_cents);
  metrics.roi = (attributedPaid && weeklyFee != null)
    ? { net_cents: metrics.attributed_collections.cents - weeklyFee - providerCosts, includes: ['attributed collections', 'Nova fee (weekly share)', 'recorded voice provider costs'], excludes: ['SMS provider costs (not recorded)', 'contribution margin'] }
    : 'not_calculable: needs an attribution method and the Nova fee';
  const sources = {
    messages: msgs.map((m) => m.id), jobs: jobs.map((j) => j.id), bookings: bookings.map((b) => b.id),
    agreements: agreements.map((a) => a.id), deposits: deposits.map((d) => d.id),
  };
  const content = canonical({ window: { start: window.start.toISOString(), end: window.end.toISOString() }, metrics });
  return { metrics, sources, sha256: sha256(content) };
}
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export function scoreboardSms(metrics, link, businessName) {
  const money = (c) => formatMoney(c || 0);
  const lines = [
    `${businessName} weekly report${metrics.label ? ' (TEST)' : ''}:`,
    `Inquiries ${metrics.inquiries_handled}, missed calls ${metrics.missed_calls_detected}, appointments ${metrics.appointments_confirmed}, signed ${metrics.agreements_signed}.`,
    `Deposits ${money(metrics.deposits_collected_cents)}${metrics.deposits_livemode === 'test_mode_only' && metrics.deposits_collected_count ? ' (test mode)' : ''}. Needs you: ${metrics.owner_decisions_required}.`,
    `Details: ${link}`,
  ];
  return lines.join('\n');
}

// =============================================================================================
// Sentry: turn measured facts into check results. A missing provider is "not_configured", never "healthy".
// =============================================================================================
export function evaluateHealth({ now, heartbeats = [], queue = {}, messaging = {}, payments = {}, webhooks = {}, calendar = {}, model = {}, config = {} }) {
  const out = [];
  const add = (check_key, status, title, detail = {}, severity = status === 'failing' ? 'critical' : 'warning') => out.push({ check_key, status, title, detail, severity });
  const live = heartbeats.filter((h) => !h.stopped_at && now - new Date(h.last_seen_at) < 120_000);
  add('worker_heartbeat', live.length ? 'healthy' : 'failing', live.length ? 'Worker is running' : 'No worker heartbeat in the last 2 minutes', { live_workers: live.map((h) => h.worker_id), last_seen: heartbeats.map((h) => h.last_seen_at).sort().pop() || null });
  const lag = queue.oldestDueSeconds ?? 0;
  add('queue_delay', lag > 600 ? 'failing' : lag > 120 ? 'degraded' : 'healthy', `Oldest due job waiting ${Math.round(lag)}s`, { oldest_due_seconds: lag });
  add('dead_letter_jobs', (queue.deadLetter24h || 0) > 0 ? 'degraded' : 'healthy', `${queue.deadLetter24h || 0} job(s) dead-lettered in 24h`, { count: queue.deadLetter24h || 0, job_ids: queue.deadLetterIds || [] });
  add('messaging_failures', (messaging.failed24h || 0) + (messaging.ambiguous || 0) > 0 ? 'degraded' : 'healthy', `${messaging.failed24h || 0} failed and ${messaging.ambiguous || 0} unreconciled message(s)`, messaging);
  add('payment_event_backlog', (payments.unprocessedOlderThan10m || 0) > 0 ? 'failing' : 'healthy', `${payments.unprocessedOlderThan10m || 0} payment event(s) not processed after 10 minutes`, payments);
  add('sms_provider_config', config.twilio ? 'healthy' : 'not_configured', config.twilio ? 'Messaging provider configured' : 'Messaging provider not configured', {}, 'info');
  add('payment_provider_config', config.stripe ? (config.stripeWebhook ? 'healthy' : 'failing') : 'not_configured', config.stripe ? (config.stripeWebhook ? 'Payment provider and webhook secret configured' : 'Stripe key present but webhook secret missing — payments cannot be confirmed') : 'Payment provider not configured', {}, config.stripe && !config.stripeWebhook ? 'critical' : 'info');
  add('calendar_connectivity', calendar.configured ? (calendar.ok ? 'healthy' : 'failing') : 'not_configured', calendar.configured ? (calendar.ok ? 'Calendar provider reachable' : `Calendar provider error: ${calendar.error || 'unknown'}`) : 'External calendar not configured (Nova calendar in use)', {}, 'info');
  add('model_provider', model.enabled ? (model.ok === false ? 'degraded' : 'healthy') : 'not_configured', model.enabled ? 'Language model available for extraction' : 'Language model not configured — deterministic path only', {}, 'info');
  if (webhooks.expectTwilio) add('webhook_ingestion', webhooks.lastTwilioAt && now - new Date(webhooks.lastTwilioAt) < 7 * 86400_000 ? 'healthy' : 'degraded', webhooks.lastTwilioAt ? `Last provider webhook ${webhooks.lastTwilioAt}` : 'No provider webhook received yet', webhooks);
  return out;
}
// Alert pacing: first alert immediately, then at most one per escalation step (15m, 1h, 4h), then daily.
export function alertDue(incident, now) {
  if (incident.status !== 'open') return false;
  if (!incident.last_alert_at) return true;
  const gaps = [15, 60, 240, 1440].map((m) => m * 60_000);
  const gap = gaps[Math.min(incident.alerts_sent - 1, gaps.length - 1)] ?? gaps[gaps.length - 1];
  return now - new Date(incident.last_alert_at) >= gap;
}

// =============================================================================================
// Harvest: import preview. Importing does NOT create consent. Unknown permission = blocked.
// =============================================================================================
export function classifyImport(rows, { contactsByPhone = new Map(), now = new Date(), staleYears = 3, normalizePhone }) {
  const seen = new Set();
  return rows.map((raw) => {
    const name = String(raw.name || raw.Name || '').trim().slice(0, 120);
    const phone = normalizePhone(raw.phone || raw.Phone);
    const dateRaw = String(raw.last_date || raw.last_service_date || raw['Last Date'] || '').trim();
    const last = dateRaw ? new Date(dateRaw) : null;
    const base = { display_name: name || null, phone_e164: phone, last_service_date: last && !isNaN(last) ? last.toISOString().slice(0, 10) : null };
    if (!phone) return { ...base, eligibility: 'blocked', blocked_reason: 'invalid_phone' };
    if (seen.has(phone)) return { ...base, eligibility: 'blocked', blocked_reason: 'duplicate_in_file' };
    seen.add(phone);
    const c = contactsByPhone.get(phone);
    if (c?.suppressed) return { ...base, contact_id: c.id, eligibility: 'blocked', blocked_reason: 'opted_out' };
    if (c?.do_not_contact) return { ...base, contact_id: c.id, eligibility: 'blocked', blocked_reason: 'do_not_contact' };
    if (!last || isNaN(last)) return { ...base, contact_id: c?.id, eligibility: 'blocked', blocked_reason: 'uncertain_relationship_no_date' };
    if (now - last > staleYears * 365.25 * 86400_000) return { ...base, contact_id: c?.id, eligibility: 'blocked', blocked_reason: 'stale_record' };
    if (!c || !c.sms_consent || !c.sms_consent_source || !c.sms_consent_at) return { ...base, contact_id: c?.id, eligibility: 'blocked', blocked_reason: 'no_recorded_consent' };
    return { ...base, contact_id: c.id, eligibility: 'eligible', blocked_reason: null };
  });
}
// Randomized spacing in [min,max] seconds, batches of `batchSize` separated by an extra `batchPauseSeconds`.
export function scheduleSends(count, { startAt, batchSize = 25, minGap = 30, maxGap = 90, batchPauseSeconds = 600, rand = Math.random }) {
  const out = []; let t = new Date(startAt).getTime();
  for (let i = 0; i < count; i++) {
    if (i > 0) t += (minGap + Math.floor(rand() * (maxGap - minGap + 1))) * 1000;
    if (i > 0 && i % batchSize === 0) t += batchPauseSeconds * 1000;
    out.push(new Date(t).toISOString());
  }
  return out;
}
export const STOP_EVENTS = ['replied', 'opted_out', 'booked', 'resolved', 'manual_pause', 'campaign_cancelled'];
