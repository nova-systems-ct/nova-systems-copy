import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrg } from '../../../lib/OrgContext'
import { api, useLoad, dt, money, label } from '../../../lib/salesApi'
import { Page, Card, Muted, Btn, Badge, Banner, Field, Input, Textarea, Select, Modal, Table, Tabs, Loading, Stats, Stat, FAINT, GOOD, LINE, useNotice } from '../../../components/sales/kit'

const TONE = { active: 'good', candidate: 'gold', suspended: 'bad', inactive: 'muted' }

export default function Reps() {
  const [sp, setSp] = useSearchParams()
  const [status, setStatus] = useState('')
  const { data, loading, error, reload } = useLoad(() => api('salesteam', 'reps', { method: 'GET', query: { status } }), [status])
  return (
    <Page eyebrow="Sales Team" title="Representatives" subtitle="Candidates become representatives only when the owner activates them. Suspension keeps all history." wide>
      <div style={{ marginBottom: 14, maxWidth: 240 }}><Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{['candidate', 'active', 'suspended', 'inactive'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></div>
      {error && <Banner tone="bad">{error}</Banner>}
      {loading && !data ? <Loading /> : (
        <Card><Table rows={data || []} onRow={(r) => setSp({ id: r.id })} empty="No representatives or candidates yet." columns={[
          { key: 'n', label: 'Name', render: (r) => <><strong>{r.display_name || r.email}</strong><div style={{ color: FAINT, fontSize: 12 }}>{r.email}</div></> },
          { key: 's', label: 'Status', render: (r) => <Badge tone={TONE[r.status]}>{label(r.status)}</Badge> },
          { key: 'c', label: 'Checklist', render: (r) => `${r.checklist_done}/${r.checklist_total}${r.ready_for_activation ? ' — ready to activate' : ''}` },
          { key: 'a', label: 'Activated', render: (r) => dt(r.activated_at) },
        ]} /></Card>
      )}
      {sp.get('id') && <Detail id={sp.get('id')} onClose={() => { setSp({}); reload() }} />}
    </Page>
  )
}

function Detail({ id, onClose }) {
  const { hasPermission } = useOrg()
  const owner = hasPermission('sales.owner')
  const { data: d, loading, error, reload } = useLoad(() => api('salesteam', 'rep', { method: 'GET', query: { id } }), [id])
  const people = useLoad(() => api('salesteam', 'people', { method: 'GET' }), [])
  const [tab, setTab] = useState('checklist')
  const [note, setNote] = useState('')
  const [ev, setEv] = useState({})
  const { notice, show } = useNotice()
  if (loading && !d) return <Modal title="Representative" onClose={onClose} wide><Loading /></Modal>
  if (error && !d) return <Modal title="Representative" onClose={onClose}><Banner tone="bad">{error}</Banner></Modal>
  const { rep, checklist, notes, status_history: hist, training, documents, leads, ledger, application } = d
  const run = async (fn, ok) => { const r = await fn(); show(r, ok); if (r.ok) reload(); else if (r.data?.outstanding) show({ ok: false, data: { error: `${r.data.error} ${r.data.outstanding.map((o) => o.detail).join(' | ')}` } }); return r }
  const reason = (what) => window.prompt(`${what} — record the reason:`)
  return (
    <Modal title={`${rep.display_name || rep.email}`} onClose={onClose} wide>
      {notice}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Badge tone={TONE[rep.status]}>{label(rep.status)}</Badge><Muted>{rep.email}{application ? ` · application ${application.reference_code} (${label(application.status)})` : ''}</Muted>
      </div>
      {owner && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {rep.status === 'candidate' && <Btn kind="primary" disabled={!checklist.ready} title={checklist.ready ? '' : 'The checklist is not complete'} onClick={() => { if (window.confirm('Activate this representative? They will gain access to leads and the sales workspace.')) run(() => api('salesteam', 'activate', { body: { rep_id: id, confirm: true } }), 'Activated.') }}>Activate</Btn>}
          {rep.status === 'active' && <Btn kind="danger" onClick={() => { const r = reason('Suspend'); if (r) run(() => api('salesteam', 'suspend', { body: { rep_id: id, reason: r } }), 'Suspended. History kept.') }}>Suspend</Btn>}
          {rep.status === 'suspended' && <Btn kind="primary" onClick={() => { const r = reason('Reactivate'); if (r) run(() => api('salesteam', 'reactivate', { body: { rep_id: id, reason: r } }), 'Reactivated.') }}>Reactivate</Btn>}
          {['candidate', 'suspended', 'active'].includes(rep.status) && <Btn kind="quiet" onClick={() => { const r = reason('End engagement (deactivate)'); if (r) run(() => api('salesteam', 'deactivate', { body: { rep_id: id, reason: r } }), 'Deactivated.') }}>Deactivate</Btn>}
          <Select defaultValue={rep.manager_user_id || ''} onChange={(e) => run(() => api('salesteam', 'set-manager', { body: { rep_id: id, manager_user_id: e.target.value || null } }), 'Manager updated.')} style={{ maxWidth: 240 }} aria-label="Manager"><option value="">No manager</option>{(people.data || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'checklist', label: 'Activation checklist' }, { key: 'training', label: 'Training' }, { key: 'docs', label: 'Documents' }, { key: 'leads', label: 'Leads' }, ...(ledger ? [{ key: 'ledger', label: 'Ledger' }] : []), { key: 'notes', label: 'Notes & history' }]} />
      {tab === 'checklist' && (
        <>
          {checklist.policy_provisional && <Banner tone="warn">The activation policy has not been approved by the owner yet; the strict default is being applied.</Banner>}
          {checklist.items.map((i) => (
            <div key={i.key} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${LINE}` }}>
              <span style={{ color: i.done ? GOOD : FAINT, fontSize: 18 }}>{i.done ? '✓' : '○'}</span>
              <div style={{ flex: 1 }}><strong>{i.label}</strong><div style={{ color: FAINT, fontSize: 12.5 }}>{i.detail}</div></div>
            </div>
          ))}
          {owner && checklist.policy.operational_items.length > 0 && (
            <Card title="Operational setup (owner-verified, with evidence)" style={{ marginTop: 14 }}>
              {checklist.policy.operational_items.map((it) => { const s = rep.operational_setup?.[it.key]; return (
                <div key={it.key} style={{ padding: '8px 0', borderBottom: `1px solid ${LINE}` }}>
                  <strong>{it.label}</strong> {s?.done ? <Badge tone="good">Verified</Badge> : <Badge>Open</Badge>}
                  {s?.done && <div style={{ color: FAINT, fontSize: 12 }}>{s.evidence} — {dt(s.at)}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}><Input placeholder="Evidence: what you checked and how" value={ev[it.key] || ''} onChange={(e) => setEv({ ...ev, [it.key]: e.target.value })} style={{ flex: '1 1 260px' }} /><Btn small onClick={() => run(() => api('salesteam', 'mark-setup', { body: { rep_id: id, item_key: it.key, evidence: ev[it.key] || '' } }), 'Recorded.')}>Mark verified</Btn>{s?.done && <Btn small kind="quiet" onClick={() => run(() => api('salesteam', 'mark-setup', { body: { rep_id: id, item_key: it.key, done: false } }), 'Unchecked.')}>Uncheck</Btn>}</div>
                </div>) })}
            </Card>
          )}
        </>
      )}
      {tab === 'training' && <Table rows={training} empty="No enrollments." columns={[{ key: 'p', label: 'Program', render: (t) => t.academy_programs?.title }, { key: 's', label: 'Status', render: (t) => <Badge tone={t.status === 'completed' ? 'good' : 'muted'}>{label(t.status)}</Badge> }, { key: 'sc', label: 'Best score', render: (t) => (t.best_score != null ? `${t.best_score}%` : '—') }, { key: 'pr', label: 'Practical approved', render: (t) => dt(t.practical_approved_at) }]} />}
      {tab === 'docs' && <Table rows={Object.entries(documents).map(([k, v]) => ({ id: k, key: k, ...v }))} columns={[{ key: 't', label: 'Document', render: (r) => r.title }, { key: 's', label: 'State', render: (r) => <Badge tone={r.satisfied ? 'good' : 'warn'}>{label(r.state)}</Badge> }, { key: 'at', label: 'Signed', render: (r) => dt(r.signed_at) }]} />}
      {tab === 'leads' && <><Stats>{Object.entries(leads.by_stage).filter(([, c]) => c).map(([s, c]) => <Stat key={s} label={label(s)} value={c} />)}</Stats>{leads.total === 0 && <Muted>No leads assigned.</Muted>}</>}
      {tab === 'ledger' && ledger && <><Stats><Stat label="Estimated (not earned)" value={money(ledger.summary.estimated_not_earned_cents)} /><Stat label="Pending" value={money(ledger.summary.pending_cents)} /><Stat label="Eligible / approved" value={money(ledger.summary.eligible_cents)} /><Stat label="Paid" value={money(ledger.summary.paid_cents)} tone="good" /></Stats><Table rows={ledger.entries} empty="No entries." columns={[{ key: 'k', label: 'Kind', render: (e) => label(e.kind) }, { key: 's', label: 'State', render: (e) => label(e.status) }, { key: 'a', label: 'Amount', right: true, render: (e) => money(e.amount_cents, e.currency) }, { key: 'at', label: 'Created', render: (e) => dt(e.created_at) }]} /></>}
      {tab === 'notes' && (
        <>
          <Muted style={{ marginBottom: 10 }}>Notes are private to managers and the owner — the representative never sees them.</Muted>
          <Field label="Add a note"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <Btn onClick={async () => { const r = await run(() => api('salesteam', 'add-note', { body: { rep_id: id, note } }), 'Note added.'); if (r.ok) setNote('') }} disabled={note.length < 3}>Add note</Btn>
          <Card title="Notes" style={{ marginTop: 14 }}>{notes.length ? notes.map((n) => <p key={n.id} style={{ margin: '0 0 8px' }}><span style={{ color: FAINT }}>{dt(n.created_at)}</span> — {n.note}</p>) : <Muted>No notes.</Muted>}</Card>
          <Card title="Status history">{hist.length ? hist.map((h) => <p key={h.id} style={{ margin: '0 0 8px' }}><span style={{ color: FAINT }}>{dt(h.created_at)}</span> — {label(h.from_status)} → <strong>{label(h.to_status)}</strong>{h.reason ? `: ${h.reason}` : ''}</p>) : <Muted>No changes yet.</Muted>}</Card>
        </>
      )}
    </Modal>
  )
}
