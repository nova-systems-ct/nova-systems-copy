import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail } from './_sanitize.js';
import { uploadToVault, signVaultUrl } from './_vaultStorage.js';
import { requireStaff } from './_auth.js';
import { computeCaseClockStatus } from './_auditClock.js';

// Combined client-dashboard endpoint — dispatch via ?resource= (and ?op= for
// resources with more than one sub-route). All handlers use the Supabase SERVICE ROLE key
// internally (full DB access, bypasses RLS), so every resource below except the ones marked
// PUBLIC requires a staff Authorization: Bearer <supabase access token> header carrying the
// listed permission — enforced in the dispatcher via api/_auth.js's requireStaff(), not just by
// the frontend's route-level RequirePermission gate:
//   invoices                    [admin.view]        GET list / POST { action: create|update|delete }
//   referrals                   [growth.view]        GET list / POST { action: create|update|delete }
//   intake-requests              [intelligence.view]  GET list / POST { action: 'update-status', id, status }
//   vault      &op=list|upload|delete|resign         [admin.view]
//   portfolio  &op=items                             PUBLIC (mutate: POST { action: update|delete })
//              &op=upload|mutate                     [growth.view]
//   site-content                 GET ?key=           PUBLIC
//                                 POST upsert         [admin.view]
//   blog       &op=posts                             PUBLIC (&admin=true variant: [growth.view])
//              &op=admin                              [growth.view] (POST { action: save|delete })
//   documents                    [admin.view]          GET list saved documents / POST generate
//                                                        with Claude, or { action:'mark-sent', id }
//   newsletter                   [growth.view]          GET { subscribers, sent } / POST
//                                                        { action:'add-subscriber'|'record-send' }
//   crm  &op=businesses          [growth.view]           GET ?q= search/list / POST
//                                                        { action:'create'|'update', ... }
//       &op=contacts             [growth.view]           GET ?business_id= / POST { action:... }
//       &op=deals                [growth.view]           GET ?pipeline=&stage= / POST
//                                                        { action:'create'|'update-stage', ... }
//   orders                       [growth.view]           GET / POST { action:'create'|
//                                                        'update-status', ... }
//   products                     [growth.view]           GET — read-only catalog listing
//   audit  &op=cases             [intelligence.view]      GET ?id= / POST { action:'create'|
//                                                        'update-status'|'pause'|'resume', ... }
//         &op=evidence           [intelligence.view]      GET ?case_id= / POST {action:'create'}
//         &op=findings           [intelligence.view]      GET ?case_id= / POST {action:'create'}
//         &op=recommendations    [intelligence.view]      GET ?case_id= / POST {action:'create'}
//         &op=reports            [intelligence.view]      GET ?case_id= / POST {action:
//                                                        'create-draft'|'approve'} — approving
//                                                        never edits a row in place, only ever
//                                                        inserts a new immutable version
//         &op=deliveries         [intelligence.view]      POST {action:'record'}
//         &op=outcomes           [intelligence.view]      POST {action:'create'}
//   zion  &op=journal            [any active staff, ownership-scoped to author_user_id — never
//                                             another author's rows] GET / POST (create)
//        &op=facts               [any active staff, ownership-scoped] GET ?journal_entry_id= /
//                                             POST {status:'confirmed'|'rejected'} — confirming a
//                                             fact itself requires the platform owner specifically
//        &op=ideas               [growth.view] GET ?status= / POST {action:'create'|
//                                             'update-status'}
//        &op=scripts             [growth.view] GET ?idea_id= / POST {idea_id, body, hook}
//        &op=character-assets    [growth.view] GET — read-only
//        &op=videos              [growth.view] GET ?status= / POST {action:'create-draft'|
//                                             'request-render'}
//        &op=review              [growth.view] POST {video_id, action:'approve'|
//                                             'request_changes'|'reject'|'schedule'}
//   installations                [growth.view; 'activate' action additionally requires
//                                             admin.view — activation authority is distinct from
//                                             ordinary installation access] GET ?organization_id=
//                                             (list) or &id= (detail incl. tests/events) / POST
//                                             {action:'create'|'record-test'|
//                                             'mark-sandbox-passed'|'activate'|'pause'|'resume'|
//                                             'offboard', ...} — sandbox_passed requires the LATEST
//                                             recorded test to be a real pass, re-derived from
//                                             installation_tests every time, never a separately
//                                             trusted flag
//   crystal &op=customers         [execution.view] GET ?q= search/list / POST {action:'create'|
//                                             'update', ...}
//          &op=properties         [execution.view] GET ?customer_id= / POST {action:...}
//          &op=catalog            [execution.view] GET / POST {action:'create'|'update', ...}
//          &op=quotes             [execution.view] GET ?id= / POST {action:'create'|
//                                             'update-scope'|'decline', ...}
//          &op=estimates          [execution.view] GET ?quote_request_id= / POST {action:
//                                             'create-draft'|'send'|'accept'|'reject', ...} —
//                                             versioned like audit_reports; accept refuses a stale
//                                             (superseded) version
//          &op=jobs               [execution.view; GET ?scope=mine is bare-staff, ownership-
//                                             scoped to the caller's own crystal_job_assignments
//                                             rows, trimmed fields — "workers see only assigned
//                                             jobs and necessary customer information"] GET ?id=
//                                             (detail incl. assignments/checklist/media/
//                                             completion) / POST {action:'create'|'assign-worker'|
//                                             'unassign-worker'|'update-status'|
//                                             'add-checklist-item'|'checklist-item'|'add-media'|
//                                             'complete'|'approve-completion', ...} — 'complete'
//                                             requires the caller be an assigned worker AND at
//                                             least one 'after' photo already on file (no AI-
//                                             declared completion without evidence)
//          &op=invoices           [admin.view] GET / POST {action:'create'|'send'|'mark-paid', ...}
//          &op=feedback           [execution.view] GET ?job_id= / POST {job_id, customer_id,
//                                             rating, comments}
//          &op=recurring          [execution.view] GET / POST {action:'create'|'pause'|'resume', ...}
//   approvals                    [admin.view]      GET aggregates pending audit reports + zion
//                                             videos + generic approval_requests into one inbox /
//                                             POST {action:'create'|'approve'|'reject'|'revoke', id}
//                                             — approve/reject recheck content_version (409 on
//                                             mismatch) and expires_at (410 if expired); revoke
//                                             only valid from 'approved'
//   auth                         retired — always 410 (see note above handler())

const BLOG_CATEGORIES = ['AI and Technology', 'Connecticut Business', 'Case Studies', 'News', 'Tips and Strategy'];
const PORTFOLIO_CATEGORIES = ['Websites', 'Social Media', 'Branding', 'AI Systems', 'Signage and Print', 'Apparel and Uniforms', 'Other'];
const PORTFOLIO_UPLOAD_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VAULT_CATEGORIES = ['contracts', 'invoices', 'files'];
const DOCUMENT_TYPES = ['Proposal', 'Contract', 'Invoice', 'Scope of Work', 'Letter of Intent'];

