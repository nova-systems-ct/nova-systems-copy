import assert from 'node:assert/strict';
const M=await import('../api/_ops/modules.js');
assert.equal(typeof M.emailSetupOutcome,'function');
for(const checks of [[],[{key:'dns_mx',result:'unknown'}],[{key:'dns_mx',result:'ok'}],[{key:'dns_spf',result:'unknown'},{key:'dns_dmarc',result:'ok'}]])assert.equal(M.emailSetupOutcome(checks,'fixture.example')[0],'blocked','Unavailable or inapplicable DNS is never setup success');
assert.equal(M.emailSetupOutcome([{key:'dns_spf',result:'issue'},{key:'dns_dmarc',result:'ok'}],'fixture.example')[0],'blocked');
assert.equal(M.emailSetupOutcome([{key:'dns_spf',result:'ok'},{key:'dns_dmarc',result:'ok'}],'fixture.example')[0],'done');
console.log('PASS — email setup requires positive SPF and DMARC evidence');
