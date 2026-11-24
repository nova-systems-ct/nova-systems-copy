import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Tag, Users, Wallet, RefreshCw, ChartNoAxesColumn, Bot, Copy, ShieldCheck, HardHat, MessageSquare, Phone, Power } from 'lucide-react';
import { authedFetch } from '../../lib/apiAuth';
import { useOrg } from '../../lib/OrgContext';
import { dollars, toCents, STAGE_LABELS, waitingLabel, needsOwner, serviceRequest, serviceToForm, EMPTY_SERVICE, OFFER_TRIGGERS } from '../../lib/businessDesk';
import { MessagesTab, CallsTab, InstallTab } from './BusinessChannels';
import '../../styles/NovaLuxe.css';
import './BusinessDesk.css';

const TABS = [['services', 'Services & prices', Briefcase], ['offers', 'Offers', Tag], ['customers', 'Customers', Users], ['messages', 'Messages', MessageSquare], ['calls', 'Calls', Phone], ['money', 'Money owed', Wallet], ['revive', 'Come-back list', RefreshCw], ['results', 'Results', ChartNoAxesColumn], ['team', 'Team & pay', HardHat], ['assistant', 'Assistant', Bot], ['install', 'Switch on', Power]];
const EMPTY_WORKER = { name: '', phone: '', email: '', kind: 'contractor' };
const DEFAULT_SHARES = [{ label: 'Worker', percent: '50', to_worker: true }, { label: 'Business', percent: '50', to_worker: false }];
const EMPTY_OFFER = { code: '', percent_off: '', trigger_type: 'web_visit', description: '', expires_at: '', approved: false };
const EMPTY_AGENT = { business_name: '', agent_name: '', industry: '', phone_number: '', greeting: '', services: '', service_area: '', booking_url: '', owner_alert_phone: '', handoff_instructions: '', never_say: '', tone: 'friendly', status: 'draft', sms_enabled: false, email_enabled: false, reply_email: '', mailing_address: '', review_url: '' };
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

// A job's before and after photos from the worker's phone (private; the links last an hour).
function JobPhotos({ orgId, journeyId }) {
  const [photos, setPhotos] = useState(null), [err, setErr] = useState('');
  const load = () => call('journey', 'job-photos', { orgId, query: `&journey_id=${journeyId}` }).then((d) => setPhotos(d.photos || [])).catch((e) => setErr(e.message));
  if (err) return <p className="desk-note">{err}</p>;
  if (!photos) return <button type="button" className="luxe-outline" onClick={load}>Show job photos</button>;
  if (!photos.length) return <p className="desk-note">No photos from the worker yet.</p>;
  return <div className="desk-photos">{photos.map((p) => (p.url ? <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={`${p.kind} photo`} loading="lazy" /><span>{p.kind}</span></a> : <span key={p.id} className="desk-note">{p.kind} photo (link not available)</span>))}</div>;
}

async function call(resource, op, { orgId, body, query = '' } = {}) {
  const url = `/api/client?resource=${resource}&op=${op}` + (body ? '' : `&organization_id=${orgId}${query}`);
  const r = await authedFetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organization_id: orgId, ...body }) } : undefined);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'That could not be confirmed. Nothing was changed.');
  return d;
}

