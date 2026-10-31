// Re-check recorded findings against the business's current state (owner brief follow-up 2026-10-31 §3).
// A reviewed finding's text is never rewritten: the re-check result is stored beside it (recheck_status / _note / _at)
// with a new evidence record linked to it. Results:
//   still_observed      — measured again now, still true
//   no_longer_observed  — measured again now, no longer true (stays in the record as history)
//   not_rechecked       — no source to measure it with here (the reason is stated; never assumed fixed)
// Sources: public pages read in a guarded headless browser, public DNS, and the workspace's own settings and workers.
// Rules are matched to findings by what they state; a finding no rule covers is marked not_rechecked with that reason.
import dns from 'node:dns';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso } from './_sales/core.js';
import * as Renderer from './_renderPage.js';

const NOT_FOUND = /page not found|404|this page could not be found/i;
const fieldsIn = (html) => [...String(html || '').matchAll(/<(input|textarea|select)\b([^>]*)>/gi)].filter((m) => !/type=["']?(hidden|submit|button)/i.test(m[2])).length;

const RULES = [
  { key: 'demo_book_live', match: /demo and the booking page are not live/i, source: 'site', async run({ page, host }) {
    const [demo, book] = [await page(`https://${host}/demo`), await page(`https://${host}/book`)];
    if (demo.error || book.error) return { status: 'not_rechecked', note: `Could not read the pages (${demo.error || book.error}).` };
    const dead = [['/demo', demo], ['/book', book]].filter(([, p]) => p.status >= 400 || NOT_FOUND.test(p.text));
    return dead.length ? { status: 'still_observed', note: `${dead.map(([u]) => u).join(' and ')} still show${dead.length === 1 ? 's' : ''} "Page not found".` } : { status: 'no_longer_observed', note: '/demo and /book both load with content.' };
  } },
  { key: 'pick_a_time', match: /cannot pick a time/i, source: 'site', async run({ page, host }) {
    const book = await page(`https://${host}/book`); if (book.error) return { status: 'not_rechecked', note: `Could not read /book (${book.error}).` };
    const times = !NOT_FOUND.test(book.text) && book.status < 400 && /(choose|pick|select)\s+a\s+time|available times|calendly|cal\.com/i.test(`${book.text} ${book.html}`);
    return times ? { status: 'no_longer_observed', note: '/book loads and offers times to choose.' } : { status: 'still_observed', note: `/book ${NOT_FOUND.test(book.text) || book.status >= 400 ? 'shows "Page not found"' : 'loads but offers no time to choose'}.` };
  } },
  { key: 'home_tel', match: /home page has no click-to-call/i, source: 'site', async run({ page, host }) {
    const home = await page(`https://${host}/`); if (home.error) return { status: 'not_rechecked', note: `Could not read the home page (${home.error}).` };
    const tel = /href=["']tel:/i.test(home.html);
    return tel ? { status: 'no_longer_observed', note: 'The home page now has a tap-to-call link.' } : { status: 'still_observed', note: 'The home page, read as a phone visitor sees it, still has no tap-to-call link.' };
  } },
  { key: 'positioning', match: /outdated positioning/i, source: 'site', async run({ page, host }) {
    const waves = await page(`https://${host}/waves`); const agency = await page('https://nova-systems.agency/');
    const old = [];
    if (!waves.error && /wave one/i.test(`${waves.title} ${waves.text.slice(0, 400)}`)) old.push(`/waves is titled "${waves.title}"`);
    if (!agency.error && /wave one/i.test(`${agency.title} ${agency.text.slice(0, 400)}`)) old.push(`nova-systems.agency is titled "${agency.title}"`);
    if (waves.error && agency.error) return { status: 'not_rechecked', note: 'Neither page could be read.' };
    return old.length ? { status: 'still_observed', note: `${old.join('; ')}.` } : { status: 'no_longer_observed', note: 'Neither page shows the agency-era "Wave One" positioning.' };
  } },
  { key: 'inquiry_forms', match: /inquiry forms|asks 28 questions/i, source: 'site', async run({ page, host }) {
    const ra = await page(`https://${host}/request-audit`); const ct = await page(`https://${host}/contact`);
    if (ra.error && ct.error) return { status: 'not_rechecked', note: 'Neither form page could be read.' };
    const n = fieldsIn(ra.html); const m = fieldsIn(ct.html);
    return n >= 15 || (n && m && n !== m) ? { status: 'still_observed', note: `/request-audit form: ${n} fields; /contact form: ${m} fields (visible inputs, read in a browser).` } : { status: 'no_longer_observed', note: `One short form now (${n || m} fields).` };
  } },
  { key: 'email_sending', match: /email .*not fully set up for sending/i, source: 'dns', async run({ resolver, host }) {
    const txt = async (n) => { try { return (await resolver.resolveTxt(n)).map((r) => r.join('')); } catch { return []; } };
    const mx = async (n) => { try { return (await resolver.resolveMx(n)).length; } catch { return 0; } };
    const sendMx = await mx(`send.${host}`); const sendSpf = (await txt(`send.${host}`)).some((r) => /^v=spf1/i.test(r));
    const rootSpf = (await txt(host)).some((r) => /^v=spf1/i.test(r)); const dmarc = (await txt(`_dmarc.${host}`)).some((r) => /^v=DMARC1/i.test(r));
    const missing = [!sendMx && `send.${host} MX`, !sendSpf && `send.${host} SPF`, !rootSpf && `${host} SPF`, !dmarc && 'DMARC'].filter(Boolean);
    return missing.length ? { status: 'still_observed', note: `Still missing in public DNS: ${missing.join(', ')}.` } : { status: 'no_longer_observed', note: 'The sending records, SPF and DMARC are all published.' };
  } },
  { key: 'escalation_workers', match: /no one is named for escalations/i, source: 'workspace', async run({ orgId }) {
    const wave = await dbOne(`wave1_org_settings?organization_id=eq.${enc(orgId)}&select=escalation_contacts`);
    const contacts = (wave?.escalation_contacts || []).length;
    const workers = await dbGet('workers?status=in.(active,restricted)&select=display_name');
    const parts = [`escalation contacts named: ${contacts}`, `workers active: ${workers.length}${workers.length ? ` (${workers.map((w) => w.display_name).slice(0, 4).join(', ')})` : ''}`];
    return contacts && workers.length ? { status: 'no_longer_observed', note: `Workspace now: ${parts.join('; ')}.` } : { status: 'still_observed', note: `Workspace now: ${parts.join('; ')}.` };
  } },
  { key: 'hosting_config', match: /online payments are not configured|background work is not running|automated texting is switched off|hosting carries settings/i, source: 'hosting', async run() {
    return { status: 'not_rechecked', note: 'Needs read access to the production hosting project (Vercel). It is not connected on this computer, so this is neither assumed fixed nor still present.' };
  } },
];

export function ruleFor(finding) { return RULES.find((r) => r.match.test(`${finding.title} ${finding.detail || ''}`)) || null; }

export async function recheckFindings(c, { orgId, website, deps = {} } = {}) {
  const now = deps.now || (() => new Date());
  const host = (() => { try { return new URL(website).hostname.replace(/^www\./, ''); } catch { return null; } })();
  const runTag = `recheck:${now().toISOString().slice(0, 16)}`;
  const findings = await dbGet(`audit_findings?case_id=eq.${enc(c.id)}&review_status=neq.rejected&origin=neq.automated_review&select=id,title,detail`);
  // pages are read once each through the guarded renderer (served HTML would miss a script-built site's content)
  const canRender = deps.render || ((await Renderer.available()).ok ? (urls) => Renderer.renderPages(urls, { fetchImpl: deps.fetchImpl, lookup: deps.lookup, now }) : null);
  const cache = new Map();
  const page = async (url) => {
    if (!canRender) return { error: 'no page renderer on this server' };
    if (!cache.has(url)) cache.set(url, (async () => { const [p] = await canRender([url]); if (!p || p.error) return { error: p?.error || 'not read' }; return { ...p, title: (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(p.html) || [])[1]?.trim() || '' }; })().catch((e) => ({ error: String(e.message || e).slice(0, 120) })));
    return cache.get(url);
  };
  const ctx = { orgId, host, page, resolver: deps.resolver || dns.promises };
  const out = [];
  for (const f of findings) {
    const rule = ruleFor(f);
    let r;
    if (!rule) r = { status: 'not_rechecked', note: 'No automatic re-check exists for this finding; a person must re-check it.' };
    else if (rule.source !== 'workspace' && !host) r = { status: 'not_rechecked', note: 'No website domain on this audit.' };
    else { try { r = await rule.run(ctx); } catch (e) { r = { status: 'not_rechecked', note: `The re-check failed (${String(e.message || e).slice(0, 120)}).` }; } }
    const at = now().toISOString();
    if (rule && r.status !== 'not_rechecked') {
      const src = rule.source === 'site' ? `Public pages of ${host} read in a headless browser (${at})` : rule.source === 'dns' ? `Public DNS for ${host} (queried ${at})` : `Nova's own workspace settings and worker registry (read ${at})`;
      const ev = await dbInsert('audit_evidence', { case_id: c.id, source: src.slice(0, 500), capture_date: at, method: `${runTag}:${rule.key}:${r.status}`, observation: r.note.slice(0, 3000), source_quality: 'high', confidence: 'high', privacy_level: 'internal', author: 'Nova re-check' });
      if (ev.row) await dbInsert('audit_finding_evidence', { finding_id: f.id, evidence_id: ev.row.id });
    }
    await dbPatch('audit_findings', `id=eq.${enc(f.id)}`, { recheck_status: r.status, recheck_note: r.note.slice(0, 1000), rechecked_at: at });
    out.push({ id: f.id, title: f.title, rule: rule?.key || null, ...r });
  }
  return { rechecked_at: nowIso(), results: out, counts: Object.fromEntries(['still_observed', 'no_longer_observed', 'not_rechecked'].map((k) => [k, out.filter((x) => x.status === k).length])) };
}
