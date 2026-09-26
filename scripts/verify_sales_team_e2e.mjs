// Runs every Sales Team check that talks to a REAL PostgreSQL + PostgREST (local, disposable, started by scripts/testenv).
// Supabase Auth/Storage, Resend and Stripe are stand-ins, so this is NOT evidence about Supabase, Resend, Stripe or production.
// Requires the local test environment (see docs/SALES_TEAM_INSTALLATION.md → "Local test environment").
//   npm run verify:sales-e2e
import { spawnSync } from 'node:child_process';

const suites = ['e2e_sales_db_test', 'e2e_sales_hiring_test', 'e2e_sales_academy_test', 'e2e_sales_documents_activation_test', 'e2e_sales_pipeline_catalog_test', 'e2e_sales_closing_test', 'e2e_sales_commissions_test', 'e2e_sales_notifications_dashboard_test', 'e2e_sales_journeys_test'];
let failed = 0; let total = 0;
for (const s of suites) {
  const t0 = Date.now(); const r = spawnSync(process.execPath, [`scripts/${s}.mjs`], { encoding: 'utf8', timeout: 900_000, maxBuffer: 64 * 1024 * 1024 });
  const m = /(\d+) passed, (\d+) failed/.exec(r.stdout || ''); const pass = m ? Number(m[1]) : 0; total += pass;
  console.log(`${r.status === 0 && m && m[2] === '0' ? 'OK  ' : 'FAIL'} ${s.padEnd(42)} ${m ? `${m[1]} passed, ${m[2]} failed` : (r.stderr || r.stdout || 'no output').trim().split('\n').pop()} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  if (r.status !== 0 || !m || m[2] !== '0') { failed++; (r.stdout || '').split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 8).forEach((l) => console.log(`       ${l}`)); }
}
console.log(failed ? `\n${failed} suite(s) FAILED (${total} checks passed)` : `\nAll Sales Team real-database suites passed: ${total} checks (local disposable PostgreSQL + PostgREST; auth/storage/email/payments are stand-ins).`);
process.exit(failed ? 1 : 0);
