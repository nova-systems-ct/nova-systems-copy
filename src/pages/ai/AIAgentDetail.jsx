import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Phone, CalendarCheck, TrendingUp, Clock, Trash2, FileText, X } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useSEO } from '@/hooks/useSEO'
import { useAdminGuard, GOLD } from './AIDashboardShell'

const TABS = ['Overview', 'Call Logs', 'Knowledge Base', 'Settings']

const inputStyle = { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'inherit' }
const labelStyle = { display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }

function StatCard({ icon: Icon, label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 12, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icon style={{ width: 13, height: 13, color: GOLD }} />
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</p>
      </div>
      <p style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>{value}</p>
    </div>
  )
}

export default function AIAgentDetail() {
  useAdminGuard()
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') === 'knowledge' ? 'Knowledge Base' : 'Overview')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [calls, setCalls] = useState([])
  const [voices, setVoices] = useState([])
  const [transcriptModal, setTranscriptModal] = useState(null)
  const [kbForm, setKbForm] = useState(null)
  const [savingKb, setSavingKb] = useState(false)
  const [settingsForm, setSettingsForm] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)

  useSEO({ title: `${data?.agent?.agent_name || 'Agent'} — Nova AI`, description: 'Nova AI agent detail.' })

  const load = () => {
    fetch(`/api/nova-ai?action=agent-detail&id=${encodeURIComponent(id)}`).then(r => r.json()).then(d => {
      setData(d)
      setKbForm(d.knowledge_base || { business_description: '', services: '', hours: '', address: '', booking_process: '', faqs: [], never_say: '', always_say: '', escalation: '', personality: '' })
      setSettingsForm({ voice_id: d.agent?.voice_id, phone_number: d.agent?.phone_number, status: d.agent?.status })
      setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(load, [id])

  useEffect(() => {
    if (tab === 'Call Logs') {
      fetch(`/api/nova-ai?action=call-logs&agent_id=${encodeURIComponent(id)}`).then(r => r.json()).then(d => setCalls(Array.isArray(d) ? d : [])).catch(() => {})
    }
    if (tab === 'Settings') {
      fetch('/api/nova-ai?action=voices').then(r => r.json()).then(d => setVoices(Array.isArray(d) ? d : [])).catch(() => {})
    }
  }, [tab, id])

  const saveKb = async () => {
    setSavingKb(true)
    try {
      await fetch('/api/nova-ai?action=knowledge-base', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', agent_id: id, ...kbForm }),
      })
      load()
    } catch {}
    setSavingKb(false)
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const voice = voices.find(v => v.elevenlabs_voice_id === settingsForm.voice_id)
      await fetch('/api/nova-ai?action=agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, voice_id: settingsForm.voice_id, voice_name: voice?.voice_name, phone_number: settingsForm.phone_number, status: settingsForm.status }),
      })
      load()
    } catch {}
    setSavingSettings(false)
  }

  const deleteAgent = async () => {
    if (!confirm('Delete this agent permanently? This removes all its call logs, SMS logs, and knowledge base.')) return
    await fetch('/api/nova-ai?action=agents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    navigate('/ai/dashboard')
  }

  const updateFaq = (i, field, value) => {
    const faqs = [...(kbForm.faqs || [])]
    faqs[i] = { ...faqs[i], [field]: value }
    setKbForm({ ...kbForm, faqs })
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#030201', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',system-ui,sans-serif" }}>Loading…</div>
  if (!data?.agent) return <div style={{ minHeight: '100vh', background: '#030201', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',system-ui,sans-serif" }}>Agent not found.</div>

  const { agent, stats, calls_per_day } = data

  return (
    <div style={{ minHeight: '100vh', background: '#030201', fontFamily: "'Inter',system-ui,sans-serif", color: '#fff', padding: '40px 24px 100px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => navigate('/ai/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 24, fontFamily: 'inherit' }}>
          <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Dashboard
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 6 }}>Nova AI Agent</p>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{agent.agent_name}</h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 4 }}>{agent.business_name} · {agent.phone_number || 'No number assigned'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginTop: 24, marginBottom: 28, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? GOLD : 'transparent'}`, color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: tab === t ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
          ))}
        </div>

        {tab === 'Overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 28 }}>
              <StatCard icon={Phone} label="Total Calls" value={stats.total_calls} />
              <StatCard icon={CalendarCheck} label="Total Bookings" value={stats.total_bookings} />
              <StatCard icon={TrendingUp} label="Conversion Rate" value={`${stats.conversion_rate}%`} />
              <StatCard icon={Clock} label="Avg Call Duration" value={`${stats.avg_duration}s`} />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '28px 24px' }}>
              <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Calls — Last 30 Days</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={calls_per_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#0a0800', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
                  <Line type="monotone" dataKey="calls" stroke={GOLD} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === 'Call Logs' && (
          <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, overflow: 'hidden' }}>
            {calls.length === 0 ? (
              <p style={{ padding: 28, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No calls yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['Caller', 'Date', 'Duration', 'Outcome', 'Transcript'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {calls.map(c => (
                      <tr key={c.id}>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{c.caller_phone}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{c.duration || 0}s</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{c.outcome}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {c.transcript ? <button onClick={() => setTranscriptModal(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GOLD, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit' }}><FileText style={{ width: 12, height: 12 }} /> View</button> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'Knowledge Base' && kbForm && (
          <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '28px 24px' }}>
            <div style={{ marginBottom: 16 }}><label style={labelStyle}>Business Description</label><textarea style={{ ...inputStyle, minHeight: 70 }} value={kbForm.business_description || ''} onChange={e => setKbForm({ ...kbForm, business_description: e.target.value })} /></div>
            <div style={{ marginBottom: 16 }}><label style={labelStyle}>Services & Prices</label><textarea style={{ ...inputStyle, minHeight: 70 }} value={kbForm.services || ''} onChange={e => setKbForm({ ...kbForm, services: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div><label style={labelStyle}>Hours</label><input style={inputStyle} value={kbForm.hours || ''} onChange={e => setKbForm({ ...kbForm, hours: e.target.value })} /></div>
              <div><label style={labelStyle}>Address</label><input style={inputStyle} value={kbForm.address || ''} onChange={e => setKbForm({ ...kbForm, address: e.target.value })} /></div>
            </div>
            <div style={{ marginBottom: 16 }}><label style={labelStyle}>Booking Process</label><textarea style={{ ...inputStyle, minHeight: 60 }} value={kbForm.booking_process || ''} onChange={e => setKbForm({ ...kbForm, booking_process: e.target.value })} /></div>
            <p style={{ ...labelStyle, marginBottom: 10 }}>FAQs</p>
            {(kbForm.faqs || []).map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input style={inputStyle} placeholder={`Question ${i + 1}`} value={f.q || ''} onChange={e => updateFaq(i, 'q', e.target.value)} />
                <input style={inputStyle} placeholder="Answer" value={f.a || ''} onChange={e => updateFaq(i, 'a', e.target.value)} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 6, marginBottom: 16 }}>
              <div><label style={labelStyle}>Always Say</label><textarea style={{ ...inputStyle, minHeight: 60 }} value={kbForm.always_say || ''} onChange={e => setKbForm({ ...kbForm, always_say: e.target.value })} /></div>
              <div><label style={labelStyle}>Never Say</label><textarea style={{ ...inputStyle, minHeight: 60 }} value={kbForm.never_say || ''} onChange={e => setKbForm({ ...kbForm, never_say: e.target.value })} /></div>
            </div>
            <div style={{ marginBottom: 16 }}><label style={labelStyle}>Escalate To A Human When</label><input style={inputStyle} value={kbForm.escalation || ''} onChange={e => setKbForm({ ...kbForm, escalation: e.target.value })} /></div>
            <div style={{ marginBottom: 20 }}><label style={labelStyle}>Personality Notes</label><textarea style={{ ...inputStyle, minHeight: 60 }} value={kbForm.personality || ''} onChange={e => setKbForm({ ...kbForm, personality: e.target.value })} /></div>
            <button onClick={saveKb} disabled={savingKb} style={{ padding: '12px 24px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{savingKb ? 'Saving…' : 'Save Knowledge Base'}</button>
          </div>
        )}

        {tab === 'Settings' && settingsForm && (
          <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: 14, padding: '28px 24px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Voice</label>
              <select style={inputStyle} value={settingsForm.voice_id || ''} onChange={e => setSettingsForm({ ...settingsForm, voice_id: e.target.value })}>
                <option value="">Select a voice…</option>
                {voices.map(v => <option key={v.id} value={v.elevenlabs_voice_id}>{v.voice_name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Phone Number</label>
              <input style={inputStyle} value={settingsForm.phone_number || ''} onChange={e => setSettingsForm({ ...settingsForm, phone_number: e.target.value })} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={settingsForm.status || 'testing'} onChange={e => setSettingsForm({ ...settingsForm, status: e.target.value })}>
                <option value="testing">Testing</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={saveSettings} disabled={savingSettings} style={{ padding: '12px 24px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{savingSettings ? 'Saving…' : 'Save Settings'}</button>
              <button onClick={deleteAgent} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Trash2 style={{ width: 13, height: 13 }} /> Delete Agent</button>
            </div>
          </div>
        )}
      </div>

      {transcriptModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setTranscriptModal(null)}>
          <div style={{ background: '#0a0800', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 28, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Call Transcript</h3>
              <button onClick={() => setTranscriptModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{transcriptModal.transcript}</p>
          </div>
        </div>
      )}
    </div>
  )
}
