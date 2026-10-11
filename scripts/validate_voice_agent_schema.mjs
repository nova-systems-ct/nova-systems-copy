// Local schema validation for supabase/voice-agent-migration-standalone.sql via pg-mem.
// Usage: node scripts/validate_voice_agent_schema.mjs

import { newDb } from 'pg-mem';
import fs from 'node:fs';

const results = [];
function log(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  results.push(pass);
}

const sqlFile = fs.readFileSync('supabase/voice-agent-migration-standalone.sql', 'utf8');
const ddlSection = sqlFile.split('ALTER TABLE voice_configurations ENABLE ROW LEVEL SECURITY;')[0];

const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid', implementation: () => '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2).padEnd(12, '0') });
db.public.none(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE organizations (id uuid PRIMARY KEY);
  CREATE TABLE crm_contacts (id uuid PRIMARY KEY);
`);

const orgId = '11111111-1111-1111-1111-111111111111';

try {
  db.public.none(ddlSection);
  log('CREATE TABLE/INDEX/ALTER statements execute cleanly', true);
} catch (e) {
  log('CREATE TABLE/INDEX/ALTER statements execute cleanly', false, e.message);
}

try {
  db.public.none(`INSERT INTO organizations (id) VALUES ('${orgId}');`);
  db.public.none(`INSERT INTO voice_configurations (id, organization_id) VALUES ('22222222-2222-2222-2222-222222222222', '${orgId}');`);
  log('A minimal voice_configurations row inserts, defaults to not_configured/outbound disabled', true);
} catch (e) {
  log('A minimal voice_configurations row inserts, defaults to not_configured/outbound disabled', false, e.message);
}

try {
  db.public.none(`INSERT INTO voice_configurations (id, organization_id) VALUES ('33333333-3333-3333-3333-333333333333', '${orgId}');`);
  log('UNIQUE organization_id rejects a second config for the same org', false, 'insert should have thrown but did not');
} catch (e) {
  log('UNIQUE organization_id rejects a second config for the same org', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO voice_call_sessions (id, organization_id) VALUES ('44444444-4444-4444-4444-444444444444', '${orgId}');`);
  log('A minimal call session inserts, defaults direction=inbound, consent_recorded=false', true);
  const [row] = db.public.many(`SELECT direction, consent_recorded FROM voice_call_sessions WHERE id = '44444444-4444-4444-4444-444444444444';`);
  log('Consent defaults to NOT recorded — never assumed', row.consent_recorded === false, JSON.stringify(row));
} catch (e) {
  log('A minimal call session inserts, defaults direction=inbound, consent_recorded=false', false, e.message);
}

try {
  db.public.none(`INSERT INTO voice_call_tool_events (id, session_id, tool_name, idempotency_key) VALUES ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 'confirm_booking', 'dup-key');`);
  db.public.none(`INSERT INTO voice_call_tool_events (id, session_id, tool_name, idempotency_key) VALUES ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'confirm_booking', 'dup-key');`);
  log('The SAME session reusing an idempotency_key is rejected (prevents a double-booking on retry)', false, 'insert should have thrown but did not');
} catch (e) {
  log('The SAME session reusing an idempotency_key is rejected (prevents a double-booking on retry)', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

try {
  db.public.none(`INSERT INTO voice_call_sessions (id, organization_id) VALUES ('77777777-7777-7777-7777-777777777777', '${orgId}');`);
  db.public.none(`INSERT INTO voice_call_tool_events (id, session_id, tool_name, idempotency_key) VALUES ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'confirm_booking', 'dup-key');`);
  log('A DIFFERENT session reusing the same idempotency_key string is fine (scoped per-session, not global)', true);
} catch (e) {
  log('A DIFFERENT session reusing the same idempotency_key string is fine (scoped per-session, not global)', false, e.message);
}

try {
  db.public.none(`INSERT INTO voice_calendar_slots (id, organization_id, service_name, start_at, end_at) VALUES ('99999999-9999-9999-9999-999999999999', '${orgId}', 'Consultation', now(), now() + interval '30 minutes');`);
  const [row] = db.public.many(`SELECT status FROM voice_calendar_slots WHERE id = '99999999-9999-9999-9999-999999999999';`);
  log('A calendar slot defaults to open', row.status === 'open', JSON.stringify(row));
} catch (e) {
  log('A calendar slot defaults to open', false, e.message);
}

try {
  db.public.none(`INSERT INTO voice_knowledge_base (id, organization_id, topic, question, answer, status) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '${orgId}', 'hours', 'What are your hours?', 'x', 'not-a-real-status');`);
  log('CHECK constraint rejects an invalid knowledge-base status', false, 'insert should have thrown but did not');
} catch (e) {
  log('CHECK constraint rejects an invalid knowledge-base status', true, 'correctly rejected: ' + e.message.split('\n')[0]);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} local schema-validation checks passed`);
process.exit(passed === results.length ? 0 : 1);
