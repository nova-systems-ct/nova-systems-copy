// 2026-09-29: this repo's local-disposable-Postgres harness (scripts/testenv/) cannot fully
// reproduce real Supabase Auth (magic links, real JWT issuance/refresh, admin user management),
// so a handful of e2e scripts intentionally target a REAL Supabase project via .env.local instead.
// That's a legitimate design choice for what they test — but nothing about running
// `node scripts/whatever_test.mjs` visibly signals "this touches a real, possibly-production
// database" versus the far more common local-harness scripts, and at least one of these was run
// this session believing it was local-only. It creates and deletes real throwaway rows/users
// there; cleanup is coded into each script, but a crash before the `finally` block runs (or a
// permission boundary blocking verification) can leave that cleanup unconfirmed. This guard makes
// the target impossible to miss and requires an explicit, informed opt-in before any such script
// proceeds, so nobody — including an agent working from a prior turn's context — can treat one of
// these as equivalent to a local test by mistake.
//
// Usage: import { requireRealSupabaseOptIn } from './_realSupabaseGuard.mjs'; call it right after
// loading SUPABASE_URL from .env.local, before making any request.
export function requireRealSupabaseOptIn(supabaseUrl, scriptName) {
  const looksLocal = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(supabaseUrl || '');
  if (looksLocal) return; // scripts/testenv-style local harness URL — no real target, nothing to guard.
  if (process.env.ALLOW_REAL_SUPABASE_TESTS === 'yes') {
    console.log(`[${scriptName}] ALLOW_REAL_SUPABASE_TESTS=yes set — proceeding against a REAL Supabase project (${supabaseUrl}). This creates and deletes real throwaway rows/users there.`);
    return;
  }
  console.error(`
[${scriptName}] REFUSING TO RUN.

.env.local's SUPABASE_URL (${supabaseUrl || '(not set)'}) does not look like a local test
environment. This script creates real throwaway rows and real Supabase Auth users against
whatever project that URL points to, then deletes them — if that project is production (or you're
not certain), this is exactly the "never test by writing to production" rule this repo operates
under.

If you have explicitly confirmed this is safe (a real, dedicated staging project — not
production — or you accept the risk and understand what this script creates), set:
  ALLOW_REAL_SUPABASE_TESTS=yes
and re-run. Otherwise, use the local disposable harness (scripts/testenv/) instead, if this
script's PREREQUISITE comment allows it.
`);
  process.exit(1);
}
