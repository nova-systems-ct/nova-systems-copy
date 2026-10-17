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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Security repair 2026-09-30 (audit F-27): every local real-database suite, including the security, schema and
// browser suites. The run no longer stops at the first failure; each suite is reported PASS / FAIL / SKIP / TIMEOUT
// and the process exits non-zero unless every suite PASSed. A suite SKIPs only by exiting with code 3 after
// printing a "SKIP —" line that says why (e.g. no Playwright browser installed). Limit with --only=a,b.
const ALL = [
  'e2e_clean_install_test', 'e2e_production_patch_test', 'e2e_mvp_security_fix_test', 'e2e_org_membership_read_test', 'e2e_schema_lockdown_test',
  'e2e_security_personas_test',
  'e2e_ops_core_journey_test', 'e2e_ops_calendar_test', 'e2e_ops_connected_deposit_test', 'e2e_ops_demand_test', 'e2e_demo_test', 'e2e_ops_harvest_test', 'e2e_ops_revive_test', 'e2e_ops_sentry_voice_test', 'e2e_audit_report_delivery_test', 'e2e_audit_clock_test', 'e2e_hierarchy_handoffs_test',
  'e2e_sales_db_test', 'e2e_sales_hiring_test', 'e2e_jobs_hiring_test', 'e2e_audit_engine_test', 'e2e_hierarchy_registry_test', 'e2e_hierarchy_governance_test', 'e2e_hierarchy_workitems_test', 'e2e_hierarchy_meetings_test', 'e2e_hierarchy_durable_worker_test', 'e2e_sales_academy_test', 'e2e_sales_documents_activation_test', 'e2e_sales_pipeline_catalog_test', 'e2e_sales_closing_test', 'e2e_sales_commissions_test', 'e2e_sales_notifications_dashboard_test', 'e2e_sales_journeys_test',
  'e2e_sales_browser_test', 'e2e_hierarchy_browser_test', 'e2e_ops_browser_test', 'e2e_demo_browser_test',
];
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const suites = only.length ? ALL.filter((s) => only.includes(s)) : ALL;
const SUITE_TIMEOUT_MS = Number(process.env.NOVA_SUITE_TIMEOUT_MS) || 420_000; // database suites take 12-60s, browser suites up to ~4 min

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
    // Report as soon as the suite process itself exits (or a few seconds after a timeout kill). Waiting for the
    // pipes to 'close' could take many minutes when an orphaned postgres child still held them open (F-27).
    let timedOut = false; let done = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
      setTimeout(() => finish(null), 5000);
    }, SUITE_TIMEOUT_MS);
    child.on('exit', (code) => setTimeout(() => finish(code), 1500)); // grace period to collect the last output
    child.on('close', (code) => finish(code));
    function finish(code) {
      if (done) return; done = true;
      clearTimeout(timer);
      child.stdout.destroy(); child.stderr.destroy();
      const seconds = (Date.now() - t0) / 1000;
      const raw = { out, err, code };
      const m = /(\d+)(?:\/\d+)? passed, (\d+) failed/.exec(out); // "4/5 passed" counts 4, not 5 (F-27)
      const pass = m ? Number(m[1]) : 0;
      const failCount = m ? Number(m[2]) : null;
      if (timedOut) return resolve({ ...raw, status: 'timeout', pass, failCount, tail: `killed after ${SUITE_TIMEOUT_MS / 1000}s with no result — process tree terminated`, seconds });
      const skip = out.split('\n').find((l) => l.startsWith('SKIP —'));
      if (code === 3 && skip) return resolve({ ...raw, status: 'skip', pass, failCount, tail: skip, seconds });
      if (code === 0 && m && failCount === 0) return resolve({ ...raw, status: 'ok', pass, failCount, tail: `${m[1]} passed, ${m[2]} failed`, seconds });
      // With no result line, say how the process ended and show the first error line, not the last stack frame.
      const errLine = (err.split('\n').find((l) => /Error|timeout|refus/i.test(l)) || err.trim().split('\n').pop() || '').trim();
      const tail = m ? `${m[1]} passed, ${m[2]} failed` : `no result line; exit code ${code ?? 'none'}; ${errLine ? `error: ${errLine.slice(0, 160)}` : `last output: ${(out.trim().split('\n').pop() || '').slice(0, 120)}`}`;
      resolve({ ...raw, status: 'fail', pass, failCount, tail, seconds, failLines: out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 8) });
    }
  });
}

