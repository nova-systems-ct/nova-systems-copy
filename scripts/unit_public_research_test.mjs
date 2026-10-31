// Public-first research engine (api/_publicResearch.js) — pure logic against stand-in web, geocoder and map data.
// No network. Each check names the behavior it protects.
//   node scripts/unit_public_research_test.mjs
const R = await import('../api/_publicResearch.js');
let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log(`PASS — ${n}`); } else { fail++; console.log(`FAIL — ${n} ${x}`); } };
const html = (body, head = '<meta name="viewport" content="width=device-width">') => `<html><head><title>T</title>${head}</head><body>${body}</body></html>`;
const site = (pages, robots = '') => async (url) => {
  const u = new URL(url);
  if (u.pathname === '/robots.txt') return new Response(robots, { status: robots ? 200 : 404, headers: { 'content-type': 'text/plain' } });
  const p = pages[u.pathname];
  return p ? new Response(p, { status: 200, headers: { 'content-type': 'text/html' } }) : new Response('nf', { status: 404, headers: { 'content-type': 'text/html' } });
};
const lookup = async () => [{ address: '93.184.216.34', family: 4 }];

// 1. industry → map categories
check('roofing maps to the OSM roofer category', JSON.stringify(R.industryToOsm('Roofing & gutters')).includes('roofer'));
check('a restaurant maps to amenity=restaurant', JSON.stringify(R.industryToOsm('Italian restaurant')).includes('restaurant'));
check('auto body and collision shops map to the car-repair category', JSON.stringify(R.industryToOsm('Auto body repair')).includes('car_repair') && JSON.stringify(R.industryToOsm('Collision center')).includes('car_repair'));
check('an unknown industry maps to nothing (competitor discovery says unavailable, never guesses)', R.industryToOsm('quantum widgets') === null);

// 2. identity resolution
const geo = (rows) => async () => new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
let id = await R.resolveIdentity({ name: 'Brass City Roofing', location: 'Waterbury, CT', website: 'https://brasscityroofing.com/' }, { fetchImpl: geo([{ name: 'Brass City Roofing', display_name: 'Brass City Roofing, 10 Main St, Waterbury, CT', lat: '41.55', lon: '-73.04', extratags: { website: 'https://www.brasscityroofing.com', phone: '+1 203 555 0101' } }]) });
check('a same-name, same-website place in the given town is a confident match', id.match && id.confidence === 'high' && id.lat === 41.55, JSON.stringify(id));
id = await R.resolveIdentity({ name: 'Brass City Roofing', location: 'Waterbury, CT', website: 'https://brasscityroofing.com/' }, { fetchImpl: geo([{ name: 'Brass City Plumbing', display_name: 'Brass City Plumbing, Waterbury, CT', lat: '41.5', lon: '-73' }]) });
check('a similarly named different business is NOT taken as the client (kept only as a candidate)', !id.match && id.candidates.length === 1, JSON.stringify(id));
id = await R.resolveIdentity({ name: 'X', location: 'Y' }, { fetchImpl: async () => { throw new Error('offline'); } });
check('a geocoder failure is "could not check", not "business not found"', id.status === 'unavailable' && !id.match, JSON.stringify(id));

// 2a. same website, different town: a conflict to confirm, never silently used as the business's location
id = await R.resolveIdentity({ name: 'The Ridge Bar & Grill', location: 'Waterbury, CT', website: 'https://ridgebargrill.com/' }, { fetchImpl: geo([{ name: 'The Ridge Bar & Grill', display_name: 'The Ridge Bar & Grill, 75th Street, Woodridge, DuPage County, Illinois, United States', lat: '41.75', lon: '-88.03', extratags: { website: 'https://ridgebargrill.com/' } }]) });
check('a website match in another town/state is flagged as a location conflict at medium confidence', id.match && id.match.location_conflict === true && id.confidence === 'medium', JSON.stringify(id).slice(0, 300));

