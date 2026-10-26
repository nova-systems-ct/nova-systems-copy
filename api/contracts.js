import { resendBase } from './_email.js';
import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';
import { sanitize, sanitizeEmail } from './_sanitize.js';
import { twilioRequest } from './_twilio.js';
import { uploadToVault } from './_vaultStorage.js';
import { requireStaff } from './_auth.js';
import crypto from 'node:crypto';
import { getContractContent } from '../src/data/contractTemplates.js';
import { textPdf } from './_sales/pdf.js';
import { novaInternalOrgId } from './_orgAccess.js';
import { sendGatedEmail, appBase } from './_sales/core.js';

// Digital document signing — dispatch via ?action=:
//   save_draft POST [admin.view] create/update a draft (not visible on /sign)
//   create   POST  [admin.view] send a contract (new, or draft_id) + gated signing-link email; reports delivery
//   list     GET   [admin.view] dashboard contracts table (pending/signed, dates) — every client's
//                   contract, so this is exactly the kind of listing that needs staff auth
//   get      GET   public /sign/:contract_id — ONLY what the signing page needs (no signature image,
//                   no email addresses) plus the SHA-256 of the exact server-held contract text
//   sign     POST  public — refused after the 7-day expiry; the signer must echo the content hash
//                   they were shown; the signed PDF is generated HERE from the server-held text
// Security repair 2026-09-30 (audit F-26).

const CONTRACT_TYPES = ['Digital Foundation', 'Growth Package', 'Custom', 'Sales Representative Agreement'];
const ISAAC_EMAIL = 'Isaac_0427@icloud.com';
const SIGN_LINK_EXPIRY_DAYS = 7;

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
// Canonical text of a contract exactly as /sign renders it (same shared template module).
function contractText(contract) {
  const c = getContractContent(contract.contract_type, contract.custom_notes);
  return [c.title, c.intro || '', ...c.sections.map((x) => `${x.heading || ''}\n${x.body || ''}`)].join('\n\n');
}
const isExpired = (contract, now = Date.now()) => contract.status === 'pending'
  && (now - new Date(contract.sent_at || contract.created_at || 0).getTime()) > SIGN_LINK_EXPIRY_DAYS * 24 * 60 * 60_000;
const clientIp = (req) => String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 64) || null;

// Fields shared by save_draft and create. Returns { fields } or { error }.
function readContractFields(b, { requireAll }) {
  const client_name = sanitize(b.client_name, 200);
  const client_email = sanitizeEmail(b.client_email);
  const contract_type = CONTRACT_TYPES.includes(b.contract_type) ? b.contract_type : '';
  const custom_notes = sanitize(b.custom_notes, 4000);
  // links a working agreement to the candidate it belongs to (api/intake.js hiring workflow); optional.
  const application_id = sanitize(b.application_id, 100) || null;
  if (requireAll) {
    if (!client_name || !client_email) return { error: 'Client name and a valid client email are required.' };
    if (!contract_type) return { error: 'Choose a contract type.' };
  } else if (!client_name && !client_email && !contract_type && !custom_notes) {
    return { error: 'Nothing to save yet.' };
  }
  return { fields: { client_name: client_name || null, client_email: client_email || null, contract_type: contract_type || null, custom_notes, application_id } };
}

