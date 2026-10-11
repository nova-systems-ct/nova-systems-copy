// Dispatcher for the Sales Team platform resources, called from api/client.js (no new Vercel function).
import { handleApply, handleHiring } from './hiring.js';
import { handleDocuments } from './documents.js';
import { handleSalesTeam } from './team.js';
import { handleLeads } from './leads.js';
import { handleCatalog } from './catalog.js';
import { handleProposals, handleClientProposal } from './proposals.js';
import { handlePayments } from './payments.js';
import { handleCommissions } from './commissions.js';
import { handleNotifications } from './notifications.js';
import { handleHierarchy } from '../_hierarchy/registry.js';
import { handleGovernance } from '../_hierarchy/governance.js';
import { handleWorkItems } from '../_hierarchy/workitems.js';
import { handleMeetings } from '../_hierarchy/meetings.js';

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
  notifications: handleNotifications, // in-app inbox, delivery report, maintenance
  hierarchy: handleHierarchy, // Nova organizational hierarchy registry (portfolio, positions, workers, CEO Twin/authority matrix policy)
  governance: handleGovernance, // Nova hierarchy governance (worker contracts, escalations, kill switches, decision records)
  workitems: handleWorkItems, // Nova hierarchy work & reporting (work items, heartbeats, Venture Lab, Owner Brief, operational memory)
  meetings: handleMeetings, // Nova hierarchy Meeting Engine (Meet Now, Committee Room, transcript, evidence board, action items, Incident Room)
};
export const SALES_RESOURCES = new Set(Object.keys(TABLE));
export async function salesDispatch(resource, op, req, res) {
  const h = TABLE[resource];
  return h ? h(req, res, op) : res.status(404).json({ error: `Unknown resource: ${resource}` });
}
export function registerSalesResource(name, handler) { TABLE[name] = handler; SALES_RESOURCES.add(name); }
