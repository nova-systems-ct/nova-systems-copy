import { createHash } from 'node:crypto';
import { RECORD_METHOD, summarizeExport } from '../src/lib/auditRecords.js';

function evidenceId(caseId, summary) {
  const identity = [caseId, RECORD_METHOD, summary.kind, summary.source.toLowerCase(), summary.start, summary.end];
  const h = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), '8' + h.slice(13, 16), 'a' + h.slice(17, 20), h.slice(20, 32)].join('-');
}

export async function importAuditRecords(req, res, caller, { rateLimit, requireOrgAccess, loadAuditCase, sbWrite, sbSelect }) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!rateLimit(req, res, 15, 60000)) return;
  const b = req.body || {};
  const orgId = b.organization_id, caseId = b.case_id;
  if (typeof orgId !== 'string' || typeof caseId !== 'string' || orgId.length > 100 || caseId.length > 100) return res.status(400).json({ error: 'Choose a business and an audit case.' });
  if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
  if (!(await loadAuditCase(caseId, orgId))) return res.status(404).json({ error: 'Case not found.' });
  if (b.complete !== true || typeof b.permission_ref !== 'string' || b.permission_ref.trim().length < 3 || b.permission_ref.length > 160) return res.status(422).json({ error: 'Confirm the export is complete and identify the written permission to use it.' });
  let summary;
  try { summary = summarizeExport(b); } catch (err) { return res.status(422).json({ error: err.message }); }
  const id = evidenceId(caseId, summary);
  const { duplicates, ...measures } = summary;
  const evidence = {
    id, case_id: caseId, method: RECORD_METHOD, source: summary.source, capture_date: new Date().toISOString(),
    author: caller.email || caller.id, source_quality: 'high', confidence: summary.unknown ? 'medium' : 'high', privacy_level: 'internal',
    observation: JSON.stringify({ ...measures, permission_ref: b.permission_ref.trim() }),
  };
  const write = await sbWrite('audit_evidence', 'POST', evidence);
  if (write.ok) return res.status(201).json({ id, duplicates, repeated: false });
  if (write.status !== 409) return res.status(503).json({ error: 'Could not save the evidence. Try again.' });
  const saved = await sbSelect(`audit_evidence?id=eq.${id}&case_id=eq.${encodeURIComponent(caseId)}&method=eq.${RECORD_METHOD}&select=observation`);
  if (!saved.ok) return res.status(503).json({ error: 'Could not verify the existing evidence.' });
  const row = (await saved.json())[0];
  if (row) {
    const original = JSON.parse(row.observation);
    // Changing capitalization or the permission reference does not change a measured result.
    if (Object.keys(measures).every(k => k === 'source' || original[k] === measures[k])) return res.status(200).json({ id, duplicates, repeated: true });
  }
  return res.status(409).json({ error: 'This source and period already have different saved measures. The original evidence is preserved. Document the correction in the audit case.' });
}
