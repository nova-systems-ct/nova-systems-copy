// Pure helpers for the owner's Business desk screen. No network, no React: unit-tested directly.

// "49.50" -> 4950. Returns null for empty, NaN for anything that is not a plain positive amount.
export function toCents(text) {
  const t = String(text ?? '').trim().replace(/^\$/, '').replace(/,/g, '');
  if (!t) return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return NaN;
  const [whole, frac = ''] = t.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return cents > 0 ? cents : NaN;
}

export function dollars(cents) {
  if (cents == null) return 'Not set';
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const STAGE_LABELS = {
  inquiry: 'New request', qualified: 'Service chosen', quoted: 'Quote sent', agreed: 'Quote accepted',
  deposit_due: 'Deposit due', scheduling: 'Choosing a time', scheduled: 'Booked', fulfilled: 'Work done',
  balance_due: 'Balance due', paid: 'Paid', closed: 'Closed', cancelled: 'Cancelled',
};

const WAITING_REASONS = {
  price_needs_approval: 'Waiting for you to set and approve a price',
  terms_need_approval: 'Waiting for you to approve the agreement wording',
  choose_service: 'Customer is choosing a service',
  accept_quote: 'Customer has the quote',
  pay_deposit: 'Customer owes the deposit',
  pay_balance: 'Customer owes the balance',
  choose_time: 'Customer is choosing a time',
  arrange_time: 'No open times: someone needs to arrange one',
  complete_work: 'Booked: mark the work done afterwards',
};

export function waitingLabel(j) {
  if (j.paused) return 'Paused: a person is handling it';
  if (['closed', 'cancelled'].includes(j.stage)) return '';
  return WAITING_REASONS[j.waiting_reason] || (j.waiting_on ? `Waiting on ${j.waiting_on}` : '');
}

// What the owner must decide before the workers can carry on. One entry per blocked service,
// with how many customers are stuck behind it.
export function needsOwner(services = [], journeys = []) {
  const out = [];
  for (const s of services) {
    if (s.active === false) continue;
    const stuck = (reason) => journeys.filter((j) => j.service_id === s.id && j.waiting_on === 'owner' && j.waiting_reason === reason && !j.paused).length;
    if (!(s.price_cents > 0) || !s.price_approved) out.push({ service_id: s.id, service: s.name, kind: 'price', waiting: stuck('price_needs_approval'), what: s.price_cents > 0 ? 'Approve the price' : 'Set a price' });
    if (!s.terms_text || !s.terms_approved) out.push({ service_id: s.id, service: s.name, kind: 'terms', waiting: stuck('terms_need_approval'), what: s.terms_text ? 'Approve the agreement wording' : 'Add the agreement wording' });
  }
  return out.sort((a, b) => b.waiting - a.waiting);
}

// Builds the save-service request from the form. Returns { error } or { body }.
// Approval boxes only count when the thing being approved is actually present.
export function serviceRequest(form, organizationId) {
  const name = String(form.name || '').trim();
  if (!name) return { error: 'Give the service a name.' };
  const price = toCents(form.price), deposit = toCents(form.deposit);
  if (Number.isNaN(price)) return { error: 'Enter the price as dollars and cents, for example 120 or 120.50.' };
  if (Number.isNaN(deposit)) return { error: 'Enter the deposit as dollars and cents, or leave it empty.' };
  if (deposit !== null && price === null) return { error: 'Set a price before a deposit.' };
  if (deposit !== null && deposit > price) return { error: 'The deposit cannot be more than the price.' };
  const days = String(form.return_days ?? '').trim();
  if (days && !/^\d{1,4}$/.test(days)) return { error: 'Come-back time is a whole number of days, or empty.' };
  const terms = String(form.terms_text || '').trim();
  return {
    body: {
      organization_id: organizationId, name, description: String(form.description || '').trim(),
      keywords: String(form.keywords || '').split(',').map((k) => k.trim()).filter(Boolean),
      price_cents: price, price_approved: form.price_approved === true && price !== null,
      deposit_cents: deposit, return_days: days ? Number(days) : null,
      terms_text: terms, terms_approved: form.terms_approved === true && !!terms,
      active: form.active !== false,
    },
  };
}

export function serviceToForm(s) {
  return {
    name: s.name || '', description: s.description || '', keywords: (s.keywords || []).join(', '),
    price: s.price_cents ? (s.price_cents / 100).toFixed(2) : '', deposit: s.deposit_cents ? (s.deposit_cents / 100).toFixed(2) : '',
    return_days: s.return_days ?? '', terms_text: s.terms_text || '',
    price_approved: s.price_approved === true, terms_approved: s.terms_approved === true, active: s.active !== false,
  };
}

export const EMPTY_SERVICE = { name: '', description: '', keywords: '', price: '', deposit: '', return_days: '', terms_text: '', price_approved: false, terms_approved: false, active: true };

export const OFFER_TRIGGERS = [
  ['web_visit', 'Shown to everyone on your request page'],
  ['social_comment', 'Someone comments on a post'],
  ['message', 'Someone messages you'],
  ['social_follow', 'Someone follows you'],
  ['manual', 'You hand out the code yourself'],
];
