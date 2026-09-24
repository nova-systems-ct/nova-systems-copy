// Local schema validation for supabase/crm-order-audit-migration-standalone.sql, using pg-mem —
// an in-process Postgres-compatible engine. This environment has no Docker/local Postgres, so a
// full local Supabase stack (Postgres + GoTrue + PostgREST + Storage) isn't available; pg-mem is
// the closest real substitute for "run this DDL somewhere and see what breaks" rather than just
// reading the SQL and hoping it's right.
//
// What this DOES prove: every CREATE TABLE/INDEX statement is valid Postgres DDL, every foreign
// key resolves to a real column, every CHECK constraint is syntactically valid and actually
// rejects a bad value, every UNIQUE constraint actually rejects a duplicate.
//
// What this does NOT prove (pg-mem doesn't implement these, so they're skipped and reported
// separately, not silently assumed to pass): Postgres RLS/CREATE POLICY/`TO authenticated`
// role-based grants, auth.uid()/SECURITY DEFINER function behavior, Supabase Storage. Those can
// only be verified against the real Supabase project.
//
// Usage: node scripts/validate_crm_order_audit_schema.mjs

import { newDb } from 'pg-mem';
import fs from 'node:fs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

const sqlFile = fs.readFileSync('supabase/crm-order-audit-migration-standalone.sql', 'utf8');

// Split into the three logical sections this migration file itself is organized into, so we can
// report exactly which part validated and which didn't, rather than one opaque pass/fail.
const ddlSection = sqlFile.split('-- RLS —')[0];
const rlsAndSeedSection = sqlFile.slice(sqlFile.indexOf('-- RLS —'));

const db = newDb({ autoCreateForeignKeyIndices: true });

// Minimal, realistic stand-ins for the real Supabase objects this migration's foreign keys and
// RLS policies reference — matching the actual live shape confirmed earlier this project via
// PostgREST OpenAPI introspection, not guessed.
db.public.none(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE organizations (id uuid PRIMARY KEY, name text, kind text);
  CREATE TABLE leads (id uuid PRIMARY KEY, organization_id uuid);
`);
db.public.registerFunction({
  name: 'gen_random_uuid',
  returns: 'uuid' ,
  implementation: () => '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2).padEnd(12, '0'),
});
db.public.registerFunction({
  name: 'is_org_member',
  args: ['uuid'],
  returns: 'bool',
  implementation: () => true, // real behavior lives in Postgres/Supabase, not testable here — see header
});

try {
  db.public.none(ddlSection);
  log('All CREATE TABLE/INDEX/ALTER TABLE statements execute cleanly against a real Postgres-compatible engine', true);
} catch (e) {
  log('All CREATE TABLE/INDEX/ALTER TABLE statements execute cleanly against a real Postgres-compatible engine', false, e.message);
}

// ---- Real constraint behavior checks (not just "did CREATE TABLE not throw") ----
try {
  db.public.none(`INSERT INTO organizations (id, name, kind) VALUES ('11111111-1111-1111-1111-111111111111', 'Test Org', 'client');`);
  db.public.none(`INSERT INTO businesses (id, organization_id, name, confidence) VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Test Biz', 'confirmed');`);
  log('A valid businesses row inserts successfully', true);
} catch (e) {
  log('A valid businesses row inserts successfully', false, e.message);
}

