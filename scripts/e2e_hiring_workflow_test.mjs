// RETIRED 2026-09-27 — this test covered `invite-applicant` / `activate-representative`
// (api/intake.js), which were removed 2026-09-26 in favor of two separate, real flows:
//   - Sales positions: api/_sales/hiring.js + the Sales Team workspace (see
//     scripts/e2e_sales_hiring_test.mjs and scripts/e2e_sales_journeys_test.mjs, run against the
//     LOCAL disposable test environment in scripts/testenv/ — no production credentials).
//   - Every other Careers position (Content Creator, Lead Gen Specialist, etc.): the generalized
//     staff invitation in api/team.js's `invite` op (now accepts an optional application_id to
//     link the new account back to the applicant's record), reviewed from JobDetail.jsx. Covered
//     by scripts/e2e_jobs_hiring_test.mjs against the same local disposable test environment.
// This file intentionally does nothing (exit 0) rather than exercise retired endpoints against
// the real Supabase project via .env.local.
console.log('e2e_hiring_workflow_test: retired — see scripts/e2e_jobs_hiring_test.mjs and scripts/e2e_sales_hiring_test.mjs');
process.exitCode = 0;
// Force-exit once results are printed: embedded-postgres child pipes on Windows can otherwise keep a finished
// (or crashed) suite alive until the aggregate runner's timeout (seen 2026-10-13 in a clean-checkout run).
// Let Node exit on its own once handles close. Calling process.exit() while fetch keep-alive connections are still
// closing aborts Node 24 on Windows (libuv assertion in src/win/async.c, exit 0xC0000409) and can drop the printed
// result — the cause of the intermittent 'no result line' crashes (reproduced 40/40, fixed 0/40 on 2026-10-17).
// The unref'd timer is only a last resort if something keeps the process alive.
setTimeout(() => process.exit(process.exitCode ?? 0), 10_000).unref();
