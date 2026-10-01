// Proves supabase/security-repair-2026-09-30-production-patch-standalone.sql (the narrow patch meant
// for the real deployment) and supabase/security-repair-2026-09-30-columns-standalone.sql against a
// real, disposable local PostgreSQL + PostgREST. Nothing here touches a real Supabase project.
//
// 1. Rebuilds the PRODUCTION-LIKE BROKEN STATE the audit found (F-01 / MVP gaps A-2, A-3; F-34; F-16):
//    blanket "any staff reads every org" policies, tables with RLS off and anon grants, a jobs policy
//    that shows organization-less jobs to every signed-in user, and a public intake bucket.
// 2. Confirms the simulation really is exposed (so the "after" checks mean something).
// 3. Applies the patch twice (idempotency), then checks anonymous denial, cross-organization denial,
//    applicant denial and legitimate member / service-role access.
// 4. Proves the patch refuses to half-apply on a database missing its prerequisite function.
// 5. Runs supabase/checks/security-metadata-check.sql and checks its answers.
// 6. Applies the additive columns migration twice and checks the provenance constraint.
//
// Usage: node scripts/e2e_production_patch_test.mjs   (exit code 0 only when every check passes)
import fs from 'node:fs';
import { startTestEnv } from './testenv/env.mjs';
import { allMigrations } from './testenv/migrations.mjs';

const PATCH = 'supabase/security-repair-2026-09-30-production-patch-standalone.sql';
const COLUMNS = 'supabase/security-repair-2026-09-30-columns-standalone.sql';
const CHECK = 'supabase/checks/security-metadata-check.sql';

