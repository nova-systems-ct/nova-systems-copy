// Regenerates the table list inside supabase/zz-public-schema-lockdown-standalone.sql from every standalone migration.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const f = 'supabase/zz-public-schema-lockdown-standalone.sql';
const list = execSync('node scripts/check_migration_lockdown.mjs --print').toString().trimEnd();
const s = fs.readFileSync(f, 'utf8').replace(/(tables text\[\] := ARRAY\[\r?\n)[\s\S]*?(\r?\n\s*\];)/, (m, a, b) => a + list + b);
fs.writeFileSync(f, s); console.log('lockdown list regenerated');