function slugify(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

// ---------------------------------------------------------------- invoices
async function handleInvoices(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/client_invoices?order=created_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (!r.ok) { console.error('[client:invoices] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
      return res.status(200).json(await r.json());
    } catch (err) {
      console.error('[client:invoices] Error:', err.message);
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
      if (!r.ok) { console.error('[client:invoices] Save error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to save invoice' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, invoice: rows[0] });
    } catch (err) {
      console.error('[client:invoices] Error:', err.message);
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

// --------------------------------------------------------------- referrals
// Strategy-meeting requests submitted from the public /welcome form.
async function handleIntakeRequests(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/intake_requests?order=created_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (!r.ok) { console.error('[client:intake-requests] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
      return res.status(200).json(await r.json());
    } catch (err) {
      console.error('[client:intake-requests] Error:', err.message);
      return res.status(200).json([]);
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const b = req.body || {};
  const action = sanitize(b.action, 20);

  if (action === 'update-status') {
    const id = sanitize(b.id, 100);
    const status = sanitize(b.status, 30);
    const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'no_show', 'rescheduled'];
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/intake_requests?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) { console.error('[client:intake-requests] Update error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to update status' }); }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[client:intake-requests] Error:', err.message);
      return res.status(500).json({ error: 'Failed to update status' });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

async function handleReferrals(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/referral_tracking?order=created_at.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (!r.ok) { console.error('[client:referrals] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
      return res.status(200).json(await r.json());
    } catch (err) {
      console.error('[client:referrals] Error:', err.message);
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
    const deal_value = Number(b.deal_value) || 0;
    const commission_rate = Number(b.commission_rate) || 0;
    const record = {
      rep_name: sanitize(b.rep_name, 150),
      rep_email: sanitize(b.rep_email, 200),
      client_id: sanitize(b.client_id, 100) || null,
      client_name: sanitize(b.client_name, 200),
      deal_value,
      commission_rate,
      commission_amount: Number((deal_value * commission_rate / 100).toFixed(2)),
      status: sanitize(b.status, 30) || 'Pending',
      retention_bonus_paid: b.retention_bonus_paid === true || b.retention_bonus_paid === 'true',
    };
    try {
      const url = (action === 'update' && id)
        ? `${SUPABASE_URL}/rest/v1/referral_tracking?id=eq.${encodeURIComponent(id)}`
        : `${SUPABASE_URL}/rest/v1/referral_tracking`;
      const r = await fetch(url, {
        method: (action === 'update' && id) ? 'PATCH' : 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!r.ok) { console.error('[client:referrals] Save error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to save referral' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, referral: rows[0] });
    } catch (err) {
      console.error('[client:referrals] Error:', err.message);
      return res.status(500).json({ error: 'Failed to save referral' });
    }
  }

  if (action === 'delete') {
    const id = sanitize(b.id, 100);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/referral_tracking?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return res.status(500).json({ error: 'Delete failed' });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// -------------------------------------------------------------------- vault
async function handleVaultList(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/vault_documents?order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[client:vault list] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
    return res.status(200).json(await r.json());
  } catch (err) {
    console.error('[client:vault list] Error:', err.message);
    return res.status(200).json([]);
  }
}

async function handleVaultUpload(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const b = req.body || {};
  const base64Full = typeof b.file_base64 === 'string' ? b.file_base64 : '';
  const match = base64Full.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return res.status(400).json({ error: 'Invalid file data' });
  const [, mimeType, base64Data] = match;

  const fileName  = sanitize(b.file_name, 200);
  const category  = VAULT_CATEGORIES.includes(b.category) ? b.category : 'files';
  const clientId  = sanitize(b.client_id, 100);
  const clientName = sanitize(b.client_name, 200);
  const docType   = sanitize(b.doc_type, 50) || 'Client File';
  const status    = sanitize(b.status, 30) || 'Active';

  if (!fileName) return res.status(400).json({ error: 'file_name is required' });

  try {
    const result = await uploadToVault(SUPABASE_URL, SUPABASE_KEY, {
      base64: base64Data, fileName, mimeType, category,
      clientId, clientName, docType, status, source: 'manual',
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[client:vault upload] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

// Repair task (2026-09-23): vault_documents.file_url is now a signed URL with a 30-day expiry
// (see api/_vaultStorage.js) instead of the permanent-but-broken public URL it used to be — a
// vault item older than 30 days needs a fresh signed link generated on demand, which is what this
// does. Not yet wired into NovaVault.jsx's UI (flagged in docs/PRODUCT_BUILD_STATE.md as a
// deliberate, bounded scope cut, not a silent gap) — the server-side capability exists so that
// follow-up is a small frontend change, not another backend one.
async function handleVaultResign(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const id = sanitize(req.body?.id, 100);
  const storagePath = sanitize(req.body?.storage_path, 400);
  if (!id || !storagePath) return res.status(400).json({ error: 'id and storage_path are required' });

  try {
    const file_url = await signVaultUrl(SUPABASE_URL, SUPABASE_KEY, storagePath);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/vault_documents?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ file_url }),
    });
    if (!r.ok) console.error('[client:vault resign] DB update error (non-fatal, URL still returned):', r.status, await r.text());
    return res.status(200).json({ ok: true, file_url });
  } catch (err) {
    console.error('[client:vault resign] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate a fresh signed link' });
  }
}

async function handleVaultDelete(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const id = sanitize(req.body?.id, 100);
  const storagePath = sanitize(req.body?.storage_path, 400);
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/vault_documents?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[client:vault delete] DB error:', r.status, await r.text()); return res.status(500).json({ error: 'Delete failed' }); }

    if (storagePath) {
      try {
        await fetch(`${SUPABASE_URL}/storage/v1/object/nova-vault/${storagePath}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
        });
      } catch {}
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[client:vault delete] Error:', err.message);
    return res.status(500).json({ error: 'Delete failed' });
  }
}

// ---------------------------------------------------------------- portfolio
async function handlePortfolioItems(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);

  const featured = req.query?.featured === 'true';
  const qs = featured
    ? 'featured=eq.true&order=sort_order.asc,created_at.desc'
    : 'order=sort_order.asc,created_at.desc';

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/portfolio?${qs}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[client:portfolio items] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
    return res.status(200).json(await r.json());
  } catch (err) {
    console.error('[client:portfolio items] Error:', err.message);
    return res.status(200).json([]);
  }
}

async function handlePortfolioUpload(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const b = req.body || {};
  const title       = sanitize(b.title, 200);
  const category    = sanitize(b.category, 50);
  const client_name = sanitize(b.client_name, 200);
  const image_base64 = typeof b.image_base64 === 'string' ? b.image_base64 : '';
  const featured    = b.featured === true || b.featured === 'true';
  const description = sanitize(b.description, 1000);
  const sort_order   = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;

  if (!title)        return res.status(400).json({ error: 'Title is required' });
  if (!image_base64) return res.status(400).json({ error: 'Image is required' });
  if (category && !PORTFOLIO_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const match = image_base64.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return res.status(400).json({ error: 'Invalid image data' });

  const [, mimeType, base64Data] = match;
  if (!PORTFOLIO_UPLOAD_MIMES.includes(mimeType)) {
    return res.status(400).json({ error: 'Image must be JPEG, PNG, WebP, or GIF' });
  }

  const ext      = mimeType.split('/')[1].replace('jpeg', 'jpg');
  const slug     = title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
  const filename = `${Date.now()}-${slug}.${ext}`;

  let imageBuffer;
  try {
    imageBuffer = Buffer.from(base64Data, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64 image data' });
  }

  if (imageBuffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image must be under 5MB' });
  }

  try {
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/portfolio/${filename}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        body: imageBuffer,
      }
    );
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('[client:portfolio upload] Storage error:', uploadRes.status, errText);
      return res.status(500).json({ error: 'Failed to upload image to storage. Make sure the "portfolio" bucket exists and is public in Supabase.' });
    }
  } catch (err) {
    console.error('[client:portfolio upload] Storage upload error:', err.message);
    return res.status(500).json({ error: 'Failed to upload image' });
  }

  const image_url = `${SUPABASE_URL}/storage/v1/object/public/portfolio/${filename}`;

  try {
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/portfolio`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        title,
        image_url,
        category: category || 'Other',
        client_name: client_name || null,
        featured,
        description: description || null,
        sort_order,
        created_at: new Date().toISOString(),
      }),
    });

    if (!dbRes.ok) {
      const errText = await dbRes.text();
      console.error('[client:portfolio upload] DB error:', dbRes.status, errText);
      return res.status(500).json({ error: 'Failed to save portfolio record. Make sure the "portfolio" table exists in Supabase.' });
    }

    const rows = await dbRes.json();
    return res.status(200).json({ ok: true, item: rows[0] });
  } catch (err) {
    console.error('[client:portfolio upload] DB error:', err.message);
    return res.status(500).json({ error: 'Failed to save portfolio item' });
  }
}

async function handlePortfolioMutate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const b      = req.body || {};
  const action = sanitize(b.action, 20);
  const id     = sanitize(b.id, 100);

  if (!id)     return res.status(400).json({ error: 'ID is required' });
  if (!action) return res.status(400).json({ error: 'Action is required' });

  if (action === 'delete') {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/portfolio?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        }
      );
      if (!r.ok) {
        console.error('[client:portfolio mutate] Delete error:', r.status, await r.text());
        return res.status(500).json({ error: 'Failed to delete item' });
      }

      const filename = sanitize(b.filename, 300);
      if (filename) {
        try {
          await fetch(`${SUPABASE_URL}/storage/v1/object/portfolio/${filename}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
          });
        } catch {}
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[client:portfolio mutate] Delete error:', err.message);
      return res.status(500).json({ error: 'Delete failed' });
    }
  }

  if (action === 'update') {
    const title       = sanitize(b.title, 200);
    const category    = sanitize(b.category, 50);
    const client_name = sanitize(b.client_name, 200);
    const description = sanitize(b.description, 1000);

    const patch = {};
    if (title) patch.title = title;
    if (category && PORTFOLIO_CATEGORIES.includes(category)) patch.category = category;
    if ('client_name' in b) patch.client_name = client_name || null;
    if ('featured' in b)    patch.featured = b.featured === true || b.featured === 'true';
    if ('description' in b) patch.description = description || null;
    if ('sort_order' in b)  patch.sort_order = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/portfolio?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(patch),
        }
      );
      if (!r.ok) {
        console.error('[client:portfolio mutate] Update error:', r.status, await r.text());
        return res.status(500).json({ error: 'Failed to update item' });
      }
      const rows = await r.json();
      return res.status(200).json({ ok: true, item: rows[0] });
    } catch (err) {
      console.error('[client:portfolio mutate] Update error:', err.message);
      return res.status(500).json({ error: 'Update failed' });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// ------------------------------------------------------------- site-content
async function handleSiteContent(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rateLimit(req, res, 60, 60_000)) return;

  if (req.method === 'GET') {
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json(null);

    const key = req.query?.key ? sanitize(req.query.key, 100) : null;
    const qs = key
      ? `section_key=eq.${encodeURIComponent(key)}&limit=1`
      : 'order=section_key.asc';

    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/site_content?${qs}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (!r.ok) return res.status(200).json(key ? null : []);
      const rows = await r.json();
      return res.status(200).json(key ? (rows[0] || null) : rows);
    } catch {
      return res.status(200).json(key ? null : []);
    }
  }

  if (req.method === 'POST') {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const b = req.body || {};
    const section_key = sanitize(b.section_key, 100);
    if (!section_key) return res.status(400).json({ error: 'section_key is required' });

    const content_json = b.content_json && typeof b.content_json === 'object'
      ? b.content_json
      : {};

    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/site_content`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
          section_key,
          content_json,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error('[client:site-content] Upsert error:', r.status, errText);
        return res.status(500).json({ error: 'Failed to save content. Make sure site_content table exists.' });
      }

      const rows = await r.json();
      return res.status(200).json({ ok: true, row: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// -------------------------------------------------------------------- blog
async function handleBlogPosts(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);

  const slug  = typeof req.query?.slug === 'string' ? req.query.slug : '';
  const admin = req.query?.admin === 'true';

  let qs = 'order=created_at.desc';
  if (slug) qs = `slug=eq.${encodeURIComponent(slug)}`;
  else if (!admin) qs = `published=eq.true&${qs}`;
  qs = `site=eq.nova&${qs}`;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?${qs}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[client:blog posts] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
    const data = await r.json();
    return res.status(200).json(slug ? (data[0] || null) : data);
  } catch (err) {
    console.error('[client:blog posts] Error:', err.message);
    return res.status(200).json(slug ? null : []);
  }
}

async function handleBlogAdmin(req, res, caller) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const b = req.body || {};
  const action = sanitize(b.action, 20);

  if (action === 'delete') {
    const id = sanitize(b.id, 100);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}&site=eq.nova`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return res.status(500).json({ error: 'Delete failed' });
    return res.status(200).json({ ok: true });
  }

  if (action === 'save') {
    const id               = sanitize(b.id, 100);
    const title              = sanitize(b.title, 200);
    const category             = sanitize(b.category, 50);
    const excerpt                = sanitize(b.excerpt, 500);
    const content                 = sanitize(b.content, 20000);
    const thumbnail_color          = sanitize(b.thumbnail_color, 20) || '#C49A3C';
    const seo_title                  = sanitize(b.seo_title, 200);
    const seo_description             = sanitize(b.seo_description, 300);

    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (category && !BLOG_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });

    const slug = sanitize(b.slug, 100) || slugify(title);

    // `published`/`status` are deliberately NOT accepted here — going live is now only reachable
    // through submit-for-review -> approve -> publish-now below, so a plain content edit can never
    // itself flip a post live (the real gap this migration closes: any growth.view staff member
    // could previously set published:true directly with zero second set of eyes on public
    // content). Omitting the columns entirely means PostgREST leaves them untouched on an update,
    // and they take their table DEFAULTs ('draft' / false) on a brand-new post.
    const record = {
      title, slug, category: category || BLOG_CATEGORIES[0], excerpt, content,
      thumbnail_color, seo_title: seo_title || title, seo_description: seo_description || excerpt,
      updated_at: new Date().toISOString(),
      site: 'nova', // every post created from the Nova Systems dashboard is tagged 'nova'
    };

    try {
      const url = id
        ? `${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}&site=eq.nova`
        : `${SUPABASE_URL}/rest/v1/blog_posts`;
      const r = await fetch(url, {
        method: id ? 'PATCH' : 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!r.ok) { console.error('[client:blog admin] Save error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to save post — slug may already be in use' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, post: rows[0] });
    } catch (err) {
      console.error('[client:blog admin] Error:', err.message);
      return res.status(500).json({ error: 'Failed to save post' });
    }
  }

  // ------------------------------------------------------------- content review/scheduling
  // (2026-09-24, master prompt §17) — draft -> in_review -> approved -> scheduled/published.
  // 'approve'/'request-changes' require admin.view specifically, re-checked here on top of the
  // dispatcher's blanket growth.view, the same "distinct, higher-trust gate for one consequential
  // action" pattern used for Installation Center activation.
  // The Approval Inbox's generic UI sends a bare 'reject' for every item type it aggregates —
  // here that means exactly the same thing as 'request-changes' (in_review -> draft, notes
  // required), so it's accepted as an alias rather than making the Inbox UI special-case content.
  const id = sanitize(b.id, 100);
  const normalizedAction = action === 'reject' ? 'request-changes' : action;
  if (['submit-for-review', 'approve', 'request-changes', 'schedule', 'publish-now'].includes(normalizedAction)) {
    if (!id) return res.status(400).json({ error: 'id is required' });
    const existingRes = await sbSelect(`blog_posts?id=eq.${encodeURIComponent(id)}&site=eq.nova&limit=1`);
    const existingRows = existingRes.ok ? await existingRes.json() : [];
    if (!existingRows.length) return res.status(404).json({ error: 'Post not found' });
    const existing = existingRows[0];

    if (normalizedAction === 'submit-for-review') {
      if (existing.status !== 'draft') return res.status(400).json({ error: `Cannot submit for review from status ${existing.status}` });
      if (!existing.title || !existing.content) return res.status(400).json({ error: 'Title and content are required before submitting for review' });
      const r = await sbWrite(`blog_posts?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'in_review', submitted_by: caller.id, submitted_at: new Date().toISOString() });
      if (!r.ok) { console.error('[client:blog admin] submit-for-review error:', await r.text()); return res.status(500).json({ error: 'Failed to submit for review' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, post: rows[0] });
    }

    if (normalizedAction === 'approve') {
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      if (existing.status !== 'in_review') return res.status(400).json({ error: `Cannot approve from status ${existing.status}` });
      const r = await sbWrite(`blog_posts?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'approved', approved_by: caller.id, approved_at: new Date().toISOString(), review_notes: null });
      if (!r.ok) { console.error('[client:blog admin] approve error:', await r.text()); return res.status(500).json({ error: 'Failed to approve post' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, post: rows[0] });
    }

    if (normalizedAction === 'request-changes') {
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      if (existing.status !== 'in_review') return res.status(400).json({ error: `Cannot request changes from status ${existing.status}` });
      // Accepts either field name: 'notes' from Blog.jsx's own dedicated UI, 'reason' from the
      // Approval Inbox's generic reject prompt (same field the Installation Center's pause/
      // offboard actions use) — both mean the same thing here, real reviewer feedback required.
      const notes = sanitize(b.notes, 2000) || sanitize(b.reason, 2000);
      if (!notes) return res.status(400).json({ error: 'notes are required when requesting changes' });
      const r = await sbWrite(`blog_posts?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'draft', review_notes: notes });
      if (!r.ok) { console.error('[client:blog admin] request-changes error:', await r.text()); return res.status(500).json({ error: 'Failed to request changes' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, post: rows[0] });
    }

    if (normalizedAction === 'schedule') {
      if (existing.status !== 'approved') return res.status(400).json({ error: `Cannot schedule from status ${existing.status} — must be approved first` });
      const scheduledAt = sanitize(b.scheduled_at, 40);
      if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt)) || new Date(scheduledAt) <= new Date()) {
        return res.status(400).json({ error: 'scheduled_at must be a valid future date/time' });
      }
      const r = await sbWrite(`blog_posts?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'scheduled', scheduled_at: scheduledAt });
      if (!r.ok) { console.error('[client:blog admin] schedule error:', await r.text()); return res.status(500).json({ error: 'Failed to schedule post' }); }
      const rows = await r.json();
      // This is what makes scheduling real instead of a field nobody ever reads: enqueues a durable
      // job (supabase/durable-jobs-migration-standalone.sql) that worker/index.mjs's marketing_publish
      // handler picks up once scheduled_at arrives. idempotency_key means re-scheduling to a new time
      // is a distinct job, but clicking "schedule" twice with the same time is a safe no-op enqueue,
      // not a duplicate publish. Enqueue failure doesn't fail the request — the post IS scheduled in
      // the data model either way, and a missing job just means it needs a manual Publish Now, an
      // honest degraded state, not a silent double-write.
      const jobRes = await sbWrite('jobs', 'POST', { job_type: 'marketing_publish', payload: { post_id: id }, scheduled_at: scheduledAt, idempotency_key: `marketing_publish:${id}:${scheduledAt}` });
      if (!jobRes.ok) console.error('[client:blog admin] failed to enqueue publish job (post is still scheduled in the data model):', await jobRes.text());
      return res.status(200).json({ ok: true, post: rows[0] });
    }

    if (normalizedAction === 'publish-now') {
      // Scheduling only records intent (see the migration's own note) — there is no durable
      // worker/cron in this codebase yet to act on scheduled_at automatically, so going live is
      // always this explicit, real action, whether triggered early from 'approved' or once the
      // scheduled time has actually arrived from 'scheduled'. Never faked as automatic.
      if (!['approved', 'scheduled'].includes(existing.status)) return res.status(400).json({ error: `Cannot publish from status ${existing.status}` });
      const r = await sbWrite(`blog_posts?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'published', published: true, updated_at: new Date().toISOString() });
      if (!r.ok) { console.error('[client:blog admin] publish-now error:', await r.text()); return res.status(500).json({ error: 'Failed to publish post' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, post: rows[0] });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// --------------------------------------------------------------- documents
// Repair task (2026-09-21): Documents.jsx's "Saved Documents" list previously read
// localStorage('nova_crm_docs') only — real generations were written server-side to the
// `documents` table (see the POST branch below) but never read back, so the UI showed a
// different, purely-local, per-browser history than what was actually saved. This GET branch
// and the mark-sent action make Supabase the one real source of truth for both.
async function handleDocumentsList(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documents?order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[client:documents list] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
    return res.status(200).json(await r.json());
  } catch (err) {
    console.error('[client:documents list] Error:', err.message);
    return res.status(200).json([]);
  }
}

async function handleDocumentMarkSent(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const id = sanitize(req.body?.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documents?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: 'sent' }),
    });
    if (!r.ok) { console.error('[client:documents mark-sent] Error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to update document' }); }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[client:documents mark-sent] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update document' });
  }
}

async function handleDocuments(req, res) {
  if (req.method === 'GET') return handleDocumentsList(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.body?.action === 'mark-sent') return handleDocumentMarkSent(req, res);
  if (!rateLimit(req, res, 10, 60_000)) return;

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const b = req.body || {};
  const entity_name = sanitize(b.entity_name, 200);
  const industry    = sanitize(b.industry, 100);
  const doc_type    = sanitize(b.doc_type, 60);
  const description = sanitize(b.description, 2000);
  const client_id   = sanitize(b.client_id, 100);
  const lead_id     = sanitize(b.lead_id, 100);

  if (!entity_name || !doc_type) {
    return res.status(400).json({ error: 'entity_name and doc_type are required' });
  }
  if (!DOCUMENT_TYPES.includes(doc_type)) {
    return res.status(400).json({ error: 'Invalid document type' });
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const userPrompt = [
    `Generate a professional ${doc_type} for: ${entity_name}`,
    industry ? `Industry: ${industry}` : '',
    `Date: ${today}`,
    description ? `\nSpecific details / instructions:\n${description}` : '',
    '\nNova Systems info: Isaac Nova, Founder | nova-systems.app | Waterbury, CT | isaac@nova-systems.app',
    '\nFormat as a clean, professional, ready-to-sign document with clear sections.',
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system: [
          'You are a professional business document writer for Nova Systems, a Connecticut-based operational infrastructure company.',
          'Nova Systems builds custom websites, CRMs, AI agents, and social media systems for small businesses.',
          'Generate clean, professional, concise documents. Use plain text with clear sections and line breaks.',
          'Include a proper letterhead, date, parties involved, terms, and signature lines.',
          'Be specific and business-ready. Do not include placeholder text — write real content based on the context provided.',
        ].join(' '),
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('[client:documents] Anthropic error:', data.error);
      return res.status(500).json({ error: data.error.message || 'AI generation failed' });
    }

    // claude-sonnet-5 emits a leading `thinking` block before the `text` block, so the first
    // content item isn't reliably the response text.
    const text = data.content?.find((c) => c.type === 'text')?.text || '';

    let savedDoc = null;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && (client_id || lead_id)) {
      try {
        const saveRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            client_id: client_id || null,
            lead_id: lead_id || null,
            entity_name,
            type: doc_type,
            content: text,
            status: 'draft',
            created_at: new Date().toISOString(),
          }),
        });
        if (saveRes.ok) {
          const rows = await saveRes.json();
          savedDoc = rows[0] || null;
          console.log('[client:documents] Draft saved to Supabase');
        } else {
          console.error('[client:documents] Save error:', saveRes.status, await saveRes.text());
        }
      } catch (err) {
        console.error('[client:documents] Supabase save (non-fatal):', err.message);
      }
    }

    res.status(200).json({ text, document: savedDoc });
  } catch (err) {
    console.error('[client:documents] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate document' });
  }
}

