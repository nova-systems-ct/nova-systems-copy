import assert from 'node:assert/strict';
import {availableSocialProviders,socialReturnUrl} from '../src/lib/socialLogin.js';
assert.deepEqual(await availableSocialProviders('https://own.invalid','public',async()=>({ok:true,json:async()=>({external:{apple:true,google:false}})})),{apple:true,google:false});
assert.deepEqual(await availableSocialProviders('https://own.invalid','public',async()=>({ok:false})),{apple:false,google:false});
assert.deepEqual(await availableSocialProviders('','',async()=>{throw Error('must not fetch')}),{apple:false,google:false});
for(const dest of ['https://bad.invalid','//bad.invalid','/\\bad.invalid','javascript:alert(1)'])assert.equal(new URL(socialReturnUrl('https://nova-systems.app',dest)).searchParams.get('returnTo'),'/dashboard');
assert.equal(new URL(socialReturnUrl('https://nova-systems.app','/dashboard/intake-forms')).searchParams.get('returnTo'),'/dashboard/intake-forms');
console.log('PASS — social sign-in only for enabled providers; missing/unreadable settings fail closed; callback stays on the Nova origin and rejects unsafe return destinations.');
