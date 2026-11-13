import {safeReturnTo} from './returnTo.js';

export function authCallbackUrl(origin,destination,{recovery=false}={}) {
  const url=new URL('/auth/callback',origin);
  url.searchParams.set('returnTo',safeReturnTo(destination));
  if(recovery)url.searchParams.set('mode','recovery');
  return url.toString();
}

// A routing hint only. Supabase must still establish the user's real session.
export function isRecoveryReturn(search,hash='') {
  return new URLSearchParams(search).get('mode')==='recovery'
    ||new URLSearchParams(hash.replace(/^#/, '')).get('type')==='recovery';
}

export function signInError(error) {
  if(error?.status===429||/rate|too many/i.test(error?.message||''))return 'Too many attempts. Wait a few minutes before trying again.';
  if(error?.code==='email_not_confirmed')return 'Confirm your account email first, or request a sign-in link below.';
  if(error?.status>=500||/network|fetch/i.test(error?.message||''))return 'The sign-in service could not be reached. Please try again.';
  return 'Your Nova email or password was not accepted. Use the email for your Nova account, or request a sign-in link below.';
}

export function authEmailError(error) {
  if(error?.code==='email_address_invalid')return 'Nova’s email service rejected this address. Use another email that is already registered to your Nova account, or sign in with your password.';
  if(error?.code==='email_address_not_authorized')return 'Nova’s email service cannot send to this address. Use your password or another registered Nova account email.';
  if(error?.status===429)return signInError(error);
  return 'The email could not be sent. Wait a moment and try again. If it continues, contact Nova for account recovery.';
}
