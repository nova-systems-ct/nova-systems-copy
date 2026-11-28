// Zero-cost first response for Nova's own sales inbox. It prepares staff work and never dispatches it.
const needs = [
  { pattern: /\b(calls?|phone|voicemail|receptionist)\b/i, system: 'Call answering', evidence: 'a dated export of inbound call outcomes', question: 'What usually happens when a customer calls while your team is busy?' },
  { pattern: /\b(bookings?|calendar|appointments?|no[- ]shows?)\b/i, system: 'Scheduling', evidence: 'booking and attendance counts for the same dates', question: 'How does someone book now, and where do customers get stuck?' },
  { pattern: /\b(quot(?:e|es|ing)|estimates?|follow[- ]?up)\b/i, system: 'Quotes and follow-up', evidence: 'issued quotes and their outcomes', question: 'How do you know which estimates are still waiting for an answer?' },
  { pattern: /\b(invoice[s]?|payments?|balances?|billing)\b/i, system: 'Billing', evidence: 'an invoice export with remaining balances', question: 'How do you track what has been invoiced and what has actually been paid?' },
  { pattern: /\b(instagram|tiktok|facebook|whatsapp|messages?|chat|texts?|inbox)\b/i, system: 'Messaging front desk', evidence: 'first-reply times by channel from an authorized inbox export', question: 'Which inbox do customers use most, and who answers it today?' },
];
export function salesIntakeDraft(body) {
  const text = String(body || '').trim();
  if (!text || /\b(stop|unsubscribe|opt[ -]?out|leave me alone|do not contact|don.t contact)\b/i.test(text)) return { state: 'suppressed' };
  if (/\b(human|manager|complaint|refund|legal|dispute|person)\b/i.test(text)) return { state: 'handoff', system: 'Owner review', next: 'A person reviews this conversation before a reply.' };
  const hit = needs.find(n => n.pattern.test(text));
  const system = hit?.system || 'Discovery';
  const question = hit?.question || 'What kind of business do you run, and which customer task takes the most time each week?';
  const reply = /\b(price|cost|how much|guarantee)\b/i.test(text) ? 'We can prepare a quote once we know the scope. ' + question : question;
  return { state: 'draft', system, reply, evidence: hit?.evidence || 'one example of the customer journey with the owner’s permission', next: 'Review the reply, qualify the need, then offer an audit or a demonstrated installation.' };
}
