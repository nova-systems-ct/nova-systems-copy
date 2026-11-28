// Each export is a complete, dated cohort from one named source. Retests use the same definition.
export const RECORD_METHOD = 'owner_export_v1'
export const MAX_CSV_BYTES = 512 * 1024
const DAY = 86400000
export const EXPORTS = {
  calls: {
    label: 'Inbound calls', headers: 'id,date,direction,outcome',
    help: 'Use inbound or outbound. Use person, assistant, voicemail, missed or unknown. A carrier status of completed alone cannot identify who answered.',
    unit: 'answer rate', fix: 'Front desk and missed-call follow-up',
  },
  quotes: {
    label: 'Quotes issued', headers: 'id,date,status',
    help: 'Give each issued quote its status at the end of the period: accepted, open, declined, expired or unknown. Exclude drafts.',
    unit: 'acceptance rate', fix: 'Approved quotes and quote follow-up',
  },
  invoices: {
    label: 'Invoices issued', headers: 'id,date,total_cents,outstanding_cents',
    help: 'Enter USD in whole cents. Use each invoice’s balance as of the end date. Exclude void invoices and credit notes.',
    unit: 'unpaid share of billed dollars', fix: 'Billing and balance reminders',
  },
}
export function readCSV(input) {
  if (typeof input !== 'string' || !input.trim() || new TextEncoder().encode(input).length > MAX_CSV_BYTES) throw new Error('Choose a nonempty CSV of 512 KiB or less.')
  const text = input.replace(/^\uFEFF/, '')
  const rows = []
  let row = [], cell = '', quoted = false, closed = false
  function endRow() {
    row.push(cell.trim())
    if (row.some(Boolean)) rows.push(row)
    if (rows.length > 5001) throw new Error('Split the export into windows of at most 5,000 rows.')
    row = []; cell = ''; closed = false
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') { quoted = false; closed = true }
      else cell += c
    } else if (c === ',') { row.push(cell.trim()); cell = ''; closed = false }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; endRow() }
    else if (c === '"' && !cell && !closed) quoted = true
    else if (c === '"' || (closed && c.trim())) throw new Error('Malformed quoted CSV field.')
    else cell += c
  }
  if (quoted) throw new Error('Unclosed CSV quotation mark.')
  endRow()
  return rows
}
function day(value) {
  if (!/^\d{4}-\d\d-\d\d$/.test(value || '')) return NaN
  const ms = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : NaN
}
const cents = value => /^\d{1,12}$/.test(value) ? Number(value) : NaN
export function summarizeExport({ kind, source, start, end, csv }, today = new Date()) {
  if (!Object.hasOwn(EXPORTS, kind)) throw new Error('Choose calls, quotes or invoices.')
  source = String(source || '').trim().replace(/\s+/g, ' ')
  if (source.length < 2 || source.length > 100) throw new Error('Name the source account or ledger (2–100 characters).')
  const first = day(start), last = day(end)
  if (!Number.isFinite(first + last) || first > last || last > day(today.toISOString().slice(0, 10))) throw new Error('Choose a valid, completed date range.')
  const rows = readCSV(csv)
  const headers = rows.shift()?.map(v => v.toLowerCase()) || []
  const fields = EXPORTS[kind].headers.split(',')
  if (new Set(headers).size !== headers.length || fields.some(f => !headers.includes(f))) throw new Error('Required headings: ' + fields.join(', '))
  const seen = new Map()
  const stats = { records: 0, unknown: 0, excluded: 0, duplicates: 0, numerator: 0, denominator: 0 }
  for (const [i, row] of rows.entries()) {
    const error = message => { throw new Error(`Row ${i + 2}: ${message}`) }
    if (row.length !== headers.length) error('column count differs from the header.')
    const values = fields.map(f => row[headers.indexOf(f)])
    const [id, date, a, b] = values
    if (!id || id.length > 200) error('supply a stable record ID.')
    if (!Number.isFinite(day(date)) || date < start || date > end) error('date must be YYYY-MM-DD within the selected window.')
    const signature = JSON.stringify(values.slice(1))
    if (seen.has(id)) {
      if (seen.get(id) !== signature) error('conflicting versions of one record ID.')
      stats.duplicates++; continue
    }
    seen.set(id, signature)
    if (kind === 'calls') {
      if (!['inbound', 'outbound'].includes(a)) error('use inbound or outbound.')
      if (a === 'outbound') { stats.excluded++; continue }
      if (!['person','assistant','missed','voicemail','unknown','completed'].includes(b)) error('unrecognized call outcome.')
      if (['unknown','completed'].includes(b)) stats.unknown++
      else { stats.denominator++; if (b === 'person' || b === 'assistant') stats.numerator++ }
    } else if (kind === 'quotes') {
      if (!['open','accepted','declined','expired','unknown'].includes(a)) error('unrecognized issued-quote status.')
      if (a === 'unknown') stats.unknown++
      else { stats.denominator++; if (a === 'accepted') stats.numerator++ }
    } else {
      const total = cents(a), outstanding = cents(b)
      if (!Number.isFinite(total + outstanding) || outstanding > total) error('balances must be whole cents from zero to the invoice total.')
      stats.numerator += outstanding; stats.denominator += total
    }
    stats.records++
  }
  return { version: 1, kind, source, start, end, days: (last - first) / DAY + 1, ...stats }
}
export function exportFrom(row) {
  if (row?.method !== RECORD_METHOD) return null
  try {
    const s = JSON.parse(row.observation)
    return s.version === 1 && Object.hasOwn(EXPORTS, s.kind) && Number.isSafeInteger(s.records) ? { ...s, evidenceId: row.id } : null
  } catch { return null }
}
export const percent = s => s.denominator ? Math.round(1000 * s.numerator / s.denominator) / 10 : null
export function measured(s) {
  const p = percent(s)
  const fraction = s.kind === 'invoices'
    ? `$${(s.numerator / 100).toFixed(2)} outstanding of $${(s.denominator / 100).toFixed(2)} issued`
    : `${s.numerator} of ${s.denominator} known outcomes`
  return `${fraction} · ${p === null ? 'rate unavailable' : p + '%'} · ${s.records} records · ${s.unknown} unknown`
}
export function compareExports(before, after) {
  if (!before || !after) return { reason: 'Select a baseline and a retest.' }
  if (before.kind !== after.kind || before.source.toLowerCase() !== after.source.toLowerCase()) return { reason: 'Use the same metric and source account.' }
  if (before.end >= after.start || before.days !== after.days) return { reason: 'Use a later, nonoverlapping period of the same length.' }
  if (!before.denominator || !after.denominator || before.unknown || after.unknown) return { reason: 'A denominator is empty or outcomes are unknown. Counts are available; the change is inconclusive.' }
  const delta = Math.round(1000 * (after.numerator / after.denominator - before.numerator / before.denominator)) / 10
  return { delta, unit: 'percentage points' }
}
