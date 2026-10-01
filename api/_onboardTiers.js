// Server-side source of truth for the legacy /onboard tiers. The prices are the ones already
// published on src/pages/Onboard.jsx (not new pricing). The browser only ever sends a tier id —
// the name and amount charged are always read from here, never from the request.
export const ONBOARD_TIERS = {
  website: { name: 'Tier 1 — Website Only', price: 500 },
  social: { name: 'Tier 2 — Social Media Only', price: 1500 },
  'website-social': { name: 'Tier 3 — Website + Social Media', price: 2500 },
  'full-ai': { name: 'Tier 4 — Full System + AI Agent', price: 3500 },
  everything: { name: 'Tier 5 — Everything', price: 5000 },
  partner: { name: 'Partner Program', price: 1000 },
};

// Whole dollars → integer cents, the unit every Stripe amount comparison uses.
export const dollarsToCents = (n) => Math.round(Number(n) * 100);