// 2b. town geocoding is its own lookup (a place, not a business name)
const town = await R.geocodePlace('Waterbury, CT', { fetchImpl: geo([{ name: 'Waterbury', display_name: 'Waterbury, New Haven County, Connecticut, United States', lat: '41.554', lon: '-73.043', addresstype: 'city', category: 'boundary', type: 'administrative' }]) });
check('a town geocodes to its centre', town.status === 'ok' && Math.abs(town.lat - 41.554) < 0.001, JSON.stringify(town));
// 2c. identity tries a narrower query when the full one finds nothing
let qs = [];
const twoStep = async (url) => { const q = new URL(url).searchParams.get('q'); qs.push(q); return new Response(JSON.stringify(qs.length === 1 ? [] : [{ name: 'The Ridge Bar & Grill', display_name: 'The Ridge Bar & Grill, Wolcott Road, Waterbury, Connecticut', lat: '41.58', lon: '-73.0', extratags: { website: 'https://ridgebargrill.com/' } }]), { status: 200, headers: { 'content-type': 'application/json' } }); };
id = await R.resolveIdentity({ name: 'The Ridge Bar & Grill', location: 'Waterbury, CT', website: 'https://ridgebargrill.com/' }, { fetchImpl: twoStep });
check('when "name, town, state" finds nothing, "name, town" is tried and a website-confirmed match is accepted', id.match && id.confidence === 'high' && qs.length === 2, `${JSON.stringify(qs)} ${JSON.stringify(id).slice(0, 160)}`);

// 3–4. site crawl
const pages = {
  '/': html('<a href="tel:2035550101">Call</a><a href="/services">Services</a><a href="/contact">Contact us</a><a href="/book-online">Book online</a><a href="/pricing">Pricing</a>'),
  '/services': html('<h1>Roof repair</h1><p>Repairs from $249. Inspections $99.</p>'),
  '/pricing': html('<p>Full replacement from $8,900</p>'),
  '/contact': html('<form><input name="a"><input name="b"><input type="email" name="email"><input type="tel" name="phone"><textarea></textarea></form><p>Hours: Mon–Fri 8am–5pm</p>'),
  '/book-online': html('<p>booking</p>'),
};
const fetched = [];
const crawlFetch = async (url, o) => { fetched.push(new URL(url).pathname); return site(pages, 'User-agent: *\nDisallow: /book-online')(url, o); };
const crawl = await R.crawlSite('https://brasscityroofing.com/', { fetchImpl: crawlFetch, lookup, maxPages: 6 });
check('robots.txt is respected: a disallowed booking page (a high-priority candidate) is never fetched, and the skip is recorded', !fetched.includes('/book-online') && crawl.skipped.some((x) => x.url.endsWith('/book-online') && /robots/.test(x.reason)), fetched.join(','));
check('contact, services and pricing pages are discovered from the home page', ['/services', '/contact', '/pricing'].every((p) => crawl.pages.some((x) => new URL(x.url).pathname === p)), crawl.pages.map((p) => p.url).join(','));
check('published prices are extracted with their page', crawl.signals.prices.some((p) => p.text.includes('$249') && p.url.endsWith('/services')), JSON.stringify(crawl.signals.prices));
check('published hours are detected', crawl.signals.hours.length >= 1, JSON.stringify(crawl.signals.hours));
check('every page records its retrieval time and status', crawl.pages.every((p) => p.retrieved_at && p.status));
const crawlBad = await R.crawlSite('https://brasscityroofing.com/', { fetchImpl: async () => { throw new Error('ECONNRESET'); }, lookup, maxPages: 3 });
check('an unreachable site is reported as unreachable, with no invented signals', crawlBad.reachable === false && crawlBad.pages.length === 0, JSON.stringify(crawlBad).slice(0, 200));

// 4b. a website address that does not exist in public DNS is a verifiable fact, distinct from "could not reach"
const nx = await R.crawlSite('https://gone-business.example/', { fetchImpl: async () => new Response('x'), lookup: async () => { const e = new Error('getaddrinfo ENOTFOUND gone-business.example'); e.code = 'ENOTFOUND'; throw e; }, maxPages: 2 });
check('a non-existent domain is reported as such (dns_not_found), not as a generic failure', nx.reachable === false && nx.dns_not_found === true, JSON.stringify(nx).slice(0, 200));
const slow = await R.crawlSite('https://slow.example/', { fetchImpl: async () => { throw Object.assign(new Error('timeout'), { name: 'AbortError' }); }, lookup, maxPages: 2 });
check('a timeout is NOT reported as a missing domain', slow.reachable === false && !slow.dns_not_found);
// 4c. the map query retries once on a temporary server error
let attempts = 0;
const flaky = async () => { attempts++; return attempts === 1 ? new Response('busy', { status: 502 }) : new Response(JSON.stringify({ elements: [{ tags: { name: 'A Roofer' }, lat: 41.5, lon: -73 }] }), { status: 200, headers: { 'content-type': 'application/json' } }); };
const places = await R.findCompetitorPlaces({ lat: 41.5, lon: -73, filters: [['craft', 'roofer']] }, { fetchImpl: flaky, retryDelayMs: 1 });
check('a temporary 502 from the map service is retried once and then succeeds', places.status === 'ok' && places.places.length === 1 && attempts === 2, `${places.status} attempts=${attempts}`);

