// Pure rules for the Nova Audit workflow: finding validation, approval readiness, content binding,
// status-transition guards. No I/O — unit-tested in scripts/unit_audit_rules_test.mjs.
import { createHash } from 'node:crypto';

export const STATEMENT_TYPES = ['observed_fact', 'stated_claim', 'inference', 'estimate', 'unknown'];
export const REQUIRED_REPORT_SECTIONS = ['executive_summary', 'business_identity', 'scope_and_method', 'evidence_reviewed', 'findings', 'estimates_and_assumptions', 'recommendations', 'limitations', 'next_steps'];

// Claims Nova must never make: outcomes are not knowable from an audit, and "recovered revenue" implies
// a measured result the audit cannot have. Matching is deliberately blunt — a false positive costs a
// re-wording; a false negative ships an unsupported claim to a customer.
const PROHIBITED = [/\brecovered\s+revenue\b/i, /\bguarantee[sd]?\b/i, /\bwill\s+(increase|boost|generate|recover)\b/i, /\byou\s+(are|were)\s+losing\s+\$/i, /\bmissed\s+calls?\s+cost\s+you\s+\$/i];

export function canonicalize(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalize).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
export const contentHash = (content) => createHash('sha256').update(canonicalize(content ?? {})).digest('hex');

// finding: {statement_type, title, detail, confidence, recommended_action, estimate_low, estimate_high, estimate_assumptions}
// evidenceCount: number of evidence rows linked to this finding (already verified to be in the same case).
export function validateFinding(f, evidenceCount = 0) {
  const errors = [];
  if (!STATEMENT_TYPES.includes(f.statement_type)) errors.push(`statement_type must be one of ${STATEMENT_TYPES.join(', ')}`);
  if (!f.title) errors.push('title is required');
  if (!f.detail) errors.push('detail is required');
  if (['observed_fact', 'stated_claim'].includes(f.statement_type) && evidenceCount < 1) errors.push(`${f.statement_type} needs at least one linked evidence record (source + retrieval time)`);
  if (f.statement_type === 'inference' && evidenceCount < 1) errors.push('an inference must link the evidence it is inferred from');
  if (f.statement_type === 'estimate') {
    const lo = Number(f.estimate_low), hi = Number(f.estimate_high);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || f.estimate_low === null || f.estimate_high === null || f.estimate_low === '' || f.estimate_high === '') errors.push('an estimate must be a range (estimate_low and estimate_high)');
    else if (lo > hi) errors.push('estimate_low cannot exceed estimate_high');
    if (!f.estimate_assumptions) errors.push('an estimate must state its assumptions');
  } else if (f.estimate_low != null || f.estimate_high != null) {
    errors.push('only an estimate-type finding may carry a numeric range');
  }
  for (const [k, v] of Object.entries({ title: f.title, detail: f.detail, recommended_action: f.recommended_action, estimate_assumptions: f.estimate_assumptions })) {
    const hit = PROHIBITED.find((re) => re.test(String(v || '')));
    if (hit) errors.push(`${k} contains a claim Nova does not make (${hit.source.replace(/\\b|\\s\+/g, ' ').trim()})`);
  }
  return errors;
}

// report: {content}; findings: rows with evidence_count + review_status. Returns {ready, problems[]}.
export function validateReportForApproval(content, findings) {
  const problems = [];
  const c = content && typeof content === 'object' ? content : {};
  for (const s of REQUIRED_REPORT_SECTIONS) {
    const v = c[s];
    const empty = v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
    if (empty) problems.push(`report section "${s}" is missing or empty`);
  }
  const text = canonicalize(c);
  for (const re of PROHIBITED) if (re.test(text)) problems.push(`report text contains a claim Nova does not make (${re.source})`);
  // A version drafted while findings were still proposed must not be approved as-is: it would print "proposed".
  if (Array.isArray(c.findings)) for (const f of c.findings) if (f && f.review_status && f.review_status !== 'reviewed') problems.push(`this version was drafted before "${String(f.title || '').slice(0, 60)}" was reviewed; draft a new version and approve that`);
  if (!findings.length) problems.push('the case has no findings');
  for (const f of findings) {
    const label = `finding "${String(f.title || f.id).slice(0, 60)}"`;
    if (f.review_status !== 'reviewed') problems.push(`${label} has not been reviewed (status: ${f.review_status || 'draft'})`);
    const errs = validateFinding(f, f.evidence_count || 0);
    for (const e of errs) problems.push(`${label}: ${e}`);
    if (f.statement_type !== 'unknown' && !f.confidence) problems.push(`${label} has no confidence rating`);
    if (f.statement_type !== 'unknown' && !f.recommended_action) problems.push(`${label} has no recommended action`);
    // 2026-10-11: every reported finding states customer impact, financial-impact status, limitations,
    // whether Nova can implement the remedy, and the owner decision required.
    for (const k of ['customer_impact', 'financial_impact_status', 'limitations', 'nova_can_implement', 'owner_decision']) if (!f[k]) problems.push(`${label} is missing ${k.replace(/_/g, ' ')}`);
  }
  return { ready: problems.length === 0, problems };
}

