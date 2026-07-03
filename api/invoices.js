import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';

// GET  /api/invoices           → list all invoices
// POST /api/invoices { action: 'create' | 'update' | 'delete', ... }
export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/client_invoices?order=created_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (!r.ok) { console.error('[invoices] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
      return res.status(200).json(await r.json());
    } catch (err) {
      console.error('[invoices] Error:', err.message);
      return res.status(200).json([]);
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const b = req.body || {};
  const action = sanitize(b.action, 20);

  if (action === 'create' || action === 'update') {
    const id = sanitize(b.id, 100);
    const record = {
      client_id: sanitize(b.client_id, 100) || null,
      invoice_number: sanitize(b.invoice_number, 50),
      line_items: Array.isArray(b.line_items) ? b.line_items : [],
      subtotal: Number(b.subtotal) || 0,
      tax: Number(b.tax) || 0,
      total: Number(b.total) || 0,
      deposit_amount: b.deposit_amount != null ? Number(b.deposit_amount) : null,
      due_date: sanitize(b.due_date, 20) || null,
      notes: sanitize(b.notes, 2000),
      status: sanitize(b.status, 30) || 'Unpaid',
      stripe_payment_link: sanitize(b.stripe_payment_link, 500) || null,
      invoice_pdf_url: sanitize(b.invoice_pdf_url, 500) || null,
    };
    if (record.status === 'Paid' && !b.paid_at_skip) record.paid_at = new Date().toISOString();

    try {
      const url = (action === 'update' && id)
        ? `${SUPABASE_URL}/rest/v1/client_invoices?id=eq.${encodeURIComponent(id)}`
        : `${SUPABASE_URL}/rest/v1/client_invoices`;
      const r = await fetch(url, {
        method: (action === 'update' && id) ? 'PATCH' : 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!r.ok) { console.error('[invoices] Save error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to save invoice' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, invoice: rows[0] });
    } catch (err) {
      console.error('[invoices] Error:', err.message);
      return res.status(500).json({ error: 'Failed to save invoice' });
    }
  }

  if (action === 'delete') {
    const id = sanitize(b.id, 100);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/client_invoices?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return res.status(500).json({ error: 'Delete failed' });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
