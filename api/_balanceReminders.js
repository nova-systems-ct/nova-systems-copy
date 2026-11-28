import { money, recordStep } from './_journey.js';

const DAY = 86400000;
export const reminderKey = invoice => 'balance-reminder:' + invoice.id;

export function reminderBalance(j, doc) {
  if (j.paused || j.stage !== 'balance_due' || doc?.kind !== 'balance_invoice' || doc.status !== 'issued') return 0;
  return Math.max(0, Math.min(doc.amount_cents, j.total_cents - j.paid_cents));
}

export async function allowReminder(db, orgId, journeyId, invoiceId, actor, now = new Date()) {
  const [j] = await db.select('journeys', { id: journeyId, organization_id: orgId }, { limit: 1 });
  const [doc] = await db.select('journey_documents', { id: invoiceId, journey_id: journeyId, organization_id: orgId }, { limit: 1 });
  if (!j || !doc) throw Object.assign(new Error('Invoice not found.'), { expected: true, status: 404 });
  if (!reminderBalance(j, doc) || now - new Date(doc.created_at) < 7 * DAY) throw Object.assign(new Error('The balance must be open, unpaused and at least seven days old.'), { expected: true, status: 409 });
  const [contact] = await db.select('crm_contacts', { id: j.contact_id, organization_id: orgId }, { limit: 1 });
  if (!contact?.email || contact.do_not_contact || contact.email_consent !== true) throw Object.assign(new Error('This customer has no active email permission.'), { expected: true, status: 422 });
  const added = await recordStep(db, j, { agent: 'owner', action: 'balance_reminder_approved', key: reminderKey(doc) + ':approved', detail: { document_id: invoiceId, approved_by: actor } });
  return { approved: true, repeated: !added };
}

export function reminderCopy(balance, name = 'the business') {
  return `Our records show a remaining balance of ${money(balance)} with ${name}. You can review your invoice in your private request page. If you have already paid or something looks wrong, please reply so the team can check.`;
}
