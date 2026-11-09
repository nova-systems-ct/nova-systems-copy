import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import packaged from '@sparticuz/chromium';
import {startHarness} from './testenv/devharness.mjs';
const H=await startHarness({manifest:true,vitePort:5218,apiPort:8818});let browser;
try{
 const org=(await H.env.sql("insert into organizations(name,slug,kind) values('TEST Nova Workforce','workforce-browser','nova_internal') returning id")).rows[0].id;
 const owner=await H.env.createUser({email:'workforce-browser@nova.test',role:'nova_super_admin',orgId:org});
 browser=await chromium.launch({executablePath:await packaged.executablePath(),args:packaged.args,headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${H.base}/login`);await page.getByLabel('Email').fill(owner.email);await page.getByLabel('Password').fill(owner.password);await page.getByRole('button',{name:/SIGN IN/}).click();await page.waitForURL(/\/dashboard/);
 await page.goto(`${H.base}/dashboard/command/workforce`);
 await page.getByRole('button',{name:'Install Nova workforce',exact:true}).click({timeout:7000});
 await page.getByText('13 of 13 workers registered',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Reporting lines',exact:true}).click();
 await page.getByRole('tree',{name:'Reporting lines'}).getByText('CFO worker',{exact:true}).waitFor();
 await page.getByRole('button',{name:'All workers',exact:true}).click();
 const search=page.getByLabel('Find a worker');await search.fill('reporting');
 await page.getByText('Playbook & activity',{exact:true}).click();
 await page.getByText('LLM is off. The real workflow still runs. No paid fallback.',{exact:true}).waitFor();
 await page.getByRole('heading',{name:'Proof of work',exact:true}).waitFor();
 await search.fill('');await page.getByRole('button',{name:'Executive desk',exact:true}).click();
 await page.getByRole('heading',{name:'Executive desk',exact:true}).waitFor();
 fs.mkdirSync('docs/qa/workforce-2026-11-05',{recursive:true});
 await page.getByRole('button',{name:'All workers',exact:true}).click();
 for(const [label,width,height]of [['desktop',1366,900],['ipad',820,1180],['phone',390,844]]){
  await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`${label} must fit without sideways scrolling`);
  await page.screenshot({path:`docs/qa/workforce-2026-11-05/${label}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS — owner installs actual workers, reads saved reporting lines and individual playbooks, separates executive controls, and fits desktop/iPad/phone');
}catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();await H.stop();}
process.exit(process.exitCode??0);
