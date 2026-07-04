import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail } from './_sanitize.js';
import { uploadToVault } from './_vaultStorage.js';

// Combined client-dashboard endpoint — dispatch via ?resource= (and ?op= for
// resources with more than one sub-route):
//   invoices                    GET list / POST { action: create|update|delete }
//   referrals                   GET list / POST { action: create|update|delete }
//   intake-requests              GET list / POST { action: 'update-status', id, status }
//   vault      &op=list|upload|delete
//   portfolio  &op=items|upload|mutate   (mutate: POST { action: update|delete })
//   site-content                 GET ?key= / POST upsert
//   blog       &op=posts|admin           (admin: POST { action: save|delete })
//   documents                    POST generate a document with Claude
//   auth                         POST { email, password_hash } — Nova Connect client login

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

async function handleBlogAdmin(req, res) {
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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}`, {
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
    const published                    = b.published === true || b.published === 'true';

    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (category && !BLOG_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });

    const slug = sanitize(b.slug, 100) || slugify(title);

    const record = {
      title, slug, category: category || BLOG_CATEGORIES[0], excerpt, content,
      thumbnail_color, seo_title: seo_title || title, seo_description: seo_description || excerpt,
      published, updated_at: new Date().toISOString(),
    };

    try {
      const url = id
        ? `${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}`
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

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// --------------------------------------------------------------- documents
async function handleDocuments(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
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
        model: 'claude-sonnet-4-20250514',
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

    const text = data.content?.[0]?.text || '';

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && (client_id || lead_id)) {
      try {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: 'return=minimal',
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
        console.log('[client:documents] Draft saved to Supabase');
      } catch (err) {
        console.error('[client:documents] Supabase save (non-fatal):', err.message);
      }
    }

    res.status(200).json({ text });
  } catch (err) {
    console.error('[client:documents] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate document' });
  }
}

// Nova Connect client portal login — checks against client_accounts.
async function handleAuth(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 5, 60_000)) return; // strict: 5 login attempts/min per IP

  const email = sanitizeEmail(req.body?.email || '');
  const password_hash = sanitize(req.body?.password_hash || '', 128);

  if (!email || !password_hash) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({ result: 'no_account' });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/client_accounts?email=eq.${encodeURIComponent(email)}&select=client_id,email,password_hash,status`;
    const sbRes = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!sbRes.ok) {
      console.error('[client:auth] Supabase query error:', sbRes.status, await sbRes.text());
      return res.status(502).json({ error: 'Database error — try again' });
    }

    const rows = await sbRes.json();
    if (rows.length === 0) return res.status(200).json({ result: 'no_account' });

    const row = rows.find((r) => r.password_hash === password_hash);
    if (!row) return res.status(200).json({ result: 'wrong_password' });

    return res.status(200).json({ result: 'ok', client_id: row.client_id, email: row.email });
  } catch (err) {
    console.error('[client:auth] Error:', err.message);
    return res.status(502).json({ error: 'Database unreachable — try again' });
  }
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const resource = typeof req.query?.resource === 'string' ? req.query.resource : '';
  const op       = typeof req.query?.op === 'string' ? req.query.op : '';

  switch (resource) {
    case 'invoices':  return handleInvoices(req, res);
    case 'referrals': return handleReferrals(req, res);
    case 'intake-requests': return handleIntakeRequests(req, res);

    case 'vault':
      if (op === 'list')   return handleVaultList(req, res);
      if (op === 'upload') return handleVaultUpload(req, res);
      if (op === 'delete') return handleVaultDelete(req, res);
      return res.status(400).json({ error: `Unknown vault op: ${op}` });

    case 'portfolio':
      if (op === 'items')  return handlePortfolioItems(req, res);
      if (op === 'upload') return handlePortfolioUpload(req, res);
      if (op === 'mutate') return handlePortfolioMutate(req, res);
      return res.status(400).json({ error: `Unknown portfolio op: ${op}` });

    case 'site-content': return handleSiteContent(req, res);

    case 'blog':
      if (op === 'posts') return handleBlogPosts(req, res);
      if (op === 'admin') return handleBlogAdmin(req, res);
      return res.status(400).json({ error: `Unknown blog op: ${op}` });

    case 'documents': return handleDocuments(req, res);
    case 'auth':      return handleAuth(req, res);

    default:
      return res.status(400).json({ error: `Unknown resource: ${resource}` });
  }
}
