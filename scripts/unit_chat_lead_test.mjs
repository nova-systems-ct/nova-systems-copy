import assert from 'node:assert/strict';
const M=await import('../src/lib/chatLead.js').catch(()=>({}));
assert.equal(typeof M.captureLeadAnswer,'function');
let data={};const values=['Avery','Westside Auto','Missed appointment calls','Thursday','avery@example.test'];
for(let step=0;step<values.length;step++){const r=M.captureLeadAnswer(data,step,values[step]);assert(!r.error);data=r.data;assert.equal(r.complete,step===4);}
assert.deepEqual(data,{name:'Avery',business:'Westside Auto',challenge:'Missed appointment calls',day:'Thursday',email:'avery@example.test'});
assert(M.captureLeadAnswer(data,4,'not email').error);assert(M.captureLeadAnswer(data,5,'again').error);
assert.equal(M.contactLeadPayload(data).company,'Westside Auto');assert.match(M.contactLeadPayload(data).message,/Missed appointment calls/);
console.log('PASS — chat answers preserve exact customer fields and validate final submission');
