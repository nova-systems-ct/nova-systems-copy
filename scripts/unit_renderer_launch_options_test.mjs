import assert from 'node:assert/strict';
const R=await import('../api/_renderPage.js');
assert.equal(typeof R.launchOptions,'function','Hosted research needs a packaged Chromium launch configuration');
const options=await R.launchOptions({NOVA_CHROMIUM_PROVIDER:'bundled'},{default:{args:['--single-process','--proxy-bypass-list=*','--proxy-server=http://evil.example'],executablePath:async()=>'/fixture/chromium'}});
assert.equal(options.executablePath,'/fixture/chromium');assert.equal(options.proxy.server,'http://127.0.0.1:9');assert(!options.args.some(x=>x.startsWith('--proxy-bypass-list')));assert(!options.args.some(x=>x.includes('evil.example')));
assert(options.args.includes('--disable-background-networking'));
console.log('PASS — packaged Chromium launch preserves the renderer network boundary');
