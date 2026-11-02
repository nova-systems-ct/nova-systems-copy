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
