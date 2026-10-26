// Every sidebar destination (main menu and More) at iPad portrait, iPad landscape and phone sizes, signed in as the owner on
// LOCAL STAGING: the page renders a heading, throws no page error, shows no generic failure, and has no horizontal page scroll.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const read = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const acct = read('.env.local-staging-accounts');
const APP = 'http://localhost:5180';
const ROUTES = ['/dashboard', '/dashboard/my-work', '/dashboard/audit', '/dashboard/ops/requests', '/dashboard/ops/campaigns', '/dashboard/ops/demand', '/dashboard/command/workforce', '/dashboard/ops', '/dashboard/academy', '/dashboard/intelligence', '/dashboard/growth', '/dashboard/execution', '/dashboard/companies', '/dashboard/sales-team', '/dashboard/admin', '/dashboard/contracts', '/dashboard/nova-vault', '/dashboard/ops/settings', '/dashboard/ops/install', '/dashboard/ops/monitoring'];
const SIZES = [['ipad-portrait', 820, 1180], ['ipad-landscape', 1180, 820], ['phone', 390, 844]];
let pass = 0, fail = 0; const problems = [];
const browser = await pw.webkit.launch({ headless: true }).catch(() => pw.chromium.launch({ headless: true }));
try {
  for (const [label, w, h] of SIZES) {
    const p = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
    let errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${APP}/login`);
    await p.getByLabel('Email').fill(acct.OWNER_EMAIL); await p.getByLabel('Password').fill(acct.OWNER_PASSWORD);
    await p.getByRole('button', { name: /SIGN IN/ }).click(); await p.waitForURL(/\/dashboard/);
    for (const r of ROUTES) {
      errs = [];
      await p.goto(`${APP}${r}`); await p.waitForTimeout(2200);
      const h1 = await p.locator('h1').first().isVisible().catch(() => false);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const generic = await p.getByText(/Something went wrong|local api error|Failed to load/i).first().isVisible().catch(() => false);
      const ok = h1 && over <= 1 && !errs.length && !generic;
      ok ? pass++ : (fail++, problems.push(`${label} ${r}: ${[!h1 && 'no heading', over > 1 && `horizontal scroll ${over}px`, errs.length && `page error ${errs[0].slice(0, 80)}`, generic && 'generic failure shown'].filter(Boolean).join('; ')}`));
    }
  }
} finally { await browser.close(); }
for (const x of problems) console.log(`FAIL — ${x}`);
console.log(`\n${pass} passed, ${fail} failed (${ROUTES.length} routes × ${SIZES.length} sizes)`);
process.exit(fail ? 1 : 0);
