// Dispatcher for the Sales Team platform resources, called from api/client.js (no new Vercel function).
import { handleApply, handleHiring } from './hiring.js';
import { handleDocuments } from './documents.js';
import { handleSalesTeam } from './team.js';

const TABLE = {
  apply: handleApply,     // applicant portal + public invitation acceptance
  hiring: handleHiring,   // owner/reviewer hiring workspace
  documents: handleDocuments, // agreements + e-signature
  salesteam: handleSalesTeam, // roster, activation checklist, suspension
};
export const SALES_RESOURCES = new Set(Object.keys(TABLE));
export async function salesDispatch(resource, op, req, res) {
  const h = TABLE[resource];
  return h ? h(req, res, op) : res.status(404).json({ error: `Unknown resource: ${resource}` });
}
export function registerSalesResource(name, handler) { TABLE[name] = handler; SALES_RESOURCES.add(name); }
