import { Building2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'

const ROLE_LABELS = {
  nova_super_admin: 'Platform Owner', nova_admin: 'Nova Admin', nova_auditor: 'Nova Auditor',
  nova_marketing: 'Nova Marketing', nova_sales: 'Nova Sales', nova_developer: 'Nova Developer',
  client_owner: 'Owner', client_admin: 'Admin', client_marketing: 'Marketing',
  client_employee: 'Employee', client_viewer: 'Viewer',
}

const KIND_LABELS = { nova_internal: 'Nova Internal', client: 'Client' }

// Stage 4 (2026-09-12): shows exactly the organizations the caller's real, RLS-scoped
// memberships return — no hardcoded "Nova Systems" card, no organization the server didn't
// actually authorize. Multi-tenant creation/membership management is still not built here
// (out of scope) — this is real read access to real membership data, not a mockup.
export default function Companies() {
  const { organizations, currentOrgId, setCurrentOrg } = useOrg()
  const navigate = useNavigate()
  // 2026-10-26: workspaces named with the test convention (LOCAL TEST / TEST / DEMO) are hidden by default so real
  // companies are not buried; nothing is deleted. The current workspace always shows.
  const [showTest, setShowTest] = useState(false)
  const isTest = (o) => /^(LOCAL TEST|TEST|DEMO)(\W|$)/.test(o.name || '')
  const testCount = organizations.filter((o) => isTest(o) && o.id !== currentOrgId).length
  const shownOrgs = organizations.filter((o) => showTest || !isTest(o) || o.id === currentOrgId)

  return (
    <div style={{ padding: 'clamp(20px, 4vw, 48px) clamp(16px, 4vw, 52px) 80px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 8 }}>Companies</p>
        <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>Organizations</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, maxWidth: 560, lineHeight: 1.5 }}>
          Organizations you're authorized to access. Creating new organizations, inviting members,
          and role management are not built yet.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
        {shownOrgs.map((org) => {
          const isCurrent = org.id === currentOrgId
          return (
            <button
              key={org.id}
              onClick={() => setCurrentOrg(org.id)}
              style={{
                textAlign: 'left', background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${isCurrent ? `${GOLD}55` : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14, padding: '22px 24px', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 16,
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${GOLD}14`, border: `1px solid ${GOLD}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 style={{ width: 20, height: 20, color: GOLD }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{org.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                  {KIND_LABELS[org.kind] || org.kind} · {ROLE_LABELS[org.role] || org.role}
                  {isCurrent ? ' · Current' : ''}
                </p>
              </div>
            </button>
          )
        })}
      </div>
      {testCount > 0 && (
        <button type="button" onClick={() => setShowTest((v) => !v)} aria-pressed={showTest} style={{ marginTop: 14, minHeight: 40, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.5)', background: 'transparent', color: GOLD, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showTest ? 'Hide' : 'Show'} test workspaces ({testCount})
        </button>
      )}

      {organizations.length <= 1 && (
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 24 }}>
          No other companies connected yet.
        </p>
      )}

      <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Operational Workspaces</p>
        <button
          onClick={() => navigate('/dashboard/crystal')}
          style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '22px 24px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 320 }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${GOLD}14`, border: `1px solid ${GOLD}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles style={{ width: 20, height: 20, color: GOLD }} />
          </div>
          <div>
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Crystal</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>Planned placeholder from your 2026-09-23 brief (“Crystal/Company 002”, provisional name). Not a client and not a real company record; nothing runs here until you name and approve it.</p>
          </div>
        </button>
      </div>
    </div>
  )
}
