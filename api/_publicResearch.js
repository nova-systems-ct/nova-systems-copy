// Public-first research engine for the Nova Audit (owner brief 2026-10-30 §4). Deterministic: no language model.
// Sources, all public and identified by Nova's User-Agent:
//   · the business's own website (robots.txt respected, bounded pages, SSRF-safe fetcher re-validating every redirect)
//   · OpenStreetMap Nominatim (identity + location; 1 request/second policy, cached by the caller)
//   · OpenStreetMap Overpass (same-category businesses nearby, for competitor selection)
// Retrieved content is untrusted DATA: it is parsed with fixed patterns and stored as short excerpts with its source
// URL and retrieval time; it is never executed or used as an instruction. A failed lookup is "could not check", never
// evidence that something is missing.
import { fetchPublicPage, extractPublicSignals } from './_auditResearch.js';

export const UA = 'NovaAuditResearch/2.0 (+https://nova-systems.app; isaac@nova-systems.app)';
const clean = (s, n = 200) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };
const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/\b(llc|inc|co|corp|company|ltd|the)\b/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter(Boolean));
export function nameSimilarity(a, b) { const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0; let i = 0; for (const t of A) if (B.has(t)) i++; return i / (A.size + B.size - i); }

// ------------------------------------------------------------------ industry → OpenStreetMap categories
const OSM = [
  [/roof|gutter/i, [['craft', 'roofer']], 'roofer'],
  [/plumb/i, [['craft', 'plumber']], 'plumber'],
  [/electric/i, [['craft', 'electrician']], 'electrician'],
  [/hvac|heating|air condition|furnace/i, [['craft', 'hvac']], 'HVAC contractor'],
  [/landscap|lawn/i, [['craft', 'gardener'], ['shop', 'garden_centre']], 'landscaper'],
  [/paint/i, [['craft', 'painter']], 'painter'],
  [/carpent|remodel|contractor|construct/i, [['craft', 'carpenter'], ['office', 'construction_company']], 'contractor'],
  [/auto ?body|collision|body shop|auto repair|mechanic|car repair|garage|brake|tire|tyre/i, [['shop', 'car_repair'], ['shop', 'tyres']], 'auto repair shop'],
  [/detail|car wash/i, [['amenity', 'car_wash'], ['shop', 'car_repair']], 'car care business'],
  [/restaurant|pizz|bistro|grill|diner|eatery|kitchen/i, [['amenity', 'restaurant']], 'restaurant'],
  [/cafe|coffee/i, [['amenity', 'cafe']], 'cafe'],
  [/bakery/i, [['shop', 'bakery']], 'bakery'],
  [/bar\b|pub|tavern/i, [['amenity', 'bar'], ['amenity', 'pub']], 'bar'],
  [/salon|hair|barber/i, [['shop', 'hairdresser']], 'hair salon'],
  [/nail|beauty|spa|esthetic/i, [['shop', 'beauty']], 'beauty business'],
  [/dent/i, [['amenity', 'dentist'], ['healthcare', 'dentist']], 'dentist'],
  [/chiro/i, [['healthcare', 'chiropractor']], 'chiropractor'],
  [/physio|physical therap/i, [['healthcare', 'physiotherapist']], 'physical therapist'],
  [/vet|animal hospital/i, [['amenity', 'veterinary']], 'veterinarian'],
  [/gym|fitness|crossfit|yoga|pilates/i, [['leisure', 'fitness_centre']], 'fitness business'],
  [/real estate|realtor|realty/i, [['office', 'estate_agent']], 'real estate office'],
  [/insurance/i, [['office', 'insurance']], 'insurance office'],
  [/law|attorney|lawyer/i, [['office', 'lawyer']], 'law office'],
  [/account|bookkeep|cpa|tax/i, [['office', 'accountant'], ['office', 'tax_advisor']], 'accounting office'],
  [/clean|maid|janitor/i, [['office', 'company'], ['craft', 'cleaning']], 'cleaning business'],
  [/florist|flower/i, [['shop', 'florist']], 'florist'],
  [/hotel|motel|inn\b/i, [['tourism', 'hotel'], ['tourism', 'motel']], 'hotel'],
  [/pet groom/i, [['shop', 'pet_grooming']], 'pet groomer'],
  [/locksmith/i, [['craft', 'locksmith']], 'locksmith'],
  [/moving|movers/i, [['office', 'moving_company']], 'moving company'],
];
export function industryToOsm(industry) {
  const hit = OSM.find(([re]) => re.test(String(industry || '')));
  return hit ? { filters: hit[1], label: hit[2] } : null;
}

