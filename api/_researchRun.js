// Audit research run (owner brief 2026-10-30 §4): one bounded, resumable-by-rerun job that turns the five starting details
// into sourced evidence, comparable competitors and proposed findings. Progress is written step by step to
// audit_research_runs so the iPad can show it. Every evidence row keeps its source and retrieval time; every proposed
// finding links evidence and stays unreviewed until a person confirms it. Deterministic; no paid service is called.
import dns from 'node:dns';
import { dbGet, dbOne, dbInsert, dbPatch, dbFetch, enc, nowIso } from './_sales/core.js';
import { runQuickScan } from './_demo.js';
import { resolveIdentity, geocodePlace, crawlSite, industryToOsm, findCompetitorPlaces, searchPlacesByCategory, pickCompetitors, compareJourneys, goalRelevant, coveredBy, FEATURE_LABELS } from './_publicResearch.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };
const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

// ------------------------------------------------------------------ public email DNS (moved here from _auditWorkspace)
export async function checkEmailDns(domain, { resolver = dns.promises, now = () => new Date() } = {}) {
  const at = now().toISOString(); const checks = [];
  const absent = (e) => ['ENODATA', 'ENOTFOUND', 'NXDOMAIN'].includes(e?.code);
  const txt = async (name) => { try { return { ok: true, records: (await resolver.resolveTxt(name)).map((r) => r.join('')) }; } catch (e) { return absent(e) ? { ok: true, records: [] } : { ok: false, error: e?.code || e?.message }; } };
  let mx; try { mx = { ok: true, records: (await resolver.resolveMx(domain)).map((r) => r.exchange).filter(Boolean) }; } catch (e) { mx = absent(e) ? { ok: true, records: [] } : { ok: false, error: e?.code || e?.message }; }
  const base = { checked_at: at, kind: 'dns', target: domain };
  if (!mx.ok) { checks.push({ ...base, key: 'dns_mx', label: 'Email domain can be checked', result: 'unknown', observation: `The DNS lookup for ${domain} did not answer (${mx.error}). Nothing was assumed.` }); return checks; }
  checks.push({ ...base, key: 'dns_mx', label: 'Receives email at its own domain (MX)', result: 'ok', observation: mx.records.length ? `Mail server (MX) records for ${domain}: ${mx.records.slice(0, 4).join(', ')}.` : `No mail server (MX) records were found for ${domain}; the business may use another address for email.` });
  if (!mx.records.length) return checks;
  const spf = await txt(domain); const dmarc = await txt(`_dmarc.${domain}`);
  const spfRec = spf.ok ? spf.records.find((r) => /^v=spf1\b/i.test(r)) : null;
  checks.push(!spf.ok ? { ...base, key: 'dns_spf', label: 'Email sender list published (SPF)', result: 'unknown', observation: `The SPF lookup for ${domain} did not answer (${spf.error}).` }
    : spfRec ? { ...base, key: 'dns_spf', label: 'Email sender list published (SPF)', result: 'ok', observation: `${domain} publishes an SPF record: "${spfRec.slice(0, 180)}".` }
    : { ...base, key: 'dns_spf', label: 'Email sender list published (SPF)', result: 'issue', observation: `${domain} receives email (MX records exist) but publishes no SPF record.`, why: 'Messages sent from this domain, such as quotes, invoices and replies, are more likely to land in spam or be spoofed.', confirm: 'Which services send email for the business (for example the website, booking tool or invoicing).', next: 'Publish an SPF record that lists every service that sends email for the domain.', strength: 45 });
  const dRec = dmarc.ok ? dmarc.records.find((r) => /^v=DMARC1\b/i.test(r)) : null;
  checks.push(!dmarc.ok ? { ...base, target: `_dmarc.${domain}`, key: 'dns_dmarc', label: 'Email protection policy published (DMARC)', result: 'unknown', observation: `The DMARC lookup for ${domain} did not answer (${dmarc.error}).` }
    : dRec ? { ...base, target: `_dmarc.${domain}`, key: 'dns_dmarc', label: 'Email protection policy published (DMARC)', result: 'ok', observation: `${domain} publishes a DMARC policy: "${dRec.slice(0, 160)}".` }
    : { ...base, target: `_dmarc.${domain}`, key: 'dns_dmarc', label: 'Email protection policy published (DMARC)', result: 'issue', observation: `No DMARC record was found at _dmarc.${domain}.`, why: 'Without DMARC, anyone can send mail that appears to come from the business, and inbox providers trust its real mail less.', confirm: 'Whether the business sends email from this domain.', next: 'Publish a DMARC record (start with p=none and reporting), then tighten it once SPF and DKIM pass.', strength: 40 });
  return checks;
}

