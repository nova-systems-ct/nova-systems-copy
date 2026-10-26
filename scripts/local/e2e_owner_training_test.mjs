// Owner-reported: "cannot enter or test Training". Root cause (2026-10-26): the sidebar's Training item opened the reviewer queue
// (/dashboard/sales-team/academy), not the programs. Through visible controls on LOCAL STAGING: Training → a program → a lesson
// → Mark lesson complete → the completion survives a reload; the owner still reaches the review queue from Training.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const env = read('.env.local-staging'); const acct = read('.env.local-staging-accounts');
const APP = 'http://localhost:5180';
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const seen = (loc, t = 15000) => loc.first().waitFor({ state: 'visible', timeout: t }).then(() => true, () => false);
const pg = createRequire(path.join(process.cwd(), '.testenv', 'package.json'))('pg');
const db = new pg.Client({ connectionString: env.LOCAL_DB_URL }); await db.connect();
const owner = (await db.query('select id from auth.users where email=$1', [acct.OWNER_EMAIL])).rows[0].id;
const browser = await pw.webkit.launch({ headless: true }).catch(() => pw.chromium.launch({ headless: true }));
try {
  const p = await (await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${APP}/login`);
  await p.getByLabel('Email').fill(acct.OWNER_EMAIL); await p.getByLabel('Password').fill(acct.OWNER_PASSWORD);
  await p.getByRole('button', { name: /SIGN IN/ }).click(); await p.waitForURL(/\/dashboard/);
  await p.getByRole('link', { name: 'Training', exact: true }).first().click();
  check('Training opens the programs, not the review queue', await seen(p.getByRole('heading', { name: 'Nova Sales Academy' })));
  check('only Training is highlighted in the menu (Growth no longer claims it)', (await p.locator('nav a[aria-current="page"]').allInnerTexts()).map((t) => t.trim()).join('|').includes('Training') && !(await p.locator('nav a[aria-current="page"]').allInnerTexts()).join('|').includes('Growth'), (await p.locator('nav a[aria-current="page"]').allInnerTexts()).join('|'));
  check('the owner can reach the review queue from Training', await seen(p.getByRole('link', { name: 'Review submissions and approve content' })));
  await p.getByText('Nova Fundamentals').first().click();
  const markBtn = p.getByRole('button', { name: 'Mark lesson complete' }).first();
  check('a program opens with lessons the owner can work through', await seen(markBtn));
  const before = (await db.query('select count(*)::int n from academy_lesson_progress lp join academy_enrollments e on e.id=lp.enrollment_id where e.staff_user_id=$1', [owner]).catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n;
  await markBtn.click(); await p.waitForTimeout(1500);
  const after = (await db.query('select count(*)::int n from academy_lesson_progress lp join academy_enrollments e on e.id=lp.enrollment_id where e.staff_user_id=$1', [owner]).catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n;
  check('completing a lesson is saved on the server', after === before + 1 || (before === -1 && after === -1 ? false : after > before), `${before} -> ${after}`);
  await p.reload();
  check('after a reload the progress is still there (lesson marked ✓, counter advanced)', await seen(p.getByRole('button', { name: /^✓ \d+\./ })));
  check('no page errors', errors.length === 0, errors.join('; '));
} finally { await db.end(); await browser.close(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