const AFTER_CLOCK_START = new Set(['researching', 'evidence_gathered', 'findings_drafted', 'report_draft', 'qa_review', 'approved', 'delivered', 'customer_decision', 'implementation', 'outcome_tracking', 'closed']);
// state: {case, hasReport, latestReportApproved, hasDelivery}. Blocks status changes that would bypass
// the clock start, report approval, or a recorded delivery.
export function checkStatusTransition(to, state) {
  if (AFTER_CLOCK_START.has(to) && !state.case.start_condition_met_at) return 'Start the case clock with mark-ready before moving past intake (the 24–72h clock only runs once inputs are satisfied)';
  if (['report_draft', 'qa_review'].includes(to) && !state.hasReport) return `A report draft must exist before moving to ${to}`;
  if (['approved', 'delivered', 'customer_decision', 'implementation', 'outcome_tracking'].includes(to) && !state.latestReportApproved) return `The latest report version must be approved before moving to ${to}`;
  if (['delivered', 'customer_decision', 'implementation', 'outcome_tracking'].includes(to) && !state.hasDelivery) return `A delivery must be recorded before moving to ${to}`;
  return null;
}

// =============================================================================================
// 2026-10-11 — evidence-backed audit additions (financial scenarios, test plans, clock policy).
// =============================================================================================
export const INPUT_SOURCES = ['verified_record', 'owner_provided', 'observed', 'assumed', 'industry_reference'];
const SCENARIO_KEYS = ['eligible_volume', 'failure_share', 'conversion', 'average_sale_cents'];

// eligible inquiry volume × failure share × conversion × average sale. Every input names its source. The result
// is "verified" ONLY when every input is a verified record; anything else is a labeled scenario. Gross opportunity
// is reported separately from contribution (only when a margin share is supplied).
export function computeScenario(inputs) {
  const errors = [];
  const v = {};
  for (const k of [...SCENARIO_KEYS, 'margin_share']) {
    const x = inputs?.[k];
    if (x == null) { if (k !== 'margin_share') errors.push(`${k} is required`); continue; }
    if (!INPUT_SOURCES.includes(x.source)) errors.push(`${k} needs a source (${INPUT_SOURCES.join(', ')})`);
    const n = Number(x.value);
    if (!Number.isFinite(n) || n < 0) { errors.push(`${k} must be a non-negative number`); continue; }
    if (['failure_share', 'conversion', 'margin_share'].includes(k) && n > 1) errors.push(`${k} is a share between 0 and 1`);
    v[k] = n;
  }
  if (errors.length) return { ok: false, errors };
  const monthly = Math.round(v.eligible_volume * v.failure_share * v.conversion * v.average_sale_cents);
  const sources = Object.fromEntries(Object.entries(inputs).filter(([k]) => [...SCENARIO_KEYS, 'margin_share'].includes(k)).map(([k, x]) => [k, x.source]));
  const verified = SCENARIO_KEYS.every((k) => inputs[k].source === 'verified_record') && (!inputs.margin_share || inputs.margin_share.source === 'verified_record');
  return {
    ok: true, status: verified ? 'verified' : 'scenario',
    result: {
      monthly_gross_opportunity_cents: monthly, annual_gross_opportunity_cents: monthly * 12,
      monthly_contribution_cents: v.margin_share != null ? Math.round(monthly * v.margin_share) : null,
      formula: 'eligible inquiry volume × failure share × conversion × average sale',
      input_sources: sources,
      label: verified ? 'Verified from records' : 'Scenario — depends on the labeled inputs; not a measured loss',
      note: 'Gross opportunity is not profit. Net benefit also depends on costs, capacity and Nova fees.',
    },
  };
}
// Scenarios describing the same lost customers share an overlap_group and are counted once (the largest).
export function totalScenarios(rows) {
  const byGroup = new Map(); let ungrouped = 0; let counted = 0;
  for (const s of rows) {
    const m = s.result?.monthly_gross_opportunity_cents || 0;
    if (s.overlap_group) byGroup.set(s.overlap_group, Math.max(byGroup.get(s.overlap_group) || 0, m));
    else { ungrouped += m; counted++; }
  }
  const grouped = [...byGroup.values()].reduce((a, b) => a + b, 0);
  return { monthly_gross_opportunity_cents: ungrouped + grouped, scenarios: rows.length, counted_once_groups: byGroup.size, independent: counted, any_unverified: rows.some((s) => s.status !== 'verified') };
}

