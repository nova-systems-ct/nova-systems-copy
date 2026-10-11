import { startTestEnv } from './env.mjs';
const MIG = [{ file: 'supabase/schema-update.sql', mode: 'statements' },'supabase/academy-migration-standalone.sql','supabase/hiring-workflow-migration-standalone.sql','supabase/crm-order-audit-migration-standalone.sql','supabase/approval-inbox-migration-standalone.sql','supabase/durable-jobs-migration-standalone.sql','supabase/wave1-pilot-migration-standalone.sql'];
const t0 = Date.now();
const env = await startTestEnv({ migrations: MIG, quiet: false });
try {
  console.log('started in', Date.now() - t0, 'ms; migration errors:', JSON.stringify(env.migrationErrors));
  const r = await env.rest(null, 'academy_programs?select=slug&limit=3');
  console.log('anon read of academy_programs (expected permission error/empty):', r.status, JSON.stringify(r.data).slice(0, 120));
  const tables = (await env.sql("select count(*) from information_schema.tables where table_schema='public'")).rows[0].count;
  console.log('public tables:', tables);
  const o = await env.sql("insert into organizations (name, slug, kind) values ('Nova Systems','nova','nova_internal') returning id");
  const admin = await env.createUser({ email: 'a@x.test', role: 'nova_super_admin', orgId: o.rows[0].id });
  const rr = await env.rest(admin.token, 'organization_members?select=role');
  console.log('admin reads own memberships via PostgREST as authenticated:', rr.status, JSON.stringify(rr.data));
  const rpc = await env.rest(admin.token, 'rpc/has_permission', { method: 'POST', body: { target_org_id: o.rows[0].id, permission_key: 'admin.view' } });
  console.log('has_permission(admin.view):', rpc.status, JSON.stringify(rpc.data));
} finally { await env.stop(); }
