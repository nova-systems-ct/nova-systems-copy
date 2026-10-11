// Pure rules for agreements/e-signature and the activation checklist. No I/O. Unit-tested in scripts/unit_sales_documents_rules_test.mjs.
import crypto from 'node:crypto';

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const canon = (v) => {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
};

export const ESIGN_CONSENT_VERSION = 'esign-consent-2026-09-26-draft';
export const ESIGN_CONSENT_TEXT = 'I agree to sign this document electronically and to receive it electronically. My typed name (and drawn signature, if provided) is my signature on this document. I can ask Nova Systems for a copy at any time. This consent wording is a draft pending review by Nova Systems.';
export const PLACEHOLDER_MARK = '[OWNER TO COMPLETE]';

export const documentHash = (title, body) => sha(canon({ title: String(title || ''), body: String(body || '') }));

// -------- hash-chained events
export function eventHash({ requestId, seq, event, actor, detail, createdAt, prevHash }) {
  return sha(`${prevHash || 'GENESIS'}|${canon({ requestId, seq, event, actor: actor || null, detail: detail || {}, createdAt })}`);
}
// rows: events for ONE request, any order. Returns { ok, brokenAt?, reason? }
export function verifyEventChain(requestId, rows) {
  const ev = [...rows].sort((a, b) => a.seq - b.seq); let prev = null;
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (e.seq !== i + 1) return { ok: false, brokenAt: i + 1, reason: 'missing or reordered event' };
    if ((e.prev_hash || null) !== prev) return { ok: false, brokenAt: e.seq, reason: 'chain link does not match the previous event' };
    const h = eventHash({ requestId, seq: e.seq, event: e.event, actor: e.actor_user_id, detail: e.detail, createdAt: new Date(e.created_at).toISOString(), prevHash: prev });
    if (h !== e.hash) return { ok: false, brokenAt: e.seq, reason: 'event content was altered' };
    prev = e.hash;
  }
  return { ok: true, events: ev.length };
}
export function signatureHash({ requestId, versionId, contentHash, signerUserId, typedName, signedAt, consentVersion, ip, imageHash }) {
  return sha(canon({ requestId, versionId, contentHash, signerUserId, typedName, signedAt, consentVersion, ip: ip || null, imageHash: imageHash || null }));
}
export const imageHash = (dataUri) => (dataUri ? sha(dataUri) : null);

// A drawn signature is optional; if present it must be a small PNG data URI.
export function validateSignatureImage(img) {
  if (img == null || img === '') return null;
  if (typeof img !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(img)) return 'The drawn signature must be a PNG image.';
  if (img.length > 200_000) return 'The drawn signature image is too large.';
  return null;
}
export function validateTypedName(name) {
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (n.length < 3 || n.length > 120) return { error: 'Type your full legal name to sign.' };
  if (!/[A-Za-z]/.test(n)) return { error: 'Type your full legal name to sign.' };
  return { name: n };
}

// Can this version be approved? (No invented legal text: placeholders and empty bodies block approval.)
export function approvalProblems({ version, confirmReviewed }) {
  const p = [];
  const body = String(version?.body || '');
  if (body.trim().length < 200) p.push('The document text is too short to be an agreement (fewer than 200 characters).');
  if (body.includes(PLACEHOLDER_MARK)) p.push(`Replace every "${PLACEHOLDER_MARK}" placeholder with real, reviewed text.`);
  if (!confirmReviewed) p.push('Confirm that you have reviewed this exact text (and had it legally reviewed if you require that).');
  return p;
}