// ------------------------------------------------------------------ identity (Nominatim)
let lastNominatim = 0;
async function politeNominatim(url, fetchImpl) {
  const wait = 1100 - (Date.now() - lastNominatim); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12_000);
  try { return await (fetchImpl || fetch)(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } }); } finally { clearTimeout(t); }
}
// Tries "name, town, state", then "name, town", then "name"; stops at the first query with an acceptable match. A match
// needs a near-identical name (or the same website); a town/website agreement raises confidence to high.
export async function resolveIdentity({ name, location, website }, { fetchImpl, now = () => new Date() } = {}) {
  const town = String(location || '').split(',')[0].trim();
  const queries = [...new Set([[name, location].filter(Boolean).join(', '), [name, town].filter(Boolean).join(', '), name].filter(Boolean))];
  const retrieved_at = now().toISOString();
  const site = hostOf(website);
  let candidates = []; let lastNote = null; let anyOk = false; let usedQ = queries[0];
  for (const q of queries) {
    usedQ = q;
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: 'jsonv2', limit: '5', extratags: '1', addressdetails: '1', countrycodes: 'us' })}`;
    let rows;
    try { const r = await politeNominatim(url, fetchImpl); if (!r.ok) { lastNote = `The map lookup answered HTTP ${r.status}.`; continue; } rows = await r.json(); anyOk = true; }
    catch (e) { lastNote = `The map lookup could not be reached (${e.message}).`; continue; }
    const scored = (Array.isArray(rows) ? rows : []).map((x) => {
      const nm = x.name || String(x.display_name || '').split(',')[0];
      const sim = nameSimilarity(name, nm);
      const osmSite = x.extratags?.website || x.extratags?.['contact:website'] || null;
      const siteMatch = !!(site && osmSite && hostOf(osmSite) === site);
      const townMatch = !!(town && norm(x.display_name).includes(norm(town)));
      return { name: nm, display_name: clean(x.display_name, 200), lat: Number(x.lat), lon: Number(x.lon), sim, siteMatch, townMatch, osm_type: x.osm_type, osm_id: x.osm_id,
        phone: x.extratags?.phone || x.extratags?.['contact:phone'] || null, website: osmSite, opening_hours: x.extratags?.opening_hours || null };
    });
    // a bare-name query must agree on the town or website, or it may be a same-name business elsewhere
    const best = scored.filter((x) => (x.sim >= 0.75 || x.siteMatch) && (q !== name || x.townMatch || x.siteMatch)).sort((a, b) => (b.siteMatch - a.siteMatch) || (b.townMatch - a.townMatch) || (b.sim - a.sim))[0] || null;
    for (const x of scored) if (x !== best && !candidates.some((c) => c.display_name === x.display_name)) candidates.push({ name: x.name, display_name: x.display_name, similarity: Math.round(x.sim * 100) / 100 });
    if (best) {
      const source = `OpenStreetMap Nominatim search "${q}" (retrieved ${retrieved_at}; data © OpenStreetMap contributors, ODbL)`;
      // Same website but a different town: possibly a different branch, a wrong listing or a wrong town entered.
      // Flag it for the owner; callers must not use this location as the business's location.
      const location_conflict = !!(town && !best.townMatch);
      const confidence = best.sim >= 0.75 && best.townMatch ? 'high' : best.sim >= 0.75 && best.siteMatch && !location_conflict ? 'high' : 'medium';
      return { status: 'ok', match: { name: best.name, display_name: best.display_name, osm: `${best.osm_type}/${best.osm_id}`, phone: best.phone, website: best.website, opening_hours: best.opening_hours, website_matches: best.siteMatch, town_matches: best.townMatch, location_conflict },
        confidence, lat: best.lat, lon: best.lon, candidates, source, retrieved_at };
    }
  }
  const source = `OpenStreetMap Nominatim searches ${queries.map((q) => `"${q}"`).join(', ')} (retrieved ${retrieved_at}; data © OpenStreetMap contributors, ODbL)`;
  if (!anyOk) return { status: 'unavailable', match: null, candidates: [], source, retrieved_at, note: lastNote };
  return { status: 'ok', match: null, confidence: 'none', candidates, source, retrieved_at, note: candidates.length ? 'Similar names were found but none is clearly this business; none was used.' : 'This business is not on OpenStreetMap under that name.', last_query: usedQ };
}

// The centre of a town or city ("Waterbury, CT"): a place lookup, not a business-name match.
export async function geocodePlace(location, { fetchImpl, now = () => new Date() } = {}) {
  const retrieved_at = now().toISOString();
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: location, format: 'jsonv2', limit: '5', countrycodes: 'us' })}`;
  const source = `OpenStreetMap Nominatim place search "${location}" (retrieved ${retrieved_at}; data © OpenStreetMap contributors, ODbL)`;
  try {
    const r = await politeNominatim(url, fetchImpl); if (!r.ok) return { status: 'unavailable', source, retrieved_at, note: `The map lookup answered HTTP ${r.status}.` };
    const rows = await r.json();
    const place = (Array.isArray(rows) ? rows : []).find((x) => ['city', 'town', 'village', 'hamlet', 'suburb', 'municipality', 'county'].includes(x.addresstype) || x.type === 'administrative');
    if (!place) return { status: 'ok', found: false, source, retrieved_at, note: `"${location}" was not found as a place.` };
    return { status: 'ok', found: true, lat: Number(place.lat), lon: Number(place.lon), display_name: clean(place.display_name, 200), source, retrieved_at };
  } catch (e) { return { status: 'unavailable', source, retrieved_at, note: `The map lookup could not be reached (${e.message}).` }; }
}

