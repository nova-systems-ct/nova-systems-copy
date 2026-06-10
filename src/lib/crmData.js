// Shared data layer for CRM — uses localStorage

const GOLD = "#D4A030";

// ── SEED DATA ──────────────────────────────────────────────────────────────────

export const SEED_CLIENTS = [
  {
    id: "client-mars-hill",
    name: "Mars Hill Apologetics",
    owner_name: "John Leonetti",
    industry: "Religious / Ministry",
    email: "defender315@msn.com",
    phone: "",
    website: "marshillapologetics.com",
    domain: "marshillapologetics.com",
    services: ["Custom Website", "Supabase CMS", "Admin Dashboard", "Email via Resend"],
    monthly_rate: 0,
    contract_start: "2024-01-01",
    status: "active",
    notes: "Pro bono / portfolio client. John is the owner and primary contact.",
    created_at: new Date("2024-01-01").toISOString(),
  },
];

export const SEED_LEADS = [
  {
    id: "lead-flow-barbershop",
    name: "Flow Barbershop",
    contact_name: "Owner (unknown)",
    industry: "Barbershop",
    email: "",
    phone: "",
    stage: "proposal_sent",
    potential_value: "$1,500 startup + $1,000/mo",
    what_they_want: "Social media content, website presence",
    what_they_need: "Brand identity, consistent content creation, local SEO",
    next_steps: "Meeting Thursday June 12 at Bread of Heaven, 4pm",
    meeting_date: "2026-06-12T16:00:00",
    notes: "Very interested. Proposal already sent. Follow up after meeting.",
    created_at: new Date().toISOString(),
  },
  {
    id: "lead-angelinas-pizza",
    name: "Angelina's Pizza",
    contact_name: "CEO (in surgery)",
    industry: "Restaurant",
    email: "",
    phone: "",
    stage: "new_contact",
    potential_value: "$997/mo",
    what_they_want: "Online ordering, social media, website",
    what_they_need: "Full digital presence overhaul",
    next_steps: "Call back next week when CEO is recovered",
    meeting_date: "",
    notes: "CEO is currently recovering from surgery. Be patient and respectful.",
    created_at: new Date().toISOString(),
  },
  {
    id: "lead-trio-upward-bound",
    name: "TRIO Upward Bound",
    contact_name: "Matt (last name unknown)",
    industry: "Education",
    email: "",
    phone: "",
    stage: "demo_shown",
    potential_value: "$150/mo after pilot",
    what_they_want: "Student portal, admin dashboard, data tracking",
    what_they_need: "Custom web app for program management",
    next_steps: "Meeting tomorrow 12pm",
    meeting_date: new Date(Date.now() + 86400000).toISOString().slice(0,16),
    notes: "Very engaged during demo. Pilot program likely. Matt is the program coordinator.",
    created_at: new Date().toISOString(),
  },
  {
    id: "lead-wave-program",
    name: "WAVE Program",
    contact_name: "Tracy Mahar",
    industry: "Education",
    email: "",
    phone: "",
    stage: "proposal_sent",
    potential_value: "$200/mo after pilot",
    what_they_want: "Program website, participant tracking",
    what_they_need: "Simple CMS with admin panel",
    next_steps: "Follow up on proposal",
    meeting_date: "",
    notes: "Tracy is very organized. Proposal is clean and targeted.",
    created_at: new Date().toISOString(),
  },
  {
    id: "lead-ct-state-library",
    name: "CT State Library",
    contact_name: "Isaac's supervisor",
    industry: "Education",
    email: "",
    phone: "",
    stage: "negotiating",
    potential_value: "Portfolio only",
    what_they_want: "Digital resource portal",
    what_they_need: "Modernized web presence and internal tools",
    next_steps: "Internal approval process. Stay in contact.",
    meeting_date: "",
    notes: "This is a relationship deal. Portfolio value over monetary. Patience required.",
    created_at: new Date().toISOString(),
  },
];

// ── GETTERS / SETTERS ──────────────────────────────────────────────────────────

function getStore(key, seed) {
  const raw = localStorage.getItem(key);
  if (raw) return JSON.parse(raw);
  if (seed) {
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  return [];
}
function setStore(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Clients
export function getClients() { return getStore("nova_crm_clients", SEED_CLIENTS); }
export function setClients(d) { setStore("nova_crm_clients", d); }
export function getClient(id) { return getClients().find((c) => c.id === id); }
export function upsertClient(client) {
  const all = getClients();
  const idx = all.findIndex((c) => c.id === client.id);
  if (idx >= 0) all[idx] = client; else all.unshift(client);
  setClients(all);
}

// Leads
export function getLeads() { return getStore("nova_crm_leads", SEED_LEADS); }
export function setLeads(d) { setStore("nova_crm_leads", d); }
export function getLead(id) { return getLeads().find((l) => l.id === id); }
export function upsertLead(lead) {
  const all = getLeads();
  const idx = all.findIndex((l) => l.id === lead.id);
  if (idx >= 0) all[idx] = lead; else all.unshift(lead);
  setLeads(all);
}

// Invoices
export function getInvoices() { return getStore("nova_crm_invoices", []); }
export function setInvoices(d) { setStore("nova_crm_invoices", d); }
export function upsertInvoice(inv) {
  const all = getInvoices();
  const idx = all.findIndex((i) => i.id === inv.id);
  if (idx >= 0) all[idx] = inv; else all.unshift(inv);
  setInvoices(all);
}

// Documents
export function getDocuments() { return getStore("nova_crm_documents", []); }
export function setDocuments(d) { setStore("nova_crm_documents", d); }
export function upsertDocument(doc) {
  const all = getDocuments();
  const idx = all.findIndex((d) => d.id === doc.id);
  if (idx >= 0) all[idx] = doc; else all.unshift(doc);
  setDocuments(all);
}

// Newsletter
export function getSubscribers() { return getStore("nova_newsletter_subscribers", []); }
export function getSentNewsletters() { return getStore("nova_newsletter_sent", []); }
export function addSentNewsletter(n) {
  const all = getSentNewsletters();
  all.unshift(n);
  setStore("nova_newsletter_sent", all);
}

// Activity log
export function logActivity(message) {
  const all = getStore("nova_crm_activity", []);
  all.unshift({ id: Date.now().toString(), message, time: new Date().toISOString() });
  setStore("nova_crm_activity", all.slice(0, 50));
}
export function getActivity() { return getStore("nova_crm_activity", []); }

// Stage labels
export const STAGE_LABELS = {
  new_contact:   "New Contact",
  proposal_sent: "Proposal Sent",
  demo_shown:    "Demo Shown",
  negotiating:   "Negotiating",
  closed_won:    "Closed Won",
  closed_lost:   "Closed Lost",
};

export const STAGE_COLORS = {
  new_contact:   { bg: `${GOLD}15`, border: `${GOLD}35`, color: GOLD },
  proposal_sent: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", color: "#60a5fa" },
  demo_shown:    { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)", color: "#a78bfa" },
  negotiating:   { bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.35)", color: "#fb923c" },
  closed_won:    { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)", color: "#4ade80" },
  closed_lost:   { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.3)", color: "#f87171" },
};