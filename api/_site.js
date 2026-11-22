// Client business websites (Nova system 5): a simple one-page site for every client business at
// /b/<organization slug>, built from the business's own records each time it is opened, so a newly
// registered business has a working site as soon as it has one active service, with no code.
//
// Shown: the business name and its own words (assistant greeting, services, area), its active
// services, a price only where the owner approved it, opening hours when they are set, the one
// offer the owner approved for website visitors, its phone number, and one button to the
// business's request page (/start). Nothing is invented: a field with no record is left out.
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dollars = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const twelve = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); if (!Number.isInteger(h) || !Number.isInteger(m)) return null; const ap = h >= 12 ? 'p.m.' : 'a.m.'; const hr = ((h + 11) % 12) + 1; return `${hr}${m ? `:${String(m).padStart(2, '0')}` : ''} ${ap}`; };

// {mon: [{start: '08:00', end: '17:00'}], ...} → rows, or [] when no hours are recorded.
export function hoursRows(businessHours) {
  if (!businessHours || typeof businessHours !== 'object') return [];
  const rows = [];
  for (const [key, label] of DAYS) {
    const spans = Array.isArray(businessHours[key]) ? businessHours[key] : null;
    if (!spans) continue;
    const text = spans.map((s) => { const a = twelve(s?.start), b = twelve(s?.end); return a && b ? `${a} to ${b}` : null; }).filter(Boolean).join(', ');
    rows.push([label, text || 'Closed']);
  }
  return rows;
}

const page = ({ title, description, body, indexable }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">${indexable ? '' : '<meta name="robots" content="noindex">'}
<style>
*{box-sizing:border-box}body{margin:0;background:#f7f5f0;color:#1b2430;font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:48px 22px 72px}h1{font:700 clamp(34px,7vw,52px)/1.08 system-ui,sans-serif;letter-spacing:-.02em;margin:6px 0 14px}
.eyebrow{font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#5b6b7c;margin:0}.lead{font-size:19px;color:#3b4856;max-width:620px}
.cta{display:inline-block;background:#1b2430;color:#fff;text-decoration:none;font-weight:800;padding:15px 22px;border-radius:10px;margin:18px 12px 0 0}.cta.alt{background:none;color:#1b2430;border:2px solid #1b2430}
.offer{border:2px solid #1b2430;border-radius:12px;padding:14px 16px;font-weight:700;margin-top:24px}
h2{font-size:22px;margin:44px 0 12px}.services{list-style:none;padding:0;margin:0;display:grid;gap:12px}.services li{background:#fff;border:1px solid #e3ded3;border-radius:12px;padding:16px 18px}
.services strong{display:block;font-size:18px}.services .price{float:right;font-weight:800}.services span{color:#4f5d6b;font-size:15px}
table{border-collapse:collapse;width:100%;max-width:420px}td{padding:6px 0;border-bottom:1px solid #e3ded3}td:last-child{text-align:right}
footer{margin-top:56px;font-size:13px;color:#6b7785}a{color:inherit}a:focus-visible{outline:3px solid #1f7fc4;outline-offset:3px}
</style></head><body><main>${body}</main></body></html>`;

export const notFound = () => page({ title: 'Page not found', description: '', indexable: false, body: '<h1>This page is not available.</h1><p class="lead">The business may not have published its page yet.</p>' });

// Returns { status, html } for /b/<slug>.
export async function siteFor(db, slug, { now = new Date() } = {}) {
  if (!SLUG_RE.test(String(slug || ''))) return { status: 404, html: notFound() };
  const org = await one(db, 'organizations', { slug });
  if (!org || (org.status && org.status !== 'active')) return { status: 404, html: notFound() };
  const services = (await db.select('business_services', { organization_id: org.id, active: true }, { order: 'name.asc', limit: 50 }));
  if (!services.length) return { status: 404, html: notFound() };
  const [agent, voice, offers] = await Promise.all([
    one(db, 'business_agents', { organization_id: org.id }),
    one(db, 'voice_configurations', { organization_id: org.id }),
    db.select('business_offers', { organization_id: org.id, trigger_type: 'web_visit' }),
  ]);
  const name = agent?.business_name || org.name || 'Local business';
  const offer = offers.find((o) => o.approved === true && o.active === true && (!o.expires_at || new Date(o.expires_at) > now));
  const start = `/start?org=${org.id}${offer ? `&code=${encodeURIComponent(offer.code)}` : ''}`;
  const lead = agent?.greeting || (agent?.services ? agent.services.split('\n')[0] : '') || `Tell ${name} what you need and get a clear quote.`;
  const hours = hoursRows(voice?.business_hours);
  const phone = agent?.phone_number || null;
  const pretty = phone && /^\+1\d{10}$/.test(phone) ? `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}` : phone;
  const body = [
    `<p class="eyebrow">${esc(agent?.industry || 'Local service')}${agent?.service_area ? ` · ${esc(agent.service_area)}` : ''}</p>`,
    `<h1>${esc(name)}</h1><p class="lead">${esc(lead)}</p>`,
    `<a class="cta" href="${esc(start)}">Request a quote</a>${phone ? `<a class="cta alt" href="tel:${esc(phone)}">Call ${esc(pretty)}</a>` : ''}`,
    offer ? `<p class="offer">${esc(offer.description)}. Code ${esc(offer.code)} is added when you request a quote${offer.expires_at ? `, until ${esc(new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(offer.expires_at)))}` : ''}.</p>` : '',
    `<h2>What we do</h2><ul class="services">${services.map((s) => `<li>${s.price_approved === true && Number.isInteger(s.price_cents) ? `<span class="price">${dollars(s.price_cents)}</span>` : ''}<strong>${esc(s.name)}</strong>${s.description ? `<span>${esc(s.description)}</span>` : ''}</li>`).join('')}</ul>`,
    hours.length ? `<h2>Hours</h2><table>${hours.map(([d, t]) => `<tr><td>${esc(d)}</td><td>${esc(t)}</td></tr>`).join('')}</table>` : '',
    `<h2>Get started</h2><p>Tell us what you need. You get a clear quote before any work starts.</p><a class="cta" href="${esc(start)}">Request a quote</a>`,
    `<footer>© ${now.getFullYear()} ${esc(name)}${agent?.service_area ? ` · ${esc(agent.service_area)}` : ''}</footer>`,
    // The website chat button, when the business has switched website chat on (api/_webChat.js).
    agent?.status === 'active' && agent?.web_chat_enabled === true ? `<script src="/chat/embed.js?v=20261121a" data-business="${esc(slug)}" async></script>` : '',
  ].join('\n');
  return { status: 200, html: page({ title: `${name}${agent?.industry ? ` | ${agent.industry}` : ''}`, description: lead, body, indexable: true }) };
}
