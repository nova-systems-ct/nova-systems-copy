// Dispatcher for the Sales Team platform resources, called from api/client.js (no new Vercel function).
import { handleApply, handleHiring } from './hiring.js';
import { handleDocuments } from './documents.js';
import { handleSalesTeam } from './team.js';
import { handleLeads } from './leads.js';
import { handleCatalog } from './catalog.js';
import { handleProposals, handleClientProposal } from './proposals.js';
import { handlePayments } from './payments.js';
import { handleCommissions } from './commissions.js';

const TABLE = {
  apply: handleApply,     // applicant portal + public invitation acceptance
  hiring: handleHiring,   // owner/reviewer hiring workspace
  documents: handleDocuments, // agreements + e-signature
  salesteam: handleSalesTeam, // roster, activation checklist, suspension
  leads: handleLeads,     // rep pipeline + manager/owner lead management
  catalog: handleCatalog, // product readiness, pricing, toolkit, audit terms
  proposals: handleProposals,        // rep/owner proposal, submission and verification
  clientproposal: handleClientProposal, // PUBLIC: client views/signs/pays via a personal link
  salespay: handlePayments,          // owner/manager payment records
  commissions: handleCommissions,    // ledger, plan, payout batches, payout accounts
};
export const SALES_RESOURCES = new Set(Object.keys(TABLE));
export async function salesDispatch(resource, op, req, res) {
  const h = TABLE[resource];
  return h ? h(req, res, op) : res.status(404).json({ error: `Unknown resource: ${resource}` });
}
export function registerSalesResource(name, handler) { TABLE[name] = handler; SALES_RESOURCES.add(name); }
