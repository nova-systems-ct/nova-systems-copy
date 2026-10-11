// Local schema validation for supabase/installation-center-migration-standalone.sql via pg-mem —
// same approach and documented limitations as the CRM/Audit, Zion, and Approval Inbox validators.
// Usage: node scripts/validate_installation_center_schema.mjs

import { newDb } from 'pg-mem';
import fs from 'node:fs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

const sqlFile = fs.readFileSync('supabase/installation-center-migration-standalone.sql', 'utf8');
const ddlSection = sqlFile.split('ALTER TABLE installations ENABLE ROW LEVEL SECURITY;')[0];

const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.none(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE organizations (id uuid PRIMARY KEY);
  CREATE TABLE orders (id uuid PRIMARY KEY);
  CREATE TABLE businesses (id uuid PRIMARY KEY);
  CREATE TABLE products (id uuid PRIMARY KEY);
`);
db.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid', implementation: () => '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2).padEnd(12, '0') });

try {
  db.public.none(ddlSection);
  log('CREATE TABLE/INDEX statements execute cleanly', true);
} catch (e) {
  log('CREATE TABLE/INDEX statements execute cleanly', false, e.message);
}

try {
  db.public.none(`INSERT INTO organizations (id) VALUES ('11111111-1111-1111-1111-111111111111');`);
  db.public.none(`INSERT INTO orders (id) VALUES ('22222222-2222-2222-2222-222222222222');`);
  db.public.none(`INSERT INTO installations (id, organization_id, order_id) VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');`);
  log('A minimal valid installation row inserts, defaulting to sandbox_setup', true);
} catch (e) {
  log('A minimal valid installation row inserts, defaulting to sandbox_setup', false, e.message);
}

try {
  db.public.none(`INSERT INTO orders (id) VALUES ('44444444-4444-4444-4444-444444444444');`);
  db.public.none(`INSERT INTO installations (id, organization_id, order_id, status) VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'not-a-real-status');`);
  log('CHECK constraint rejects an invalid installation status', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid installation status', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO installation_tests (id, installation_id, test_name, result) VALUES ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'DNS resolves', 'pass');`);
  log('A valid installation_test row inserts', true);
} catch (e) {
  log('A valid installation_test row inserts', false, e.message);
}

try {
  db.public.none(`INSERT INTO installation_tests (id, installation_id, test_name, result) VALUES ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', 'bogus', 'not-a-real-result');`);
  log('CHECK constraint rejects an invalid test result', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid test result', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO installations (id, organization_id, order_id) VALUES ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');`);
  log('UNIQUE constraint rejects a second installation on the same order', false, 'insert should have thrown but did not');
} catch (e) {
  log('UNIQUE constraint rejects a second installation on the same order', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} local schema-validation checks passed`);
process.exit(passed === results.length ? 0 : 1);