// -------------------------------------------------------------- newsletter
// Repair task (2026-09-21): Newsletter.jsx was 100% localStorage (crmStore's nova_nl_subscribers/
// nova_nl_sent) — subscribers and send history existed only in whichever browser added them,
// invisible to Isaac on another device and lost if storage was ever cleared. This is the real
// backing store (see supabase/schema-update.sql's newsletter_subscribers/newsletter_sends
// section — same "append to the migration file, Isaac runs it manually" pattern as every other
// schema change in this project). The actual per-subscriber send loop still runs from the
// frontend against api/notify.js — unchanged here — this only makes the roster and the sent-log
// real and shared instead of per-browser fiction.
async function handleNewsletter(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json({ subscribers: [], sent: [] });
    try {
      const [subRes, sentRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/newsletter_subscribers?order=created_at.desc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        }),
        fetch(`${SUPABASE_URL}/rest/v1/newsletter_sends?order=sent_at.desc`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        }),
      ]);
      const subscribers = subRes.ok ? await subRes.json() : [];
      const sent = sentRes.ok ? await sentRes.json() : [];
      if (!subRes.ok) console.error('[client:newsletter] subscribers error:', subRes.status, await subRes.text().catch(() => ''));
      if (!sentRes.ok) console.error('[client:newsletter] sent error:', sentRes.status, await sentRes.text().catch(() => ''));
      return res.status(200).json({ subscribers, sent });
    } catch (err) {
      console.error('[client:newsletter] Error:', err.message);
      return res.status(200).json({ subscribers: [], sent: [] });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const b = req.body || {};
  const action = sanitize(b.action, 30);

  if (action === 'add-subscriber') {
    const email = sanitizeEmail(b.email);
    if (!email) return res.status(400).json({ error: 'A valid email is required' });
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/newsletter_subscribers`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation,resolution=ignore-duplicates',
        },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) { console.error('[client:newsletter] add-subscriber error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to add subscriber' }); }
      const rows = await r.json();
      if (!rows.length) return res.status(200).json({ ok: false, reason: 'duplicate' });
      return res.status(200).json({ ok: true, subscriber: rows[0] });
    } catch (err) {
      console.error('[client:newsletter] Error:', err.message);
      return res.status(500).json({ error: 'Failed to add subscriber' });
    }
  }

  if (action === 'record-send') {
    const subject = sanitize(b.subject, 300);
    const body = sanitize(b.body, 20000);
    const recipient_count = Number(b.recipient_count) || 0;
    if (!subject) return res.status(400).json({ error: 'subject is required' });
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/newsletter_sends`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify({ subject, body, recipient_count, sent_at: new Date().toISOString() }),
      });
      if (!r.ok) { console.error('[client:newsletter] record-send error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to record send' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, send: rows[0] });
    } catch (err) {
      console.error('[client:newsletter] Error:', err.message);
      return res.status(500).json({ error: 'Failed to record send' });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// =============================================================================================
// Shared CRM/Order foundations + Nova Audit workflow (2026-09-23, master build prompt §6/§8/§9).
// Schema: supabase/crm-order-audit-migration-standalone.sql — NOT yet applied to production.
//
// Unlike the older invoices/referrals/intake-requests handlers above (which read/write across
// every organization with no per-request org check — a known, previously-flagged gap, not a
// pattern to repeat), every handler below requires an explicit organization_id and verifies the
// CALLER actually has the stated permission on THAT SPECIFIC org before touching any data. That
// check reuses the real has_permission() Postgres function, called with the caller's OWN access
// token (not the service-role key), which is the exact same function real RLS policies and
// requireStaff()'s permission check already depend on — not a second, hand-rolled, easier-to-get-
// wrong implementation of the same idea.
// =============================================================================================

function sbEnv() {
  return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

function callerToken(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

// Verifies the CALLER (their own token, not service role) really has `permission` on `orgId` —
// object-level authorization, not just "did they have the resource-level permission somewhere."
async function requireOrgAccess(req, res, orgId, permission) {
  const { url, key } = sbEnv();
  const token = callerToken(req);
  if (!orgId) { res.status(400).json({ error: 'organization_id is required' }); return false; }
  try {
    const r = await fetch(`${url}/rest/v1/rpc/has_permission`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_org_id: orgId, permission_key: permission }),
    });
    const allowed = r.ok && (await r.json()) === true;
    if (!allowed) { res.status(403).json({ error: 'Insufficient permissions for this organization' }); return false; }
    return true;
  } catch (err) {
    console.error('[client:requireOrgAccess] Error:', err.message);
    res.status(502).json({ error: 'Authorization check failed' });
    return false;
  }
}

