import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const M=await import('../api/_ops/wallet.js').catch(()=>({}));
assert.equal(typeof M.buildWalletSetupTest,'function','Owner must be able to test signing without inventing a rewards program or customer');
assert.equal(typeof M.buildWalletPass,'function','Wallet must generate a real signed artifact, not a readiness placeholder');
const rules={reward_threshold:10,reward_description:'One complimentary service',terms_text:'Test-only program terms, not a real offer.'};
const program={id:'p',organization_id:'o',status:'approved',name:'Test Rewards',rules,rules_sha256:crypto.createHash('sha256').update(JSON.stringify(rules)).digest('hex')};
const account={id:'a',organization_id:'o',program_id:'p',balance:7,pass_status:'none'};
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const env={NOVA_WALLET_ORGANIZATION_ID:'o',NOVA_WALLET_ISSUER_NAME:'Test issuer',GOOGLE_WALLET_ENABLED:'true',GOOGLE_WALLET_ISSUER_ID:'123456',GOOGLE_WALLET_CLASS_ID:'123456.test_rewards',GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL:'test@example.iam.gserviceaccount.com',GOOGLE_WALLET_PRIVATE_KEY_PEM:privateKey.export({type:'pkcs8',format:'pem'})};
const out=await M.buildWalletPass('google',{orgId:'o',program,account},env,{now:()=>new Date('2026-11-02T12:00:00Z')});
const token=out.url.slice('https://pay.google.com/gp/v/save/'.length),[h,p,s]=token.split('.');
assert(crypto.verify('RSA-SHA256',Buffer.from(`${h}.${p}`),publicKey,Buffer.from(s,'base64url')),'Google save link must have a real verifiable RSA signature');
const payload=JSON.parse(Buffer.from(p,'base64url'));assert.equal(payload.payload.loyaltyObjects[0].loyaltyPoints.balance.int,7);assert.equal(payload.payload.loyaltyObjects[0].classId,'123456.test_rewards');assert.equal(payload.exp-payload.iat,900);
assert(!token.includes('PRIVATE KEY'));
await assert.rejects(()=>M.buildWalletPass('google',{orgId:'other',program,account},env),/business|organization/i);
await assert.rejects(()=>M.buildWalletPass('google',{orgId:'o',program:{...program,status:'draft'},account},env),/approved/);
await assert.rejects(()=>M.buildWalletPass('google',{orgId:'o',program:{...program,rules:{...rules,reward_threshold:1}},account},env),/changed|approval/i);
await assert.rejects(()=>M.buildWalletPass('google',{orgId:'o',program,account:{...account,pass_status:'revoked'}},env),/revoked/i);
assert.equal(M.walletPlatforms({},'o').apple.can_issue,false);assert.equal(M.walletPlatforms({},'o').google.can_issue,false);
assert.equal(M.walletPlatforms({NOVA_WALLET_ORGANIZATION_ID:'o',NOVA_WALLET_ISSUER_NAME:'Test',APPLE_WALLET_ENABLED:'true',APPLE_PASS_TYPE_ID:'pass.example.invalid',APPLE_TEAM_ID:'TEST',APPLE_PASS_SIGNER_CERT_PEM:'invalid',APPLE_CSR_PRIVATE_KEY_PEM:'invalid',APPLE_WWDR_CERT_PEM:'invalid'},'o').apple.can_issue,false,'Having all key names is insufficient: broken signing credentials must fail readiness');
await assert.rejects(()=>M.buildWalletPass('apple',{orgId:'o',program,account},{}),/configured|missing|disabled/i);
console.log('PASS — real Google signature, approved ledger snapshot, tenant/approval/revocation and disabled provider gates');

