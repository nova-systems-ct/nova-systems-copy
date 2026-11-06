// Executable worker capabilities (repair brief §7). A worker can be registered ONLY for a capability listed here, and
// each entry names the real code that does the work (queued job types run by worker/index.mjs, or an owner-triggered API
// operation). Pausing a registered worker stops its job types from being claimed (they wait in the queue, nothing is
// lost) and refuses its on-demand operation. No decorative agents: titles such as CTO/CFO with no implementation are
// not listed. Readiness checks report configuration by NAME only, never values.
export const CAPABILITIES = [
  { key: 'channel_inbox', name: 'Connected-channel conversation worker', role: 'Front desk',
    does: 'Processes signed Instagram, Facebook Messenger and WhatsApp inquiries through the approved booking workflow. Keeps each business and identity scoped, honors takeover and opt-outs, and records blocked or uncertain sends. Provider authorization and acceptance remain required.',
    job_types: ['channel_conversation_turn', 'channel_comment_reply'], code: 'api/_channels/service.js, api/_channels/delivery.js' },
  { key: 'intake_booking', name: 'Inquiry and booking worker', role: 'Front desk',
    does: 'Answers each web-form or text inquiry within the business rules: asks for missing details, matches an approved service, offers real calendar times, sends the agreement, confirms the booking, and hands anything unsupported to a person.',
    job_types: ['ops_conversation_turn'], code: 'api/_ops/service.js (handleInboundTurn)' },
  { key: 'followup_revive', name: 'Follow-up and Revive worker', role: 'Follow-up',
    does: 'Sends scheduled follow-ups and Revive messages to eligible customers only, honoring consent, suppression and stop-on-reply.',
    job_types: ['ops_followup_send', 'ops_campaign_send'], code: 'api/_ops/service.js (follow-ups), api/_ops/harvest.js' },
  { key: 'demand_outreach', name: 'Demand outreach worker', role: 'Demand',
    does: 'Tracks owner-approved acquisition campaigns, prospects and outcomes. Contact is recorded manually; an automated Demand sender is not connected. Recovery messages belong to the Revive worker.',
    job_types: [], on_demand: 'Owner-operated Demand campaign tools', code: 'api/_ops/demand.js' },
  { key: 'monitoring', name: 'Monitoring worker', role: 'Operations',
    does: 'Every 5 minutes checks the queue, stuck jobs and failed sends, and opens alerts for the owner.',
    job_types: ['ops_sentry_sweep','nova_monitoring_review'], code: 'api/_ops/sentry.js' },
  { key: 'reporting', name: 'Reporting worker', role: 'Operations',
    does: 'Every hour records the business scoreboard from real records and checks overdue work items.',
    job_types: ['ops_scoreboard_tick', 'hierarchy_work_item_check','nova_reporting_snapshot'], code: 'api/_ops/reports.js, api/_hierarchy/workitems.js' },
  { key: 'audit_review', name: 'Audit evidence worker', role: 'Nova Audit',
    does: 'Researches a business from five details: its website (robots.txt respected), public email records, its public map listing and comparable nearby businesses. Records sourced evidence and proposes findings for your review. It never approves anything.',
    job_types: ['audit_research', 'audit_diagnostic_task', 'audit_contact_dispatch', 'audit_contact_observe'], on_demand: 'audit research', code: 'api/_researchRun.js, api/_publicResearch.js' },
  { key: 'marketing_publisher', name: 'Marketing publishing worker', role: 'Growth',
    does: 'Publishes owner-approved marketing items and sends approved email sequence steps.',
    job_types: ['marketing_publish', 'email_sequence_step'], code: 'worker/index.mjs, worker/emailSequenceEngine.mjs' },
  // Executive roles (owner brief 2026-10-30 §11): each title maps to a handler in api/_hierarchy/roles.js and does work
  // only while registered and active. None sends messages, moves money or invents financial data.
  { key: 'ceo_twin', name: 'Isaac’s decision assistant', role: 'Executive',
    does: 'Reviews the latest saved executive results, owner priorities and blockers, then saves a decision brief with evidence. Optional model reasoning is advisory and off by default. Cannot impersonate Isaac or make commitments.',
    job_types: ['role_ceo_brief'], code: 'api/_hierarchy/roles.js (ceo_twin), api/_hierarchy/playbooks.js' },
  { key: 'executive_assistant', name: "Owner's executive assistant", role: 'Executive',
    does: 'Every hour prepares the owner brief: escalated conversations, spending decisions, approvals, results to review, overdue and blocked work, in priority order with what each needs. Escalates anything waiting longer than the owner\'s limit (in the app).',
    job_types: ['role_ea_brief'], code: 'api/_hierarchy/roles.js (executive_assistant), api/_hierarchy/roleRules.js (eaPrioritize)' },
  { key: 'coo', name: 'COO worker', role: 'Executive',
    does: 'Every 30 minutes checks workflow health: retries failed maintenance jobs once (never anything that sends, charges or books), assigns unassigned role tasks, blocks work whose prerequisites are unfinished, flags completed work without evidence, and reports each worker\'s load.',
    job_types: ['role_coo_check'], code: 'api/_hierarchy/roles.js (coo), api/_hierarchy/roleRules.js (cooRetry)' },
  { key: 'cfo', name: 'CFO worker', role: 'Executive',
    does: 'Checks each proposed expense against the latest balance you entered (and its date), money already committed and your spending policy; approves only within your automatic limit and monthly budget, otherwise sends it to you with a recommendation. Without a current balance, funds are reported as unknown. Never connects to a bank or moves money.',
    job_types: ['role_cfo_review'], code: 'api/_hierarchy/roles.js (cfo), api/_hierarchy/roleRules.js (cfoDecision)' },
  { key: 'cmo', name: 'CMO worker', role: 'Executive',
    does: 'Every 6 hours finds inquiries stalled for 7+ days and proposes a Revive campaign, reports campaign results from recorded sends, replies and bookings, and proposes your test budget (only if you set one) to the CFO. Proposes; never sends.',
    job_types: ['role_cmo_review'], code: 'api/_hierarchy/roles.js (cmo), api/_hierarchy/roleRules.js (cmoProposals)' },
];
export const capabilityByKey = (k) => CAPABILITIES.find((c) => c.key === k) || null;
// 'inactive' means retired: no longer registered, so it holds nothing (the capability runs as if never registered).
export const PAUSED_STATES = new Set(['suspended', 'draft', 'onboarding', 'training']);

