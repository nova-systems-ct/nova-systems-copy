// Unit tests for worker/emailSequenceEngine.mjs — delays, stop-on-reply, unsubscribe/suppression,
// campaign pause, account disconnect, and redelivery-safe idempotency keys. Zero dependencies.
import { decideNextAction, applyOutcome } from '../worker/emailSequenceEngine.mjs';

const results = [];
const log = (name, pass, detail) => { console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`); results.push(pass); };

const t0 = new Date('2026-09-24T12:00:00Z');
const sequence = { active: true, stop_on_reply: true, steps: [{ delay_hours: 0, subject: 'Hi' }, { delay_hours: 48, subject: 'Follow-up' }] };
const sub = { subscribed: true, suppressed: false };
const enr = () => ({ id: 'e1', status: 'active', current_step: 0, enrolled_at: t0.toISOString(), last_step_at: null, replied_at: null });

let d = decideNextAction({ enrollment: enr(), sequence, subscriber: sub, now: t0 });
log('Step 0 with zero delay sends immediately with an idempotency key', d.action === 'send' && d.idempotencyKey === 'seq:e1:0', JSON.stringify(d));

let e = applyOutcome(enr(), d, t0);
d = decideNextAction({ enrollment: e, sequence, subscriber: sub, now: new Date(t0.getTime() + 3600_000) });
log('Step 1 waits out its 48h delay (does not send after 1h)', d.action === 'wait', JSON.stringify(d));

d = decideNextAction({ enrollment: e, sequence, subscriber: sub, now: new Date(t0.getTime() + 49 * 3600_000) });
log('Step 1 sends once the delay has elapsed', d.action === 'send' && d.stepIndex === 1, JSON.stringify(d));

d = decideNextAction({ enrollment: e, sequence, subscriber: { subscribed: false }, now: new Date(t0.getTime() + 49 * 3600_000) });
log('UNSUBSCRIBE between steps wins over a due send', d.action === 'stop' && d.reason === 'unsubscribed', JSON.stringify(d));

d = decideNextAction({ enrollment: { ...e, replied_at: t0.toISOString() }, sequence, subscriber: sub, now: new Date(t0.getTime() + 49 * 3600_000) });
log('STOP-ON-REPLY halts the sequence', d.action === 'stop' && d.reason === 'replied', JSON.stringify(d));

d = decideNextAction({ enrollment: { ...e, replied_at: t0.toISOString() }, sequence: { ...sequence, stop_on_reply: false }, subscriber: sub, now: new Date(t0.getTime() + 49 * 3600_000) });
log('A reply does NOT stop a sequence configured without stop_on_reply', d.action === 'send', JSON.stringify(d));

d = decideNextAction({ enrollment: e, sequence, subscriber: { subscribed: true, suppressed: true }, now: t0 });
log('Suppressed contacts are never emailed', d.action === 'stop' && d.reason === 'suppressed');

d = decideNextAction({ enrollment: e, sequence, subscriber: sub, now: t0, campaignStatus: 'paused' });
log('A paused campaign stops sends', d.action === 'stop' && d.reason === 'campaign_paused');

d = decideNextAction({ enrollment: e, sequence, subscriber: sub, now: t0, accountDisconnected: true });
log('A disconnected account stops sends', d.action === 'stop' && d.reason === 'account_disconnected');

d = decideNextAction({ enrollment: { ...e, current_step: 2 }, sequence, subscriber: sub, now: t0 });
log('Past the last step, the sequence completes', d.action === 'stop' && d.reason === 'completed');
log('applyOutcome marks completion vs. stopped distinctly', applyOutcome(e, { action: 'stop', reason: 'completed' }).status === 'completed' && applyOutcome(e, { action: 'stop', reason: 'replied' }).status === 'stopped');

d = decideNextAction({ enrollment: { ...enr(), status: 'stopped' }, sequence, subscriber: sub, now: t0 });
log('An already-stopped enrollment does nothing', d.action === 'none');

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} unit checks passed`);
process.exit(passed === results.length ? 0 : 1);
