import { dbOne, dbGet, dbPatch, enc } from './_sales/core.js';
// Public Nova requests belong only in Nova's internal owner workspace, including legacy unscoped records.
export async function publicLeadInbox(organizationId) {
  const org = await dbOne(`organizations?id=eq.${enc(organizationId)}&select=id,kind`);
  if (org?.kind !== 'nova_internal') return [];
  return dbGet(`contact_submissions?or=(organization_id.eq.${enc(organizationId)},organization_id.is.null)&select=id,name,email,phone,company,category,message,status,created_at&order=created_at.desc&limit=50`);
}
export async function reviewPublicLead(organizationId, id, status) {
  const org = await dbOne(`organizations?id=eq.${enc(organizationId)}&select=id,kind`);
  if (org?.kind !== 'nova_internal' || !['read','replied'].includes(status)) return null;
  const rows = await dbPatch('contact_submissions', `id=eq.${enc(id)}&or=(organization_id.eq.${enc(organizationId)},organization_id.is.null)`, { organization_id: organizationId, status });
  return rows[0] || null;
}
