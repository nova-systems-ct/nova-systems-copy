import { useState } from 'react'
import { authedFetch } from '../../lib/apiAuth'
import { EXPORTS, MAX_CSV_BYTES, measured, compareExports, readCSV } from '../../lib/auditRecords'

export default function AuditRecordWindows({ caseId, orgId, records, onSaved }) {
  const [kind, setKind] = useState('calls')
  const [ids, setIds] = useState({ before: '', after: '' })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const before = records.find(s => s.evidenceId === ids.before), after = records.find(s => s.evidenceId === ids.after)
  const comparison = compareExports(before, after)
  async function save(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const file = form.get('export')
    setStatus(''); setBusy(true)
    try {
      if (!file?.size || file.size > MAX_CSV_BYTES) throw new Error('Choose a CSV of 512 KiB or less.')
      // Drop unrelated columns (for example caller names and phone numbers) before transmission.
      const rows = readCSV(await file.text())
      const headings = (rows.shift() || []).map(h => h.toLowerCase())
      const keys = EXPORTS[kind].headers.split(',')
      const cols = keys.map(k => headings.indexOf(k))
      if (cols.includes(-1) || new Set(headings).size !== headings.length || rows.some(row => row.length !== headings.length)) throw new Error('Check headings and row lengths against the format below.')
      const csv = [keys, ...rows.map(row => cols.map(i => row[i]))].map(row => row.map(c => '"' + c.replaceAll('"', '""') + '"').join(',')).join('\n')
      const body = { kind, csv, organization_id: orgId, case_id: caseId, source: form.get('source'), start: form.get('start'), end: form.get('end'), permission_ref: form.get('permission'), complete: form.has('complete') }
      const response = await authedFetch('/api/client?resource=audit&op=record-window', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)})
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Import failed.')
      setStatus(`${result.repeated ? 'These measures were already saved.' : 'Evidence saved.'} ${result.duplicates} duplicate rows ignored.`)
      onSaved()
    } catch (err) { setStatus(err.message || 'Import failed.') } finally { setBusy(false) }
  }
  const style = { display: 'grid', gap: 10, padding: 20, border: '1px solid #514c3e', borderRadius: 10, marginBottom: 20 }
  return <section style={style}>
    <h3>Business records and results</h3>
    <form style={{display:'grid', gap:8}} onSubmit={save}>
      <label>Records <select value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(EXPORTS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
      <p>{EXPORTS[kind].help} Dates use the business’s local calendar. CSV headings <code>{EXPORTS[kind].headers}</code>.</p>
      <label>Source account <input name="source" placeholder="Front desk phone ledger" maxLength={100} required /></label>
      <label>From <input type="date" name="start" required /></label><label>Through <input type="date" name="end" required /></label>
      <label>Written permission reference <input name="permission" maxLength={160} required /></label>
      <label>CSV export <input type="file" name="export" accept=".csv,text/csv" required /></label>
      <label><input type="checkbox" name="complete" required /> This is the complete export for this account and period, with outcomes as of the end date.</label>
      <button className="luxe-outline" disabled={busy}>{busy ? 'Saving…' : 'Import measured evidence'}</button>
      {status && <p role="status">{status}</p>}
    </form>
    {records.length > 0 && <><h4>Compare a baseline and retest</h4>
      {['before','after'].map(key => <label key={key}>{key === 'before' ? 'Baseline' : 'Retest'} <select value={ids[key]} onChange={e => setIds({...ids,[key]:e.target.value})}><option value="">Choose a period</option>{records.map(s => <option key={s.evidenceId} value={s.evidenceId}>{EXPORTS[s.kind].label} · {s.source} · {s.start} to {s.end}</option>)}</select></label>)}
      {before && <p>Before · {measured(before)}</p>}{after && <p>After · {measured(after)}</p>}
      <p aria-live="polite">{comparison.reason || `Change in ${EXPORTS[before.kind].unit}: ${comparison.delta > 0 ? '+' : ''}${comparison.delta} percentage points. This is an observed change; attribution requires linked work records.`}</p>
    </>}
  </section>
}
