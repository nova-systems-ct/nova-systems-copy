import { useState, useEffect } from 'react'
import { Send, Plus, Users } from 'lucide-react'
import { getSubscribers, addSubscriber, getSentNewsletters, saveSentNewsletter } from '../../lib/crmStore'

const GOLD = '#D4A030'
const G = `linear-gradient(135deg,#8a6200 0%,${GOLD} 35%,#C8921A 55%,${GOLD} 80%,#8a6200 100%)`
const inp = { width: '100%', padding: '11px 14px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

export default function Newsletter() {
  const [subscribers, setSubscribers] = useState([])
  const [sent, setSent] = useState([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null) // { success, count, error }
  const [addEmail, setAddEmail] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addResult, setAddResult] = useState('')

  useEffect(() => {
    setSubscribers(getSubscribers())
    setSent(getSentNewsletters())
  }, [])

  const handleAddSubscriber = async () => {
    if (!addEmail) return
    setAddLoading(true)
    const ok = addSubscriber(addEmail)
    setSubscribers(getSubscribers())
    setAddResult(ok ? 'Added!' : 'Already subscribed.')
    setAddEmail('')
    setAddLoading(false)
    setTimeout(() => setAddResult(''), 2500)
  }

  const handleSend = async () => {
    if (!subject || !body || subscribers.length === 0) return
    setSending(true)
    setSendResult(null)
    let successCount = 0
    let lastError = ''

    for (const sub of subscribers) {
      try {
        const res = await fetch('/api/notify?action=contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject,
            body: `${body}\n\n---\nNova Systems Newsletter\nnova-systems.app\nTo unsubscribe, reply with "unsubscribe"`,
            confirmTo: sub.email,
            confirmName: sub.email,
          }),
        })
        if (res.ok) successCount++
        else { const b = await res.json().catch(() => ({})); lastError = b.error || 'Send failed' }
      } catch (e) { lastError = e.message }
    }

    saveSentNewsletter({ subject, body, recipient_count: successCount })
    setSent(getSentNewsletters())
    setSendResult({ success: successCount, total: subscribers.length, error: lastError })
    if (successCount === subscribers.length) { setSubject(''); setBody('') }
    setSending(false)
  }

  return (
    <div style={{ padding: '40px 48px 80px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 36 }}>
        <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Newsletter</p>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>Newsletter Manager</h1>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>{subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Compose */}
        <div>
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, marginBottom: 24 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 20 }}>Compose</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Subject Line</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} style={inp} placeholder="Nova Systems Update — June 2026" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} style={{ ...inp, resize: 'vertical', lineHeight: 1.75 }} placeholder="Write your newsletter here…" />
            </div>

            {sendResult && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 8, background: sendResult.error && sendResult.success === 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${sendResult.error && sendResult.success === 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`, color: sendResult.error && sendResult.success === 0 ? '#f87171' : '#4ade80', fontSize: 13 }}>
                {sendResult.success > 0 ? `✓ Sent to ${sendResult.success}/${sendResult.total} subscribers` : ''}
                {sendResult.error ? ` — ${sendResult.error}` : ''}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={sending || !subject || !body || subscribers.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: sending || !subject || !body || subscribers.length === 0 ? 'rgba(255,255,255,0.05)' : G, border: 'none', borderRadius: 8, color: sending || !subject || !body || subscribers.length === 0 ? 'rgba(255,255,255,0.25)' : '#0a0800', fontSize: 12, fontWeight: 700, cursor: sending || !subject || !body || subscribers.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
            >
              <Send style={{ width: 13, height: 13 }} />
              {sending ? `Sending to ${subscribers.length} subscribers…` : `Send to All (${subscribers.length})`}
            </button>
            {subscribers.length === 0 && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 8 }}>Add subscribers to enable sending.</p>}
          </div>

          {/* Sent history */}
          <div>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Sent History</p>
            {sent.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>No newsletters sent yet.</p>
              </div>
            ) : sent.map(n => (
              <div key={n.id} style={{ padding: '14px 18px', marginBottom: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{n.subject}</p>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>{new Date(n.sent_at).toLocaleDateString()}</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{n.recipient_count} recipients</p>
              </div>
            ))}
          </div>
        </div>

        {/* Subscribers */}
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24, position: 'sticky', top: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 4 }}>Subscribers</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{subscribers.length} total</p>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: `${GOLD}10`, border: `1px solid ${GOLD}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: 14, height: 14, color: GOLD }} />
            </div>
          </div>

          {/* Add subscriber */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={addEmail} onChange={e => setAddEmail(e.target.value)} style={{ ...inp, flex: 1, fontSize: 12, padding: '9px 12px' }} placeholder="email@example.com" onKeyDown={e => e.key === 'Enter' && handleAddSubscriber()} />
            <button onClick={handleAddSubscriber} disabled={!addEmail || addLoading} style={{ padding: '9px 12px', background: G, border: 'none', borderRadius: 7, color: '#0a0800', cursor: !addEmail ? 'not-allowed' : 'pointer', opacity: !addEmail ? 0.5 : 1 }}>
              <Plus style={{ width: 14, height: 14 }} />
            </button>
          </div>
          {addResult && <p style={{ color: addResult === 'Added!' ? '#4ade80' : 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12 }}>{addResult}</p>}

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {subscribers.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No subscribers yet.</p>
            ) : subscribers.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{s.email}</p>
                  <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 1 }}>{new Date(s.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