// ------------------------------------------------------------------ competitors (Overpass)
// One retry on a temporary server error (5xx / 429), then the public mirror; never more.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
export async function findCompetitorPlaces({ lat, lon, filters, radiusM = 15000 }, { fetchImpl, now = () => new Date(), retryDelayMs = 3000 } = {}) {
  const body = `[out:json][timeout:40];(${filters.map(([k, v]) => `nwr["${k}"="${v}"]["name"](around:${radiusM},${lat},${lon});`).join('')});out tags center 40;`;
  const retrieved_at = now().toISOString(); const source = `OpenStreetMap Overpass query (${filters.map(([k, v]) => `${k}=${v}`).join(', ')} within ${radiusM / 1000} km; retrieved ${retrieved_at}; data © OpenStreetMap contributors, ODbL)`;
  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, retryDelayMs));
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), attempt ? 20_000 : 25_000);
    try {
      const r = await (fetchImpl || fetch)(OVERPASS[attempt], { method: 'POST', signal: ctrl.signal, headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(body)}` });
      if (!r.ok) { last = `The map service answered HTTP ${r.status}.`; if (r.status >= 500 || r.status === 429) continue; return { status: 'unavailable', places: [], source, retrieved_at, note: last }; }
      const j = await r.json();
      const places = (j.elements || []).map((e) => ({ name: e.tags?.name, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, tags: e.tags || {} })).filter((p) => p.name && Number.isFinite(p.lat));
      return { status: 'ok', places, source, retrieved_at };
    } catch (e) { last = `The map service could not be reached (${e.name === 'AbortError' ? 'timed out' : e.message}).`; }
    finally { clearTimeout(t); }
  }
  return { status: 'unavailable', places: [], source, retrieved_at, note: last };
}
// Fallback when the map query service is unavailable: one geocoder search for "<category> in <town>", keeping only places
// whose map category matches. Fewer results than Overpass, but the same public source and policy.
export async function searchPlacesByCategory({ label, filters, location }, { fetchImpl, now = () => new Date() } = {}) {
  const q = `${label} in ${location}`;
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: 'jsonv2', limit: '25', extratags: '1', countrycodes: 'us' })}`;
  const retrieved_at = now().toISOString(); const source = `OpenStreetMap Nominatim category search "${q}" (retrieved ${retrieved_at}; data © OpenStreetMap contributors, ODbL)`;
  try {
    const r = await politeNominatim(url, fetchImpl);
    if (!r.ok) return { status: 'unavailable', places: [], source, retrieved_at, note: `The map search answered HTTP ${r.status}.` };
    const rows = await r.json();
    const ok = new Set(filters.map(([k, v]) => `${k}=${v}`));
    const places = (Array.isArray(rows) ? rows : []).filter((x) => ok.has(`${x.category}=${x.type}`)).map((x) => ({ name: x.name || String(x.display_name || '').split(',')[0], lat: Number(x.lat), lon: Number(x.lon), tags: { website: x.extratags?.website || x.extratags?.['contact:website'] || null } })).filter((p) => p.name && Number.isFinite(p.lat));
    return { status: 'ok', places, source, retrieved_at };
  } catch (e) { return { status: 'unavailable', places: [], source, retrieved_at, note: `The map search could not be reached (${e.message}).` }; }
}
const km = (a, b, c, d) => { const R = 6371, r = Math.PI / 180; const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
// Only places within maxKm count as comparable local competitors (a text search can return same-name places elsewhere).
export function pickCompetitors({ lat, lon, places, selfName, selfWebsite, category, max = 3, maxKm = 25 }) {
  const selfHost = hostOf(selfWebsite);
  return places
    .filter((p) => nameSimilarity(p.name, selfName) < 0.75 && !(selfHost && hostOf(p.tags?.website || p.tags?.['contact:website']) === selfHost))
    .map((p) => ({ ...p, website: p.tags?.website || p.tags?.['contact:website'] || null, distance_km: km(lat, lon, p.lat, p.lon) }))
    .filter((p) => p.distance_km <= maxKm)
    .sort((a, b) => (!!b.website - !!a.website) || a.distance_km - b.distance_km)
    .slice(0, max)
    .map((p) => ({ name: p.name, website: p.website, distance_km: Math.round(p.distance_km * 10) / 10, rationale: `Same map category (${category}), ${p.distance_km.toFixed(1)} km away${p.website ? '; publishes a website, so its customer journey can be compared' : '; no website listed, so only its listing can be compared'}.` }));
}

// ------------------------------------------------------------------ website crawl
const PRIORITY = [/contact|reach/i, /book|schedul|appointment|reserv/i, /quote|estimate/i, /pric|rates|cost|menu/i, /service/i, /review|testimonial/i, /about/i, /faq/i];
function parseRobots(txt) {
  const groups = []; let cur = null;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim(); if (!line) continue;
    const [k, ...rest] = line.split(':'); const v = rest.join(':').trim(); const key = k.trim().toLowerCase();
    if (key === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); }
    else if (cur && (key === 'disallow' || key === 'allow')) cur.rules.push({ allow: key === 'allow', path: v });
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && 'novaauditresearch'.startsWith(a)));
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules).filter((r) => r.path);
  return (path) => { const m = rules.filter((r) => path.startsWith(r.path)).sort((a, b) => b.path.length - a.path.length)[0]; return !m || m.allow; };
}
const PRICE = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s?(?:\/|per)\s?(?:hr|hour|mo|month|visit|sq\.? ?ft))?/gi;
const HOURS = /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*(?:[-–—to ]+\s*(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?)?[:\s]+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)/gi;
const PROOF = [/google\.com\/maps|g\.page|maps\.app\.goo\.gl/i, /yelp\.com\/biz/i, /facebook\.com\/[^"']+\/reviews/i, /trustpilot|angi\.com|homeadvisor|houzz|bbb\.org/i, /"aggregateRating"/i];
function excerptsOf(text, re, url, limit = 6) {
  const out = []; for (const m of text.matchAll(re)) { const i = m.index || 0; out.push({ text: clean(text.slice(Math.max(0, i - 50), i + m[0].length + 40), 140), match: m[0].trim(), url }); if (out.length >= limit) break; }
  return out;
}
export async function crawlSite(rootUrl, { fetchImpl, lookup, maxPages = 8, now = () => new Date(), timeoutMs = 8000 } = {}) {
  const pages = []; const skipped = []; let allowed = () => true;
  const root = new URL(rootUrl);
  try {
    const r = await (fetchImpl || fetch)(new URL('/robots.txt', root).toString(), { headers: { 'User-Agent': UA } });
    if (r.ok && /text\/plain/i.test(r.headers.get('content-type') || 'text/plain')) allowed = parseRobots(await r.text());
  } catch { /* no robots.txt reachable: default allow */ }
  const fetchPage = async (u) => {
    const t0 = Date.now();
    const p = await fetchPublicPage(u, { fetchImpl, lookup, timeoutMs, now });
    return { ...p, ms: Date.now() - t0 };
  };
  let home;
  try { home = await fetchPage(root.toString()); } catch (e) { return { reachable: false, error: e.message, dns_not_found: e.code === 'ENOTFOUND' || /ENOTFOUND/.test(e.message || ''), pages, skipped, signals: emptySignals(), features: {} }; }
  const textOf = (h) => clean(h, 200000);
  const record = (p) => pages.push({ url: p.finalUrl, status: p.status, retrieved_at: p.retrievedAt, ms: p.ms, bytes: (p.html || '').length, title: clean((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(p.html || '') || [])[1], 120), h1: clean((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(p.html || '') || [])[1], 120), html: p.html || '' });
  record(home);
  const host = hostOf(home.finalUrl);
  const links = [...String(home.html || '').matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: m[1], text: clean(m[2], 60) }));
  const seen = new Set([new URL(home.finalUrl).pathname]); const queue = [];
  for (const l of links) {
    let u; try { u = new URL(l.href, home.finalUrl); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || hostOf(u.toString()) !== host) continue;
    u.hash = ''; if (seen.has(u.pathname)) continue; seen.add(u.pathname);
    const score = PRIORITY.findIndex((re) => re.test(u.pathname) || re.test(l.text));
    if (score >= 0) queue.push({ url: u.toString(), score });
  }
  queue.sort((a, b) => a.score - b.score);
  for (const q of queue) {
    if (pages.length >= maxPages) break;
    if (!allowed(new URL(q.url).pathname)) { skipped.push({ url: q.url, reason: 'robots.txt disallows it' }); continue; }
    try { const p = await fetchPage(q.url); if (p.status < 400) record(p); else skipped.push({ url: q.url, reason: `HTTP ${p.status}`, status: p.status }); }
    catch (e) { skipped.push({ url: q.url, reason: e.message }); }
  }
  const signals = emptySignals();
  for (const p of pages) {
    const s = extractPublicSignals(p.html, p.url); const text = textOf(p.html);
    signals.phones.push(...s.clickToCallNumbers); signals.emails.push(...s.mailtoAddresses);
    for (const f of s.forms) signals.forms.push({ ...f, url: p.url });
    signals.booking_tools.push(...s.bookingTools); signals.chat_tools.push(...s.chatTools);
    for (const [k, v] of Object.entries(s.socialLinks)) signals.social[k] = [...new Set([...(signals.social[k] || []), ...v])];
    signals.structured.push(...s.structuredData);
    signals.prices.push(...excerptsOf(text, PRICE, p.url)); signals.hours.push(...excerptsOf(text, HOURS, p.url, 3));
    if (PROOF.some((re) => re.test(p.html)) || /\b(testimonials?|reviews?)\b/i.test(clean((p.html.match(/<(h\d|nav|a)\b[\s\S]*?<\/\1>/gi) || []).join(' '), 5000))) signals.reviews_proof.push({ url: p.url });
    if (!/<meta[^>]+name=["']viewport["']/i.test(p.html)) signals.no_viewport.push(p.url);
  }
  for (const k of ['phones', 'emails', 'booking_tools', 'chat_tools']) signals[k] = [...new Set(signals[k])];
  const bookingLinks = pages.some((p) => /book|schedul|appointment|reserv/i.test(new URL(p.url).pathname));
  const features = {
    https: /^https:/i.test(home.finalUrl), mobile_viewport: signals.no_viewport.length === 0,
    click_to_call: signals.phones.length > 0, contact_form: signals.forms.length > 0, online_booking: signals.booking_tools.length > 0 || bookingLinks,
    prices_published: signals.prices.length > 0, hours_published: signals.hours.length > 0 || signals.structured.some((x) => x.hasHours), reviews_or_social_proof: signals.reviews_proof.length > 0,
    chat: signals.chat_tools.length > 0,
  };
  return { reachable: true, home_status: home.status, pages: pages.map(({ html, ...rest }) => rest), skipped, signals, features };
}
function emptySignals() { return { phones: [], emails: [], forms: [], booking_tools: [], chat_tools: [], social: {}, structured: [], prices: [], hours: [], reviews_proof: [], no_viewport: [] }; }

// ------------------------------------------------------------------ comparison + goal
export const FEATURE_LABELS = { online_booking: 'online booking', click_to_call: 'tap-to-call phone link', prices_published: 'published prices', contact_form: 'a contact form', reviews_or_social_proof: 'reviews or social proof', hours_published: 'published hours', chat: 'live chat', https: 'a secure (HTTPS) site', mobile_viewport: 'phone-ready pages' };
export function compareJourneys(own, others) {
  const out = [];
  for (const f of Object.keys(FEATURE_LABELS)) {
    if (own[f]) continue;
    const compared = others.filter((o) => o.features && f in o.features);
    const withIt = compared.filter((o) => o.features[f]);
    if (compared.length && withIt.length >= 2 && withIt.length * 2 >= compared.length) out.push({ feature: f, label: FEATURE_LABELS[f], competitors_with: withIt.length, compared: compared.length, names: withIt.map((o) => o.name) });
  }
  return out;
}
const GOAL_WORDS = {
  online_booking: /book|appointment|schedul|calls?|leads?|customers?|jobs?|inquir|sales|revenue/i,
  click_to_call: /calls?|phone|leads?|customers?|inquir|jobs?/i,
  contact_form: /leads?|inquir|customers?|quotes?|jobs?/i,
  prices_published: /price|quote|estimate|sales|close/i,
  reviews_or_social_proof: /review|reputation|trust|referr/i,
  hours_published: /hours|open|walk-?in/i,
  email_dns: /email|spam|deliver|newsletter/i,
  speed: /mobile|website|traffic|seo|google/i,
};
export const goalRelevant = (goal, key) => !!(goal && GOAL_WORDS[key] && GOAL_WORDS[key].test(goal));
