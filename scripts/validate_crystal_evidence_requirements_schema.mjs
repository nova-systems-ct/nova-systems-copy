// Local schema validation for supabase/crystal-evidence-requirements-migration-standalone.sql.
// Usage: node scripts/validate_crystal_evidence_requirements_schema.mjs

import { newDb } from 'pg-mem';
import fs from 'node:fs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

const sqlFile = fs.readFileSync('supabase/crystal-evidence-requirements-migration-standalone.sql', 'utf8');

const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid', implementation: () => '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2).padEnd(12, '0') });
db.public.none(`
  CREATE TABLE organizations (id uuid PRIMARY KEY);
  CREATE TABLE crystal_service_catalog (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, name text);
  CREATE TABLE crystal_customers (id uuid PRIMARY KEY);
  CREATE TABLE crystal_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, customer_id uuid);
`);

try {
  db.public.none(sqlFile);
  log('ALTER statements execute cleanly', true);
} catch (e) {
  log('ALTER statements execute cleanly', false, e.message);
}

try {
  const orgId = '11111111-1111-1111-1111-111111111111';
  db.public.none(`INSERT INTO organizations (id) VALUES ('${orgId}');`);
  db.public.none(`INSERT INTO crystal_service_catalog (id, organization_id, name) VALUES ('22222222-2222-2222-2222-222222222222', '${orgId}', 'Lawn Mowing');`);
  const [row] = db.public.many(`SELECT evidence_requirements FROM crystal_service_catalog WHERE id = '22222222-2222-2222-2222-222222222222';`);
  // pg-mem returns a jsonb DEFAULT as a raw string here rather than a parsed object (a real driver
  // like node-postgres parses jsonb columns automatically) — normalized before comparing, same
  // "verify it's pg-mem's representation, not a real defect" discipline as this session's other
  // documented pg-mem quirks.
  const normalized = typeof row.evidence_requirements === 'string' ? JSON.parse(row.evidence_requirements) : row.evidence_requirements;
  log('A new service defaults to an empty (unconfigured) evidence_requirements object', Object.keys(normalized).length === 0, JSON.stringify(row));
} catch (e) {
  log('A new service defaults to an empty (unconfigured) evidence_requirements object', false, e.message);
}

try {
  db.public.none(`UPDATE crystal_service_catalog SET evidence_requirements = '{"requires_checklist_complete": true, "requires_after_photo": false}' WHERE id = '22222222-2222-2222-2222-222222222222';`);
  const [row] = db.public.many(`SELECT evidence_requirements FROM crystal_service_catalog WHERE id = '22222222-2222-2222-2222-222222222222';`);
  log('A service can be configured to NOT require an after photo (e.g. lawn mowing — checklist only)', row.evidence_requirements.requires_after_photo === false, JSON.stringify(row));
} catch (e) {
  log('A service can be configured to NOT require an after photo', false, e.message);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} local schema-validation checks passed`);
process.exit(passed === results.length ? 0 : 1);
