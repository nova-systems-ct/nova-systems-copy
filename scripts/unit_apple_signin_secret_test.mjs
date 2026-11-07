import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { APPLE_SECRET_MAX_SECONDS, createAppleClientSecret, saveAppleClientSecret } from './apple_signin_secret.mjs';

// Fresh synthetic keys, never the user's signing key or Apple account.
const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const base = { privateKeyPem: pair.privateKey.export({type:'pkcs8',format:'pem'}), keyId:'TESTKEY123',teamId:'TESTTEAM12',servicesId:'test.nova.workspace.web',now:1_800_000_000,ttlSeconds:86400 };
const result = createAppleClientSecret(base);
const [head,body,signature] = result.token.split('.');
assert.deepEqual(JSON.parse(Buffer.from(head,'base64url')),{alg:'ES256',kid:base.keyId});
assert.deepEqual(JSON.parse(Buffer.from(body,'base64url')),{iss:base.teamId,iat:base.now,exp:base.now+86400,aud:'https://appleid.apple.com',sub:base.servicesId});
assert.equal(Buffer.from(signature,'base64url').length,64);
assert(crypto.verify('sha256',Buffer.from(`${head}.${body}`),{key:pair.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')));
assert(!crypto.verify('sha256',Buffer.from(`${head}.${body}tampered`),{key:pair.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')));
for(const input of [{ttlSeconds:APPLE_SECRET_MAX_SECONDS+1},{ttlSeconds:59},{ttlSeconds:1.5},{now:0},{keyId:'bad'},{servicesId:'https://invalid.test'},{servicesId:`${base.teamId}.test.nova.web`},{privateKeyPem:'TEST-invalid-key'}]) assert.throws(()=>createAppleClientSecret({...base,...input}));
const wrongCurve=crypto.generateKeyPairSync('ec',{namedCurve:'secp384r1'}).privateKey.export({type:'pkcs8',format:'pem'});
assert.throws(()=>createAppleClientSecret({...base,privateKeyPem:wrongCurve}),/P-256/);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nova-apple-secret-test-'));
try {
  const keyFile=path.join(dir,'TEST.p8'), outFile=path.join(dir,'TEST.client-secret.jwt');
  fs.writeFileSync(keyFile,base.privateKeyPem,{mode:0o600});
  const cfg={keyFile,outFile,keyId:base.keyId,teamId:base.teamId,servicesId:base.servicesId};
  saveAppleClientSecret(cfg);
  assert.equal(fs.statSync(outFile).mode & 0o777,0o600);
  const original=fs.readFileSync(outFile,'utf8');
  assert.throws(()=>saveAppleClientSecret(cfg));assert.equal(fs.readFileSync(outFile,'utf8'),original);
  const link=path.join(dir,'link.jwt');fs.symlinkSync(outFile,link);assert.throws(()=>saveAppleClientSecret({...cfg,outFile:link}));
  fs.chmodSync(keyFile,0o644);assert.throws(()=>saveAppleClientSecret({...cfg,outFile:path.join(dir,'second.jwt')}),/0600/);fs.chmodSync(keyFile,0o600);
  assert.throws(()=>saveAppleClientSecret({...cfg,outFile:path.resolve('TEST-must-not-create.jwt')}),/repository/);
  const run=spawnSync(process.execPath,['scripts/apple_signin_secret.mjs','--key-file',keyFile,'--key-id',base.keyId,'--team-id',base.teamId,'--services-id',base.servicesId,'--out',path.join(dir,'cli.jwt')],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/saved to a new private file/);
  assert(!/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(run.stdout+run.stderr));assert(!run.stdout.includes('PRIVATE KEY'));
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
console.log('PASS — Apple ES256 claims/signature, expiry bound, key validation, private file permissions, overwrite/symlink refusal and no credential output (synthetic key only)');
