// Installs a business on Nova from an install file. Run it against STAGING first.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/install_business.mjs installs/crystal-clear.json --org <organization id>
//       shows what would change and changes nothing
//   … --apply
//       makes those changes
//
// Production needs --production as well, on purpose. The service role key is read from the
// environment only; never put it in a file. See api/_install.js for what an install can and cannot do.
import fs from 'node:fs';
import { restDb } from '../api/_journey.js';
import { planInstall, applyInstall, describeStep } from '../api/_install.js';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const value = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : (args.find((a) => a.startsWith(`${f}=`)) || '').slice(f.length + 1); };
const file = args.find((a) => a.endsWith('.json'));
const orgId = value('--org');
const PRODUCTION_REF = 'xizmgruvuazmummotzkp';

if (!file || !/^[0-9a-f-]{36}$/i.test(orgId || '')) { console.error('Usage: node scripts/install_business.mjs installs/<business>.json --org <organization id> [--apply] [--production]'); process.exit(2); }
const url = process.env.SUPABASE_URL || '';
if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the database to install into (staging first).'); process.exit(2); }
const production = url.includes(PRODUCTION_REF);
if (production && !flag('--production')) { console.error('That is the production database. Install on staging first; add --production only when staging is checked.'); process.exit(2); }

const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
const db = restDb();
const plan = await planInstall(db, orgId, spec);
if (!plan.ok) { console.error('Not installed:\n- ' + plan.problems.join('\n- ')); process.exit(1); }
console.log(`${spec.business} → ${plan.organization.name} (${plan.organization.slug || 'no web address name'}) on ${new URL(url).host}${production ? ' [PRODUCTION]' : ''}`);
if (!plan.steps.length) { console.log('Nothing to change: the business already matches the install file.'); process.exit(0); }
for (const st of plan.steps) console.log(`- ${describeStep(st)}`);
if (!flag('--apply')) { console.log('\nNothing was changed. Add --apply to make these changes.'); process.exit(0); }
const done = await applyInstall(db, orgId, plan);
console.log(`\nDone: ${done.length} change${done.length === 1 ? '' : 's'} made. Going live, texting, calls and the spending cap are switched on in the Business desk under "Switch on".`);
