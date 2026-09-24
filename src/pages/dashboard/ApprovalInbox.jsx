import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, Undo2, Plus, X, Loader2, ShieldAlert, Clock } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`
const inp = { width: '100%', padding: '10px 13px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }

const TYPE_LABEL = {
  audit_report: 'Audit Report',
  zion_video: 'Zion Video',
  installation: 'Installation',
  spending: 'Spending',
  pricing_exception: 'Pricing Exception',
  content: 'Content',
}

// Approval Inbox (master prompt §19) — aggregates pending Audit report approvals, Zion video
// review, and generic consequential-action requests (installations, spending, pricing exceptions)
// into one real inbox. Does not retrofit audit_reports/zion_videos' own approval logic — those
// keep their existing, independently tested flows; this page's approve/reject buttons for those
// two item types call straight through to the SAME endpoints already covered by
// scripts/e2e_crm_order_audit_test.mjs / scripts/e2e_zion_studio_test.mjs, not a duplicate path.
export default function ApprovalInbox() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ item_type: 'installation', action_summary: '', destination: '', cost_cents: '', content_version: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await authedFetch('/api/client?resource=approvals')
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load approvals')
      setItems(await r.json())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (item, action) => {
    setActing(item.item_id + action)
    try {
      const { resource, op, body } = item.approve_action
      const query = op ? `resource=${resource}&op=${op}` : `resource=${resource}`
      const r = await authedFetch(`/api/client?${query}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, action }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || `Failed to ${action}`)
      await load()
    } catch (e) {
      alert(e.message)
    }
    setActing(null)
  }

  const createRequest = async () => {
    if (!form.item_type || !form.action_summary) return
    setSaving(true)
    try {
      const r = await authedFetch('/api/client?resource=approvals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...form, cost_cents: form.cost_cents ? Number(form.cost_cents) * 100 : null }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to create request')
      setCreateOpen(false)
      setForm({ item_type: 'installation', action_summary: '', destination: '', cost_cents: '', content_version: '' })
      await load()
    } catch (e) {
      alert(e.message)
    }
    setSaving(false)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Approval Inbox</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>{items.length} item{items.length !== 1 ? 's' : ''} pending review</p>
        </div>
        <button onClick={() => setCreateOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus style={{ width: 14, height: 14 }} /> New Request
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
          <button onClick={load} style={{ background: 'none', border: '1px solid #f87171', borderRadius: 6, color: '#f87171', fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : items.length === 0 && !error ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <ShieldAlert style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Nothing pending review.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item) => {
            const isGeneric = item.approve_action?.resource === 'approvals'
            const busy = acting === item.item_id + 'approve' || acting === item.item_id + 'reject' || acting === item.item_id + 'revoke'
            return (
              <div key={`${item.item_type}-${item.item_id}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 20, background: `${GOLD}18`, color: GOLD, whiteSpace: 'nowrap' }}>
                  {TYPE_LABEL[item.item_type] || item.item_type}
                </span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{item.action_summary}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock style={{ width: 11, height: 11 }} />
                    {new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {item.destination ? ` · ${item.destination}` : ''}
                    {typeof item.cost_cents === 'number' ? ` · $${(item.cost_cents / 100).toLocaleString()}` : ''}
                    {item.expires_at ? ` · expires ${new Date(item.expires_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => act(item, 'approve')} disabled={busy} title="Approve" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 7, color: '#4ade80', fontSize: 11, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.5 : 1 }}>
                    <CheckCircle2 style={{ width: 13, height: 13 }} /> Approve
                  </button>
                  <button onClick={() => act(item, 'reject')} disabled={busy} title="Reject" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 7, color: '#f87171', fontSize: 11, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.5 : 1 }}>
                    <XCircle style={{ width: 13, height: 13 }} /> Reject
                  </button>
                  {isGeneric && (
                    <button onClick={() => act(item, 'revoke')} disabled={busy} title="Revoke a prior approval" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.5 : 1 }}>
                      <Undo2 style={{ width: 13, height: 13 }} /> Revoke
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }} onClick={(e) => e.target === e.currentTarget && setCreateOpen(false)}>
          <div style={{ width: '100%', maxWidth: 440, background: '#0c0b08', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>New Approval Request</h3>
              <button onClick={() => setCreateOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Type</label>
                <select value={form.item_type} onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  <option value="installation" style={{ background: '#111' }}>Installation</option>
                  <option value="spending" style={{ background: '#111' }}>Spending</option>
                  <option value="pricing_exception" style={{ background: '#111' }}>Pricing Exception</option>
                  <option value="content" style={{ background: '#111' }}>Content</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Summary *</label>
                <input value={form.action_summary} onChange={(e) => setForm((f) => ({ ...f, action_summary: e.target.value }))} placeholder="What is being approved" style={inp} />
              </div>
              <div>
                <label style={lbl}>Destination / audience</label>
                <input value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Cost ($, optional)</label>
                <input type="number" value={form.cost_cents} onChange={(e) => setForm((f) => ({ ...f, cost_cents: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Content version (optional — binds approval to exact content)</label>
                <input value={form.content_version} onChange={(e) => setForm((f) => ({ ...f, content_version: e.target.value }))} style={inp} />
              </div>
              <button onClick={createRequest} disabled={!form.item_type || !form.action_summary || saving} style={{ padding: 13, background: form.action_summary ? G : '#161410', border: 'none', borderRadius: 9, color: form.action_summary ? '#0a0800' : 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, cursor: form.action_summary ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {saving ? 'Creating…' : 'Create Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
