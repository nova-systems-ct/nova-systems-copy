import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, dt } from '../../lib/salesApi'
import { useSEO } from '../../hooks/useSEO'
import { PublicShell, Card, Muted, Btn, Field, Input, Banner, GOLD, Loading } from '../../components/sales/kit'

// Secure single-use invitation. The link contains a random token that the server stores only as a hash; using it creates the
// candidate's training account (candidate access only — never a representative account).
export default function JoinInvitation() {
  useSEO({ title: 'Set up your training account | Nova Systems', description: 'Accept your Nova Systems invitation.' })
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => { api('apply', 'invitation-info', { method: 'GET', query: { token } }).then((r) => setInfo(r.ok ? r.data : { state: 'invalid' })) }, [token])

  const submit = async (e) => {
    e.preventDefault(); setError(null)
    if (pw !== pw2) return setError('The two passwords do not match.')
    setBusy(true)
    const r = await api('apply', 'accept-invitation', { body: { token, password: pw } })
    setBusy(false)
    if (r.ok) setDone(true); else setError(r.data?.error || 'That did not work.')
  }

  if (!info) return <PublicShell narrow><Loading /></PublicShell>
  if (done) return (
    <PublicShell narrow>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Your account is ready</h1>
      <Card><Muted>You now have <strong>candidate access</strong>: your training, your documents and your onboarding status. You do not have access to leads, clients or earnings — Nova activates representatives separately, after training and agreements are complete.</Muted></Card>
      <Link to="/login?returnTo=%2Frep"><Btn kind="primary">Sign in to start training</Btn></Link>
    </PublicShell>
  )
  if (info.state !== 'valid') {
    const msg = { expired: 'This invitation has expired. Ask Nova to send a new one.', accepted: 'This invitation was already used. Sign in with the password you set.', revoked: 'This invitation is no longer valid.', invalid: 'This invitation link is not valid. Check the link in your email, or ask Nova to resend it.' }[info.state] || 'This invitation cannot be used.'
    return <PublicShell narrow><h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Invitation unavailable</h1><Banner tone="warn">{msg}</Banner>{info.state === 'accepted' && <Link to="/login" style={{ color: GOLD }}>Go to sign in</Link>}</PublicShell>
  }
  return (
    <PublicShell narrow>
      <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>You are invited</p>
      <h1 style={{ fontSize: 'clamp(24px,5vw,30px)', fontWeight: 800, margin: '6px 0 12px' }}>Set up your training account</h1>
      <Muted style={{ marginBottom: 16 }}>This invitation is for <strong style={{ color: '#fff' }}>{info.email_hint}</strong> and expires {dt(info.expires_at)}. It works once.</Muted>
      <Card>
        <form onSubmit={submit}>
          <Field label="Choose a password" hint="At least 12 characters. Do not reuse a password from another site."><Input type="password" autoComplete="new-password" required minLength={12} value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="Confirm password"><Input type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          {error && <Banner tone="bad">{error}</Banner>}
          <Btn kind="primary" type="submit" disabled={busy || pw.length < 12}>{busy ? 'Creating…' : 'Create my account'}</Btn>
        </form>
      </Card>
    </PublicShell>
  )
}
