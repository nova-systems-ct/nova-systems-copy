// Shared helper for uploading files into the nova-vault Supabase storage bucket
// and indexing them in the vault_documents table. Used by vault-upload.js and
// welcome-complete.js.
//
// Repair task (2026-09-23): the `nova-vault` bucket this uploads into does not actually exist in
// production yet (confirmed live via the Storage Admin API — 404 "Bucket not found") and, once
// created, must be PRIVATE — it holds invoices, signed contracts, and generated documents, all
// real client/business PII. The old code here constructed a permanent PUBLIC object URL, which
// would have been wrong the moment the bucket existed (this file's uploads have always silently
// failed, so nothing public has actually leaked). Now generates a signed URL at upload time
// instead — long enough (30 days) to cover the immediate "email a client their invoice" use case
// that already exists in this codebase, without ever being a permanent public link. Callers that
// need a fresh link later (e.g. an old vault item whose signed URL has expired) should generate a
// new one the same way, via `signVaultUrl` below, rather than trust a stored `file_url` forever.

export async function signVaultUrl(SUPABASE_URL, SUPABASE_SERVICE_KEY, path, expiresInSeconds = 60 * 60 * 24 * 30) {
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
      file_url,
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
