// Which job types the background worker holds back (api/_workerCapabilities.js heldJobTypes). Pure logic.
//   node scripts/unit_worker_capabilities_test.mjs
const { heldJobTypes } = await import('../api/_workerCapabilities.js');
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
check('no registered workers: nothing is held (work runs as before registration existed)', heldJobTypes([]).length === 0);
check('a paused (suspended) worker holds its job types', JSON.stringify(heldJobTypes([{ capability_key: 'monitoring', status: 'suspended' }])) === JSON.stringify(['ops_sentry_sweep']));
check('a retired (inactive) worker is no longer registered, so it holds nothing', heldJobTypes([{ capability_key: 'monitoring', status: 'inactive' }]).length === 0, JSON.stringify(heldJobTypes([{ capability_key: 'monitoring', status: 'inactive' }])));
check('a retired record next to an active one for the same capability: the active one wins', heldJobTypes([{ capability_key: 'reporting', status: 'inactive' }, { capability_key: 'reporting', status: 'active' }]).length === 0);
check('a retired record does not cancel a real pause on the same capability', JSON.stringify(heldJobTypes([{ capability_key: 'monitoring', status: 'inactive' }, { capability_key: 'monitoring', status: 'suspended' }])) === JSON.stringify(['ops_sentry_sweep']));
check('an active worker holds nothing', heldJobTypes([{ capability_key: 'intake_booking', status: 'active' }]).length === 0);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
