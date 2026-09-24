// Production repository for api/_wave1Handlers.js — service-role PostgREST. Every read/write is
// filtered by organization_id in the query itself (defense in depth: the handlers also derive the org
// from the number/form token, never from client input). Unique constraints in
// supabase/wave1-pilot-migration-standalone.sql are what actually enforce de-duplication; this file
// only translates a 409 into "already existed". NOT exercised against a live database yet (the
// tables do not exist there) — see docs/NOVA_PILOT_ACCEPTANCE_RESULTS.md.
export function createPostgrestRepo({ url, key }) {
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const q = (v) => encodeURIComponent(v);
  const get = async (path) => { const r = await fetch(`${url}/rest/v1/${path}`, { headers: H }); if (!r.ok) throw new Error(`read failed ${r.status}: ${path.split('?')[0]}`); return r.json(); };
  const send = async (path, method, body, prefer = 'return=representation') => fetch(`${url}/rest/v1/${path}`, { method, headers: { ...H, Prefer: prefer }, body: JSON.stringify(body) });

  const repo = {
    async orgByNumber(num) {
      const [s] = await get(`wave1_org_settings?sms_number_ref=eq.${q(num)}&limit=1`);
      return s ? { organization_id: s.organization_id, settings: s } : null;
    },
    async orgByFormToken(token) { const [s] = await get(`wave1_org_settings?form_token=eq.${q(token)}&limit=1`); return s || null; },
    async getSettings(org) { const [s] = await get(`wave1_org_settings?organization_id=eq.${q(org)}&limit=1`); return s || null; },

    async recordSourceEvent(source, eventId, org, summary) {
      const r = await send('wave1_source_events?on_conflict=source,source_event_id', 'POST', { source, source_event_id: eventId, organization_id: org, payload_summary: summary || {} }, 'resolution=ignore-duplicates,return=representation');
      if (!r.ok) throw new Error(`source event write failed ${r.status}`);
      return (await r.json()).length > 0; // empty = the unique key already existed = duplicate
    },

    async upsertContactByPhone(org, phone, d = {}) {
      const find = async () => (await get(`crm_contacts?organization_id=eq.${q(org)}&phone_e164=eq.${q(phone)}&limit=1`))[0];
      let c = await find(); if (c) return c;
      const r = await send('crm_contacts', 'POST', { organization_id: org, phone_e164: phone, phone, name: d.name || 'Unknown', email: d.email || null, source: d.source || null });
      if (r.ok) return (await r.json())[0];
      c = await find(); if (c) return c; // lost a race to the unique (org, phone) index — use the winner
      throw new Error(`contact create failed ${r.status}`);
    },
    async createContact(org, d) { const r = await send('crm_contacts', 'POST', { organization_id: org, name: d.name || 'Unknown', email: d.email || null, source: d.source || null }); if (!r.ok) throw new Error(`contact create failed ${r.status}`); return (await r.json())[0]; },
    async updateContact(org, id, patch) { const r = await send(`crm_contacts?id=eq.${q(id)}&organization_id=eq.${q(org)}`, 'PATCH', patch); if (!r.ok) throw new Error(`contact update failed ${r.status}`); return (await r.json())[0]; },
    async getContact(org, id) { const [c] = await get(`crm_contacts?id=eq.${q(id)}&organization_id=eq.${q(org)}&limit=1`); return c || null; },

    async upsertConversation(org, contactId, channel) {
      const find = async () => (await get(`wave1_conversations?organization_id=eq.${q(org)}&contact_id=eq.${q(contactId)}&channel=eq.${q(channel)}&limit=1`))[0];
      let c = await find(); if (c) return c;
      const r = await send('wave1_conversations', 'POST', { organization_id: org, contact_id: contactId, channel });
      if (r.ok) return (await r.json())[0];
      c = await find(); if (c) return c;
      throw new Error(`conversation create failed ${r.status}`);
    },
    async getConversation(org, id) { const [c] = await get(`wave1_conversations?id=eq.${q(id)}&organization_id=eq.${q(org)}&limit=1`); return c || null; },
    async updateConversation(org, id, patch) { const r = await send(`wave1_conversations?id=eq.${q(id)}&organization_id=eq.${q(org)}`, 'PATCH', patch); if (!r.ok) throw new Error(`conversation update failed ${r.status}`); },

    async insertMessage(org, m) {
      const r = await send('wave1_messages', 'POST', { organization_id: org, ...m });
      if (r.ok) return (await r.json())[0];
      if (r.status === 409) return null; // unique (provider,provider_sid) or (org,idempotency_key): already recorded
      throw new Error(`message write failed ${r.status}`);
    },
    async messageExists(org, key) { const rows = await get(`wave1_messages?organization_id=eq.${q(org)}&idempotency_key=eq.${q(key)}&select=id&limit=1`); return rows.length > 0; },
    async updateMessage(org, id, patch) { const r = await send(`wave1_messages?id=eq.${q(id)}&organization_id=eq.${q(org)}`, 'PATCH', patch); if (!r.ok) throw new Error(`message update failed ${r.status}`); },

    async countRecentAutomated(org, contactId, sinceIso) {
      const convs = await get(`wave1_conversations?organization_id=eq.${q(org)}&contact_id=eq.${q(contactId)}&select=id`);
      if (!convs.length) return { count: 0, lastAt: null };
      const ids = convs.map((c) => c.id).join(',');
      const rows = await get(`wave1_messages?organization_id=eq.${q(org)}&automated=eq.true&status=in.(queued,provider_accepted,delivered,ambiguous)&conversation_id=in.(${ids})&created_at=gte.${q(sinceIso)}&order=created_at.desc`);
      return { count: rows.length, lastAt: rows[0]?.created_at || null };
    },

    async enqueueJob(job) {
      const r = await send('jobs?on_conflict=idempotency_key', 'POST', job, 'resolution=ignore-duplicates,return=representation');
      if (!r.ok) throw new Error(`enqueue failed ${r.status}`);
      return { deduped: (await r.json()).length === 0 };
    },
  };
  return repo;
}
