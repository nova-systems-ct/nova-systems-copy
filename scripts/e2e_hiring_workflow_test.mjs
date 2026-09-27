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
