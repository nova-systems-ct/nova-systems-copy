// Guard for the handful of e2e/QA scripts that talk to a REAL Supabase project instead of the local
// disposable harness (scripts/testenv/). Security repair 2026-09-30 (audit F-21/F-28):
//
//  1. Credentials are read from a DEDICATED test env file — NOVA_TEST_ENV_FILE, default
//     `.env.staging.local` — never from `.env.local`, which holds production keys on dev machines.
//  2. A URL on 127.0.0.1/localhost is always allowed (local harness).
//  3. The production project and the old compromised project are NEVER allowed, whatever flags say.
//  4. Any other remote project requires BOTH ALLOW_REAL_SUPABASE_TESTS=yes AND
//     NOVA_TEST_TARGET_REF=<that project's ref> — a flag alone is not trusted; the target is checked.
import path from 'node:path';

export const NEVER_TEST_AGAINST = new Set([
  'xizmgruvuazmummotzkp', // Nova production (nova-systems.app, nova-systems.agency)
  'mokyqxfgvdxajxytkcat', // old nova-jobs / compromised project
  ...String(process.env.NOVA_PRODUCTION_REFS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);

export function testEnvFile() {
  const f = process.env.NOVA_TEST_ENV_FILE || '.env.staging.local';
  const base = path.basename(f);
  if (base === '.env.local' || base === '.env') {
    console.error(`[guard] REFUSING: ${f} is the application's own env file (production credentials on developer machines). Put staging test credentials in .env.staging.local or set NOVA_TEST_ENV_FILE.`);
    process.exit(1);
  }
  return f;
}

export function projectRefOf(url) {
  try { const h = new URL(url).hostname; return h.endsWith('.supabase.co') ? h.split('.')[0] : null; } catch { return null; }
}

export function requireRealSupabaseOptIn(supabaseUrl, scriptName) {
  const looksLocal = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(supabaseUrl || '');
  if (looksLocal) return;
  const ref = projectRefOf(supabaseUrl);
  const refuse = (why) => { console.error(`\n[${scriptName}] REFUSING TO RUN: ${why}\n`); process.exit(1); };
  if (!ref) refuse(`SUPABASE_URL (${supabaseUrl || 'not set'}) is neither local nor a recognisable Supabase project.`);
  if (NEVER_TEST_AGAINST.has(ref)) refuse(`project ${ref} is a production/legacy project. Tests never run there. Use a dedicated staging project.`);
  if (process.env.ALLOW_REAL_SUPABASE_TESTS !== 'yes') refuse(`set ALLOW_REAL_SUPABASE_TESTS=yes to run against a real (staging) project. This creates and deletes real rows and users there.`);
  if (process.env.NOVA_TEST_TARGET_REF !== ref) refuse(`set NOVA_TEST_TARGET_REF=${ref} to confirm this exact project is the intended staging target.`);
  console.log(`[${scriptName}] running against staging project ${ref} (explicitly confirmed).`);
}
