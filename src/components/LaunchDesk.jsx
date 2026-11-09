import { useCallback, useEffect, useState } from 'react';
import { authedFetch } from '../lib/apiAuth';
import { fromEasternTime, formatEasternTime } from '../lib/novaBookingTime';
import './LaunchDesk.css';

export default function LaunchDesk() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [test, setTest] = useState(false);
  const [showTests, setShowTests] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await authedFetch('/api/client?resource=launch');
      const body = await r.json();
      if (r.status === 403) { setOwnerOnly(true); return; }
      if (!r.ok || !body.ok) throw new Error(body.error || 'Launch desk could not be loaded.');
      setData(body); setError('');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function mutate(payload) {
    setBusy(true); setError('');
    try {
      const r = await authedFetch('/api/client?resource=launch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await r.json();
      if (!r.ok || !body.ok) throw new Error(body.error || 'The calendar change could not be saved.');
      setData(body);
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }
  async function addSlot(event) {
    event.preventDefault();
    try {
      if (await mutate({ action: 'add_slot', starts_at: fromEasternTime(start), ends_at: fromEasternTime(end), is_test: test })) { setStart(''); setEnd(''); }
    } catch (e) { setError(e.message); }
  }
  if (ownerOnly) return <p className="launch-owner-note">Booking availability is managed by the Nova account owner.</p>;
  const liveRuns = (data?.runs || []).filter(r => !r.is_test);
  const available = (data?.slots || []).filter(s => !s.is_test && s.status === 'available' && Date.parse(s.starts_at) > Date.now());
  const slots = (data?.slots || []).filter(s => (showTests || !s.is_test) && s.status !== 'cancelled');
  const runs = (data?.runs || []).filter(r => showTests || !r.is_test);
  return <section className="launch-desk" aria-label="Request and booking worker">
    <div className="launch-desk-heading"><div><p className="launch-eyebrow">NOVA LAUNCH DESK</p><h2>Requests become next steps.</h2><p>Your web worker records the request, reserves published times and creates the follow-up task.</p></div><a className="launch-btn" href="/service-request" target="_blank" rel="noreferrer">Open customer assistant →</a></div>
    {error && <p className="launch-error" role="alert">{error}</p>}
    {!data && !error && <p>Loading your launch desk…</p>}
    {data && <>
      <div className="launch-stats"><div><strong>{liveRuns.length}</strong><span>Recent live requests</span></div><div><strong>{liveRuns.filter(r => r.state === 'booked').length}</strong><span>Reserved appointments</span></div><div><strong>{available.length}</strong><span>Open published times</span></div></div>
      <div className="launch-two-col"><form onSubmit={addSlot} className="launch-card"><h3>Publish your available times</h3><p>Only add times you can attend. These phone appointments use Nova’s calendar; Google Calendar is not synced.</p><div className="launch-time-fields"><label>Start · Eastern time<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label><label>End · Eastern time<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} /></label></div><label className="launch-check"><input type="checkbox" checked={test} onChange={e => setTest(e.target.checked)} />Test appointment only</label><button className="launch-btn" disabled={busy} type="submit">{busy ? 'Saving…' : test ? 'Add test time' : 'Publish available time'}</button><p className="launch-small">Appointments must start at least 30 minutes ahead. Overlapping or already-booked times are rejected.</p></form>
      <div className="launch-card"><h3>Your published calendar</h3>{!slots.length && <p>No appointment times yet. The assistant still collects requests and creates follow-up tasks.</p>}<div className="launch-slot-list">{slots.map(s => <div className="launch-slot" key={s.id}><div>{s.is_test && <span className="launch-tag">TEST</span>}<strong>{formatEasternTime(s.starts_at)}</strong><small>{Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000)} minutes · {s.status}</small></div>{s.status === 'available' && <button className="launch-text-btn" disabled={busy} onClick={() => mutate({ action: 'withdraw_slot', id: s.id })} type="button">Withdraw</button>}</div>)}</div></div></div>
      <div className="launch-runs-heading"><h3>Worker completion receipts</h3><div><label className="launch-check"><input type="checkbox" checked={showTests} onChange={e => setShowTests(e.target.checked)} />Show test records</label><button type="button" className="launch-text-btn" onClick={load}>Refresh</button></div></div>
      {!runs.length && <p className="launch-empty">No live worker runs yet. Share the customer assistant to receive your first request.</p>}
      <div className="launch-run-list">{runs.map(r => <article key={r.request_id} className="launch-run"><div className="launch-run-top"><div><span className="launch-eyebrow">{r.is_test ? 'TEST RUN' : 'CUSTOMER REQUEST'}</span><h4>{r.business_name}</h4><p>{r.name} · <a href={'mailto:' + r.email}>{r.email}</a>{r.phone && <> · <a href={'tel:' + r.phone}>{r.phone}</a></>}</p></div><span className={'launch-state ' + (r.state === 'booked' ? 'is-booked' : '')}>{r.state === 'booked' ? 'Appointment booked' : r.state === 'cancelled' ? 'Cancelled' : 'Ready for follow-up'}</span></div>{r.notes && <p className="launch-request-note">{r.notes}</p>}<ul>{r.steps.map((s, i) => <li key={i} className={s.status === 'completed' ? 'is-complete' : ''}>{s.label}</li>)}</ul><p className="launch-small">{r.starts_at && r.state === 'booked' ? formatEasternTime(r.starts_at) + ' · ' : ''}Follow-up task: {r.follow_up_status}. No outbound message was sent by this workflow.</p><details><summary>Saved reference</summary><p className="launch-reference">{r.request_id}</p></details></article>)}</div>
      <p className="launch-small">This worker follows a defined intake and booking workflow. Paid language-model, text-message and phone dispatch are not activated here.</p>
    </>}
  </section>;
}
