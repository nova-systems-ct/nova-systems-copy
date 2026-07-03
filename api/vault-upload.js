import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize } from './_sanitize.js';
import { uploadToVault } from './_vaultStorage.js';

const VALID_CATEGORIES = ['contracts', 'invoices', 'files'];

export default async function handler(req, res) {
  if (setCors(req, res)) return;
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
  const category  = VALID_CATEGORIES.includes(b.category) ? b.category : 'files';
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
    console.error('[vault-upload] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
