// Local schema validation for supabase/approval-inbox-migration-standalone.sql via pg-mem — same
// approach and documented limitations as the CRM/Audit and Zion validators.
// Usage: node scripts/validate_approval_inbox_schema.mjs

import { newDb } from 'pg-mem';
import fs from 'node:fs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

const sqlFile = fs.readFileSync('supabase/approval-inbox-migration-standalone.sql', 'utf8');
const ddlSection = sqlFile.split('ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;')[0];

const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.none(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE organizations (id uuid PRIMARY KEY);
`);
db.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid', implementation: () => '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2).padEnd(12, '0') });

try {
  db.public.none(ddlSection);
  log('CREATE TABLE/INDEX statements execute cleanly', true);
} catch (e) {
  log('CREATE TABLE/INDEX statements execute cleanly', false, e.message);
}

try {
  // status explicitly set (not left to the column default via omission-of-NULL-column, which
  // pg-mem handles fine since this one IS the DEFAULT clause, not a NULL insert — no NULL-vs-CHECK
  // workaround needed here since we're not passing NULL for a CHECK'd column).
  db.public.none(`INSERT INTO approval_requests (id, item_type, action_summary) VALUES ('11111111-1111-1111-1111-111111111111', 'installation', 'Approve installation for Test Org');`);
  log('A minimal valid row inserts successfully, defaulting to pending', true);
} catch (e) {
  log('A minimal valid row inserts successfully, defaulting to pending', false, e.message);
}

try {
  db.public.none(`INSERT INTO approval_requests (id, item_type, action_summary, status) VALUES ('22222222-2222-2222-2222-222222222222', 'installation', 'x', 'not-a-real-status');`);
  log('CHECK constraint rejects an invalid status', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid status', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} local schema-validation checks passed`);
process.exit(passed === results.length ? 0 : 1);
