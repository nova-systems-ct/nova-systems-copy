// Workforce role decisions (api/_hierarchy/roleRules.js): deterministic code, no model calls.
//   node scripts/unit_workforce_roles_test.mjs
const R = await import('../api/_hierarchy/roleRules.js');
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const now = new Date('2026-10-31T12:00:00Z');
const day = 86400_000;

// CFO: funds, freshness, commitments, policy
let d = R.cfoDecision({ amountCents: 6000, balance: null, commitmentsCents: 0, spentThisMonthCents: 0, prefs: {}, now });
check('with no balance on record the CFO does not decide: funds unknown, sent to the owner', d.decision === 'needs_owner' && d.available_cents === null && d.recommendation === 'unknown' && /No balance/.test(d.reasons.join(' ')), JSON.stringify(d));
d = R.cfoDecision({ amountCents: 6000, balance: { balance_cents: 500000, as_of: new Date(now - 20 * day).toISOString() }, commitmentsCents: 0, spentThisMonthCents: 0, prefs: {}, now });
check('a balance older than the freshness limit (default 7 days) is not used', d.decision === 'needs_owner' && d.available_cents === null && /20 days old/.test(d.reasons.join(' ')), JSON.stringify(d));
d = R.cfoDecision({ amountCents: 6000, balance: { balance_cents: 10000, as_of: now.toISOString() }, commitmentsCents: 8000, spentThisMonthCents: 0, prefs: {}, now });
check('a bank balance alone is not enough: commitments are subtracted, and a shortfall is recommended against', d.available_cents === 2000 && d.recommendation === 'deny' && d.decision === 'needs_owner', JSON.stringify(d));
d = R.cfoDecision({ amountCents: 6000, balance: { balance_cents: 500000, as_of: now.toISOString() }, commitmentsCents: 0, spentThisMonthCents: 0, prefs: {}, now });
check('funds are sufficient but no owner policy exists: recommended, still the owner\'s decision', d.recommendation === 'approve' && d.decision === 'needs_owner' && /No automatic approval/.test(d.reasons.join(' ')), JSON.stringify(d));
d = R.cfoDecision({ amountCents: 6000, balance: { balance_cents: 500000, as_of: now.toISOString() }, commitmentsCents: 0, spentThisMonthCents: 0, prefs: { auto_approve_cents: 10000, monthly_budget_cents: 50000 }, now });
check('within the owner\'s auto-approval limit and monthly budget, with fresh funds: approved by policy', d.decision === 'approved_by_policy', JSON.stringify(d));
d = R.cfoDecision({ amountCents: 6000, balance: { balance_cents: 500000, as_of: now.toISOString() }, commitmentsCents: 0, spentThisMonthCents: 48000, prefs: { auto_approve_cents: 10000, monthly_budget_cents: 50000 }, now });
check('over the monthly budget the owner decides even under the per-expense limit', d.decision === 'needs_owner' && /monthly budget/.test(d.reasons.join(' ')), JSON.stringify(d));

// COO: bounded, safe recovery of failed jobs
const job = (o) => ({ id: 'j', job_type: 'ops_sentry_sweep', status: 'failed', attempts: 2, max_attempts: 5, payload: {}, ...o });
check('a failed, repeatable maintenance job may be put back in the queue', R.cooRetry(job(), { now }).retry === true);
check('a job that sends messages is never retried by the COO (escalated instead)', R.cooRetry(job({ job_type: 'ops_followup_send' }), { now }).retry === false);
check('a dead-lettered job is not retried', R.cooRetry(job({ status: 'dead_letter' }), { now }).retry === false);
check('a job the COO already retried today is not retried again', R.cooRetry(job({ payload: { coo_retried_at: new Date(now - 3600_000).toISOString() } }), { now }).retry === false);

// Executive assistant: decisions first, oldest first; escalate what waited too long
const items = [
  { kind: 'review', title: 'Report v4', since: new Date(now - 2 * 3600_000).toISOString() },
  { kind: 'escalation', title: 'Customer asked for a person', since: new Date(now - 30 * 3600_000).toISOString() },
  { kind: 'expense', title: 'Ad test $60', since: new Date(now - 1 * 3600_000).toISOString() },
];
const pr = R.eaPrioritize(items, { escalate_after_hours: 24 }, now);
check('the brief puts customer escalations first, then money decisions, then reviews', pr.map((x) => x.kind).join() === 'escalation,expense,review', JSON.stringify(pr.map((x) => x.kind)));
check('an item waiting longer than the owner\'s limit is marked to escalate', pr[0].escalate === true && pr[1].escalate === false);

// CMO: proposals from real records; no invented budget
const cm = R.cmoProposals({ stalled: 4, optedOut: 1, campaigns: [{ name: 'Oct revive', sent: 10, replied: 2, booked: 1 }], prefs: {} });
check('stalled inquiries become a Revive proposal for the owner, with the count', cm.proposals.some((p) => p.kind === 'revive' && /4 stalled/.test(p.title)));
check('without an owner test budget the CMO proposes no expense and says why', !cm.expense && /No test budget/.test(cm.notes.join(' ')));
check('campaign performance is reported from records (reply and booking rates)', cm.performance[0].reply_rate === 0.2 && cm.performance[0].booking_rate === 0.1);
const cm2 = R.cmoProposals({ stalled: 0, campaigns: [], prefs: { cmo_test_budget_cents: 6000 } });
check('with an owner test budget, the CMO proposes exactly that amount (never more)', cm2.expense?.amount_cents === 6000);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
