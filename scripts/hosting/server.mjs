// Host the existing Vercel-style handlers and built frontend on one Node web service.
// No provider credentials are exposed by this adapter; authorization remains in each real handler.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.pdf':'application/pdf'};
const COMMON = JSON.parse(fs.readFileSync(path.join(ROOT,'vercel.json'))).headers.find(rule=>rule.source==='/(.*)').headers;

export function createHostServer({ dist=path.join(ROOT,'dist'), routes, maxBodyBytes=6*1024*1024 }={}) {
  const modules = new Map();
  const allowed = routes ? Object.keys(routes) : fs.readdirSync(path.join(ROOT,'api')).filter(name=>/^[a-z][a-z-]*\.js$/.test(name)).map(name=>name.slice(0,-3));
  const server=http.createServer(async (req,res)=>{
    for(const h of COMMON) res.setHeader(h.key,h.value);
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    const json=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
    try {
      const rawPath=decodeURIComponent(req.url.split('?')[0]);
      if(rawPath.includes('\\') || rawPath.includes('\0') || rawPath.split('/').some(part=>part.startsWith('.'))) return json(404,{error:'Not found'});
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/healthz') return json(200,{ok:true});
      if(url.pathname.startsWith('/api/')) {
        res.setHeader('Cache-Control','no-store');
        const name=url.pathname.slice(5);
        if(!allowed.includes(name)) return json(404,{error:'Not found'});
        if(Number(req.headers['content-length']||0)>maxBodyBytes){req.resume();return json(413,{error:'Request too large'});}
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>maxBodyBytes) throw Object.assign(new Error('Request too large'),{status:413});chunks.push(chunk);}
        const buffer=Buffer.concat(chunks);
        if(!modules.has(name)) modules.set(name,routes ? routes[name] : await import(pathToFileURL(path.join(ROOT,'api',`${name}.js`))));
        const mod=modules.get(name);
        const input=Readable.from(buffer.length?[buffer]:[]);
        Object.assign(input,{headers:req.headers,method:req.method,url:req.url,socket:req.socket,query:Object.fromEntries(url.searchParams)});
        if(mod.config?.api?.bodyParser!==false) {
          const type=String(req.headers['content-type']||'');
          if(!buffer.length) input.body={};
          else if(type.includes('application/json')) {try{input.body=JSON.parse(buffer.toString());}catch{return json(400,{error:'Invalid JSON'});}}
          else if(type.includes('application/x-www-form-urlencoded')) input.body=Object.fromEntries(new URLSearchParams(buffer.toString()));
          else input.body=buffer.toString();
        }
        res.status=(status)=>{res.statusCode=status;return res;};
        res.json=(body)=>{json(res.statusCode,body);return res;};
        res.send=(body)=>{res.end(body);return res;};
        await mod.default(input,res);
        if(!res.writableEnded) res.end();
        return;
      }
      if(!['GET','HEAD'].includes(req.method)) return json(405,{error:'Method not allowed'});
      let file=path.resolve(dist,'.'+rawPath);
      if(!file.startsWith(path.resolve(dist)+path.sep)) file=path.join(dist,'index.html');
      if(!fs.existsSync(file)||!fs.statSync(file).isFile()) {
        if(path.extname(url.pathname)) return json(404,{error:'Not found'});
        file=path.join(dist,'index.html');
      }
      if(!fs.existsSync(file)) return json(503,{error:'Application build unavailable'});
      res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');
      res.setHeader('Cache-Control',file.includes(path.sep+'assets'+path.sep)?'public, max-age=31536000, immutable':'no-cache');
      if(req.method==='HEAD') return res.end();
      const stream=fs.createReadStream(file);
      stream.on('error',()=>res.destroy());stream.pipe(res);
    } catch(error) {
      if(!res.headersSent) json(error.status||500,{error:error.status===413?'Request too large':'Request could not be completed'});
      else res.end();
    }
  });
  server.requestTimeout=30_000;server.headersTimeout=15_000;
  return server;
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  process.env.APP_BASE_URL ||= process.env.RENDER_EXTERNAL_URL;
  const server=createHostServer();
  server.listen(Number(process.env.PORT)||10000,'0.0.0.0',()=>console.log('Nova demo HTTP server ready'));
  const stop=()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10_000).unref();};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