// 4d. when the map query service is down, the geocoder's category search is the fallback (same category only)
const nomi = async () => new Response(JSON.stringify([
  { name: 'Joe Plumbing', display_name: 'Joe Plumbing, Waterbury', lat: '41.55', lon: '-73.04', category: 'craft', type: 'plumber', extratags: { website: 'https://joeplumbing.example' } },
  { name: 'Bob Bakery', display_name: 'Bob Bakery, Waterbury', lat: '41.56', lon: '-73.05', category: 'shop', type: 'bakery', extratags: {} },
]), { status: 200, headers: { 'content-type': 'application/json' } });
const fb = await R.searchPlacesByCategory({ label: 'plumber', filters: [['craft', 'plumber']], location: 'Waterbury, CT' }, { fetchImpl: nomi });
check('the fallback search keeps only the same category, with its website', fb.status === 'ok' && fb.places.length === 1 && fb.places[0].name === 'Joe Plumbing' && fb.places[0].tags.website === 'https://joeplumbing.example', JSON.stringify(fb.places));

// 5. competitors
const placeList = [
  { name: 'Brass City Roofing', lat: 41.551, lon: -73.041, tags: { website: 'https://brasscityroofing.com' } },
  { name: 'Far Roofer', lat: 41.70, lon: -73.20, tags: {} },
  { name: 'Near Roofer', lat: 41.552, lon: -73.042, tags: { website: 'https://nearroofer.com' } },
  { name: 'Mid Roofer', lat: 41.58, lon: -73.06, tags: { website: 'https://midroofer.com' } },
  { name: 'No Site Roofer', lat: 41.553, lon: -73.043, tags: {} },
];
const comp = R.pickCompetitors({ lat: 41.55, lon: -73.04, places: placeList, selfName: 'Brass City Roofing', selfWebsite: 'https://brasscityroofing.com/', category: 'roofer' });
check('the client itself is never its own competitor', !comp.some((c) => /Brass City/.test(c.name)));
check('at most three competitors, nearest with a website first', comp.length <= 3 && comp[0].name === 'Near Roofer', comp.map((c) => c.name).join(','));
check('each competitor states why it was chosen (category and distance)', comp.every((c) => /roofer/.test(c.rationale) && /km/.test(c.rationale)), comp.map((c) => c.rationale).join(' | '));

const farOnly = R.pickCompetitors({ lat: 41.55, lon: -73.04, places: [{ name: 'Chicago Grill', lat: 41.88, lon: -87.63, tags: { website: 'https://x.example' } }], selfName: 'Brass City Roofing', category: 'roofer' });
check('a same-category place hundreds of kilometres away is never chosen as a competitor', farOnly.length === 0, JSON.stringify(farOnly));

// 6. journey comparison → connected insight
const own = { click_to_call: true, online_booking: false, prices_published: true, contact_form: true, reviews_or_social_proof: false };
const others = [{ name: 'A', features: { online_booking: true, reviews_or_social_proof: true } }, { name: 'B', features: { online_booking: true } }, { name: 'C', features: { online_booking: false } }];
const gaps = R.compareJourneys(own, others);
check('a feature most compared competitors offer and the client lacks becomes a gap', gaps.some((g) => g.feature === 'online_booking' && g.competitors_with === 2 && g.compared === 3), JSON.stringify(gaps));
check('a feature only one competitor has is not reported as a market gap', !gaps.some((g) => g.feature === 'reviews_or_social_proof'), JSON.stringify(gaps));

// 7. goal relevance
check('the owner goal "more booked jobs" marks booking findings as goal-related', R.goalRelevant('Get more booked jobs from the website', 'online_booking') === true);
check('an unrelated goal does not', R.goalRelevant('Lower my software bills', 'online_booking') === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
