// Pure-logic tests: document hashing, hash-chain verification, per-signer document state, activation checklist. Proves logic only.
import { documentHash, eventHash, verifyEventChain, signatureHash, validateSignatureImage, validateTypedName, approvalProblems, documentState, minValidVersion, buildChecklist, normalizeActivationPolicy, DEFAULT_ACTIVATION_POLICY, PLACEHOLDER_MARK } from '../api/_sales/documentRules.js';
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };

check('hash changes when a single character of the body changes', documentHash('T', 'abc') !== documentHash('T', 'abd') && documentHash('T', 'abc') === documentHash('T', 'abc'));
const mk = (n) => { const rows = []; let prev = null; for (let i = 1; i <= n; i++) { const createdAt = new Date(2026, 0, i).toISOString(); const detail = { i }; const hash = eventHash({ requestId: 'r', seq: i, event: 'e' + i, actor: 'u', detail, createdAt, prevHash: prev }); rows.push({ seq: i, event: 'e' + i, actor_user_id: 'u', detail, created_at: createdAt, prev_hash: prev, hash }); prev = hash; } return rows; };
check('an untouched chain verifies', verifyEventChain('r', mk(4)).ok);
let t = mk(4); t[1].detail = { i: 99 };
check('an edited event is detected', !verifyEventChain('r', t).ok && verifyEventChain('r', t).brokenAt === 2);
t = mk(4); t.splice(1, 1);
check('a deleted event is detected', !verifyEventChain('r', t).ok);
t = mk(4); t[3].prev_hash = 'x';
check('a re-linked event is detected', !verifyEventChain('r', t).ok);
check('signature hash covers the typed name, time and ip', signatureHash({ requestId: 'r', typedName: 'A B', signedAt: 't', ip: '1' }) !== signatureHash({ requestId: 'r', typedName: 'A C', signedAt: 't', ip: '1' }) && signatureHash({ requestId: 'r', signedAt: 't1' }) !== signatureHash({ requestId: 'r', signedAt: 't2' }));

check('signature image: none is fine, non-PNG and huge are refused', validateSignatureImage(null) === null && validateSignatureImage('data:image/jpeg;base64,AAAA') !== null && validateSignatureImage('data:image/png;base64,' + 'A'.repeat(300000)) !== null && validateSignatureImage('data:image/png;base64,iVBORw0KGgo=') === null);
check('typed name needs 3+ letters', validateTypedName('Al').error && validateTypedName('   ').error && validateTypedName('1234').error && validateTypedName('  Jane   Q  Public ').name === 'Jane Q Public');

const long = 'x'.repeat(250);
check('approval blocked for short text, placeholders and missing review confirmation', approvalProblems({ version: { body: 'short' }, confirmReviewed: true }).length === 1 && approvalProblems({ version: { body: long + PLACEHOLDER_MARK }, confirmReviewed: true }).length === 1 && approvalProblems({ version: { body: long }, confirmReviewed: false }).length === 1 && approvalProblems({ version: { body: long }, confirmReviewed: true }).length === 0);