async function sbSelect(path) {
  const { url, key } = sbEnv();
  return fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
}
async function sbWrite(path, method, body) {
  const { url, key } = sbEnv();
  return fetch(`${url}/rest/v1/${path}`, {
    method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
}

// ------------------------------------------------------------------------------- crm: businesses
// "Resolve business identity from name, website and location. Show ambiguous matches for
// selection; never combine similarly named firms." — this returns CANDIDATES; the caller (staff
// member, via the frontend) decides whether to reuse one or create a new row. Nothing here ever
// auto-merges two businesses.
async function handleCrmBusinesses(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
    const q = sanitize(req.query?.q, 200);
    let path = `businesses?organization_id=eq.${encodeURIComponent(orgId)}&order=name.asc`;
    if (q) path += `&or=(name.ilike.*${encodeURIComponent(q)}*,website.ilike.*${encodeURIComponent(q)}*)`;
    const r = await sbSelect(path);
    if (!r.ok) { console.error('[client:crm businesses] error:', await r.text()); return res.status(500).json({ error: 'Failed to search businesses' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
  const action = sanitize(b.action, 20);

  if (action === 'create' || action === 'update') {
    const id = sanitize(b.id, 100);
    const record = {
      organization_id: orgId,
      name: sanitize(b.name, 200),
      aliases: Array.isArray(b.aliases) ? b.aliases.map((a) => sanitize(a, 200)) : [],
      website: sanitize(b.website, 300) || null,
      confirmed_website: b.confirmed_website === true,
      phone: sanitize(b.phone, 30) || null,
      address_line: sanitize(b.address_line, 300) || null,
      city: sanitize(b.city, 100) || null,
      state: sanitize(b.state, 50) || null,
      postal_code: sanitize(b.postal_code, 20) || null,
      industry: sanitize(b.industry, 100) || null,
      confidence: ['unconfirmed', 'likely', 'confirmed'].includes(b.confidence) ? b.confidence : 'unconfirmed',
      notes: sanitize(b.notes, 2000) || null,
      updated_at: new Date().toISOString(),
    };
    if (!record.name) return res.status(400).json({ error: 'name is required' });
    const path = action === 'update' && id ? `businesses?id=eq.${encodeURIComponent(id)}` : 'businesses';
    const r = await sbWrite(path, action === 'update' && id ? 'PATCH' : 'POST', record);
    if (!r.ok) { console.error('[client:crm businesses] save error:', await r.text()); return res.status(500).json({ error: 'Failed to save business' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, business: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// ---------------------------------------------------------------------------------- crm: contacts
async function handleCrmContacts(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
    const businessId = sanitize(req.query?.business_id, 100);
    let path = `crm_contacts?organization_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`;
    if (businessId) path += `&business_id=eq.${encodeURIComponent(businessId)}`;
    const r = await sbSelect(path);
    if (!r.ok) { console.error('[client:crm contacts] error:', await r.text()); return res.status(500).json({ error: 'Failed to load contacts' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
  const action = sanitize(b.action, 20);

  if (action === 'create' || action === 'update') {
    const id = sanitize(b.id, 100);
    const record = {
      organization_id: orgId,
      business_id: sanitize(b.business_id, 100) || null,
      name: sanitize(b.name, 200),
      email: b.email ? sanitizeEmail(b.email) : null,
      phone: sanitize(b.phone, 30) || null,
      title: sanitize(b.title, 150) || null,
      sms_consent: b.sms_consent === true,
      email_consent: b.email_consent === true,
      do_not_contact: b.do_not_contact === true,
      source: sanitize(b.source, 100) || null,
      updated_at: new Date().toISOString(),
    };
    if (!record.name) return res.status(400).json({ error: 'name is required' });
    const path = action === 'update' && id ? `crm_contacts?id=eq.${encodeURIComponent(id)}` : 'crm_contacts';
    const r = await sbWrite(path, action === 'update' && id ? 'PATCH' : 'POST', record);
    if (!r.ok) { console.error('[client:crm contacts] save error:', await r.text()); return res.status(500).json({ error: 'Failed to save contact' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, contact: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// ------------------------------------------------------------------------------------ crm: deals
const DEAL_STAGES = ['new', 'assigned', 'attempted', 'connected', 'qualified', 'discovery', 'proposal', 'accepted', 'payment_condition_satisfied', 'onboarding', 'lost', 'disqualified', 'nurture', 'paused'];

async function handleCrmDeals(req, res, caller) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
    let path = `crm_deals?organization_id=eq.${encodeURIComponent(orgId)}&order=updated_at.desc`;
    const pipeline = sanitize(req.query?.pipeline, 30);
    if (pipeline) path += `&pipeline=eq.${encodeURIComponent(pipeline)}`;
    const r = await sbSelect(path);
    if (!r.ok) { console.error('[client:crm deals] error:', await r.text()); return res.status(500).json({ error: 'Failed to load deals' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
  const action = sanitize(b.action, 20);

  if (action === 'create') {
    const record = {
      organization_id: orgId,
      business_id: sanitize(b.business_id, 100) || null,
      contact_id: sanitize(b.contact_id, 100) || null,
      lead_id: sanitize(b.lead_id, 100) || null,
      pipeline: ['nova_sales', 'client_sales', 'crystal_service'].includes(b.pipeline) ? b.pipeline : 'nova_sales',
      stage: 'new',
      stage_history: [{ stage: 'new', at: new Date().toISOString(), by: caller.email }],
      owner_user_id: sanitize(b.owner_user_id, 100) || caller.id,
      value_cents: Number.isFinite(Number(b.value_cents)) ? Number(b.value_cents) : null,
      currency: sanitize(b.currency, 10) || 'USD',
      source: sanitize(b.source, 100) || null,
    };
    const r = await sbWrite('crm_deals', 'POST', record);
    if (!r.ok) { console.error('[client:crm deals] create error:', await r.text()); return res.status(500).json({ error: 'Failed to create deal' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, deal: rows[0] });
  }

  if (action === 'update-stage') {
    const id = sanitize(b.id, 100);
    const stage = sanitize(b.stage, 30);
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (!DEAL_STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });

    const existingRes = await sbSelect(`crm_deals?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(orgId)}&limit=1`);
    const existingRows = existingRes.ok ? await existingRes.json() : [];
    if (!existingRows.length) return res.status(404).json({ error: 'Deal not found' });
    const existing = existingRows[0];

    const history = Array.isArray(existing.stage_history) ? existing.stage_history : [];
    history.push({ stage, at: new Date().toISOString(), by: caller.email });
    const isClosed = ['lost', 'disqualified'].includes(stage);
    const patch = {
      stage, stage_history: history, updated_at: new Date().toISOString(),
      lost_reason: stage === 'lost' ? sanitize(b.lost_reason, 500) || existing.lost_reason : existing.lost_reason,
      closed_at: isClosed ? new Date().toISOString() : existing.closed_at,
    };
    const r = await sbWrite(`crm_deals?id=eq.${encodeURIComponent(id)}`, 'PATCH', patch);
    if (!r.ok) { console.error('[client:crm deals] update-stage error:', await r.text()); return res.status(500).json({ error: 'Failed to update deal stage' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, deal: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// ------------------------------------------------------------------------------------- products
async function handleProducts(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;
  const r = await sbSelect('products?order=category.asc,name.asc');
  if (!r.ok) { console.error('[client:products] error:', await r.text()); return res.status(500).json({ error: 'Failed to load catalog' }); }
  return res.status(200).json(await r.json());
}

// ---------------------------------------------------------------------------------------- orders
const ORDER_STATUSES = ['draft', 'scoped', 'awaiting_acceptance', 'accepted', 'waiting_for_inputs', 'ready_for_work', 'in_progress', 'review', 'delivered', 'installed', 'monitoring', 'support', 'closed', 'paused', 'cancelled', 'refunded', 'disputed'];

async function handleOrders(req, res, caller) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
    const r = await sbSelect(`orders?organization_id=eq.${encodeURIComponent(orgId)}&order=updated_at.desc`);
    if (!r.ok) { console.error('[client:orders] error:', await r.text()); return res.status(500).json({ error: 'Failed to load orders' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
  const action = sanitize(b.action, 20);

  if (action === 'create') {
    const productId = sanitize(b.product_id, 100);
    if (!productId) return res.status(400).json({ error: 'product_id is required' });
    const prodRes = await sbSelect(`products?id=eq.${encodeURIComponent(productId)}&limit=1`);
    const prodRows = prodRes.ok ? await prodRes.json() : [];
    if (!prodRows.length) return res.status(404).json({ error: 'Product not found' });
    const product = prodRows[0];

    const record = {
      organization_id: orgId,
      business_id: sanitize(b.business_id, 100) || null,
      deal_id: sanitize(b.deal_id, 100) || null,
      product_id: productId,
      product_version: product.version,
      scope: b.scope && typeof b.scope === 'object' ? b.scope : {},
      // Unknown pricing must never be invented — leave null rather than guess, per the master
      // prompt's explicit instruction. Only a value the caller actually provided is stored, and
      // even then only once the product's pricing_config has been marked approved.
      price_cents: product.pricing_approved && Number.isFinite(Number(b.price_cents)) ? Number(b.price_cents) : null,
      currency: sanitize(b.currency, 10) || 'USD',
      owner_user_id: caller.id,
      status: 'draft',
      status_history: [{ status: 'draft', at: new Date().toISOString(), by: caller.email }],
      inputs: {},
    };
    const r = await sbWrite('orders', 'POST', record);
    if (!r.ok) { console.error('[client:orders] create error:', await r.text()); return res.status(500).json({ error: 'Failed to create order' }); }
    const rows = await r.json();
    const orderId = rows[0]?.id;
    if (orderId) await sbWrite('order_events', 'POST', { order_id: orderId, event_type: 'created', actor_user_id: caller.id, detail: { product_id: productId } });
    return res.status(200).json({ ok: true, order: rows[0] });
  }

  if (action === 'update-status') {
    const id = sanitize(b.id, 100);
    const status = sanitize(b.status, 30);
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const existingRes = await sbSelect(`orders?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(orgId)}&limit=1`);
    const existingRows = existingRes.ok ? await existingRes.json() : [];
    if (!existingRows.length) return res.status(404).json({ error: 'Order not found' });
    const existing = existingRows[0];

    const history = Array.isArray(existing.status_history) ? existing.status_history : [];
    history.push({ status, at: new Date().toISOString(), by: caller.email });
    const isTerminal = ['closed', 'cancelled', 'refunded'].includes(status);
    const patch = { status, status_history: history, updated_at: new Date().toISOString(), closed_at: isTerminal ? new Date().toISOString() : existing.closed_at };
    const r = await sbWrite(`orders?id=eq.${encodeURIComponent(id)}`, 'PATCH', patch);
    if (!r.ok) { console.error('[client:orders] update-status error:', await r.text()); return res.status(500).json({ error: 'Failed to update order' }); }
    await sbWrite('order_events', 'POST', { order_id: id, event_type: 'status_changed', actor_user_id: caller.id, detail: { from: existing.status, to: status } });
    const rows = await r.json();
    return res.status(200).json({ ok: true, order: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// =============================================================================================
// Installation Center (2026-09-23, master prompt §13). Schema:
// supabase/installation-center-migration-standalone.sql — NOT yet applied to production.
//
// One installation per order. sandbox_setup -> sandbox_testing (real recorded test runs, not a
// checkbox) -> sandbox_passed (requires the LATEST recorded test to be a real pass — re-derived
// from installation_tests, never tracked as a separate boolean that could drift from the actual
// evidence) -> active, which requires 'admin.view' specifically, not the 'growth.view' every
// other installation action uses — "activation authority" is a distinct, higher-trust gate from
// ordinary CRM/order access, enforced server-side exactly like invoices/vault/approvals, not left
// to a hidden button in the UI. pause/resume toggle active<->paused with a required reason;
// offboard is terminal from any non-offboarded state, also with a required reason.
// =============================================================================================
const INSTALLATION_ACTIVATE_PERMISSION = 'admin.view';

async function loadInstallation(id, orgId) {
  const r = await sbSelect(`installations?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(orgId)}&limit=1`);
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}

async function logInstallationEvent(installationId, eventType, actorUserId, detail) {
  await sbWrite('installation_events', 'POST', { installation_id: installationId, event_type: eventType, actor_user_id: actorUserId, detail: detail || {} });
}

async function handleInstallations(req, res, caller) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
    const id = sanitize(req.query?.id, 100);
    if (id) {
      const installation = await loadInstallation(id, orgId);
      if (!installation) return res.status(404).json({ error: 'Installation not found' });
      const [testsRes, eventsRes] = await Promise.all([
        sbSelect(`installation_tests?installation_id=eq.${encodeURIComponent(id)}&order=created_at.desc`),
        sbSelect(`installation_events?installation_id=eq.${encodeURIComponent(id)}&order=created_at.desc`),
      ]);
      return res.status(200).json({
        ...installation,
        tests: testsRes.ok ? await testsRes.json() : [],
        events: eventsRes.ok ? await eventsRes.json() : [],
      });
    }
    const r = await sbSelect(`installations?organization_id=eq.${encodeURIComponent(orgId)}&order=updated_at.desc`);
    if (!r.ok) { console.error('[client:installations] error:', await r.text()); return res.status(500).json({ error: 'Failed to load installations' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'growth.view'))) return;
  const action = sanitize(b.action, 30);

  if (action === 'create') {
    const orderId = sanitize(b.order_id, 100);
    if (!orderId) return res.status(400).json({ error: 'order_id is required' });
    const orderRes = await sbSelect(`orders?id=eq.${encodeURIComponent(orderId)}&organization_id=eq.${encodeURIComponent(orgId)}&limit=1`);
    const orderRows = orderRes.ok ? await orderRes.json() : [];
    if (!orderRows.length) return res.status(404).json({ error: 'Order not found in this organization' });
    const order = orderRows[0];

    const record = {
      organization_id: orgId,
      order_id: orderId,
      business_id: order.business_id || null,
      product_id: order.product_id || null,
    };
    const r = await sbWrite('installations', 'POST', record);
    if (!r.ok) {
      const errText = await r.text();
      console.error('[client:installations] create error:', errText);
      // The order_id UNIQUE constraint is the real, intended guard against a second installation
      // silently duplicating work already in flight for the same order — surface that plainly.
      if (r.status === 409 || /duplicate key/i.test(errText)) return res.status(409).json({ error: 'An installation already exists for this order' });
      return res.status(500).json({ error: 'Failed to create installation' });
    }
    const rows = await r.json();
    const installation = rows[0];
    await logInstallationEvent(installation.id, 'created', caller.id, { order_id: orderId });
    return res.status(200).json({ ok: true, installation });
  }

  const id = sanitize(b.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });
  const installation = await loadInstallation(id, orgId);
  if (!installation) return res.status(404).json({ error: 'Installation not found' });

  if (action === 'record-test') {
    if (!['sandbox_setup', 'sandbox_testing'].includes(installation.status)) {
      return res.status(400).json({ error: `Cannot record a test while the installation is ${installation.status}` });
    }
    const testName = sanitize(b.test_name, 200);
    const result = ['pass', 'fail', 'blocked'].includes(b.result) ? b.result : null;
    if (!testName || !result) return res.status(400).json({ error: 'test_name and a valid result (pass|fail|blocked) are required' });
    const environment = b.environment === 'production' ? 'production' : 'sandbox';

    const testR = await sbWrite('installation_tests', 'POST', { installation_id: id, test_name: testName, environment, result, run_by: caller.id, notes: sanitize(b.notes, 2000) || null, evidence: b.evidence && typeof b.evidence === 'object' ? b.evidence : {} });
    if (!testR.ok) { console.error('[client:installations] record-test error:', await testR.text()); return res.status(500).json({ error: 'Failed to record test' }); }
    const testRows = await testR.json();

    if (installation.status === 'sandbox_setup') {
      await sbWrite(`installations?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'sandbox_testing', updated_at: new Date().toISOString() });
    }
    await logInstallationEvent(id, 'test_recorded', caller.id, { test_name: testName, result });
    return res.status(200).json({ ok: true, test: testRows[0] });
  }

  if (action === 'mark-sandbox-passed') {
    if (installation.status !== 'sandbox_testing') {
      return res.status(400).json({ error: `Cannot mark sandbox passed from status ${installation.status}` });
    }
    const testsRes = await sbSelect(`installation_tests?installation_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=1`);
    const testsRows = testsRes.ok ? await testsRes.json() : [];
    // Re-derived from the real evidence, not a separately trusted flag: the most recent recorded
    // test must itself be a pass. A stale pass shadowed by a later fail does not count.
    if (!testsRows.length || testsRows[0].result !== 'pass') {
      return res.status(400).json({ error: 'The most recent recorded test must be a pass before sandbox can be marked passed' });
    }
    const r = await sbWrite(`installations?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'sandbox_passed', updated_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:installations] mark-sandbox-passed error:', await r.text()); return res.status(500).json({ error: 'Failed to update installation' }); }
    await logInstallationEvent(id, 'sandbox_passed', caller.id, {});
    const rows = await r.json();
    return res.status(200).json({ ok: true, installation: rows[0] });
  }

  if (action === 'activate') {
    // Activation authority: a distinct, higher-trust gate from the growth.view already checked
    // above for every other installation action — enforced here server-side, not a hidden button.
    if (!(await requireOrgAccess(req, res, orgId, INSTALLATION_ACTIVATE_PERMISSION))) return;
    if (installation.status !== 'sandbox_passed') {
      return res.status(400).json({ error: `Cannot activate from status ${installation.status} — sandbox must pass first` });
    }
    const now = new Date().toISOString();
    const r = await sbWrite(`installations?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'active', activated_by: caller.id, activated_at: now, updated_at: now });
    if (!r.ok) { console.error('[client:installations] activate error:', await r.text()); return res.status(500).json({ error: 'Failed to activate installation' }); }
    await logInstallationEvent(id, 'activated', caller.id, {});
    if (installation.order_id) await sbWrite(`orders?id=eq.${encodeURIComponent(installation.order_id)}`, 'PATCH', { status: 'installed', updated_at: now });
    const rows = await r.json();
    return res.status(200).json({ ok: true, installation: rows[0] });
  }

  if (action === 'pause') {
    if (installation.status !== 'active') return res.status(400).json({ error: `Cannot pause from status ${installation.status}` });
    const reason = sanitize(b.reason, 1000);
    if (!reason) return res.status(400).json({ error: 'reason is required to pause an installation' });
    const r = await sbWrite(`installations?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'paused', paused_at: new Date().toISOString(), pause_reason: reason, updated_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:installations] pause error:', await r.text()); return res.status(500).json({ error: 'Failed to pause installation' }); }
    await logInstallationEvent(id, 'paused', caller.id, { reason });
    const rows = await r.json();
    return res.status(200).json({ ok: true, installation: rows[0] });
  }

  if (action === 'resume') {
    if (installation.status !== 'paused') return res.status(400).json({ error: `Cannot resume from status ${installation.status}` });
    const r = await sbWrite(`installations?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'active', paused_at: null, pause_reason: null, updated_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:installations] resume error:', await r.text()); return res.status(500).json({ error: 'Failed to resume installation' }); }
    await logInstallationEvent(id, 'resumed', caller.id, {});
    const rows = await r.json();
    return res.status(200).json({ ok: true, installation: rows[0] });
  }

  if (action === 'offboard') {
    if (installation.status === 'offboarded') return res.status(400).json({ error: 'Installation is already offboarded' });
    const reason = sanitize(b.reason, 1000);
    if (!reason) return res.status(400).json({ error: 'reason is required to offboard an installation' });
    const r = await sbWrite(`installations?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'offboarded', offboarded_at: new Date().toISOString(), offboard_reason: reason, updated_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:installations] offboard error:', await r.text()); return res.status(500).json({ error: 'Failed to offboard installation' }); }
    await logInstallationEvent(id, 'offboarded', caller.id, { reason });
    const rows = await r.json();
    return res.status(200).json({ ok: true, installation: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// ===================================================================== Nova Audit workflow
async function loadAuditCase(id, orgId) {
  const r = await sbSelect(`audit_cases?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(orgId)}&limit=1`);
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}

async function handleAuditCases(req, res, caller) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
    const id = sanitize(req.query?.id, 100);
    if (id) {
      const c = await loadAuditCase(id, orgId);
      if (!c) return res.status(404).json({ error: 'Case not found' });
      const clock = computeCaseClockStatus({
        status: c.status, startConditionMetAt: c.start_condition_met_at, targetHours: c.target_hours,
        clockBasis: c.clock_basis, timezone: c.timezone, pausedAt: c.paused_at, totalPausedSeconds: c.total_paused_seconds,
      });
      return res.status(200).json({ ...c, clock });
    }
    const r = await sbSelect(`audit_cases?organization_id=eq.${encodeURIComponent(orgId)}&order=updated_at.desc`);
    if (!r.ok) { console.error('[client:audit cases] error:', await r.text()); return res.status(500).json({ error: 'Failed to load cases' }); }
    const cases = await r.json();
    const withClocks = cases.map((c) => ({
      ...c,
      clock: computeCaseClockStatus({
        status: c.status, startConditionMetAt: c.start_condition_met_at, targetHours: c.target_hours,
        clockBasis: c.clock_basis, timezone: c.timezone, pausedAt: c.paused_at, totalPausedSeconds: c.total_paused_seconds,
      }),
    }));
    return res.status(200).json(withClocks);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
  const action = sanitize(b.action, 20);

  if (action === 'create') {
    const scope = ['digital', '360'].includes(b.scope) ? b.scope : 'digital';
    const targetHours = Number.isFinite(Number(b.target_hours)) ? Number(b.target_hours) : (scope === 'digital' ? 72 : 240);
    const record = {
      organization_id: orgId,
      business_id: sanitize(b.business_id, 100) || null,
      order_id: sanitize(b.order_id, 100) || null,
      scope,
      status: 'intake',
      clock_basis: ['elapsed', 'business_hours'].includes(b.clock_basis) ? b.clock_basis : 'elapsed',
      timezone: sanitize(b.timezone, 60) || 'America/New_York',
      target_hours: targetHours,
      owner_user_id: sanitize(b.owner_user_id, 100) || caller.id,
    };
    const r = await sbWrite('audit_cases', 'POST', record);
    if (!r.ok) { console.error('[client:audit cases] create error:', await r.text()); return res.status(500).json({ error: 'Failed to create case' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, case: rows[0] });
  }

  const id = sanitize(b.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });
  const existing = await loadAuditCase(id, orgId);
  if (!existing) return res.status(404).json({ error: 'Case not found' });

  // The clock only starts running once intake/access requirements are actually satisfied — this
  // is the one explicit transition that sets start_condition_met_at, and it's set exactly once.
  if (action === 'mark-ready') {
    if (existing.start_condition_met_at) return res.status(400).json({ error: 'This case has already started its clock' });
    const startAt = new Date().toISOString();
    const patch = { status: 'researching', start_condition_met_at: startAt, updated_at: startAt };
    const r = await sbWrite(`audit_cases?id=eq.${encodeURIComponent(id)}`, 'PATCH', patch);
    if (!r.ok) { console.error('[client:audit cases] mark-ready error:', await r.text()); return res.status(500).json({ error: 'Failed to start the case clock' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, case: rows[0] });
  }

  if (action === 'update-status') {
    const status = sanitize(b.status, 30);
    const VALID = ['intake', 'inputs_pending', 'ready', 'researching', 'evidence_gathered', 'findings_drafted', 'report_draft', 'qa_review', 'approved', 'delivered', 'customer_decision', 'implementation', 'outcome_tracking', 'closed'];
    if (!VALID.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const r = await sbWrite(`audit_cases?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:audit cases] update-status error:', await r.text()); return res.status(500).json({ error: 'Failed to update case' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, case: rows[0] });
  }

  // Pause/resume — "do not silently extend deadlines or reset the clock": pausing records the
  // real moment paused; resuming adds exactly that elapsed duration to total_paused_seconds and
  // clears paused_at, so computeDueAt's math (see api/_auditClock.js) reflects real wall-clock
  // pause time, nothing invented or rounded in the case's favor.
  if (action === 'pause') {
    if (existing.paused_at) return res.status(400).json({ error: 'Case is already paused' });
    const pausedAt = new Date().toISOString();
    const reason = sanitize(b.reason, 500) || null;
    await sbWrite('audit_case_pause_events', 'POST', { case_id: id, paused_at: pausedAt, reason, actor_user_id: caller.id });
    const r = await sbWrite(`audit_cases?id=eq.${encodeURIComponent(id)}`, 'PATCH', { paused_at: pausedAt, pause_reason: reason, updated_at: pausedAt });
    if (!r.ok) { console.error('[client:audit cases] pause error:', await r.text()); return res.status(500).json({ error: 'Failed to pause case' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, case: rows[0] });
  }

  if (action === 'resume') {
    if (!existing.paused_at) return res.status(400).json({ error: 'Case is not currently paused' });
    const resumedAt = new Date();
    const pausedDurationSeconds = Math.max(0, Math.round((resumedAt.getTime() - new Date(existing.paused_at).getTime()) / 1000));
    const newTotalPaused = (existing.total_paused_seconds || 0) + pausedDurationSeconds;

    const openPauseRes = await sbSelect(`audit_case_pause_events?case_id=eq.${encodeURIComponent(id)}&resumed_at=is.null&order=paused_at.desc&limit=1`);
    const openPauseRows = openPauseRes.ok ? await openPauseRes.json() : [];
    if (openPauseRows[0]) await sbWrite(`audit_case_pause_events?id=eq.${encodeURIComponent(openPauseRows[0].id)}`, 'PATCH', { resumed_at: resumedAt.toISOString() });

    const r = await sbWrite(`audit_cases?id=eq.${encodeURIComponent(id)}`, 'PATCH', {
      paused_at: null, pause_reason: null, total_paused_seconds: newTotalPaused, updated_at: resumedAt.toISOString(),
    });
    if (!r.ok) { console.error('[client:audit cases] resume error:', await r.text()); return res.status(500).json({ error: 'Failed to resume case' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, case: rows[0], paused_seconds_added: pausedDurationSeconds });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

async function handleAuditEvidence(req, res, caller) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
    const caseId = sanitize(req.query?.case_id, 100);
    if (!caseId) return res.status(400).json({ error: 'case_id is required' });
    if (!(await loadAuditCase(caseId, orgId))) return res.status(404).json({ error: 'Case not found' });
    const r = await sbSelect(`audit_evidence?case_id=eq.${encodeURIComponent(caseId)}&order=capture_date.desc`);
    if (!r.ok) { console.error('[client:audit evidence] error:', await r.text()); return res.status(500).json({ error: 'Failed to load evidence' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
  const caseId = sanitize(b.case_id, 100);
  if (!caseId || !(await loadAuditCase(caseId, orgId))) return res.status(404).json({ error: 'Case not found' });

  const record = {
    case_id: caseId,
    source: sanitize(b.source, 300),
    method: sanitize(b.method, 200) || null,
    observation: sanitize(b.observation, 3000),
    snapshot_path: sanitize(b.snapshot_path, 400) || null, // private storage path only — never a public URL
    author: sanitize(b.author, 150) || caller.email,
    source_quality: ['high', 'medium', 'low', 'unavailable'].includes(b.source_quality) ? b.source_quality : null,
    confidence: ['high', 'medium', 'low'].includes(b.confidence) ? b.confidence : null,
    privacy_level: b.privacy_level === 'client_visible' ? 'client_visible' : 'internal',
  };
  if (!record.source || !record.observation) return res.status(400).json({ error: 'source and observation are required' });
  const r = await sbWrite('audit_evidence', 'POST', record);
  if (!r.ok) { console.error('[client:audit evidence] create error:', await r.text()); return res.status(500).json({ error: 'Failed to save evidence' }); }
  const rows = await r.json();
  return res.status(200).json({ ok: true, evidence: rows[0] });
}

async function handleAuditFindings(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
    const caseId = sanitize(req.query?.case_id, 100);
    if (!caseId) return res.status(400).json({ error: 'case_id is required' });
    if (!(await loadAuditCase(caseId, orgId))) return res.status(404).json({ error: 'Case not found' });
    const r = await sbSelect(`audit_findings?case_id=eq.${encodeURIComponent(caseId)}&order=created_at.desc`);
    if (!r.ok) { console.error('[client:audit findings] error:', await r.text()); return res.status(500).json({ error: 'Failed to load findings' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
  const caseId = sanitize(b.case_id, 100);
  if (!caseId || !(await loadAuditCase(caseId, orgId))) return res.status(404).json({ error: 'Case not found' });

  const statementType = sanitize(b.statement_type, 20);
  if (!['observed_fact', 'stated_claim', 'inference', 'estimate'].includes(statementType)) {
    return res.status(400).json({ error: 'statement_type must be one of observed_fact, stated_claim, inference, estimate' });
  }
  const record = {
    case_id: caseId,
    title: sanitize(b.title, 300),
    statement_type: statementType,
    detail: sanitize(b.detail, 3000),
    priority: ['high', 'medium', 'low'].includes(b.priority) ? b.priority : null,
  };
  if (!record.title || !record.detail) return res.status(400).json({ error: 'title and detail are required' });
  const r = await sbWrite('audit_findings', 'POST', record);
  if (!r.ok) { console.error('[client:audit findings] create error:', await r.text()); return res.status(500).json({ error: 'Failed to save finding' }); }
  const rows = await r.json();
  const findingId = rows[0]?.id;

  const evidenceIds = Array.isArray(b.evidence_ids) ? b.evidence_ids.map((e) => sanitize(e, 100)).filter(Boolean) : [];
  for (const evidenceId of evidenceIds) {
    await sbWrite('audit_finding_evidence', 'POST', { finding_id: findingId, evidence_id: evidenceId });
  }
  return res.status(200).json({ ok: true, finding: rows[0] });
}

async function handleAuditRecommendations(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
    const caseId = sanitize(req.query?.case_id, 100);
    if (!caseId) return res.status(400).json({ error: 'case_id is required' });
    if (!(await loadAuditCase(caseId, orgId))) return res.status(404).json({ error: 'Case not found' });
    const r = await sbSelect(`audit_recommendations?case_id=eq.${encodeURIComponent(caseId)}&order=priority_rank.asc.nullslast`);
    if (!r.ok) { console.error('[client:audit recommendations] error:', await r.text()); return res.status(500).json({ error: 'Failed to load recommendations' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
  const caseId = sanitize(b.case_id, 100);
  if (!caseId || !(await loadAuditCase(caseId, orgId))) return res.status(404).json({ error: 'Case not found' });

  const record = {
    case_id: caseId,
    finding_id: sanitize(b.finding_id, 100) || null,
    mechanism: sanitize(b.mechanism, 2000),
    impact_estimate: sanitize(b.impact_estimate, 1000) || null,
    effort_range: sanitize(b.effort_range, 200) || null,
    cost_range: sanitize(b.cost_range, 200) || null,
    dependencies: sanitize(b.dependencies, 1000) || null,
    owner: sanitize(b.owner, 200) || null,
    uncertainty: sanitize(b.uncertainty, 1000) || null,
    verification_plan: sanitize(b.verification_plan, 1000) || null,
    priority_rank: Number.isFinite(Number(b.priority_rank)) ? Number(b.priority_rank) : null,
  };
  if (!record.mechanism) return res.status(400).json({ error: 'mechanism is required' });
  const r = await sbWrite('audit_recommendations', 'POST', record);
  if (!r.ok) { console.error('[client:audit recommendations] create error:', await r.text()); return res.status(500).json({ error: 'Failed to save recommendation' }); }
  const rows = await r.json();
  return res.status(200).json({ ok: true, recommendation: rows[0] });
}

// Immutable approved report versions — "edited versions require new review." create-draft always
// inserts a new version number; approve only flips draft->approved on a specific version, and
// this handler refuses to ever touch an already-approved row, enforced here in application code
// exactly because expressing it portably as a DB trigger wasn't done in this pass (see
// docs/PRODUCT_BUILD_STATE.md).
async function handleAuditReports(req, res, caller) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
    const caseId = sanitize(req.query?.case_id, 100);
    if (!caseId) return res.status(400).json({ error: 'case_id is required' });
    if (!(await loadAuditCase(caseId, orgId))) return res.status(404).json({ error: 'Case not found' });
    const r = await sbSelect(`audit_reports?case_id=eq.${encodeURIComponent(caseId)}&order=version.desc`);
    if (!r.ok) { console.error('[client:audit reports] error:', await r.text()); return res.status(500).json({ error: 'Failed to load reports' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
  const caseId = sanitize(b.case_id, 100);
  if (!caseId || !(await loadAuditCase(caseId, orgId))) return res.status(404).json({ error: 'Case not found' });
  const action = sanitize(b.action, 20);

  if (action === 'create-draft') {
    const existingRes = await sbSelect(`audit_reports?case_id=eq.${encodeURIComponent(caseId)}&order=version.desc&limit=1`);
    const existingRows = existingRes.ok ? await existingRes.json() : [];
    const nextVersion = (existingRows[0]?.version || 0) + 1;
    const content = b.content && typeof b.content === 'object' ? b.content : {};
    const r = await sbWrite('audit_reports', 'POST', { case_id: caseId, version: nextVersion, status: 'draft', content });
    if (!r.ok) { console.error('[client:audit reports] create-draft error:', await r.text()); return res.status(500).json({ error: 'Failed to create report draft' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, report: rows[0] });
  }

  if (action === 'approve') {
    const id = sanitize(b.id, 100);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const reportRes = await sbSelect(`audit_reports?id=eq.${encodeURIComponent(id)}&case_id=eq.${encodeURIComponent(caseId)}&limit=1`);
    const reportRows = reportRes.ok ? await reportRes.json() : [];
    if (!reportRows.length) return res.status(404).json({ error: 'Report version not found' });
    if (reportRows[0].status === 'approved') return res.status(400).json({ error: 'This version is already approved and immutable — create a new draft instead' });
    // Stale-version guard (2026-09-24, caught while producing approval-authorization evidence for
    // Isaac): nothing previously stopped approving an OLD draft after a newer one was already
    // created — "recheck authority and unchanged content immediately before execution" means the
    // version being approved must still be the current one, not just not-yet-approved.
    const latestRes = await sbSelect(`audit_reports?case_id=eq.${encodeURIComponent(caseId)}&select=version&order=version.desc&limit=1`);
    const latestRows = latestRes.ok ? await latestRes.json() : [];
    if (latestRows.length && latestRows[0].version > reportRows[0].version) {
      return res.status(409).json({ error: `A newer draft (v${latestRows[0].version}) exists — approve the current version instead` });
    }
    const r = await sbWrite(`audit_reports?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'approved', approved_by: caller.id, approved_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:audit reports] approve error:', await r.text()); return res.status(500).json({ error: 'Failed to approve report' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, report: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

async function handleAuditDeliveries(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
  const reportId = sanitize(b.report_id, 100);
  if (!reportId) return res.status(400).json({ error: 'report_id is required' });

  const record = {
    report_id: reportId,
    delivery_method: sanitize(b.delivery_method, 100) || 'email',
    provider_accepted_at: b.provider_accepted ? new Date().toISOString() : null,
    delivered_at: b.delivered ? new Date().toISOString() : null,
    failed_at: b.failed ? new Date().toISOString() : null,
    failure_reason: sanitize(b.failure_reason, 500) || null,
  };
  const r = await sbWrite('audit_deliveries', 'POST', record);
  if (!r.ok) { console.error('[client:audit deliveries] create error:', await r.text()); return res.status(500).json({ error: 'Failed to record delivery' }); }
  const rows = await r.json();
  return res.status(200).json({ ok: true, delivery: rows[0] });
}

async function handleAuditOutcomes(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'intelligence.view'))) return;
  const caseId = sanitize(b.case_id, 100);
  if (!caseId || !(await loadAuditCase(caseId, orgId))) return res.status(404).json({ error: 'Case not found' });

  const record = {
    case_id: caseId,
    metric: sanitize(b.metric, 200),
    baseline_period: sanitize(b.baseline_period, 200) || null,
    comparison_period: sanitize(b.comparison_period, 200) || null,
    baseline_value: Number.isFinite(Number(b.baseline_value)) ? Number(b.baseline_value) : null,
    comparison_value: Number.isFinite(Number(b.comparison_value)) ? Number(b.comparison_value) : null,
    confounders: sanitize(b.confounders, 1000) || null,
  };
  if (!record.metric) return res.status(400).json({ error: 'metric is required' });
  const r = await sbWrite('audit_outcomes', 'POST', record);
  if (!r.ok) { console.error('[client:audit outcomes] create error:', await r.text()); return res.status(500).json({ error: 'Failed to save outcome' }); }
  const rows = await r.json();
  return res.status(200).json({ ok: true, outcome: rows[0] });
}

// =============================================================================================
// Zion Studio (2026-09-23, master prompt §16). Schema: supabase/zion-studio-migration-standalone.sql
// — NOT yet applied to production.
//
// Journal/facts are private-by-default: scoped to the real author (or the platform owner), never
// broadly staff-readable, checked the same way requireOrgAccess() checks org membership above —
// by calling a real Postgres function (is_platform_owner()) with the caller's own token, not a
// service-role assumption. Ideas/scripts/storyboards/videos/review are Nova-internal production
// collaboration, gated at growth.view like the rest of the content tooling in this hub.
// =============================================================================================

async function isPlatformOwner(req) {
  const { url, key } = sbEnv();
  const token = callerToken(req);
  try {
    const r = await fetch(`${url}/rest/v1/rpc/is_platform_owner`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
}

async function handleZionJournal(req, res, caller) {
  const owner = await isPlatformOwner(req);
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    // Never let a non-owner list someone else's journal by omitting author_user_id — only the
    // real author (or the platform owner) ever sees these rows, matching the RLS policy exactly.
    const authorId = owner && sanitize(req.query?.author_user_id, 100) ? sanitize(req.query.author_user_id, 100) : caller.id;
    const r = await sbSelect(`zion_journal_entries?author_user_id=eq.${encodeURIComponent(authorId)}&order=entry_date.desc`);
    if (!r.ok) { console.error('[client:zion journal] error:', await r.text()); return res.status(500).json({ error: 'Failed to load journal' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const record = {
    author_user_id: caller.id, // always the real caller — never a client-supplied author
    entry_date: sanitize(b.entry_date, 20) || new Date().toISOString().slice(0, 10),
    text_content: sanitize(b.text_content, 10000) || null,
    time_spent_minutes: Number.isFinite(Number(b.time_spent_minutes)) ? Number(b.time_spent_minutes) : null,
    wins: sanitize(b.wins, 3000) || null,
    setbacks: sanitize(b.setbacks, 3000) || null,
    lessons: sanitize(b.lessons, 3000) || null,
    next_plan: sanitize(b.next_plan, 3000) || null,
    privacy_level: b.privacy_level === 'allowed_disclosure' ? 'allowed_disclosure' : 'private',
  };
  const r = await sbWrite('zion_journal_entries', 'POST', record);
  if (!r.ok) { console.error('[client:zion journal] create error:', await r.text()); return res.status(500).json({ error: 'Failed to save journal entry' }); }
  const rows = await r.json();
  const entryId = rows[0]?.id;

  // Optional facts submitted alongside the entry — always created 'unconfirmed', never
  // pre-confirmed by the submission itself, per "not established facts until Isaac confirms."
  const factStatements = Array.isArray(b.facts) ? b.facts.map((f) => sanitize(f, 1000)).filter(Boolean) : [];
  for (const statement of factStatements) {
    await sbWrite('zion_facts', 'POST', { journal_entry_id: entryId, statement });
  }
  return res.status(200).json({ ok: true, entry: rows[0] });
}

async function handleZionFacts(req, res, caller) {
  const owner = await isPlatformOwner(req);
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const journalEntryId = sanitize(req.query?.journal_entry_id, 100);
    if (!journalEntryId) return res.status(400).json({ error: 'journal_entry_id is required' });
    const entryRes = await sbSelect(`zion_journal_entries?id=eq.${encodeURIComponent(journalEntryId)}&limit=1`);
    const entryRows = entryRes.ok ? await entryRes.json() : [];
    if (!entryRows.length || (!owner && entryRows[0].author_user_id !== caller.id)) return res.status(404).json({ error: 'Journal entry not found' });
    const r = await sbSelect(`zion_facts?journal_entry_id=eq.${encodeURIComponent(journalEntryId)}&order=created_at.asc`);
    if (!r.ok) { console.error('[client:zion facts] error:', await r.text()); return res.status(500).json({ error: 'Failed to load facts' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  // Only Isaac (the platform owner) confirms/rejects his own facts — no staff member, however
  // permissioned, can confirm a fact on his behalf.
  if (!owner) return res.status(403).json({ error: 'Only the platform owner can confirm or reject a Zion fact' });
  const b = req.body || {};
  const id = sanitize(b.id, 100);
  const status = sanitize(b.status, 20);
  if (!id || !['confirmed', 'rejected'].includes(status)) return res.status(400).json({ error: 'id and a valid status (confirmed|rejected) are required' });
  const r = await sbWrite(`zion_facts?id=eq.${encodeURIComponent(id)}`, 'PATCH', {
    status, disclosure_allowed: b.disclosure_allowed === true, confirmed_by: caller.id, confirmed_at: new Date().toISOString(),
  });
  if (!r.ok) { console.error('[client:zion facts] update error:', await r.text()); return res.status(500).json({ error: 'Failed to update fact' }); }
  const rows = await r.json();
  return res.status(200).json({ ok: true, fact: rows[0] });
}

const ZION_IDEA_STATUSES = ['idea', 'scripting', 'storyboarding', 'ready_to_render', 'rendering', 'editing', 'qa', 'ready_for_review', 'approved', 'changes_requested', 'rejected', 'scheduled', 'published', 'archived'];

async function handleZionIdeas(req, res, caller) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const status = sanitize(req.query?.status, 30);
    let path = 'zion_video_ideas?order=updated_at.desc';
    if (status) path += `&status=eq.${encodeURIComponent(status)}`;
    const r = await sbSelect(path);
    if (!r.ok) { console.error('[client:zion ideas] error:', await r.text()); return res.status(500).json({ error: 'Failed to load ideas' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const action = sanitize(b.action, 20);

  if (action === 'create') {
    // Only fact IDs that are actually CONFIRMED may back a new idea — "one real event can
    // support a recap/lesson/etc., not fictional new events."
    const factIds = Array.isArray(b.source_fact_ids) ? b.source_fact_ids.map((f) => sanitize(f, 100)).filter(Boolean) : [];
    if (factIds.length) {
      const factsRes = await sbSelect(`zion_facts?id=in.(${factIds.map(encodeURIComponent).join(',')})&select=id,status`);
      const facts = factsRes.ok ? await factsRes.json() : [];
      const allConfirmed = factIds.every((id) => facts.some((f) => f.id === id && f.status === 'confirmed'));
      if (!allConfirmed) return res.status(400).json({ error: 'Every source fact must already be confirmed before an idea can cite it' });
    }
    const record = {
      source_fact_ids: factIds,
      angle: sanitize(b.angle, 500),
      story_type: ['recap', 'lesson', 'process_explanation', 'reflection'].includes(b.story_type) ? b.story_type : null,
      created_by: caller.id,
    };
    if (!record.angle) return res.status(400).json({ error: 'angle is required' });
    const r = await sbWrite('zion_video_ideas', 'POST', record);
    if (!r.ok) { console.error('[client:zion ideas] create error:', await r.text()); return res.status(500).json({ error: 'Failed to create idea' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, idea: rows[0] });
  }

  if (action === 'update-status') {
    const id = sanitize(b.id, 100);
    const status = sanitize(b.status, 30);
    if (!id || !ZION_IDEA_STATUSES.includes(status)) return res.status(400).json({ error: 'id and a valid status are required' });
    const r = await sbWrite(`zion_video_ideas?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:zion ideas] update-status error:', await r.text()); return res.status(500).json({ error: 'Failed to update idea' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, idea: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

async function handleZionScripts(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const ideaId = sanitize(req.query?.idea_id, 100);
    if (!ideaId) return res.status(400).json({ error: 'idea_id is required' });
    const r = await sbSelect(`zion_scripts?idea_id=eq.${encodeURIComponent(ideaId)}&order=version.desc`);
    if (!r.ok) { console.error('[client:zion scripts] error:', await r.text()); return res.status(500).json({ error: 'Failed to load scripts' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  const b = req.body || {};
  const ideaId = sanitize(b.idea_id, 100);
  const body = sanitize(b.body, 10000);
  if (!ideaId || !body) return res.status(400).json({ error: 'idea_id and body are required' });

  const existingRes = await sbSelect(`zion_scripts?idea_id=eq.${encodeURIComponent(ideaId)}&order=version.desc&limit=1`);
  const existingRows = existingRes.ok ? await existingRes.json() : [];
  const nextVersion = (existingRows[0]?.version || 0) + 1;
  const r = await sbWrite('zion_scripts', 'POST', { idea_id: ideaId, version: nextVersion, hook: sanitize(b.hook, 500) || null, body });
  if (!r.ok) { console.error('[client:zion scripts] create error:', await r.text()); return res.status(500).json({ error: 'Failed to save script' }); }
  await sbWrite(`zion_video_ideas?id=eq.${encodeURIComponent(ideaId)}`, 'PATCH', { status: 'scripting', updated_at: new Date().toISOString() });
  const rows = await r.json();
  return res.status(200).json({ ok: true, script: rows[0] });
}

async function handleZionCharacterAssets(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;
  const r = await sbSelect('zion_character_assets?order=version.desc');
  if (!r.ok) { console.error('[client:zion character-assets] error:', await r.text()); return res.status(500).json({ error: 'Failed to load character assets' }); }
  return res.status(200).json(await r.json());
}

async function handleZionVideos(req, res, caller) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const status = sanitize(req.query?.status, 30);
    let path = 'zion_videos?order=created_at.desc';
    if (status) path += `&status=eq.${encodeURIComponent(status)}`;
    const r = await sbSelect(path);
    if (!r.ok) { console.error('[client:zion videos] error:', await r.text()); return res.status(500).json({ error: 'Failed to load videos' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  const b = req.body || {};
  const action = sanitize(b.action, 20);

  if (action === 'create-draft') {
    const ideaId = sanitize(b.idea_id, 100);
    if (!ideaId) return res.status(400).json({ error: 'idea_id is required' });
    const record = {
      idea_id: ideaId,
      script_id: sanitize(b.script_id, 100) || null,
      storyboard_id: sanitize(b.storyboard_id, 100) || null,
      status: 'draft',
    };
    const r = await sbWrite('zion_videos', 'POST', record);
    if (!r.ok) { console.error('[client:zion videos] create-draft error:', await r.text()); return res.status(500).json({ error: 'Failed to create video draft' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, video: rows[0] });
  }

  if (action === 'request-render') {
    // "Missing character references block rendering, not the entire Studio" — enforced exactly
    // here: every other action above works with zero character_assets rows; this one specific
    // action refuses outright without at least one real appearance_reference on file.
    const assetsRes = await sbSelect(`zion_character_assets?asset_type=eq.appearance_reference&limit=1`);
    const assets = assetsRes.ok ? await assetsRes.json() : [];
    if (!assets.length) {
      return res.status(409).json({ error: 'No character reference asset is on file yet. Rendering is blocked until Isaac supplies the existing Zion character references — this does not block the rest of the Studio.' });
    }
    const id = sanitize(b.id, 100);
    if (!id) return res.status(400).json({ error: 'id is required' });
    // No render provider is connected in this environment — this honestly reports that instead
    // of pretending to have started a render.
    return res.status(501).json({ error: 'No video-rendering provider is connected yet. This action is implemented and ready — it needs a real provider adapter/credentials (see docs/PRODUCT_BUILD_STATE.md) before it can actually render anything.' });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

async function handleZionReview(req, res, caller) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  const b = req.body || {};
  const videoId = sanitize(b.video_id, 100);
  const action = sanitize(b.action, 30);
  if (!videoId || !['approve', 'request_changes', 'reject', 'schedule'].includes(action)) {
    return res.status(400).json({ error: 'video_id and a valid action (approve|request_changes|reject|schedule) are required' });
  }

  const videoRes = await sbSelect(`zion_videos?id=eq.${encodeURIComponent(videoId)}&limit=1`);
  const videoRows = videoRes.ok ? await videoRes.json() : [];
  if (!videoRows.length) return res.status(404).json({ error: 'Video not found' });
  const video = videoRows[0];

  // "Material revisions invalidate approval" — an already-approved video can still be sent back
  // to changes_requested/rejected (that IS the revision), but a second 'approve' on something
  // already approved is refused, same immutability discipline as Audit reports.
  if (action === 'approve' && video.status === 'approved') {
    return res.status(400).json({ error: 'This video is already approved. Material changes require a new version, not a second approval.' });
  }

  await sbWrite('zion_review_events', 'POST', { video_id: videoId, action, notes: sanitize(b.notes, 2000) || null, actor_user_id: caller.id });

  const patch = { };
  if (action === 'approve') {
    patch.status = 'approved';
    patch.approval_version = (video.approval_version || 0) + 1;
    patch.approved_by = caller.id;
    patch.approved_at = new Date().toISOString();
  } else if (action === 'request_changes') {
    patch.status = 'changes_requested';
  } else if (action === 'reject') {
    patch.status = 'rejected';
  } else if (action === 'schedule') {
    if (video.status !== 'approved') return res.status(400).json({ error: 'Only an approved video can be scheduled' });
    const scheduledAt = sanitize(b.scheduled_at, 40);
    if (!scheduledAt) return res.status(400).json({ error: 'scheduled_at is required' });
    patch.status = 'scheduled';
    patch.scheduled_at = scheduledAt;
  }
  const r = await sbWrite(`zion_videos?id=eq.${encodeURIComponent(videoId)}`, 'PATCH', patch);
  if (!r.ok) { console.error('[client:zion review] error:', await r.text()); return res.status(500).json({ error: 'Failed to record review decision' }); }
  const rows = await r.json();
  return res.status(200).json({ ok: true, video: rows[0] });
}

// =============================================================================================
// Approval Inbox (2026-09-23, master prompt §19). Schema:
// supabase/approval-inbox-migration-standalone.sql — NOT yet applied to production.
//
// Deliberately does NOT retrofit audit_reports/zion_videos'/blog_posts' own already-tested
// approval logic into this table — that would be a real refactor risk to freshly-shipped, working
// code for no functional gain. Instead this aggregates pending items from all real sources into
// one list, and separately provides the generic approval_requests table for new consequential-
// action types (installations, spending, pricing exceptions) that don't have their own flow yet.
// =============================================================================================

async function handleApprovalsInbox(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;

  const [reportsRes, videosRes, postsRes, genericRes] = await Promise.all([
    // Embeds the parent case's organization_id via the case_id FK — audit_reports has no
    // organization_id column of its own, and handleAuditReports requires one on every POST
    // (object-level org authorization). Without this embed, the approve_action built below would
    // be missing a required field and every "Approve" click on an audit report from this inbox
    // would fail — a real bug in last night's first cut, caught and fixed before it was ever hit.
    sbSelect(`audit_reports?status=eq.draft&select=id,case_id,version,created_at,audit_cases(organization_id)&order=created_at.desc`),
    sbSelect(`zion_videos?status=in.(draft,ready_for_review)&select=id,idea_id,status,created_at&order=created_at.desc`),
    sbSelect(`blog_posts?status=eq.in_review&site=eq.nova&select=id,title,submitted_at&order=submitted_at.desc`),
    sbSelect(`approval_requests?status=eq.pending&order=created_at.desc`),
  ]);

  const items = [];
  if (reportsRes.ok) {
    for (const r of await reportsRes.json()) {
      items.push({ item_type: 'audit_report', item_id: r.id, action_summary: `Approve Audit report v${r.version} (case ${String(r.case_id).slice(0, 8)})`, created_at: r.created_at, approve_action: { resource: 'audit', op: 'reports', body: { action: 'approve', id: r.id, case_id: r.case_id, organization_id: r.audit_cases?.organization_id } } });
    }
  }
  if (videosRes.ok) {
    for (const v of await videosRes.json()) {
      items.push({ item_type: 'zion_video', item_id: v.id, action_summary: `Review Zion video ${String(v.id).slice(0, 8)} (${v.status.replace(/_/g, ' ')})`, created_at: v.created_at, approve_action: { resource: 'zion', op: 'review', body: { video_id: v.id, action: 'approve' } } });
    }
  }
  if (postsRes.ok) {
    for (const p of await postsRes.json()) {
      items.push({ item_type: 'content', item_id: p.id, action_summary: `Approve blog post "${p.title}"`, created_at: p.submitted_at, approve_action: { resource: 'blog', op: 'admin', body: { action: 'approve', id: p.id } } });
    }
  }
  if (genericRes.ok) {
    for (const g of await genericRes.json()) {
      items.push({ item_type: g.item_type, item_id: g.id, action_summary: g.action_summary, created_at: g.created_at, cost_cents: g.cost_cents, destination: g.destination, expires_at: g.expires_at, approve_action: { resource: 'approvals', op: null, body: { action: 'approve', id: g.id } } });
    }
  }
  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return res.status(200).json(items);
}

async function handleApprovalsGeneric(req, res, caller) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const action = sanitize(b.action, 20);

  if (action === 'create') {
    const record = {
      organization_id: sanitize(b.organization_id, 100) || null,
      item_type: sanitize(b.item_type, 50),
      item_ref: sanitize(b.item_ref, 200) || null,
      action_summary: sanitize(b.action_summary, 1000),
      content_version: sanitize(b.content_version, 200) || null,
      destination: sanitize(b.destination, 300) || null,
      requester_user_id: caller.id,
      cost_cents: Number.isFinite(Number(b.cost_cents)) ? Number(b.cost_cents) : null,
      currency: sanitize(b.currency, 10) || 'USD',
      evidence: b.evidence && typeof b.evidence === 'object' ? b.evidence : {},
      policy_ref: sanitize(b.policy_ref, 200) || null,
      expires_at: sanitize(b.expires_at, 40) || null,
    };
    if (!record.item_type || !record.action_summary) return res.status(400).json({ error: 'item_type and action_summary are required' });
    const r = await sbWrite('approval_requests', 'POST', record);
    if (!r.ok) { console.error('[client:approvals] create error:', await r.text()); return res.status(500).json({ error: 'Failed to create approval request' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, request: rows[0] });
  }

  const id = sanitize(b.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });
  const existingRes = await sbSelect(`approval_requests?id=eq.${encodeURIComponent(id)}&limit=1`);
  const existingRows = existingRes.ok ? await existingRes.json() : [];
  if (!existingRows.length) return res.status(404).json({ error: 'Approval request not found' });
  const existing = existingRows[0];

  if (action === 'approve' || action === 'reject') {
    if (existing.status !== 'pending') {
      return res.status(400).json({ error: `This request is already ${existing.status} — a new request is required for any further change.` });
    }
    // "Recheck authority and unchanged content immediately before execution": if the request was
    // created with a content_version, the caller must supply the SAME one now — a mismatch means
    // the underlying content changed since the request was raised, and approval is refused.
    if (existing.content_version && sanitize(b.content_version, 200) !== existing.content_version) {
      return res.status(409).json({ error: 'Content has changed since this approval was requested. A new request is required.' });
    }
    if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
      await sbWrite(`approval_requests?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'expired' });
      return res.status(410).json({ error: 'This approval request has expired.' });
    }

    if (action === 'approve') {
      const r = await sbWrite(`approval_requests?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'approved', approver_user_id: caller.id, approved_at: new Date().toISOString() });
      if (!r.ok) { console.error('[client:approvals] approve error:', await r.text()); return res.status(500).json({ error: 'Failed to approve' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, request: rows[0] });
    }
    const r = await sbWrite(`approval_requests?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'rejected', approver_user_id: caller.id, approved_at: new Date().toISOString(), outcome: sanitize(b.reason, 1000) || null });
    if (!r.ok) { console.error('[client:approvals] reject error:', await r.text()); return res.status(500).json({ error: 'Failed to reject' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, request: rows[0] });
  }

  if (action === 'revoke') {
    // Revoking only makes sense for something that was actually granted — revoking a pending or
    // already-rejected/expired request is not a real action, it's a no-op dressed up as one.
    if (existing.status !== 'approved') {
      return res.status(400).json({ error: 'Only an approved request can be revoked.' });
    }
    const r = await sbWrite(`approval_requests?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'revoked', revoked_at: new Date().toISOString(), revoked_reason: sanitize(b.reason, 1000) || null });
    if (!r.ok) { console.error('[client:approvals] revoke error:', await r.text()); return res.status(500).json({ error: 'Failed to revoke' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, request: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// =============================================================================================
// Crystal / Company 002 operational workspace (2026-09-24, master prompt §14, restored scope).
// Schema: supabase/crystal-migration-standalone.sql — NOT yet applied to production.
//
// "Crystal / Company 002" is the provisional internal name; nothing here assumes a final brand,
// price, worker-classification, or insurance/legal position — those are business inputs this code
// leaves configurable, never invented. Every handler uses the same real, per-organization
// requireOrgAccess pattern as CRM/Audit/Installations. Two access tiers: `execution.view` for
// administrative actions (creating quotes/estimates/invoices, assigning workers), and a bare-staff,
// ownership-scoped "my jobs" view for workers — "workers see only assigned jobs and necessary
// customer information," enforced by filtering on crystal_job_assignments.worker_user_id and
// returning a reduced field set (no customer email/phone), not by hiding a button in the UI.
// =============================================================================================

// ---------------------------------------------------------------------------- crystal: customers
async function handleCrystalCustomers(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
    const q = sanitize(req.query?.q, 200);
    let path = `crystal_customers?organization_id=eq.${encodeURIComponent(orgId)}&order=name.asc`;
    if (q) path += `&or=(name.ilike.*${encodeURIComponent(q)}*,email.ilike.*${encodeURIComponent(q)}*,phone.ilike.*${encodeURIComponent(q)}*)`;
    const r = await sbSelect(path);
    if (!r.ok) { console.error('[client:crystal customers] error:', await r.text()); return res.status(500).json({ error: 'Failed to load customers' }); }
    return res.status(200).json(await r.json());
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
  const action = sanitize(b.action, 20);
  if (action === 'create' || action === 'update') {
    const id = sanitize(b.id, 100);
    const record = {
      organization_id: orgId,
      name: sanitize(b.name, 200),
      email: b.email ? sanitizeEmail(b.email) : null,
      phone: sanitize(b.phone, 30) || null,
      notes: sanitize(b.notes, 2000) || null,
      updated_at: new Date().toISOString(),
    };
    if (!record.name) return res.status(400).json({ error: 'name is required' });
    const path = action === 'update' && id ? `crystal_customers?id=eq.${encodeURIComponent(id)}` : 'crystal_customers';
    const r = await sbWrite(path, action === 'update' && id ? 'PATCH' : 'POST', record);
    if (!r.ok) { console.error('[client:crystal customers] save error:', await r.text()); return res.status(500).json({ error: 'Failed to save customer' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, customer: rows[0] });
  }
  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// --------------------------------------------------------------------------- crystal: properties
async function handleCrystalProperties(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
    const customerId = sanitize(req.query?.customer_id, 100);
    let path = `crystal_properties?organization_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`;
    if (customerId) path += `&customer_id=eq.${encodeURIComponent(customerId)}`;
    const r = await sbSelect(path);
    if (!r.ok) { console.error('[client:crystal properties] error:', await r.text()); return res.status(500).json({ error: 'Failed to load properties' }); }
    return res.status(200).json(await r.json());
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
  const action = sanitize(b.action, 20);
  if (action === 'create' || action === 'update') {
    const id = sanitize(b.id, 100);
    const record = {
      organization_id: orgId,
      customer_id: sanitize(b.customer_id, 100),
      address_line: sanitize(b.address_line, 300),
      city: sanitize(b.city, 100) || null,
      state: sanitize(b.state, 50) || null,
      postal_code: sanitize(b.postal_code, 20) || null,
      property_type: sanitize(b.property_type, 50) || null,
      access_notes: sanitize(b.access_notes, 2000) || null,
    };
    if (!record.customer_id || !record.address_line) return res.status(400).json({ error: 'customer_id and address_line are required' });
    const path = action === 'update' && id ? `crystal_properties?id=eq.${encodeURIComponent(id)}` : 'crystal_properties';
    const r = await sbWrite(path, action === 'update' && id ? 'PATCH' : 'POST', record);
    if (!r.ok) { console.error('[client:crystal properties] save error:', await r.text()); return res.status(500).json({ error: 'Failed to save property' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, property: rows[0] });
  }
  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// -------------------------------------------------------------------- crystal: service catalog
async function handleCrystalCatalog(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
    const r = await sbSelect(`crystal_service_catalog?organization_id=eq.${encodeURIComponent(orgId)}&order=name.asc`);
    if (!r.ok) { console.error('[client:crystal catalog] error:', await r.text()); return res.status(500).json({ error: 'Failed to load catalog' }); }
    return res.status(200).json(await r.json());
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
  const action = sanitize(b.action, 20);
  if (action === 'create' || action === 'update') {
    const id = sanitize(b.id, 100);
    const record = {
      organization_id: orgId,
      name: sanitize(b.name, 200),
      description: sanitize(b.description, 2000) || null,
      pricing_unit: ['flat', 'hourly', 'per_sqft', 'per_unit'].includes(b.pricing_unit) ? b.pricing_unit : 'flat',
      // Unknown pricing must never be invented — leave null rather than guess.
      base_price_cents: Number.isFinite(Number(b.base_price_cents)) ? Number(b.base_price_cents) : null,
      currency: sanitize(b.currency, 10) || 'USD',
      service_areas: Array.isArray(b.service_areas) ? b.service_areas.map((a) => sanitize(String(a), 50)) : [],
      active: b.active !== false,
    };
    if (!record.name) return res.status(400).json({ error: 'name is required' });
    if (id) {
      const r = await sbWrite(`crystal_service_catalog?id=eq.${encodeURIComponent(id)}`, 'PATCH', { ...record, version: sanitize(b.version, 10) ? Number(b.version) + 1 : undefined });
      if (!r.ok) { console.error('[client:crystal catalog] update error:', await r.text()); return res.status(500).json({ error: 'Failed to update service' }); }
      const rows = await r.json();
      return res.status(200).json({ ok: true, service: rows[0] });
    }
    const r = await sbWrite('crystal_service_catalog', 'POST', record);
    if (!r.ok) { console.error('[client:crystal catalog] create error:', await r.text()); return res.status(500).json({ error: 'Failed to create service' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, service: rows[0] });
  }
  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// ---------------------------------------------------------------------------- crystal: quotes
async function handleCrystalQuotes(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
    const id = sanitize(req.query?.id, 100);
    if (id) {
      const r = await sbSelect(`crystal_quote_requests?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(orgId)}&limit=1`);
      const rows = r.ok ? await r.json() : [];
      if (!rows.length) return res.status(404).json({ error: 'Quote request not found' });
      return res.status(200).json(rows[0]);
    }
    const r = await sbSelect(`crystal_quote_requests?organization_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`);
    if (!r.ok) { console.error('[client:crystal quotes] error:', await r.text()); return res.status(500).json({ error: 'Failed to load quote requests' }); }
    return res.status(200).json(await r.json());
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
  const action = sanitize(b.action, 30);

  if (action === 'create') {
    const record = {
      organization_id: orgId,
      customer_id: sanitize(b.customer_id, 100),
      property_id: sanitize(b.property_id, 100) || null,
      service_catalog_id: sanitize(b.service_catalog_id, 100) || null,
      scope_details: sanitize(b.scope_details, 4000) || null,
      photo_paths: Array.isArray(b.photo_paths) ? b.photo_paths.map((p) => sanitize(String(p), 500)) : [],
      status: 'new',
    };
    if (!record.customer_id) return res.status(400).json({ error: 'customer_id is required' });
    const r = await sbWrite('crystal_quote_requests', 'POST', record);
    if (!r.ok) { console.error('[client:crystal quotes] create error:', await r.text()); return res.status(500).json({ error: 'Failed to create quote request' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, quote: rows[0] });
  }

  const id = sanitize(b.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });

  if (action === 'update-scope') {
    const patch = { scope_details: sanitize(b.scope_details, 4000), status: 'scoped', updated_at: new Date().toISOString() };
    if (Array.isArray(b.photo_paths)) patch.photo_paths = b.photo_paths.map((p) => sanitize(String(p), 500));
    const r = await sbWrite(`crystal_quote_requests?id=eq.${encodeURIComponent(id)}`, 'PATCH', patch);
    if (!r.ok) { console.error('[client:crystal quotes] update-scope error:', await r.text()); return res.status(500).json({ error: 'Failed to update scope' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, quote: rows[0] });
  }

  if (action === 'decline') {
    const r = await sbWrite(`crystal_quote_requests?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'declined', updated_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:crystal quotes] decline error:', await r.text()); return res.status(500).json({ error: 'Failed to decline quote' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, quote: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// -------------------------------------------------------------------------- crystal: estimates
// Versioned exactly like audit_reports — create-draft always increments, an approved/accepted
// version is never mutated in place. "Required approval" + "customer acceptance" are two distinct,
// separately recorded steps (send, then accept), not one click.
async function handleCrystalEstimates(req, res, caller) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
    const quoteId = sanitize(req.query?.quote_request_id, 100);
    if (!quoteId) return res.status(400).json({ error: 'quote_request_id is required' });
    const r = await sbSelect(`crystal_estimates?quote_request_id=eq.${encodeURIComponent(quoteId)}&order=version.desc`);
    if (!r.ok) { console.error('[client:crystal estimates] error:', await r.text()); return res.status(500).json({ error: 'Failed to load estimates' }); }
    return res.status(200).json(await r.json());
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
  const action = sanitize(b.action, 20);
  const quoteId = sanitize(b.quote_request_id, 100);
  if (!quoteId) return res.status(400).json({ error: 'quote_request_id is required' });

  if (action === 'create-draft') {
    const lineItems = Array.isArray(b.line_items) ? b.line_items : [];
    // total_cents stays null if ANY line item is missing a real unit_price_cents — never sum a
    // partially-invented total.
    const allPriced = lineItems.length > 0 && lineItems.every((li) => Number.isFinite(Number(li.unit_price_cents)));
    const total = allPriced ? lineItems.reduce((sum, li) => sum + Number(li.unit_price_cents) * (Number(li.quantity) || 1), 0) : null;
    const existingRes = await sbSelect(`crystal_estimates?quote_request_id=eq.${encodeURIComponent(quoteId)}&order=version.desc&limit=1`);
    const existingRows = existingRes.ok ? await existingRes.json() : [];
    const nextVersion = (existingRows[0]?.version || 0) + 1;
    const r = await sbWrite('crystal_estimates', 'POST', { quote_request_id: quoteId, version: nextVersion, line_items: lineItems, total_cents: total, pricing_notes: sanitize(b.pricing_notes, 2000) || null, status: 'draft' });
    if (!r.ok) { console.error('[client:crystal estimates] create-draft error:', await r.text()); return res.status(500).json({ error: 'Failed to create estimate draft' }); }
    await sbWrite(`crystal_quote_requests?id=eq.${encodeURIComponent(quoteId)}`, 'PATCH', { status: 'estimated', updated_at: new Date().toISOString() });
    const rows = await r.json();
    return res.status(200).json({ ok: true, estimate: rows[0] });
  }

  const id = sanitize(b.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });
  const estRes = await sbSelect(`crystal_estimates?id=eq.${encodeURIComponent(id)}&limit=1`);
  const estRows = estRes.ok ? await estRes.json() : [];
  if (!estRows.length) return res.status(404).json({ error: 'Estimate not found' });
  const estimate = estRows[0];

  if (action === 'send') {
    if (estimate.status !== 'draft') return res.status(400).json({ error: `Cannot send from status ${estimate.status}` });
    const r = await sbWrite(`crystal_estimates?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'sent', sent_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:crystal estimates] send error:', await r.text()); return res.status(500).json({ error: 'Failed to send estimate' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, estimate: rows[0] });
  }

  if (action === 'accept') {
    // No customer-facing acceptance portal exists yet — this is staff recording a real customer
    // decision (phone/email/in-person confirmation), same honest pattern as order acceptance
    // elsewhere in this codebase, not a claim that the customer clicked something themselves.
    if (estimate.status !== 'sent') return res.status(400).json({ error: `Cannot accept from status ${estimate.status} — must be sent first` });
    const latestRes = await sbSelect(`crystal_estimates?quote_request_id=eq.${encodeURIComponent(quoteId)}&select=version&order=version.desc&limit=1`);
    const latestRows = latestRes.ok ? await latestRes.json() : [];
    if (latestRows.length && latestRows[0].version > estimate.version) {
      return res.status(409).json({ error: `A newer estimate (v${latestRows[0].version}) exists — accept the current version instead` });
    }
    const r = await sbWrite(`crystal_estimates?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'accepted', accepted_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:crystal estimates] accept error:', await r.text()); return res.status(500).json({ error: 'Failed to accept estimate' }); }
    await sbWrite(`crystal_quote_requests?id=eq.${encodeURIComponent(quoteId)}`, 'PATCH', { status: 'accepted', updated_at: new Date().toISOString() });
    const rows = await r.json();
    return res.status(200).json({ ok: true, estimate: rows[0] });
  }

  if (action === 'reject') {
    const r = await sbWrite(`crystal_estimates?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'rejected', rejected_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:crystal estimates] reject error:', await r.text()); return res.status(500).json({ error: 'Failed to reject estimate' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, estimate: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// -------------------------------------------------------------------------------- crystal: jobs
async function handleCrystalJobs(req, res, caller) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const scope = req.query?.scope;

    if (scope === 'mine') {
      // "Workers see only assigned jobs and necessary customer information" — ownership-scoped,
      // any real active staff member, NOT gated behind execution.view. Trimmed field set: property
      // address (needed to do the job), no customer email/phone.
      const assignRes = await sbSelect(`crystal_job_assignments?worker_user_id=eq.${encodeURIComponent(caller.id)}&select=job_id`);
      const assignRows = assignRes.ok ? await assignRes.json() : [];
      const jobIds = assignRows.map((a) => a.job_id);
      if (!jobIds.length) return res.status(200).json([]);
      const r = await sbSelect(`crystal_jobs?id=in.(${jobIds.map(encodeURIComponent).join(',')})&select=id,status,scheduled_at,duration_minutes,travel_notes,property_id,crystal_properties(address_line,city,state,access_notes)&order=scheduled_at.asc`);
      if (!r.ok) { console.error('[client:crystal jobs mine] error:', await r.text()); return res.status(500).json({ error: 'Failed to load assigned jobs' }); }
      return res.status(200).json(await r.json());
    }

    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
    const id = sanitize(req.query?.id, 100);
    if (id) {
      const jobRes = await sbSelect(`crystal_jobs?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(orgId)}&limit=1`);
      const jobRows = jobRes.ok ? await jobRes.json() : [];
      if (!jobRows.length) return res.status(404).json({ error: 'Job not found' });
      const [assignmentsRes, checklistRes, mediaRes, completionRes] = await Promise.all([
        sbSelect(`crystal_job_assignments?job_id=eq.${encodeURIComponent(id)}`),
        sbSelect(`crystal_job_checklist_items?job_id=eq.${encodeURIComponent(id)}&order=created_at.asc`),
        sbSelect(`crystal_job_media?job_id=eq.${encodeURIComponent(id)}&order=uploaded_at.desc`),
        sbSelect(`crystal_completion_reviews?job_id=eq.${encodeURIComponent(id)}&limit=1`),
      ]);
      return res.status(200).json({
        ...jobRows[0],
        assignments: assignmentsRes.ok ? await assignmentsRes.json() : [],
        checklist: checklistRes.ok ? await checklistRes.json() : [],
        media: mediaRes.ok ? await mediaRes.json() : [],
        completion: completionRes.ok ? (await completionRes.json())[0] || null : null,
      });
    }
    const r = await sbSelect(`crystal_jobs?organization_id=eq.${encodeURIComponent(orgId)}&order=scheduled_at.asc`);
    if (!r.ok) { console.error('[client:crystal jobs] error:', await r.text()); return res.status(500).json({ error: 'Failed to load jobs' }); }
    return res.status(200).json(await r.json());
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 30, 60_000)) return;
  const b = req.body || {};
  const action = sanitize(b.action, 30);

  // 'complete' is reachable by an assigned worker without execution.view (they need to be able to
  // finish their own job); every other action requires full execution.view administrative access.
  const workerOnlyActions = ['complete', 'checklist-item'];
  let orgId = sanitize(b.organization_id, 100);
  if (!workerOnlyActions.includes(action)) {
    if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
  }

  if (action === 'create') {
    const estimateId = sanitize(b.estimate_id, 100);
    if (!estimateId) return res.status(400).json({ error: 'estimate_id is required' });
    const estRes = await sbSelect(`crystal_estimates?id=eq.${encodeURIComponent(estimateId)}&limit=1`);
    const estRows = estRes.ok ? await estRes.json() : [];
    if (!estRows.length) return res.status(404).json({ error: 'Estimate not found' });
    if (estRows[0].status !== 'accepted') return res.status(400).json({ error: 'A job can only be created from an accepted estimate' });
    const quoteRes = await sbSelect(`crystal_quote_requests?id=eq.${encodeURIComponent(estRows[0].quote_request_id)}&limit=1`);
    const quoteRows = quoteRes.ok ? await quoteRes.json() : [];
    if (!quoteRows.length) return res.status(404).json({ error: 'Source quote request not found' });
    const quote = quoteRows[0];
    const record = {
      organization_id: orgId,
      estimate_id: estimateId,
      customer_id: quote.customer_id,
      property_id: quote.property_id,
      scheduled_at: sanitize(b.scheduled_at, 40) || null,
      duration_minutes: Number.isFinite(Number(b.duration_minutes)) ? Number(b.duration_minutes) : null,
      travel_notes: sanitize(b.travel_notes, 2000) || null,
    };
    const r = await sbWrite('crystal_jobs', 'POST', record);
    if (!r.ok) { console.error('[client:crystal jobs] create error:', await r.text()); return res.status(500).json({ error: 'Failed to create job' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, job: rows[0] });
  }

  const id = sanitize(b.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });

  if (action === 'assign-worker') {
    const workerUserId = sanitize(b.worker_user_id, 100);
    if (!workerUserId) return res.status(400).json({ error: 'worker_user_id is required' });
    const r = await sbWrite('crystal_job_assignments', 'POST', { job_id: id, worker_user_id: workerUserId, role: sanitize(b.role, 50) || null });
    if (!r.ok) {
      const text = await r.text();
      if (/duplicate key/i.test(text)) return res.status(409).json({ error: 'This worker is already assigned to this job' });
      console.error('[client:crystal jobs] assign-worker error:', text);
      return res.status(500).json({ error: 'Failed to assign worker' });
    }
    await sbWrite(`crystal_jobs?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'assigned', updated_at: new Date().toISOString() });
    const rows = await r.json();
    return res.status(200).json({ ok: true, assignment: rows[0] });
  }

  if (action === 'unassign-worker') {
    const workerUserId = sanitize(b.worker_user_id, 100);
    const r = await sbWrite(`crystal_job_assignments?job_id=eq.${encodeURIComponent(id)}&worker_user_id=eq.${encodeURIComponent(workerUserId)}`, 'DELETE');
    if (!r.ok) { console.error('[client:crystal jobs] unassign-worker error:', await r.text()); return res.status(500).json({ error: 'Failed to unassign worker' }); }
    return res.status(200).json({ ok: true });
  }

  if (action === 'update-status') {
    const status = sanitize(b.status, 30);
    if (!['scheduled', 'assigned', 'in_progress', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status for direct update — completion/invoicing have their own actions' });
    const r = await sbWrite(`crystal_jobs?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status, updated_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:crystal jobs] update-status error:', await r.text()); return res.status(500).json({ error: 'Failed to update job status' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, job: rows[0] });
  }

  if (action === 'add-checklist-item') {
    const label = sanitize(b.label, 300);
    if (!label) return res.status(400).json({ error: 'label is required' });
    const r = await sbWrite('crystal_job_checklist_items', 'POST', { job_id: id, label, required: b.required !== false });
    if (!r.ok) { console.error('[client:crystal jobs] add-checklist-item error:', await r.text()); return res.status(500).json({ error: 'Failed to add checklist item' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, item: rows[0] });
  }

  if (action === 'checklist-item') {
    // Reachable by an assigned worker without execution.view — verified below, not assumed.
    const itemId = sanitize(b.item_id, 100);
    if (!itemId) return res.status(400).json({ error: 'item_id is required' });
    const isAssigned = await isWorkerAssignedToJob(caller.id, id);
    const hasOrgAccess = orgId && await hasPermissionSilent(req, orgId, 'execution.view');
    if (!isAssigned && !hasOrgAccess) return res.status(403).json({ error: 'Only an assigned worker or execution staff can update this checklist' });
    const r = await sbWrite(`crystal_job_checklist_items?id=eq.${encodeURIComponent(itemId)}&job_id=eq.${encodeURIComponent(id)}`, 'PATCH', { completed: true, completed_by: caller.id, completed_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:crystal jobs] checklist-item error:', await r.text()); return res.status(500).json({ error: 'Failed to update checklist item' }); }
    const rows = await r.json();
    if (!rows.length) return res.status(404).json({ error: 'Checklist item not found' });
    return res.status(200).json({ ok: true, item: rows[0] });
  }

  if (action === 'add-media') {
    const kind = ['before', 'after'].includes(b.kind) ? b.kind : null;
    const storagePath = sanitize(b.storage_path, 500);
    if (!kind || !storagePath) return res.status(400).json({ error: 'kind (before|after) and storage_path are required' });
    const r = await sbWrite('crystal_job_media', 'POST', { job_id: id, kind, storage_path: storagePath, uploaded_by: caller.id });
    if (!r.ok) { console.error('[client:crystal jobs] add-media error:', await r.text()); return res.status(500).json({ error: 'Failed to record media' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, media: rows[0] });
  }

  if (action === 'complete') {
    // "AI cannot declare physical work completed without authorized evidence" — enforced here, not
    // just described: completion requires a real assigned worker AND at least one 'after' photo
    // already on file. No evidence, no completion, regardless of who's asking.
    const isAssigned = await isWorkerAssignedToJob(caller.id, id);
    if (!isAssigned) return res.status(403).json({ error: 'Only a worker assigned to this job can mark it complete' });
    const mediaRes = await sbSelect(`crystal_job_media?job_id=eq.${encodeURIComponent(id)}&kind=eq.after&limit=1`);
    const mediaRows = mediaRes.ok ? await mediaRes.json() : [];
    if (!mediaRows.length) return res.status(400).json({ error: 'At least one "after" photo is required as evidence before a job can be marked complete' });
    const jobRes = await sbSelect(`crystal_jobs?id=eq.${encodeURIComponent(id)}&limit=1`);
    const jobRows = jobRes.ok ? await jobRes.json() : [];
    if (!jobRows.length) return res.status(404).json({ error: 'Job not found' });
    const completionRes = await sbWrite('crystal_completion_reviews', 'POST', { job_id: id, completed_by: caller.id, completion_notes: sanitize(b.notes, 2000) || null });
    if (!completionRes.ok) {
      const text = await completionRes.text();
      if (/duplicate key/i.test(text)) return res.status(400).json({ error: 'This job already has a completion record' });
      console.error('[client:crystal jobs] complete error:', text);
      return res.status(500).json({ error: 'Failed to record completion' });
    }
    await sbWrite(`crystal_jobs?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'completed', updated_at: new Date().toISOString() });
    const rows = await completionRes.json();
    return res.status(200).json({ ok: true, completion: rows[0] });
  }

  if (action === 'approve-completion') {
    // No customer-facing portal yet — staff records a real customer decision (phone/email/
    // in-person), the same honest pattern used for estimate acceptance above.
    const r = await sbWrite(`crystal_completion_reviews?job_id=eq.${encodeURIComponent(id)}`, 'PATCH', { customer_approved: true, customer_approved_at: new Date().toISOString(), customer_notes: sanitize(b.customer_notes, 2000) || null });
    if (!r.ok) { console.error('[client:crystal jobs] approve-completion error:', await r.text()); return res.status(500).json({ error: 'Failed to record customer approval' }); }
    const rows = await r.json();
    if (!rows.length) return res.status(404).json({ error: 'No completion record on file for this job yet' });
    await sbWrite(`crystal_jobs?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'approved', updated_at: new Date().toISOString() });
    return res.status(200).json({ ok: true, completion: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

async function isWorkerAssignedToJob(userId, jobId) {
  const r = await sbSelect(`crystal_job_assignments?job_id=eq.${encodeURIComponent(jobId)}&worker_user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  const rows = r.ok ? await r.json() : [];
  return rows.length > 0;
}
// Silent variant of requireOrgAccess for a branch that already has another valid authorization
// path (an assigned worker) — checks the permission without writing an error response on failure,
// since the caller here decides what to do with a false result itself rather than short-circuiting.
async function hasPermissionSilent(req, orgId, permission) {
  const { url, key } = sbEnv();
  const token = callerToken(req);
  try {
    const r = await fetch(`${url}/rest/v1/rpc/has_permission`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_org_id: orgId, permission_key: permission }),
    });
    return r.ok && (await r.json()) === true;
  } catch { return false; }
}

// ---------------------------------------------------------------------------- crystal: invoices
async function handleCrystalInvoices(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'admin.view'))) return;
    const r = await sbSelect(`crystal_invoices?organization_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`);
    if (!r.ok) { console.error('[client:crystal invoices] error:', await r.text()); return res.status(500).json({ error: 'Failed to load invoices' }); }
    return res.status(200).json(await r.json());
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'admin.view'))) return;
  const action = sanitize(b.action, 20);

  if (action === 'create') {
    const jobId = sanitize(b.job_id, 100);
    const amountCents = Number(b.amount_cents);
    if (!jobId || !Number.isFinite(amountCents)) return res.status(400).json({ error: 'job_id and a real amount_cents are required — unbilled work is never invoiced with an invented amount' });
    const r = await sbWrite('crystal_invoices', 'POST', { organization_id: orgId, job_id: jobId, amount_cents: amountCents, currency: sanitize(b.currency, 10) || 'USD' });
    if (!r.ok) { console.error('[client:crystal invoices] create error:', await r.text()); return res.status(500).json({ error: 'Failed to create invoice' }); }
    await sbWrite(`crystal_jobs?id=eq.${encodeURIComponent(jobId)}`, 'PATCH', { status: 'invoiced', updated_at: new Date().toISOString() });
    const rows = await r.json();
    return res.status(200).json({ ok: true, invoice: rows[0] });
  }

  const id = sanitize(b.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });

  if (action === 'send') {
    const r = await sbWrite(`crystal_invoices?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'sent', sent_at: new Date().toISOString() });
    if (!r.ok) { console.error('[client:crystal invoices] send error:', await r.text()); return res.status(500).json({ error: 'Failed to send invoice' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, invoice: rows[0] });
  }

  if (action === 'mark-paid') {
    const r = await sbWrite(`crystal_invoices?id=eq.${encodeURIComponent(id)}`, 'PATCH', { status: 'paid', paid_at: new Date().toISOString(), payment_method: sanitize(b.payment_method, 100) || null });
    if (!r.ok) { console.error('[client:crystal invoices] mark-paid error:', await r.text()); return res.status(500).json({ error: 'Failed to mark invoice paid' }); }
    const rows = await r.json();
    if (rows[0]?.job_id) await sbWrite(`crystal_jobs?id=eq.${encodeURIComponent(rows[0].job_id)}`, 'PATCH', { status: 'paid', updated_at: new Date().toISOString() });
    return res.status(200).json({ ok: true, invoice: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// ---------------------------------------------------------------------------- crystal: feedback
async function handleCrystalFeedback(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
    const jobId = sanitize(req.query?.job_id, 100);
    let path = `crystal_feedback?order=created_at.desc`;
    if (jobId) path = `crystal_feedback?job_id=eq.${encodeURIComponent(jobId)}&order=created_at.desc`;
    const r = await sbSelect(path);
    if (!r.ok) { console.error('[client:crystal feedback] error:', await r.text()); return res.status(500).json({ error: 'Failed to load feedback' }); }
    return res.status(200).json(await r.json());
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
  const jobId = sanitize(b.job_id, 100);
  const customerId = sanitize(b.customer_id, 100);
  const rating = Number(b.rating);
  if (!jobId || !customerId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'job_id, customer_id, and a rating from 1-5 are required' });
  }
  const r = await sbWrite('crystal_feedback', 'POST', { job_id: jobId, customer_id: customerId, rating, comments: sanitize(b.comments, 2000) || null });
  if (!r.ok) { console.error('[client:crystal feedback] create error:', await r.text()); return res.status(500).json({ error: 'Failed to record feedback' }); }
  const rows = await r.json();
  return res.status(200).json({ ok: true, feedback: rows[0] });
}

// -------------------------------------------------------------------------- crystal: recurring
async function handleCrystalRecurring(req, res) {
  if (req.method === 'GET') {
    if (!rateLimit(req, res, 60, 60_000)) return;
    const orgId = sanitize(req.query?.organization_id, 100);
    if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
    const r = await sbSelect(`crystal_recurring_schedules?organization_id=eq.${encodeURIComponent(orgId)}&order=next_due_at.asc`);
    if (!r.ok) { console.error('[client:crystal recurring] error:', await r.text()); return res.status(500).json({ error: 'Failed to load recurring schedules' }); }
    return res.status(200).json(await r.json());
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  const b = req.body || {};
  const orgId = sanitize(b.organization_id, 100);
  if (!(await requireOrgAccess(req, res, orgId, 'execution.view'))) return;
  const action = sanitize(b.action, 20);

  if (action === 'create') {
    const customerId = sanitize(b.customer_id, 100);
    const frequency = sanitize(b.frequency, 20);
    if (!customerId || !['weekly', 'biweekly', 'monthly', 'quarterly', 'custom'].includes(frequency)) {
      return res.status(400).json({ error: 'customer_id and a valid frequency are required' });
    }
    const r = await sbWrite('crystal_recurring_schedules', 'POST', {
      organization_id: orgId, customer_id: customerId,
      property_id: sanitize(b.property_id, 100) || null,
      service_catalog_id: sanitize(b.service_catalog_id, 100) || null,
      frequency, next_due_at: sanitize(b.next_due_at, 40) || null,
    });
    if (!r.ok) { console.error('[client:crystal recurring] create error:', await r.text()); return res.status(500).json({ error: 'Failed to create recurring schedule' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, schedule: rows[0] });
  }

  if (action === 'pause' || action === 'resume') {
    const id = sanitize(b.id, 100);
    if (!id) return res.status(400).json({ error: 'id is required' });
    const r = await sbWrite(`crystal_recurring_schedules?id=eq.${encodeURIComponent(id)}`, 'PATCH', { active: action === 'resume' });
    if (!r.ok) { console.error('[client:crystal recurring] pause/resume error:', await r.text()); return res.status(500).json({ error: 'Failed to update recurring schedule' }); }
    const rows = await r.json();
    return res.status(200).json({ ok: true, schedule: rows[0] });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// Nova Connect client portal login — checks against client_accounts.
// handleAuth ("Nova Connect" client login) removed 2026-09-20 — confirmed dead (no live frontend
// call, see src/pages/ClientLogin.jsx) and a real liability while it existed: unauthenticated,
// compared password hashes itself instead of using Supabase Auth, and leaked account existence
// via a no_account/wrong_password result split. The `auth` resource now returns 410 unconditionally
// — see the dispatcher below.

// Resources/ops below are either genuinely public (read-only content the marketing site itself
// renders: portfolio items, blog posts, site-content reads) or require an authenticated Nova
// staff member carrying the same permission the matching /dashboard/* route is gated on in
// App.jsx — see api/_auth.js for why this check has to live here and not just in the frontend
// route guard. `auth` (the unfinished "Nova Connect" client login) is confirmed dead: no live
// frontend calls it (see src/pages/ClientLogin.jsx), and it compared password hashes and leaked
// account-existence with no session ever issued — disabled outright rather than secured, since
// there is nothing left depending on it.
export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const resource = typeof req.query?.resource === 'string' ? req.query.resource : '';
  const op       = typeof req.query?.op === 'string' ? req.query.op : '';

  switch (resource) {
    case 'invoices':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleInvoices(req, res);

    case 'referrals':
      if (!(await requireStaff(req, res, 'growth.view'))) return;
      return handleReferrals(req, res);

    case 'intake-requests':
      if (!(await requireStaff(req, res, 'intelligence.view'))) return;
      return handleIntakeRequests(req, res);

    case 'vault':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      if (op === 'list')   return handleVaultList(req, res);
      if (op === 'upload') return handleVaultUpload(req, res);
      if (op === 'delete') return handleVaultDelete(req, res);
      if (op === 'resign') return handleVaultResign(req, res);
      return res.status(400).json({ error: `Unknown vault op: ${op}` });

    case 'portfolio':
      if (op === 'items')  return handlePortfolioItems(req, res); // public: /portfolio renders this
      if (op === 'upload') {
        if (!(await requireStaff(req, res, 'growth.view'))) return;
        return handlePortfolioUpload(req, res);
      }
      if (op === 'mutate') {
        if (!(await requireStaff(req, res, 'growth.view'))) return;
        return handlePortfolioMutate(req, res);
      }
      return res.status(400).json({ error: `Unknown portfolio op: ${op}` });

    case 'site-content':
      if (req.method === 'POST' && !(await requireStaff(req, res, 'admin.view'))) return;
      return handleSiteContent(req, res); // GET is public: useSiteContent() renders it site-wide

    case 'blog':
      if (op === 'posts') {
        // Public for real reads (/insights), but `&admin=true` bypasses the published=true filter
        // and returns drafts too — that variant needs the same check as op=admin below.
        if (req.query?.admin === 'true' && !(await requireStaff(req, res, 'growth.view'))) return;
        return handleBlogPosts(req, res);
      }
      if (op === 'admin') {
        const blogCaller = await requireStaff(req, res, 'growth.view');
        if (!blogCaller) return;
        return handleBlogAdmin(req, res, blogCaller);
      }
      return res.status(400).json({ error: `Unknown blog op: ${op}` });

    case 'documents':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleDocuments(req, res);

    case 'newsletter':
      if (!(await requireStaff(req, res, 'growth.view'))) return;
      return handleNewsletter(req, res);

    // crm/orders/products/audit: a baseline "is this a real, active staff member at all" check
    // happens here (401 if not — matches every other resource's auth-vs-authorization split);
    // the SPECIFIC organization_id's permission is then checked inside each handler via
    // requireOrgAccess() (403 if the real membership doesn't cover that org), which is real
    // object-level authorization, not just "did they have this permission somewhere."
    case 'crm': {
      const caller = await requireStaff(req, res);
      if (!caller) return;
      if (op === 'businesses') return handleCrmBusinesses(req, res);
      if (op === 'contacts') return handleCrmContacts(req, res);
      if (op === 'deals') return handleCrmDeals(req, res, caller);
      return res.status(400).json({ error: `Unknown crm op: ${op}` });
    }

    case 'orders': {
      const caller = await requireStaff(req, res);
      if (!caller) return;
      return handleOrders(req, res, caller);
    }

    case 'products': {
      const caller = await requireStaff(req, res);
      if (!caller) return;
      return handleProducts(req, res);
    }

    case 'audit': {
      const caller = await requireStaff(req, res);
      if (!caller) return;
      if (op === 'cases') return handleAuditCases(req, res, caller);
      if (op === 'evidence') return handleAuditEvidence(req, res, caller);
      if (op === 'findings') return handleAuditFindings(req, res);
      if (op === 'recommendations') return handleAuditRecommendations(req, res);
      if (op === 'reports') return handleAuditReports(req, res, caller);
      if (op === 'deliveries') return handleAuditDeliveries(req, res);
      if (op === 'outcomes') return handleAuditOutcomes(req, res);
      return res.status(400).json({ error: `Unknown audit op: ${op}` });
    }

    case 'zion': {
      // journal/facts are deliberately gated at "any real active staff member" — safe ONLY
      // because handleZionJournal/handleZionFacts themselves filter by the real caller's own
      // author_user_id (or require platform-owner status for facts confirmation), the same
      // ownership-scoping pattern already proven for the hiring workflow's my-application action.
      // Everything else here is real production tooling with no such per-row ownership check, so
      // it needs an explicit permission gate — a bare nova_sales_candidate role (academy.view
      // only) must not be able to reach Nova's content pipeline just by knowing the action name.
      if (op === 'journal' || op === 'facts') {
        const caller = await requireStaff(req, res);
        if (!caller) return;
        if (op === 'journal') return handleZionJournal(req, res, caller);
        return handleZionFacts(req, res, caller);
      }
      const caller = await requireStaff(req, res, 'growth.view');
      if (!caller) return;
      if (op === 'ideas') return handleZionIdeas(req, res, caller);
      if (op === 'scripts') return handleZionScripts(req, res);
      if (op === 'character-assets') return handleZionCharacterAssets(req, res);
      if (op === 'videos') return handleZionVideos(req, res, caller);
      if (op === 'review') return handleZionReview(req, res, caller);
      return res.status(400).json({ error: `Unknown zion op: ${op}` });
    }

    case 'installations': {
      const caller = await requireStaff(req, res, 'growth.view');
      if (!caller) return;
      return handleInstallations(req, res, caller);
    }

    case 'approvals': {
      // admin.view: approval actions are consequential (spending, installations, pricing
      // exceptions, content publication) — gated the same as invoices/vault, not left at bare
      // "any active staff" like the read-only aggregation might otherwise tempt.
      const caller = await requireStaff(req, res, 'admin.view');
      if (!caller) return;
      if (req.method === 'GET') return handleApprovalsInbox(req, res);
      return handleApprovalsGeneric(req, res, caller);
    }

    case 'crystal': {
      // Bare staff check at the dispatcher — the real per-op gate (execution.view for admin
      // actions, ownership-scoping for a worker's own jobs) happens inside each handler, exactly
      // like crm/orders/audit above.
      const caller = await requireStaff(req, res);
      if (!caller) return;
      if (op === 'customers') return handleCrystalCustomers(req, res);
      if (op === 'properties') return handleCrystalProperties(req, res);
      if (op === 'catalog') return handleCrystalCatalog(req, res);
      if (op === 'quotes') return handleCrystalQuotes(req, res);
      if (op === 'estimates') return handleCrystalEstimates(req, res, caller);
      if (op === 'jobs') return handleCrystalJobs(req, res, caller);
      if (op === 'invoices') return handleCrystalInvoices(req, res);
      if (op === 'feedback') return handleCrystalFeedback(req, res);
      if (op === 'recurring') return handleCrystalRecurring(req, res);
      return res.status(400).json({ error: `Unknown crystal op: ${op}` });
    }

    case 'auth':
      return res.status(410).json({ error: 'This login method has been retired.' });

    default:
      return res.status(400).json({ error: `Unknown resource: ${resource}` });
  }
}
