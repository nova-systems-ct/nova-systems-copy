import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckSquare, Square } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useOrg } from '../../lib/OrgContext'

const GOLD = '#C9A84C'

// Stage 5 (2026-09-14): real tasks from `nova_tasks` (an existing table, previously unused by
// this repo's frontend — shared with nova-wave-one's engines, which write here on triggers).
// Zero rows exist today; this is intentionally read-only for Stage 5 (view/support real task
// visibility, not a full task-management UI) — matches "Real projects/tasks are visible OR
// supported" rather than building task creation/mutation UI against a table nothing populates yet.
export default function Tasks() {
  const navigate = useNavigate()
  const { currentOrg } = useOrg()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!supabase || !currentOrg) { setLoading(false); return }
    let active = true
    supabase
      .from('nova_tasks')
      .select('id,title,description,status,created_at,completed_at')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!active) return
        setError(!!err)
        setTasks(data || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [currentOrg?.id])

  return (
    <div style={{ padding: '48px 52px 80px', maxWidth: 1200 }}>
      <button
        onClick={() => navigate('/dashboard/execution')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'inherit' }}
      >
        <ArrowLeft style={{ width: 13, height: 13 }} /> Execution
      </button>

      <div style={{ marginBottom: 32 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 8 }}>Execution</p>
        <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>Tasks</h1>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <p style={{ color: '#f87171', fontSize: 13 }}>Couldn't load tasks — the Stage 5 database migration may not be applied yet.</p>
        </div>
      )}

      {!loading && tasks.length === 0 && !error && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '48px 32px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>No tasks yet.</p>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((t) => (
            <div key={t.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
              {t.status === 'done'
                ? <CheckSquare style={{ width: 16, height: 16, color: GOLD, flexShrink: 0 }} />
                : <Square style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.5 : 1 }}>{t.title}</p>
                {t.description && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 }}>{t.description}</p>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{t.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
