// Business desk tabs for calls and messages (api/_channelAdmin.js, api/_businessCalls.js):
// Messages (every channel in one inbox), Calls (the call log) and Switch on (installation).
import { useEffect, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { CHANNEL_LABELS, CALL_MODES, OUTCOME_LABELS, STATE_LABELS, PROVIDER_ADDRESSES, heldText, pretty, inbox, messageWho, embedSnippet, readiness } from '../../lib/channelSetup';

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const copy = (text, setNotice) => navigator.clipboard?.writeText(text).then(() => setNotice('Copied.'));

export function MessagesTab({ orgId, call, busy, setBusy, setError, setNotice }) {
  const [data, setData] = useState(null), [openId, setOpenId] = useState(null), [reply, setReply] = useState('');
  const load = () => call('agents', 'threads', { orgId }).then(setData).catch((e) => setError(e.message));
  useEffect(() => { setData(null); setOpenId(null); load(); }, [orgId]);
  const list = useMemo(() => (data ? inbox(data.threads, data.messages) : []), [data]);
  const thread = list.find((t) => t.id === openId);
  async function send(op, body, done) {
    setBusy(true); setError(''); setNotice('');
    try { await call('agents', op, { orgId, body }); setNotice(done); setReply(''); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!data) return <section className="luxe-panel"><p role="status">Loading…</p></section>;
  return (
    <section className="luxe-panel">
      <div className="luxe-panel-title"><h2>Messages</h2><span className="luxe-badge">{list.filter((t) => t.needs_human).length} waiting for a person</span></div>
      <p className="desk-note">Texts, website chat, WhatsApp, RCS, Apple Messages, Facebook and Instagram in one place. The assistant answers from your services and approved prices; anything else waits here for you.</p>
      {!list.length ? <div className="luxe-empty">No conversations yet.</div> : list.map((t) => (
        <div key={t.id}>
          <button className="desk-row desk-row-button" aria-expanded={openId === t.id} onClick={() => { setOpenId(openId === t.id ? null : t.id); setReply(''); }}>
            <div><strong>{t.label}</strong> <span className="luxe-badge">{CHANNEL_LABELS[t.channel] || t.channel}</span>{t.needs_human && <> <span className="luxe-badge">Needs you</span></>}{t.opted_out && <> <span className="luxe-badge">Opted out</span></>}
              <p>{t.last ? `${t.last.direction === 'inbound' ? '' : `${messageWho(t.last)}: `}${String(t.last.body).slice(0, 120)}` : ''}</p></div>
            <span className="desk-note">{when(t.lastAt)}</span>
          </button>
          {openId === t.id && thread && (
            <div className="desk-detail">
              <ul className="desk-events">{thread.messages.map((m) => <li key={m.id}><span>{when(m.created_at)} · {messageWho(m)}:</span> {m.state === 'held' ? `(not sent: ${heldText(m.held_reason)})` : m.body}{m.state === 'failed' ? ` (not delivered: ${heldText(m.held_reason)})` : ''}</li>)}</ul>
              {thread.opted_out ? <p className="desk-note">This customer opted out. Nothing can be sent to them here.</p> : (
                <form className="luxe-form" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send('thread-reply', { thread_id: t.id, text: reply }, 'Reply sent.'); }}>
                  <label>Your reply{t.channel === 'web_chat' ? ' (shows in their chat window)' : ''}<textarea value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)} /></label>
                  <div className="luxe-actions"><button className="luxe-button" disabled={busy || !reply.trim()}>Send</button>{t.needs_human && <button type="button" className="luxe-outline" disabled={busy} onClick={() => send('thread-done', { thread_id: t.id }, 'Marked as handled.')}>Mark handled</button>}</div>
                </form>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export function CallsTab({ orgId, call, setError }) {
  const [calls, setCalls] = useState(null);
  useEffect(() => { setCalls(null); call('agents', 'calls', { orgId }).then((d) => setCalls(d.calls || [])).catch((e) => setError(e.message)); }, [orgId]);
  if (!calls) return <section className="luxe-panel"><p role="status">Loading…</p></section>;
  return (
    <section className="luxe-panel">
      <div className="luxe-panel-title"><h2>Calls</h2><span className="luxe-badge">{calls.filter((c) => c.outcome === 'callback_requested').length} to call back</span></div>
      {!calls.length ? <div className="luxe-empty">No calls yet. Calls appear here once the business number is answering.</div> : (
        <div className="luxe-table-wrap"><table className="luxe-table"><thead><tr><th>When</th><th>Caller</th><th>What happened</th><th>What they said</th></tr></thead><tbody>
          {calls.map((c) => <tr key={c.id}><td>{when(c.started_at)}</td><td>{pretty(c.from_phone) || 'Hidden number'}</td><td>{OUTCOME_LABELS[c.outcome] || c.outcome}{c.texted_back ? ' · texted back' : ''}{c.held_reason ? ` · ${heldText(c.held_reason)}` : ''}</td><td>{(c.caller_said || []).map((s) => s.said).filter(Boolean).join(' / ') || '—'}</td></tr>)}
        </tbody></table></div>
      )}
      <p className="desk-note">The assistant never agrees a price, time or terms by phone. It texts the caller a private link to see their quote and book, or marks the call for you to return.</p>
    </section>
  );
}

const pick = (a, keys) => Object.fromEntries(keys.map((k) => [k, a[k] ?? '']));
const CALL_KEYS = ['call_mode', 'forward_phone', 'ring_seconds', 'missed_call_text', 'voice_provider', 'voice_provider_agent_id'];
const AI_KEYS = ['ai_enabled', 'ai_provider', 'faq'];
const CHANNEL_KEYS = ['web_chat_enabled', 'whatsapp_enabled', 'whatsapp_number', 'rcs_enabled', 'messaging_service_sid', 'apple_enabled', 'apple_business_id', 'facebook_enabled', 'instagram_enabled', 'meta_page_id', 'instagram_account_id'];

export function InstallTab({ orgId, call, busy, setBusy, setError, setNotice, agent, saveBase, services, extra, slug, reloadAgent }) {
  const [calls, setCalls] = useState(() => pick(agent, CALL_KEYS)), [chans, setChans] = useState(() => pick(agent, CHANNEL_KEYS));
  const [live, setLive] = useState({ status: agent.status || 'draft', sms_enabled: agent.sms_enabled === true, cap: agent.monthly_spend_cap_cents ? String(Number(agent.monthly_spend_cap_cents) / 100) : '' });
  const [token, setToken] = useState(''), [voiceKey, setVoiceKey] = useState(null), [ai, setAi] = useState(() => pick(agent, AI_KEYS));
  useEffect(() => { setAi(pick(agent, AI_KEYS)); setCalls(pick(agent, CALL_KEYS)); setChans(pick(agent, CHANNEL_KEYS)); setLive({ status: agent.status || 'draft', sms_enabled: agent.sms_enabled === true, cap: agent.monthly_spend_cap_cents ? String(Number(agent.monthly_spend_cap_cents) / 100) : '' }); }, [agent]);
  const checklist = readiness({ agent, services, payments: extra.payments, spending: extra.spending === true, team: extra.team, slug, aiReady: extra.ai_ready === true });
  async function run(fn, done) {
    setBusy(true); setError(''); setNotice('');
    try { const d = await fn(); setNotice(done); await reloadAgent(); return d; } catch (e) { setError(e.message); return null; } finally { setBusy(false); }
  }
  const saveChannels = (body, done) => run(() => call('agents', 'channels', { orgId, body }), done);
  const bool = (v) => v === true;
  const capCents = live.cap.trim() === '' ? null : Math.round(Number(live.cap) * 100);

  return (
    <>
      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2>What is switched on</h2><span className="luxe-badge">{checklist.filter((c) => c.state === 'ready').length} of {checklist.length} on</span></div>
        <div className="luxe-table-wrap"><table className="luxe-table"><thead><tr><th>System</th><th>State</th><th>Details</th></tr></thead><tbody>
          {checklist.map((c) => <tr key={c.key}><td>{c.name}{c.costs ? ' $' : ''}</td><td><span className="luxe-badge">{STATE_LABELS[c.state]}</span></td><td>{c.detail}</td></tr>)}
        </tbody></table></div>
        <p className="desk-note">$ = costs money per use (calls, texts, WhatsApp, RCS, Apple Messages). Those run only when spending is switched on for all businesses{extra.spending === true ? ' (it is on)' : ' (it is off now)'} and this business has a monthly cap with room left. Website chat, Facebook and Instagram replies are free.</p>
      </section>

      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2>Go live</h2><span className="luxe-badge">{agent.status === 'active' ? 'Live' : agent.status === 'paused' ? 'Paused' : 'Draft'}</span></div>
        <form className="luxe-form" onSubmit={(e) => { e.preventDefault(); if (capCents !== null && (!Number.isInteger(capCents) || capCents < 100)) return setError('Enter the monthly cap in dollars, at least 1, or leave it empty for no spending.'); run(() => saveBase({ status: live.status, sms_enabled: live.sms_enabled, monthly_spend_cap_cents: capCents }), 'Saved.'); }}>
          <div className="desk-pair">
            <label>The assistant is<select value={live.status} onChange={(e) => setLive({ ...live, status: e.target.value })}><option value="draft">Draft: not answering anyone</option><option value="active">Live: answering on the channels switched on</option><option value="paused">Paused</option></select></label>
            <label>Monthly spending cap, dollars (empty = nothing that costs money is sent)<input inputMode="decimal" value={live.cap} onChange={(e) => setLive({ ...live, cap: e.target.value })} placeholder="for example 25" /></label>
          </div>
          <label className="desk-check"><input type="checkbox" checked={live.sms_enabled} onChange={(e) => setLive({ ...live, sms_enabled: e.target.checked })} />Answer text messages to the business number (switch on only after the carriers approved the number for texting)</label>
          <button className="luxe-button" disabled={busy}>Save</button>
        </form>
        <p className="desk-note">The cap is checked before every call, text and paid message using planned costs (text 2¢, forwarded call 5¢, assistant call 15¢, premium voice 40¢). It is a safety limit, not a bill.</p>
      </section>

      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2>AI answers</h2><span className="luxe-badge">{extra.ai_ready ? 'AI available' : 'AI not switched on by Nova yet'}</span></div>
        <form className="luxe-form" onSubmit={(e) => { e.preventDefault(); saveChannels({ ai_enabled: bool(ai.ai_enabled), ai_provider: ai.ai_provider || null, faq: ai.faq || '' }, 'AI answers saved.'); }}>
          <label className="desk-check"><input type="checkbox" checked={bool(ai.ai_enabled)} onChange={(e) => setAi({ ...ai, ai_enabled: e.target.checked })} />Let AI answer customers' questions in chat, texts, every message app and on calls (planned 1¢ an answer)</label>
          <label>Which AI<select value={ai.ai_provider || ''} onChange={(e) => setAi({ ...ai, ai_provider: e.target.value })}><option value="">Nova's choice</option><option value="anthropic">Claude (Anthropic)</option><option value="openai">GPT (OpenAI)</option><option value="google">Gemini (Google)</option></select></label>
          <label>Your answers to common questions (hours, insurance, what to expect…). The AI uses only these and your services.<textarea rows={6} maxLength={4000} value={ai.faq || ''} onChange={(e) => setAi({ ...ai, faq: e.target.value })} /></label>
          <button className="luxe-button" disabled={busy}>Save AI answers</button>
        </form>
        <p className="desk-note">Every AI answer is checked before it goes out: a price must be one you approved, and a link or phone number must be the business's own. If the AI does not know, it passes the customer to the rules or to a person.</p>
      </section>

      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2>Phone calls</h2></div>
        <form className="luxe-form" onSubmit={(e) => { e.preventDefault(); saveChannels({ call_mode: calls.call_mode || 'off', forward_phone: calls.forward_phone || null, ring_seconds: Number(calls.ring_seconds || 20), missed_call_text: bool(calls.missed_call_text), voice_provider: calls.voice_provider || null, voice_provider_agent_id: calls.voice_provider_agent_id || null }, 'Call settings saved.'); }}>
          <label>How calls to {pretty(agent.phone_number) || 'the business number'} are answered<select value={calls.call_mode || 'off'} onChange={(e) => setCalls({ ...calls, call_mode: e.target.value })}>{CALL_MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <div className="desk-pair"><label>Phone to ring first<input value={calls.forward_phone} onChange={(e) => setCalls({ ...calls, forward_phone: e.target.value })} placeholder="+12035551234" /></label><label>Ring for (seconds, 5 to 60)<input inputMode="numeric" value={calls.ring_seconds} onChange={(e) => setCalls({ ...calls, ring_seconds: e.target.value })} /></label></div>
          <label className="desk-check"><input type="checkbox" checked={bool(calls.missed_call_text)} onChange={(e) => setCalls({ ...calls, missed_call_text: e.target.checked })} />Text a missed caller once a day with a link to reach us (needs text messages on)</label>
          <div className="desk-pair"><label>Assistant voice<select value={calls.voice_provider || ''} onChange={(e) => setCalls({ ...calls, voice_provider: e.target.value })}><option value="">Standard (included)</option><option value="elevenlabs">Premium (the business's ElevenLabs agent)</option></select></label>
            <label>Premium voice agent ID<input value={calls.voice_provider_agent_id} onChange={(e) => setCalls({ ...calls, voice_provider_agent_id: e.target.value })} disabled={calls.voice_provider !== 'elevenlabs'} /></label></div>
          <button className="luxe-button" disabled={busy}>Save call settings</button>
        </form>
        <p className="desk-note">Tip: if the phone that rings has voicemail, set the ring time shorter than the time before voicemail picks up, or voicemail will take the call instead of the assistant.</p>
        {calls.voice_provider === 'elevenlabs' && (
          <div className="desk-detail">
            <button className="luxe-outline" disabled={busy} onClick={() => run(() => call('agents', 'voice-key', { orgId, body: {} }).then((d) => { setVoiceKey(d); return d; }), 'Voice key made. Copy it now; it is not shown again.')}>{agent.voice_key_set ? 'Replace the voice key' : 'Make the voice key'}</button>
            {voiceKey && <><p className="desk-note">Add these tools to the premium voice agent, each with the header {voiceKey.header} set to this key:</p><code>{voiceKey.key}</code><ul className="desk-list">{voiceKey.tools.map((t) => <li key={t.name}>{t.name}: {t.url}</li>)}</ul></>}
          </div>
        )}
      </section>

      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2>Message channels</h2></div>
        <form className="luxe-form" onSubmit={(e) => { e.preventDefault(); saveChannels(Object.fromEntries(Object.entries(chans).map(([k, v]) => [k, k.endsWith('_enabled') ? bool(v) : v || null])), 'Channels saved.'); }}>
          <label className="desk-check"><input type="checkbox" checked={bool(chans.web_chat_enabled)} onChange={(e) => setChans({ ...chans, web_chat_enabled: e.target.checked })} />Website chat (free). Shows on the business page{slug ? '' : ' once it has a web address name'} and on any website with the code below.</label>
          {slug && <div className="desk-link"><code>{embedSnippet(slug)}</code><button type="button" className="luxe-outline" onClick={() => copy(embedSnippet(slug), setNotice)}><Copy size={14} />Copy code</button></div>}
          <div className="desk-pair"><label>WhatsApp number (approved sender)<input value={chans.whatsapp_number} onChange={(e) => setChans({ ...chans, whatsapp_number: e.target.value })} placeholder="+12035551234" /></label><label className="desk-check"><input type="checkbox" checked={bool(chans.whatsapp_enabled)} onChange={(e) => setChans({ ...chans, whatsapp_enabled: e.target.checked })} />Answer WhatsApp</label></div>
          <div className="desk-pair"><label>Twilio Messaging Service SID (for RCS)<input value={chans.messaging_service_sid} onChange={(e) => setChans({ ...chans, messaging_service_sid: e.target.value })} placeholder="MG…" /></label><label className="desk-check"><input type="checkbox" checked={bool(chans.rcs_enabled)} onChange={(e) => setChans({ ...chans, rcs_enabled: e.target.checked })} />Answer RCS</label></div>
          <div className="desk-pair"><label>Apple Messages for Business ID<input value={chans.apple_business_id} onChange={(e) => setChans({ ...chans, apple_business_id: e.target.value })} /></label><label className="desk-check"><input type="checkbox" checked={bool(chans.apple_enabled)} onChange={(e) => setChans({ ...chans, apple_enabled: e.target.checked })} />Answer Apple Messages</label></div>
          <div className="desk-pair"><label>Facebook Page ID<input value={chans.meta_page_id} onChange={(e) => setChans({ ...chans, meta_page_id: e.target.value })} /></label><label>Instagram account ID<input value={chans.instagram_account_id} onChange={(e) => setChans({ ...chans, instagram_account_id: e.target.value })} /></label></div>
          <div className="desk-pair"><label className="desk-check"><input type="checkbox" checked={bool(chans.facebook_enabled)} onChange={(e) => setChans({ ...chans, facebook_enabled: e.target.checked })} />Answer Facebook messages</label><label className="desk-check"><input type="checkbox" checked={bool(chans.instagram_enabled)} onChange={(e) => setChans({ ...chans, instagram_enabled: e.target.checked })} />Answer Instagram messages</label></div>
          <button className="luxe-button" disabled={busy}>Save channels</button>
        </form>
        <form className="luxe-form" onSubmit={(e) => { e.preventDefault(); run(() => call('agents', 'meta-connect', { orgId, body: { page_token: token } }), 'Page connected.').then((d) => d && setToken('')); }}>
          <label>Facebook Page access token {agent.meta_connected ? '(connected; paste a new one to replace it)' : ''}<input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} /></label>
          <div className="luxe-actions"><button className="luxe-outline" disabled={busy || !token.trim()}>Connect Page</button>{agent.meta_connected && <button type="button" className="luxe-link" disabled={busy} onClick={() => run(() => call('agents', 'meta-connect', { orgId, body: { disconnect: true } }), 'Page disconnected. Facebook and Instagram are off.')}>Disconnect</button>}</div>
        </form>
        <p className="desk-note">WhatsApp, Facebook and Instagram allow replies only within 24 hours of the customer's last message.</p>
      </section>

      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2>Addresses for the providers</h2></div>
        <p className="desk-note">Paste these into each provider's console when connecting this business. They are the same for every business.</p>
        <ul className="desk-list">{PROVIDER_ADDRESSES.map(([what, url]) => <li key={url}>{what}: <code>{url}</code> <button type="button" className="luxe-link" onClick={() => copy(url, setNotice)}>Copy</button></li>)}</ul>
      </section>
    </>
  );
}
