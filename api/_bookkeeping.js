// Bookkeeping export (Nova system 26): one month of a business's invoices, payments and pay-split
// shares as a CSV file for its accountant. Read-only, from saved records; nothing is estimated.
// The month is the business's local month (America/New_York unless given), so a payment at 10 p.m.
// on the 30th counts in that month, not the next.
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const fail = (code, message, status = 422) => Object.assign(new Error(message), { code, status, expected: true });

const HEADER = ['Date', 'Type', 'Customer', 'Service', 'Description', 'Amount (USD)', 'Payment confirmed by', 'Reference', 'Paid to', 'Request ID'];

// Quotes every cell, doubles inner quotes, and stops a spreadsheet from running a cell as a
// formula (a cell starting with = + - @ or a tab is prefixed with an apostrophe).
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
const dollars = (cents) => (cents / 100).toFixed(2);

function localParts(iso, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { month: `${p.year}-${p.month}`, date: `${p.year}-${p.month}-${p.day}` };
}

export async function monthExport(db, orgId, { month, timeZone = 'America/New_York' }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) throw fail('bad_month', 'Choose a month, for example 2026-11.');
  try { new Intl.DateTimeFormat('en-US', { timeZone }); } catch { throw fail('bad_timezone', 'Unknown time zone.'); }
  const [docs, journeys, contacts, services, entries, workers, agent] = await Promise.all([
    db.select('journey_documents', { organization_id: orgId }, { order: 'created_at.asc', limit: 5000 }),
    db.select('journeys', { organization_id: orgId }, { limit: 5000 }),
    db.select('crm_contacts', { organization_id: orgId }, { limit: 5000 }),
    db.select('business_services', { organization_id: orgId }, { limit: 500 }),
    db.select('pay_split_entries', { organization_id: orgId }, { order: 'created_at.asc', limit: 5000 }),
    db.select('business_workers', { organization_id: orgId }, { limit: 500 }),
    one(db, 'business_agents', { organization_id: orgId }),
  ]);
  const jById = new Map(journeys.map((j) => [j.id, j]));
  const name = (j) => contacts.find((c) => c.id === j?.contact_id)?.name || 'Customer';
  const service = (j) => services.find((s) => s.id === j?.service_id)?.name || '';
  const rows = [];
  const counts = { invoices: 0, payments: 0, shares: 0, payments_cents: 0 };

  for (const d of docs) {
    if (!['deposit_invoice', 'balance_invoice', 'receipt'].includes(d.kind)) continue;
    const at = localParts(d.created_at, timeZone);
    if (at.month !== month) continue;
    const j = jById.get(d.journey_id);
    if (d.kind === 'receipt') {
      counts.payments++; counts.payments_cents += d.amount_cents || 0;
      rows.push([at.date, 'Payment received', name(j), service(j), 'Payment', dollars(d.amount_cents || 0), d.payment_source === 'provider_verified' ? 'Payment provider' : 'Entered by the business', d.payment_reference || '', '', d.journey_id]);
    } else {
      counts.invoices++;
      rows.push([at.date, 'Invoice', name(j), service(j), `${d.kind === 'deposit_invoice' ? 'Deposit' : 'Balance'} invoice (${d.status})`, dollars(d.amount_cents || 0), '', '', '', d.journey_id]);
    }
  }
  for (const e of entries) {
    const at = localParts(e.created_at, timeZone);
    if (at.month !== month) continue;
    const j = jById.get(e.journey_id);
    const w = workers.find((x) => x.id === e.worker_id);
    counts.shares++;
    rows.push([at.date, 'Pay split share', name(j), service(j), `${e.label}: ${Number(e.percent)}% of ${dollars(e.basis_cents)}${e.paid_out_at ? `, paid out ${localParts(e.paid_out_at, timeZone).date}` : ', not paid out yet'}`, dollars(e.amount_cents), '', '', w ? `${w.name} (${w.kind === 'employee' ? 'employee' : 'independent pro'})` : e.label, e.journey_id]);
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const csv = [HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  const slug = String(agent?.business_name || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'business';
  return { filename: `${slug}-${month}-bookkeeping.csv`, csv, counts };
}
