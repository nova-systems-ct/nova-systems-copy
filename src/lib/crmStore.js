// Nova Systems CRM — localStorage data layer with seeded data

const FLOW_BARBERSHOP = {
  id: 'client-flow-barbershop',
  name: 'Flow Barbershop',
  owner_name: 'Owner',
  industry: 'Barbershop',
  email: '',
  phone: '',
  website: '',
  domain: '',
  services: ['Social Media Management'],
  monthly_rate: 600,
  contract_start: '2026-06-12',
  status: 'active',
  hosting_status: 'N/A',
  last_updated: '2026-06-12',
  notes: 'Verbal yes given at June 12 meeting at Bread of Heaven, 141 Grand St, Waterbury CT. $600/mo social media management — Instagram + Facebook. Send formal contract.',
  created_at: '2026-06-12T00:00:00Z',
};

const TRIO_UPWARD_BOUND = {
  id: 'client-trio-upward-bound',
  name: 'TRIO Upward Bound',
  owner_name: 'Matt (Program Coordinator)',
  industry: 'Education / Government',
  email: '',
  phone: '',
  website: '',
  domain: '',
  services: ['Student Management System', 'Reporting Dashboard', 'Admin Portal'],
  monthly_rate: 0,
  contract_start: '2026-06-01',
  status: 'active',
  hosting_status: 'Pilot',
  last_updated: '2026-06-10',
  notes: 'Free summer pilot. $1,000/mo target after summer for 4 schools. Demo shown June 10. Matt is the program coordinator at CT State NVCC.',
  created_at: '2026-06-01T00:00:00Z',
};

const MARS_HILL = {
  id: 'client-mars-hill',
  name: 'Mars Hill Apologetics',
  owner_name: 'John Leonetti',
  industry: 'Religious / Ministry',
  email: 'defender315@msn.com',
  phone: '',
  website: 'https://marshillapologetics.com',
  domain: 'marshillapologetics.com',
  services: ['Custom Website', 'Supabase CMS', 'Admin Dashboard', 'Email via Resend'],
  monthly_rate: 0,
  contract_start: '2024-01-01',
  status: 'active',
  hosting_status: 'Live',
  last_updated: '2025-06-01',
  notes: 'Pro bono / portfolio client. John Leonetti is the founder of Mars Hill Apologetics ministry in CT.',
  created_at: '2024-01-01T00:00:00Z',
};

const SEED_LEADS = [
  {
    id: 'lead-la-cazuela',
    name: 'La Cazuela',
    contact_name: 'Owner',
    industry: 'Restaurant',
    email: '',
    phone: '',
    stage: 'New Contact',
    potential_value: '$1,500/mo',
    what_they_want: 'Full digital presence — website, social media, AI call agent',
    what_they_need: 'Website for 2 locations, social media management, AI phone answering agent',
    next_steps: 'Discovery call — pitch full digital package at $1,500/mo',
    meeting_date: null,
    notes: '2 locations. High value lead at $1,500/mo. Package: website + social media + AI call agent. Initial outreach stage.',
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 'lead-angelinas-pizza',
    name: "Angelina's Pizza",
    contact_name: 'CEO (in surgery)',
    industry: 'Restaurant',
    email: '',
    phone: '',
    stage: 'New Contact',
    potential_value: '$997/mo',
    what_they_want: 'Website and online ordering presence',
    what_they_need: 'Website, SEO, social media management, online ordering',
    next_steps: 'Call back next week — CEO recovering from surgery',
    meeting_date: null,
    notes: 'CEO is in surgery. Follow up next week. High potential monthly retainer.',
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 'lead-wave-program',
    name: 'WAVE Program',
    contact_name: 'Tracy Mahar',
    industry: 'Education',
    email: '',
    phone: '',
    stage: 'Proposal Sent',
    potential_value: '$200/mo after pilot',
    what_they_want: 'Student engagement and communication platform',
    what_they_need: 'Custom web platform, attendance tracking, parent communication',
    next_steps: "Waiting on Tracy's response to proposal",
    meeting_date: null,
    notes: 'Tracy Mahar is the program director. Proposal sent, awaiting response.',
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 'lead-ct-state-library',
    name: 'CT State Library',
    contact_name: "Isaac's supervisor",
    industry: 'Education',
    email: '',
    phone: '',
    stage: 'Negotiating',
    potential_value: 'Portfolio only',
    what_they_want: 'Digital tools for library operations',
    what_they_need: 'Custom management tools, reporting dashboard',
    next_steps: 'Ongoing negotiation — goodwill/portfolio opportunity',
    meeting_date: null,
    notes: "Isaac's supervisor at CT State. Portfolio and goodwill opportunity.",
    created_at: '2026-06-01T00:00:00Z',
  },
];

