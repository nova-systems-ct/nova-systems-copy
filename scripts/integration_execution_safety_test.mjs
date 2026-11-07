// Isolated real PostgreSQL; no hosted database, provider keys or paid calls.
// Install pg + embedded-postgres in .testenv, or set NOVA_TEST_RUNTIME to another install directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve(process.env.NOVA_TEST_RUNTIME || '.testenv', 'package.json'));
const EmbeddedPostgres = require('embedded-postgres').default;
const { Pool } = require('pg');
// Preserve failed test exit codes rather than the embedded server's shutdown hook exit(0).
process.on('beforeExit', () => process.exit(process.exitCode ?? 0));
const listener = net.createServer();
await new Promise(r => listener.listen(0, '127.0.0.1', r));
const port = listener.address().port; await new Promise(r => listener.close(r));
const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-finance-'));
const server = new EmbeddedPostgres({ databaseDir, user: 'postgres', password: 'isolated-test', port, persistent: false, autoRehydrateSymlinks: true, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1', '-k', ''], onLog: () => {}, onError: () => {} });
let pool;
try {
  await server.initialise(); await server.start();
  pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password: 'isolated-test', database: 'postgres', max: 8 });
  const q = (sql, args) => pool.query(sql, args);
  await q('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE organizations(id uuid primary key); CREATE TABLE work_items(id uuid primary key, organization_id uuid, status text);');
  // Match the existing operational-memory/output schema used by the additive migration.
  await q(`CREATE TABLE work_item_outputs(id uuid primary key default gen_random_uuid(),work_item_id uuid not null references work_items(id),content jsonb not null,created_at timestamptz not null default now());
    CREATE TABLE operational_memory(id uuid primary key default gen_random_uuid(),scope_type text not null,scope_id uuid,key text not null,version integer not null,status text not null default 'active' check(status in ('active','superseded','expired')),content jsonb not null,source_type text,source_id uuid,created_by uuid,created_at timestamptz not null default now(),expires_at timestamptz,unique(scope_type,scope_id,key,version));
    CREATE UNIQUE INDEX operational_memory_one_active ON operational_memory(scope_type,COALESCE(scope_id::text,''),key) WHERE status='active';`);
  for (const f of ['supabase/ops-06-ai-spend-guard-migration-standalone.sql', 'supabase/ops-13-workforce-roles-migration-standalone.sql', ...(process.env.NOVA_TEST_BASELINE === '1' ? [] : ['supabase/migrations/20261104134533_nova_execution_safety.sql'])]) await q(fs.readFileSync(f, 'utf8'));
  await q("INSERT INTO ai_spend_limits(purpose, limit_usd, max_concurrent, approved_by) VALUES('fixture', 1, 10, 'fixture'),('other',1,10,'fixture')");
  const reserve = (id, purpose = 'fixture', price = '0.1') => q('SELECT ai_spend_reserve($1, NULL, $2, $3, $3, $3, $4) AS r', [id, purpose, 'fixture', price]).then(x => x.rows[0].r);
  const duplicate = await Promise.all([reserve('same'), reserve('same', 'other')]);
  assert.equal(duplicate.filter(x => x.ok).length, 1, 'One request cannot dispatch twice, even under different purpose locks');
  assert.equal(duplicate.find(x => !x.ok).reason, 'duplicate_request');
  assert.equal((await reserve('nan', 'fixture', 'NaN')).ok, false, 'Unknown/non-finite price cannot reserve');
  const org = crypto.randomUUID(), other = crypto.randomUUID(), actor = crypto.randomUUID();
  await q('INSERT INTO organizations VALUES($1),($2)', [org, other]);
  await q("INSERT INTO owner_preferences(organization_id,key,value) VALUES($1,'auto_approve_cents','1000'),($1,'monthly_budget_cents','1000')", [org]);
  await q("INSERT INTO finance_balance_snapshots(organization_id,account_label,balance_cents,as_of,source) VALUES($1,'fixture',1000,now()-interval '1 hour','owner_entered')", [org]);
  const expense = async (amount, organization = org) => (await q("INSERT INTO expense_requests(organization_id,requested_by_role,purpose,amount_cents) VALUES($1,'cmo','isolated fixture',$2) RETURNING id", [organization, amount])).rows[0].id;
  const approve = (id, unlocked = true, organization = org, mode = 'policy') => q('SELECT nova_approve_expense($1,$2,$3,$4,$5) AS r', [organization, id, actor, mode, unlocked]).then(x => x.rows[0].r);
  const first = await expense(600), second = await expense(600);
  const results = await Promise.all([approve(first), approve(second)]);
  assert.equal(results.filter(x => x.ok).length, 1, 'Concurrent approvals cannot spend the same balance/budget');
  assert.equal((await approve(first, true, other)).ok, false, 'Cross-business approval cannot reach the expense');
  assert.equal((await approve(await expense(1), false, org, 'owner')).ok, false, 'Owner UI cannot override the server no-spending instruction');
  const accepted = results.find(x => x.ok).expense.id;
  await q('SELECT nova_record_expense($1,$2)', [org, accepted]);
  assert.equal((await approve(await expense(500))).ok, false, 'Recorded debit since balance must still reduce cash and monthly budget');
  await q("UPDATE finance_balance_snapshots SET as_of=now()+interval '1 day' WHERE organization_id=$1", [org]);
  assert.equal((await approve(await expense(1))).ok, false, 'Future balances cannot authorize spending');
  const zero = await expense(0, other);
  assert.equal((await approve(zero, false, other, 'owner')).ok, true, 'Verified zero-cost work needs no invented balance');
  const grants = (await q("SELECT has_function_privilege('anon','nova_approve_expense(uuid,uuid,uuid,text,boolean)','EXECUTE') AS anon, has_function_privilege('authenticated','ai_spend_reserve(text,uuid,text,text,text,text,numeric)','EXECUTE') AS client")).rows[0];
  assert.deepEqual(grants, { anon: false, client: false });
  const task = crypto.randomUUID();
  await q("INSERT INTO work_items(id,organization_id,status,role_key) VALUES($1,$2,'in_review','cfo')", [task, org]);
  await q("INSERT INTO work_item_outputs(work_item_id,content) VALUES($1,$2)", [task, { reasoning: { status: 'generated', proposed_lesson: 'Preserve dated financial evidence.' } }]);
  const learn = (organization = org) => q('SELECT nova_accept_role_learning($1,$2,$3) AS r', [organization, task, actor]).then(x => x.rows[0].r);
  assert.equal((await learn(other)).ok, false, 'A lesson from another business cannot be promoted');
  const promoted = await Promise.all([learn(), learn()]);
  assert.equal(promoted.filter(x => x.ok).length, 2); assert.equal(promoted.filter(x => x.already_approved).length, 1);
  const memories = (await q("SELECT * FROM operational_memory WHERE scope_id=$1 AND status='active'", [org])).rows;
  assert.equal(memories.length, 1); assert.equal(memories[0].content.lessons.length, 1); assert.equal(memories[0].content.approved_by, actor);
  for(let i=2;i<=10;i++){
    const id=crypto.randomUUID();
    await q("INSERT INTO work_items(id,organization_id,status,role_key) VALUES($1,$2,'in_review','cfo')",[id,org]);
    await q("INSERT INTO work_item_outputs(work_item_id,content) VALUES($1,$2)",[id,{reasoning:{status:'generated',proposed_lesson:`Lesson ${i}`}}]);
    await q('SELECT nova_accept_role_learning($1,$2,$3)',[org,id,actor]);
  }
  const retained=(await q("SELECT content FROM operational_memory WHERE scope_id=$1 AND status='active'",[org])).rows[0].content.lessons;
  assert.deepEqual(retained.map(x=>x.lesson),Array.from({length:8},(_,i)=>`Lesson ${i+3}`),'Retain the most recent eight in chronological order');
  assert.equal((await learn()).already_approved,true,'An evicted lesson cannot be promoted again');
  console.log('PASS — real PostgreSQL concurrent reservations, atomic approvals, no-spending lock, tenant scope, recorded debits, future balances and server-only grants');
  console.log('PASS — reviewed role learning is tenant-scoped, versioned and safe under concurrent approval');
} catch (e) { console.error(e); process.exitCode = 1; }
finally { if (pool) await pool.end(); await server.stop().catch(() => {}); fs.rmSync(databaseDir, { recursive: true, force: true }); }
process.exit(process.exitCode ?? 0);
