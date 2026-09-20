import { useState, useEffect } from 'react'
import { UserPlus, Loader2, Shield, X, Mail, Power } from 'lucide-react'
import { authedFetch } from '../../lib/apiAuth'

const GOLD = '#C9A84C'
const G = `linear-gradient(135deg,#8a6b2a 0%,${GOLD} 35%,#E0C476 55%,${GOLD} 80%,#8a6b2a 100%)`

const ROLES = [
  { value: 'nova_super_admin', label: 'Super Admin' },
  { value: 'nova_admin', label: 'Admin' },
  { value: 'nova_developer', label: 'Developer' },
  { value: 'nova_marketing', label: 'Marketing' },
  { value: 'nova_sales', label: 'Sales' },
  { value: 'nova_auditor', label: 'Auditor' },
]
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]))

const inp = {
  width: '100%', padding: '11px 14px', fontSize: 13,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const lbl = { display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 7 }

export default function Team() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ email: '', role: 'nova_sales' })
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await authedFetch('/api/team?op=list')
      const data = await r.json()
      if (!r.ok) { setError(data.error || 'Failed to load team roster.'); setLoading(false); return }
      setMembers(Array.isArray(data.members) ? data.members : [])
    } catch (e) {
      setError('Failed to load team roster.')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sendInvite = async (e) => {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')
    setInviting(true)
    try {
      const r = await authedFetch('/api/team?op=invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await r.json()
      if (!r.ok) { setInviteError(data.error || 'Invite failed.'); setInviting(false); return }
      setInviteSuccess(`Invite sent to ${data.email}.`)
      setForm({ email: '', role: 'nova_sales' })
      load()
    } catch (e) {
      setInviteError('Invite failed — request error.')
    }
    setInviting(false)
  }

  const updateRole = async (staff_user_id, role) => {
    setMembers((prev) => prev.map((m) => m.staff_user_id === staff_user_id ? { ...m, role } : m))
    await authedFetch('/api/team?op=update-role', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_user_id, role }),
    })
  }

  const deactivate = async (m) => {
    if (!window.confirm(`Remove ${m.email || 'this member'} from the Nova team? They will lose access immediately, but nothing they created is deleted.`)) return
    await authedFetch('/api/team?op=deactivate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_user_id: m.staff_user_id }),
    })
    load()
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Admin</p>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Team</h1>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>Nova staff accounts and roles.</p>
        </div>
        {!showInvite && (
          <button onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 18px', background: G, border: 'none', borderRadius: 8, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <UserPlus style={{ width: 14, height: 14 }} /> Invite Team Member
          </button>
        )}
      </div>

      {showInvite && (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>Invite a New Staff Member</p>
            <button onClick={() => { setShowInvite(false); setInviteError(''); setInviteSuccess('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}><X style={{ width: 18, height: 18 }} /></button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 18, lineHeight: 1.5 }}>
            Sends a real Supabase Auth invite email. They'll click the link, land on Nova's sign-in flow, and set their own password — nothing here ever asks for or stores a password on their behalf.
          </p>
          {inviteError && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, marginBottom: 16, color: '#f87171', fontSize: 12 }}>{inviteError}</div>
          )}
          {inviteSuccess && (
            <div style={{ padding: '12px 16px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, marginBottom: 16, color: '#4ade80', fontSize: 12 }}>{inviteSuccess}</div>
          )}
          <form onSubmit={sendInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 14 }}>
              <div>
                <label style={lbl}>Email</label>
                <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inp} placeholder="name@example.com" />
              </div>
              <div>
                <label style={lbl}>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  {ROLES.map((r) => <option key={r.value} value={r.value} style={{ background: '#111' }}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={inviting} style={{ padding: 13, background: G, border: 'none', borderRadius: 9, color: '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {inviting ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Mail style={{ width: 14, height: 14 }} />}
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
          </form>
        </div>
      )}

      {error && (
        <div style={{ padding: '18px 22px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, marginBottom: 28 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}><Loader2 style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', color: GOLD, margin: '0 auto' }} /></div>
      ) : members.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          <Shield style={{ width: 36, height: 36, color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No team members found.</p>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
              <div>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{m.email || '(email unavailable)'}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>
                  {m.status === 'active' ? 'Active' : 'Inactive'} · {m.email_confirmed ? 'Accepted' : 'Invite pending'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select value={m.role} onChange={(e) => updateRole(m.staff_user_id, e.target.value)} style={{ ...inp, width: 160, appearance: 'none', cursor: 'pointer', padding: '8px 12px', fontSize: 12 }}>
                  {ROLES.map((r) => <option key={r.value} value={r.value} style={{ background: '#111' }}>{r.label}</option>)}
                </select>
                {m.status === 'active' && (
                  <button onClick={() => deactivate(m)} title="Remove access" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: 8, cursor: 'pointer', display: 'flex' }}>
                    <Power style={{ width: 13, height: 13, color: '#f87171' }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
