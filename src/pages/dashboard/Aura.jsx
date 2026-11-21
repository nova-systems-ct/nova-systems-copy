// Aura 0.1: the morning brief. One screen, for every business you belong to: new requests, today's
// jobs, what is waiting on you, customers to call and money, read from each Business desk.
// Read-only: Aura sends, pays and changes nothing.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sunrise, Copy, RefreshCw } from 'lucide-react';
import { authedFetch } from '../../lib/apiAuth';
import { useOrg } from '../../lib/OrgContext';
import '../../styles/NovaLuxe.css';

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
const greeting = (d = new Date()) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening');

export default function Aura() {
  const { organizations, user, setCurrentOrg } = useOrg();
  const [briefs, setBriefs] = useState(null), [skipped, setSkipped] = useState([]), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!organizations?.length) return;
    setBusy(true); setNotice('');
    const results = await Promise.all(organizations.map(async (o) => {
      try {
        const r = await authedFetch(`/api/client?resource=journey&op=brief&organization_id=${o.id}&tz=${encodeURIComponent(tz())}`);
        const d = await r.json().catch(() => ({}));
        return r.ok ? { org: o, brief: d.brief } : { org: o, error: d.error || 'Not available' };
      } catch { return { org: o, error: 'No connection' }; }
    }));
    setBriefs(results.filter((x) => x.brief)); setSkipped(results.filter((x) => !x.brief)); setBusy(false);
  }, [organizations]);
  useEffect(() => { load(); }, [load]);

  const name = String(user?.user_metadata?.full_name || user?.email || '').split(/[\s@]/)[0];
  const text = briefs ? [`${greeting()}${name ? `, ${name}` : ''}.`, ...briefs.map((b) => b.brief.text)].join('\n\n') : '';

  return (
    <div className="luxe-page">
      <p className="luxe-eyebrow">AURA · MORNING BRIEF</p>
      <section className="luxe-heading"><div><h1>{greeting()}{name ? `, ${name}` : ''}. <em>Here is your day.</em></h1><p className="luxe-subtitle">EVERY BUSINESS ・ ONE SCREEN ・ READ-ONLY</p></div></section>
      <div className="luxe-actions" style={{ marginBottom: 20 }}>
        <button className="luxe-outline" disabled={busy} onClick={load}><RefreshCw size={14} />{busy ? 'Reading…' : 'Refresh'}</button>
        <button className="luxe-outline" disabled={!text} onClick={() => navigator.clipboard?.writeText(text).then(() => setNotice('Brief copied. Paste it into a note or a text to yourself.'))}><Copy size={14} />Copy brief</button>
      </div>
      {notice && <p className="luxe-alert" role="status">{notice}</p>}
      {!briefs ? <p role="status">Reading your businesses…</p> : briefs.map(({ org, brief }) => (
        <section className="luxe-panel" key={org.id}>
          <div className="luxe-panel-title"><h2><Sunrise size={20} /> {brief.business}</h2><Link className="luxe-link" to="/dashboard/business" onClick={() => setCurrentOrg?.(org.id)}>Open Business desk</Link></div>
          <pre style={{ whiteSpace: 'pre-wrap', font: 'inherit', margin: 0 }}>{brief.text.split('\n').slice(1).join('\n')}</pre>
        </section>
      ))}
      {skipped.length > 0 && <p className="luxe-subtitle" style={{ marginTop: 16 }}>Not included (no Business desk access): {skipped.map((s) => s.org.name).join(', ')}.</p>}
      <p className="luxe-subtitle" style={{ marginTop: 24 }}>Aura 0.1 reads what your Business desks already hold. Calendar and email are not connected yet.</p>
    </div>
  );
}
