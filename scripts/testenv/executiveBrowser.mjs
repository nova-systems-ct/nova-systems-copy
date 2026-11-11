import assert from 'node:assert/strict';

export async function verifyExecutiveBrowser({page,base,qa}){
  await page.goto(base+'/');
  await page.getByRole('heading',{name:'Find what’s lost. Build what’s next.'}).waitFor();
  await page.locator('.nova-reference-scene img').evaluate(image=>image.decode());
  await page.screenshot({path:qa+'/nova-home-desktop.jpg'});
  await page.getByRole('button',{name:'Next service'}).click();
  await page.getByRole('heading',{name:'Capture the inquiry. Carry it forward.'}).waitFor();
  await page.getByRole('button',{name:'Previous service'}).click();
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:qa+'/nova-home-phone.jpg'});
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Sign in'}).waitFor();
  await page.goto(base+'/wallet');
  await page.getByRole('heading',{name:'Nova Wallet setup pass'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Download setup pass'}).getAttribute('href'),'/wallet/nova-setup-test.pkpass');
  await page.screenshot({path:qa+'/nova-wallet-phone.jpg',fullPage:true});
  await page.setViewportSize({width:1536,height:1024});

  await page.goto(base+'/dashboard/team-room');
  await page.getByRole('heading',{name:'Company HQ',exact:true}).waitFor();
  await page.getByRole('button',{name:'CMO Work saved'}).click();
  await page.getByRole('heading',{name:'CMO',exact:true}).waitFor();
  await page.getByLabel('Objective',{exact:true}).fill('TEST Browser: prepare a Nova Agents campaign for local service companies.');
  await page.getByLabel('Focus',{exact:true}).selectOption('agents');
  const teamUrl='**/api/client?resource=company&op=team';
  let unblock;
  const blocked=new Promise(resolve=>{unblock=resolve;});
  const delayAdvance=async route=>{
    if(route.request().postDataJSON()?.action==='advance')await blocked;
    await route.continue();
  };
  await page.route(teamUrl,delayAdvance);
  try{
    await page.getByRole('button',{name:'Start mission',exact:true}).click();
    await page.getByRole('button',{name:'Pause after this step'}).click();
  }finally{unblock();}
  await page.getByRole('status').filter({hasText:'Paused after the last saved handoff.'}).waitFor();
  await page.unroute(teamUrl,delayAdvance);
  await page.reload();
  await page.getByRole('button',{name:'Resume mission'}).click();
  await page.getByRole('status').filter({hasText:'Campaign ready for review.'}).waitFor();
  assert.equal(await page.locator('.executive-timeline li').count(),8);
  await page.getByText('Give every inquiry a clear next step.',{exact:false}).first().waitFor();
  await page.getByRole('button',{name:'Render video preview'}).click();
  await page.getByRole('link',{name:'Download video'}).waitFor({timeout:30000});
  const download=page.waitForEvent('download');
  await page.getByRole('link',{name:'Download video'}).click();
  const video=await download;
  await video.saveAs(qa+'/'+video.suggestedFilename());
  const size=await page.locator('.executive-video').evaluate(async video=>{
    if(video.readyState===0)await new Promise((resolve,reject)=>{
      video.addEventListener('loadedmetadata',resolve,{once:true});
      video.addEventListener('error',reject,{once:true});
    });
    return [video.videoWidth,video.videoHeight];
  });
  assert.deepEqual(size,[720,1280]);
  await page.locator('.executive-log-grid').screenshot({path:qa+'/nova-company-handoffs.jpg'});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:qa+'/nova-company-hq-desktop.jpg'});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:qa+'/nova-company-hq-phone.jpg',fullPage:true});
  console.log('PASS browser: homepage carousel/mobile menu, Wallet link, executive pause/reload/resume, saved receipts, playable 720×1280 video download and phone layout.');
}