const SEED_ACTIVITY = [
  { id: 'a1', type: 'client', text: 'Mars Hill Apologetics — Active client, website live', ts: '2024-01-01T00:00:00Z' },
  { id: 'a8', type: 'client', text: 'Flow Barbershop — CLOSED! $600/mo social media, contract being sent', ts: '2026-06-12T17:00:00Z' },
  { id: 'a9', type: 'client', text: 'TRIO Upward Bound — Pilot started, $1,000/mo target after summer', ts: '2026-06-10T12:00:00Z' },
  { id: 'a7', type: 'lead', text: 'La Cazuela added — 2 locations, $1,500/mo target (website + social + AI)', ts: '2026-06-01T09:06:00Z' },
  { id: 'a3', type: 'lead', text: "Angelina's Pizza added — CEO in surgery, follow up next week", ts: '2026-06-01T09:05:00Z' },
  { id: 'a4', type: 'lead', text: 'TRIO Upward Bound added — Demo Shown', ts: '2026-06-01T09:10:00Z' },
  { id: 'a5', type: 'lead', text: 'WAVE Program added — Proposal Sent', ts: '2026-06-01T09:15:00Z' },
  { id: 'a6', type: 'lead', text: 'CT State Library added — Negotiating', ts: '2026-06-01T09:20:00Z' },
];

function get(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function set(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function init() {
  if (localStorage.getItem('nova_crm_v4')) return;
  set('nova_clients', [MARS_HILL, FLOW_BARBERSHOP, TRIO_UPWARD_BOUND]);
  set('nova_leads', SEED_LEADS);
  set('nova_invoices', []);
  set('nova_crm_docs', []);
  set('nova_nl_subscribers', []);
  set('nova_nl_sent', []);
  set('nova_crm_activity', SEED_ACTIVITY);
  localStorage.setItem('nova_crm_v4', '1');
}
init();

// ── CLIENTS ──────────────────────────────────────────────────────────────────
export const getClients = () => get('nova_clients', [MARS_HILL]);
export const getClient = (id) => getClients().find(c => c.id === id) || null;
export function addClient(data) {
  const c = { ...data, id: `client-${Date.now()}`, created_at: new Date().toISOString() };
  set('nova_clients', [c, ...getClients()]);
  addActivity('client', `${c.name} added as client`);
  return c;
}
export function updateClient(id, patch) {
  set('nova_clients', getClients().map(c => c.id === id ? { ...c, ...patch } : c));
}

// ── LEADS ─────────────────────────────────────────────────────────────────────
export const getLeads = () => get('nova_leads', SEED_LEADS);
export const getLead = (id) => getLeads().find(l => l.id === id) || null;
export function addLead(data) {
  const l = { ...data, id: `lead-${Date.now()}`, created_at: new Date().toISOString() };
  set('nova_leads', [l, ...getLeads()]);
  addActivity('lead', `${l.name} added — ${l.stage}`);
  return l;
}
export function updateLead(id, patch) {
  set('nova_leads', getLeads().map(l => l.id === id ? { ...l, ...patch } : l));
}

// ── INVOICES ──────────────────────────────────────────────────────────────────
export const getInvoices = (clientId) => get('nova_invoices', []).filter(i => !clientId || i.client_id === clientId);
export function addInvoice(data) {
  const inv = { ...data, id: `inv-${Date.now()}`, created_at: new Date().toISOString() };
  set('nova_invoices', [inv, ...get('nova_invoices', [])]);
  return inv;
}
export function updateInvoice(id, patch) {
  set('nova_invoices', get('nova_invoices', []).map(i => i.id === id ? { ...i, ...patch } : i));
}

// ── DOCUMENTS ─────────────────────────────────────────────────────────────────
export const getDocuments = (filter) => {
  const docs = get('nova_crm_docs', []);
  if (!filter) return docs;
  return docs.filter(d => (filter.client_id && d.client_id === filter.client_id) || (filter.lead_id && d.lead_id === filter.lead_id));
};
export function saveDocument(data) {
  const d = { ...data, id: `doc-${Date.now()}`, created_at: new Date().toISOString() };
  set('nova_crm_docs', [d, ...get('nova_crm_docs', [])]);
  addActivity('document', `${d.type} generated for ${d.entity_name || 'client'}`);
  return d;
}

// ── NEWSLETTER ────────────────────────────────────────────────────────────────
export const getSubscribers = () => get('nova_nl_subscribers', []);
export function addSubscriber(email) {
  const subs = getSubscribers();
  if (subs.find(s => s.email.toLowerCase() === email.toLowerCase())) return false;
  set('nova_nl_subscribers', [{ id: `sub-${Date.now()}`, email, created_at: new Date().toISOString() }, ...subs]);
  return true;
}
export const getSentNewsletters = () => get('nova_nl_sent', []);
export function saveSentNewsletter(data) {
  set('nova_nl_sent', [{ ...data, id: `nl-${Date.now()}`, sent_at: new Date().toISOString() }, ...getSentNewsletters()]);
}

// ── ACTIVITY ──────────────────────────────────────────────────────────────────
export const getActivity = () => get('nova_crm_activity', []);
export function addActivity(type, text) {
  const entries = [{ id: `act-${Date.now()}`, type, text, ts: new Date().toISOString() }, ...getActivity()];
  set('nova_crm_activity', entries.slice(0, 50));
}