// Host suspension (2026-10-15 diagnosis): on this Modern Standby laptop the 2026-10-13 stalls lined up with
// Kernel-Power 506/507 (connected-standby enter/exit) events — e2e_ops_harvest_test started 15s after standby began at
// 11:54:18 and finished seconds after wake at 12:57:21; e2e_hierarchy_meetings_test likewise ended 12s after the 13:39:43 wake.
// While suspended, every process (including this runner's own timeout timer) is frozen, so a "420s timeout" took 63 minutes.
// Two measures: (1) hold a keep-awake power request for the whole run (ES_CONTINUOUS|ES_SYSTEM_REQUIRED|ES_DISPLAY_REQUIRED
// via a PowerShell helper that exits with this process); (2) detect suspension directly (a 1s heartbeat that sees a wall-clock
// gap > 15s) and report such a suite as SUSPENDED with the measured gap, re-running it once — never as PASS from the interrupted run.
function holdAwake() {
  if (process.platform !== 'win32' || process.env.NOVA_NO_KEEPAWAKE) return null;
  const ps = `Add-Type -Name P -Namespace W -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
    if ([W.P]::SetThreadExecutionState([uint32]2147483651) -eq 0) { Write-Output 'keepawake:failed' } else { Write-Output 'keepawake:on' }
    try { (Get-Process -Id ${process.pid}).WaitForExit() } catch {}`;
  const child = spawn('powershell', ['-NoProfile', '-Command', ps], { stdio: ['ignore', 'pipe', 'ignore'] });
  child.stdout.on('data', (d) => { const t = String(d).trim(); if (t) console.log(`       (${t === 'keepawake:on' ? 'keep-awake power request held for this run' : 'WARNING: keep-awake request refused — a sleeping computer will stall suites'})`); });
  child.unref();
  return child;
}
let lastBeat = Date.now(); let suspendedMs = 0;
// beatOnce also runs right after each suite returns: after a freeze, the suite's exit event can resolve before the
// heartbeat timer gets its turn (found by the freeze test below), so the gap must be measured directly too.
const beatOnce = () => { const now = Date.now(); const gap = now - lastBeat - 1000; if (gap > 15_000) suspendedMs += gap; lastBeat = now; };
const beat = setInterval(beatOnce, 1000);
beat.unref();
const awake = holdAwake();
process.on('exit', () => { try { awake?.kill(); } catch { /* gone */ } });

// Evidence: full stdout+stderr of every suite that does not PASS is kept (default %TEMP%/nova-e2e-logs/<run>/).
const LOG_DIR = process.env.NOVA_E2E_LOG_DIR || path.join(os.tmpdir(), 'nova-e2e-logs', new Date().toISOString().replace(/[:.]/g, '-'));
const keepLog = (name, r, attempt = '') => { try { fs.mkdirSync(LOG_DIR, { recursive: true }); const file = path.join(LOG_DIR, `${name}${attempt}.log`); fs.writeFileSync(file, `status=${r.status} exit=${r.code ?? 'none'} seconds=${r.seconds?.toFixed?.(1)} free_mem_mb=${Math.round(os.freemem() / 1048576)} of ${Math.round(os.totalmem() / 1048576)}
--- stdout ---
${r.out || ''}
--- stderr ---
${r.err || ''}`); return file; } catch { return null; } };

const rows = []; let total = 0;
for (const s of suites) {
  console.log(`RUN  ${s} ...`);
  suspendedMs = 0; lastBeat = Date.now();
  // Test hook for the detector itself: freeze this process (as a suspended host would) once, during the first suite.
  const freeze = Number(process.env.NOVA_TEST_FREEZE_RUNNER_MS) || 0;
  if (freeze && s === suites[0] && !rows.length) setTimeout(() => { const t = Date.now(); while (Date.now() - t < freeze) { /* simulated suspension */ } }, 2000);
  let r = await runSuite(s); beatOnce();
  if (suspendedMs > 0) {
    const gap = Math.round(suspendedMs / 1000);
    keepLog(s, r, '.interrupted');
    console.log(`SUSPEND ${s.padEnd(42)} host was suspended for ${gap}s during this suite (${r.status}); result discarded, re-running once`);
    rows.push({ s: `${s} (interrupted run)`, label: 'SUSPEND', tail: `host suspended ${gap}s`, seconds: r.seconds, informational: true });
    suspendedMs = 0; lastBeat = Date.now();
    r = await runSuite(s); beatOnce();
    if (suspendedMs > 0) r = { ...r, status: 'timeout', tail: `host suspended again (${Math.round(suspendedMs / 1000)}s) — no valid result` };
  }
  total += r.pass;
  const label = { ok: 'PASS', fail: 'FAIL', skip: 'SKIP', timeout: 'TIMEOUT' }[r.status];
  rows.push({ s, label, tail: r.tail, seconds: r.seconds });
  console.log(`${label.padEnd(7)} ${s.padEnd(42)} ${r.tail} (${r.seconds.toFixed(0)}s)`);
  (r.failLines || []).forEach((l) => console.log(`        ${l}`));
  if (r.status !== 'ok' && r.status !== 'skip') { const lf = keepLog(s, r); if (lf) console.log(`        full output: ${lf}`); }
  reapOrphanedTestPostgres();
}
const count = (l) => rows.filter((x) => x.label === l).length;
const counted = rows.filter((x) => !x.informational);
console.log('\nSUMMARY');
for (const x of rows) console.log(`  ${x.label.padEnd(7)} ${x.s}`);
console.log(`\n${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('SKIP')} SKIP, ${count('TIMEOUT')} TIMEOUT, ${count('SUSPEND')} SUSPEND (re-run) — ${total} checks passed in total`);
console.log('Local disposable PostgreSQL + PostgREST; auth, storage, email and payments are stand-ins. Not evidence about production.');
process.exit(count('PASS') === counted.length && counted.length > 0 ? 0 : 1);