// Synthetic local CA/signing certificate, never submitted to Apple or a customer.
// Proves package integrity/signature only; it is not a device-accepted Apple pass.
const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');const {spawnSync}=await import('node:child_process');const {unzipSync}=await import('fflate');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nova-wallet-test-'));
const run=args=>{const r=spawnSync('openssl',args,{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,'OpenSSL fixture/signature operation failed');};
try{
 run(['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.pem','-days','1','-subj','/CN=Test Wallet CA']);
 run(['req','-newkey','rsa:2048','-nodes','-keyout','signer.key','-out','signer.csr','-subj','/CN=Local Test Pass/OU=TESTTEAM/UID=pass.example.test']);
 run(['x509','-req','-in','signer.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-out','signer.pem','-days','1']);
 const e={NOVA_WALLET_ORGANIZATION_ID:'o',NOVA_WALLET_ISSUER_NAME:'Test issuer',APPLE_WALLET_ENABLED:'true',APPLE_TEAM_ID:'TESTTEAM',APPLE_PASS_TYPE_ID:'pass.example.test',APPLE_PASS_SIGNER_CERT_PEM:fs.readFileSync(path.join(dir,'signer.pem'),'utf8'),APPLE_CSR_PRIVATE_KEY_PEM:fs.readFileSync(path.join(dir,'signer.key'),'utf8'),APPLE_WWDR_CERT_PEM:fs.readFileSync(path.join(dir,'ca.pem'),'utf8')};
 e.APPLE_CSR_PRIVATE_KEY_PEM=crypto.createPrivateKey(e.APPLE_CSR_PRIVATE_KEY_PEM).export({type:'pkcs8',format:'pem',cipher:'aes-256-cbc',passphrase:'test-only'});e.APPLE_CSR_PRIVATE_KEY_PASSWORD='test-only';
 const apple=await M.buildWalletPass('apple',{orgId:'o',program,account},e);const zip=unzipSync(Buffer.from(apple.base64,'base64'));
 const setup=await M.buildWalletSetupTest({orgId:'o'},e);
 const setupZip=unzipSync(Buffer.from(setup.base64,'base64'));
 const setupPass=JSON.parse(Buffer.from(setupZip['pass.json']));
 assert.equal(setup.test_only,true);assert.equal(setup.platform,'apple');
 assert(setupPass.generic,'A setup test must not impersonate a real loyalty account');
 assert.match(setupPass.serialNumber,/^nova_setup_test_/);
 assert.match(JSON.stringify(setupPass),/not redeemable/i);
 assert(!setupPass.storeCard&&!setupPass.webServiceURL&&!setupPass.authenticationToken);
 assert(!JSON.stringify(setupPass).includes('PRIVATE KEY'));
 fs.writeFileSync(path.join(dir,'setup-manifest.json'),setupZip['manifest.json']);fs.writeFileSync(path.join(dir,'setup-signature'),setupZip.signature);
 run(['cms','-verify','-binary','-inform','DER','-in','setup-signature','-content','setup-manifest.json','-noverify','-out','setup-verified.json']);
 await assert.rejects(()=>M.buildWalletSetupTest({orgId:'foreign'},e),/business|disabled|configuration/i);
 await assert.rejects(()=>M.buildWalletSetupTest({orgId:'o'},{...e,APPLE_WALLET_ENABLED:'false'}),/disabled|configuration/i);
 const pass=JSON.parse(Buffer.from(zip['pass.json']));assert.equal(pass.storeCard.primaryFields[0].value,7);assert.equal(pass.passTypeIdentifier,'pass.example.test');
 assert(!pass.webServiceURL&&!pass.authenticationToken,'An unimplemented update service must not be advertised');
 const manifest=JSON.parse(Buffer.from(zip['manifest.json']));for(const [name,digest]of Object.entries(manifest))assert.equal(crypto.createHash('sha1').update(zip[name]).digest('hex'),digest);
 fs.writeFileSync(path.join(dir,'manifest.json'),zip['manifest.json']);fs.writeFileSync(path.join(dir,'signature'),zip.signature);
 run(['cms','-verify','-binary','-inform','DER','-in','signature','-content','manifest.json','-noverify','-out','verified.json']);
 await assert.rejects(()=>M.buildWalletPass('apple',{orgId:'o',program,account},{...e,APPLE_TEAM_ID:'WRONG'}),/could not be verified/);
 console.log('PASS — Apple package manifest, detached signature, ledger fields and identifier mismatch denial (synthetic CA only)');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