const contractsCfg = () => ({ url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
async function contractsDb(path, { method = 'GET', body } = {}) {
  const { url, key } = contractsCfg();
  const r = await fetch(`${url}/rest/v1/${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw Object.assign(new Error(`contracts ${method} ${r.status}`), { detail: (await r.text().catch(() => '')).slice(0, 300) });
  return r.json();
}
const publicContract = (c) => ({ id: c.id, status: c.status, client_name: c.client_name, client_email: c.client_email, contract_type: c.contract_type, custom_notes: c.custom_notes, sent_at: c.sent_at, signed_at: c.signed_at, signed_name: c.signed_name, delivery_status: c.delivery_status || null, delivery_note: c.delivery_note || null, created_at: c.created_at, updated_at: c.updated_at });
const signOrigin = (req) => (req.headers.origin && req.headers.origin.startsWith('https://') ? req.headers.origin : appBase());

// save_draft: create or update a DRAFT (never touches a sent or signed contract). A draft is not visible on /sign.
async function handleSaveDraft(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 60, 60_000)) return;
  if (!contractsCfg().url || !contractsCfg().key) return res.status(500).json({ error: 'Supabase is not configured on this server.' });
  const b = req.body || {};
  const { fields, error } = readContractFields(b, { requireAll: false });
  if (error) return res.status(400).json({ error });
  const id = sanitize(b.id, 100);
  try {
    if (id) {
      const rows = await contractsDb(`contracts?id=eq.${encodeURIComponent(id)}&status=eq.draft`, { method: 'PATCH', body: { ...fields, updated_at: new Date().toISOString() } });
      if (!rows.length) return res.status(409).json({ error: 'This draft was already sent or no longer exists. Open the contract from the list.' });
      return res.status(200).json({ ok: true, contract: publicContract(rows[0]) });
    }
    const orgId = await novaInternalOrgId();
    const rows = await contractsDb('contracts', { method: 'POST', body: { ...fields, status: 'draft', sent_at: null, ...(orgId ? { organization_id: orgId } : {}) } });
    return res.status(200).json({ ok: true, contract: publicContract(rows[0]) });
  } catch (err) {
    console.error('[contracts:save_draft]', err.message, err.detail || '');
    return res.status(500).json({ error: 'The draft could not be saved. Your text is still on screen; try again.' });
  }
}

// create: send a contract for signature. With draft_id the draft becomes the sent contract (a repeated click on an
// already-sent draft returns the same contract and sends nothing again). The signing-link email follows the gated
// email policy (dry_run unless SALES_EMAIL_MODE=live); the response says exactly what happened to it.
async function handleCreate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, 20, 60_000)) return;
  if (!contractsCfg().url || !contractsCfg().key) return res.status(500).json({ error: 'Supabase is not configured on this server.' });
  const b = req.body || {};
  const { fields, error } = readContractFields(b, { requireAll: true });
  if (error) return res.status(400).json({ error });
  const draftId = sanitize(b.draft_id, 100);

  let contract;
  try {
    if (draftId) {
      const existing = (await contractsDb(`contracts?id=eq.${encodeURIComponent(draftId)}&select=*&limit=1`))[0];
      if (!existing) return res.status(404).json({ error: 'That draft no longer exists.' });
      if (existing.status !== 'draft') {
        return res.status(200).json({ ok: true, already_sent: true, contract: publicContract(existing), sign_link: `${signOrigin(req)}/sign/${existing.id}`, delivery: { status: existing.delivery_status || 'unknown', note: existing.delivery_note || 'This contract was already sent; nothing was sent again.' } });
      }
      const rows = await contractsDb(`contracts?id=eq.${encodeURIComponent(draftId)}&status=eq.draft`, { method: 'PATCH', body: { ...fields, status: 'pending', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() } });
      if (!rows.length) return res.status(409).json({ error: 'This draft was sent from another window. Refresh the list.' });
      contract = rows[0];
    } else {
      const orgId = await novaInternalOrgId();
      contract = (await contractsDb('contracts', { method: 'POST', body: { ...fields, status: 'pending', ...(orgId ? { organization_id: orgId } : {}) } }))[0];
    }
  } catch (err) {
    console.error('[contracts:create]', err.message, err.detail || '');
    return res.status(500).json({ error: 'The contract could not be saved. Nothing was sent; your text is still on screen.' });
  }

  const signLink = `${signOrigin(req)}/sign/${contract.id}`;
  const text = [`Hi ${fields.client_name},`, '', `Your ${fields.contract_type} agreement from Nova Systems is ready for your review and signature.`, '', `Read and sign it here: ${signLink}`, '', `This link expires in ${SIGN_LINK_EXPIRY_DAYS} days.`, '', 'Questions? Reply to this email or text (203) 706-0504.'].join('\n');
  const sent = await sendGatedEmail({ to: fields.client_email, subject: 'Your Nova Systems agreement is ready to sign', text, idempotencyKey: `contract-${contract.id}` });
  const note = sent.status === 'sent' ? 'The email provider accepted the message. That is not proof it reached the inbox.'
    : sent.status === 'dry_run' ? `Email is in dry-run mode, so nothing went to ${fields.client_email}.${sent.local_copy ? ' A copy is in the local test inbox.' : ''} Copy the signing link to share it yourself.`
    : sent.status === 'blocked' ? `Not emailed: ${sent.reason}. Copy the signing link to share it yourself.`
    : `The email failed (${sent.reason || 'unknown error'}). The contract is saved; copy the signing link to share it yourself.`;
  try {
    const rows = await contractsDb(`contracts?id=eq.${encodeURIComponent(contract.id)}`, { method: 'PATCH', body: { delivery_status: sent.status, delivery_note: note.slice(0, 300) } });
    if (rows[0]) contract = rows[0];
  } catch (err) { console.error('[contracts:create] delivery status not recorded:', err.message); }
  return res.status(200).json({ ok: true, contract: publicContract(contract), sign_link: signLink, delivery: { status: sent.status, note } });
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
    if (!rows.length || rows[0].status === 'draft') return res.status(404).json({ error: 'Contract not found' });

    const c = rows[0];
    return res.status(200).json({
      id: c.id, client_name: c.client_name, contract_type: c.contract_type, custom_notes: c.custom_notes,
      status: c.status, sent_at: c.sent_at, signed_at: c.signed_at, signed_name: c.status === 'signed' ? c.signed_name : null,
      pdf_available: !!c.pdf_url, expired: isExpired(c), content_sha256: sha256(contractText(c)),
    });
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
  if (contract.status !== 'pending') return res.status(410).json({ error: 'This agreement is no longer open for signature.' });
  if (isExpired(contract)) return res.status(410).json({ error: 'This signing link has expired. Ask Nova Systems to send a new one.' });
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature_data) || signature_data.length > 400_000) return res.status(422).json({ error: 'The drawn signature could not be read. Please draw it again.' });

  // Bind the signature to the exact text the server holds (and that the page showed).
  const text = contractText(contract);
  const contentHash = sha256(text);
  if (sanitize(b.content_sha256, 80) !== contentHash) return res.status(409).json({ error: 'This agreement changed since you opened it. Reload the page and read it again.' });

  const signed_at = new Date().toISOString();
  const ip = clientIp(req);
  const signatureHash = sha256([contract.id, contentHash, signed_name, signed_at, ip || '', sha256(signature_data)].join('|'));

  // Server-generated signed PDF — the browser's copy is never stored as the record.
  const pdf = textPdf({ title: `Signed agreement ${contract.id}`, blocks: [
    { style: 'h1', text: 'NOVA SYSTEMS' },
    ...text.split('\n\n').map((para, i) => ({ style: i === 0 ? 'h2' : 'p', text: para })),
    { style: 'gap' }, { style: 'h2', text: 'Signature record' },
    { style: 'p', text: `Signed electronically by: ${signed_name}` }, { style: 'p', text: `Signed at (server time): ${signed_at}` },
    { style: 'p', text: 'A drawn signature image was captured and is stored with this record.' },
    { style: 'mono', text: `Document SHA-256: ${contentHash}` }, { style: 'mono', text: `Signature SHA-256: ${signatureHash}` }, { style: 'mono', text: `Record ID: ${contract.id}` },
  ] });

  let pdf_url = '';
  try {
    const upload = await uploadToVault(SUPABASE_URL, SUPABASE_KEY, {
      base64: pdf.toString('base64'), fileName: `${signed_name.replace(/[^a-z0-9]+/gi, '-')}-signed-agreement.pdf`,
      mimeType: 'application/pdf', category: 'contracts', clientId: id, clientName: contract.client_name,
      docType: 'Contract', status: 'Signed', source: 'system',
    });
    pdf_url = upload.path ? `vault:${upload.path}` : '';
  } catch (err) {
    console.error('[contracts:sign] Vault upload error (non-fatal):', err.message);
  }

  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  const core = { status: 'signed', signed_at, signed_name, signature_data, pdf_url: pdf_url || null };
  try {
    const path = `${SUPABASE_URL}/rest/v1/contracts?id=eq.${encodeURIComponent(id)}&status=eq.pending`;
    let r = await fetch(path, { method: 'PATCH', headers: H, body: JSON.stringify({ ...core, content_sha256: contentHash, signature_hash: signatureHash, signer_ip: ip }) });
    if (!r.ok && r.status === 400) r = await fetch(path, { method: 'PATCH', headers: H, body: JSON.stringify(core) }); // repair migration not applied yet
    if (!r.ok) { console.error('[contracts:sign] Supabase update error:', r.status, await r.text()); return res.status(500).json({ error: 'Failed to save your signature' }); }
    const rows = await r.json();
    if (!rows.length) return res.status(409).json({ error: 'This agreement was just signed or changed.' });
    contract = rows[0];
  } catch (err) {
    console.error('[contracts:sign] Supabase error:', err.message);
    return res.status(500).json({ error: 'Failed to save your signature' });
  }
  const pdf_base64 = pdf.toString('base64');

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const attachments = [{ filename: `${signed_name.replace(/[^a-z0-9]+/gi, '-')}-signed-agreement.pdf`, content: pdf_base64 }];

  if (RESEND_KEY) {
    const FROM = 'Nova Systems <noreply@nova-systems.app>';

    if (contract.client_email) {
      try {
        await fetch(`${resendBase()}/emails`, {
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
      await fetch(`${resendBase()}/emails`, {
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
            pdf_url ? 'The signed PDF is stored in Nova Vault and attached to the client copy.' : '',
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

  return res.status(200).json({ ok: true, contract: { id: contract.id, status: contract.status, signed_at: contract.signed_at, signed_name: contract.signed_name }, content_sha256: contentHash, signature_sha256: signatureHash });
}

// pdf: staff-only download of a signed contract's PDF in the private Vault (pdf_url holds "vault:<path>").
async function handlePdf(req, res) {
  const id = sanitize(req.query?.id, 100);
  if (!id) return res.status(400).json({ error: 'id is required' });
  try {
    const c = (await contractsDb(`contracts?id=eq.${encodeURIComponent(id)}&select=id,status,pdf_url&limit=1`))[0];
    if (!c) return res.status(404).json({ error: 'Contract not found' });
    if (!c.pdf_url) return res.status(404).json({ error: c.status === 'signed' ? 'This signed contract has no stored PDF.' : 'A PDF exists only after the client signs.' });
    const path = c.pdf_url.startsWith('vault:') ? c.pdf_url.slice(6) : null;
    if (!path) return res.status(404).json({ error: 'This contract has no Vault copy of its PDF.' });
    // Streamed through the API (not a Supabase storage URL) so it also works where only the app is reachable (iPad).
    const { url, key } = contractsCfg();
    const f = await fetch(`${url}/storage/v1/object/nova-vault/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!f.ok) return res.status(502).json({ error: 'The Vault did not return the PDF. Try again.' });
    const bytes = Buffer.from(await f.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="nova-contract-${c.id.slice(0, 8)}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(bytes);
  } catch (err) {
    console.error('[contracts:pdf]', err.message);
    return res.status(500).json({ error: 'The PDF link could not be created.' });
  }
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const action = typeof req.query?.action === 'string' ? req.query.action : '';

  switch (action) {
    case 'create':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleCreate(req, res);
    case 'save_draft':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleSaveDraft(req, res);
    case 'pdf':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handlePdf(req, res);
    case 'list':
      if (!(await requireStaff(req, res, 'admin.view'))) return;
      return handleList(req, res);
    case 'get':    return handleGet(req, res);
    case 'sign':   return handleSign(req, res);
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
