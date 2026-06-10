import { useState } from 'react'
import { Check, Eye, EyeOff, Save } from 'lucide-react'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`
const inp = { width: '100%', padding: '11px 14px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

function Section({ title, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 28, marginBottom: 20 }}>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 22 }}>{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  )
}

function SaveBtn({ saved, onClick, label = 'Save Changes' }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', background: saved ? 'rgba(34,197,94,0.12)' : G, border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none', borderRadius: 8, color: saved ? '#4ade80' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
      {saved ? <><Check style={{ width: 13, height: 13 }} /> Saved</> : <><Save style={{ width: 13, height: 13 }} /> {label}</>}
    </button>
  )
}

export default function Settings() {
  const [profile, setProfile] = useState({ name: 'Isaac Nova', email: 'Isaac_0427@icloud.com', phone: '' })
  const [profileSaved, setProfileSaved] = useState(false)
  const [pw, setPw] = useState({ current: '', new: '', confirm: '' })
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [biz, setBiz] = useState({ name: 'Nova Systems', website: 'nova-systems.app', location: 'Connecticut', email: 'hello@nova-systems.app' })
  const [bizSaved, setBizSaved] = useState(false)
  const [notifs, setNotifs] = useState({ new_application: true, lead_activity: true, invoice_due: true, newsletter: false })
  const [notifSaved, setNotifSaved] = useState(false)
  const [showKeys, setShowKeys] = useState({})

  const saveProfile = () => {
    localStorage.setItem('nova_profile', JSON.stringify(profile))
    setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000)
  }

  const savePassword = () => {
    setPwError('')
    if (!pw.current || !pw.new) { setPwError('Fill in all fields.'); return }
    if (pw.new !== pw.confirm) { setPwError('Passwords do not match.'); return }
    if (pw.new.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    // In a real app this would call an API. Here just simulate.
    setPwSaved(true); setPw({ current: '', new: '', confirm: '' })
    setTimeout(() => setPwSaved(false), 2000)
  }

  const saveBiz = () => {
    setBizSaved(true); setTimeout(() => setBizSaved(false), 2000)
  }

  const saveNotifs = () => {
    setNotifSaved(true); setTimeout(() => setNotifSaved(false), 2000)
  }

  const API_KEYS = [
    { label: 'Supabase Anon Key', key: 'VITE_SUPABASE_ANON_KEY', env: true },
    { label: 'Resend API Key', key: 'RESEND_API_KEY', env: true },
    { label: 'Claude API Key', key: 'VITE_CLAUDE_API_KEY', env: true },
    { label: 'Admin Password', key: 'VITE_ADMIN_PASSWORD', env: true },
  ]

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 800 }}>
      <div style={{ marginBottom: 36 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Settings</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Account & Settings</h1>
      </div>

      {/* Profile */}
      <Section title="Your Profile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#0a0800' }}>I</div>
          <div>
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Isaac Nova</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 }}>Founder, Nova Systems</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Field label="Full Name">
            <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} style={inp} />
          </Field>
          <Field label="Email">
            <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} style={inp} />
          </Field>
        </div>
        <Field label="Phone">
          <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} style={{ ...inp, maxWidth: 300 }} placeholder="+1 (860) 000-0000" />
        </Field>
        <SaveBtn saved={profileSaved} onClick={saveProfile} />
      </Section>

      {/* Password */}
      <Section title="Change Password">
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
          Update your admin password. The current password is set in Login.jsx and .env as VITE_ADMIN_PASSWORD.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Field label="Current Password">
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} style={{ ...inp, paddingRight: 36 }} />
              <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0 }}>
                {showPw ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
              </button>
            </div>
          </Field>
          <Field label="New Password">
            <input type={showPw ? 'text' : 'password'} value={pw.new} onChange={e => setPw(p => ({ ...p, new: e.target.value }))} style={inp} />
          </Field>
          <Field label="Confirm New">
            <input type={showPw ? 'text' : 'password'} value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} style={inp} />
          </Field>
        </div>
        {pwError && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{pwError}</p>}
        <SaveBtn saved={pwSaved} onClick={savePassword} label="Update Password" />
      </Section>

      {/* Business Info */}
      <Section title="Business Info">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Field label="Business Name">
            <input value={biz.name} onChange={e => setBiz(b => ({ ...b, name: e.target.value }))} style={inp} />
          </Field>
          <Field label="Website">
            <input value={biz.website} onChange={e => setBiz(b => ({ ...b, website: e.target.value }))} style={inp} />
          </Field>
          <Field label="Location">
            <input value={biz.location} onChange={e => setBiz(b => ({ ...b, location: e.target.value }))} style={inp} />
          </Field>
          <Field label="Contact Email">
            <input value={biz.email} onChange={e => setBiz(b => ({ ...b, email: e.target.value }))} style={inp} />
          </Field>
        </div>
        <SaveBtn saved={bizSaved} onClick={saveBiz} />
      </Section>

      {/* Notifications */}
      <Section title="Notification Preferences">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {[
            { key: 'new_application', label: 'New job application received' },
            { key: 'lead_activity', label: 'Lead stage changed' },
            { key: 'invoice_due', label: 'Invoice due reminders' },
            { key: 'newsletter', label: 'Newsletter send confirmation' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div
                onClick={() => setNotifs(n => ({ ...n, [key]: !n[key] }))}
                style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${notifs[key] ? GOLD : 'rgba(255,255,255,0.2)'}`, background: notifs[key] ? G : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {notifs[key] && <Check style={{ width: 11, height: 11, color: '#0a0800' }} />}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{label}</span>
            </label>
          ))}
        </div>
        <SaveBtn saved={notifSaved} onClick={saveNotifs} />
      </Section>

      {/* API Keys */}
      <Section title="API Keys">
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
          These keys are stored in your <code style={{ color: GOLD, fontSize: 12 }}>.env</code> file. Never commit them to git.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {API_KEYS.map(({ label, key }) => {
            const val = import.meta.env[key] || ''
            const masked = val ? val.slice(0, 8) + '••••••••••••••••••' + val.slice(-4) : 'Not set'
            const show = showKeys[key]
            return (
              <div key={key} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</p>
                  <button onClick={() => setShowKeys(k => ({ ...k, [key]: !k[key] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'inherit' }}>
                    {show ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />}
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
                <code style={{ color: val ? '#4ade80' : '#f87171', fontSize: 12, fontFamily: "'Courier New',monospace" }}>
                  {show ? (val || 'Not set') : masked}
                </code>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 4 }}>{key}</p>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
