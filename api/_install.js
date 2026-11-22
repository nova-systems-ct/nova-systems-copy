// Installs a business on Nova from an install file (installs/<business>.json): its services and the
// prices the owner approved, the assistant's details, website chat, and a pay split proposal.
// Used by scripts/install_business.mjs. Every step is the same as saving it in the Business desk,
// with the same checks, so the file can be re-run safely.
//
// What it never does: switch the business live, switch texting or calls on, set a spending cap, or
// approve anything the file does not say the owner approved. A pay split is always saved as a
// proposal (not approved). Going live stays in the Business desk under "Switch on".
const one = async (db, table, filter) => (await db.select(table, filter, { limit: 1 }))[0] || null;
const ASSISTANT_FIELDS = ['business_name', 'agent_name', 'industry', 'greeting', 'services', 'service_area', 'tone', 'handoff_instructions', 'never_say', 'review_url', 'web_chat_enabled'];

// Checks an install file. Returns a list of problems (empty when it is good).
export function checkInstallFile(spec) {
  const problems = [];
  if (!spec || typeof spec !== 'object') return ['The install file is not a JSON object.'];
  if (!Array.isArray(spec.services) || !spec.services.length) problems.push('List at least one service.');
  const names = new Set();
  for (const [i, s] of (spec.services || []).entries()) {
    const at = `Service ${i + 1} (${s?.name || 'no name'})`;
    if (!s?.name || String(s.name).length > 120) problems.push(`${at}: needs a name of at most 120 characters.`);
    if (names.has(String(s?.name).toLowerCase())) problems.push(`${at}: the name is listed twice.`);
    names.add(String(s?.name).toLowerCase());
    for (const k of ['price_cents', 'deposit_cents']) if (s?.[k] != null && (!Number.isInteger(s[k]) || s[k] <= 0)) problems.push(`${at}: ${k} must be whole cents above 0, or null.`);
    if (s?.deposit_cents != null && s?.price_cents != null && s.deposit_cents > s.price_cents) problems.push(`${at}: the deposit cannot exceed the price.`);
    if (s?.price_approved === true && (s.price_cents == null || !s.approved_by)) problems.push(`${at}: an approved price needs the price and who approved it (approved_by).`);
    if (s?.terms_approved === true && (!s.terms_text || !s.approved_by)) problems.push(`${at}: approved agreement wording needs the wording and who approved it.`);
    if (s?.return_days != null && (!Number.isInteger(s.return_days) || s.return_days < 1 || s.return_days > 1825)) problems.push(`${at}: return_days is 1 to 1825, or null.`);
    if (s?.keywords != null && (!Array.isArray(s.keywords) || s.keywords.some((k) => typeof k !== 'string' || !k.trim() || k.length > 40))) problems.push(`${at}: keywords are short words a customer might use.`);
  }
  const a = spec.assistant;
  if (a != null) {
    if (typeof a !== 'object') problems.push('assistant must be an object.');
    else for (const k of Object.keys(a)) if (!ASSISTANT_FIELDS.includes(k)) problems.push(`assistant.${k} cannot be set from an install file (going live, texting, calls and spending are switched on in the Business desk).`);
    if (a?.review_url && !/^https:\/\/\S+$/.test(a.review_url)) problems.push('assistant.review_url must start with https://');
  }
  const sp = spec.split_proposal;
  if (sp != null) {
    const shares = Array.isArray(sp.shares) ? sp.shares : [];
    const total = shares.reduce((n, s) => n + Number(s?.percent || 0), 0);
    if (!shares.length || Math.abs(total - 100) > 1e-9 || shares.filter((s) => s?.to_worker === true).length > 1 || shares.some((s) => !s?.label)) problems.push('split_proposal: shares need labels, add up to exactly 100, and at most one share goes to the worker.');
    if (sp.approved === true) problems.push('split_proposal: an install file never approves a split; the owner approves it in the Business desk.');
  }
  return problems;
}

