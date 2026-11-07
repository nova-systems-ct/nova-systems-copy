import assert from 'node:assert/strict';
import {extractPublicSignals} from '../api/_auditResearch.js';
import {crawlSite} from '../api/_publicResearch.js';

// Hidden anti-spam fields, buttons and disabled controls must not inflate buyer effort.
const form=extractPublicSignals(`<form><input name="name" required><input type="email" required>
 <textarea name="request"></textarea><input type="hidden" name="token"><input type="submit">
 <input name="honeypot" hidden><input name="unavailable" disabled></form>`, 'https://shop.example/contact').forms[0];
assert.equal(form.fields,3,'Only enabled, non-hidden data controls count toward form effort');
assert.equal(form.required_fields,2,'Required and optional controls must be distinguished');

const shell=(body)=>`<html><head><title>Factory</title></head><body>${body}</body></html>`;
const pages={'/':shell('<h1>Factory</h1><a href="/book">Book a consultation</a><a href="/quote">Request quote</a><a href="/contact">Contact</a>'),
 '/book':shell('<h1>Page not found</h1>'),'/contact':shell('<h1>Contact Factory</h1><form><input name="email"></form>')};
const out=await crawlSite('https://shop.example/',{lookup:async()=>[{address:'93.184.216.34',family:4}],fetchImpl:async(url)=>{
 const p=new URL(url).pathname;return new Response(pages[p]||'unavailable',{status:p==='/quote'?503:p==='/robots.txt'?404:200,headers:{'content-type':'text/html'}});
}});
assert(out.journey_checks?.some(x=>x.target.endsWith('/book')&&x.result==='broken'&&x.reason==='soft_404'),'A linked booking page showing Page not found is a broken path, even with HTTP 200');
assert(out.journey_checks.some(x=>x.target.endsWith('/quote')&&x.result==='unavailable'),'Temporary server errors must not become permanent absence claims');
assert.equal(out.features.online_booking,false,'A missing booking page must not count as working online booking');
assert(out.journey_checks.every(x=>x.source&&x.checked_at),'Journey checks preserve the referring page and observation time');
console.log('PASS — form effort, broken customer paths, uncertainty and evidence provenance');
// A business hosted on another organization's page must not inherit that host's
// contact forms, booking links or operating hours from unrelated navigation.
const seen=[];
const shared=await crawlSite('https://host.example/visit/cafe/',{lookup:async()=>[{address:'93.184.216.34',family:4}],fetchImpl:async(url)=>{const path=new URL(url).pathname;seen.push(path);return new Response(path==='/robots.txt'?'User-agent: *\nAllow: /':shell('<h1>Independent Cafe</h1><a href="/contact">Museum office</a><a href="/visit/cafe/menu">Cafe menu</a>'),{headers:{'content-type':path==='/robots.txt'?'text/plain':'text/html'}});}});
assert(!seen.includes('/contact'),'A page-specific audit must not crawl unrelated host pages');assert(shared.pages.every(p=>new URL(p.url).pathname.startsWith('/visit/cafe/')));

const {runQuickScan}=await import('../api/_demo.js');
const quickSeen=[];
await runQuickScan('https://host.example/visit/cafe/',{lookup:async()=>[{address:'93.184.216.34',family:4}],fetchImpl:async(url)=>{quickSeen.push(new URL(url).pathname);return new Response(shell('<h1>Independent Cafe</h1><a href="/contact">Museum office</a>'),{headers:{'content-type':'text/html'}});}});
assert(!quickSeen.includes('/contact'),'The quick scan must honor the same page-specific business boundary');
// A WAF challenge is not the business page and must not produce absence claims.
let renders=0,blockedFetches=0;
const challengeFetch=async()=>{blockedFetches++;return new Response('<html><head><title>Just a moment...</title></head><body>Verify you are human<script src="/challenge.js"></script></body></html>',{status:403,headers:{'content-type':'text/html'}})};
const blocked=await crawlSite('https://shop.example/',{lookup:async()=>[{address:'93.184.216.34',family:4}],fetchImpl:challengeFetch,render:async()=>{renders++;return []}});
assert.equal(blocked.reachable,false,'An access challenge cannot be evaluated as business content');
assert.equal(blocked.access_unavailable,true);assert.equal(blocked.pages.length,0);assert.equal(renders,0,'Never launch another browser to bypass a detected challenge');
const blockedQuick=await runQuickScan('https://shop.example/',{lookup:async()=>[{address:'93.184.216.34',family:4}],fetchImpl:challengeFetch});
assert.equal(blockedQuick.result,'unavailable');assert.equal(blockedQuick.finding,null);assert(blockedQuick.checks.every(c=>c.result==='unknown'));
const renderedChallenge=await crawlSite('https://shop.example/',{lookup:async()=>[{address:'93.184.216.34',family:4}],fetchImpl:async url=>new Response(new URL(url).pathname==='/robots.txt'?'':'<html><head><title>Shop</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>',{headers:{'content-type':'text/html'}}),render:async()=>[{status:200,html:'<html><head><title>Verify you are human</title></head><body>Security check</body></html>'}]});
assert.equal(renderedChallenge.reachable,false,'A rendered challenge is unavailable even when HTTP is 200');assert.equal(renderedChallenge.pages.length,0);
