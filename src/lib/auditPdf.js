import { authedFetch } from './apiAuth'

// Download (or open) a stored PDF through the app. Works where only the app is reachable (iPad on the local Wi-Fi route).
export async function fetchPdf({ org, caseId, documentId, fileName, open = false }) {
  const win = open ? window.open('', '_blank') : null // opened synchronously so the browser does not block it
  const qs = new URLSearchParams({ resource: 'audit', op: 'pdf-file', organization_id: org, case_id: caseId, document_id: documentId, ...(open ? { inline: '1' } : {}) })
  const r = await authedFetch(`/api/client?${qs}`)
  if (!r.ok) { win?.close(); const j = await r.json().catch(() => ({})); throw new Error(j.error || `The server answered ${r.status}.`) }
  const url = URL.createObjectURL(await r.blob())
  if (win) win.location.href = url
  else { const a = document.createElement('a'); a.href = url; a.download = fileName || 'nova-audit.pdf'; document.body.appendChild(a); a.click(); a.remove() }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
