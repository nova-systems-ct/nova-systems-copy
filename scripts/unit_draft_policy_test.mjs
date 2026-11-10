import assert from 'node:assert/strict';import {protectDraft} from '../public/sms-program/draft-policy.js';
for(const text of ['Meet us at 10 AM tomorrow.','Your cost is $200.','I have booked your appointment.','We offer a complimentary consultation.','Hello [Business Owner], your appointment is set.']){
 const safe=protectDraft('scheduling','Customer needs an introduction.',text);assert.equal(safe.output_mode,'verified_template');assert(!safe.text.includes('10 AM'));assert(!safe.text.includes('$200'));assert.match(safe.text,/Which day and time/);
}
assert.equal(protectDraft('intake','I need help collecting requests.','I run a shop and need help organizing customer requests.').output_mode,'language_model_draft');
assert.equal(protectDraft('follow_up','My business misses calls.','Thanks for reaching out. What happens when a call is missed? A truncated final').text,'Thanks for reaching out.  What happens when a call is missed?');
const booked=protectDraft('scheduling','A confirmed request.','I booked you at 10 AM.',{state:'booked',starts_at:'2026-11-10T19:00:00Z'});assert.equal(booked.output_mode,'verified_template');assert.match(booked.text,/2:00 PM EST/);assert(!booked.text.includes('10 AM'));
console.log('PASS — unsupported prices, times, guarantees, actions and placeholders are held; replacement templates are labelled; incomplete final fragments are omitted.');
