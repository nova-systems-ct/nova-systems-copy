import {safeReturnTo} from './returnTo.js';
export async function availableSocialProviders(base,anon,request=fetch) {
  if(!base||!anon) return {apple:false,google:false};
  try {
    const r=await request(base.replace(/\/$/,'')+'/auth/v1/settings',{headers:{apikey:anon},signal:AbortSignal.timeout(5000)});
    if(!r.ok) return {apple:false,google:false};
    const d=await r.json();return {apple:d?.external?.apple===true,google:d?.external?.google===true};
  } catch{return {apple:false,google:false};}
}
export function socialReturnUrl(origin,destination) {
  const u=new URL('/auth/callback',origin);u.searchParams.set('returnTo',safeReturnTo(destination));return u.toString();
}