// ------------------------------------------------------------------ cache (public data only)
async function cached(key, maxAgeMs, produce) {
  const row = await dbOne(`public_research_cache?key=eq.${enc(key)}&select=value,fetched_at`).catch(() => null);
  if (row && Date.now() - new Date(row.fetched_at).getTime() < maxAgeMs) return { ...row.value, cached_at: row.fetched_at };
  const value = await produce();
  if (value && value.status !== 'unavailable') await dbFetch('public_research_cache?on_conflict=key', { method: 'POST', body: { key, value, fetched_at: nowIso() }, prefer: 'resolution=merge-duplicates,return=minimal' }).catch(() => {});
  return value;
}

export const MODULES = {
  agents_booking: 'Nova Agents: answer, qualify and book inquiries',
  website_fixes: 'Website and listing fixes (Install Systems)',
  email_setup: 'Email sending setup (Install Systems)',
  reviews_referrals: 'Reviews and referrals (Nova Demand)',
};
const MODULE_OF = { location_conflict: 'website_fixes', website_dns: 'website_fixes', home: 'website_fixes', https: 'website_fixes', mobile: 'website_fixes', phones: 'website_fixes', link: 'agents_booking', inquiry_path: 'agents_booking', click_to_call: 'agents_booking', long_form: 'agents_booking', online_booking: 'agents_booking', contact_form: 'agents_booking', chat: 'agents_booking', prices_published: 'website_fixes', hours_published: 'website_fixes', map_phone: 'website_fixes', dns_spf: 'email_setup', dns_dmarc: 'email_setup', reviews_or_social_proof: 'reviews_referrals', mobile_viewport: 'website_fixes' };
const GOAL_KEY = { website_dns: 'click_to_call', link: 'online_booking', inquiry_path: 'online_booking', click_to_call: 'click_to_call', long_form: 'contact_form', online_booking: 'online_booking', contact_form: 'contact_form', prices_published: 'prices_published', reviews_or_social_proof: 'reviews_or_social_proof', hours_published: 'hours_published', dns_spf: 'email_dns', dns_dmarc: 'email_dns', mobile: 'speed', mobile_viewport: 'speed' };
const STEP_LABELS = [['identity', 'Find the business on public maps'], ['site', 'Read the website'], ['checks', 'Check contact paths and links'], ['email', 'Check public email records'], ['competitors', 'Find comparable nearby businesses'], ['compare', 'Compare customer journeys'], ['record', 'Record evidence and proposed findings']];
const TOPIC_OF = { dns_spf: 'spf', dns_dmarc: 'dmarc', dns_mx: 'mx' };
// Proposals that rest only on "not found in the served HTML": withdrawn when the site turns out to be built by script.
const HTML_ONLY = ['click_to_call', 'hours_published', 'reviews_or_social_proof', 'long_form', 'gap:'];
const yesNo = (v) => (v == null ? 'not visible' : v ? 'yes' : 'no');
const bump = (p) => (p === 'low' ? 'medium' : 'high');
const prio = (s = 0) => (s >= 80 ? 'high' : s >= 40 ? 'medium' : 'low');