const results = [];
function check(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${!pass && detail ? ' — ' + detail : ''}`);
  results.push(!!pass);
}
const rows = (r) => (Array.isArray(r.data) ? r.data : null);

async function main() {
  const env = await startTestEnv({ migrations: allMigrations() });
  try {
    const s = Date.now();
    const orgA = (await env.sql(`insert into organizations (name, slug, kind, status) values ($1,$2,'client','active') returning id`, [`PATCH A ${s}`, `patch-a-${s}`])).rows[0].id;
    const orgB = (await env.sql(`insert into organizations (name, slug, kind, status) values ($1,$2,'client','active') returning id`, [`PATCH B ${s}`, `patch-b-${s}`])).rows[0].id;
    const userA = await env.createUser({ email: `patch-a-${s}@example.invalid`, role: 'client_owner', orgId: orgA });
    const userB = await env.createUser({ email: `patch-b-${s}@example.invalid`, role: 'client_owner', orgId: orgB });
    const applicant = await env.createUser({ email: `patch-applicant-${s}@example.invalid` }); // signed in, no membership

    await env.sql(`insert into client_accounts (email, password_hash) values ($1, 'synthetic-not-a-real-hash')`, [`patch-acct-${s}@example.invalid`]);
    await env.sql(`insert into blog_posts (title, slug, published) values ('Draft', $1, false)`, [`patch-draft-${s}`]).catch(() => env.sql(`insert into blog_posts (title, slug) values ('Draft', $1)`, [`patch-draft-${s}`]));
    const jobPlatform = (await env.sql(`insert into jobs (job_type, organization_id, payload) values ('platform_secret_job', null, '{"note":"platform"}') returning id`)).rows[0].id;
    const jobA = (await env.sql(`insert into jobs (job_type, organization_id) values ('org_a_job', $1) returning id`, [orgA])).rows[0].id;

    // ---- 1. Production-like broken state -------------------------------------------------------
    await env.sql(`
      create or replace function public._test_is_any_staff() returns boolean language sql security definer set search_path = public as
        $f$ select exists (select 1 from organization_members m where m.staff_user_id = auth.uid() and m.member_type = 'staff') $f$;
      drop policy if exists staff_read_all_organizations on organizations;
      create policy staff_read_all_organizations on organizations for select to authenticated using (public._test_is_any_staff());
      drop policy if exists staff_read_all_members on organization_members;
      create policy staff_read_all_members on organization_members for select to authenticated using (public._test_is_any_staff());
      alter table client_accounts disable row level security;
      alter table blog_posts disable row level security;
      alter table vault_documents disable row level security;
      grant all on client_accounts, blog_posts, vault_documents to anon, authenticated;
      drop policy if exists members_read_jobs on jobs;
      create policy members_read_jobs on jobs for select to authenticated using (organization_id is null or is_org_member(organization_id));
      grant select on jobs to authenticated;
      create schema if not exists storage;
      create table if not exists storage.buckets (id text primary key, name text, public boolean default false);
      insert into storage.buckets (id, name, public) values ('nova-intake-files', 'nova-intake-files', true)
        on conflict (id) do update set public = true;`);
    await env.reload();

    // ---- 2. The simulation really is exposed ----------------------------------------------------
    const preAnon = await env.rest(null, 'client_accounts?select=id,password_hash');
    check('BEFORE: anonymous key reads client_accounts (exposure reproduced)', rows(preAnon)?.length > 0, JSON.stringify(preAnon).slice(0, 200));
    const preCross = await env.rest(userB.token, `organizations?id=eq.${orgA}&select=id`);
    check('BEFORE: org B owner reads org A (exposure reproduced)', rows(preCross)?.length === 1, JSON.stringify(preCross));
    const preJobs = await env.rest(applicant.token, `jobs?id=eq.${jobPlatform}&select=id`);
    check('BEFORE: a signed-in account with no membership reads a platform job (exposure reproduced)', rows(preJobs)?.length === 1, JSON.stringify(preJobs));

    // ---- 3. Apply twice, then verify -----------------------------------------------------------
    const patch = fs.readFileSync(PATCH, 'utf8');
    let e1 = null; try { await env.sql(patch); } catch (e) { e1 = e.message; }
    check('patch applies cleanly on the broken state', !e1, e1);
    let e2 = null; try { await env.sql(patch); } catch (e) { e2 = e.message; }
    check('patch applies cleanly a second time (idempotent)', !e2, e2);
    await env.reload();

    for (const t of ['client_accounts', 'blog_posts', 'vault_documents', 'organizations', 'organization_members']) {
      const r = await env.rest(null, `${t}?select=id&limit=5`);
      check(`AFTER: anonymous key gets no ${t} rows`, r.status >= 400 || rows(r)?.length === 0, `status=${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
    }
    const anonWrite = await env.rest(null, 'client_accounts', { method: 'POST', body: { email: `patch-forged-${s}@example.invalid` } });
    check('AFTER: anonymous key cannot insert into client_accounts', anonWrite.status >= 400, `status=${anonWrite.status}`);
    const anonBlogWrite = await env.rest(null, 'blog_posts', { method: 'POST', body: { title: 'x', slug: `forged-${s}` } });
    check('AFTER: anonymous key cannot insert blog posts', anonBlogWrite.status >= 400, `status=${anonBlogWrite.status}`);
    const authWrite = await env.rest(applicant.token, 'vault_documents', { method: 'POST', body: {} });
    check('AFTER: a signed-in account cannot write vault_documents directly', authWrite.status >= 400, `status=${authWrite.status}`);

    const crossOrg = await env.rest(userB.token, `organizations?id=eq.${orgA}&select=id`);
    check('AFTER: org B owner cannot read org A', rows(crossOrg)?.length === 0, JSON.stringify(crossOrg));
    const crossMembers = await env.rest(userB.token, `organization_members?staff_user_id=eq.${userA.id}&select=id`);
    check("AFTER: org B owner cannot read org A's membership rows", rows(crossMembers)?.length === 0, JSON.stringify(crossMembers));
    const ownOrg = await env.rest(userA.token, 'organizations?select=id');
    check('AFTER: org A owner still reads org A (legitimate access kept)', rows(ownOrg)?.some((o) => o.id === orgA), JSON.stringify(ownOrg));
    const ownMembers = await env.rest(userA.token, 'organization_members?select=id,organization_id');
    check('AFTER: org A owner still reads their own membership', rows(ownMembers)?.length > 0 && rows(ownMembers).every((m) => m.organization_id === orgA), JSON.stringify(ownMembers));

    const appJobs = await env.rest(applicant.token, 'jobs?select=id');
    check('AFTER: an account with no membership reads no jobs at all', rows(appJobs)?.length === 0, JSON.stringify(appJobs));
    const aJobs = await env.rest(userA.token, 'jobs?select=id');
    check("AFTER: org A owner reads org A's job and not the platform job", rows(aJobs)?.some((j) => j.id === jobA) && !rows(aJobs).some((j) => j.id === jobPlatform), JSON.stringify(aJobs));
    const bJobs = await env.rest(userB.token, `jobs?id=eq.${jobA}&select=id`);
    check("AFTER: org B owner cannot read org A's job", rows(bJobs)?.length === 0, JSON.stringify(bJobs));

    const svc = await env.rest(env.serviceKey, `organizations?select=id&id=in.(${orgA},${orgB})`);
    const svcAcct = await env.rest(env.serviceKey, 'client_accounts?select=id&limit=1');
    const svcJobs = await env.rest(env.serviceKey, `jobs?select=id&id=eq.${jobPlatform}`);
    check('AFTER: service role (every API handler) still reads orgs, accounts and platform jobs', rows(svc)?.length === 2 && rows(svcAcct)?.length === 1 && rows(svcJobs)?.length === 1, JSON.stringify([svc.status, svcAcct.status, svcJobs.status]));

    const bucket = (await env.sql(`select public from storage.buckets where id = 'nova-intake-files'`)).rows[0];
    check('AFTER: intake uploads bucket is private', bucket?.public === false, JSON.stringify(bucket));

    // ---- 4. Refuses to half-apply ----------------------------------------------------------------
    const c = await env.pool.connect();
    let preconditionError = null;
    try {
      await c.query('begin');
      await c.query('alter function public.is_org_member(uuid) rename to is_org_member_hidden');
      try { await c.query(patch); } catch (e) { preconditionError = e.message; }
    } finally { await c.query('rollback').catch(() => {}); c.release(); }
    check('patch stops with a clear error when is_org_member(uuid) is missing', /is_org_member\(uuid\) missing/.test(preconditionError || ''), preconditionError);

    // ---- 5. Metadata-only check -------------------------------------------------------------------
    const res = await env.pool.query(fs.readFileSync(CHECK, 'utf8'));
    const [rlsList, rlsOff, , broad, , buckets, salesViews] = res.map((r) => r.rows);
    const patched = ['organizations', 'organization_members', 'client_accounts', 'blog_posts', 'vault_documents', 'jobs'];
    check('metadata check: every patched table reports RLS enabled', patched.every((t) => rlsList.find((x) => x.table_name === t)?.rls_enabled === true), JSON.stringify(rlsList));
    check('metadata check: no patched table is listed with RLS off', !rlsOff.some((x) => patched.includes(x.rls_disabled_table)), JSON.stringify(rlsOff));
    check('metadata check: no blanket staff/jobs policy remains', broad.length === 0, JSON.stringify(broad));
    check('metadata check: intake bucket reported private', buckets.find((b) => b.id === 'nova-intake-files')?.public === false, JSON.stringify(buckets));
    check('metadata check: sales reps hold no organization-wide view after a full install (F-17)', salesViews.length === 0, JSON.stringify(salesViews));

    // ---- 6. Additive columns -------------------------------------------------------------------
    const cols = fs.readFileSync(COLUMNS, 'utf8');
    let c1 = null, c2 = null;
    try { await env.sql(cols); } catch (e) { c1 = e.message; }
    try { await env.sql(cols); } catch (e) { c2 = e.message; }
    check('columns migration applies twice without error', !c1 && !c2, c1 || c2);
    const colRows = (await env.pool.query(fs.readFileSync(CHECK, 'utf8')))[7].rows;
    check('metadata check: all 9 repair columns present', colRows.length === 9, JSON.stringify(colRows));
    let badSource = null;
    try { await env.sql(`insert into client_invoices (invoice_number, total, status, payment_source) values ('PATCH-X', 1, 'Paid', 'browser')`); } catch (e) { badSource = e.message; }
    check('an unknown payment_source is rejected by the database', /client_invoices_payment_source_chk/.test(badSource || ''), badSource);
    await env.sql(`insert into client_invoices (invoice_number, total, status, payment_source, provider_event_id) values ('PATCH-1', 1, 'Paid', 'stripe', $1)`, [`evt_patch_${s}`]);
    let dup = null;
    try { await env.sql(`insert into client_invoices (invoice_number, total, status, payment_source, provider_event_id) values ('PATCH-2', 1, 'Paid', 'stripe', $1)`, [`evt_patch_${s}`]); } catch (e) { dup = e.message; }
    check('one Stripe event cannot mark two invoices paid (unique provider_event_id)', /client_invoices_provider_event_uniq/.test(dup || ''), dup);
  } finally {
    await env.stop();
  }
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed, ${results.length - passed} failed`);
  process.exit(passed === results.length && results.length > 0 ? 0 : 1);
}

main().catch((err) => { console.error('SCRIPT ERROR:', err); process.exit(1); });
