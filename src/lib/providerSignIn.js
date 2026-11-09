import { safeReturnTo } from './returnTo.js';

export const SIGN_IN_PROVIDERS = ['apple', 'google'];
const unavailable = () => ({ apple: 'unavailable', google: 'unavailable' });

// /settings is GoTrue's public provider switch, not a claim that a real login
// has passed. Only publishable frontend configuration is used here.
export async function fetchSignInProviders({ url, key, fetchImpl = fetch, signal } = {}) {
  if (!url || !key) return unavailable();
  try {
    const response = await fetchImpl(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key }, cache: 'no-store',
      signal: signal || AbortSignal.timeout(6000),
    });
    if (!response.ok) return unavailable();
    const settings = await response.json();
    return Object.fromEntries(SIGN_IN_PROVIDERS.map(provider => [provider,
      settings?.external?.[provider] === true ? 'enabled' :
      settings?.external?.[provider] === false ? 'disabled' : 'unavailable',
    ]));
  } catch { return unavailable(); }
}

export function providerSignInOptions({ provider, origin, returnTo } = {}) {
  if (!SIGN_IN_PROVIDERS.includes(provider)) throw new Error('Unsupported sign-in provider');
  const base = new URL(origin);
  if (base.origin !== origin || !['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid app origin');
  let destination = safeReturnTo(returnTo);
  if (/^\/(?:login|auth\/callback|reset-password)(?:[/?#]|$)/.test(destination)) destination = '/dashboard';
  const callback = new URL('/auth/callback', base);
  callback.searchParams.set('returnTo', destination);
  return { provider, options: { redirectTo: callback.href } };
}
