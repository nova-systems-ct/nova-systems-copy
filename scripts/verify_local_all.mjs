// One command to run every check that needs NO database, provider, or network:
//   node scripts/verify_local_all.mjs
// These prove rule logic and schema syntax only. They are NOT deployed/E2E evidence — the e2e_* scripts
// (which need the migrations applied) are intentionally excluded and report their own fail-fast state.
import { spawnSync } from 'node:child_process';

const suites = [
  'unit_wave1_test', 'unit_wave1_handlers_test', 'unit_wave1_api_test', 'unit_audit_rules_test', 'unit_audit_handlers_test', 'unit_crm_sales_test',
  'unit_audit_clock_test', 'unit_job_queue_test', 'unit_job_queue_correctness_test', 'unit_social_adapters_test', 'unit_email_sequence_test',
  'unit_sales_academy_rules_test', 'unit_sales_documents_rules_test', 'unit_sales_pipeline_rules_test', 'unit_sales_proposal_rules_test', 'unit_sales_commission_rules_test', 'validate_academy_content',
  'validate_wave1_pilot_schema', 'validate_crm_order_audit_schema', 'validate_durable_jobs_schema', 'validate_marketing_automation_schema', 'check_migration_lockdown',
];
let failed = 0;
for (const s of suites) {
  const r = spawnSync(process.execPath, [`scripts/${s}.mjs`], { encoding: 'utf8', timeout: 180_000 });
  const tail = (r.stdout || '').trim().split('\n').filter((l) => /passed|PASS — every/.test(l)).pop() || (r.stderr || '').trim().split('\n').pop();
  console.log(`${r.status === 0 ? 'OK  ' : 'FAIL'} ${s.padEnd(38)} ${tail}`);
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} suite(s) FAILED` : '\nAll local suites passed (logic/schema-syntax only — nothing here proves a deployment).');
process.exit(failed ? 1 : 0);
