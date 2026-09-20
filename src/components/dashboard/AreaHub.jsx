import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const NAVY = '#04112B'
const GOLD = '#C9A84C'

// Shared landing-page shell for a Nova HQ top-level area (Intelligence/Growth/Execution/Admin).
// Each area links out to its real, already-working tools under their existing routes rather than
// duplicating or rebuilding them — Stage 3 is information architecture, not a rewrite.
export default function AreaHub({ eyebrow, title, description, items }) {
  const navigate = useNavigate()

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 8 }}>{eyebrow}</p>
        <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>{title}</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, maxWidth: 560, lineHeight: 1.5 }}>{description}</p>
      </div>

      {items.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '48px 32px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No tools connected here yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
          {items.map(({ label, description: desc, icon: Icon, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '22px 22px', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 14, transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${GOLD}55`; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${GOLD}14`, border: `1px solid ${GOLD}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: 16, height: 16, color: GOLD }} />
                </div>
                <ArrowRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.25)' }} />
              </div>
              <div>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{label}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 1.4 }}>{desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
