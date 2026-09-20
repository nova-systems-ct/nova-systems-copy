import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Target, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'

// Stage 5 (2026-09-14): real leads from the `leads` table (fed by the public /welcome and
// /intake forms), replacing crmStore.js's fake seeded lead list entirely. No stage/pipeline
// field exists on the real table beyond intake_completed, so the pipeline here is deliberately
// simple (New Lead / Intake Complete) rather than the fuller stage list some earlier CRM UI
// implied — that fuller model was never real data to begin with.
export default function Leads() {
  const navigate = useNavigate()
  const { currentOrg } = useOrg()
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState([])
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!supabase || !currentOrg) { setLoading(false); return }
    let active = true
    supabase
      .from('leads')
      .select('id,name,email,phone,company,industry,intake_completed,created_at')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!active) return
        setError(!!err)
        setLeads(data || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [currentOrg?.id])

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>
      <button
        onClick={() => navigate('/dashboard/growth')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'inherit' }}
      >
        <ArrowLeft style={{ width: 13, height: 13 }} /> Growth
      </button>

      <div style={{ marginBottom: 32 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 8 }}>Growth</p>
        <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>Leads</h1>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>Couldn't load leads — the Stage 5 database migration may not be applied yet.</p>
        </div>
      )}

      {!loading && leads.length === 0 && !error && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '48px 32px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No leads recorded yet.</p>
        </div>
      )}

      {!loading && leads.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {leads.map((l) => (
            <div key={l.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${GOLD}14`, border: `1px solid ${GOLD}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {l.intake_completed ? <CheckCircle2 style={{ width: 16, height: 16, color: GOLD }} /> : <Target style={{ width: 16, height: 16, color: GOLD }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{l.name || l.email || 'Unnamed lead'}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                  {[l.company, l.industry, l.email].filter(Boolean).join(' · ') || 'No additional details'}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, background: l.intake_completed ? `${GOLD}14` : 'rgba(255,255,255,0.05)', color: l.intake_completed ? GOLD : 'rgba(255,255,255,0.4)' }}>
                  {l.intake_completed ? 'Intake Complete' : 'New Lead'}
                </span>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 6 }}>
                  {l.created_at ? new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
