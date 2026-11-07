import assert from 'node:assert/strict';
import { fetchSignInProviders, providerSignInOptions } from '../src/lib/providerSignIn.js';

let calls = 0;
const options = providerSignInOptions({ provider: 'apple', origin: 'https://nova.example', returnTo: '/dashboard/integrations?tab=channels#inbox' });
assert.equal(options.provider, 'apple');
const callback = new URL(options.options.redirectTo);
assert.equal(callback.origin, 'https://nova.example');
assert.equal(callback.pathname, '/auth/callback');
assert.equal(callback.searchParams.get('returnTo'), '/dashboard/integrations?tab=channels#inbox');
for (const path of ['https://attacker.test', '//attacker.test', '/\\attacker.test', '/login', '/auth/callback?code=stale', '/reset-password', '/%0a/attacker.test']) {
  assert.equal(new URL(providerSignInOptions({provider:'google',origin:'https://nova.example',returnTo:path}).options.redirectTo).searchParams.get('returnTo'), '/dashboard');
}
assert.throws(() => providerSignInOptions({provider:'facebook',origin:'https://nova.example'}));
assert.throws(() => providerSignInOptions({provider:'google',origin:'https://attacker.test/path'}));
assert.throws(() => providerSignInOptions({provider:'google',origin:'javascript:alert(1)'}));
const config = { url: 'https://auth.example/', key: 'TEST-publishable-key', fetchImpl: async (url, request) => {
  calls++;
  assert.equal(url, 'https://auth.example/auth/v1/settings');
  assert.equal(request.headers.apikey, 'TEST-publishable-key');
  assert.equal(request.cache, 'no-store');
  assert.equal(request.headers.Authorization, undefined);
  return {ok:true,json:async()=>({external:{apple:true,google:false,facebook:true},secret:'TEST-must-not-return'})};
}};
assert.deepEqual(await fetchSignInProviders(config),{apple:'enabled',google:'disabled'});
assert.equal(calls,1);
assert.deepEqual(await fetchSignInProviders({...config,key:''}),{apple:'unavailable',google:'unavailable'});
assert.equal(calls,1);
assert.deepEqual(await fetchSignInProviders({...config,fetchImpl:async()=>({ok:false})}),{apple:'unavailable',google:'unavailable'});
assert.deepEqual(await fetchSignInProviders({...config,fetchImpl:async()=>({ok:true,json:async()=>({external:{apple:'true',google:1}})})}),{apple:'unavailable',google:'unavailable'});
assert.deepEqual(await fetchSignInProviders({...config,fetchImpl:async()=>{throw new Error('TEST credential must not be shown');}}),{apple:'unavailable',google:'unavailable'});
console.log('PASS — provider readiness, safe callback destinations, unsupported provider rejection, and credential-free error handling');
