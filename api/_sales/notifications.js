// In-app notifications, the honest email delivery ledger, Resend delivery callbacks, and the maintenance sweep (expiries, retries, reminders).
// Delivery states: dry_run (deliberately not sent) | blocked (not on the dev allow-list) | queued/sending | sent (provider ACCEPTED it) |
// delivered / bounced (only from a verified provider callback) | failed. "sent" is never reported as "delivered".
import crypto from 'node:crypto';
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbPatch, enc, inList, nowIso, audit, bad, wrap, requireUser, requirePerm, deliverEmailRow, notify, notifyOwners, safeEqual } from './core.js';
import { sweepExpiredDocuments } from './documents.js';
import { evaluateEntry } from './commissions.js';

// ---------------------------------------------------------------- Resend (Svix-signed) callbacks
export function verifySvix(headers, raw, secret) {
  const id = headers['svix-id'], ts = headers['svix-timestamp'], sigs = headers['svix-signature'];
  if (!id || !ts || !sigs || !secret) return false;
  if (!Number.isFinite(Number(ts)) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${raw.toString('utf8')}`).digest('base64');
  return String(sigs).split(' ').some((s) => safeEqual(s.replace(/^v1,/, ''), expected));
}
const RANK = { queued: 0, sending: 1, sent: 2, delivered: 3, bounced: 3, failed: 1 };
export async function handleResendEvent(event) {
  const id = event.data?.email_id; if (!id) return { handled: false };
  const map = { 'email.delivered': 'delivered', 'email.bounced': 'bounced', 'email.complained': 'bounced', 'email.failed': 'failed', 'email.sent': 'sent' };
  const to = map[event.type]; if (!to) return { handled: false };
  const reason = event.type === 'email.complained' ? 'recipient marked as spam' : event.data?.bounce?.message || event.data?.reason || null;
  const notes = await dbGet(`sales_notifications?provider_message_id=eq.${enc(String(id).slice(0, 100))}&select=id,status`);
  for (const n of notes) if ((RANK[to] ?? 0) >= (RANK[n.status] ?? 0)) await dbPatch('sales_notifications', `id=eq.${enc(n.id)}`, { status: to, ...(reason ? { last_error: String(reason).slice(0, 300) } : {}) });
  const invs = await dbGet(`application_invitations?provider_message_id=eq.${enc(String(id).slice(0, 100))}&status=in.(sent,delivered,queued)&select=id,status`);
  for (const i of invs) await dbPatch('application_invitations', `id=eq.${enc(i.id)}`, { status: to === 'delivered' ? 'delivered' : to === 'bounced' ? 'bounced' : to === 'failed' ? 'failed' : i.status, delivery_error: reason ? String(reason).slice(0, 300) : null, last_event_at: nowIso() });
  return { handled: true, updated: notes.length + invs.length };
}

// ---------------------------------------------------------------- maintenance (worker job + owner button)
export async function runSalesMaintenance({ now = new Date() } = {}) {
  const out = {};
  out.documents_expired = await sweepExpiredDocuments();
  // invitations past expiry
  const inv = await dbGet(`application_invitations?status=in.(queued,sent,delivered)&expires_at=lt.${enc(now.toISOString())}&select=id&limit=200`);
  for (const i of inv) await dbPatch('application_invitations', `id=eq.${enc(i.id)}&status=in.(queued,sent,delivered)`, { status: 'expired', last_event_at: nowIso() });
  out.invitations_expired = inv.length;
  // proposals past expiry
  const props = await dbGet(`crm_proposals?status=in.(sent,viewed)&token_expires_at=lt.${enc(now.toISOString())}&select=id&limit=200`);
  for (const p of props) await dbPatch('crm_proposals', `id=eq.${enc(p.id)}&status=in.(sent,viewed)`, { status: 'expired' });
  out.proposals_expired = props.length;
  // commissions whose hold-back ended
  let eligible = 0; for (const e of await dbGet('sales_commission_entries?status=eq.pending_conditions&kind=eq.sale&select=*&limit=500')) { const r = await evaluateEntry(e); if (r.status !== e.status) eligible++; }
  out.commissions_became_eligible = eligible;
  // email retries: queued or failed with attempts left (dry_run / blocked are deliberate and never retried)
  let retried = 0;
  for (const row of await dbGet('sales_notifications?channel=eq.email&status=in.(queued,failed)&attempts=lt.5&select=*&order=created_at.asc&limit=50')) {
    const state = await deliverEmailRow(row); retried++;
    if (row.kind === 'invitation' && state === 'sent') { // keep the owner's invitation tracker truthful after a successful retry
      const inv = String(row.idempotency_key || '').split(':')[1]; const fresh = await dbOne(`sales_notifications?id=eq.${enc(row.id)}&select=provider_message_id`);
      if (inv) await dbPatch('application_invitations', `id=eq.${enc(inv)}&status=in.(queued,failed)`, { status: 'sent', sent_at: nowIso(), provider_message_id: fresh?.provider_message_id || null, delivery_error: null, last_event_at: nowIso() });
    }
  }
  out.emails_retried = retried;
  // overdue follow-up reminders — once per lead per day, in-app only
  const overdue = await dbGet(`crm_deals?pipeline=eq.nova_sales&assigned_rep_id=not.is.null&stage=in.(new,contacted,qualified,discovery_scheduled,discovery_completed,proposal,awaiting_signature_payment)&next_action_at=lt.${enc(now.toISOString())}&select=id,assigned_rep_id,next_action&limit=500`);
  const day = now.toISOString().slice(0, 10); let reminded = 0;
  const byRep = {}; for (const d of overdue) (byRep[d.assigned_rep_id] ||= []).push(d);
  for (const [rep, ds] of Object.entries(byRep)) { const ids = await notify({ userId: rep, kind: 'followups_overdue', subject: `${ds.length} follow-up${ds.length > 1 ? 's are' : ' is'} overdue`, body: 'Open your Leads list to see which follow-ups are past due.', link: '/rep/leads', channels: ['in_app'], idempotencyKey: `overdue:${rep}:${day}` }); reminded += ids.length; }
  out.overdue_reminders = reminded;
  // documents about to expire (within 2 days) — one reminder each
  const soon = await dbGet(`sales_document_requests?status=in.(sent,viewed)&expires_at=lt.${enc(new Date(now.getTime() + 2 * 86400_000).toISOString())}&expires_at=gt.${enc(now.toISOString())}&select=id,signer_user_id&limit=200`);
  for (const d of soon) await notify({ userId: d.signer_user_id, kind: 'document_expiring', subject: 'A document is about to expire', body: 'Please review and sign it in Training & Documents, or ask Nova to send a new one.', link: '/rep/documents', channels: ['in_app'], idempotencyKey: `docsoon:${d.id}` });
  out.document_reminders = soon.length;
  // invitations about to expire → owner
  const invSoon = await dbGet(`application_invitations?status=in.(sent,delivered)&expires_at=lt.${enc(new Date(now.getTime() + 2 * 86400_000).toISOString())}&expires_at=gt.${enc(now.toISOString())}&select=id,email&limit=100`);
  for (const i of invSoon) await notifyOwners({ kind: 'invitation_expiring', subject: 'An invitation is about to expire', body: `The invitation to ${i.email} expires within two days and has not been accepted.`, link: '/dashboard/sales-team/hiring', channels: ['in_app'], idempotencyKey: `invsoon:${i.id}` });
  out.invitation_reminders = invSoon.length;
  return out;
}

export const handleNotifications = wrap(async (req, res, op) => {
  const b = req.body || {};
  const ownerOps = ['delivery-report', 'run-maintenance', 'retry'];
  if (ownerOps.includes(op)) {
    const caller = await requirePerm(req, res, 'sales.owner'); if (!caller) return;
    if (!rateLimit(req, res, 30, 60_000)) return;
    if (op === 'run-maintenance') { if (req.method !== 'POST') return bad(res, 405, 'Method not allowed'); const r = await runSalesMaintenance(); await audit(caller, 'maintenance', null, 'run_manually', r); return res.status(200).json({ ok: true, ...r }); }
    if (op === 'retry') { const n = await dbOne(`sales_notifications?id=eq.${enc(sanitize(b.id, 60))}&channel=eq.email&status=in.(failed,queued)&select=*`); if (!n) return bad(res, 404, 'Nothing to retry'); const s = await deliverEmailRow(n); return res.status(200).json({ ok: true, status: s }); }
    const rows = await dbGet('sales_notifications?channel=eq.email&order=created_at.desc&limit=500&select=id,kind,email,subject,status,attempts,last_error,created_at,sent_at');
    const counts = {}; for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
    return res.status(200).json({ counts, problems: rows.filter((r) => ['failed', 'bounced', 'blocked'].includes(r.status)).slice(0, 100), note: 'dry_run means the email was deliberately NOT sent (email mode is not live). sent means the provider accepted it, not that it was delivered.' });
  }
  const user = await requireUser(req, res); if (!user) return;
  if (!rateLimit(req, res, 120, 60_000)) return;
  if (op === 'list') {
    const rows = await dbGet(`sales_notifications?user_id=eq.${enc(user.id)}&channel=eq.in_app&order=created_at.desc&limit=50&select=id,kind,subject,body,link,created_at,read_at`);
    return res.status(200).json({ unread: rows.filter((r) => !r.read_at).length, notifications: rows });
  }
  if (op === 'mark-read') {
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    const ids = Array.isArray(b.ids) ? b.ids.map((x) => sanitize(x, 60)).filter(Boolean).slice(0, 100) : [];
    const q = ids.length ? `id=in.${inList(ids)}&` : '';
    await dbPatch('sales_notifications', `${q}user_id=eq.${enc(user.id)}&channel=eq.in_app&read_at=is.null`, { read_at: nowIso(), status: 'read' });
    return res.status(200).json({ ok: true });
  }
  return bad(res, 400, `Unknown notifications operation: ${op}`);
});
