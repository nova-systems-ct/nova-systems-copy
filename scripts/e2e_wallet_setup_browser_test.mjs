// Real app/database/download; synthetic local certificates, never Apple acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {unzipSync} from 'fflate';
import {chromium} from 'playwright';
import packaged from '@sparticuz/chromium';
import {startHarness} from './testenv/devharness.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nova-wallet-browser-'));
let H,browser;
const run=args=>assert.equal(spawnSync('openssl',args,{cwd:dir,stdio:'ignore'}).status,0);
try{
 run(['req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.pem','-days','1','-subj','/CN=LOCAL TEST CA']);
 run(['req','-newkey','rsa:2048','-nodes','-keyout','signer.key','-out','signer.csr','-subj','/CN=LOCAL TEST PASS/OU=TESTTEAM/UID=pass.example.test']);
 run(['x509','-req','-in','signer.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-out','signer.pem','-days','1']);
 H=await startHarness({manifest:true,vitePort:5224,apiPort:8824});
 const org=(await H.env.sql("insert into organizations(name,slug,kind) values('TEST Nova Wallet','wallet-browser','nova_internal') returning id")).rows[0].id;
 const owner=await H.env.createUser({email:'wallet-browser@nova.test',role:'nova_super_admin',orgId:org});
 Object.assign(process.env,{NOVA_WALLET_ORGANIZATION_ID:org,NOVA_WALLET_ISSUER_NAME:'LOCAL TEST NOVA',APPLE_WALLET_ENABLED:'true',APPLE_TEAM_ID:'TESTTEAM',APPLE_PASS_TYPE_ID:'pass.example.test',APPLE_PASS_SIGNER_CERT_PEM:fs.readFileSync(path.join(dir,'signer.pem'),'utf8'),APPLE_CSR_PRIVATE_KEY_PEM:fs.readFileSync(path.join(dir,'signer.key'),'utf8'),APPLE_WWDR_CERT_PEM:fs.readFileSync(path.join(dir,'ca.pem'),'utf8')});
 browser=await chromium.launch({executablePath:await packaged.executablePath(),args:packaged.args,headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${H.base}/login`);await page.getByLabel('Email').fill(owner.email);await page.getByLabel('Password').fill(owner.password);await page.getByRole('button',{name:/SIGN IN/}).click();await page.waitForURL(/\/dashboard/);
 await page.goto(`${H.base}/dashboard/command/workforce`);await page.getByRole('button',{name:'Install Nova workforce',exact:true}).click();await page.getByText('21 of 21 workers registered',{exact:false}).waitFor();
 await page.goto(`${H.base}/dashboard/ops/rewards`);
 await page.getByRole('button',{name:'Prepare Apple Wallet test pass',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download Apple Wallet test pass',exact:true}).click();
 const downloaded=await downloadPromise;const zip=unzipSync(fs.readFileSync(await downloaded.path()));const pass=JSON.parse(Buffer.from(zip['pass.json']));
 assert.match(pass.serialNumber,/^nova_setup_test_/);assert(pass.generic);assert.match(pass.description,/not redeemable/i);
 assert.equal((await H.env.sql('select count(*)::int as n from loyalty_accounts')).rows[0].n,0);
 assert.equal((await H.env.sql('select count(*)::int as n from loyalty_programs')).rows[0].n,0);
 assert.equal((await H.env.sql('select count(*)::int as n from loyalty_ledger')).rows[0].n,0);
 fs.mkdirSync('docs/qa/wallet-setup-2026-11-07',{recursive:true});
 for(const [name,width,height]of [['desktop',1366,900],['ipad',820,1180],['phone',390,844]]){
  await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.screenshot({path:`docs/qa/wallet-setup-2026-11-07/${name}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS — signed-in owner generates and downloads a signed generic setup pass; zero programs/accounts/points; desktop/iPad/phone fit. Synthetic signer only, not device acceptance.');
}catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();if(H)await H.stop();fs.rmSync(dir,{recursive:true,force:true});}
process.exit(process.exitCode??0);