// Job types whose registered worker is not allowed to act right now. Unregistered capabilities keep running as before.
export function heldJobTypes(workers = []) {
  const held = new Set();
  for (const w of workers) {
    const cap = capabilityByKey(w.capability_key);
    if (cap && PAUSED_STATES.has(w.status)) for (const t of cap.job_types) held.add(t);
  }
  // a type is held only if NO active registered worker covers it
  for (const w of workers) { const cap = capabilityByKey(w.capability_key); if (cap && ['active', 'restricted'].includes(w.status)) for (const t of cap.job_types) held.delete(t); }
  return [...held];
}

// Truthful readiness from configuration names and a few database facts. Returns [{ label, ok, note }].
export function readinessFor(key, { env = process.env, facts = {} } = {}) {
  const sms = env.WAVE1_SEND_ENABLED === 'true' && !!env.TWILIO_ACCOUNT_SID && !!env.TWILIO_AUTH_TOKEN;
  const email = (env.SALES_EMAIL_MODE || 'dry_run') === 'live' && !!env.RESEND_API_KEY;
  const c = (label, ok, note) => ({ label, ok: !!ok, note });
  const execution = () => c('Recorded role execution', !!facts.lastCompletedAt, facts.lastCompletedAt ? `Completed ${facts.lastCompletedAt}. This records a result, not continuous availability.` : 'No completed role run recorded in the last seven days.');
  switch (key) {
    case 'channel_inbox': return [
      c('Signed provider callbacks configured', !!env.NOVA_META_APP_SECRET && !!env.NOVA_META_VERIFY_TOKEN, 'Configure the owned Meta app and its exact authorized business accounts in Connected channels.'),
      c('Real sending authorized', env.NOVA_SPENDING_LOCK === 'disabled' && env.NOVA_CHANNEL_SEND_ENABLED === 'true', 'Sending remains locked until costs, permissions and the owned-account test are approved.'),
      c('Connected-provider acceptance', false, 'Code tests do not establish provider acceptance. Record the exact account, permissions, device result and provider receipt before launch.'),
    ];
    case 'intake_booking': return [
      c('Business hours and an approved service', facts.hasServices, facts.hasServices ? 'Configured' : 'Add hours and at least one service in Operations → Settings'),
      c('Escalation contact named', facts.hasEscalation, facts.hasEscalation ? 'Configured' : 'Name who receives unsupported requests (Operations → Settings)'),
      c('Text messages sent for real', sms, sms ? 'Live' : 'Dry run: replies are recorded, not sent (Twilio number and A2P registration needed)'),
      c('Email confirmations sent for real', email, email ? 'Live' : 'Dry run: confirmations are recorded, not sent (Resend domain verification needed)'),
    ];
    case 'followup_revive': return [c('Text messages sent for real', sms, sms ? 'Live' : 'Dry run until Twilio is configured')];
    case 'demand_outreach': return [c('Automated acquisition sender', false, 'Not connected. Demand currently records owner-approved campaigns, manual contacts and outcomes; Revive handles recovery messages separately.')];
    case 'monitoring': return [c('Recent monitoring result', !!facts.lastCompletedAt && Date.now()-Date.parse(facts.lastCompletedAt)<20*60000, facts.lastCompletedAt ? `Last completed ${facts.lastCompletedAt}; checks run through the job queue. Alerts appear in the app.` : 'No completed check yet. Register the worker and confirm the hosted schedule runs.')];
    case 'reporting': return [c('Recent scoreboard result', !!facts.lastCompletedAt && Date.now()-Date.parse(facts.lastCompletedAt)<2*3600000, facts.lastCompletedAt ? `Last completed ${facts.lastCompletedAt}; results use saved business records.` : 'No completed scoreboard yet. Register the worker and confirm the hosted schedule runs.')];
    case 'audit_review': return [c('Internet access from the server', true, 'Reads public pages only; no paid service')];
    case 'marketing_publisher': return [c('A connected publishing channel', false, 'No social account or publishing channel is connected yet'), c('Email sent for real', email, email ? 'Live' : 'Dry run')];
    case 'ceo_twin': case 'executive_assistant': case 'coo': case 'cmo': return [execution()];
    case 'cfo': return [execution(), c('A current balance to check against', facts.balanceAgeDays != null && facts.balanceAgeDays <= 7, facts.balanceAgeDays == null ? 'None entered: funds are reported as unknown (no bank is connected)' : `Entered ${facts.balanceAgeDays} day(s) ago`)];
    default: return [];
  }
}
