import { useState, useEffect, useCallback } from 'react'
import { Loader2, Activity as ActivityIcon } from 'lucide-react'
import { authedFetch } from '../../../lib/apiAuth'

const GOLD = '#C9A84C'
const TYPES = ['decision', 'work_item', 'venture', 'meeting']
const TYPE_COLOR = { decision: GOLD, work_item: '#4ade80', venture: '#a78bfa', meeting: '#60a5fa' }

export default function Activity() {
  const [entries, setEntries] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (type) => {
    setLoading(true); setError('')
    try {
      const r = await authedFetch(`/api/client?resource=workitems&op=activity-feed${type ? `&entity_type=${type}` : ''}`)
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load')
      setEntries(await r.json())
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])
  useEffect(() => { load(filter) }, [load, filter])

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Activity</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6 }}>A real, merged feed across decisions, work items, ventures and meetings — the last 7 days.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setFilter('')} style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${filter === '' ? GOLD : 'rgba(255,255,255,0.15)'}`, background: 'none', color: filter === '' ? GOLD : 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer' }}>All</button>
        {TYPES.map((t) => (
          <button key={t} onClick={() => setFilter(t)} style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${filter === t ? TYPE_COLOR[t] : 'rgba(255,255,255,0.15)'}`, background: 'none', color: filter === t ? TYPE_COLOR[t] : 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' }}>{t.replace('_', ' ')}</button>
        ))}
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}
      {loading ? <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: GOLD }} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
              <ActivityIcon style={{ width: 14, height: 14, color: TYPE_COLOR[e.entity_type], flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ color: '#fff', fontSize: 13 }}>{e.summary}</p>
                {e.detail && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 3 }}>{e.detail}</p>}
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 3 }}>{new Date(e.at).toLocaleString()}</p>
              </div>
            </div>
          ))}
          {entries.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No activity in this period.</p>}
        </div>
      )}
    </div>
  )
}
