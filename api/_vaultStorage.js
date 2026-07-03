// Shared helper for uploading files into the nova-vault Supabase storage bucket
// and indexing them in the vault_documents table. Used by vault-upload.js and
// welcome-complete.js.

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

  const file_url = `${SUPABASE_URL}/storage/v1/object/public/nova-vault/${path}`;

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
