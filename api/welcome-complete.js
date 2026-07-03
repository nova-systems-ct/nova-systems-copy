import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail, sanitizePhone } from './_sanitize.js';
import { uploadToVault } from './_vaultStorage.js';

async function hashPassword(pw) {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(pw).digest('hex');
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_KEY   = process.env.RESEND_API_KEY;

  const b = req.body || {};
  const client_id      = sanitize(b.client_id, 100);
  const full_name        = sanitize(b.full_name, 150);
  const business_name     = sanitize(b.business_name, 200);
  const email               = sanitizeEmail(b.email);
  const phone                = sanitizePhone(b.phone);
  const tier_name              = sanitize(b.tier_name, 100);
  const tier_price               = Number(b.tier_price) || 0;
  const contract_pdf_base64        = typeof b.contract_pdf_base64 === 'string' ? b.contract_pdf_base64 : '';

  if (!client_id || !email) return res.status(400).json({ error: 'client_id and email are required' });

  const tempPassword = `Nova${(phone || '').replace(/\D/g, '').slice(0, 4) || '0000'}`;
  let contract_url = null;

  if (SUPABASE_URL && SUPABASE_KEY) {
    // Update client to Active
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(client_id)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'Active', payment_status: 'Paid', first_payment_date: new Date().toISOString() }),
      });
    } catch (e) { console.error('[welcome-complete] client update error:', e.message); }

    // Create client portal account
    try {
      const password_hash = await hashPassword(tempPassword);
      await fetch(`${SUPABASE_URL}/rest/v1/client_accounts`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=merge-duplicates',
        },
        body: JSON.stringify({ client_id, email, password_hash, status: 'active' }),
      });
    } catch (e) { console.error('[welcome-complete] client_accounts error:', e.message); }

    // Upload contract PDF to Nova Vault
    if (contract_pdf_base64) {
      const match = contract_pdf_base64.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) {
        try {
          const result = await uploadToVault(SUPABASE_URL, SUPABASE_KEY, {
            base64: match[2], fileName: `contract-${new Date().toISOString().slice(0, 10)}.pdf`,
            mimeType: 'application/pdf', category: 'contracts',
            clientId: client_id, clientName: business_name || full_name, docType: 'Contract', status: 'Signed',
          });
          contract_url = result.file_url;
          await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(client_id)}`, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json', Prefer: 'return=minimal',
            },
            body: JSON.stringify({ contract_url }),
          });
        } catch (e) { console.error('[welcome-complete] contract upload error:', e.message); }
      }
    }
  }

  // Emails (non-fatal)
  if (RESEND_KEY) {
    const FROM = 'Nova Systems <noreply@nova-systems.app>';
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: 'Welcome to Nova Systems 🖤',
          text: [
            `Hi ${full_name},`,
            '',
            `Welcome to Nova Systems! Your ${tier_name} plan is now active.`,
            '',
            'YOUR CLIENT PORTAL LOGIN',
            '━━━━━━━━━━━━━━━━━━━━━━━━',
            `Email:    ${email}`,
            `Password: ${tempPassword}`,
            '',
            'Log in at https://nova-systems.app/login to track your services, approve content, and message your team.',
            '',
            'Isaac Nova',
            'Founder, Nova Systems',
          ].join('\n'),
        }),
      });
    } catch (e) { console.warn('[welcome-complete] client email error:', e.message); }

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: ['Isaac_0427@icloud.com'],
          subject: `New Client Signed: ${business_name || full_name} — $${tier_price}/mo`,
          text: [
            'NEW CLIENT — CONTRACT SIGNED & PAID',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            `Business: ${business_name}`,
            `Contact:  ${full_name}`,
            `Email:    ${email}`,
            `Phone:    ${phone || 'N/A'}`,
            `Plan:     ${tier_name} — $${tier_price}/mo`,
            contract_url ? `Contract: ${contract_url}` : '',
          ].filter(Boolean).join('\n'),
        }),
      });
    } catch (e) { console.warn('[welcome-complete] isaac email error:', e.message); }
  }

  return res.status(200).json({ ok: true, temp_password: tempPassword, contract_url });
}