export default function BusinessDesk() {
  const { currentOrg, currentOrgId: orgId } = useOrg();
  const [tab, setTab] = useState('services');
  const [data, setData] = useState(null), [extra, setExtra] = useState({});
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [svc, setSvc] = useState(EMPTY_SERVICE), [offer, setOffer] = useState(EMPTY_OFFER), [agent, setAgent] = useState(EMPTY_AGENT);
  const [packs, setPacks] = useState([]), [pack, setPack] = useState('');
  const [open, setOpen] = useState(null), [detail, setDetail] = useState(null), [pay, setPay] = useState({ amount: '', reference: '' }), [note, setNote] = useState('');
  const [worker, setWorker] = useState(EMPTY_WORKER), [shares, setShares] = useState(DEFAULT_SHARES), [splitOk, setSplitOk] = useState(false), [crewLink, setCrewLink] = useState(''), [assignTo, setAssignTo] = useState('');
  const [exportMonth, setExportMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    if (!orgId) return;
    try { setData(await call('journey', 'list', { orgId })); setError(''); } catch (e) { setError(e.message); }
  }, [orgId]);

  useEffect(() => { setData(null); setExtra({}); setOpen(null); load(); }, [load]);
  const loadAgent = useCallback(() => (orgId ? call('agents', 'get', { orgId }).then((d) => { setExtra((x) => ({ ...x, spending: d.spending_unlocked, ai_ready: d.ai_ready === true })); if (d.agent) setAgent({ ...EMPTY_AGENT, ...Object.fromEntries(Object.entries(d.agent).map(([k, v]) => [k, v ?? ''])), sms_enabled: d.agent.sms_enabled === true, email_enabled: d.agent.email_enabled === true }); else setAgent({ ...EMPTY_AGENT, business_name: currentOrg?.name || '' }); }).catch(() => {}) : Promise.resolve()), [orgId, currentOrg?.name]);
  useEffect(() => {
    if (!orgId) return;
    call('journey', 'packs', { orgId }).then((d) => setPacks(d.packs || [])).catch(() => {});
    loadAgent();
  }, [orgId, loadAgent]);
  useEffect(() => {
    if (!orgId) return;
    const want = { money: ['receivables', 'receivables'], revive: ['revive-preview', 'revive'], results: ['scorecard', 'results'] }[tab];
    if (tab === 'results') call('journey', 'feedback', { orgId }).then((d) => setExtra((x) => ({ ...x, feedback: d.feedback }))).catch(() => {});
    if (want) call('journey', want[0], { orgId }).then((d) => setExtra((x) => ({ ...x, [want[1]]: d }))).catch((e) => setError(e.message));
    if (tab === 'money' || tab === 'install') call('journey', 'card-payments', { orgId }).then((d) => setExtra((x) => ({ ...x, payments: d.payments }))).catch(() => {});
    if (tab === 'team' || tab === 'customers' || tab === 'install') call('journey', 'team', { orgId }).then((d) => { setExtra((x) => ({ ...x, team: d })); if (tab === 'team' && d.rule) { setShares(d.rule.shares.map((r) => ({ label: r.label, percent: String(r.percent), to_worker: r.to_worker === true }))); setSplitOk(d.rule.approved === true); } }).catch((e) => setError(e.message));
  }, [tab, orgId, data]);
  // Back from Stripe's sign-up page: open Money owed and read the account's status from Stripe.
  useEffect(() => {
    if (!orgId) return;
    const back = new URLSearchParams(window.location.search).get('payments');
    if (back !== 'return' && back !== 'refresh') return;
    setTab('money');
    call('journey', 'card-payments-refresh', { orgId, body: {} }).then((d) => setExtra((x) => ({ ...x, payments: d.payments }))).catch((e) => setError(e.message));
  }, [orgId]);

  async function act(fn, done) {
    setBusy(true); setError(''); setNotice('');
    try { const d = await fn(); await load(); if (done) setNotice(typeof done === 'function' ? done(d) : done); return d; } catch (e) { setError(e.message); return null; } finally { setBusy(false); }
  }

  const services = useMemo(() => data?.services || [], [data]), offers = data?.offers || [], journeys = useMemo(() => data?.journeys || [], [data]);
  const todo = useMemo(() => needsOwner(services, journeys), [services, journeys]);
  const serviceName = (id) => services.find((s) => s.id === id)?.name || 'Not chosen yet';
  const leadLink = orgId ? `${window.location.origin}/start?org=${orgId}` : '';
  const siteLink = currentOrg?.slug ? `${window.location.origin}/b/${currentOrg.slug}` : '';

  function saveService(e) {
    e.preventDefault();
    const req = serviceRequest(svc, orgId);
    if (req.error) return setError(req.error);
    act(() => call('journey', 'save-service', { orgId, body: req.body }), 'Service saved. Customers who were waiting on it have moved on.').then((d) => d && setSvc(EMPTY_SERVICE));
  }
  function saveOffer(e) {
    e.preventDefault();
    act(() => call('journey', 'save-offer', { orgId, body: { ...offer, percent_off: Number(offer.percent_off), expires_at: offer.expires_at ? new Date(offer.expires_at + 'T23:59:59').toISOString() : null } }), 'Offer saved.').then((d) => d && setOffer(EMPTY_OFFER));
  }
  // The assistant's details, saved with whatever is switched on now (Switch on is where that changes),
  // so editing a greeting never turns texting, calls or the spending cap off by accident.
  const saveBase = (overrides = {}) => call('agents', 'save', { orgId, body: { ...agent, status: agent.status || 'draft', sms_enabled: agent.sms_enabled === true, voice_enabled: !!agent.call_mode && agent.call_mode !== 'off', monthly_spend_cap_cents: agent.monthly_spend_cap_cents === '' ? null : agent.monthly_spend_cap_cents, ...overrides } });
  function saveAgent(e) {
    e.preventDefault();
    act(() => saveBase(), 'Assistant details saved.').then(() => loadAgent());
  }
  async function toggle(j) {
    if (open === j.id) return setOpen(null);
    setOpen(j.id); setDetail(null); setPay({ amount: '', reference: '' }); setNote(''); setAssignTo('');
    try { setDetail(await call('journey', 'detail', { orgId, query: `&journey_id=${j.id}` })); } catch (e) { setError(e.message); }
  }
  function recordPayment(j) {
    const cents = toCents(pay.amount);
    if (!cents) return setError('Enter the amount you received, for example 60 or 60.00.');
    act(() => call('journey', 'record-payment', { orgId, body: { journey_id: j.id, amount_cents: cents, reference: pay.reference } }), 'Payment recorded as entered by you.').then(() => setOpen(null));
  }

  if (!orgId) return <div className="luxe-page"><div className="luxe-empty">Choose a business to manage.</div></div>;

  return (
    <div className="luxe-page desk">
      <p className="luxe-eyebrow">BUSINESS DESK</p>
      <section className="luxe-heading">
        <div><h1>{currentOrg?.name || 'Your business'}. <em>Handled.</em></h1><p className="luxe-subtitle">YOU SET THE PRICES ・ THE WORKERS DO THE REST</p></div>
      </section>
      {error && <p className="luxe-alert" role="alert">{error}</p>}
      {notice && <p className="luxe-alert" role="status">{notice}</p>}

      <section className="luxe-panel desk-link">
        <div><strong>Your request page</strong><p>Send customers here. It goes live once at least one service is switched on.</p><code>{leadLink}</code></div>
        <button className="luxe-outline" onClick={() => navigator.clipboard?.writeText(leadLink).then(() => setNotice('Link copied.'))}><Copy size={14} />Copy link</button>
      </section>
      {siteLink && (
        <section className="luxe-panel desk-link">
          <div><strong>Your website</strong><p>A one-page site made from your services, prices you approved, hours and offer. It updates by itself when you change them here.</p><code>{siteLink}</code></div>
          <button className="luxe-outline" onClick={() => navigator.clipboard?.writeText(siteLink).then(() => setNotice('Link copied.'))}><Copy size={14} />Copy link</button>
        </section>
      )}

      {data && todo.length > 0 && (
        <section className="luxe-panel luxe-attention desk-todo"><ShieldCheck />
          <div><strong>Needs your decision</strong>
            <ul>{todo.map((t) => <li key={t.service_id + t.kind}><button className="luxe-link" onClick={() => { setTab('services'); setSvc(serviceToForm(services.find((s) => s.id === t.service_id))); }}>{t.service}: {t.what.toLowerCase()}</button>{t.waiting > 0 && <span className="luxe-badge">{t.waiting} waiting</span>}</li>)}</ul>
            <p>The workers never invent a price or agreement. Until you approve one, customers are told the team is preparing it.</p>
          </div>
        </section>
      )}

      <div className="luxe-tabs" role="tablist">{TABS.map(([key, label, Icon]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}><Icon size={14} />{label}</button>)}</div>
      {!data && !error && <div className="luxe-empty" role="status">Loading…</div>}

      {data && tab === 'services' && (
        <div className="luxe-grid-two">
          <section className="luxe-panel">
            <div className="luxe-panel-title"><h2>What you sell</h2><span className="luxe-badge">{services.length}</span></div>
            {services.length ? services.map((s) => (
              <article className="desk-row" key={s.id}>
                <div><strong>{s.name}</strong>{s.active === false && <span className="luxe-badge">Off</span>}<p>{dollars(s.price_cents)}{s.price_cents ? (s.price_approved ? ' · price approved' : ' · price not approved') : ''}{s.deposit_cents ? ` · ${dollars(s.deposit_cents)} deposit` : ''}</p><p>{s.terms_text ? (s.terms_approved ? 'Agreement approved' : 'Agreement not approved') : 'No agreement wording'}{s.return_days ? ` · customers usually return every ${s.return_days} days` : ''}</p></div>
                <button className="luxe-outline" onClick={() => setSvc(serviceToForm(s))}>Edit</button>
              </article>
            )) : <div className="luxe-empty">No services yet. Add one, or start from a ready-made list for your trade.</div>}
            {packs.length > 0 && (
              <div className="desk-pack"><label>Start from a ready-made list<select value={pack} onChange={(e) => setPack(e.target.value)}><option value="">Choose your trade…</option>{packs.map((p) => <option key={p.key} value={p.key}>{p.name} ({p.services.length} services)</option>)}</select></label>
                <button className="luxe-outline" disabled={!pack || busy} onClick={() => act(() => call('journey', 'apply-pack', { orgId, body: { pack } }), 'Services added without prices. Set and approve each price to switch it on for customers.')}>Add these services</button></div>
            )}
          </section>
          <section className="luxe-panel">
            <div className="luxe-panel-title"><h2>{services.some((s) => s.name === svc.name.trim()) ? 'Edit service' : 'Add a service'}</h2></div>
            <form className="luxe-form" onSubmit={saveService}>
              <label>Name<input value={svc.name} maxLength={120} onChange={(e) => setSvc({ ...svc, name: e.target.value })} placeholder="Lawn mowing" /></label>
              <label>What the customer gets<textarea value={svc.description} maxLength={1000} onChange={(e) => setSvc({ ...svc, description: e.target.value })} /></label>
              <label>Words customers use for it (commas)<input value={svc.keywords} onChange={(e) => setSvc({ ...svc, keywords: e.target.value })} placeholder="mow, grass, yard" /></label>
              <div className="desk-pair"><label>Price ($)<input inputMode="decimal" value={svc.price} onChange={(e) => setSvc({ ...svc, price: e.target.value })} /></label><label>Deposit ($, optional)<input inputMode="decimal" value={svc.deposit} onChange={(e) => setSvc({ ...svc, deposit: e.target.value })} /></label></div>
              <label className="desk-check"><input type="checkbox" checked={svc.price_approved} onChange={(e) => setSvc({ ...svc, price_approved: e.target.checked })} />I approve this price. Quotes can be sent with it.</label>
              <label>Agreement wording the customer accepts<textarea rows={5} value={svc.terms_text} maxLength={8000} onChange={(e) => setSvc({ ...svc, terms_text: e.target.value })} placeholder="Your own terms. Nova does not write these for you." /></label>
              <label className="desk-check"><input type="checkbox" checked={svc.terms_approved} onChange={(e) => setSvc({ ...svc, terms_approved: e.target.checked })} />I approve this wording.</label>
              <label>Customers usually come back every (days, optional)<input inputMode="numeric" value={svc.return_days} onChange={(e) => setSvc({ ...svc, return_days: e.target.value })} placeholder="14" /></label>
              <label className="desk-check"><input type="checkbox" checked={svc.active} onChange={(e) => setSvc({ ...svc, active: e.target.checked })} />Offer this service to customers</label>
              <div className="luxe-actions"><button className="luxe-button" disabled={busy}>{busy ? 'Saving…' : 'Save service'}</button><button type="button" className="luxe-link" onClick={() => setSvc(EMPTY_SERVICE)}>Clear</button></div>
            </form>
          </section>
        </div>
      )}

      {data && tab === 'offers' && (
        <div className="luxe-grid-two">
          <section className="luxe-panel">
            <div className="luxe-panel-title"><h2>Your offers</h2></div>
            {offers.length ? offers.map((o) => (
              <article className="desk-row" key={o.id}><div><strong>{o.code} · {o.percent_off}% off</strong><p>{(OFFER_TRIGGERS.find((t) => t[0] === o.trigger_type) || [0, o.trigger_type])[1]}{o.expires_at ? ` · ends ${new Date(o.expires_at).toLocaleDateString('en-US')}` : ' · no end date'}</p></div><span className="luxe-badge">{!o.approved ? 'Not approved' : o.active === false ? 'Off' : o.expires_at && new Date(o.expires_at) < new Date() ? 'Ended' : 'Live'}</span><button className="luxe-outline" onClick={() => setOffer({ code: o.code, percent_off: String(o.percent_off), trigger_type: o.trigger_type, description: o.description || '', expires_at: o.expires_at ? o.expires_at.slice(0, 10) : '', approved: o.approved === true })}>Edit</button></article>
            )) : <div className="luxe-empty">No offers yet.</div>}
            <p className="desk-note">Comment, message and follow offers start working when that social account is connected. The request-page offer works now.</p>
          </section>
          <section className="luxe-panel">
            <div className="luxe-panel-title"><h2>Add or change an offer</h2></div>
            <form className="luxe-form" onSubmit={saveOffer}>
              <div className="desk-pair"><label>Code<input value={offer.code} maxLength={40} onChange={(e) => setOffer({ ...offer, code: e.target.value.toUpperCase() })} placeholder="FRIDAY" /></label><label>Percent off<input inputMode="numeric" value={offer.percent_off} onChange={(e) => setOffer({ ...offer, percent_off: e.target.value })} /></label></div>
              <label>Who gets it<select value={offer.trigger_type} onChange={(e) => setOffer({ ...offer, trigger_type: e.target.value })}>{OFFER_TRIGGERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label>What the customer reads<input value={offer.description} maxLength={300} onChange={(e) => setOffer({ ...offer, description: e.target.value })} /></label>
              <label>Last day (optional)<input type="date" value={offer.expires_at} onChange={(e) => setOffer({ ...offer, expires_at: e.target.value })} /></label>
              <label className="desk-check"><input type="checkbox" checked={offer.approved} onChange={(e) => setOffer({ ...offer, approved: e.target.checked })} />I approve this discount. It can be given to customers.</label>
              <button className="luxe-button" disabled={busy}>Save offer</button>
            </form>
          </section>
        </div>
      )}

      {data && tab === 'customers' && (
        <section className="luxe-panel">
          <div className="luxe-panel-title"><h2>Every customer, start to finish</h2><span className="luxe-badge">{journeys.length}</span></div>
          {journeys.length ? journeys.map((j) => (
            <article className="desk-journey" key={j.id}>
              <button className="desk-row desk-row-button" aria-expanded={open === j.id} onClick={() => toggle(j)}>
                <div><strong>{j.customer_name || 'Customer'} · {serviceName(j.service_id)}</strong><p>{waitingLabel(j) || 'Nothing waiting'} · came in by {j.source_channel} · {when(j.updated_at)}</p></div>
                <span>{j.total_cents ? `${dollars(j.paid_cents)} of ${dollars(j.total_cents)}` : ''}</span><span className="luxe-badge">{STAGE_LABELS[j.stage] || j.stage}</span>
              </button>
              {open === j.id && (
                <div className="desk-detail">
                  {j.request_text && <p className="desk-quote">“{j.request_text}”</p>}
                  {!detail ? <p role="status">Loading…</p> : <>
                    {detail.customer && <p className="desk-note">{[detail.customer.name, detail.customer.phone, detail.customer.email].filter(Boolean).join(' · ')}</p>}
                    <ol className="desk-events">{detail.events.map((ev) => <li key={ev.id}><strong>{String(ev.action || '').replaceAll('_', ' ')}</strong> <span>{String(ev.agent || '').replaceAll('_', ' ')} · {when(ev.created_at)}</span></li>)}</ol>
                    {detail.documents.map((d) => <details key={d.id}><summary>{String(d.kind).replaceAll('_', ' ')}{d.amount_cents ? ` · ${dollars(d.amount_cents)}` : ''} · {d.status}</summary><pre>{d.body}</pre></details>)}
                    {detail.assignment && <JobPhotos orgId={orgId} journeyId={j.id} />}
                  </>}
                  {['deposit_due', 'balance_due'].includes(j.stage) && <div className="desk-inline"><label>Amount received ($)<input inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label><label>Note (cash, check number…)<input value={pay.reference} maxLength={120} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></label><button className="luxe-button" disabled={busy} onClick={() => recordPayment(j)}>Record payment</button></div>}
                  {['scheduling', 'scheduled'].includes(j.stage) && (extra.team?.workers || []).some((w) => w.active) && (
                    <div className="desk-inline">
                      <label>Who does this job{detail?.assignment ? ` (now: ${(extra.team.workers.find((w) => w.id === detail.assignment.worker_id) || {}).name || 'someone'})` : ''}
                        <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}><option value="">Choose a worker</option>{extra.team.workers.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}{w.kind === 'contractor' ? ' (pro)' : ''}</option>)}</select>
                      </label>
                      <button className="luxe-button" disabled={busy || !assignTo} onClick={() => act(() => call('journey', 'assign', { orgId, body: { journey_id: j.id, worker_id: assignTo } }), 'Assigned. It is on their phone page now.').then(() => setOpen(null))}>Assign</button>
                    </div>
                  )}
                  {j.stage === 'scheduled' && <div className="desk-inline"><label>Completion note (optional)<input value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /></label><button className="luxe-button" disabled={busy} onClick={() => act(() => call('journey', 'complete', { orgId, body: { journey_id: j.id, note } }), 'Work marked done. Any balance has been invoiced.').then(() => setOpen(null))}>Mark work done</button></div>}
                  {!['closed', 'cancelled'].includes(j.stage) && <button className="luxe-outline" disabled={busy} onClick={() => act(() => call('journey', j.paused ? 'resume' : 'pause', { orgId, body: { journey_id: j.id } }), j.paused ? 'The workers have picked this customer back up.' : 'Paused. The workers will leave this customer to you.')}>{j.paused ? 'Hand back to the workers' : 'Take over myself'}</button>}
                </div>
              )}
            </article>
          )) : <div className="luxe-empty">No customers yet. Share your request page to get the first one.</div>}
        </section>
      )}

      {data && tab === 'money' && (
        <section className="luxe-panel">
          <div className="luxe-panel-title"><h2>Money owed to you</h2><span className="luxe-badge">{dollars(extra.receivables?.total_cents || 0)}</span></div>
          {!extra.receivables ? <p role="status">Loading…</p> : extra.receivables.rows.length ? <div className="luxe-table-wrap"><table className="luxe-table"><thead><tr><th>Customer</th><th>What</th><th>Amount</th><th>Days waiting</th></tr></thead><tbody>{extra.receivables.rows.map((r) => <tr key={r.journey_id + r.kind}><td>{journeys.find((j) => j.id === r.journey_id)?.customer_name || 'Customer'} · {serviceName(journeys.find((j) => j.id === r.journey_id)?.service_id)}</td><td>{r.kind === 'deposit_invoice' ? 'Deposit' : 'Balance'}</td><td>{dollars(r.amount_cents)}</td><td>{r.days_outstanding}</td></tr>)}</tbody></table></div> : <div className="luxe-empty">Nobody owes you anything right now.</div>}
          <p className="desk-note">Record cash, check or transfer payments under Customers. Card payments made on Stripe's page are recorded by themselves.</p>
          <div className="desk-inline">
            <label>Month for your accountant<input type="month" value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} /></label>
            <button className="luxe-outline" disabled={busy || !exportMonth} onClick={() => act(() => call('journey', 'bookkeeping-export', { orgId, query: `&month=${exportMonth}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York')}` })).then((d) => {
              if (!d) return;
              const url = URL.createObjectURL(new Blob([d.csv], { type: 'text/csv;charset=utf-8' }));
              const a = document.createElement('a'); a.href = url; a.download = d.filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
              setNotice(`Downloaded ${d.counts.invoices} invoice${d.counts.invoices === 1 ? '' : 's'}, ${d.counts.payments} payment${d.counts.payments === 1 ? '' : 's'} and ${d.counts.shares} pay share${d.counts.shares === 1 ? '' : 's'}.`);
            })}>Download CSV</button>
          </div>
        </section>
      )}
      {data && tab === 'money' && (
        <section className="luxe-panel">
          <div className="luxe-panel-title"><h2>Card payments</h2><span className="luxe-badge">{!extra.payments ? '…' : extra.payments.ready ? 'On' : extra.payments.connected ? 'Sign-up not finished' : 'Not connected'}</span></div>
          {!extra.payments ? <p role="status">Loading…</p> : (
            <>
              <p>{extra.payments.note}</p>
              <p className="desk-note">Customers pay deposits and balances on Stripe's own page, and the money goes to your own Stripe account. Stripe charges its card fee to you; Nova takes nothing from the payment.{extra.payments.mode === 'test' ? ' Test mode: only Stripe test cards work.' : ''}</p>
              {extra.payments.switch_on && (
                <div className="luxe-actions">
                  {!extra.payments.ready && <button className="luxe-button" disabled={busy} onClick={() => act(() => call('journey', 'card-payments-connect', { orgId, body: {} })).then((d) => { if (d?.url) window.location.assign(d.url); })}>{extra.payments.connected ? 'Finish Stripe sign-up' : 'Connect Stripe'}</button>}
                  {extra.payments.connected && <button className="luxe-outline" disabled={busy} onClick={() => act(() => call('journey', 'card-payments-refresh', { orgId, body: {} })).then((d) => d && setExtra((x) => ({ ...x, payments: d.payments })))}>Check status</button>}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {data && tab === 'revive' && (
        <section className="luxe-panel">
          <div className="luxe-panel-title"><h2>Customers worth contacting again</h2></div>
          {!extra.revive ? <p role="status">Loading…</p> : <>
            <h3>Past customers who are due back ({extra.revive.overdue.length})</h3>
            {extra.revive.overdue.length ? <ul className="desk-list">{extra.revive.overdue.map((o, i) => <li key={i}>{o.service?.name || 'A past job'} · {o.days_overdue} days past the usual return time</li>)}</ul> : <p className="desk-note">Nobody yet. Set “customers usually come back every” on a service so Nova knows when someone is due.</p>}
            <h3>People who asked and went quiet ({extra.revive.cold_leads.length})</h3>
            {extra.revive.cold_leads.length ? <ul className="desk-list">{extra.revive.cold_leads.map((o, i) => <li key={i}>{serviceName(o.service_id)} · quiet for {o.days_since} days</li>)}</ul> : <p className="desk-note">Nobody has gone quiet.</p>}
            <div className="luxe-actions">
              <button className="luxe-button" disabled={busy} onClick={() => act(() => call('journey', 'revive-run', { orgId, body: { business_name: currentOrg?.name || '' } }), (d) => `${d.prepared} message${d.prepared === 1 ? '' : 's'} prepared${d.reopened ? `, ${d.reopened} earlier one${d.reopened === 1 ? '' : 's'} now ready` : ''}. ${d.email_ready ? 'Messages for customers who agreed to email are ready to send.' : `Nothing can be emailed yet: ${d.email_note}`}`)}>Prepare come-back messages</button>
              <button className="luxe-outline" disabled={busy} onClick={() => act(() => call('journey', 'revive-send', { orgId, body: {} }), (d) => `${d.sent} email${d.sent === 1 ? '' : 's'} sent${d.held ? `, ${d.held} held back (the customer opted out)` : ''}${d.failed ? `, ${d.failed} not accepted by the email provider (still ready to try again)` : ''}${d.waiting_for_tomorrow ? `, ${d.waiting_for_tomorrow} waiting for tomorrow's allowance` : ''}.`)}>Send ready emails</button>
            </div>
            <p className="desk-note">Only people who agreed to be contacted are included, and each email has an unsubscribe link. Texts wait until texting is approved for this business.</p>
          </>}
        </section>
      )}

      {data && tab === 'results' && (
        <section className="luxe-panel">
          <div className="luxe-panel-title"><h2>The last 7 days</h2></div>
          {!extra.results ? <p role="status">Loading…</p> : <>
            <div className="luxe-metrics">{[['New requests', extra.results.scorecard.inquiries.total], ['Quotes accepted', extra.results.scorecard.quotes.accepted], ['Booked', extra.results.scorecard.appointments_booked], ['Jobs done', extra.results.scorecard.jobs_completed], ['Collected', dollars(extra.results.scorecard.money_collected.total_cents)], ['Still owed', dollars(extra.results.scorecard.money_owed_now.total_cents)]].map(([l, v]) => <div className="luxe-metric" key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>
            <pre className="desk-report">{extra.results.text}</pre>
            <p className="desk-note">Every number comes from saved records. Payments you typed in are counted separately from payments confirmed by a payment provider.</p>
            <div className="luxe-actions"><button className="luxe-outline" disabled={busy} onClick={() => act(() => call('journey', 'send-scorecard', { orgId, body: {} }), (d) => (d.sent ? `Report emailed to ${d.to}.` : 'This report was already emailed today.'))}>Email me this report</button></div>
            <h3>What customers said</h3>
            {extra.feedback?.length ? <ul className="desk-list">{extra.feedback.slice(0, 30).map((f) => <li key={f.id}><strong>{f.rating} out of 5</strong> · {f.customer_name}{f.comment ? ` · “${f.comment}”` : ''}{f.follow_up === 'owner_to_call' && <> · <span className="luxe-badge">Call them</span> <button className="luxe-link" disabled={busy} onClick={() => act(() => call('journey', 'feedback-resolve', { orgId, body: { feedback_id: f.id } }), 'Marked as handled.').then(() => call('journey', 'feedback', { orgId }).then((d) => setExtra((x) => ({ ...x, feedback: d.feedback }))))}>Mark handled</button></>}</li>)}</ul> : <p className="desk-note">No ratings yet. After a paid job, customers are asked "How did we do, 1 to 5?" on their own page, and by email through the come-back list.</p>}
          </>}
        </section>
      )}

      {data && tab === 'team' && (
        <>
          <section className="luxe-panel">
            <div className="luxe-panel-title"><h2>Who does the jobs</h2><span className="luxe-badge">{(extra.team?.workers || []).filter((w) => w.active).length} active</span></div>
            {crewLink && <div className="luxe-panel desk-link"><p>Send this private link to the worker. It opens their jobs on their phone. It is shown only once; make a new one if it is lost.</p><code>{crewLink}</code><button className="luxe-outline" onClick={() => navigator.clipboard?.writeText(crewLink).then(() => setNotice('Link copied.'))}><Copy size={14} />Copy link</button></div>}
            {!extra.team ? <p role="status">Loading…</p> : extra.team.workers.length ? extra.team.workers.map((w) => (
              <article className="desk-row" key={w.id}>
                <div><strong>{w.name}{w.active ? '' : ' (off)'}</strong><p>{w.kind === 'contractor' ? 'Independent pro' : 'Employee'}{w.phone ? ` · ${w.phone}` : ''}{w.unpaid_cents ? ` · not yet paid out: ${dollars(w.unpaid_cents)}` : ''}</p></div>
                <button className="luxe-outline" disabled={busy} onClick={() => act(() => call('journey', 'worker-link', { orgId, body: { worker_id: w.id } })).then((d) => d?.link && setCrewLink(d.link))}>New phone link</button>
                <button className="luxe-link" disabled={busy} onClick={() => act(() => call('journey', 'save-worker', { orgId, body: { worker_id: w.id, name: w.name, phone: w.phone, email: w.email, kind: w.kind, active: !w.active } }), w.active ? 'Turned off. Their open jobs are unassigned and their link no longer shows jobs.' : 'Turned back on.')}>{w.active ? 'Turn off' : 'Turn on'}</button>
              </article>
            )) : <div className="luxe-empty">No workers yet. Add the first one below.</div>}
            <form className="luxe-form" onSubmit={(e) => { e.preventDefault(); act(() => call('journey', 'save-worker', { orgId, body: worker }), 'Worker added.').then((d) => { if (d) { setWorker(EMPTY_WORKER); if (d.link) setCrewLink(d.link); } }); }}>
              <div className="desk-pair"><label>Name<input value={worker.name} maxLength={100} required onChange={(e) => setWorker({ ...worker, name: e.target.value })} /></label><label>Mobile<input value={worker.phone} onChange={(e) => setWorker({ ...worker, phone: e.target.value })} /></label></div>
              <div className="desk-pair"><label>Email (optional)<input type="email" value={worker.email} onChange={(e) => setWorker({ ...worker, email: e.target.value })} /></label><label>They are<select value={worker.kind} onChange={(e) => setWorker({ ...worker, kind: e.target.value })}><option value="contractor">An independent pro (own business, own equipment)</option><option value="employee">An employee</option></select></label></div>
              <button className="luxe-button" disabled={busy}>Add worker</button>
            </form>
            <p className="desk-note">Whether someone is an employee or an independent pro is a legal question with tax and insurance consequences. Ask your accountant; this screen only records what you choose.</p>
          </section>
          <section className="luxe-panel">
            <div className="luxe-panel-title"><h2>How money from a paid job is split</h2><span className="luxe-badge">{extra.team?.rule?.approved ? 'Approved' : 'Not approved'}</span></div>
            <p className="desk-note">When a job is fully paid, each share of the money actually received is recorded below. Nothing is paid automatically; you pay people and mark it here. Card fees and costs are not taken out first.</p>
            {shares.map((r, i) => (
              <div className="desk-pair" key={i}>
                <label>Share name<input value={r.label} maxLength={60} onChange={(e) => setShares(shares.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} /></label>
                <label>Percent<input inputMode="decimal" value={r.percent} onChange={(e) => setShares(shares.map((x, k) => (k === i ? { ...x, percent: e.target.value } : x)))} /></label>
                <label className="desk-check"><input type="checkbox" checked={r.to_worker} onChange={(e) => setShares(shares.map((x, k) => ({ ...x, to_worker: k === i ? e.target.checked : e.target.checked ? false : x.to_worker })))} />Goes to whoever did the job</label>
                {shares.length > 1 && <button type="button" className="luxe-link" onClick={() => setShares(shares.filter((_, k) => k !== i))}>Remove</button>}
              </div>
            ))}
            <p className="desk-note">Total: {shares.reduce((n, r) => n + (Number(r.percent) || 0), 0)}% (must be exactly 100%).</p>
            {shares.length < 6 && <button type="button" className="luxe-link" onClick={() => setShares([...shares, { label: '', percent: '', to_worker: false }])}>Add a share</button>}
            <label className="desk-check"><input type="checkbox" checked={splitOk} onChange={(e) => setSplitOk(e.target.checked)} />I approve this split for every paid job from now on.</label>
            <div className="luxe-actions"><button className="luxe-button" disabled={busy} onClick={() => act(() => call('journey', 'save-split', { orgId, body: { shares: shares.map((r) => ({ ...r, percent: Number(r.percent) })), approved: splitOk } }), splitOk ? 'Split saved and approved.' : 'Split saved. It is not used until you approve it.')}>Save split</button></div>
          </section>
          <section className="luxe-panel">
            <div className="luxe-panel-title"><h2>Shares from paid jobs</h2></div>
            {!extra.team ? null : extra.team.entries.length ? <div className="luxe-table-wrap"><table className="luxe-table"><thead><tr><th>Job</th><th>Share</th><th>Amount</th><th>Paid out</th></tr></thead><tbody>{extra.team.entries.map((e) => { const j = journeys.find((x) => x.id === e.journey_id); const w = extra.team.workers.find((x) => x.id === e.worker_id); return <tr key={e.id}><td>{j?.customer_name || 'Customer'} · {serviceName(j?.service_id)}</td><td>{e.label}{w ? ` (${w.name})` : ''} · {Number(e.percent)}% of {dollars(e.basis_cents)}</td><td>{dollars(e.amount_cents)}</td><td>{e.paid_out_at ? new Date(e.paid_out_at).toLocaleDateString('en-US') : <button className="luxe-link" disabled={busy} onClick={() => act(() => call('journey', 'mark-paid-out', { orgId, body: { entry_id: e.id } }), 'Marked as paid out.')}>Mark paid out</button>}</td></tr>; })}</tbody></table></div> : <div className="luxe-empty">No paid jobs with an approved split yet.</div>}
          </section>
        </>
      )}

      {data && tab === 'messages' && <MessagesTab orgId={orgId} call={call} busy={busy} setBusy={setBusy} setError={setError} setNotice={setNotice} />}
      {data && tab === 'calls' && <CallsTab orgId={orgId} call={call} setError={setError} />}
      {data && tab === 'install' && <InstallTab orgId={orgId} call={call} busy={busy} setBusy={setBusy} setError={setError} setNotice={setNotice} agent={agent} saveBase={saveBase} services={services} extra={extra} slug={currentOrg?.slug || ''} reloadAgent={loadAgent} />}

      {data && tab === 'assistant' && (
        <section className="luxe-panel">
          <div className="luxe-panel-title"><h2>What your assistant knows</h2><span className="luxe-badge">{agent.status === 'active' ? 'Live' : agent.status === 'paused' ? 'Paused' : 'Draft · not answering customers'}</span></div>
          <p className="desk-note">Saving these details does not switch anything on or off; that is done under Switch on. Texting and calls need a phone number approved for this business{extra.spending === false ? ' and spending unlocked' : ''}. <Link className="luxe-link" to="/dashboard/integrations">Check connections</Link></p>
          <form className="luxe-form" onSubmit={saveAgent}>
            <div className="desk-pair"><label>Business name<input value={agent.business_name} maxLength={200} onChange={(e) => setAgent({ ...agent, business_name: e.target.value })} /></label><label>Assistant’s name<input value={agent.agent_name} maxLength={80} onChange={(e) => setAgent({ ...agent, agent_name: e.target.value })} placeholder="Mia" /></label></div>
            <div className="desk-pair"><label>Type of business<input value={agent.industry} maxLength={120} onChange={(e) => setAgent({ ...agent, industry: e.target.value })} /></label><label>Tone<select value={agent.tone} onChange={(e) => setAgent({ ...agent, tone: e.target.value })}>{['friendly', 'professional', 'casual'].map((t) => <option key={t}>{t}</option>)}</select></label></div>
            <label>First thing it says<input value={agent.greeting} maxLength={500} onChange={(e) => setAgent({ ...agent, greeting: e.target.value })} /></label>
            <label>Area you serve<input value={agent.service_area} maxLength={500} onChange={(e) => setAgent({ ...agent, service_area: e.target.value })} /></label>
            <label>When to hand a customer to a person<textarea value={agent.handoff_instructions} maxLength={1000} onChange={(e) => setAgent({ ...agent, handoff_instructions: e.target.value })} /></label>
            <label>Things it must never say<textarea value={agent.never_say} maxLength={1000} onChange={(e) => setAgent({ ...agent, never_say: e.target.value })} /></label>
            <div className="desk-pair"><label>Business phone (optional)<input value={agent.phone_number} onChange={(e) => setAgent({ ...agent, phone_number: e.target.value })} placeholder="+18605551234" /></label><label>Your phone for alerts (optional)<input value={agent.owner_alert_phone} onChange={(e) => setAgent({ ...agent, owner_alert_phone: e.target.value })} /></label></div>
            <h3>Email</h3>
            <div className="desk-pair"><label>Email for customer replies and your weekly report<input type="email" value={agent.reply_email} maxLength={254} onChange={(e) => setAgent({ ...agent, reply_email: e.target.value })} /></label><label>Business mailing address (printed in marketing emails, as US law requires)<input value={agent.mailing_address} maxLength={300} onChange={(e) => setAgent({ ...agent, mailing_address: e.target.value })} placeholder="Street, town, state, ZIP" /></label></div>
            <label>Your review page link (for example your Google review link). Offered to every customer who rates a job, whatever the rating, as Google's rules require.<input value={agent.review_url} maxLength={500} placeholder="https://" onChange={(e) => setAgent({ ...agent, review_url: e.target.value })} /></label>
            <label className="desk-check"><input type="checkbox" checked={agent.email_enabled === true} onChange={(e) => setAgent({ ...agent, email_enabled: e.target.checked })} /> Send come-back emails to customers who agreed to email, and email me the weekly report</label>
            <button className="luxe-button" disabled={busy}>Save assistant details</button>
          </form>
        </section>
      )}
    </div>
  );
}
