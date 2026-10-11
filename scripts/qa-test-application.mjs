import fs from 'node:fs'
import { requireRealSupabaseOptIn, testEnvFile } from './_realSupabaseGuard.mjs'

// Security repair 2026-09-30 (audit F-28): this used to read nova-wave-one's PRODUCTION .env.local
// and post to the live https://nova-systems.app. It now needs an explicit staging site
// (NOVA_QA_BASE_URL) and staging credentials from the dedicated test env file, and refuses the
// production domains and projects outright.
const BASE = process.env.NOVA_QA_BASE_URL || ''
let baseHost = ''
try { baseHost = new URL(BASE).hostname } catch { /* checked below */ }
if (!baseHost || /(^|\.)nova-systems\.(app|agency)$/i.test(baseHost)) {
  console.error('REFUSING: set NOVA_QA_BASE_URL to a staging/preview deployment (never nova-systems.app or nova-systems.agency).')
  process.exit(1)
}
const env = fs.readFileSync(testEnvFile(), 'utf8')
const get = (name) => {
  const m = env.match(new RegExp(`^${name}=(.*)$`, 'm'))
  return m ? m[1].trim() : null
}
const SUPABASE_URL = get('SUPABASE_URL') || get('VITE_SUPABASE_URL')
const SUPABASE_KEY = get('SUPABASE_SERVICE_ROLE_KEY')
requireRealSupabaseOptIn(SUPABASE_URL, 'qa-test-application')
async function sf(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
}

const testEmail = `qa-test-app-${Date.now()}@nova-systems-qa.invalid`
const payload = { id: crypto.randomUUID(), name: 'QA TestApplicant', email: testEmail, phone: '+18605550199', position: 'QA Test Position — DELETE ME', city: 'Waterbury' }

console.log('--- Submitting test job application ---')
const res = await fetch(`${BASE.replace(/\/$/, '')}/api/intake?action=submit-application`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
})
console.log('Status:', res.status)
console.log('Body:', await res.text())

await new Promise((r) => setTimeout(r, 1500))

const r = await sf(`applications?email=eq.${encodeURIComponent(testEmail)}`)
const rows = r.ok ? await r.json() : []
console.log('\nApplication row(s):', JSON.stringify(rows, null, 2))

if (rows[0]) {
  const d = await sf(`applications?id=eq.${rows[0].id}`, { method: 'DELETE' })
  console.log('\nCleanup delete status:', d.status)
} else {
  console.log('\nNo row found — cleanup skipped')
}