// Active tests need the business's recorded permission; competitors are never actively contacted.
export function checkTestEntry({ entry, authorization, sameTargetSameDay = 0 }) {
  if (!['phone', 'form', 'sms', 'public_review'].includes(entry.channel)) return 'Unknown test channel';
  if (!entry.target) return 'Name the public channel being tested';
  if (entry.is_competitor && entry.channel !== 'public_review') return 'Competitors are reviewed from public information only. Nova does not call, text or submit forms to competitors to manufacture a benchmark.';
  if (entry.channel === 'public_review') return null;
  const a = authorization;
  if (!a || !a.authorized_by_name || !a.at) return 'Record the business owner’s written permission for active tests first';
  if (a.cancelled_at) return 'The business cancelled its permission for active tests';
  if (!Array.isArray(a.channels) || !a.channels.includes(entry.channel)) return `Permission does not cover ${entry.channel} tests`;
  if (a.ends_on && new Date(entry.planned_at) > new Date(`${a.ends_on}T23:59:59Z`)) return 'This test is after the permission end date';
  if (!entry.test_identity || entry.test_identity.length < 5) return 'State the clear test identity used (never a made-up urgent customer)';
  if (/urgent|emergency|asap|flood|leak|broken|accident/i.test(entry.test_identity)) return 'Test identities may not pose as a customer with an urgent or fabricated problem';
  if (sameTargetSameDay >= (Number(a.max_per_day) || 1)) return 'Daily test limit for this channel reached. Do not repeatedly contact the business.';
  return null;
}
// A business that is closed and does not promise after-hours service has not "failed" by not answering.
export function interpretTest(t) {
  if (t.status !== 'done') return 'not_performed';
  if (t.within_published_hours === false) return 'outside_published_hours_not_scored';
  if (['answered', 'responded', 'auto_reply'].includes(t.outcome)) return 'responded';
  if (['no_response', 'voicemail'].includes(t.outcome)) return 'no_live_response';
  return 'not_applicable';
}

export function validateClockPolicy(p) {
  const errors = [];
  if (!p || typeof p !== 'object') return ['clock policy is required'];
  if (!p.start_event || String(p.start_event).length < 10) errors.push('describe the clock start event (e.g. "all required inputs received and permission recorded")');
  if (!['business_hours', 'elapsed_hours'].includes(p.hours_basis)) errors.push('choose business hours or elapsed hours');
  const h = Number(p.target_hours); if (!Number.isInteger(h) || h < 48 || h > 72) errors.push('target must be a whole number of hours between 48 and 72');
  if (!p.missing_input_rule || String(p.missing_input_rule).length < 10) errors.push('say what happens when inputs are missing (e.g. clock paused until received)');
  if (!p.extension_notice || String(p.extension_notice).length < 10) errors.push('say how and when the client is told about an extension');
  if (p.aim_hours != null && (!Number.isInteger(Number(p.aim_hours)) || Number(p.aim_hours) < 24 || Number(p.aim_hours) > h)) errors.push('the aim must be whole hours, at least 24 and not later than the target');
  if (p.required_inputs != null) {
    if (!Array.isArray(p.required_inputs) || p.required_inputs.length > 20) errors.push('required inputs must be a list of at most 20');
    else for (const i of p.required_inputs) if (!i || !/^[a-z0-9_]{2,40}$/.test(String(i.key || '')) || String(i.label || '').trim().length < 3 || !['client', 'nova', 'third_party'].includes(i.responsible)) { errors.push('each required input needs a key, a label and who provides it (client, nova or third_party)'); break; }
  }
  return errors;
}
// §5's suggested default — shown to the owner as a PROPOSAL; it has no effect until written to a case and approved.
export const PROPOSED_CLOCK_POLICY = {
  start_event: 'Scope agreed, every required input and access received, and the start confirmed with the client',
  hours_basis: 'elapsed_hours', aim_hours: 48, target_hours: 72,
  missing_input_rule: 'The clock does not start until every required input is received; each missing input is listed with who owes it',
  extension_notice: 'Before an expected missed deadline Nova tells the client why and asks them to agree a revised delivery time; the deadline changes only after they agree',
  required_inputs: [
    { key: 'scope_agreed', label: 'Audit scope agreed in writing', responsible: 'client' },
    { key: 'public_channels', label: 'Website, phone, email and listings to inspect', responsible: 'client' },
    { key: 'record_access', label: 'Permission and access to the operational records in scope', responsible: 'client' },
    { key: 'audit_contact', label: 'A named contact for questions during the audit', responsible: 'client' },
    { key: 'start_confirmed', label: 'Start confirmed with the client', responsible: 'nova' },
  ],
};
export function buildInputChecklist(policy, previous = []) {
  const prev = new Map((previous || []).map((i) => [i.key, i]));
  return (policy?.required_inputs || []).map((i) => ({ key: i.key, label: i.label, responsible: i.responsible, received_at: prev.get(i.key)?.received_at || null, received_by: prev.get(i.key)?.received_by || null, note: prev.get(i.key)?.note || null }));
}
export const FINDING_REPORT_FIELDS = ['customer_impact', 'financial_impact_status', 'limitations', 'nova_can_implement', 'owner_decision'];
