// The same saved text is presented on the request page, in the inbox and in the signed agreement.
export async function latestQuote(db, j) {
  return (await db.select('journey_documents', { organization_id: j.organization_id, journey_id: j.id, kind: 'quote' }, { order: 'seq.desc', limit: 1 }))[0];
}
const money = cents => '$' + (cents / 100).toFixed(2);
export async function prepareQuote(db, j, svc, offer, { now, record }) {
  const discount = offer?.active && offer.approved && (!offer.expires_at || new Date(offer.expires_at) > now) ? Math.floor(svc.price_cents * offer.percent_off / 100) : 0;
  const total = svc.price_cents - discount;
  const deposit = Math.min(svc.deposit_cents || 0, total);
  const terms = svc.terms_text || '';
  const body = [
    `Quote for ${svc.name}`, svc.description,
    `Price: ${money(svc.price_cents)}`,
    discount ? `Discount (${offer.code}, ${offer.percent_off}% off): -${money(discount)}` : '',
    `Total: ${money(total)}`, deposit ? `Deposit to book: ${money(deposit)}` : '',
    terms ? '\nAgreement terms\n' + terms : '',
  ].filter(Boolean).join('\n');
  let q = await latestQuote(db, j);
  if (q?.status === 'accepted') return { q, total: q.amount_cents, discount: j.discount_cents };
  if (!q || q.body !== body || q.status === 'void') {
    if (q?.status === 'issued') {
      const voided = await db.update('journey_documents', { id: q.id, organization_id: j.organization_id, status: 'issued' }, { status: 'void' });
      if (!voided.length) q = await latestQuote(db, j);
      if (q?.status === 'accepted') return { q, total: q.amount_cents, discount: j.discount_cents };
    }
    try {
      q = await db.insert('journey_documents', { journey_id: j.id, organization_id: j.organization_id, kind: 'quote', seq: (q?.seq || 0) + 1, status: 'issued', body, amount_cents: total });
    } catch (err) {
      if (err.status !== 409) throw err;
      q = await latestQuote(db, j);
      if (!q || q.body !== body || q.status === 'void') throw Object.assign(new Error('The quote is being updated. Please refresh.'), { status: 409, expected: true });
    }
  }
  await record(db, j, { agent: 'contracts', action: 'quote_basis', key: 'basis:' + q.id, detail: { quote_id: q.id, deposit_cents: deposit, has_terms: !!terms, service_name: svc.name } });
  return { q, total, discount };
}