// Which version numbers count as valid for a template: anything >= the newest approved MATERIAL version.
export function minValidVersion(approvedVersions) {
  const material = approvedVersions.filter((v) => v.material_change).map((v) => v.version);
  return material.length ? Math.max(...material) : 1;
}
// One template, one signer. templates: {key,requires_countersign}; versions: all versions of the template; requests: this signer's requests for it.
export function documentState({ template, versions, requests, now = new Date() }) {
  const approved = versions.filter((v) => v.status === 'approved' || v.status === 'retired').filter((v) => v.approved_at);
  if (!approved.length) return { state: 'no_approved_version', satisfied: false, message: 'Nova has not published this document yet.' };
  const minV = minValidVersion(approved); const latest = Math.max(...approved.map((v) => v.version));
  const vnum = (id) => versions.find((v) => v.id === id)?.version || 0;
  const signed = requests.filter((r) => r.status === 'signed').sort((a, b) => vnum(b.version_id) - vnum(a.version_id));
  const current = signed.find((r) => vnum(r.version_id) >= minV);
  if (current) {
    if (template.requires_countersign && !current.countersigned_at) return { state: 'awaiting_countersign', satisfied: false, request_id: current.id, signed_at: current.signed_at, message: 'You signed. Nova still needs to countersign.' };
    return { state: 'signed', satisfied: true, request_id: current.id, signed_at: current.signed_at, version: vnum(current.version_id), outdated: vnum(current.version_id) < latest };
  }
  if (signed.length) {
    const open = requests.find((r) => ['sent', 'viewed'].includes(r.status) && new Date(r.expires_at) > now);
    return { state: 'needs_resign', satisfied: false, request_id: open?.id || null, message: 'This agreement changed materially and must be signed again.' };
  }
  const open = requests.find((r) => ['sent', 'viewed'].includes(r.status));
  if (open) return new Date(open.expires_at) <= now ? { state: 'expired', satisfied: false, request_id: open.id } : { state: open.status, satisfied: false, request_id: open.id, expires_at: open.expires_at };
  const last = [...requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  if (last && ['declined', 'expired', 'void', 'superseded'].includes(last.status)) return { state: last.status, satisfied: false, request_id: last.id };
  return { state: 'not_sent', satisfied: false };
}

// -------- activation policy + checklist
export const DEFAULT_ACTIVATION_POLICY = Object.freeze({
  required_program_slugs: 'all',
  required_documents: ['working_agreement', 'compensation_schedule', 'confidentiality', 'acceptable_use'],
  compensation_document: 'compensation_schedule',
  operational_items: [
    { key: 'crm_access_verified', label: 'CRM access verified with a Nova-owned test record' },
    { key: 'toolkit_walkthrough', label: 'Sales toolkit walkthrough completed with a manager' },
    { key: 'communication_channel', label: 'Nova communication channel set up' },
  ],
});
export function normalizeActivationPolicy(v = {}) {
  const arr = (x, d) => (Array.isArray(x) ? x.map((s) => String(s).slice(0, 60)).filter(Boolean).slice(0, 40) : d);
  const items = Array.isArray(v.operational_items) ? v.operational_items.map((i) => ({ key: String(i?.key || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40), label: String(i?.label || '').slice(0, 160) })).filter((i) => i.key && i.label).slice(0, 20) : DEFAULT_ACTIVATION_POLICY.operational_items;
  const docs = arr(v.required_documents, [...DEFAULT_ACTIVATION_POLICY.required_documents]);
  const comp = String(v.compensation_document || DEFAULT_ACTIVATION_POLICY.compensation_document);
  return { required_program_slugs: v.required_program_slugs === 'all' || v.required_program_slugs == null ? 'all' : arr(v.required_program_slugs, 'all'), required_documents: docs.includes(comp) ? docs : [...docs, comp], compensation_document: comp, operational_items: items };
}
// Everything is derived from stored facts (never from a client-supplied flag). Returns the seven independent items.
export function buildChecklist({ policy, rep, application, programs, enrollments, docStates, approvedActivation }) {
  const req = policy.required_program_slugs === 'all' ? programs : programs.filter((p) => policy.required_program_slugs.includes(p.slug));
  const byProgram = new Map(enrollments.map((e) => [e.program_id, e]));
  const incompleteTraining = req.filter((p) => byProgram.get(p.id)?.status !== 'completed').map((p) => p.title);
  const practicalPrograms = req.filter((p) => p.requires_practical);
  const missingPracticals = practicalPrograms.filter((p) => !byProgram.get(p.id)?.practical_approved_at).map((p) => p.title);
  const docs = (keys) => keys.filter((k) => !docStates[k]?.satisfied);
  const otherDocs = policy.required_documents.filter((k) => k !== policy.compensation_document);
  const setup = rep.operational_setup || {};
  const missingSetup = policy.operational_items.filter((i) => !setup[i.key]?.done || !String(setup[i.key]?.evidence || '').trim()).map((i) => i.label);
  const items = [
    { key: 'application_accepted', label: 'Application accepted', done: application?.status === 'accepted', detail: application ? `Application is ${application.status}` : 'No application linked' },
    { key: 'training_complete', label: `Required training complete (${req.length - incompleteTraining.length}/${req.length} programs)`, done: req.length > 0 && incompleteTraining.length === 0, detail: incompleteTraining.length ? `Outstanding: ${incompleteTraining.join('; ')}` : 'All required programs completed' },
    { key: 'practicals_approved', label: 'Practical assessments approved by a reviewer', done: missingPracticals.length === 0, detail: missingPracticals.length ? `Awaiting approval: ${missingPracticals.join('; ')}` : 'All practicals approved' },
    { key: 'agreements_signed', label: 'Required agreements signed (and countersigned where required)', done: docs(otherDocs).length === 0, detail: docs(otherDocs).length ? `Outstanding: ${docs(otherDocs).join(', ')}` : 'All agreements in place' },
    { key: 'compensation_acknowledged', label: 'Compensation schedule acknowledged', done: docs([policy.compensation_document]).length === 0, detail: docs([policy.compensation_document]).length ? 'Compensation schedule not yet signed/countersigned' : 'Acknowledged' },
    { key: 'operational_setup', label: 'Operational setup complete (owner-verified, with evidence)', done: missingSetup.length === 0, detail: missingSetup.length ? `Outstanding: ${missingSetup.join('; ')}` : 'All setup items verified' },
    { key: 'owner_approval', label: 'Explicit owner approval to activate', done: !!approvedActivation, detail: approvedActivation ? 'Owner approved' : 'Not yet approved' },
  ];
  return { items, ready: items.filter((i) => i.key !== 'owner_approval').every((i) => i.done), complete: items.every((i) => i.done) };
}
export const REP_TRANSITIONS = { candidate: ['active', 'inactive'], active: ['suspended', 'inactive'], suspended: ['active', 'inactive'], inactive: [] };
