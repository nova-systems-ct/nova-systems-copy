import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Network, Loader2, ShieldQuestion, UserCircle2, Ban, Users, Video, ShieldAlert, FileBarChart, Map, Building2, Crown, Users2, Activity as ActivityIcon, CheckCircle2 } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'

const GOLD = '#C9A84C'

const STATUS_CFG = {
  draft:      { label: 'Draft',      color: 'rgba(255,255,255,0.4)' },
  onboarding: { label: 'Onboarding', color: '#a78bfa' },
  training:   { label: 'Training',   color: '#a78bfa' },
  restricted: { label: 'Restricted', color: GOLD },
  active:     { label: 'Active',     color: '#4ade80' },
  suspended:  { label: 'Suspended',  color: '#f87171' },
  inactive:   { label: 'Inactive',   color: 'rgba(255,255,255,0.25)' },
}

function Badge({ color, children, icon: Icon }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, background: `${color}18`, color, whiteSpace: 'nowrap' }}>
      {Icon && <Icon style={{ width: 11, height: 11 }} />} {children}
    </span>
  )
}

function assignmentBadge(position) {
  const a = (position.executive_assignments || [])[0]
  if (!a) return <Badge color="rgba(255,255,255,0.3)">No record</Badge>
  if (a.fill_type === 'reserved') return <Badge color="rgba(255,255,255,0.4)" icon={Ban}>Reserved</Badge>
  if (a.fill_type === 'vacant') return <Badge color="rgba(255,255,255,0.4)" icon={ShieldQuestion}>Vacant</Badge>
  return <Badge color="#4ade80" icon={UserCircle2}>Filled — {a.fill_type}</Badge>
}

// Nova Command — the minimal, first, read-only slice of the "owner interface" from the Nova
// Organizational Hierarchy master prompt (2026-09-27/28). Deliberately NOT the full 14-route
// "Digital Headquarters" (worker desks, committee rooms, live meetings) — see
// docs/NOVA_HIERARCHY_BUILD_STATE.md for what remains unbuilt. Every status shown here is read
// directly from the real hierarchy resource; nothing is decorative or simulated.
export default function Command() {
  const [portfolio, setPortfolio] = useState([])
  const [positions, setPositions] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [pRes, posRes, wRes] = await Promise.all([
        authedFetch('/api/client?resource=hierarchy&op=portfolio'),
        authedFetch('/api/client?resource=hierarchy&op=positions'),
        authedFetch('/api/client?resource=hierarchy&op=workers'),
      ])
      if (!pRes.ok) throw new Error((await pRes.json().catch(() => ({}))).error || 'Failed to load the portfolio')
      if (!posRes.ok) throw new Error((await posRes.json().catch(() => ({}))).error || 'Failed to load positions')
      if (!wRes.ok) throw new Error((await wRes.json().catch(() => ({}))).error || 'Failed to load workers')
      setPortfolio(await pRes.json())
      setPositions(await posRes.json())
      setWorkers(await wRes.json())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Nova Command</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>The organizational hierarchy registry — portfolio, positions and workers. Every status below is real; a reserved or vacant seat is shown honestly, never as filled.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        {[
          { to: '/dashboard/command/organization', label: 'Organization', icon: Map },
          { to: '/dashboard/command/companies', label: 'Companies', icon: Building2 },
          { to: '/dashboard/command/executives', label: 'Executives', icon: Crown },
          { to: '/dashboard/command/committees', label: 'Committees', icon: Users2 },
          { to: '/dashboard/command/workforce', label: 'Workforce', icon: Users },
          { to: '/dashboard/command/meetings', label: 'Committee Room', icon: Video },
          { to: '/dashboard/command/governance', label: 'Governance', icon: ShieldAlert },
          { to: '/dashboard/command/approvals', label: 'Approvals', icon: CheckCircle2 },
          { to: '/dashboard/command/reports', label: 'Reports', icon: FileBarChart },
          { to: '/dashboard/command/activity', label: 'Activity', icon: ActivityIcon },
          { to: '/dashboard/command/incidents', label: 'Incidents', icon: ShieldAlert },
        ].map((l) => (
          <Link key={l.to} to={l.to} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            <l.icon style={{ width: 13, height: 13, color: GOLD }} /> {l.label}
          </Link>
        ))}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>
          <button onClick={load} style={{ background: 'none', border: '1px solid #f87171', borderRadius: 6, color: '#f87171', fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Portfolio</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {portfolio.map((e) => (
            <Link key={e.id} to={`/dashboard/command/companies/${e.id}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, textDecoration: 'none' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{e.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>{e.entity_type.replace(/_/g, ' ')}{e.purpose ? ` · ${e.purpose}` : ''}</p>
              </div>
              <Badge color={e.status === 'active' ? '#4ade80' : e.status === 'paused' ? GOLD : e.status === 'closed' ? '#f87171' : 'rgba(255,255,255,0.4)'}>{e.status}</Badge>
            </Link>
          ))}
          {portfolio.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No portfolio entities.</p>}
        </div>
      </section>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Positions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {positions.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{p.title}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>Level {p.authority_level} · {p.position_type.replace(/_/g, ' ')}{p.is_reserved ? ` · ${p.reserved_reason || 'reserved'}` : ''}</p>
              </div>
              {assignmentBadge(p)}
            </div>
          ))}
          {positions.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No positions.</p>}
        </div>
      </section>

      <section>
        <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Workers</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {workers.map((w) => {
            const cfg = STATUS_CFG[w.status] || STATUS_CFG.draft
            return (
              <Link key={w.id} to={`/dashboard/command/workers/${w.id}`} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, textDecoration: 'none' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{w.display_name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 }}>{w.worker_type}{w.positions?.title ? ` · ${w.positions.title}` : ''}{w.email ? ` · ${w.email}` : ''}</p>
                </div>
                <Badge color={cfg.color}>{cfg.label}</Badge>
              </Link>
            )
          })}
          {workers.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No workers.</p>}
        </div>
      </section>

      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 40, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Network style={{ width: 12, height: 12 }} /> Read-only. Creating positions, workers, and approving CEO Twin/Authority Matrix policy is not yet in this screen — use the API directly until that UI ships.
      </p>
    </div>
  )
}
