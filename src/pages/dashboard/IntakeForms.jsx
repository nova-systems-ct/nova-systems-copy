import { useState, useEffect } from 'react'
import { ClipboardList, Loader2, ExternalLink } from 'lucide-react'

const GOLD = '#D4A030'
const STATUS_COLORS = {
  Active: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
  'Pending Payment': { bg: `${GOLD}15`, color: GOLD },
}

export default function IntakeForms() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/intake?action=clients')
      .then(r => r.json())
      .then(data => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>New Business</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Intake Forms</h1>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>
          Submissions from the /welcome contract & payment wizard. {clients.length} total.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <ClipboardList style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No intake submissions yet. Share the /welcome link with a new client to get started.</p>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 90px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Business', 'Contact', 'Plan', 'Price', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>{h}</span>
            ))}
          </div>
          {clients.map(c => {
            const sc = STATUS_COLORS[c.status] || STATUS_COLORS['Pending Payment']
            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 90px', padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{c.business_name || c.full_name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{c.business_type}</p>
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{c.full_name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{c.email}</p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{c.tier_name || '—'}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{c.tier_price ? `$${c.tier_price}/mo` : '—'}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: sc.bg, color: sc.color, width: 'fit-content', textTransform: 'uppercase' }}>{c.status}</span>
                {c.contract_url ? (
                  <a href={c.contract_url} target="_blank" rel="noreferrer" style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}><ExternalLink style={{ width: 12, height: 12 }} /></a>
                ) : <span />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
