import { safeReturnTo } from './returnTo.js';

// Invited users need to choose a password just as recovery users do. Never
// send them back to the password form again after they save it.
export function authDestination({ type, event, returnTo } = {}) {
  const requested = safeReturnTo(returnTo);
  const destination = /^\/reset-password(?:[?#]|$)/.test(requested) ? '/dashboard' : requested;
  return type === 'invite' || type === 'recovery' || event === 'PASSWORD_RECOVERY'
    ? `/reset-password?returnTo=${encodeURIComponent(destination)}`
    : destination;
}
