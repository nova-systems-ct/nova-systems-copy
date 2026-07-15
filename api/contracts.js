import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail } from './_sanitize.js';
import { twilioRequest } from './nova-ai/_twilio.js';
import { uploadToVault } from './_vaultStorage.js';

// Digital document signing — dispatch via ?action=:
//   create   POST  dashboard creates a contract + emails the client their signing link
//   list     GET   dashboard contracts table (pending/signed, dates)
//   get      GET   public /sign/:contract_id loads the contract to display
//   sign     POST  public /sign/:contract_id submits the signature, generates + stores
//                   the signed PDF, and notifies both client and Isaac

const CONTRACT_TYPES = ['Digital Foundation', 'Growth Package', 'Custom'];
const ISAAC_EMAIL = 'Isaac_0427@icloud.com';
const SIGN_LINK_EXPIRY_DAYS = 7;

async function handleCreate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase environment variables not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables.' });
  }

  const b = req.body || {};
  const client_name = sanitize(b.client_name, 200);
  const client_email = sanitizeEmail(b.client_email);
  const contract_type = CONTRACT_TYPES.includes(b.contract_type) ? b.contract_type : '';
  const custom_notes = sanitize(b.custom_notes, 4000);

  if (!client_name || !client_email) return res.status(400).json({ error: 'Client name and email are required' });
  if (!contract_type) return res.status(400).json({ error: 'A valid contract type is required' });

  let contract = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/contracts`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify({ client_name, client_email, contract_type, custom_notes, status: 'pending' }),
    });
    if (!r.ok) {
      console.error('[contracts:create] Supabase save error:', r.status, await r.text());
      return res.status(500).json({ error: 'Failed to create contract' });
    }
    const rows = await r.json();
    contract = rows[0];
  } catch (err) {
    console.error('[contracts:create] Supabase error:', err.message);
    return res.status(500).json({ error: 'Failed to create contract' });
  }

  const origin = req.headers.origin && req.headers.origin.startsWith('https://') ? req.headers.origin : 'https://nova-systems.app';
  const signLink = `${origin}/sign/${contract.id}`;

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Nova Systems <noreply@nova-systems.app>',
          to: [client_email],
          subject: 'Your Nova Systems Agreement is Ready to Sign',
          text: [
            `Hi ${client_name},`,
            '',
            'your Digital Foundation Agreement from Nova Systems is ready for your review and signature.',
            '',
            `Please click the link below to read and sign your contract: ${signLink}`,
            '',
            'This link expires in 7 days.',
            '',
            'Questions? Reply to this email or text (203) 706-0504.',
          ].join('\n'),
        }),
      });
    } catch (err) {
      console.error('[contracts:create] Sign-link email error (non-fatal):', err.message);
    }
  }

  return res.status(200).json({ ok: true, contract });
}

async function handleList(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json([]);

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/contracts?order=created_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[contracts:list] Supabase error:', r.status, await r.text()); return res.status(200).json([]); }
    return res.status(200).json(await r.json());
  } catch (err) {
    console.error('[contracts:list] Error:', err.message);
    return res.status(200).json([]);
  }
}

async function handleGet(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const id = sanitize(req.query?.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase environment variables not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables.' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/contracts?id=eq.${encodeURIComponent(id)}&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) { console.error('[contracts:get] Supabase error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to load contract' }); }
    const rows = await r.json();
    if (!rows.length) return res.status(404).json({ error: 'Contract not found' });

    const contract = rows[0];
    const expired = contract.status === 'pending'
      && (Date.now() - new Date(contract.sent_at).getTime()) > SIGN_LINK_EXPIRY_DAYS * 24 * 60 * 60_000;

    return res.status(200).json({ ...contract, expired });
  } catch (err) {
    console.error('[contracts:get] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load contract' });
  }
}

async function handleSign(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 10, 60_000)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase environment variables not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables.' });
  }

  const b = req.body || {};
  const id = sanitize(b.id, 100);
  const signed_name = sanitize(b.signed_name, 200);
  const signature_data = typeof b.signature_data === 'string' ? b.signature_data : '';
  const pdf_base64 = typeof b.pdf_base64 === 'string' ? b.pdf_base64 : '';
  const agreed = b.agreed === true;

  if (!id) return res.status(400).json({ error: 'id is required' });
  if (!signed_name) return res.status(400).json({ error: 'Your typed legal name is required' });
  if (!signature_data) return res.status(400).json({ error: 'A drawn signature is required' });
  if (!agreed) return res.status(400).json({ error: 'You must agree to the terms before signing' });

  let contract = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/contracts?id=eq.${encodeURIComponent(id)}&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const rows = r.ok ? await r.json() : [];
    if (!rows.length) return res.status(404).json({ error: 'Contract not found' });
    contract = rows[0];
  } catch (err) {
    console.error('[contracts:sign] Lookup error:', err.message);
    return res.status(500).json({ error: 'Failed to load contract' });
  }

  if (contract.status === 'signed') return res.status(400).json({ error: 'This contract has already been signed' });

  let pdf_url = '';
  if (pdf_base64) {
    try {
      const base64Data = pdf_base64.replace(/^data:[^;]+;base64,/, '');
      const upload = await uploadToVault(SUPABASE_URL, SUPABASE_KEY, {
        base64: base64Data,
        fileName: `${signed_name.replace(/[^a-z0-9]+/gi, '-')}-signed-agreement.pdf`,
        mimeType: 'application/pdf',
        category: 'contracts',
        clientId: id,
        clientName: contract.client_name,
        docType: 'Contract',
        status: 'Signed',
        source: 'system',
      });
      pdf_url = upload.file_url;
    } catch (err) {
      console.error('[contracts:sign] Vault upload error (non-fatal):', err.message);
    }
  }

  const signed_at = new Date().toISOString();
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/contracts?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify({ status: 'signed', signed_at, signed_name, signature_data, pdf_url: pdf_url || null }),
    });
    if (!r.ok) { console.error('[contracts:sign] Supabase update error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to save your signature' }); }
    const rows = await r.json();
    contract = rows[0];
  } catch (err) {
    console.error('[contracts:sign] Supabase error:', err.message);
    return res.status(500).json({ error: 'Failed to save your signature' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const attachments = pdf_base64
    ? [{ filename: `${signed_name.replace(/[^a-z0-9]+/gi, '-')}-signed-agreement.pdf`, content: pdf_base64.replace(/^data:[^;]+;base64,/, '') }]
    : undefined;

  if (RESEND_KEY) {
    const FROM = 'Nova Systems <noreply@nova-systems.app>';

    if (contract.client_email) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM,
            to: [contract.client_email],
            subject: 'Your Signed Nova Systems Agreement',
            text: [
              `Hi ${signed_name},`,
              '',
              'thank you for signing. Your signed agreement is attached to this email. Keep it for your records.',
              '',
              'We will be in touch within 24 hours to get started.',
              '',
              'Nova Systems',
              'hello@nova-systems.app  ·  (203) 706-0504  ·  nova-systems.app',
            ].join('\n'),
            ...(attachments ? { attachments } : {}),
          }),
        });
      } catch (err) {
        console.error('[contracts:sign] Client confirmation email error (non-fatal):', err.message);
      }
    }

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [ISAAC_EMAIL],
          subject: `${signed_name} just signed their Nova Systems contract`,
          text: [
            `${signed_name} just signed their Nova Systems contract.`,
            '',
            `Contract type: ${contract.contract_type}`,
            `Signed at: ${new Date(signed_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}`,
            pdf_url ? `Download signed PDF: ${pdf_url}` : '',
          ].filter(Boolean).join('\n'),
        }),
      });
    } catch (err) {
      console.error('[contracts:sign] Isaac notification email error (non-fatal):', err.message);
    }
  }

  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      await twilioRequest(TWILIO_SID, TWILIO_TOKEN, 'POST', 'Messages.json', {
        To: process.env.ISAAC_ALERT_PHONE || '+12037060504',
        From: TWILIO_FROM,
        Body: `${signed_name} signed the contract. Check your email for the signed PDF.`,
      });
    } catch (err) {
      console.error('[contracts:sign] Twilio alert error (non-fatal):', err.message);
    }
  }

  return res.status(200).json({ ok: true, contract });
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const action = typeof req.query?.action === 'string' ? req.query.action : '';

  switch (action) {
    case 'create': return handleCreate(req, res);
    case 'list':   return handleList(req, res);
    case 'get':    return handleGet(req, res);
    case 'sign':   return handleSign(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
