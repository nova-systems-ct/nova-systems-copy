// Approved email sequences (master prompt §17): delays, stop conditions, suppression. Pure logic,
// zero I/O — decides what should happen next for one enrollment; the worker performs it. Stop
// conditions are checked BEFORE every send, never assumed from the previous step, so an
// unsubscribe/reply/pause between steps always wins over a queued send.

export const STOP_REASONS = ['unsubscribed', 'replied', 'sequence_inactive', 'campaign_paused', 'suppressed', 'completed', 'account_disconnected'];

export function decideNextAction({ enrollment, sequence, subscriber, now = new Date(), campaignStatus = 'active', accountDisconnected = false }) {
  if (enrollment.status !== 'active') return { action: 'none', reason: `enrollment is ${enrollment.status}` };
  if (!subscriber || subscriber.subscribed === false) return { action: 'stop', reason: 'unsubscribed' };
  if (subscriber.suppressed === true) return { action: 'stop', reason: 'suppressed' };
  if (sequence.active === false) return { action: 'stop', reason: 'sequence_inactive' };
  if (campaignStatus === 'paused') return { action: 'stop', reason: 'campaign_paused' };
  if (accountDisconnected) return { action: 'stop', reason: 'account_disconnected' };
  if (sequence.stop_on_reply && enrollment.replied_at) return { action: 'stop', reason: 'replied' };

  const steps = Array.isArray(sequence.steps) ? sequence.steps : [];
  const idx = enrollment.current_step || 0;
  if (idx >= steps.length) return { action: 'stop', reason: 'completed' };

  const step = steps[idx];
  const anchor = new Date(enrollment.last_step_at || enrollment.enrolled_at);
  const dueAt = new Date(anchor.getTime() + (Number(step.delay_hours) || 0) * 3600_000);
  if (now < dueAt) return { action: 'wait', dueAt: dueAt.toISOString() };
  // The idempotency key makes a redelivered job for the same step a no-op, not a duplicate send.
  return { action: 'send', stepIndex: idx, step, idempotencyKey: `seq:${enrollment.id}:${idx}` };
}

export function applyOutcome(enrollment, decision, now = new Date()) {
  if (decision.action === 'stop') return { ...enrollment, status: decision.reason === 'completed' ? 'completed' : 'stopped', stopped_reason: decision.reason };
  if (decision.action === 'send') return { ...enrollment, current_step: decision.stepIndex + 1, last_step_at: now.toISOString() };
  return enrollment;
}
