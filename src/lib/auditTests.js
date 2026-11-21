// Helpers for the Audit "Customer tests" screen (system 22). Pure functions, no browser APIs, so
// they are unit-tested in scripts/unit_audit_screen_test.mjs.
// Mirrors CUSTOMER_TESTS in api/_auditTests.js (the server checks every value again).
export const TESTS = [
  ['phone_open_hours', 'Phone call during posted opening hours', 'seconds'],
  ['phone_after_hours', 'Phone call after hours', 'seconds'],
  ['text_message', 'Text message to the listed number', 'hours'],
  ['web_form', 'Website contact form', 'hours'],
  ['social_message', 'Direct message on a social profile', 'hours'],
  ['online_booking', 'Booking without calling', null],
  ['quote_follow_up', 'Follow-up after asking for a quote', 'days'],
]
export const usd = (n) => `$${Number(n).toLocaleString('en-US')}`
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))


// The tests saved on this case, newest first, read back from their evidence records.
export function testsFrom(evidence) {
  return evidence.filter((e) => String(e.method || '').startsWith('customer_style_test:')).map((e) => ({
    id: e.id, kind: e.method.split(':')[1], when: e.capture_date, source: e.source, observation: e.observation,
    answered: !/ No response was received/.test(e.observation || ''),
  }))
}

export function printableAudit({ business, tests, estimate, preparedBy }) {
  const rows = tests.map((t) => `<tr><td>${esc(new Date(t.when).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</td><td>${esc((TESTS.find((x) => x[0] === t.kind) || [0, t.kind])[1])}</td><td>${t.answered ? 'Answered' : '<strong>No answer</strong>'}</td></tr>`).join('')
  const missed = tests.filter((t) => !t.answered).length
  return `<!doctype html><html><head><meta charset="utf-8"><title>Nova Audit · ${esc(business)}</title><style>
  @page{size:letter;margin:0.6in}body{font:11pt/1.45 Georgia,serif;color:#111}h1{font-size:26pt;margin:0 0 4px}.eyebrow{font:700 8pt system-ui,sans-serif;letter-spacing:.25em;color:#9a7b2c;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;margin:14px 0;font:10pt system-ui,sans-serif}td,th{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}.range{font-size:22pt;font-weight:700;margin:6px 0}.small{font:8.5pt system-ui,sans-serif;color:#555}
  </style></head><body><p class="eyebrow">Nova Audit</p><h1>${esc(business)}</h1><p class="small">Prepared ${esc(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}${preparedBy ? ` by ${esc(preparedBy)}` : ''}</p>
  <h2 style="font-size:14pt;margin-top:22px">What happened when we contacted you like a customer</h2><p>${missed} of ${tests.length} ${tests.length === 1 ? 'try' : 'tries'} got no answer.</p><table><thead><tr><th>When</th><th>How we reached out</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>
  ${estimate ? `<h2 style="font-size:14pt">What unanswered inquiries may be worth</h2><p class="range">${usd(estimate.estimate_low)} to ${usd(estimate.estimate_high)} a month</p><p class="small">${esc(estimate.estimate_assumptions)}</p>` : ''}
  <p class="small" style="margin-top:26px">Each test is one try at one moment; it does not by itself show how the business usually responds. Every figure above is an estimate with its assumptions stated, not a promise.</p></body></html>`
}

