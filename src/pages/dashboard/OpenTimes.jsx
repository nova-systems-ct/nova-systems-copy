// Open times (Business desk): the times customers can book. Weekly hours become real times for the
// coming weeks (api/_openTimes.js); one-off times can be added; an open time can be removed, a booked
// one cannot. Customers only ever see open times.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { groupByDay } from '../../lib/openTimes';

const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
const LENGTHS = [[30, '30 minutes'], [60, '1 hour'], [90, '1½ hours'], [120, '2 hours'], [180, '3 hours'], [240, '4 hours'], [480, 'All day (8 hours)']];
const WEEKS = [[1, '1 week'], [2, '2 weeks'], [4, '4 weeks'], [8, '8 weeks']];
const STATUS = { open: 'Open', held: 'Being booked', booked: 'Booked' };
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch { return 'America/New_York'; } };

export default function OpenTimes({ orgId, call, busy, setBusy, setError, setNotice }) {
  const tz = useMemo(zone, []);
  const [times, setTimes] = useState(null);
  const [form, setForm] = useState({ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:00', minutes: 120, weeks: 4 });
  const [single, setSingle] = useState({ start: '', end: '' });
  const load = useCallback(() => call('journey', 'open-times', { orgId }).then((d) => setTimes(d.times || [])).catch((e) => setError(e.message)), [orgId, call, setError]);
  useEffect(() => { load(); }, [load]);

  const send = async (body, done) => {
    setBusy(true); setError('');
    try { const d = await call('journey', body.slot_id ? 'remove-open-time' : 'add-open-times', { orgId, body }); if (d.times) setTimes(d.times); else await load(); setNotice(done(d)); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const addWeekly = (e) => { e.preventDefault(); send({ ...form, timezone: tz }, (d) => `${d.added} time${d.added === 1 ? '' : 's'} added${d.skipped ? `; ${d.skipped} already taken or overlapping, so skipped` : ''}.`); };
  const addOne = (e) => {
    e.preventDefault();
    if (!single.start || !single.end) { setError('Enter a start and an end.'); return; }
    send({ start_at: new Date(single.start).toISOString(), end_at: new Date(single.end).toISOString(), timezone: tz }, (d) => (d.added ? 'Time added.' : 'That time overlaps one you already have, so nothing was added.'));
  };
  const when = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  const openCount = (times || []).filter((t) => t.status === 'open').length;

  return (
    <>
      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2>Open times</h2><span className="luxe-badge">{times ? `${openCount} open` : 'Loading'}</span></div>
        <p className="desk-note">Customers can book only these times, on the request page, in chat and by text. Times are in {tz.replace(/_/g, ' ')}.</p>
        <form className="luxe-form" onSubmit={addWeekly}>
          <fieldset className="desk-days"><legend>Days you work</legend>{DAYS.map(([k, label]) => (
            <label key={k} className="desk-check"><input type="checkbox" checked={form.days.includes(k)} onChange={(e) => setForm({ ...form, days: e.target.checked ? [...form.days, k] : form.days.filter((x) => x !== k) })} />{label}</label>
          ))}</fieldset>
          <div className="desk-inline">
            <label>From<input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required /></label>
            <label>To<input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} required /></label>
            <label>Each job takes<select value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}>{LENGTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>For the next<select value={form.weeks} onChange={(e) => setForm({ ...form, weeks: Number(e.target.value) })}>{WEEKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
          <button className="luxe-button" disabled={busy || !form.days.length}>Add these times</button>
        </form>
        <form className="luxe-form" onSubmit={addOne}>
          <div className="desk-inline">
            <label>One extra time: starts<input type="datetime-local" value={single.start} onChange={(e) => setSingle({ ...single, start: e.target.value })} /></label>
            <label>Ends<input type="datetime-local" value={single.end} onChange={(e) => setSingle({ ...single, end: e.target.value })} /></label>
          </div>
          <button className="luxe-outline" disabled={busy}>Add one time</button>
        </form>
      </section>

      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2>Coming up</h2></div>
        {times && !times.length && <p className="desk-note">No times yet. Customers will be told the team will arrange a time with them.</p>}
        {times && groupByDay(times, tz).map((g) => (
          <div key={g.label} className="desk-day">
            <h3>{g.label}</h3>
            <ul className="desk-times">{g.times.map((t) => (
              <li key={t.id}><span>{when(t.start_at)} to {when(t.end_at)}</span><span className="luxe-badge">{STATUS[t.status] || t.status}</span>
                {t.status === 'open' && <button className="luxe-link" disabled={busy} onClick={() => send({ slot_id: t.id }, () => 'Time removed.')}>Remove</button>}</li>
            ))}</ul>
          </div>
        ))}
      </section>
    </>
  );
}
