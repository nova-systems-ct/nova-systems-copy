// Local schema validation for supabase/zion-studio-remaining-tabs-migration-standalone.sql via
// pg-mem, seeded with the real pre-existing zion_videos/zion_character_assets shape.
// Usage: node scripts/validate_zion_remaining_tabs_schema.mjs

import { newDb } from 'pg-mem';
import fs from 'node:fs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

const sqlFile = fs.readFileSync('supabase/zion-studio-remaining-tabs-migration-standalone.sql', 'utf8');
const ddlSection = sqlFile.split('ALTER TABLE zion_revenue_records ENABLE ROW LEVEL SECURITY;')[0];

const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid', implementation: () => '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2).padEnd(12, '0') });
db.public.none(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE zion_video_ideas (id uuid PRIMARY KEY);
  CREATE TABLE zion_videos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), idea_id uuid, status text);
  CREATE TABLE zion_character_assets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version int, asset_type text);
`);

const videoId = '11111111-1111-1111-1111-111111111111';

try {
  db.public.none(ddlSection);
  log('ALTER/CREATE statements execute cleanly against the real pre-existing zion tables', true);
} catch (e) {
  log('ALTER/CREATE statements execute cleanly against the real pre-existing zion tables', false, e.message);
}

try {
  // Documented pg-mem limitation (same as this session's earlier findings): unlike real Postgres,
  // pg-mem does not implement standard SQL's "NULL satisfies any CHECK constraint" semantics — a
  // bare NULL insert incorrectly fails here even though real Postgres allows it. Worked around in
  // this TEST only (an explicit valid value), never in the actual schema DDL, which correctly
  // leaves the column nullable.
  db.public.none(`INSERT INTO zion_videos (id, publish_confirmation_source) VALUES ('${videoId}', 'manual');`);
  const [row] = db.public.many(`SELECT publish_confirmation_source FROM zion_videos WHERE id = '${videoId}';`);
  log('A video can record which kind of publish confirmation actually happened', row.publish_confirmation_source === 'manual', JSON.stringify(row));
} catch (e) {
  log('A video can record which kind of publish confirmation actually happened', false, e.message);
}

try {
  db.public.none(`INSERT INTO zion_videos (id, publish_confirmation_source) VALUES ('22222222-2222-2222-2222-222222222222', 'not-a-real-source');`);
  log('CHECK constraint rejects an invalid publish_confirmation_source', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid publish_confirmation_source', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO zion_character_assets (id, version, asset_type) VALUES ('33333333-3333-3333-3333-333333333333', 1, 'profile_bible');`);
  const [row] = db.public.many(`SELECT status, privacy FROM zion_character_assets WHERE id = '33333333-3333-3333-3333-333333333333';`);
  log('A new Profile Bible entry defaults to draft/owner_only — private by default, per §7', row.status === 'draft' && row.privacy === 'owner_only', JSON.stringify(row));
} catch (e) {
  log('A new Profile Bible entry defaults to draft/owner_only — private by default, per §7', false, e.message);
}

try {
  db.public.none(`INSERT INTO zion_revenue_records (id, record_type, amount_cents) VALUES ('44444444-4444-4444-4444-444444444444', 'estimate', 50000);`);
  db.public.none(`INSERT INTO zion_revenue_records (id, record_type, amount_cents) VALUES ('55555555-5555-5555-5555-555555555555', 'verified_income', 10000);`);
  const rows = db.public.many(`SELECT record_type, amount_cents FROM zion_revenue_records ORDER BY record_type;`);
  log('Estimate and verified_income insert as structurally distinct record types', rows.length === 2 && rows.some((r) => r.record_type === 'estimate') && rows.some((r) => r.record_type === 'verified_income'), JSON.stringify(rows));
} catch (e) {
  log('Estimate and verified_income insert as structurally distinct record types', false, e.message);
}

try {
  db.public.none(`INSERT INTO zion_revenue_records (id, record_type, amount_cents) VALUES ('66666666-6666-6666-6666-666666666666', 'not-a-real-type', 100);`);
  log('CHECK constraint rejects an invalid revenue record_type', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid revenue record_type', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} local schema-validation checks passed`);
process.exit(passed === results.length ? 0 : 1);
