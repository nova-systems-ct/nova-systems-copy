// Read-only evidence collection for the Nova Audit OF NOVA (owner-authorized, 2026-10-17).
// Visits Nova's live public site in a real browser, follows its own inquiry/booking links, and records what is
// actually there with timestamps. Reads the production hosting configuration by NAME ONLY (no values). Submits no
// forms and contacts no one. Output: docs/evidence/nova-live-audit-<date>.json
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SITE = 'https://nova-systems.app';
const PAGES = ['/', '/contact', '/request-audit', '/welcome', '/book', '/demo', '/pricing', '/solutions', '/waves'];
const now = () => new Date().toISOString();
const out = { collected_at: now(), site: SITE, method: 'Real Chromium browser, public pages only; no forms submitted', pages: [], links: [], other_sites: [], hosting: null };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
const internal = new Set();
for (const path of PAGES) {
  const t = now();
  const resp = await p.goto(SITE + path, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => ({ error: e.message }));
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => {
    const text = document.body.innerText;
    const phones = [...new Set((text.match(/\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/g) || []).map((x) => x.replace(/\D/g, '').slice(-10)))];
    const emails = [...new Set(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])];
    const tel = [...new Set([...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href').replace(/\D/g, '').slice(-10)))];
    const forms = [...document.querySelectorAll('form')].map((f) => ({ fields: f.querySelectorAll('input,textarea,select').length, submit: (f.querySelector('button[type="submit"],button:not([type])')?.innerText || '').slice(0, 60) }));
    const ctas = [...document.querySelectorAll('a,button')].map((e) => ({ text: (e.innerText || '').trim().slice(0, 60), href: e.getAttribute('href') })).filter((x) => /audit|book|demo|contact|call|schedule|get started|request|diagnostic/i.test(x.text));
    const links = [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href').split('#')[0].split('?')[0]).filter(Boolean);
    const notFound = /page not found|404/i.test(text.slice(0, 500));
    return { title: document.title, h1: document.querySelector('h1')?.innerText?.slice(0, 120) || null, phones, emails, tel, forms, ctas: ctas.slice(0, 12), links: [...new Set(links)], notFound, description: document.querySelector('meta[name="description"]')?.content || null };
  });
  info.links.forEach((l) => internal.add(l));
  out.pages.push({ path, requested_at: t, final_url: p.url(), http_status: resp?.status?.() ?? null, error: resp?.error || null, ...info, links: undefined });
}
for (const l of internal) {
  const t = now();
  await p.goto(SITE + l, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(700);
  const nf = await p.evaluate(() => /page not found/i.test(document.body.innerText.slice(0, 500))).catch(() => null);
  out.links.push({ path: l, checked_at: t, shows_not_found: nf });
}
for (const u of ['https://nova-systems.agency/']) {
  const t = now(); await p.goto(u, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {}); await p.waitForTimeout(1200);
  out.other_sites.push({ url: u, checked_at: t, title: await p.title(), description: await p.evaluate(() => document.querySelector('meta[name="description"]')?.content || null), canonical: await p.evaluate(() => document.querySelector('link[rel="canonical"]')?.href || null) });
}
await b.close();

// Production hosting configuration — variable NAMES only, from the Vercel API (the CLI's saved login; token never printed).
try {
  const tok = JSON.parse(fs.readFileSync(`${process.env.APPDATA}/xdg.data/com.vercel.cli/auth.json`, 'utf8')).token;
  const r = await fetch('https://api.vercel.com/v9/projects/prj_WO4Q5AGpLpDvSacJq5ms6rTPngl2?teamId=team_HxKV8k3sE2Xu5bofoNpKsfdU', { headers: { Authorization: `Bearer ${tok}` } });
  const j = await r.json();
  const prod = (j.env || []).filter((e) => e.target.includes('production')).map((e) => e.key).sort();
  out.hosting = { checked_at: now(), project: 'nova-systems-copy', production_deployment: { sha: j.targets?.production?.meta?.githubCommitSha?.slice(0, 7), branch: j.targets?.production?.meta?.githubCommitRef, created: j.targets?.production?.createdAt ? new Date(j.targets.production.createdAt).toISOString() : null }, production_variable_names: prod, crons: (j.crons?.definitions || []).length };
} catch (e) { out.hosting = { error: e.message }; }

const file = `docs/evidence/nova-live-audit-${out.collected_at.slice(0, 10)}.json`;
fs.writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`wrote ${file}`);
console.log(JSON.stringify({ pages: out.pages.map((x) => [x.path, x.http_status, x.notFound ? 'NOT FOUND' : 'ok', x.title?.slice(0, 50), `phones=${x.phones.join('/')}`, `forms=${x.forms.length}`]), broken_links: out.links.filter((l) => l.shows_not_found).map((l) => l.path), other: out.other_sites, hosting: out.hosting }, null, 1));
