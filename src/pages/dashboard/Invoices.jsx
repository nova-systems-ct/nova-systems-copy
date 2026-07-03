import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Trash2, Loader2, Receipt, Send, Eye, CheckCircle2, Download } from 'lucide-react'
import { getClients } from '../../lib/crmStore'
import { generateInvoicePDF } from '../../utils/generatePdf'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`

const inp = {
  width: '100%', padding: '10px 13px', fontSize: 13,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }

const STATUS_COLORS = { Paid: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' }, Unpaid: { bg: `${GOLD}15`, color: GOLD }, Overdue: { bg: 'rgba(239,68,68,0.12)', color: '#f87171' } }

function nextInvoiceNumber(existing) {
  const year = new Date().getFullYear()
  const countThisYear = existing.filter(i => (i.invoice_number || '').includes(`INV-${year}-`)).length
  return `INV-${year}-${String(countThisYear + 1).padStart(4, '0')}`
}

const emptyForm = { client_id: '', client_name: '', client_email: '', line_items: [{ description: '', amount: '', quantity: 1 }], due_date: '', notes: '', deposit_amount: '' }

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const clients = getClients()

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/invoices')
      const data = await r.json()
      setInvoices(Array.isArray(data) ? data : [])
    } catch { setInvoices([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const outstanding = invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + (Number(i.total) || 0), 0)
    const thisMonth = invoices.filter(i => i.status === 'Paid' && i.paid_at && new Date(i.paid_at).getMonth() === new Date().getMonth()).reduce((s, i) => s + (Number(i.total) || 0), 0)
    const overdue = invoices.filter(i => i.status === 'Unpaid' && i.due_date && new Date(i.due_date) < new Date()).length
    const avg = invoices.length ? invoices.reduce((s, i) => s + (Number(i.total) || 0), 0) / invoices.length : 0
    return { outstanding, thisMonth, overdue, avg }
  }, [invoices])

  const subtotal = form.line_items.reduce((s, li) => s + (Number(li.amount) || 0) * (Number(li.quantity) || 1), 0)
  const tax = 0
  const total = subtotal + tax

  const setLineItem = (i, patch) => setForm(f => ({ ...f, line_items: f.line_items.map((li, idx) => idx === i ? { ...li, ...patch } : li) }))
  const addLineItem = () => setForm(f => ({ ...f, line_items: [...f.line_items, { description: '', amount: '', quantity: 1 }] }))
  const removeLineItem = (i) => setForm(f => ({ ...f, line_items: f.line_items.filter((_, idx) => idx !== i) }))

  const selectClient = (id) => {
    const c = clients.find(c => c.id === id)
    setForm(f => ({ ...f, client_id: id, client_name: c?.name || '', client_email: c?.email || '' }))
  }

  const sendInvoice = async () => {
    if (!form.client_name || subtotal <= 0) return
    setSending(true)
    const invoice_number = nextInvoiceNumber(invoices)
    try {
      const doc = generateInvoicePDF({
        invoiceNumber: invoice_number, clientName: form.client_name, clientEmail: form.client_email,
        lineItems: form.line_items, subtotal, tax, total, dueDate: form.due_date, notes: form.notes,
      })
      const pdfDataUri = doc.output('datauristring')

      let pay_link = ''
      try {
        const cs = await fetch('/api/create-checkout-session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: total, client_email: form.client_email, description: `Invoice ${invoice_number} — Nova Systems` }),
        })
        const csData = await cs.json()
        if (cs.ok) pay_link = csData.url
      } catch {}

      let invoice_pdf_url = ''
      try {
        const vaultRes = await fetch('/api/vault-upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_base64: pdfDataUri, file_name: `${invoice_number}.pdf`, category: 'invoices', client_id: form.client_id, client_name: form.client_name, doc_type: 'Invoice', status: 'Pending' }),
        })
        const vaultData = await vaultRes.json()
        if (vaultRes.ok) invoice_pdf_url = vaultData.file_url
      } catch {}

      await fetch('/api/invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', client_id: form.client_id, invoice_number, line_items: form.line_items, subtotal, tax, total, deposit_amount: form.deposit_amount || null, due_date: form.due_date || null, notes: form.notes, status: 'Unpaid', stripe_payment_link: pay_link, invoice_pdf_url }),
      })

      if (form.client_email) {
        await fetch('/api/send-invoice', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_email: form.client_email, client_name: form.client_name, invoice_number, total, due_date: form.due_date, pay_link, pdf_base64: pdfDataUri }),
        })
      }

      setCreating(false)
      setPreviewOpen(false)
      setForm(emptyForm)
      load()
    } catch (e) {
      alert('Failed to send invoice: ' + e.message)
    }
    setSending(false)
  }

  const markPaid = async (inv) => {
    await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: inv.id, ...inv, status: 'Paid' }) })
    load()
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Billing</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Invoices</h1>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus style={{ width: 14, height: 14 }} /> Create Invoice
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 32 }}>
        <StatCard label="Total Outstanding" value={`$${stats.outstanding.toLocaleString()}`} />
        <StatCard label="Paid This Month" value={`$${stats.thisMonth.toLocaleString()}`} />
        <StatCard label="Overdue" value={stats.overdue} />
        <StatCard label="Average Invoice Value" value={`$${stats.avg.toFixed(0)}`} />
      </div>

      {creating ? (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>New Invoice</p>
            <button onClick={() => { setCreating(false); setForm(emptyForm) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>Client</label>
                <select value={form.client_id} onChange={e => selectClient(e.target.value)} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  <option value="" style={{ background: '#111' }}>Select a client…</option>
                  {clients.map(c => <option key={c.id} value={c.id} style={{ background: '#111' }}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Client Email</label>
                <input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} style={inp} placeholder="client@email.com" />
              </div>
            </div>

            <div>
              <label style={lbl}>Line Items</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.line_items.map((li, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', gap: 8 }}>
                    <input value={li.description} onChange={e => setLineItem(i, { description: e.target.value })} style={inp} placeholder="Description" />
                    <input type="number" min="1" value={li.quantity} onChange={e => setLineItem(i, { quantity: e.target.value })} style={inp} placeholder="Qty" />
                    <input type="number" value={li.amount} onChange={e => setLineItem(i, { amount: e.target.value })} style={inp} placeholder="$0.00" />
                    <button onClick={() => removeLineItem(i)} disabled={form.line_items.length === 1} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, color: '#f87171', cursor: 'pointer' }}><Trash2 style={{ width: 13, height: 13, margin: 'auto' }} /></button>
                  </div>
                ))}
              </div>
              <button onClick={addLineItem} style={{ marginTop: 8, fontSize: 11, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Plus style={{ width: 12, height: 12 }} /> Add line item
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>Due Date</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Deposit Amount (optional)</label>
                <input type="number" value={form.deposit_amount} onChange={e => setForm(f => ({ ...f, deposit_amount: e.target.value }))} style={inp} placeholder="$0.00" />
              </div>
            </div>
            <div>
              <label style={lbl}>Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inp, resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Total</p>
              <p style={{ color: GOLD, fontSize: 20, fontWeight: 800 }}>${total.toFixed(2)}</p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setPreviewOpen(true)} disabled={!form.client_name || subtotal <= 0} style={{ flex: 1, padding: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Eye style={{ width: 14, height: 14 }} /> Preview
              </button>
              <button onClick={sendInvoice} disabled={sending || !form.client_name || subtotal <= 0} style={{ flex: 1, padding: 13, background: G, border: 'none', borderRadius: 9, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: sending ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {sending ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <><Send style={{ width: 14, height: 14 }} /> Send to Client</>}
              </button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : invoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <Receipt style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No invoices yet. Click "Create Invoice" to bill your first client.</p>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 120px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Invoice #', 'Client', 'Amount', 'Due Date', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</span>
            ))}
          </div>
          {invoices.map(inv => {
            const sc = STATUS_COLORS[inv.status] || STATUS_COLORS.Unpaid
            return (
              <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 120px', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{inv.invoice_number}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{clients.find(c => c.id === inv.client_id)?.name || '—'}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>${Number(inv.total || 0).toLocaleString()}</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{inv.due_date || '—'}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: sc.bg, color: sc.color, width: 'fit-content', textTransform: 'uppercase' }}>{inv.status}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {inv.invoice_pdf_url && (
                    <a href={inv.invoice_pdf_url} target="_blank" rel="noreferrer" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}><Download style={{ width: 12, height: 12 }} /></a>
                  )}
                  {inv.status !== 'Paid' && (
                    <button onClick={() => markPaid(inv)} title="Mark Paid" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', cursor: 'pointer' }}><CheckCircle2 style={{ width: 12, height: 12 }} /></button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }} onClick={e => e.target === e.currentTarget && setPreviewOpen(false)}>
          <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 12, padding: 32, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ color: '#000', fontWeight: 800, fontSize: 18 }}>NOVA SYSTEMS</p>
              <button onClick={() => setPreviewOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: 18, height: 18, color: '#000' }} /></button>
            </div>
            <p style={{ color: '#333', fontSize: 13, marginBottom: 6 }}>Bill To: {form.client_name}</p>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>{form.client_email}</p>
            {form.line_items.map((li, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 13, color: '#333' }}>
                <span>{li.description || 'Item'} × {li.quantity}</span>
                <span>${((Number(li.amount) || 0) * (Number(li.quantity) || 1)).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontWeight: 800, fontSize: 16, color: '#000' }}>
              <span>Total</span><span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 12, padding: '20px 22px' }}>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</p>
      <p style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{value}</p>
    </div>
  )
}
