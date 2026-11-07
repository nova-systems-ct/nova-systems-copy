// Real Nova screens, SDK and local DB; OAuth identities are isolated stand-ins.
// This does not establish Apple/Google account approval or live sign-in.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import packaged from '@sparticuz/chromium';
import {startHarness} from './testenv/devharness.mjs';
const H = await startHarness({manifest:true,vitePort:5226,apiPort:8826});
let browser;
try {
  const org=(await H.env.sql("insert into organizations(name,slug,kind) values('TEST Nova Sign In','provider-signin-browser','nova_internal') returning id")).rows[0].id;
  const owner=await H.env.createUser({email:'provider-signin@nova.test',role:'nova_super_admin',orgId:org});
  browser=await chromium.launch({headless:true,executablePath:await packaged.executablePath(),args:packaged.args.filter(x=>!x.startsWith('--single-process'))});
  const out='docs/qa/provider-signin-2026-11-07';fs.mkdirSync(out,{recursive:true});
  for(const provider of ['apple','google']) {
    const context=await browser.newContext({viewport:{width:1366,height:1000}});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/auth/v1/settings',route=>route.fulfill({json:{external:{apple:true,google:true}}}));
    let requests=0;
    await page.route('**/auth/v1/authorize?**',async route=>{
      requests++;const url=new URL(route.request().url());
      assert.equal(url.searchParams.get('provider'),provider);
      const callback=new URL(url.searchParams.get('redirect_to'));
      assert.equal(callback.origin,H.base);assert.equal(callback.pathname,'/auth/callback');
      assert.equal(callback.searchParams.get('returnTo'),'/dashboard/integrations');
      callback.hash=new URLSearchParams({access_token:H.env.jwt(owner.id,owner.email),refresh_token:'TEST-local-OAuth-refresh',expires_in:'3600',token_type:'bearer',type:'signup'}).toString();
      await route.fulfill({status:302,headers:{location:callback.href}});
    });
    await page.goto(`${H.base}/login?returnTo=${encodeURIComponent('/dashboard/integrations')}`);
    const button=page.getByRole('button',{name:`Continue with ${provider==='apple'?'Apple':'Google'}`,exact:true});
    await button.waitFor();await page.waitForFunction(name=>{const b=[...document.querySelectorAll('button')].find(el=>el.textContent===name);return b&&!b.disabled},`Continue with ${provider==='apple'?'Apple':'Google'}`);
    if(provider==='apple')for(const [label,width,height] of [['desktop',1366,1000],['ipad',820,1180],['phone',390,844]]) {
      await page.setViewportSize({width,height});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
      await page.screenshot({path:`${out}/local-enabled-${label}.png`,fullPage:true});
    }
    await button.click();await page.waitForURL(/\/dashboard\/integrations$/,{timeout:20000});
    await page.getByRole('heading',{name:'Your connected channels',exact:true}).waitFor();
    assert.equal(requests,1);assert.deepEqual(errors,[]);
    // An OAuth rejection must not reuse an existing session to claim success.
    await page.goto(`${H.base}/auth/callback?error=access_denied&error_description=TEST-sensitive-error&returnTo=/dashboard/integrations`);
    await page.getByRole('alert').filter({hasText:'Sign-in could not be completed'}).waitFor();
    assert.equal(page.url(),`${H.base}/auth/callback`);
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:1366,height:1000}});const page=await context.newPage();
  let authorizeRequests=0;page.on('request',r=>{if(r.url().includes('/auth/v1/authorize'))authorizeRequests++;});
  await page.route('**/auth/v1/settings',route=>route.fulfill({json:{external:{apple:false,google:false}}}));
  await page.goto(`${H.base}/login`);
  await page.getByText('Apple sign-in setup is pending. Use email and password below.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Continue with Apple',exact:true}).isEnabled(),false);
  assert.equal(await page.getByRole('button',{name:'Continue with Google',exact:true}).isEnabled(),false);
  await page.screenshot({path:`${out}/local-provider-setup-pending.png`,fullPage:true});
  // Failed settings reads fail closed while password sign-in remains usable.
  await page.unroute('**/auth/v1/settings');await page.route('**/auth/v1/settings',route=>route.fulfill({status:503,json:{message:'TEST unavailable'}}));
  await page.reload();await page.getByText('Google sign-in is temporarily unavailable. Use email and password below.',{exact:true}).waitFor();
  await page.getByLabel('Email',{exact:true}).fill(owner.email);await page.getByLabel('Password',{exact:true}).fill(owner.password);
  await page.getByRole('button',{name:'SIGN IN',exact:true}).click();await page.waitForURL(/\/dashboard$/,{timeout:20000});
  assert.equal(authorizeRequests,0);await context.close();
  console.log('PASS — Apple and Google SDK redirects, same-app callback, authenticated CRM destination, rejected-callback refusal, disabled/unavailable providers, password fallback, and desktop/iPad/phone fit (local OAuth stand-ins only)');
} catch(error) {console.error(error);process.exitCode=1;}
finally {if(browser)await browser.close();await H.stop();}
process.exit(process.exitCode??0);
