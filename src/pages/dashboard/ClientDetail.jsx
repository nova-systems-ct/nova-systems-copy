import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Plus, Check, X, Edit2, Save, Sparkles, Send, Loader2 } from 'lucide-react'
import { getClient, updateClient, getInvoices, addInvoice, updateInvoice, getDocuments, saveDocument } from '../../lib/crmStore'
import DocumentGeneratorModal from '../../components/dashboard/DocumentGeneratorModal'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

const TABS = ['Overview', 'Website', 'Services', 'Invoices', 'Documents', 'Notes', 'Messages']

const STATUS_CFG = {
  active:   { label: 'Active',   color: '#4ade80', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)' },
  inactive: { label: 'Inactive', color: '#f87171', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
  prospect: { label: 'Prospect', color: GOLD,      bg: `${GOLD}14`,             border: `${GOLD}35` },
}

function Badge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.active
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 20, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{c.label}</span>
}

function InfoRow({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', width: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{value}</span>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [invoices, setInvoices] = useState([])
  const [docs, setDocs] = useState([])
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [invModal, setInvModal] = useState(false)
  const [invForm, setInvForm] = useState({ description: '', amount: '', due_date: '', paid: false })
  const [docModal, setDocModal] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgError, setMsgError] = useState('')
  const [msgSuccess, setMsgSuccess] = useState(false)
  const [msgHistory, setMsgHistory] = useState([])

  useEffect(() => {
    const c = getClient(id)
    if (!c) { navigate('/dashboard/clients'); return }
    setClient(c)
    setNotes(c.notes || '')
    setInvoices(getInvoices(id))
    setDocs(getDocuments({ client_id: id }))
    // Load message history from localStorage (Supabase messages also appear here when fetched)
    try {
      const all = JSON.parse(localStorage.getItem('nova_client_messages') || '[]')
      setMsgHistory(all.filter(m => m.client_id === id))
    } catch {}
  }, [id])

  const sendMessage = async () => {
    if (!msgText.trim()) return
    if (!client?.email) { setMsgError('No email on file for this client.'); return }
    setMsgSending(true)
    setMsgError('')
    try {
      const r = await fetch('/api/send-client-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: id,
          client_name: client.name,
          client_email: client.email,
          message: msgText.trim(),
        }),
      })
      const d = await r.json()
      if (!r.ok || d.error) { setMsgError(d.error || 'Send failed'); setMsgSending(false); return }
      const entry = { client_id: id, message: msgText.trim(), sent_at: new Date().toISOString(), id: Date.now().toString(), ...(d.message || {}) }
      const all = JSON.parse(localStorage.getItem('nova_client_messages') || '[]')
      const updated = [entry, ...all]
      localStorage.setItem('nova_client_messages', JSON.stringify(updated))
      setMsgHistory(updated.filter(m => m.client_id === id))
      setMsgText('')
      setMsgSuccess(true)
      setTimeout(() => setMsgSuccess(false), 2500)
    } catch (err) {
      setMsgError(err.message || 'Send failed')
    }
    setMsgSending(false)
  }

  if (!client) return null

  const saveNotes = () => {
    updateClient(id, { notes })
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  const toggleService = (svc) => {
    const services = client.services || []
    const updated = services.includes(svc) ? services.filter(s => s !== svc) : [...services, svc]
    updateClient(id, { services: updated })
    setClient(c => ({ ...c, services: updated }))
  }

  const addInv = e => {
    e.preventDefault()
    const inv = addInvoice({ client_id: id, ...invForm, amount: parseFloat(invForm.amount) || 0, client_name: client.name })
    setInvoices(getInvoices(id))
    setInvModal(false)
    setInvForm({ description: '', amount: '', due_date: '', paid: false })
  }

  const togglePaid = (invId, paid) => {
    updateInvoice(invId, { paid: !paid })
    setInvoices(getInvoices(id))
  }

  const ALL_SERVICES = ['Custom Website', 'Supabase CMS', 'Admin Dashboard', 'Email via Resend', 'Social Media Management', 'SEO', 'Google Ads', 'Newsletter', 'Mobile App', 'CRM Setup']

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      {/* Back */}
      <button onClick={() => navigate('/dashboard/clients')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 24, padding: 0, fontFamily: 'inherit' }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> All Clients
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: `${GOLD}14`, border: `1px solid ${GOLD}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: GOLD, flexShrink: 0 }}>
            {client.name[0]}
          </div>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>{client.name}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{client.industry}</span>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
              <Badge status={client.status || 'active'} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {client.website && (
            <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.5)', fontSize: 12, textDecoration: 'none' }}>
              <ExternalLink style={{ width: 13, height: 13 }} /> Visit Site
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 32 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? GOLD : 'transparent'}`, color: tab === t ? GOLD : 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: tab === t ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', marginBottom: -1 }}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16 }}>Contact</p>
            <InfoRow label="Owner" value={client.owner_name} />
            <InfoRow label="Email" value={client.email && <a href={`mailto:${client.email}`} style={{ color: '#60a5fa' }}>{client.email}</a>} />
            <InfoRow label="Phone" value={client.phone} />
            <InfoRow label="Website" value={client.website && <a href={client.website} target="_blank" rel="noreferrer" style={{ color: GOLD }}>{client.website}</a>} />
            <InfoRow label="Domain" value={client.domain} />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 24 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16 }}>Contract</p>
            <InfoRow label="Monthly Rate" value={client.monthly_rate === 0 ? 'Pro bono / $0' : `$${client.monthly_rate}/mo`} />
            <InfoRow label="Start Date" value={client.contract_start} />
            <InfoRow label="Status" value={<Badge status={client.status || 'active'} />} />
            <div style={{ marginTop: 16 }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Services</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(client.services || []).map(s => (
                  <span key={s} style={{ fontSize: 11, padding: '4px 10px', background: `${GOLD}10`, border: `1px solid ${GOLD}25`, borderRadius: 5, color: GOLD }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Website */}
      {tab === 'Website' && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 28 }}>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 20 }}>Website Details</p>
          <InfoRow label="URL" value={client.website && <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" style={{ color: GOLD }}>{client.website}</a>} />
          <InfoRow label="Domain" value={client.domain} />
          <InfoRow label="Hosting Status" value={client.hosting_status || 'Live'} />
          <InfoRow label="Last Updated" value={client.last_updated || '—'} />
        </div>
      )}

      {/* Services */}
      {tab === 'Services' && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 28 }}>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 20 }}>Active Services</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ALL_SERVICES.map(svc => {
              const on = (client.services || []).includes(svc)
              return (
                <div key={svc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: on ? `${GOLD}08` : 'rgba(255,255,255,0.025)', border: `1px solid ${on ? GOLD + '25' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8 }}>
                  <span style={{ color: on ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 13 }}>{svc}</span>
                  <button onClick={() => toggleService(svc)} style={{ width: 26, height: 26, borderRadius: 6, background: on ? G : 'rgba(255,255,255,0.05)', border: `1px solid ${on ? 'transparent' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Check style={{ width: 12, height: 12, color: '#0a0800' }} /> : <Plus style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.3)' }} />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Invoices */}
      {tab === 'Invoices' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button onClick={() => setInvModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Plus style={{ width: 13, height: 13 }} /> Generate Invoice
            </button>
          </div>
          {invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No invoices yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {invoices.map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{inv.description}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>Due: {inv.due_date || 'No date'}</p>
                  </div>
                  <span style={{ color: GOLD, fontSize: 16, fontWeight: 700 }}>${inv.amount}</span>
                  <button onClick={() => togglePaid(inv.id, inv.paid)} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 20, border: `1px solid ${inv.paid ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.15)'}`, background: inv.paid ? 'rgba(34,197,94,0.1)' : 'transparent', color: inv.paid ? '#4ade80' : 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {inv.paid ? 'Paid' : 'Unpaid'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {invModal && (
            <Modal title="New Invoice" onClose={() => setInvModal(false)}>
              <form onSubmit={addInv} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Description *"><input required value={invForm.description} onChange={e => setInvForm(f => ({ ...f, description: e.target.value }))} style={inp} placeholder="Monthly retainer — June 2026" /></Field>
                <Row2>
                  <Field label="Amount ($) *"><input required type="number" value={invForm.amount} onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))} style={inp} placeholder="0" /></Field>
                  <Field label="Due Date"><input type="date" value={invForm.due_date} onChange={e => setInvForm(f => ({ ...f, due_date: e.target.value }))} style={inp} /></Field>
                </Row2>
                <button type="submit" style={{ padding: 12, background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Create Invoice</button>
              </form>
            </Modal>
          )}
        </div>
      )}

      {/* Documents */}
      {tab === 'Documents' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button onClick={() => setDocModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Sparkles style={{ width: 13, height: 13 }} /> Generate with AI
            </button>
          </div>
          {docModal && (
            <DocumentGeneratorModal
              clientId={id}
              entityName={client.name}
              industry={client.industry}
              onClose={() => setDocModal(false)}
              onSaved={() => setDocs(getDocuments({ client_id: id }))}
            />
          )}
          {docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No documents yet. Generate one from the Documents page.</p>
            </div>
          ) : docs.map(d => (
            <div key={d.id} style={{ padding: '14px 18px', marginBottom: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{d.type}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{new Date(d.created_at).toLocaleDateString()}</p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: d.sent ? 'rgba(34,197,94,0.1)' : `${GOLD}10`, color: d.sent ? '#4ade80' : GOLD, border: `1px solid ${d.sent ? 'rgba(34,197,94,0.3)' : GOLD + '30'}` }}>{d.sent ? 'Sent' : 'Draft'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {tab === 'Notes' && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 28 }}>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16 }}>Client Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={14}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.7, fontSize: 13 }}
            placeholder="Add notes about this client…"
          />
          <button onClick={saveNotes} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: notesSaved ? 'rgba(34,197,94,0.15)' : G, border: notesSaved ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius: 7, color: notesSaved ? '#4ade80' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' }}>
            {notesSaved ? <><Check style={{ width: 13, height: 13 }} /> Saved</> : <><Save style={{ width: 13, height: 13 }} /> Save Notes</>}
          </button>
        </div>
      )}

      {/* Messages */}
      {tab === 'Messages' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Send Update */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 26 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 4 }}>Send Update</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 18 }}>
              Send an email directly to {client.name} at <span style={{ color: '#60a5fa' }}>{client.email || '(no email on file)'}</span>
            </p>
            {!client.email && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, marginBottom: 16 }}>
                <p style={{ color: '#f87171', fontSize: 12 }}>No email address on file. Add one in the Overview tab.</p>
              </div>
            )}
            <textarea
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              rows={6}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.7, marginBottom: 12 }}
              placeholder={`Hi ${client.name.split(' ')[0]},\n\nHere's an update on your project…`}
            />
            {msgError && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{msgError}</p>}
            {msgSuccess && <p style={{ color: '#4ade80', fontSize: 12, marginBottom: 10 }}>Message sent successfully.</p>}
            <button onClick={sendMessage} disabled={msgSending || !msgText.trim() || !client.email}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', background: msgSending || !msgText.trim() || !client.email ? '#161410' : G, border: msgSending || !msgText.trim() || !client.email ? '1px solid rgba(255,255,255,0.07)' : 'none', borderRadius: 8, color: msgSending || !msgText.trim() || !client.email ? 'rgba(255,255,255,0.25)' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: msgSending || !msgText.trim() || !client.email ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {msgSending ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> Sending…</> : <><Send style={{ width: 13, height: 13 }} /> Send to Client</>}
            </button>
          </div>

          {/* History */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 26 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 18 }}>Communication History</p>
            {msgHistory.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>No messages sent yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {msgHistory.map((m, i) => (
                  <div key={m.id || i} style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9 }}>
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 8 }}>{m.message}</p>
                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
                      Sent {new Date(m.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return <div><label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }}>{label}</label>{children}</div>
}
function Row2({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div> }
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 480, background: '#0d0c09', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
