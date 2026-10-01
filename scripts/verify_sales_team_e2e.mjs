// Runs every Sales Team + Nova Hierarchy check that talks to a REAL PostgreSQL + PostgREST (local,
// disposable, started by scripts/testenv). Supabase Auth/Storage, Resend and Stripe are stand-ins,
// so this is NOT evidence about Supabase, Resend, Stripe or production.
// Requires the local test environment (see docs/SALES_TEAM_INSTALLATION.md -> "Local test environment").
//   npm run verify:sales-e2e
//
// Sequential, one suite at a time (deliberately — concurrent real-database suites on this machine
// have been observed to contend for CPU/disk and cause otherwise-passing suites to stall; see
// docs/NOVA_HIERARCHY_BUILD_STATE.md's "aggregate runner" note, 2026-09-28). Each suite gets its own
// bounded timeout, distinct from an assertion failure, and on timeout the whole process TREE is
// force-killed (not just the immediate child) so no orphaned postgres/postgrest process is left
// running — a real orphan-leak was found and manually cleaned up before this rewrite.
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';

// Security repair 2026-09-30 (audit F-27): every local real-database suite, including the security, schema and
// browser suites. The run no longer stops at the first failure; each suite is reported PASS / FAIL / SKIP / TIMEOUT
// and the process exits non-zero unless every suite PASSed. A suite SKIPs only by exiting with code 3 after
// printing a "SKIP —" line that says why (e.g. no Playwright browser installed). Limit with --only=a,b.
const ALL = [
  'e2e_clean_install_test', 'e2e_production_patch_test', 'e2e_mvp_security_fix_test', 'e2e_org_membership_read_test', 'e2e_schema_lockdown_test',
  'e2e_security_personas_test',
  'e2e_sales_db_test', 'e2e_sales_hiring_test', 'e2e_jobs_hiring_test', 'e2e_audit_engine_test', 'e2e_hierarchy_registry_test', 'e2e_hierarchy_governance_test', 'e2e_hierarchy_workitems_test', 'e2e_hierarchy_meetings_test', 'e2e_hierarchy_durable_worker_test', 'e2e_sales_academy_test', 'e2e_sales_documents_activation_test', 'e2e_sales_pipeline_catalog_test', 'e2e_sales_closing_test', 'e2e_sales_commissions_test', 'e2e_sales_notifications_dashboard_test', 'e2e_sales_journeys_test',
  'e2e_sales_browser_test', 'e2e_hierarchy_browser_test',
];
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const suites = only.length ? ALL.filter((s) => only.includes(s)) : ALL;
const SUITE_TIMEOUT_MS = Number(process.env.NOVA_SUITE_TIMEOUT_MS) || 240_000; // database suites take 12-40s, browser suites ~2 min

function killTree(pid) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGKILL'); // POSIX: kill the whole process group (child must be spawned detached)
  } catch { /* already gone */ }
}

// embedded-postgres on Windows has been observed (2026-09-28) to leave forkchild processes
// (io_worker, checkpointer, ...) running even after its own server.stop() completes and the parent
// node process has exited cleanly — a real, reproducible orphan-leak, not hypothetical. After every
// suite, sweep for exactly those: a postgres.exe/postgrest.exe running from THIS repo's
// .testenv/node_modules path whose parent process id no longer exists. Never touches a real,
// user-run Postgres instance (wrong binary path) or a still-attached one (parent still alive).
function reapOrphanedTestPostgres() {
  if (process.platform !== 'win32') return;
  try {
    const script = `
      $rows = Get-CimInstance Win32_Process -Filter "Name='postgres.exe' or Name='postgrest.exe'" |
        Where-Object { $_.CommandLine -like '*.testenv*embedded-postgres*' -or $_.CommandLine -like '*.testenv*postgrest*' }
      foreach ($r in $rows) {
        $parentAlive = Get-Process -Id $r.ParentProcessId -ErrorAction SilentlyContinue
        if (-not $parentAlive) { Stop-Process -Id $r.ProcessId -Force -ErrorAction SilentlyContinue; Write-Output "reaped:$($r.ProcessId)" }
      }
    `;
    const out = execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
    const reaped = out.split('\n').filter((l) => l.startsWith('reaped:'));
    if (reaped.length) console.log(`       (cleaned up ${reaped.length} orphaned test-postgres process(es) from a prior suite)`);
  } catch { /* best-effort only — never fail the run over cleanup */ }
}

// Runs one suite with a real, enforced timeout. Resolves with { status: 'ok'|'fail'|'timeout', pass, failCount, tail, seconds }.
function runSuite(name) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [`scripts/${name}.mjs`], { stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, SUITE_TIMEOUT_MS);
    let timedOut = false;
    child.on('close', (code) => {
      clearTimeout(timer);
      const seconds = (Date.now() - t0) / 1000;
      const m = /(\d+)(?:\/\d+)? passed, (\d+) failed/.exec(out); // "4/5 passed" counts 4, not 5 (F-27)
      const pass = m ? Number(m[1]) : 0;
      const failCount = m ? Number(m[2]) : null;
      if (timedOut) return resolve({ status: 'timeout', pass, failCount, tail: `killed after ${SUITE_TIMEOUT_MS / 1000}s with no result — process tree terminated`, seconds });
      const skip = out.split('\n').find((l) => l.startsWith('SKIP —'));
      if (code === 3 && skip) return resolve({ status: 'skip', pass, failCount, tail: skip, seconds });
      if (code === 0 && m && failCount === 0) return resolve({ status: 'ok', pass, failCount, tail: `${m[1]} passed, ${m[2]} failed`, seconds });
      const tail = m ? `${m[1]} passed, ${m[2]} failed` : (err || out || 'no output').trim().split('\n').pop();
      resolve({ status: 'fail', pass, failCount, tail, seconds, failLines: out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 8) });
    });
  });
}

const rows = []; let total = 0;
for (const s of suites) {
  console.log(`RUN  ${s} ...`);
  const r = await runSuite(s);
  total += r.pass;
  const label = { ok: 'PASS', fail: 'FAIL', skip: 'SKIP', timeout: 'TIMEOUT' }[r.status];
  rows.push({ s, label, tail: r.tail, seconds: r.seconds });
  console.log(`${label.padEnd(7)} ${s.padEnd(42)} ${r.tail} (${r.seconds.toFixed(0)}s)`);
  (r.failLines || []).forEach((l) => console.log(`        ${l}`));
  reapOrphanedTestPostgres();
}
const count = (l) => rows.filter((x) => x.label === l).length;
console.log('\nSUMMARY');
for (const x of rows) console.log(`  ${x.label.padEnd(7)} ${x.s}`);
console.log(`\n${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('SKIP')} SKIP, ${count('TIMEOUT')} TIMEOUT — ${total} checks passed in total`);
console.log('Local disposable PostgreSQL + PostgREST; auth, storage, email and payments are stand-ins. Not evidence about production.');
process.exit(count('PASS') === rows.length && rows.length > 0 ? 0 : 1);