export async function runResearch(runId, deps = {}) {
  const now = deps.now || (() => new Date());
  const run = await dbOne(`audit_research_runs?id=eq.${enc(runId)}&select=*`); if (!run) throw new Error('research run not found');
  const c = await dbOne(`audit_cases?id=eq.${enc(run.case_id)}&organization_id=eq.${enc(run.organization_id)}&select=*`); if (!c) throw new Error('audit not found');
  const biz = c.business_id ? await dbOne(`businesses?id=eq.${enc(c.business_id)}&select=name,website,confirmed_website,phone,city,state,industry`) : null;
  const I = c.intake || {};
  const name = I.name || biz?.name; const website = I.website || biz?.confirmed_website || biz?.website; const location = I.location || [biz?.city, biz?.state].filter(Boolean).join(', ');
  const industry = I.industry || biz?.industry || ''; const goal = I.goal || '';
  const full = run.scope === 'full';
  const steps = STEP_LABELS.map(([key, label]) => ({ key, label, status: 'pending' }));
  const save = async (patch = {}) => { await dbPatch('audit_research_runs', `id=eq.${enc(runId)}`, { steps, heartbeat_at: nowIso(), ...patch }); };
  const step = async (key, fn) => {
    const s = steps.find((x) => x.key === key); s.status = 'running'; s.started_at = nowIso(); await save();
    try { const out = await fn(); s.status = out?.status === 'unavailable' ? 'unavailable' : out?.status === 'skipped' ? 'skipped' : 'done'; s.note = out?.note || null; return out; }
    catch (e) { s.status = 'failed'; s.note = String(e.message || e).slice(0, 200); return null; }
    finally { s.finished_at = nowIso(); await save(); }
  };
  await save({ status: 'running', started_at: nowIso() });
  const evidence = []; // { key, row } rows to insert; findings reference keys
  const ev = (key, source, observation, confidence = 'high', at = now().toISOString(), method = 'public_research') => { evidence.push({ key, row: { case_id: c.id, source: source.slice(0, 500), capture_date: at, method: `automated_review:${runId.slice(0, 8)}:${method}`, observation: String(observation).slice(0, 3000), source_quality: 'medium', confidence, privacy_level: 'internal', author: 'Nova public research' } }); return key; };
  const proposals = []; // { key, check_key, title, detail, why, next, confirm, priority, module_key, evidence: [keys] }
  const propose = (p) => { const gk = GOAL_KEY[p.key]; const related = goalRelevant(goal, gk); proposals.push({ ...p, priority: related ? bump(p.priority) : p.priority, why: related && p.why ? `${p.why} This bears directly on your goal: "${goal.slice(0, 120)}".` : p.why, module_key: MODULE_OF[p.key] || null }); };
  const limitations = [];

  // 1. identity
  const id = await step('identity', async () => {
    if (!name) return { status: 'skipped', note: 'No business name.' };
    limitations.push('Listings searched: OpenStreetMap only. Google Business Profile, Yelp, Facebook and other listings were not checked (no listing service is connected), so "not found" means not on OpenStreetMap.');
    const r = await cached(`v3:identity:${name}|${location}|${hostOf(website) || ""}`.toLowerCase(), 7 * 86400_000, () => resolveIdentity({ name, location, website }, { fetchImpl: deps.fetchImpl, now }));
    if (r.status === 'unavailable') { limitations.push(r.note); ev('identity', r.source, `${r.note} Business identity was not checked against the public map.`, 'low', r.retrieved_at, 'identity'); return { ...r, note: r.note }; }
    if (r.match?.location_conflict) {
      ev('identity', r.source, `The public map lists "${r.match.name}" with this website at ${r.match.display_name}, which is not ${location}. It was NOT used as this business's location.`, 'high', r.retrieved_at, 'identity');
      propose({ key: 'location_conflict', check_key: `location_conflict:${hostOf(website) || norm(name)}`, title: `The public map places this website's business in a different town (${r.match.display_name.split(',').slice(-4, -2).join(',').trim() || 'elsewhere'})`, detail: `OpenStreetMap lists "${r.match.name}" with ${r.match.website} at ${r.match.display_name}; the audit was started for ${location}.`, why: 'Customers searching maps may be sent to the wrong location, or this may be a different business with a similar name.', next: 'Confirm the correct address and website, then correct the map listings.', confirm: 'Whether this is the same business (another branch) or a different one.', priority: 'medium', evidence: ['identity'] });
      return { ...r, note: 'Same website listed in another town: flagged to confirm, not used' };
    }
    if (r.match) ev('identity', r.source, `Matched "${r.match.name}" at ${r.match.display_name} (confidence ${r.confidence}; website ${r.match.website_matches ? 'matches' : r.match.website ? `listed as ${r.match.website}` : 'not listed'}; phone ${r.match.phone || 'not listed'}; hours ${r.match.opening_hours || 'not listed'}).`, r.confidence === 'high' ? 'high' : 'medium', r.retrieved_at, 'identity');
    else ev('identity', r.source, `${r.note}${r.candidates?.length ? ` Similar names seen: ${r.candidates.slice(0, 3).map((x) => x.name).join(', ')}.` : ''}`, 'medium', r.retrieved_at, 'identity');
    return { ...r, note: r.match ? `Matched (${r.confidence} confidence)` : r.note };
  });

  // 2. website crawl
  let crawl = null;
  await step('site', async () => {
    if (!website) return { status: 'skipped', note: 'No website saved.' };
    crawl = await crawlSite(website, { fetchImpl: deps.fetchImpl, lookup: deps.lookup, maxPages: full ? 12 : 6, now });
    if (!crawl.reachable && crawl.dns_not_found) {
      // A domain that does not exist in public DNS is a verifiable fact, unlike a timeout or a blocked crawler.
      const at = now().toISOString(); const host = hostOf(website);
      ev('site', `Public DNS lookup for ${host} (queried ${at})`, `The website address ${website} does not exist in public DNS (no such domain). Anyone who types it or follows a listing to it reaches nothing.`, 'high', at, 'site');
      propose({ key: 'website_dns', check_key: `website_dns:${host}`, title: `The website address ${host} does not exist`, detail: `A public DNS lookup for ${host} returned "no such domain" at ${at}.`, why: 'Customers who find this address on a listing, card or vehicle reach nothing and may assume the business has closed.', next: 'Renew or re-point the domain, or update every listing to the address the business uses now.', confirm: 'Whether the business uses a different website address.', priority: 'high', evidence: ['site'] });
      return { status: 'done', note: 'The website address does not exist in public DNS' };
    }
    if (!crawl.reachable) { limitations.push(`The website could not be reached from Nova (${crawl.error}). That is not evidence of a problem with the business.`); ev('site', `Website ${website}`, `The website could not be reached from Nova's server (${crawl.error}). Nothing was assumed about it.`, 'low', now().toISOString(), 'site'); return { status: 'unavailable', note: 'Website not reachable from Nova' }; }
    for (const p of crawl.pages) ev(`page:${p.url}`, `Public web page ${p.url} (retrieved ${p.retrieved_at})`, `HTTP ${p.status}; title "${p.title || '(none)'}"${p.h1 ? `; main heading "${p.h1}"` : ''}; ${Math.round(p.bytes / 1024)} KB of HTML in ${p.ms} ms.`, 'high', p.retrieved_at, 'page');
    const s = crawl.signals; const at = crawl.pages[0].retrieved_at; const src = `Public website ${crawl.pages[0].url} and ${crawl.pages.length - 1} linked page(s) (retrieved ${at})`;
    if (crawl.rendered_by_script) {
      // Unavailable, not absent: the served HTML is an empty shell the browser fills in with JavaScript.
      limitations.push('The website builds its pages with JavaScript and Nova\'s reader uses no browser, so phone links, forms, booking, prices, hours and reviews on it could not be checked. They are reported as not checked, never as missing.');
      ev('script_built', src, `The HTML served for ${crawl.pages.length} page(s) is an empty shell filled in by JavaScript, so tap-to-call links, forms, booking, prices, hours and reviews could not be checked. Not finding them here is not evidence that the site lacks them.`, 'high', at, 'script_built');
      return { note: `${crawl.pages.length} page(s) read; built by JavaScript, so their content could not be checked` };
    }
    ev('phones', src, s.phones.length ? `Tap-to-call phone link(s): ${s.phones.join(', ')}.` : `No tap-to-call (tel:) link on the ${crawl.pages.length} page(s) read. A number may still appear as plain text or an image.`, s.phones.length ? 'high' : 'medium', at, 'phones');
    ev('forms', src, s.forms.length ? s.forms.map((f) => `${f.url}: form with ${f.fields} field(s)${f.asksPhone ? ', asks phone' : ''}${f.asksEmail ? ', asks email' : ''}`).join('; ') : 'No HTML form found on the pages read (a form may be embedded by script).', s.forms.length ? 'high' : 'low', at, 'forms');
    ev('booking', src, s.booking_tools.length ? `Online booking tool(s) referenced: ${s.booking_tools.join(', ')}.` : crawl.features.online_booking ? 'A booking/scheduling page exists on the site.' : 'No online booking tool or booking page found on the pages read.', crawl.features.online_booking ? 'high' : 'medium', at, 'booking');
    ev('prices', src, s.prices.length ? `Published prices: ${s.prices.slice(0, 4).map((x) => `"${x.match}" (${new URL(x.url).pathname})`).join(', ')}.` : 'No published prices found on the pages read.', 'medium', at, 'prices');
    ev('hours', src, s.hours.length ? `Published hours: "${s.hours[0].text}".` : crawl.features.hours_published ? 'Opening hours are declared in the site\'s structured data.' : 'No opening hours found on the pages read.', 'medium', at, 'hours');
    ev('proof', src, crawl.features.reviews_or_social_proof ? `Reviews or review links found on: ${s.reviews_proof.map((x) => new URL(x.url).pathname).join(', ')}.` : 'No reviews, testimonials or review-site links found on the pages read.', 'medium', at, 'proof');
    if (Object.keys(s.social).length) ev('social', src, `Social profiles linked: ${Object.keys(s.social).join(', ')} (links only; activity not reviewed).`, 'medium', at, 'social');
    if (crawl.skipped.length) ev('skipped', src, `Not read: ${crawl.skipped.slice(0, 5).map((x) => `${new URL(x.url).pathname} (${x.reason})`).join('; ')}.`, 'high', at, 'skipped');
    return { note: `${crawl.pages.length} page(s) read${crawl.skipped.length ? `, ${crawl.skipped.length} not read` : ''}` };
  });

  // 3. contact paths and links (tested quick scan) + crawl-derived checks
  await step('checks', async () => {
    if (!website) return { status: 'skipped', note: 'No website saved.' };
    const scan = await runQuickScan(website, { fetchImpl: deps.fetchImpl, lookup: deps.lookup, now });
    for (const x of scan.checks || []) {
      const k = ev(`check:${x.key}:${x.url}`, `Public web page ${x.url} (retrieved ${x.checked_at})`, x.observation, x.result === 'unknown' ? 'low' : 'high', x.checked_at, `${x.key}:${x.result}`);
      if (x.result === 'issue') propose({ key: x.key, check_key: `${x.key}:${hostOf(x.url)}${(() => { try { return new URL(x.url).pathname; } catch { return ''; } })()}`, title: x.label === 'A visible way to get in touch' ? 'No visible way to get in touch on the home page' : x.observation.length <= 110 ? x.observation.replace(/\.$/, '') : x.label, detail: x.observation, why: x.why, next: x.next, confirm: x.confirm, priority: prio(x.strength), evidence: [k] });
    }
    if (crawl?.reachable) {
      const host = hostOf(crawl.pages[0].url);
      if (crawl.features.click_to_call === false && !(scan.checks || []).some((x) => x.key === 'inquiry_path' && x.result === 'issue')) propose({ key: 'click_to_call', check_key: `click_to_call:${host}`, title: 'No tap-to-call phone link on the website', detail: `None of the ${crawl.pages.length} page(s) read has a tel: link, so a visitor on a phone cannot call with one tap.`, why: 'Most local customers browse on a phone; an extra step to call loses some of them.', next: 'Add a tap-to-call link to the main phone number in the header of every page.', confirm: 'Whether the number appears as plain text or an image (not checkable by Nova).', priority: 'medium', evidence: ['phones'] });
      const longForm = crawl.signals.forms.find((f) => f.fields >= 7);
      if (longForm) propose({ key: 'long_form', check_key: `long_form:${host}`, title: `The contact form asks for ${longForm.fields} fields`, detail: `The form on ${longForm.url} has ${longForm.fields} input fields.`, why: 'Every extra field gives a ready buyer another reason to stop.', next: 'Ask only for name, phone or email and the request; collect the rest in the reply.', confirm: 'Which fields are required.', priority: 'medium', evidence: ['forms'] });
      if (crawl.features.hours_published === false) propose({ key: 'hours_published', check_key: `hours_published:${host}`, title: 'Opening hours are not published on the website', detail: 'No opening hours were found on the pages read or in the site\'s structured data.', why: 'Customers who cannot see when someone will answer often move to a competitor who shows it.', next: 'Publish opening hours on the contact page and in the site\'s structured data.', confirm: 'Whether hours appear only in an image or on a page Nova did not read.', priority: 'low', evidence: ['hours'] });
      if (crawl.features.reviews_or_social_proof === false) propose({ key: 'reviews_or_social_proof', check_key: `reviews_or_social_proof:${host}`, title: 'No reviews or testimonials on the website', detail: 'No reviews, testimonials or links to review sites were found on the pages read.', why: 'Visitors comparing businesses look for proof that others were satisfied.', next: 'Show recent genuine reviews (with permission) and link to the business\'s review profiles.', confirm: 'Whether reviews exist on third-party sites (not checked: no review API is connected).', priority: 'low', evidence: ['proof'] });
      if (id?.match?.phone && !id.match.location_conflict && crawl.signals.phones.length && !crawl.signals.phones.some((p) => digits(p) === digits(id.match.phone))) propose({ key: 'map_phone', check_key: `map_phone:${host}`, title: 'The public map listing shows a different phone number than the website', detail: `OpenStreetMap lists ${id.match.phone}; the website's tap-to-call number(s): ${crawl.signals.phones.join(', ')}.`, why: 'Customers who find the business on a map may call a number nobody answers.', next: 'Confirm the answered number and correct the listing (OpenStreetMap and other map listings).', confirm: 'Which number is answered.', priority: 'medium', evidence: ['identity', 'phones'] });
    }
    return { note: `${(scan.checks || []).length} checks` };
  });

  // 4. email DNS
  await step('email', async () => {
    const domain = hostOf(crawl?.pages?.[0]?.url || website); if (!domain) return { status: 'skipped', note: 'No website domain.' };
    const checks = await checkEmailDns(domain, { resolver: deps.resolver, now });
    for (const x of checks) {
      const k = ev(`dns:${x.key}`, `Public DNS records for ${x.target} (queried ${x.checked_at})`, x.observation, x.result === 'unknown' ? 'low' : 'high', x.checked_at, `${x.key}:${x.result}`);
      if (x.result === 'issue') propose({ key: x.key, check_key: `${x.key}:${x.target}`, title: x.observation.replace(/\.$/, ''), detail: x.observation, why: x.why, next: x.next, confirm: x.confirm, priority: prio(x.strength), evidence: [k] });
    }
    return { note: `${checks.length} record checks` };
  });

  // 5–6. competitors + comparison
  const compared = [];
  await step('competitors', async () => {
    const cat = industryToOsm(industry);
    if (!cat) { limitations.push(`Competitor discovery is not available for the industry "${industry || 'not given'}"; competitors can be added by hand.`); return { status: 'unavailable', note: 'Industry not mapped to a public map category' }; }
    let center = id?.match && !id.match.location_conflict ? { lat: id.lat, lon: id.lon, basis: 'the business\'s map location' } : null;
    if (!center && location) { const town = await cached(`v2:place:${location}`.toLowerCase(), 30 * 86400_000, () => geocodePlace(location, { fetchImpl: deps.fetchImpl, now })); if (town?.found) center = { lat: town.lat, lon: town.lon, basis: `the centre of ${location}` }; }
    if (!center) { limitations.push('No map location was found for the business or its town, so nearby competitors were not searched.'); return { status: 'unavailable', note: 'No location to search around' }; }
    const res = await cached(`overpass:${cat.filters.map((f) => f.join('=')).join(',')}@${center.lat.toFixed(3)},${center.lon.toFixed(3)}`, 7 * 86400_000, () => findCompetitorPlaces({ lat: center.lat, lon: center.lon, filters: cat.filters, radiusM: 15000 }, { fetchImpl: deps.fetchImpl, now }));
    let found = res;
    if (res.status === 'unavailable' && location) {
      const alt = await cached(`nominatim-cat:${cat.label}|${location}`.toLowerCase(), 7 * 86400_000, () => searchPlacesByCategory({ label: cat.label, filters: cat.filters, location }, { fetchImpl: deps.fetchImpl, now }));
      if (alt.status === 'ok') found = { ...alt, source: `${alt.source} (the map query service was unavailable: ${res.note})` };
    }
    if (found.status === 'unavailable') { limitations.push(res.note); return { status: 'unavailable', note: res.note }; }
    const picks = pickCompetitors({ lat: center.lat, lon: center.lon, places: found.places, selfName: name, selfWebsite: website, category: cat.label });
    ev('competitor-search', found.source, `${found.places.length} named ${cat.label} place(s) within 15 km of ${center.basis}; selected: ${picks.map((p) => `${p.name} (${p.distance_km} km${p.website ? '' : ', no website'})`).join('; ') || 'none'}.`, 'high', res.retrieved_at, 'competitors');
    for (const p of picks) {
      let features = null; let pagesRead = 0; let at = now().toISOString();
      if (p.website) {
        const cr = await cached(`site:${hostOf(p.website)}:${full ? 3 : 2}`, 86400_000, async () => { const x = await crawlSite(p.website, { fetchImpl: deps.fetchImpl, lookup: deps.lookup, maxPages: full ? 3 : 2, now, timeoutMs: 7000 }); return { status: x.reachable ? 'ok' : 'unavailable', features: x.features, pages: x.pages.length, at: x.pages[0]?.retrieved_at || at }; });
        if (cr?.status === 'ok') { features = cr.features; pagesRead = cr.pages; at = cr.at; }
      }
      compared.push({ ...p, features, pagesRead, at });
      ev(`competitor:${p.name}`, p.website ? `Public website ${p.website} (retrieved ${at}) and ${found.source}` : found.source, `${p.name}: ${p.rationale}${features ? ` Observed on ${pagesRead} page(s): ${Object.entries(FEATURE_LABELS).map(([k, l]) => `${l} ${yesNo(features[k])}`).join(', ')}.` : ' Its website was not compared.'}`, features ? 'high' : 'medium', at, 'competitor');
    }
    if (!picks.length) limitations.push(`No named ${cat.label} with a public map listing was found within 25 km of ${center.basis}; competitors can be added by hand.`);
    return { note: picks.length ? `${picks.length} comparable business(es)` : 'None found within 25 km' };
  });
  await step('compare', async () => {
    if (!crawl?.reachable) return { status: 'skipped', note: 'The client website was not read.' };
    const withSites = compared.filter((x) => x.features);
    if (withSites.length < 2) return { status: 'skipped', note: 'Fewer than two competitor websites to compare.' };
    const gaps = compareJourneys(crawl.features, withSites.map((x) => ({ name: x.name, features: x.features })));
    ev('comparison', `Nova comparison of the same journey features on ${withSites.length + 1} public websites (retrieved ${now().toISOString()})`, `${name}: ${Object.entries(FEATURE_LABELS).map(([k, l]) => `${l} ${yesNo(crawl.features[k])}`).join(', ')}. ${withSites.map((x) => `${x.name}: ${Object.entries(FEATURE_LABELS).filter(([k]) => x.features[k]).map(([, l]) => l).join(', ') || 'none of these'}`).join('. ')}.`, 'high', now().toISOString(), 'comparison');
    for (const g of gaps) propose({ key: g.feature, check_key: `gap:${g.feature}:${hostOf(crawl.pages[0].url)}`, title: `${g.competitors_with} of ${g.compared} nearby competitors offer ${g.label}; ${name} does not`, detail: `Compared on public websites: ${g.names.join(', ')} offer ${g.label}; it was not found on the ${crawl.pages.length} page(s) read on ${name}'s site.`, why: `Customers comparing options can act immediately with ${g.names[0]}.`, next: `Add ${g.label} to the website journey.`, confirm: `Whether ${name} offers ${g.label} somewhere Nova did not read.`, priority: 'medium', evidence: ['comparison', ...g.names.map((n) => `competitor:${n}`)] });
    return { note: `${gaps.length} gap(s) found` };
  });

  // 7. record
  let summary = null;
  await step('record', async () => {
    const keys = evidence.map((e) => e.key);
    const inserted = evidence.length ? ((await dbInsert('audit_evidence', evidence.map((e) => e.row))).rows || []) : [];
    const idOf = Object.fromEntries(keys.map((k, i) => [k, inserted[i]?.id]));
    const recorded = await dbGet(`audit_findings?case_id=eq.${enc(c.id)}&review_status=neq.rejected&select=id,title,detail,review_status,origin,check_key,limitations`);
    const existing = new Set(recorded.filter((f) => f.check_key).map((f) => f.check_key));
    // Covering findings: reviewed ones, or ones a person wrote. Another unreviewed proposal never covers anything.
    const covers = recorded.filter((f) => f.origin !== 'automated_review' || f.review_status === 'reviewed');
    const coverOf = (key, checkKey) => coveredBy(TOPIC_OF[key] || key, covers.filter((f) => f.check_key !== checkKey));
    let proposed = 0, already = 0, covered = 0, withdrawn = 0;
    // Nova withdraws its own UNREVIEWED proposals that this run shows were unsupported (the page turned out to be built by
    // script) or that repeat a reviewed finding. Recorded on the finding, never deleted; a reviewer can restore it.
    const stamp = now().toISOString().slice(0, 16).replace('T', ' ');
    for (const f of recorded.filter((x) => x.origin === 'automated_review' && x.review_status === 'draft' && x.check_key)) {
      const key = f.check_key.split(':')[0];
      const why = crawl?.rendered_by_script && HTML_ONLY.some((k) => f.check_key.startsWith(k.endsWith(':') ? k : `${k}:`)) ? 'it rested on page content that could not be seen (the site is built by JavaScript)'
        : coverOf(key, f.check_key) ? `it repeats the recorded finding "${coverOf(key, f.check_key).title.slice(0, 120)}"` : null;
      if (!why) continue;
      await dbPatch('audit_findings', `id=eq.${enc(f.id)}&review_status=eq.draft`, { review_status: 'rejected', limitations: `${f.limitations ? `${f.limitations} ` : ''}Withdrawn by Nova's research on ${stamp} UTC: ${why}. Not deleted; a reviewer can restore it.`.slice(0, 2000) });
      existing.add(f.check_key); withdrawn++;
    }
    for (const p of proposals) {
      if (existing.has(p.check_key)) { already++; continue; }
      if (coverOf(p.key, p.check_key)) { covered++; continue; }
      const links = [...new Set(p.evidence.map((k) => idOf[k]).filter(Boolean))]; if (!links.length) continue;
      const f = await dbInsert('audit_findings', { case_id: c.id, title: p.title.slice(0, 300), statement_type: 'observed_fact', detail: p.detail.slice(0, 3000), priority: p.priority, confidence: 'high', recommended_action: p.next || null, customer_impact: p.why || null, limitations: p.confirm ? `To confirm: ${p.confirm}` : null, financial_impact_status: 'unknown', nova_can_implement: 'unknown', review_status: 'draft', origin: 'automated_review', check_key: p.check_key, module_key: p.module_key });
      if (f.conflict || !f.row) { already++; continue; }
      for (const e of links) await dbInsert('audit_finding_evidence', { finding_id: f.row.id, evidence_id: e });
      existing.add(p.check_key); proposed++;
    }
    // Competitors this research selected last time are replaced (they may have been chosen from older or wrong data);
    // competitors a person entered by hand are kept.
    if (compared.length || steps.find((x) => x.key === 'competitors').status === 'done') await dbFetch(`audit_competitors?case_id=eq.${enc(c.id)}&rationale=like.${enc('Same map category*')}`, { method: 'DELETE' });
    const have = await dbGet(`audit_competitors?case_id=eq.${enc(c.id)}&select=name`);
    for (const x of compared) {
      if (have.length >= 3 || have.some((h) => h.name === x.name)) continue;
      await dbInsert('audit_competitors', { case_id: c.id, name: x.name.slice(0, 160), url: x.website, rationale: x.rationale.slice(0, 600), observations: x.features ? Object.entries(FEATURE_LABELS).map(([k, l]) => ({ kind: 'observed', text: `${l}: ${yesNo(x.features[k])}`, source: x.website, captured_at: x.at, conditions: `public website, ${x.pagesRead} page(s)` })) : [] });
      have.push({ name: x.name });
    }
    summary = { evidence_added: inserted.length, findings_proposed: proposed, findings_already_recorded: already, findings_covered_by_recorded: covered, findings_withdrawn: withdrawn, rendered_by_script: !!crawl?.rendered_by_script, competitors: compared.length, competitor_websites_compared: compared.filter((x) => x.features).length, pages_read: crawl?.pages?.length || 0, identity: id?.match ? id.confidence : (id?.status === 'unavailable' ? 'unavailable' : 'not found'), issues: proposals.length, limitations, client_features: crawl?.reachable ? crawl.features : null };
    return { note: `${inserted.length} evidence records, ${proposed} new finding(s)${covered ? `, ${covered} already covered by a recorded finding` : ""}${withdrawn ? `, ${withdrawn} unsupported proposal(s) withdrawn` : ""}` };
  });
  const bad = steps.filter((s) => ['failed', 'unavailable'].includes(s.status)).length;
  await dbPatch('audit_cases', `id=eq.${enc(c.id)}`, { last_review_at: nowIso(), updated_at: nowIso() });
  await save({ status: steps.find((s) => s.key === 'record').status === 'failed' ? 'failed' : bad ? 'partial' : 'completed', finished_at: nowIso(), summary });
  return { steps, summary };
}
