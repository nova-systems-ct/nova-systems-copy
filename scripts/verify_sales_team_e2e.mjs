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

const suites = ['e2e_sales_db_test', 'e2e_sales_hiring_test', 'e2e_jobs_hiring_test', 'e2e_audit_engine_test', 'e2e_hierarchy_registry_test', 'e2e_hierarchy_governance_test', 'e2e_hierarchy_workitems_test', 'e2e_hierarchy_meetings_test', 'e2e_hierarchy_durable_worker_test', 'e2e_sales_academy_test', 'e2e_sales_documents_activation_test', 'e2e_sales_pipeline_catalog_test', 'e2e_sales_closing_test', 'e2e_sales_commissions_test', 'e2e_sales_notifications_dashboard_test', 'e2e_sales_journeys_test'];
const SUITE_TIMEOUT_MS = 120_000; // every suite normally finishes in 12-20s; 120s is generous headroom, not 900s

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
      const m = /(\d+) passed, (\d+) failed/.exec(out);
      const pass = m ? Number(m[1]) : 0;
      const failCount = m ? Number(m[2]) : null;
      if (timedOut) return resolve({ status: 'timeout', pass, failCount, tail: `killed after ${SUITE_TIMEOUT_MS / 1000}s with no result — process tree terminated`, seconds });
      if (code === 0 && m && failCount === 0) return resolve({ status: 'ok', pass, failCount, tail: `${m[1]} passed, ${m[2]} failed`, seconds });
      const tail = m ? `${m[1]} passed, ${m[2]} failed` : (err || out || 'no output').trim().split('\n').pop();
      resolve({ status: 'fail', pass, failCount, tail, seconds, failLines: out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 8) });
    });
  });
}

let failed = 0; let timedOutCount = 0; let total = 0;
for (const s of suites) {
  console.log(`RUN  ${s} …`);
  const r = await runSuite(s);
  total += r.pass;
  const label = r.status === 'ok' ? 'OK  ' : r.status === 'timeout' ? 'TIME' : 'FAIL';
  console.log(`${label} ${s.padEnd(42)} ${r.tail} (${r.seconds.toFixed(0)}s)`);
  reapOrphanedTestPostgres();
  if (r.status === 'timeout') { timedOutCount++; failed++; continue; } // a timeout is not a code assertion failure — recorded separately, but still blocks a clean overall pass
  if (r.status === 'fail') {
    failed++;
    (r.failLines || []).forEach((l) => console.log(`       ${l}`));
    console.log(`\nStopping after a real assertion failure in ${s} — fix it and rerun that suite directly before continuing the aggregate.`);
    break; // stop on a real failure; do not keep burning time on later suites while a genuine defect is unresolved
  }
}
console.log(
  failed
    ? `\n${failed} suite(s) did not pass cleanly${timedOutCount ? ` (${timedOutCount} of those were TIMEOUTs, not assertion failures)` : ''} (${total} checks passed before stopping).`
    : `\nAll Sales Team + Nova Hierarchy real-database suites passed: ${total} checks (local disposable PostgreSQL + PostgREST; auth/storage/email/payments are stand-ins).`
);
process.exit(failed ? 1 : 0);
