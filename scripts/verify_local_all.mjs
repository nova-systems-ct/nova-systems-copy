// One command to run every check that needs NO database, provider, or network:
//   node scripts/verify_local_all.mjs
// These prove rule logic and schema syntax only. They are NOT deployed/E2E evidence — the e2e_* scripts
// (which need the migrations applied) are intentionally excluded and report their own fail-fast state.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const suites = [
  'unit_wave1_test', 'unit_wave1_handlers_test', 'unit_wave1_api_test', 'unit_audit_rules_test', 'unit_audit_handlers_test', 'unit_crm_sales_test',
  'unit_audit_clock_test', 'unit_public_research_test', 'unit_page_renderer_test', 'unit_workforce_roles_test', 'unit_worker_capabilities_test', 'unit_job_queue_test', 'unit_job_queue_correctness_test', 'unit_social_adapters_test', 'unit_email_sequence_test',
  'unit_sales_academy_rules_test', 'unit_sales_documents_rules_test', 'unit_sales_pipeline_rules_test', 'unit_sales_proposal_rules_test', 'unit_sales_commission_rules_test', 'unit_hierarchy_rules_test', 'unit_ops_rules_test', 'validate_academy_content',
  'validate_wave1_pilot_schema', 'validate_crm_order_audit_schema', 'validate_durable_jobs_schema', 'validate_marketing_automation_schema', 'check_migration_lockdown', 'unit_local_verification_test', 'unit_owner_greeting_test', 'unit_host_server_test', 'unit_auth_destination_test',
];
export function runLocalSuites(names, { root = process.cwd(), timeoutMs = 180_000, log = console.log } = {}) {
  let failed = 0, passed = 0, skipped = 0;
  for (const s of names) {
    const r = spawnSync(process.execPath, [path.join(root, `scripts/${s}.mjs`)], { cwd: root, encoding: 'utf8', timeout: timeoutMs });
    const stdout = r.stdout || '';
    const skipLine = stdout.split('\n').find((line) => /^SKIP\b/.test(line));
    const tail = skipLine || stdout.trim().split('\n').filter((line) => /passed|PASS — every/.test(line)).pop() || (r.stderr || '').trim().split('\n').pop();
    const label = r.error?.code === 'ETIMEDOUT' ? 'TIMEOUT'
      : r.error ? 'FAIL'
      : r.status === 3 || (r.status === 0 && skipLine) ? 'SKIP'
      : r.status === 0 ? 'PASS' : 'FAIL';
    log(`${label.padEnd(7)} ${s.padEnd(38)} ${label === 'TIMEOUT' ? `killed after ${timeoutMs}ms` : tail}`);
    if (label === 'SKIP') skipped++;
    else if (label === 'PASS') passed++;
    else failed++;
  }
  return { passed, failed, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { passed, failed, skipped } = runLocalSuites(suites);
  console.log(failed ? `\n${failed} suite(s) FAILED` : skipped ? `\nVerification INCOMPLETE: ${passed} passed, ${skipped} skipped.` : '\nAll local suites passed (logic/schema-syntax only — nothing here proves a deployment).');
  process.exit(failed ? 1 : skipped ? 3 : 0);
}
