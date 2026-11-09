import { isStripeAccountId } from './rules.js';

// Checkout currently supports test credentials only. A configured account is not proof of a live payment system.
// Keep the same assessment in Settings/readiness and Install Systems; never enable or attempt a payment here.
export function paymentReadiness(account, { isTest = false, env = process.env } = {}) {
  if (!account || account.mode === 'not_configured') return { status: 'blocked', test_ready: false, detail: 'Online deposits are not configured' };
  if (env.OPS_KILL_SWITCH === 'true') return { status: 'blocked', test_ready: false, detail: 'Online payments are paused' };
  const destination = account.mode === 'client_connected_account' && isStripeAccountId(account.stripe_account_ref);
  const testPlatform = account.mode === 'nova_test_platform' && isTest;
  if (!destination && !testPlatform) return { status: 'blocked', test_ready: false, detail: 'No valid payment destination for this business' };
  if (!String(env.STRIPE_SECRET_KEY || '').startsWith('sk_test')) return { status: 'blocked', test_ready: false, detail: 'Test payment credentials are missing; live payments remain disabled' };
  if (!env.STRIPE_WEBHOOK_SECRET) return { status: 'blocked', test_ready: false, detail: 'Payment confirmation webhook is not configured' };
  return { status: 'partial', test_ready: true, detail: `${destination ? 'Business-owned Stripe connection' : 'Nova TEST account'}: TEST payments only. Live customer deposits are not enabled.` };
}
