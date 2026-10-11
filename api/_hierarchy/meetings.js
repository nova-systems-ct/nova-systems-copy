// Nova organizational hierarchy — Meeting Engine: "Meet Now", the Committee Room, a persisted
// transcript, an evidence board, action items with DRIs/deadlines, and the Incident Room (an
// incident is a meeting with meeting_type='incident' — no separate mechanism). Same plumbing as
// registry.js/governance.js/workitems.js. Tables are named committee_meeting* — a different
// `meetings` table already exists for the client-facing "book a meeting" feature.
import { sanitize } from '../_sanitize.js';
import { rateLimit } from '../_rateLimit.js';
import { dbGet, dbOne, dbInsert, dbPatch, enc, nowIso, audit, bad, wrap, requirePerm } from '../_sales/core.js';
import { meetingParticipantAvailability } from './rules.js';

// Real, honest participant loading: every position in scope (a committee's org unit, or the
// portfolio-wide leadership seats if no committee is given) is included with its REAL current
// availability — reserved/vacant/unavailable seats are never dropped from the room.
async function loadParticipants(orgUnitId) {
  // PostgREST filters cannot embed a subquery, so resolve the default "leadership seats" scope
  // (the executive-operations org unit) with a real lookup first when no specific committee is given.
  const scopeUnitId = orgUnitId || (await dbOne("org_units?portfolio_entity_id=is.null&key=eq.executive-operations&select=id"))?.id;
  const positions = scopeUnitId ? await dbGet(`positions?org_unit_id=eq.${enc(scopeUnitId)}&select=*`) : [];
  const switches = await dbGet('kill_switches?engaged=eq.true&select=scope_type,scope_id');
  const blockedWorkerIds = new Set(switches.filter((s) => s.scope_type === 'worker').map((s) => s.scope_id));
  const globalBlocked = switches.some((s) => s.scope_type === 'global');
  const out = [];
  for (const position of positions) {
    const assignment = await dbOne(`executive_assignments?position_id=eq.${enc(position.id)}&unassigned_at=is.null&select=*`);
    const fillType = assignment?.fill_type || 'vacant';
    const worker = assignment?.worker_id ? await dbOne(`workers?id=eq.${enc(assignment.worker_id)}&select=*`) : null;
    const workerBlocked = globalBlocked || (worker && blockedWorkerIds.has(worker.id));
    const availability = meetingParticipantAvailability({ position, fillType, worker, workerBlocked });
    out.push({ position_id: position.id, worker_id: worker?.id || null, label: worker?.display_name || position.title, availability, note: position.is_reserved ? position.reserved_reason : null });
  }
  return out;
}

