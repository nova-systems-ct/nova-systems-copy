// Public-source research for the Nova Audit: fetch a business's own public web page and extract
// observable signals as EVIDENCE. Retrieved content is untrusted DATA — it is never executed,
// never interpreted as instructions, and is stored only as bounded observation text.
// It cannot see missed calls, lost revenue, or anything not on the public page; absence of a signal
// in one fetched page is recorded as a low-confidence observation, never as proof of absence.
import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 600_000;
const MAX_REDIRECTS = 3;

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7));
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb');
  }
  return true;
}

// Throws on anything that is not a plain public http(s) URL. `lookup` is injectable for tests.
export async function assertPublicHttpUrl(raw, lookup = (h) => dns.lookup(h, { all: true })) {
  let u; try { u = new URL(String(raw)); } catch { throw new Error('Not a valid URL'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) URLs can be researched');
  if (u.username || u.password) throw new Error('URLs with embedded credentials are refused');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('Non-standard ports are refused');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new Error('Internal hostnames are refused');
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host);
  if (!addrs.length) throw new Error('Host did not resolve');
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('Host resolves to a private or reserved address');
  return u;
}

// Manual redirect handling so EVERY hop is re-validated (a public URL must not bounce us to an internal one).
export async function fetchPublicPage(raw, { fetchImpl = fetch, lookup, timeoutMs = 6000, now = () => new Date() } = {}) {
  let url = String(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = await assertPublicHttpUrl(url, lookup);
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let r;
    try { r = await fetchImpl(u.toString(), { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'NovaAuditResearch/1.0 (+public page review)', Accept: 'text/html,application/xhtml+xml' } }); }
    finally { clearTimeout(timer); }
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const loc = r.headers.get('location'); if (!loc) throw new Error('Redirect without a location');
      url = new URL(loc, u).toString(); continue;
    }
    const type = r.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(type)) return { finalUrl: u.toString(), status: r.status, contentType: type, html: '', retrievedAt: now().toISOString(), note: 'Not an HTML page — nothing extracted' };
    const buf = Buffer.from(await r.arrayBuffer());
    return { finalUrl: u.toString(), status: r.status, contentType: type, html: buf.subarray(0, MAX_BYTES).toString('utf8'), truncated: buf.length > MAX_BYTES, retrievedAt: now().toISOString() };
  }
  throw new Error('Too many redirects');
}

const clean = (s, n = 200) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const uniq = (a) => [...new Set(a)];

