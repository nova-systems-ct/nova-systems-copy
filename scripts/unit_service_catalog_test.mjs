// The service catalog must stay honest and connected: every service is fully described, has no
// price, and its request action selects a value the saved request really accepts.
import fs from 'node:fs';
import { SERVICE_CATALOG, AVAILABILITY, requestLink } from '../src/lib/serviceCatalog.js';
import { LAUNCH_SERVICES } from '../api/_launchWorker.js';

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : ' — ' + detail}`); };

const families = ['Customer care', 'Scheduling', 'Sales support', 'Marketing', 'Daily operations', 'Administration', 'Finance support', 'Business improvement'];
check('the catalog holds the eight service families from the owner brief, in order', JSON.stringify(SERVICE_CATALOG.map((s) => s.name)) === JSON.stringify(families));
const text = ['summary', 'helps', 'youSupply', 'deliverable', 'escalation'];
const incomplete = SERVICE_CATALOG.filter((s) => text.some((f) => typeof s[f] !== 'string' || s[f].length < 20) || !Array.isArray(s.included) || s.included.length < 3);
check('every service says who it helps, what is included, what the customer supplies, what comes back and what happens to exceptions', incomplete.length === 0, incomplete.map((s) => s.key).join(','));
check('every service has a known availability', SERVICE_CATALOG.every((s) => Object.hasOwn(AVAILABILITY, s.availability)));
const all = JSON.stringify(SERVICE_CATALOG);
check('no price, percentage or guarantee appears anywhere in the catalog', !/\$|\d+\s?%|guarantee/i.test(all));
check('no technology jargon in customer-facing copy', !/\b(API|LLM|prompt|model|chatbot|automation|workflow|pipeline|CRM)\b/i.test(all));
check('service keys are unique and URL-safe', new Set(SERVICE_CATALOG.map((s) => s.key)).size === 8 && SERVICE_CATALOG.every((s) => /^[a-z-]+$/.test(s.key)));
check('every request action selects a value the saved request accepts', SERVICE_CATALOG.every((s) => Object.hasOwn(LAUNCH_SERVICES, s.requestKey)));
check('every request link opens the request form with that service', SERVICE_CATALOG.every((s) => requestLink(s) === `/service-request?service=${s.key}`));

const worker = fs.readFileSync('public/sms-program/worker.js', 'utf8');
const mapSource = worker.match(/export const REQUESTED_SERVICES = (\{[\s\S]*?\});/)?.[1];
const formMap = mapSource ? Function(`return (${mapSource})`)() : {};
check('the request form knows every catalog service, with the same choice and name', SERVICE_CATALOG.every((s) => formMap[s.key]?.[0] === s.requestKey && formMap[s.key]?.[1] === s.name) && Object.keys(formMap).length === SERVICE_CATALOG.length);

const html = fs.readFileSync('public/sms-program/index.html', 'utf8');
const select = html.match(/<select id="service"[\s\S]*?<\/select>/)?.[0] || '';
const options = [...select.matchAll(/<option value="([a-z_]+)">[^<]+<\/option>/g)].map((m) => m[1]);
check('the form\'s service menu is well-formed and offers exactly the accepted choices', select.replace(/<option value="[a-z_]+">[^<]+<\/option>/g, '').replace(/<select[^>]*>|<\/select>/g, '') === '' && JSON.stringify([...options].sort()) === JSON.stringify(Object.keys(LAUNCH_SERVICES).sort()));

const routes = fs.readFileSync('src/App.jsx', 'utf8');
check('/services is routed and the old /solutions address still resolves', routes.includes('path="/services"') && routes.includes('path="/solutions"'));
const rewrites = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).rewrites || [];
check('/service-request is served', rewrites.some((r) => r.source === '/service-request'));

console.log(`\n${pass}/${pass + fail} service catalog checks passed (static checks — no page was rendered in a browser here)`);
process.exit(fail ? 1 : 0);
