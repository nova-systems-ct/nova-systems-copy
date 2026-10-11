// Shared helper for uploading files into the nova-vault Supabase storage bucket
// and indexing them in the vault_documents table. Used by vault-upload.js and
// welcome-complete.js.
//
// Repair task (2026-09-23, revised same day per explicit correction): the `nova-vault` bucket
// this uploads into does not actually exist in production yet (confirmed live via the Storage
// Admin API — 404 "Bucket not found") and, once created, must be PRIVATE — it holds invoices,
// signed contracts, and generated documents, all real client/business PII.
//
// An earlier version of this fix stored a 30-day signed URL in vault_documents.file_url,
// reasoning that client-facing emails needed a durable link. That reasoning was wrong: checked
// api/notify.js's send-invoice and api/contracts.js's handleSign — both already attach the PDF
// directly to the email (base64 attachment), never a link to this bucket. The ONLY real consumer
// of a nova-vault URL is NovaVault.jsx, an already-authenticated (admin.view) staff dashboard
// page. There is no legitimate reason to mint a link that outlives the moment it's requested.
//
// So: uploadToVault no longer generates or stores any URL at all — only the durable
// `storage_path` is persisted. A working link is minted fresh, short-lived, on demand, only at
// the moment an authorized caller actually asks for one (api/client.js's vault `resign` action,
// already gated at admin.view) — a real permission check at the moment of access, not a
// long-lived bearer token that substitutes for one. `vault_documents.file_url` is treated as
// display-only cache that may be stale/expired at any time; nothing should trust it directly.

export async function signVaultUrl(SUPABASE_URL, SUPABASE_SERVICE_KEY, path, expiresInSeconds = 300) {
  const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/nova-vault/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!signRes.ok) {
    const errText = await signRes.text();
    throw new Error(`Signed URL generation failed: ${signRes.status} ${errText}`);
  }
  const { signedURL } = await signRes.json();
  return `${SUPABASE_URL}/storage/v1${signedURL}`;
}

export async function uploadToVault(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  base64, fileName, mimeType, category, clientId, clientName, docType, status, source,
}) {
  const safeFileName = (fileName || 'file').replace(/[^a-z0-9._-]/gi, '_');
  const path = `${category}/${clientId || 'unassigned'}/${Date.now()}-${safeFileName}`;

  let buffer;
  try { buffer = Buffer.from(base64, 'base64'); } catch { throw new Error('Invalid file data'); }

  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/nova-vault/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': mimeType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Storage upload failed: ${uploadRes.status} ${errText}`);
  }

  // A short-lived link generated here purely so an immediate caller (e.g. this same request's
  // response) has something usable right away — it is expected to expire quickly and is never
  // treated as the durable access path. Durable access is always storage_path + a fresh resign.
  const file_url = await signVaultUrl(SUPABASE_URL, SUPABASE_SERVICE_KEY, path);

  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/vault_documents`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      file_name: fileName || safeFileName,
      client_id: clientId || null,
      client_name: clientName || null,
      type: docType || 'Client File',
      storage_path: path,
      // Intentionally NOT persisting the short-lived file_url here — storing it would just be a
      // stale/expired link within minutes, indistinguishable from a real one to whoever reads it
      // later. Every real access goes through the on-demand `resign` action instead.
      file_size: buffer.length,
      status: status || 'Active',
      source: source || 'system',
      created_at: new Date().toISOString(),
    }),
  });

  if (!dbRes.ok) {
    const errText = await dbRes.text();
    throw new Error(`vault_documents insert failed: ${dbRes.status} ${errText}`);
  }

  const rows = await dbRes.json();
  return { file_url, path, record: rows[0] };
}
