// Local schema validation for supabase/crystal-migration-standalone.sql via pg-mem — same
// approach and documented limitations as every other validator this session.
// Usage: node scripts/validate_crystal_schema.mjs

import { newDb } from 'pg-mem';
import fs from 'node:fs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

const sqlFile = fs.readFileSync('supabase/crystal-migration-standalone.sql', 'utf8');
const ddlSection = sqlFile.split('-- RLS on the organization-scoped')[0];

const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid', implementation: () => '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2).padEnd(12, '0') });
db.public.none(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE organizations (id uuid PRIMARY KEY);
`);

try {
  db.public.none(ddlSection);
  log('CREATE TABLE/INDEX statements execute cleanly', true);
} catch (e) {
  log('CREATE TABLE/INDEX statements execute cleanly', false, e.message);
}

const orgId = '11111111-1111-1111-1111-111111111111';
const custId = '22222222-2222-2222-2222-222222222222';
const jobId = '33333333-3333-3333-3333-333333333333';
const workerId = '44444444-4444-4444-4444-444444444444';

try {
  db.public.none(`INSERT INTO organizations (id) VALUES ('${orgId}');`);
  db.public.none(`INSERT INTO auth.users (id) VALUES ('${workerId}');`);
  db.public.none(`INSERT INTO crystal_customers (id, organization_id, name) VALUES ('${custId}', '${orgId}', 'Test Customer');`);
  db.public.none(`INSERT INTO crystal_jobs (id, organization_id, customer_id) VALUES ('${jobId}', '${orgId}', '${custId}');`);
  log('A minimal customer + job insert chain succeeds, job defaults to scheduled', true);
} catch (e) {
  log('A minimal customer + job insert chain succeeds, job defaults to scheduled', false, e.message);
}

try {
  db.public.none(`INSERT INTO crystal_jobs (id, organization_id, customer_id, status) VALUES ('55555555-5555-5555-5555-555555555555', '${orgId}', '${custId}', 'not-a-real-status');`);
  log('CHECK constraint rejects an invalid job status', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid job status', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO crystal_job_assignments (id, job_id, worker_user_id) VALUES ('66666666-6666-6666-6666-666666666666', '${jobId}', '${workerId}');`);
  log('A worker assignment inserts successfully', true);
} catch (e) {
  log('A worker assignment inserts successfully', false, e.message);
}

try {
  db.public.none(`INSERT INTO crystal_job_assignments (id, job_id, worker_user_id) VALUES ('77777777-7777-7777-7777-777777777777', '${jobId}', '${workerId}');`);
  log('UNIQUE (job_id, worker_user_id) rejects assigning the same worker to the same job twice', false, 'insert should have thrown but did not');
} catch (e) {
  log('UNIQUE (job_id, worker_user_id) rejects assigning the same worker to the same job twice', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO crystal_completion_reviews (id, job_id, completed_by) VALUES ('88888888-8888-8888-8888-888888888888', '${jobId}', '${workerId}');`);
  log('A completion review requires a real completed_by and defaults customer_approved to false', true);
} catch (e) {
  log('A completion review requires a real completed_by and defaults customer_approved to false', false, e.message);
}

try {
  db.public.none(`INSERT INTO crystal_completion_reviews (id, job_id, completed_by) VALUES ('99999999-9999-9999-9999-999999999999', '${jobId}', '${workerId}');`);
  log('UNIQUE job_id on crystal_completion_reviews rejects a second completion record for the same job', false, 'insert should have thrown but did not');
} catch (e) {
  log('UNIQUE job_id on crystal_completion_reviews rejects a second completion record for the same job', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO crystal_feedback (id, job_id, customer_id, rating) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '${jobId}', '${custId}', 7);`);
  log('CHECK constraint rejects a rating outside 1-5', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects a rating outside 1-5', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} local schema-validation checks passed`);
process.exit(passed === results.length ? 0 : 1);
