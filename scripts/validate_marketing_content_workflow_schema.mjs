// Local schema validation for supabase/marketing-content-workflow-migration-standalone.sql via
// pg-mem — same approach as every other validator this session, but this one also proves the one
// intentional backfill UPDATE behaves correctly on existing rows (both an already-published post
// and a still-draft post), since this migration alters a table pg-mem must seed with real rows
// first, not a fresh empty one.
// Usage: node scripts/validate_marketing_content_workflow_schema.mjs

import { newDb } from 'pg-mem';
import fs from 'node:fs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

const sqlFile = fs.readFileSync('supabase/marketing-content-workflow-migration-standalone.sql', 'utf8');

const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid', implementation: () => '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2).padEnd(12, '0') });
db.public.none(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE blog_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT, slug TEXT UNIQUE, published BOOLEAN DEFAULT FALSE, site TEXT DEFAULT 'nova'
  );
`);

// Seed pre-existing rows exactly like a real production table would already have: one already
// live, one still a draft — before the migration (which alters this same table) ever runs.
db.public.none(`INSERT INTO blog_posts (id, title, slug, published) VALUES ('11111111-1111-1111-1111-111111111111', 'Already live post', 'already-live-post', TRUE);`);
db.public.none(`INSERT INTO blog_posts (id, title, slug, published) VALUES ('22222222-2222-2222-2222-222222222222', 'Still a draft', 'still-a-draft', FALSE);`);

try {
  db.public.none(sqlFile);
  log('ALTER TABLE / backfill UPDATE statements execute cleanly against an existing table with real rows', true);
} catch (e) {
  log('ALTER TABLE / backfill UPDATE statements execute cleanly against an existing table with real rows', false, e.message);
}

try {
  const rows = db.public.many(`SELECT id, status FROM blog_posts ORDER BY id;`);
  const live = rows.find((r) => r.id === '11111111-1111-1111-1111-111111111111');
  const draft = rows.find((r) => r.id === '22222222-2222-2222-2222-222222222222');
  log('The already-published pre-existing row is backfilled to status=published', live?.status === 'published', JSON.stringify(live));
  log('The pre-existing draft row is left at status=draft (default), not touched by the backfill', draft?.status === 'draft', JSON.stringify(draft));
} catch (e) {
  log('Backfill correctness check', false, e.message);
}

try {
  db.public.none(`INSERT INTO blog_posts (id, title, slug, status) VALUES ('33333333-3333-3333-3333-333333333333', 'x', 'x-status-test', 'not-a-real-status');`);
  log('CHECK constraint rejects an invalid status', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid status', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  // Re-running the migration must be a genuine no-op on rows already backfilled (idempotency) —
  // the ADD COLUMN IF NOT EXISTS lines will no-op, and the UPDATE's WHERE clause no longer matches
  // the already-'published' row (it's not 'draft' anymore), so nothing changes on a second run.
  db.public.none(sqlFile);
  const rows = db.public.many(`SELECT id, status FROM blog_posts ORDER BY id;`);
  const live = rows.find((r) => r.id === '11111111-1111-1111-1111-111111111111');
  log('Re-running the migration is a safe no-op (idempotent)', live?.status === 'published', JSON.stringify(live));
} catch (e) {
  log('Re-running the migration is a safe no-op (idempotent)', false, e.message);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} local schema-validation checks passed`);
process.exit(passed === results.length ? 0 : 1);