const BOOKING = [['Calendly', /calendly\.com/i], ['Cal.com', /cal\.com\//i], ['Acuity', /acuityscheduling\.com|squarespacescheduling\.com/i], ['Square Appointments', /squareup\.com\/appointments|square\.site/i], ['Booksy', /booksy\.com/i], ['Vagaro', /vagaro\.com/i], ['Mindbody', /mindbodyonline\.com|mindbody\.io/i], ['HubSpot Meetings', /meetings\.hubspot\.com/i], ['Jane App', /janeapp\.com/i], ['SimplyBook', /simplybook\.(me|it)/i]];
const CHAT = [['Intercom', /intercom(cdn)?\.(io|com)/i], ['Drift', /js\.driftt\.com|drift\.com/i], ['Tawk.to', /tawk\.to/i], ['LiveChat', /livechatinc\.com/i], ['Crisp', /crisp\.chat/i], ['Tidio', /tidio\.co|tidiochat/i]];
const SOCIAL = [['facebook', /facebook\.com\/[^\s"'<>]+/ig], ['instagram', /instagram\.com\/[^\s"'<>]+/ig], ['linkedin', /linkedin\.com\/(company|in)\/[^\s"'<>]+/ig], ['youtube', /youtube\.com\/(@|channel|c|user)[^\s"'<>]*/ig], ['tiktok', /tiktok\.com\/@[^\s"'<>]+/ig], ['yelp', /yelp\.com\/biz\/[^\s"'<>]+/ig], ['x', /(twitter|x)\.com\/[A-Za-z0-9_]{1,15}(?=["'\s<>?/]|$)/ig]];

export function extractPublicSignals(html, finalUrl) {
  const h = String(html || '');
  const title = clean((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h) || [])[1]);
  const desc = clean((/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(h) || [])[1], 300);
  const tel = uniq([...h.matchAll(/href=["']tel:([+\d\-().\s%]{7,25})["']/gi)].map((m) => clean(m[1].replace(/%20/g, ' ').replace(/%2B/gi, '+'), 25))).slice(0, 5);
  const mailto = uniq([...h.matchAll(/href=["']mailto:([^"'?\s]{3,100})/gi)].map((m) => clean(m[1], 100))).slice(0, 5);
  const forms = [...h.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map((m) => m[0]);
  const formInfo = forms.slice(0, 10).map((f) => ({ fields: (f.match(/<(input|textarea|select)\b/gi) || []).length, asksPhone: /type=["']tel["']|name=["'][^"']*phone/i.test(f), asksEmail: /type=["']email["']|name=["'][^"']*email/i.test(f) }));
  const ld = [];
  for (const m of h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const j = JSON.parse(m[1]); for (const n of (Array.isArray(j) ? j : j['@graph'] || [j])) if (n && /LocalBusiness|Organization|Restaurant|Store|Dentist|Physician|Attorney|HomeAndConstructionBusiness|ProfessionalService/i.test(JSON.stringify(n['@type'] || ''))) ld.push({ type: clean(JSON.stringify(n['@type']), 60), name: clean(n.name, 120), telephone: clean(n.telephone, 30), address: clean(typeof n.address === 'object' ? [n.address?.streetAddress, n.address?.addressLocality, n.address?.addressRegion].filter(Boolean).join(', ') : n.address, 200), hasHours: !!n.openingHours || !!n.openingHoursSpecification }); } catch { /* malformed JSON-LD: ignore */ }
  }
  const social = {}; for (const [name, re] of SOCIAL) { const found = uniq([...h.matchAll(re)].map((m) => clean(m[0], 120))).slice(0, 3); if (found.length) social[name] = found; }
  return {
    url: finalUrl, https: /^https:/i.test(finalUrl), title, description: desc,
    hasViewportMeta: /<meta[^>]+name=["']viewport["']/i.test(h),
    clickToCallNumbers: tel, mailtoAddresses: mailto, forms: formInfo,
    bookingTools: BOOKING.filter(([, re]) => re.test(h)).map(([n]) => n),
    chatTools: CHAT.filter(([, re]) => re.test(h)).map(([n]) => n),
    structuredData: ld.slice(0, 3), socialLinks: social,
    bytesAnalyzed: h.length,
  };
}

// Turns signals into evidence records. Observations are phrased as what was seen IN THIS FETCH; absence
// is always low confidence with an explicit limitation. Nothing here asserts a business consequence.
export function signalsToEvidence(s, retrievedAt) {
  const src = `Public web page ${s.url} (retrieved ${retrievedAt})`;
  const mk = (observation, confidence, extra = {}) => ({ source: src, method: 'automated_public_page_fetch', observation: observation.slice(0, 3000), source_quality: 'medium', confidence, privacy_level: 'internal', ...extra });
  const out = [];
  out.push(mk(`Page title: "${s.title || '(none found)'}". Meta description: "${s.description || '(none found)'}". Served over ${s.https ? 'HTTPS' : 'plain HTTP'}. Mobile viewport meta tag ${s.hasViewportMeta ? 'present' : 'not found'}.`, 'high'));
  out.push(s.clickToCallNumbers.length ? mk(`Click-to-call phone link(s) found in the page HTML: ${s.clickToCallNumbers.join(', ')}.`, 'high') : mk('No tel: click-to-call link was found in this page\'s HTML. Limitation: a number may still be shown as plain text, in an image, or on another page.', 'low'));
  out.push(s.forms.length ? mk(`${s.forms.length} form(s) found in the page HTML; ${s.forms.filter((f) => f.asksPhone).length} ask for a phone number and ${s.forms.filter((f) => f.asksEmail).length} ask for an email.`, 'high') : mk('No <form> element was found in this page\'s HTML. Limitation: a form may be embedded by script/iframe, or exist on another page (e.g. /contact).', 'low'));
  out.push(s.bookingTools.length ? mk(`Online-booking tool reference(s) detected in the page HTML: ${s.bookingTools.join(', ')}.`, 'medium') : mk('No known online-booking tool reference was detected in this page\'s HTML. Limitation: absence on one page does not show the business lacks online booking.', 'low'));
  if (s.chatTools.length) out.push(mk(`Chat widget reference(s) detected: ${s.chatTools.join(', ')}.`, 'medium'));
  if (s.structuredData.length) out.push(mk(`Structured business data (JSON-LD) declared by the site: ${JSON.stringify(s.structuredData).slice(0, 900)}. This is what the site claims about itself, not independently verified.`, 'medium', { source_quality: 'low' }));
  if (Object.keys(s.socialLinks).length) out.push(mk(`Social/profile links found on the page: ${JSON.stringify(s.socialLinks).slice(0, 900)}. Links only — profile activity was not reviewed.`, 'medium'));
  return out;
}
