// Reviews (Nova system 19). After a paid job the customer is asked "How did we do, 1 to 5?",
// either on their own request page or through a private rating link sent by email or text.
//   1 to 3 → apologised to, and the owner is asked to call them;
//   every rating → shown the owner's own public review page, if the owner gave one.
// The review page is offered to EVERY customer who answers, whatever the rating. Offering it only
// to happy customers ("review gating") is against Google's review policy, which forbids
// selectively soliciting positive reviews. Nova never writes, edits or posts a review for anyone,
// and nobody is offered anything for a rating.
import crypto from 'node:crypto';
import { recordStep } from './_journey.js';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const fail = (code, message, status = 409) => Object.assign(new Error(message), { code, status, expected: true });
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const TOKEN_RE = /^[0-9a-f]{48}$/;
export const REVIEW_REQUEST_DAYS = 14;

// A job that finished with money received (not a cancelled request).
export const finishedPaid = (j) => j?.stage === 'closed' && j.paid_cents > 0;

// Creates the private rating link for a finished job once. Returns the token, or null when the
// customer was already asked (the token itself is never stored).
export async function newRatingLink(db, j) {
  if (!finishedPaid(j)) return null;
  if (await one(db, 'customer_feedback', { journey_id: j.id })) return null;
  const token = crypto.randomBytes(24).toString('hex');
  try { await db.insert('customer_feedback', { organization_id: j.organization_id, journey_id: j.id, contact_id: j.contact_id, token_hash: sha(token) }); }
  catch (err) { if (err.status === 409) return null; throw err; }
  return token;
}

export async function journeyForRatingLink(db, token) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  const fb = await one(db, 'customer_feedback', { token_hash: sha(token) });
  if (!fb) return null;
  const j = await one(db, 'journeys', { id: fb.journey_id, organization_id: fb.organization_id });
  return j ? { j, feedback: fb } : null;
}

export async function hasRated(db, j) {
  const fb = await one(db, 'customer_feedback', { journey_id: j.id });
  return !!(fb && fb.rating);
}

// What the rating page shows before the customer answers.
export async function ratingInfo(db, j) {
  const [agent, org, svc] = await Promise.all([one(db, 'business_agents', { organization_id: j.organization_id }), one(db, 'organizations', { id: j.organization_id }), one(db, 'business_services', { id: j.service_id, organization_id: j.organization_id })]);
  return { business: agent?.business_name || org?.name || 'The business', service: svc?.name || 'your job', already_rated: await hasRated(db, j) };
}

export async function rate(db, j, { rating, comment, now = new Date() }) {
  if (!finishedPaid(j)) throw fail('not_finished', 'You can rate the job once it is finished and paid.');
  const n = Number(rating);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw fail('bad_rating', 'Choose a number from 1 to 5.', 422);
  const words = String(comment || '').trim().slice(0, 1000) || null;
  const agent = await one(db, 'business_agents', { organization_id: j.organization_id });
  const reviewUrl = /^https:\/\//.test(agent?.review_url || '') ? agent.review_url : null;
  const patch = { rating: n, comment: words, answered_at: now.toISOString(), review_link_given: !!reviewUrl, follow_up: n <= 3 ? 'owner_to_call' : 'none' };
  let fb = await one(db, 'customer_feedback', { journey_id: j.id });
  if (fb?.rating) throw fail('already_rated', 'Thank you, we already have your rating for this job.');
  if (fb) {
    const rows = await db.update('customer_feedback', { id: fb.id, organization_id: j.organization_id, rating: null }, patch);
    if (!rows.length) throw fail('already_rated', 'Thank you, we already have your rating for this job.');
    fb = rows[0];
  } else {
    try { fb = await db.insert('customer_feedback', { organization_id: j.organization_id, journey_id: j.id, contact_id: j.contact_id, ...patch }); }
    catch (err) { if (err.status === 409) throw fail('already_rated', 'Thank you, we already have your rating for this job.'); throw err; }
  }
  if (n <= 3) {
    const contact = await one(db, 'crm_contacts', { id: j.contact_id, organization_id: j.organization_id });
    await recordStep(db, j, { agent: 'customer', handed_to: 'owner', action: 'customer_unhappy', key: 'rating', status: 'waiting_owner', detail: { rating: n, comment: words } });
    await db.insert('approval_requests', { organization_id: j.organization_id, item_type: 'customer_feedback', item_ref: `journey:${j.id}`, action_summary: `${contact?.name || 'A customer'} rated their job ${n} out of 5${words ? `: "${words.slice(0, 200)}"` : ''}. Call them.`, status: 'pending' });
    return { rating: n, review_url: reviewUrl, message: `Thank you for telling us, and we are sorry it was not better. The owner will contact you personally.${reviewUrl ? ' You are also welcome to leave a public review.' : ''}` };
  }
  await recordStep(db, j, { agent: 'customer', action: 'customer_happy', key: 'rating', detail: { rating: n } });
  return { rating: n, review_url: reviewUrl, message: reviewUrl ? 'Thank you! If you have a minute, you can also leave a public review.' : 'Thank you! We are glad it went well.' };
}

export async function resolveFeedback(db, orgId, id, by) {
  const rows = await db.update('customer_feedback', { id, organization_id: orgId, follow_up: 'owner_to_call' }, { follow_up: 'resolved', resolved_by: by || null, resolved_at: new Date().toISOString() });
  if (!rows.length) throw fail('not_found', 'That feedback was not found or is already resolved.', 404);
  return rows[0];
}

export function feedbackReply(rating) {
  if (![1, 2, 3, 4, 5].includes(rating)) return null;
  if (rating <= 3) return 'Thank you for raising this. We would like to hear what happened and discuss it with you privately. Please contact our team directly.';
  return 'Thank you for taking the time to share your experience. Our team appreciates your feedback.';
}

export async function feedbackList(db, orgId) {
  const rows = (await db.select('customer_feedback', { organization_id: orgId }, { order: 'created_at.desc', limit: 200 })).filter((f) => f.rating);
  const contacts = new Map((await db.select('crm_contacts', { organization_id: orgId }, { limit: 5000 })).map((c) => [c.id, c.name || 'Customer']));
  return rows.map(({ token_hash: _t, ...f }) => ({ ...f, reply_draft: feedbackReply(f.rating), customer_name: contacts.get(f.contact_id) || 'Customer' }));
}
