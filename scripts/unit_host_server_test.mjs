import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHostServer } from './hosting/server.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-host-'));
fs.writeFileSync(path.join(root, 'index.html'), '<h1>Nova</h1>');
fs.writeFileSync(path.join(root, 'nova logo.png'), Buffer.from([137,80,78,71]));
fs.mkdirSync(path.join(root, 'assets'));
fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'console.log("Nova")');
const handler = async (req, res) => {
  if (req.query.raw === '1') { const chunks=[]; for await (const c of req) chunks.push(c); return res.json({raw:Buffer.concat(chunks).toString()}); }
  res.json({ body:req.body, query:req.query });
};
const server = createHostServer({ dist:root, routes:{echo:{default:handler}, raw:{default:handler,config:{api:{bodyParser:false}}}}, maxBodyBytes:100 });
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
try {
  let r=await fetch(base+'/dashboard/audit'); assert.equal(r.status,200); assert.match(await r.text(),/Nova/);
  r=await fetch(base+'/assets/app.js'); assert.match(r.headers.get('content-type'),/javascript/);
  r=await fetch(base+'/nova%20logo.png'); assert.equal(r.status,200,'encoded asset names must load'); assert.equal(r.headers.get('content-type'),'image/png');
  r=await fetch(base+'/assets/missing.js'); assert.equal(r.status,404,'missing scripts never get SPA HTML');
  r=await fetch(base+'/.env'); assert.equal(r.status,404,'private files cannot be served');
  r=await fetch(base+'/api/_auth'); assert.equal(r.status,404,'internal helpers cannot become public endpoints');
  r=await fetch(base+'/api/echo?org=test',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":"Isaac"}'}); assert.deepEqual(await r.json(),{body:{name:'Isaac'},query:{org:'test'}});
  r=await fetch(base+'/api/echo',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'}); assert.equal(r.status,400);
  r=await fetch(base+'/api/raw?raw=1',{method:'POST',body:'signed=bytes%20stay'}); assert.deepEqual(await r.json(),{raw:'signed=bytes%20stay'});
  r=await fetch(base+'/api/echo',{method:'POST',body:'x'.repeat(101)}); assert.equal(r.status,413);
  r=await fetch(base+'/healthz'); assert.equal(r.status,200); assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
  console.log('11 passed, 0 failed');
} finally { await new Promise(resolve=>server.close(resolve)); fs.rmSync(root,{recursive:true,force:true}); }