// What the install would change, without changing anything. Then apply() does exactly that.
export async function planInstall(db, orgId, spec) {
  const problems = checkInstallFile(spec);
  if (problems.length) return { ok: false, problems };
  const org = await one(db, 'organizations', { id: orgId });
  if (!org) return { ok: false, problems: ['No business with that organization id.'] };
  if (org.kind === 'nova_internal') return { ok: false, problems: ['That is Nova\'s own organization. Install files are for client businesses.'] };
  const steps = [];
  const have = await db.select('business_services', { organization_id: orgId }, { limit: 500 });
  const listed = new Set(spec.services.map((s) => s.name.toLowerCase()));
  for (const s of spec.services) {
    const row = { name: s.name, description: s.description || null, keywords: (s.keywords || []).map((k) => k.trim()), price_cents: s.price_cents ?? null, price_approved: s.price_approved === true && s.price_cents != null, deposit_cents: s.deposit_cents ?? null, terms_text: s.terms_text || null, terms_approved: s.terms_approved === true && !!s.terms_text, return_days: s.return_days ?? null, active: s.active !== false };
    const cur = have.find((h) => h.name.toLowerCase() === s.name.toLowerCase());
    const changed = cur ? Object.keys(row).filter((k) => JSON.stringify(cur[k] ?? null) !== JSON.stringify(row[k])) : null;
    if (!cur) steps.push({ kind: 'add_service', name: s.name, row });
    else if (changed.length) steps.push({ kind: 'update_service', name: s.name, id: cur.id, row, changed });
  }
  if (spec.switch_off_unlisted_services === true) for (const h of have) if (!listed.has(h.name.toLowerCase()) && h.active) steps.push({ kind: 'switch_off_service', name: h.name, id: h.id });
  if (spec.assistant) {
    const agent = await one(db, 'business_agents', { organization_id: orgId });
    const want = Object.fromEntries(ASSISTANT_FIELDS.filter((k) => k in spec.assistant).map((k) => [k, spec.assistant[k]]));
    if (!agent) steps.push({ kind: 'create_assistant', row: { business_name: org.name, agent_name: 'the assistant', tone: 'friendly', ...want } });
    else { const changed = Object.keys(want).filter((k) => JSON.stringify(agent[k] ?? null) !== JSON.stringify(want[k])); if (changed.length) steps.push({ kind: 'update_assistant', id: agent.id, row: Object.fromEntries(changed.map((k) => [k, want[k]])), changed }); }
  }
  if (spec.split_proposal) {
    const rule = await one(db, 'pay_split_rules', { organization_id: orgId });
    if (!rule) steps.push({ kind: 'propose_split', shares: spec.split_proposal.shares });
    else steps.push({ kind: 'keep_split', note: `A split is already saved (${rule.approved ? 'approved' : 'not approved'}); the install file leaves it as it is.` });
  }
  return { ok: true, organization: { id: org.id, name: org.name, slug: org.slug || null }, steps };
}

export async function applyInstall(db, orgId, plan, now = new Date()) {
  const done = [];
  for (const st of plan.steps) {
    if (st.kind === 'add_service') await db.insert('business_services', { organization_id: orgId, ...st.row });
    else if (st.kind === 'update_service') await db.update('business_services', { id: st.id, organization_id: orgId }, { ...st.row, updated_at: now.toISOString() });
    else if (st.kind === 'switch_off_service') await db.update('business_services', { id: st.id, organization_id: orgId }, { active: false, updated_at: now.toISOString() });
    // A new assistant is a draft with texting, calls and spending off, exactly like registration makes it.
    else if (st.kind === 'create_assistant') await db.insert('business_agents', { organization_id: orgId, ...st.row, sms_enabled: false, voice_enabled: false, monthly_spend_cap_cents: null, status: 'draft' });
    else if (st.kind === 'update_assistant') await db.update('business_agents', { id: st.id, organization_id: orgId }, { ...st.row, updated_at: now.toISOString() });
    else if (st.kind === 'propose_split') await db.insert('pay_split_rules', { organization_id: orgId, shares: st.shares.map((s) => ({ label: s.label, percent: Number(s.percent), to_worker: s.to_worker === true })), approved: false, approved_by: null, updated_at: now.toISOString() });
    else continue;
    done.push(st);
  }
  return done;
}

export function describeStep(st) {
  const money = (c) => (c == null ? 'no price' : `$${(c / 100).toFixed(2)}`);
  if (st.kind === 'add_service') return `Add "${st.name}": ${money(st.row.price_cents)}${st.row.price_approved ? ' (approved)' : ' (not approved: customers are told the team will price it)'}${st.row.active ? '' : ', switched off'}`;
  if (st.kind === 'update_service') return `Update "${st.name}": ${st.changed.join(', ')}`;
  if (st.kind === 'switch_off_service') return `Switch off "${st.name}" (not in the install file; kept, not deleted)`;
  if (st.kind === 'create_assistant') return 'Create the assistant as a draft (texting, calls and spending off)';
  if (st.kind === 'update_assistant') return `Update the assistant: ${st.changed.join(', ')}`;
  if (st.kind === 'propose_split') return `Propose the pay split ${st.shares.map((s) => `${s.label} ${s.percent}%`).join(' / ')} (not approved; the owner approves it in Team & pay)`;
  return st.note || st.kind;
}