const tpl = { key: 'w', requires_countersign: true }; const tpl2 = { key: 'c', requires_countersign: false };
const V = [{ id: 'v1', version: 1, status: 'retired', material_change: true, approved_at: 'x' }, { id: 'v2', version: 2, status: 'approved', material_change: false, approved_at: 'x' }];
check('minimum valid version is the newest MATERIAL one', minValidVersion(V) === 1 && minValidVersion([...V, { id: 'v3', version: 3, material_change: true, status: 'approved', approved_at: 'x' }]) === 3);
check('nothing approved → no_approved_version', documentState({ template: tpl, versions: [{ id: 'v1', version: 1, status: 'draft' }], requests: [] }).state === 'no_approved_version');
check('approved but never sent → not_sent', documentState({ template: tpl2, versions: V, requests: [] }).state === 'not_sent');
const future = new Date(Date.now() + 86400000).toISOString(), past = new Date(Date.now() - 86400000).toISOString();
check('open request → sent/viewed; past expiry → expired', documentState({ template: tpl2, versions: V, requests: [{ id: 'a', version_id: 'v2', status: 'viewed', expires_at: future, created_at: 'x' }] }).state === 'viewed' && documentState({ template: tpl2, versions: V, requests: [{ id: 'a', version_id: 'v2', status: 'sent', expires_at: past, created_at: 'x' }] }).state === 'expired');
const signed = { id: 's', version_id: 'v1', status: 'signed', signed_at: 'x', created_at: 'x', expires_at: future };
check('signed but needs countersign → NOT satisfied', documentState({ template: tpl, versions: V, requests: [signed] }).state === 'awaiting_countersign' && !documentState({ template: tpl, versions: V, requests: [signed] }).satisfied);
check('signed + countersigned → satisfied; older version still valid after a NON-material change', documentState({ template: tpl, versions: V, requests: [{ ...signed, countersigned_at: 'y' }] }).satisfied);
const V3 = [...V, { id: 'v3', version: 3, status: 'approved', material_change: true, approved_at: 'x' }];
check('a MATERIAL new version makes the old signature insufficient (re-sign)', documentState({ template: tpl2, versions: V3, requests: [signed] }).state === 'needs_resign');
check('signing the new version satisfies again', documentState({ template: tpl2, versions: V3, requests: [signed, { id: 's3', version_id: 'v3', status: 'signed', created_at: 'y' }] }).satisfied);
check('declined request reports declined', documentState({ template: tpl2, versions: V, requests: [{ id: 'd', version_id: 'v2', status: 'declined', created_at: 'x' }] }).state === 'declined');

const policy = normalizeActivationPolicy(DEFAULT_ACTIVATION_POLICY);
const programs = [{ id: 'p1', slug: 'a', title: 'A', requires_practical: false }, { id: 'p2', slug: 'b', title: 'B', requires_practical: true }];
const okDocs = Object.fromEntries(policy.required_documents.map((k) => [k, { satisfied: true }]));
const setupOk = Object.fromEntries(policy.operational_items.map((i) => [i.key, { done: true, evidence: 'checked with manager on call' }]));
const base = { policy, rep: { operational_setup: setupOk }, application: { status: 'accepted' }, programs, enrollments: [{ program_id: 'p1', status: 'completed' }, { program_id: 'p2', status: 'completed', practical_approved_at: 'x' }], docStates: okDocs, approvedActivation: null };
let c = buildChecklist(base);
check('everything done → ready, but NOT complete until the owner approves', c.ready && !c.complete && c.items.length === 7 && c.items.find((i) => i.key === 'owner_approval').done === false);
check('with owner approval → complete', buildChecklist({ ...base, approvedActivation: { id: 1 } }).complete);
check('training alone never makes a rep ready (application not accepted)', !buildChecklist({ ...base, application: { status: 'under_review' } }).ready);
check('practical missing → practicals_approved false (training can still be "complete")', (() => { const x = buildChecklist({ ...base, enrollments: [{ program_id: 'p1', status: 'completed' }, { program_id: 'p2', status: 'completed' }] }); return !x.items.find((i) => i.key === 'practicals_approved').done && x.items.find((i) => i.key === 'training_complete').done && !x.ready; })());
check('an unfinished program blocks', !buildChecklist({ ...base, enrollments: [{ program_id: 'p1', status: 'completed' }] }).ready);
check('unsigned compensation schedule blocks separately from other agreements', (() => { const x = buildChecklist({ ...base, docStates: { ...okDocs, compensation_schedule: { satisfied: false } } }); return !x.items.find((i) => i.key === 'compensation_acknowledged').done && x.items.find((i) => i.key === 'agreements_signed').done; })());
check('operational setup needs evidence, not just a flag', !buildChecklist({ ...base, rep: { operational_setup: { ...setupOk, crm_access_verified: { done: true, evidence: '' } } } }).ready);
check('policy normalisation always includes the compensation document and cleans keys', normalizeActivationPolicy({ required_documents: ['working_agreement'], compensation_document: 'comp', operational_items: [{ key: 'Bad Key!', label: 'x' }] }).required_documents.includes('comp') && normalizeActivationPolicy({ operational_items: [{ key: 'Bad Key!', label: 'x' }] }).operational_items[0].key === 'bad_key_');
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
