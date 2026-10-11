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
  if (!findings.length) problems.push('the case has no findings');
  for (const f of findings) {
    const label = `finding "${String(f.title || f.id).slice(0, 60)}"`;
    if (f.review_status !== 'reviewed') problems.push(`${label} has not been reviewed (status: ${f.review_status || 'draft'})`);
    const errs = validateFinding(f, f.evidence_count || 0);
    for (const e of errs) problems.push(`${label}: ${e}`);
    if (f.statement_type !== 'unknown' && !f.confidence) problems.push(`${label} has no confidence rating`);
    if (f.statement_type !== 'unknown' && !f.recommended_action) problems.push(`${label} has no recommended action`);
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
