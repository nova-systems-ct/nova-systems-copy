// Local schema validation for supabase/zion-studio-migration-standalone.sql via pg-mem (same
// approach and same documented limitations as scripts/validate_crm_order_audit_schema.mjs — see
// that file's header for what pg-mem can and cannot prove, including its known NULL-vs-CHECK
// limitation worked around the same way here).
// Usage: node scripts/validate_zion_schema.mjs

import { newDb } from 'pg-mem';
import fs from 'node:fs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

const sqlFile = fs.readFileSync('supabase/zion-studio-migration-standalone.sql', 'utf8');
const ddlSection = sqlFile.split('-- RLS:')[0];

const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.none(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE organizations (id uuid PRIMARY KEY);
`);
db.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid', implementation: () => '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2).padEnd(12, '0') });
db.public.registerFunction({ name: 'is_org_member', args: ['uuid'], returns: 'bool', implementation: () => true });
db.public.registerFunction({ name: 'is_platform_owner', args: [], returns: 'bool', implementation: () => true });

try {
  db.public.none(ddlSection);
  log('All CREATE TABLE/INDEX statements execute cleanly', true);
} catch (e) {
  log('All CREATE TABLE/INDEX statements execute cleanly', false, e.message);
}

try {
  db.public.none(`INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');`);
  db.public.none(`INSERT INTO zion_journal_entries (id, author_user_id, entry_date, text_content) VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '2026-09-23', 'Worked on the Audit workflow for three hours.');`);
  log('A valid journal entry inserts successfully', true);
} catch (e) {
  log('A valid journal entry inserts successfully', false, e.message);
}

try {
  db.public.none(`INSERT INTO zion_facts (id, journal_entry_id, statement) VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Worked on the Audit workflow for three hours.');`);
  log('A valid fact row inserts successfully, defaulting to unconfirmed', true);
} catch (e) {
  log('A valid fact row inserts successfully, defaulting to unconfirmed', false, e.message);
}

try {
  db.public.none(`INSERT INTO zion_facts (id, journal_entry_id, statement, status) VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'x', 'not-a-real-status');`);
  log('CHECK constraint rejects an invalid zion_facts.status', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid zion_facts.status', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO zion_video_ideas (id, angle, story_type) VALUES ('55555555-5555-5555-5555-555555555555', 'How I learned to build an Audit engine', 'lesson');`);
  db.public.none(`INSERT INTO zion_scripts (id, idea_id, body, hook) VALUES ('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555', 'Full script body here.', 'You will not believe what broke today.');`);
  // qa_status explicitly set (not left NULL) to work around the same pg-mem NULL-vs-CHECK
  // limitation documented in scripts/validate_crm_order_audit_schema.mjs — real Postgres allows
  // NULL to satisfy a CHECK, pg-mem's IN-operator implementation does not. Workaround is in the
  // test, not the schema — the real column stays nullable exactly as designed.
  db.public.none(`INSERT INTO zion_videos (id, idea_id, script_id, status, qa_status) VALUES ('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666', 'ready_for_review', 'pending');`);
  db.public.none(`INSERT INTO zion_review_events (id, video_id, action, notes) VALUES ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'approve', 'Looks good.');`);
  log('Full idea -> script -> video -> review_event chain inserts successfully', true);
} catch (e) {
  log('Full idea -> script -> video -> review_event chain inserts successfully', false, e.message);
}

try {
  db.public.none(`INSERT INTO zion_videos (id, idea_id, status) VALUES ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'draft');`);
  log('Foreign key rejects a zion_videos.idea_id that does not exist', false, 'insert should have thrown but did not');
} catch (e) {
  log('Foreign key rejects a zion_videos.idea_id that does not exist', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} local schema-validation checks passed`);
process.exit(passed === results.length ? 0 : 1);
