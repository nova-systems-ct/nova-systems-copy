import assert from 'node:assert/strict';
import { sendMode } from '../api/_ops/messaging.js';
import { createTwilioSender } from '../api/_wave1Handlers.js';
import { sendEmail } from '../api/_email.js';
import { emailPolicy } from '../api/_sales/core.js';
import { twilioRequest } from '../api/_twilio.js';
import { estimateUsd } from '../api/_aiSpend.js';
const before={...process.env};
try {
 delete process.env.NOVA_SPENDING_LOCK;
 Object.assign(process.env,{SALES_EMAIL_MODE:'live',RESEND_API_KEY:'fixture-not-a-key',WAVE1_SEND_ENABLED:'true',TWILIO_ACCOUNT_SID:'fixture',TWILIO_AUTH_TOKEN:'fixture'});
 assert.equal(sendMode(),'dry_run'); assert.equal(emailPolicy('fixture@example.test').send,false);
 assert.equal((await sendEmail({to:'fixture@example.test'})).skipped,true);
 let calls=0;
 const sender=createTwilioSender(process.env,async()=>{calls++;throw Error('No provider should be called');});
 assert.match((await sender({to:'+12035550100'})).error,/locked/); assert.equal(calls,0);
 await assert.rejects(()=>twilioRequest('fixture','fixture','POST','Messages.json',{}),/locked/);
 const unicode={max_tokens:600,messages:[{role:'user',content:'診断'.repeat(100)}]};
 assert(estimateUsd({in:1,out:1},unicode)>=(Buffer.byteLength(JSON.stringify(unicode),'utf8')+600)/1e6,'Reservation must not use an English-only character/token average');
 console.log('PASS — global spending lock prevents email/SMS dispatch and Unicode reservations cover byte-sized input');
} finally { for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before); }
