// The one-paste migration bundle (supabase/nova-install-bundle.sql) must match the migrations it is
// built from, in the order HANDOFF.md gives, with the lockdown file last.
import fs from 'node:fs';
import { ORDER, bundle } from './build_install_bundle.mjs';

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
check('the bundle file is current (run node scripts/build_install_bundle.mjs after changing a migration)', fs.readFileSync('supabase/nova-install-bundle.sql', 'utf8') === bundle());
check('the lockdown file runs last', ORDER.at(-1).endsWith('zz-public-schema-lockdown-standalone.sql'));
const handoff = fs.readFileSync('HANDOFF.md', 'utf8');
const positions = ORDER.map((f) => handoff.indexOf(`\`${f.replace('supabase/', '')}\``));
check('HANDOFF lists every migration in the same order', positions.every((p) => p >= 0) && positions.every((p, i) => i === 0 || p > positions[i - 1]));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
