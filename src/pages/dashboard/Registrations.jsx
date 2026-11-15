import { useCallback, useEffect, useState } from 'react';
import { authedFetch } from '../../lib/apiAuth';
import '../../styles/NovaLuxe.css';
import './BusinessDesk.css';

const LABEL = { pending: 'Waiting for you', approved: 'Approved', declined: 'Declined' };

export default function Registrations() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    try { const r = await authedFetch('/api/client?resource=register&op=list'), d = await r.json(); if (!r.ok) throw new Error(d.error || 'Registrations could not load.'); setData(d); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(reg, op) {
    if (op === 'decline' && !window.confirm(`Decline ${reg.business_name}? This cannot be undone.`)) return;
    setBusy(reg.id); setError(''); setNotice('');
    try {
      const r = await authedFetch(`/api/client?resource=register&op=${op}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registration_id: reg.id }) }), d = await r.json();
      if (!r.ok) throw new Error(d.error || 'That could not be completed.');
      if (op === 'approve') setNotice(`${reg.business_name} is set up. ${d.owner_access === 'invite_emailed' ? `A sign-in invitation was emailed to ${reg.email}.` : `${reg.email} already has a login and can open it now.`} Reload the page to see it in your business list.`);
      else setNotice(`${reg.business_name} was declined.`);
    } catch (e) { setError(e.message); } finally { setBusy(''); await load(); }
  }

  const rows = data?.registrations || [], packName = (k) => data?.packs?.find((p) => p.key === k)?.name || 'Not chosen';
  return (
    <div className="luxe-page desk">
      <p className="luxe-eyebrow">NEW BUSINESSES</p>
      <section className="luxe-heading"><div><h1>Registrations. <em>Your call.</em></h1><p className="luxe-subtitle">NOTHING IS CREATED UNTIL YOU APPROVE</p></div></section>
      {error && <p className="luxe-alert" role="alert">{error}</p>}
      {notice && <p className="luxe-alert" role="status">{notice}</p>}
      <section className="luxe-panel desk-link"><div><strong>Registration page</strong><p>Send any business here to ask for an account.</p><code>{window.location.origin}/register</code></div></section>
      <section className="luxe-panel">
        <div className="luxe-panel-title"><h2>Requests</h2><span className="luxe-badge">{rows.filter((r) => r.status === 'pending').length} waiting</span></div>
        {!data && !error ? <p role="status">Loading…</p> : rows.length ? rows.map((r) => (
          <article className="desk-row" key={r.id}>
            <div><strong>{r.business_name}</strong><p>{r.contact_name} · {r.email}{r.phone ? ` · ${r.phone}` : ''} · {packName(r.industry_pack)} · {new Date(r.created_at).toLocaleDateString('en-US')}</p>{r.message && <p>“{r.message}”</p>}{r.status === 'pending' && r.organization_id && <p>Setup started but did not finish. Approve again to carry on; nothing will be duplicated.</p>}</div>
            <span className="luxe-badge">{LABEL[r.status]}</span>
            {r.status === 'pending' && <><button className="luxe-button" disabled={!!busy} onClick={() => decide(r, 'approve')}>{busy === r.id ? 'Setting up…' : 'Approve and set up'}</button>{!r.organization_id && <button className="luxe-outline" disabled={!!busy} onClick={() => decide(r, 'decline')}>Decline</button>}</>}
          </article>
        )) : <div className="luxe-empty">No registrations yet.</div>}
        <p className="desk-note">Approving creates the business, a starting service list with no prices, a draft assistant, and the owner’s login. If the owner has no login yet, one invitation email is sent to them.</p>
      </section>
    </div>
  );
}