export const handleMeetings = wrap(async (req, res, op) => {
  const b = req.body || {};
  const need = (m) => { if (req.method !== m) { bad(res, 405, 'Method not allowed'); return false; } return true; };
  const ownerOps = ['meet-now', 'open-incident', 'update-incident-details', 'close-meeting', 'add-transcript-entry', 'add-meeting-evidence', 'create-action-item', 'complete-action-item', 'cancel-action-item'];
  const caller = await requirePerm(req, res, ownerOps.includes(op) ? 'command.owner' : 'command.view'); if (!caller) return;
  if (!rateLimit(req, res, 120, 60_000)) return;

  if (op === 'meetings') return res.status(200).json(await dbGet('committee_meetings?order=opened_at.desc&select=*'));
  if (op === 'meeting') {
    const id = sanitize(req.query?.id, 60); const meeting = await dbOne(`committee_meetings?id=eq.${enc(id)}&select=*`); if (!meeting) return bad(res, 404, 'Not found');
    const [participants, transcript, evidence, actionItems] = await Promise.all([
      dbGet(`committee_meeting_participants?meeting_id=eq.${enc(id)}&select=*`),
      dbGet(`committee_meeting_transcript_entries?meeting_id=eq.${enc(id)}&order=created_at.asc&select=*`),
      dbGet(`committee_meeting_evidence?meeting_id=eq.${enc(id)}&order=created_at.asc&select=*`),
      dbGet(`committee_meeting_action_items?meeting_id=eq.${enc(id)}&order=created_at.asc&select=*`),
    ]);
    return res.status(200).json({ meeting, participants, transcript, evidence, action_items: actionItems });
  }

  if (op === 'meet-now' || op === 'open-incident') {
    if (!need('POST')) return;
    const title = sanitize(b.title, 300); if (!title) return bad(res, 422, 'title is required.');
    const orgUnitId = sanitize(b.committee_org_unit_id, 60) || null;
    // Real agenda generation: unresolved action items from this committee's past meetings, plus open escalations —
    // never a fabricated agenda. A brand-new committee with no history gets an honest "No prior open items."
    const priorMeetingIds = (await dbGet(`committee_meetings?committee_org_unit_id=${orgUnitId ? `eq.${enc(orgUnitId)}` : 'is.null'}&select=id`)).map((m) => m.id);
    const unresolvedActions = priorMeetingIds.length ? await dbGet(`committee_meeting_action_items?meeting_id=in.(${priorMeetingIds.map(enc).join(',')})&status=eq.open&select=id,description`) : [];
    const openEscalations = await dbGet('escalations?status=in.(open,routed)&select=id,subject_type,reason');
    const agenda = [
      ...unresolvedActions.map((a) => ({ type: 'unresolved_action_item', ref_id: a.id, text: a.description })),
      ...openEscalations.map((e) => ({ type: 'open_escalation', ref_id: e.id, text: `${e.subject_type}: ${e.reason}` })),
      { type: 'new_business', text: sanitize(b.reason, 1000) || 'No stated reason given.' },
    ];
    const incidentDetails = op === 'open-incident' ? {
      severity: sanitize(b.severity, 20) || 'unknown',
      detection: sanitize(b.detection, 2000) || null,
      affected_systems: sanitize(b.affected_systems, 1000) || null,
      containment: null, recovery: null,
    } : null;
    const ins = await dbInsert('committee_meetings', { committee_org_unit_id: orgUnitId, portfolio_entity_id: sanitize(b.portfolio_entity_id, 60) || null, title, meeting_type: op === 'open-incident' ? 'incident' : 'meet_now', agenda, opened_by: caller.id, incident_details: incidentDetails });
    const meeting = ins.row;
    const participants = await loadParticipants(orgUnitId);
    for (const p of participants) await dbInsert('committee_meeting_participants', { meeting_id: meeting.id, ...p });
    await dbInsert('committee_meeting_transcript_entries', { meeting_id: meeting.id, speaker_worker_id: null, speaker_label: 'System', entry_type: 'system_note', content: `Meeting opened by ${caller.email || caller.id}. ${participants.filter((p) => p.availability !== 'available').length} of ${participants.length} seats are not available (see participant list for why).`, created_by: caller.id });
    await audit(caller, 'meeting', meeting.id, 'opened', { type: meeting.meeting_type });
    return res.status(200).json({ ok: true, meeting, participants, agenda });
  }
  if (op === 'update-incident-details') {
    if (!need('POST')) return;
    const meeting = await dbOne(`committee_meetings?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!meeting) return bad(res, 404, 'Not found');
    if (meeting.meeting_type !== 'incident') return bad(res, 422, 'Only an incident has incident_details to update.');
    const allowed = ['severity', 'detection', 'affected_systems', 'containment', 'recovery'];
    const patch = {}; for (const k of allowed) if (k in b) patch[k] = sanitize(b[k], 2000) || null;
    const merged = { ...(meeting.incident_details || {}), ...patch };
    const [row] = await dbPatch('committee_meetings', `id=eq.${enc(meeting.id)}`, { incident_details: merged });
    await dbInsert('committee_meeting_transcript_entries', { meeting_id: meeting.id, speaker_worker_id: null, speaker_label: 'System', entry_type: 'system_note', content: `Incident details updated: ${Object.keys(patch).join(', ')}.`, created_by: caller.id });
    return res.status(200).json({ ok: true, meeting: row });
  }
  if (op === 'close-meeting') {
    if (!need('POST')) return;
    const meeting = await dbOne(`committee_meetings?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!meeting) return bad(res, 404, 'Not found');
    if (meeting.status !== 'in_session') return bad(res, 409, `Cannot close a ${meeting.status} meeting.`);
    const summary = sanitize(b.summary, 4000); if (summary.length < 5) return bad(res, 422, 'A real closing summary is required.');
    const [row] = await dbPatch('committee_meetings', `id=eq.${enc(meeting.id)}`, { status: 'closed', summary, closed_by: caller.id, closed_at: nowIso() });
    await dbInsert('committee_meeting_transcript_entries', { meeting_id: meeting.id, speaker_worker_id: null, speaker_label: 'System', entry_type: 'system_note', content: `Meeting closed by ${caller.email || caller.id}.`, created_by: caller.id });
    await audit(caller, 'meeting', meeting.id, 'closed', {});
    return res.status(200).json({ ok: true, meeting: row });
  }
  if (op === 'add-transcript-entry') {
    if (!need('POST')) return;
    const meeting = await dbOne(`committee_meetings?id=eq.${enc(sanitize(b.meeting_id, 60))}&select=*`); if (!meeting) return bad(res, 404, 'Not found');
    if (meeting.status !== 'in_session') return bad(res, 409, 'Cannot add to a meeting that is not in session.');
    const content = sanitize(b.content, 4000); if (!content) return bad(res, 422, 'content is required.');
    const entryType = sanitize(b.entry_type, 20); if (!['question', 'statement', 'decision', 'system_note'].includes(entryType)) return bad(res, 422, 'Invalid entry_type.');
    const speakerWorkerId = sanitize(b.speaker_worker_id, 60) || null;
    let speakerLabel = sanitize(b.speaker_label, 200) || 'Isaac (Owner)';
    if (speakerWorkerId) {
      // A transcript entry can only be attributed to a participant who is genuinely in this meeting as 'available' —
      // never to a reserved/vacant seat's occupant, since there isn't one. This is the concrete enforcement of "no
      // fabricated AI participation" until a real Model Council integration exists.
      const participant = await dbOne(`committee_meeting_participants?meeting_id=eq.${enc(meeting.id)}&worker_id=eq.${enc(speakerWorkerId)}&select=*`);
      if (!participant || participant.availability !== 'available') return bad(res, 422, 'That worker is not an available participant in this meeting — cannot attribute a statement to them.');
      speakerLabel = participant.label;
    }
    const ins = await dbInsert('committee_meeting_transcript_entries', { meeting_id: meeting.id, speaker_worker_id: speakerWorkerId, speaker_label: speakerLabel, entry_type: entryType, content, created_by: caller.id });
    return res.status(200).json({ ok: true, entry: ins.row });
  }
  if (op === 'add-meeting-evidence') {
    if (!need('POST')) return;
    const meeting = await dbOne(`committee_meetings?id=eq.${enc(sanitize(b.meeting_id, 60))}&select=id`); if (!meeting) return bad(res, 404, 'Not found');
    const source = sanitize(b.source, 1000); const observation = sanitize(b.observation, 4000);
    if (!source || !observation) return bad(res, 422, 'source and observation are both required.');
    const ins = await dbInsert('committee_meeting_evidence', { meeting_id: meeting.id, source, observation, added_by: caller.id });
    return res.status(200).json({ ok: true, evidence: ins.row });
  }
  if (op === 'create-action-item') {
    if (!need('POST')) return;
    const meeting = await dbOne(`committee_meetings?id=eq.${enc(sanitize(b.meeting_id, 60))}&select=id`); if (!meeting) return bad(res, 404, 'Not found');
    const description = sanitize(b.description, 1000); if (!description) return bad(res, 422, 'description is required.');
    const ins = await dbInsert('committee_meeting_action_items', { meeting_id: meeting.id, description, dri_worker_id: sanitize(b.dri_worker_id, 60) || null, due_at: b.due_at || null, created_by: caller.id });
    return res.status(200).json({ ok: true, action_item: ins.row });
  }
  if (op === 'complete-action-item' || op === 'cancel-action-item') {
    if (!need('POST')) return;
    const item = await dbOne(`committee_meeting_action_items?id=eq.${enc(sanitize(b.id, 60))}&select=*`); if (!item) return bad(res, 404, 'Not found');
    if (item.status !== 'open') return bad(res, 409, `This action item is already ${item.status}.`);
    const to = op === 'complete-action-item' ? 'done' : 'cancelled';
    const [row] = await dbPatch('committee_meeting_action_items', `id=eq.${enc(item.id)}&status=eq.open`, { status: to, completed_at: nowIso() });
    return res.status(200).json({ ok: true, action_item: row });
  }

  return bad(res, 400, `Unknown meeting operation: ${op}`);
});