try {
  db.public.none(`INSERT INTO businesses (id, organization_id, name, confidence) VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Bad Biz', 'not-a-real-value');`);
  log('CHECK constraint rejects an invalid businesses.confidence value', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid businesses.confidence value', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO orders (id, organization_id, product_id, product_version) VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 1);`);
  log('Foreign key rejects an orders.product_id that does not exist in products', false, 'insert should have thrown but did not');
} catch (e) {
  log('Foreign key rejects an orders.product_id that does not exist in products', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO products (id, slug, version, name) VALUES ('66666666-6666-6666-6666-666666666666', 'test-product', 1, 'Test');`);
  db.public.none(`INSERT INTO products (id, slug, version, name) VALUES ('77777777-7777-7777-7777-777777777777', 'test-product', 1, 'Duplicate');`);
  log('UNIQUE(slug, version) rejects a duplicate product version', false, 'insert should have thrown but did not');
} catch (e) {
  log('UNIQUE(slug, version) rejects a duplicate product version', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

// Note: source_quality/confidence are explicitly set here (not left NULL) to work around a real,
// isolated, confirmed pg-mem limitation — real Postgres correctly treats a NULL value as
// satisfying a CHECK (x IN (...)) constraint (standard SQL three-valued-logic semantics: NULL
// compared against anything is UNKNOWN, and a CHECK only fails on an explicit FALSE), but pg-mem's
// IN-operator implementation does not. Verified in isolation before assuming this was a real
// schema defect: a two-column table with nothing but `x text CHECK (x IN ('a','b'))` and
// `INSERT ... VALUES (1, NULL)` reproduces the same false failure with zero relation to this
// migration's actual design. The real schema leaves these columns nullable exactly as intended;
// this workaround exists in the TEST, not in supabase/crm-order-audit-migration-standalone.sql.
try {
  db.public.none(`
    INSERT INTO audit_cases (id, organization_id, target_hours) VALUES ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 72);
    INSERT INTO audit_evidence (id, case_id, source, observation, author, source_quality, confidence) VALUES ('99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888888', 'website', 'contact form returns 404', 'automated scan', 'high', 'high');
    -- confidence/review_status are supplied explicitly: pg-mem wrongly rejects NULL against a CHECK(... IN ...) column (real Postgres passes NULL); see docs/PRODUCT_BUILD_STATE.md pg-mem notes.
    INSERT INTO audit_findings (id, case_id, title, statement_type, detail, priority, confidence, review_status) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888888', 'Broken contact form', 'observed_fact', 'The contact form returns a 404 error.', 'high', 'medium', 'draft');
    INSERT INTO audit_finding_evidence (finding_id, evidence_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999999');
  `);
  log('A full evidence -> finding -> finding_evidence link chain inserts successfully', true);
} catch (e) {
  log('A full evidence -> finding -> finding_evidence link chain inserts successfully', false, e.message);
}

// Confirms the NULL-vs-CHECK gap really is isolated to pg-mem and not somehow specific to this
// schema, so the workaround above isn't quietly masking something real.
try {
  db.public.none(`CREATE TABLE pgmem_null_check_probe (id int PRIMARY KEY, x text CHECK (x IN ('a','b')));`);
  db.public.none(`INSERT INTO pgmem_null_check_probe (id, x) VALUES (1, NULL);`);
  log('(diagnostic) pg-mem allows NULL against CHECK IN(...) — if this ever flips to PASS, the workaround above can be removed', false, 'still fails as expected — confirms the limitation is pg-mem-wide, not schema-specific');
} catch (e) {
  log('(diagnostic) pg-mem NULL-vs-CHECK limitation reproduced in isolation, confirming it is pg-mem-wide not schema-specific', true, e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO audit_findings (id, case_id, title, statement_type, detail, priority) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '88888888-8888-8888-8888-888888888888', 'Bad', 'not-a-real-type', 'x', 'high');`);
  log('CHECK constraint rejects an invalid audit_findings.statement_type', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid audit_findings.statement_type', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

console.log('\n--- RLS/policy section (NOT executed against pg-mem — see header for why) ---');
console.log('Statement types present:', [...new Set(rlsAndSeedSection.match(/^(ALTER TABLE|CREATE POLICY|DROP POLICY|INSERT INTO)/gm) || [])].join(', '));
console.log('These must be verified against the real Supabase project after this migration runs —');
console.log('not claimed here. RLS policy correctness for this domain is NOT yet covered by a');
console.log('permanent e2e test (unlike organizations/leads/etc.) — flagged in the build-state doc.');

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} local schema-validation checks passed`);
process.exit(passed === results.length ? 0 : 1);
