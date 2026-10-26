import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, X, Loader2, FileSignature, Send, Download, Link2, Check, Save, PencilLine, AlertCircle } from 'lucide-react'
import { CONTRACT_TYPES } from '../../data/contractTemplates'
import { authedFetch } from '../../lib/apiAuth'

// Contract composer (repair 2026-10-26). Drafts save to the server and reopen; a failed send keeps the text on screen
// with a specific message; the result says exactly what happened to the signing-link email (dry run, sent, blocked,
// failed) and offers the link. Unsent text is also kept in this browser until it is saved or sent.
const GOLD = '#C9A84C'
const INK = '#0A0A0A'
const PAPER = '#FAFAFA'
const LOCAL_KEY = 'nova.contracts.unsaved'

const inp = {
  width: '100%', padding: '11px 13px', fontSize: 14, minHeight: 44,
  background: 'rgba(250,250,250,0.04)', border: '1px solid rgba(250,250,250,0.12)',
  borderRadius: 8, color: PAPER, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(250,250,250,0.55)', marginBottom: 7 }
const btnPrimary = { minHeight: 44, padding: '0 18px', background: GOLD, border: 'none', borderRadius: 8, color: INK, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }
const btnQuiet = { ...btnPrimary, background: 'transparent', color: PAPER, border: '1px solid rgba(250,250,250,0.2)' }
const iconBtn = { width: 40, height: 40, borderRadius: 8, background: 'rgba(250,250,250,0.06)', border: '1px solid rgba(250,250,250,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(250,250,250,0.7)', cursor: 'pointer' }

const STATUS = {
  draft: { label: 'Draft', color: 'rgba(250,250,250,0.7)', bg: 'rgba(250,250,250,0.08)' },
  pending: { label: 'Awaiting signature', color: GOLD, bg: 'rgba(201,168,76,0.12)' },
  signed: { label: 'Signed', color: '#86efac', bg: 'rgba(34,197,94,0.12)' },
}
const DELIVERY = { sent: 'Email accepted by provider', dry_run: 'Not emailed (dry run)', blocked: 'Not emailed (blocked)', failed: 'Email failed' }

const emptyForm = { client_name: '', client_email: '', contract_type: '', custom_notes: '' }
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null') } catch { return null } }
const writeLocal = (v) => { try { v ? localStorage.setItem(LOCAL_KEY, JSON.stringify(v)) : localStorage.removeItem(LOCAL_KEY) } catch { /* storage unavailable */ } }

export default function Contracts() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [draftId, setDraftId] = useState(null)
  const [busy, setBusy] = useState('') // 'save' | 'send' | ''
  const [message, setMessage] = useState(null) // { kind: 'error'|'saved'|'sent', text, link? }
  const [statusFilter, setStatusFilter] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const busyRef = useRef(false)

  const load = async () => {
    setLoading(true); setLoadError('')
    try {
      const r = await authedFetch('/api/contracts?action=list')
      const data = await r.json().catch(() => null)
      if (!r.ok || !Array.isArray(data)) throw new Error((data && data.error) || `HTTP ${r.status}`)
      setContracts(data)
    } catch (e) { setLoadError(`Contracts could not be loaded (${e.message}). Reload to try again.`) }
    setLoading(false)
  }
  useEffect(() => {
    load()
    const saved = readLocal()
    if (saved?.form && Object.values(saved.form).some(Boolean)) {
      setForm({ ...emptyForm, ...saved.form }); setDraftId(saved.draftId || null); setOpen(true)
      setMessage({ kind: 'saved', text: 'Restored text you had not saved or sent yet.' })
    }
  }, [])
  useEffect(() => { if (open) writeLocal({ form, draftId }) }, [form, draftId, open])

  const filtered = useMemo(() => (statusFilter ? contracts.filter((c) => c.status === statusFilter) : contracts), [contracts, statusFilter])
  const counts = useMemo(() => ({
    draft: contracts.filter((c) => c.status === 'draft').length,
    pending: contracts.filter((c) => c.status === 'pending').length,
    signed: contracts.filter((c) => c.status === 'signed').length,
  }), [contracts])

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); if (message?.kind !== 'error') setMessage(null) }
  const canSend = form.client_name.trim() && form.client_email.trim() && form.contract_type
  const missing = [!form.client_name.trim() && 'client name', !form.client_email.trim() && 'client email', !form.contract_type && 'contract type'].filter(Boolean)

  const call = async (action, body) => {
    const r = await authedFetch(`/api/contracts?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error || `The server answered ${r.status}.`)
    return data
  }

  const saveDraft = async () => {
    if (busyRef.current) return
    busyRef.current = true; setBusy('save'); setMessage(null)
    try {
      const data = await call('save_draft', { ...form, id: draftId || undefined })
      setDraftId(data.contract.id)
      setMessage({ kind: 'saved', text: `Draft saved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. It stays in the list until you send it.` })
      load()
    } catch (e) { setMessage({ kind: 'error', text: `Draft not saved: ${e.message}` }) }
    busyRef.current = false; setBusy('')
  }

  const send = async () => {
    if (busyRef.current || !canSend) return
    busyRef.current = true; setBusy('send'); setMessage(null)
    try {
      const data = await call('create', { ...form, draft_id: draftId || undefined })
      writeLocal(null)
      setForm(emptyForm); setDraftId(null); setOpen(false); setStatusFilter('')
      setMessage({ kind: 'sent', text: `${data.already_sent ? 'Already sent earlier. ' : 'Contract sent for signature. '}${data.delivery?.note || ''}`, link: data.sign_link, id: data.contract?.id })
      load()
    } catch (e) { setMessage({ kind: 'error', text: `Not sent: ${e.message} Your text is still here.` }) }
    busyRef.current = false; setBusy('')
  }

  const openDraft = (c) => {
    setForm({ client_name: c.client_name || '', client_email: c.client_email || '', contract_type: c.contract_type || '', custom_notes: c.custom_notes || '' })
    setDraftId(c.id); setOpen(true); setMessage(null)
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }
  const close = () => { setOpen(false); setForm(emptyForm); setDraftId(null); writeLocal(null); setMessage(null) }

  const copyLink = async (id, link) => {
    const url = link || `${window.location.origin}/sign/${id}`
    try { await navigator.clipboard.writeText(url); setCopiedId(id) } catch { window.prompt?.('Copy this signing link', url) }
    setTimeout(() => setCopiedId(''), 2000)
  }
  const downloadPdf = async (c) => {
    try {
      const r = await authedFetch(`/api/contracts?action=pdf&id=${encodeURIComponent(c.id)}`)
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `HTTP ${r.status}`) }
      const blob = await r.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `nova-contract-${c.id.slice(0, 8)}.pdf`; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (e) { setMessage({ kind: 'error', text: `PDF not downloaded: ${e.message}` }) }
  }

  const standard = ['Digital Foundation', 'Sales Representative Agreement'].includes(form.contract_type)

  return (
    <div className="nova-page" style={{ padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 48px) 80px', maxWidth: 1100, color: PAPER }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <p style={{ color: GOLD, fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Agreements</p>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>Contracts</h1>
          <p style={{ color: 'rgba(250,250,250,0.55)', fontSize: 14, marginTop: 6 }}>
            {counts.draft} draft · {counts.pending} awaiting signature · {counts.signed} signed
          </p>
        </div>
        {!open && <button type="button" onClick={() => { setOpen(true); setMessage(null) }} style={btnPrimary}><Plus size={16} /> New contract</button>}
      </header>

      {message && (
        <div role={message.kind === 'error' ? 'alert' : 'status'} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 10, marginBottom: 18, border: `1px solid ${message.kind === 'error' ? 'rgba(248,113,113,0.4)' : 'rgba(201,168,76,0.35)'}`, background: message.kind === 'error' ? 'rgba(248,113,113,0.08)' : 'rgba(201,168,76,0.07)' }}>
          {message.kind === 'error' ? <AlertCircle size={18} color="#fca5a5" style={{ flexShrink: 0, marginTop: 1 }} /> : <Check size={18} color={GOLD} style={{ flexShrink: 0, marginTop: 1 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{message.text}</p>
            {message.link && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                <code style={{ fontSize: 12, color: 'rgba(250,250,250,0.7)', wordBreak: 'break-all' }}>{message.link}</code>
                <button type="button" onClick={() => copyLink(message.id, message.link)} style={{ ...btnQuiet, minHeight: 36, padding: '0 12px', fontSize: 13 }}>{copiedId === message.id ? <><Check size={14} /> Copied</> : <><Link2 size={14} /> Copy link</>}</button>
              </div>
            )}
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', color: 'rgba(250,250,250,0.5)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
        </div>
      )}

      {open && (
        <section aria-label="Contract composer" style={{ background: 'rgba(250,250,250,0.03)', border: '1px solid rgba(250,250,250,0.1)', borderRadius: 14, padding: 'clamp(16px, 3vw, 28px)', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{draftId ? 'Edit draft' : 'New contract'}</h2>
            <button type="button" aria-label="Close composer" onClick={close} style={{ ...iconBtn, background: 'transparent', border: 'none' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <label><span style={lbl}>Client name</span><input value={form.client_name} onChange={set('client_name')} style={inp} placeholder="Full legal name" autoComplete="off" /></label>
              <label><span style={lbl}>Client email</span><input type="email" inputMode="email" value={form.client_email} onChange={set('client_email')} style={inp} placeholder="client@business.com" autoComplete="off" /></label>
            </div>
            <label><span style={lbl}>Contract type</span>
              <select value={form.contract_type} onChange={set('contract_type')} style={{ ...inp, cursor: 'pointer' }}>
                <option value="" style={{ background: '#111' }}>Choose a contract type…</option>
                {CONTRACT_TYPES.map((t) => <option key={t} value={t} style={{ background: '#111' }}>{t === 'Digital Foundation' ? 'Digital Foundation — $320' : t}</option>)}
              </select>
            </label>
            <label><span style={lbl}>{standard ? 'Notes (optional, not shown on the standard agreement)' : 'Scope and terms (shown on the contract)'}</span>
              <textarea rows={5} value={form.custom_notes} onChange={set('custom_notes')} style={{ ...inp, resize: 'vertical', minHeight: 120 }} placeholder={standard ? 'Private notes for this client…' : 'Describe the scope, price and terms…'} />
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={send} disabled={!!busy || !canSend} aria-disabled={!!busy || !canSend} style={{ ...btnPrimary, opacity: !canSend ? 0.45 : 1, cursor: busy || !canSend ? 'default' : 'pointer' }}>
                {busy === 'send' ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <><Send size={16} /> Send for signature</>}
              </button>
              <button type="button" onClick={saveDraft} disabled={!!busy} style={btnQuiet}>
                {busy === 'save' ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> Save draft</>}
              </button>
              {!canSend && <span style={{ fontSize: 13, color: 'rgba(250,250,250,0.55)' }}>To send, add the {missing.join(', ')}.</span>}
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}><Loader2 size={26} color={GOLD} className="animate-spin" style={{ margin: '0 auto' }} /></div>
      ) : loadError ? (
        <p role="alert" style={{ color: '#fca5a5', fontSize: 14 }}>{loadError}</p>
      ) : contracts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', border: '1px solid rgba(250,250,250,0.08)', borderRadius: 12 }}>
          <FileSignature size={32} color="rgba(250,250,250,0.25)" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'rgba(250,250,250,0.6)', fontSize: 14 }}>No contracts yet. Use “New contract” to draft one.</p>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Filter by status" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[['', 'All'], ['draft', 'Drafts'], ['pending', 'Awaiting signature'], ['signed', 'Signed']].map(([v, l]) => (
              <button key={v || 'all'} type="button" onClick={() => setStatusFilter(v)} aria-pressed={statusFilter === v} style={{ minHeight: 36, padding: '0 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${statusFilter === v ? GOLD : 'rgba(250,250,250,0.15)'}`, background: statusFilter === v ? 'rgba(201,168,76,0.12)' : 'transparent', color: statusFilter === v ? GOLD : 'rgba(250,250,250,0.75)' }}>{l}</button>
            ))}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid rgba(250,250,250,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            {filtered.map((c) => {
              const st = STATUS[c.status] || STATUS.pending
              return (
                <li key={c.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(250,250,250,0.06)' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.client_name || 'Unnamed draft'}</p>
                    <p style={{ fontSize: 13, color: 'rgba(250,250,250,0.55)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.client_email || 'no email yet'} · {c.contract_type || 'no type yet'}</p>
                  </div>
                  <div style={{ flex: '0 1 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.color, width: 'fit-content' }}>{st.label}</span>
                    {c.status !== 'draft' && c.delivery_status && <span style={{ fontSize: 12, color: 'rgba(250,250,250,0.5)' }}>{DELIVERY[c.delivery_status] || c.delivery_status}</span>}
                  </div>
                  <div style={{ flex: '0 1 150px', fontSize: 13, color: 'rgba(250,250,250,0.55)' }}>
                    {c.status === 'draft' ? `Edited ${fmtDate(c.updated_at || c.created_at)}` : c.status === 'signed' ? `Signed ${fmtDate(c.signed_at)}` : `Sent ${fmtDate(c.sent_at)}`}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    {c.status === 'draft' ? (
                      <button type="button" onClick={() => openDraft(c)} style={{ ...btnQuiet, minHeight: 40, fontSize: 13 }}><PencilLine size={14} /> Continue</button>
                    ) : (
                      <button type="button" onClick={() => copyLink(c.id)} aria-label={`Copy signing link for ${c.client_name}`} title="Copy signing link" style={{ ...iconBtn, color: copiedId === c.id ? '#86efac' : iconBtn.color }}>{copiedId === c.id ? <Check size={15} /> : <Link2 size={15} />}</button>
                    )}
                    {c.status === 'signed' && c.pdf_url && (
                      <button type="button" onClick={() => downloadPdf(c)} aria-label={`Download signed PDF for ${c.client_name}`} title="Download signed PDF" style={iconBtn}><Download size={15} /></button>
                    )}
                  </div>
                </li>
              )
            })}
            {filtered.length === 0 && <li style={{ padding: 18, fontSize: 14, color: 'rgba(250,250,250,0.55)' }}>No contracts with this status.</li>}
          </ul>
        </>
      )}
    </div>
  )
}
