// Nova Audit report PDF (server-side, jsPDF). Owner-approved direction: black #0A0A0A, white #FAFAFA, gold #C9A84C,
// the existing Nova logo, restrained typography. Renders ONLY the stored report content of one version; nothing is
// added that is not in that content. A draft is stamped as a draft on every page and cannot pass as approved.
import { jsPDF } from 'jspdf';
import { NOVA_LOGO_PNG_BASE64 } from './_novaLogo.js';

const INK = [10, 10, 10]; const PAPER = [250, 250, 250]; const GOLD = [201, 168, 76];
const MUTED = [96, 96, 96]; const RULE = [222, 218, 206]; const SOFT = [244, 241, 232];
const W = 612; const H = 792; const M = 54; // US Letter, points

// Standard PDF fonts are WinAnsi: map common typography to safe equivalents and drop anything else.
const t = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/→/g, '->').replace(/[•·]/g, '-').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }); } catch { return ''; } };
const PRIORITY = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };
const TYPE = { observed_fact: 'Observed', stated_claim: 'Owner statement', inference: 'Inference', estimate: 'Estimate', unknown: 'Unknown' };

export function renderAuditPdf({ content = {}, version, status, approvedAt, generatedAt = new Date().toISOString(), contentSha256 = '' }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true });
  const isDraft = status !== 'approved';
  const biz = content.business_identity || {};
  const bizName = t(biz.name || 'Business');
  const findings = Array.isArray(content.findings) ? content.findings : [];
  const evidence = Array.isArray(content.evidence_reviewed) ? content.evidence_reviewed : [];
  const recs = Array.isArray(content.recommendations) ? content.recommendations : [];
  const checks = Array.isArray(content.checks_performed) ? content.checks_performed : [];
  const counts = { high: 0, medium: 0, low: 0, none: 0 };
  for (const f of findings) counts[f.priority in counts ? f.priority : 'none']++;
  const reviewed = findings.filter((f) => f.review_status === 'reviewed').length;

  // ---------------------------------------------------------------- cover (black)
  doc.setFillColor(...INK); doc.rect(0, 0, W, H, 'F');
  doc.addImage(`data:image/png;base64,${NOVA_LOGO_PNG_BASE64}`, 'PNG', W / 2 - 60, 92, 120, 120);
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M + 120, 250, W - M - 120, 250);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GOLD);
  doc.text('THE NOVA AUDIT', W / 2, 282, { align: 'center', charSpace: 3 });
  doc.setFont('times', 'normal'); doc.setFontSize(34); doc.setTextColor(...PAPER);
  const nameLines = doc.splitTextToSize(bizName, W - 2 * M - 40);
  let y = 330; for (const l of nameLines.slice(0, 3)) { doc.text(l, W / 2, y, { align: 'center' }); y += 40; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(200, 200, 200);
  doc.text('Where customers, money and time are being lost, and what to do first', W / 2, y + 4, { align: 'center' });
  if (biz.website) { doc.setFontSize(9.5); doc.setTextColor(150, 150, 150); doc.text(t(biz.website), W / 2, y + 24, { align: 'center' }); }

  // cover facts: three measured figures from this version's content only
  const facts = [[String(findings.length), findings.length === 1 ? 'finding' : 'findings'], [String(evidence.length), evidence.length === 1 ? 'evidence record' : 'evidence records'], content.metrics?.competitors_compared ? [String(content.metrics.competitors_compared), 'competitors compared'] : [String(checks.length || '-'), 'checks run']];
  const colW = (W - 2 * M) / 3; const fy = 560;
  doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.5); doc.line(M, fy - 34, W - M, fy - 34); doc.line(M, fy + 34, W - M, fy + 34);
  facts.forEach(([n, l], i) => {
    const cx = M + colW * i + colW / 2;
    doc.setFont('times', 'normal'); doc.setFontSize(26); doc.setTextColor(...GOLD); doc.text(n, cx, fy + 2, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(170, 170, 170); doc.text(l.toUpperCase(), cx, fy + 20, { align: 'center', charSpace: 1.2 });
  });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(170, 170, 170);
  doc.text(`Version ${version || 1}  -  ${isDraft ? 'Draft prepared' : 'Approved'} ${fmtDate(isDraft ? generatedAt : approvedAt || generatedAt)}`, W / 2, 660, { align: 'center' });
  doc.text('Prepared by Nova Systems LLC  -  Waterbury, Connecticut', W / 2, 676, { align: 'center' });
  if (isDraft) {
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.roundedRect(W / 2 - 150, 700, 300, 28, 3, 3, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...GOLD);
    doc.text('DRAFT - NOT APPROVED FOR CLIENT DELIVERY', W / 2, 718, { align: 'center', charSpace: 0.8 });
  }

  // ---------------------------------------------------------------- interior pages (white)
  const pageStart = () => {
    doc.addPage(); doc.setFillColor(...PAPER); doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...INK); doc.rect(0, 0, W, 30, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GOLD); doc.text('NOVA SYSTEMS', M, 19, { charSpace: 2 });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 200, 200);
    doc.text(t(`${bizName}  -  The Nova Audit  -  v${version || 1}${isDraft ? ' draft' : ''}`).slice(0, 90), W - M, 19, { align: 'right' });
    if (isDraft) { doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...GOLD); doc.text('DRAFT - NOT APPROVED', W / 2, H - 22, { align: 'center', charSpace: 1 }); }
    return 64;
  };
  y = pageStart();
  const need = (h) => { if (y + h > H - 56) y = pageStart(); };
  const section = (label, title) => {
    need(70);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GOLD); doc.text(label.toUpperCase(), M, y, { charSpace: 1.8 }); y += 18;
    doc.setFont('times', 'normal'); doc.setFontSize(22); doc.setTextColor(...INK); doc.text(t(title), M, y); y += 10;
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M, y, M + 36, y); y += 20;
  };
  const para = (text, { size = 10.5, color = INK, font = 'helvetica', style = 'normal', indent = 0, gap = 6, lead = 1.45 } = {}) => {
    if (!text) return;
    doc.setFont(font, style); doc.setFontSize(size); doc.setTextColor(...color);
    for (const raw of t(text).split('\n')) {
      const lines = raw.trim() ? doc.splitTextToSize(raw, W - 2 * M - indent) : [''];
      // re-apply the style per line: a page break draws the header in another colour
      for (const l of lines) { need(size * lead); doc.setFont(font, style); doc.setFontSize(size); doc.setTextColor(...color); doc.text(l, M + indent, y); y += size * lead; }
    }
    y += gap;
  };
  const label = (k, v, indent = 0) => {
    if (!v) return;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED); need(28); doc.text(k.toUpperCase(), M + indent, y, { charSpace: 1 }); y += 12;
    para(v, { size: 10, indent, gap: 8 });
  };

  let n = 0; const num = () => String(++n).padStart(2, '0');
  // 1. Summary
  section(`${num()}  Summary`, 'What we found');
  if (content.owner_goal) { label('Your goal', content.owner_goal); }
  para(content.executive_summary, { size: 11.5, gap: 14 });
  need(64);
  doc.setFillColor(...SOFT); doc.rect(M, y, W - 2 * M, 54, 'F');
  const cells = [[counts.high, 'High priority'], [counts.medium, 'Medium'], [counts.low, 'Low'], [`${reviewed}/${findings.length}`, 'Reviewed by Nova']];
  const cw = (W - 2 * M) / cells.length;
  cells.forEach(([v, l], i) => {
    const cx = M + cw * i + 16;
    doc.setFont('times', 'normal'); doc.setFontSize(20); doc.setTextColor(...INK); doc.text(String(v), cx, y + 26);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(l.toUpperCase(), cx, y + 42, { charSpace: 0.8 });
  });
  y += 66;
  const m = content.metrics;
  if (m) {
    need(30);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
    para(`Measured in this research: ${m.pages_read} website page(s) read  -  ${m.checks} checks (${m.issues_observed} with an issue)  -  ${m.evidence_records} evidence records  -  ${m.competitors_compared} competitor website(s) compared`,{size:8.5,color:MUTED});
  }
  const fin = content.estimates_and_assumptions || {};
  para(fin.statement || 'Financial impact is unknown: no business records were supplied.', { size: 9.5, color: MUTED, gap: 10 });
  // Older approved snapshots have additional typed sections. Keep their inputs/results intact in the same PDF
  // used by owner download, client delivery and Vault; do not silently discard them during renderer upgrades.
  const renderDetails = (value, prefix = '', depth = 0) => {
    if (value == null || depth > 6) return;
    if (typeof value !== 'object') { label(prefix || 'Observation', String(value)); return; }
    if (Array.isArray(value)) { value.forEach((entry, i) => renderDetails(entry, `${prefix || 'Item'} ${i + 1}`, depth + 1)); return; }
    for (const [key, entry] of Object.entries(value)) renderDetails(entry, `${prefix ? `${prefix} · ` : ''}${key.replace(/_/g, ' ')}`, depth + 1);
  };
  if (fin.scenarios?.length || fin.assumptions || fin.inputs) {
    section(`${num()}  Financial scenarios`, 'Inputs, assumptions and estimated outcomes');
    para('Scenarios depend on the stated inputs and assumptions. They are not measured revenue loss or a guarantee.', { size: 9, color: MUTED });
    renderDetails(fin.scenarios, 'Scenario'); renderDetails(fin.assumptions, 'Assumption'); renderDetails(fin.inputs, 'Input');
  }
  if (content.scope_and_method) { section(`${num()}  Scope and method`, 'What this review covers'); renderDetails(content.scope_and_method); }
  if (content.software_review?.length || (content.software_review && !Array.isArray(content.software_review))) { section(`${num()}  Existing systems`, 'Software and handoffs'); renderDetails(content.software_review, 'System'); }
  if (content.competitor_benchmarks?.length) { section(`${num()}  Competitor evidence`, 'Recorded comparisons'); renderDetails(content.competitor_benchmarks, 'Comparison'); }
  // the three kinds of statement in this report, so none is read as another
  label('How to read this report', '"What we saw" is measured: each item names its public source and when it was read. "Likely effect" is Nova\'s inference and was not measured. What could not be checked is listed under Limitations and is never counted as a problem.');

  const investigation = content.diagnostic_investigation;
  if (investigation) {
    section(`${num()}  Investigation`, 'What was actually tested');
    para(`${investigation.duration_hours}-hour scope. ${investigation.completed} of ${investigation.total} checks completed; ${investigation.blocked} blocked. Status: ${investigation.state}.`, { size: 10 });
    if (investigation.delivery_clock?.message) para(investigation.delivery_clock.message, { size: 9, color: MUTED });
    para('A scheduled test is not a completed test. Public reports and reviews describe source claims, not automatically established facts.', { size: 9, color: MUTED });
    for (const area of investigation.coverage || []) label(area.label, `${area.completed}/${area.total} completed - ${area.status}`);
    for (const [index, task] of (investigation.tasks || []).entries()) {
      label(`Check ${index + 1}: ${String(task.area || 'investigation').replace(/_/g, ' ')}`, `${task.status}${task.channel ? ` - ${task.channel}` : ''}${task.target ? ` - ${task.target}` : ''}`);
      para(task.question, { size: 10 });
      if (task.observation) para(task.observation, { size: 9 });
      if (task.source) para(`Evidence: ${task.source}`, { size: 8.5, color: MUTED });
      if (task.response_seconds != null) para(`Response: ${task.response_seconds} seconds${task.meaningful_response ? ' (recorded human/meaningful response)' : ' (acknowledgement only)'}.`, { size: 9 });
      if (task.observed_until) para(`Observation window ended: ${task.observed_until}.`, { size: 9 });
      if (task.exclusion_reason) para(`Excluded: ${task.exclusion_reason}`, { size: 9, color: MUTED });
    }
  }

  const paths = Array.isArray(content.customer_paths) ? content.customer_paths : [];
  if(paths.length){
    section(`${num()}  Customer paths`, 'Can a customer take the next step?');
    para('Read-only checks of linked destinations. A page opening does not confirm a completed booking, delivered inquiry or payment.',{size:9,color:MUTED});
    for(const path of paths.slice(0,12)){
      need(72);
      label(`${path.result==='broken'?'Needs repair':path.result==='reachable'?'Page opens':'Not verified'}: ${String(path.label||'Customer link').slice(0,45)}`,`${path.target}\n${path.reason||''} · Observed ${path.checked_at||'time unknown'}`);
    }
    if(paths.length>12)para(`${paths.length-12} additional link checks are retained with the audit evidence.`,{size:9,color:MUTED});
  }
  // 2. Findings
  section(`${num()}  Findings`, 'Priority findings');
  if (!findings.length) para('No findings are recorded in this version.', { color: MUTED });
  findings.forEach((f, i) => {
    need(90);
    const top = y;
    doc.setFillColor(...(f.priority === 'high' ? INK : f.priority === 'medium' ? GOLD : RULE)); doc.rect(M, top - 10, 3, 14, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    para(`${String(i + 1).padStart(2, '0')}  ${PRIORITY[f.priority] || 'Priority not set'}  -  ${TYPE[f.type] || f.type || ''}${f.confidence ? `  -  ${f.confidence} confidence` : ''}${f.review_status && f.review_status !== 'reviewed' ? '  -  PROPOSED, NOT YET REVIEWED' : ''}`.toUpperCase(),{size:7.5,color:MUTED,indent:12,gap:8});
    para(f.title, { size: 13, font: 'times', style: 'normal', indent: 12, gap: 4, lead: 1.3 });
    label('What we saw', f.observed, 12);
    if (f.recheck) label(f.recheck.status === 'still_observed' ? `Re-checked ${String(f.recheck.at || '').slice(0, 10)}: still observed` : `Not re-checked (${String(f.recheck.at || '').slice(0, 10)})`, f.recheck.note, 12);
    label('Likely effect (inferred, not measured)', f.customer_impact || f.why, 12);
    label('Recommended next step', f.remedy, 12);
    if (f.module) label('Nova module', f.module, 12);
    if (f.limitations) para(f.limitations, { size: 8.5, color: MUTED, indent: 12, gap: 6 });
    if (Array.isArray(f.evidence) && f.evidence.length) label('Evidence', f.evidence.map((e) => `- ${e}`).join('\n'), 12);
    doc.setDrawColor(...RULE); doc.setLineWidth(0.5); need(14); doc.line(M, y, W - M, y); y += 18;
  });
  // findings measured again and no longer true: kept as history, out of the priority list
  const gone = Array.isArray(content.no_longer_observed) ? content.no_longer_observed : [];
  if (gone.length) {
    section(`${num()}  Since first observed`, 'No longer observed');
    para('Each of these was recorded earlier and measured again; it is no longer true. Kept as history.', { size: 9.5, color: MUTED, gap: 8 });
    gone.forEach((g) => { need(48); para(g.title, { size: 11.5, font: 'times', style: 'normal', gap: 2 }); para(`Re-checked ${String(g.rechecked_at || '').slice(0, 10)}: ${g.note || ''}`, { size: 9, color: MUTED, gap: 10 }); });
  }

  // 3. Competitors (only when compared on real public pages)
  const comps = Array.isArray(content.competitor_comparison) ? content.competitor_comparison : [];
  if (comps.length) {
    section(`${num()}  Market`, 'How nearby competitors compare');
    const feat = (obs, label) => { const o = (obs || []).find((x) => String(x).toLowerCase().startsWith(`${label.toLowerCase()}:`)); return o ? /yes\s*$/i.test(o) : null; };
    const LABELS = ['online booking', 'tap-to-call phone link', 'published prices', 'a contact form', 'reviews or social proof', 'published hours', 'live chat', 'phone-ready pages'];
    const KEYS = ['online_booking', 'click_to_call', 'prices_published', 'contact_form', 'reviews_or_social_proof', 'hours_published', 'chat', 'mobile_viewport'];
    const cols = [{ name: biz.name || 'Client', vals: KEYS.map((k) => (content.client_features ? !!content.client_features[k] : null)) }, ...comps.slice(0, 3).map((c) => ({ name: c.name, vals: LABELS.map((l) => feat(c.observations, l)) }))];
    const labelW = 170; const colW = (W - 2 * M - labelW) / cols.length;
    need(40 + LABELS.length * 20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    cols.forEach((c, i) => { const lines = doc.splitTextToSize(t(c.name).toUpperCase(), colW - 8).slice(0, 2); lines.forEach((ln, k) => doc.text(ln, M + labelW + colW * i + colW / 2, y + k * 9, { align: 'center' })); });
    y += 22; doc.setDrawColor(...RULE); doc.line(M, y, W - M, y); y += 14;
    LABELS.forEach((l, r) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(t(l.charAt(0).toUpperCase() + l.slice(1)), M, y);
      cols.forEach((c, i) => {
        const cx = M + labelW + colW * i + colW / 2; const v = c.vals[r];
        if (v === null) { doc.setTextColor(...MUTED); doc.setFontSize(9); doc.text('-', cx, y, { align: 'center' }); }
        else { doc.setDrawColor(...(i === 0 ? INK : GOLD)); doc.setLineWidth(0.9); if (v) { doc.setFillColor(...(i === 0 ? INK : GOLD)); doc.circle(cx, y - 3, 3.6, 'FD'); } else doc.circle(cx, y - 3, 3.6, 'S'); }
      });
      y += 20;
    });
    para('Filled circle: found on the business\'s public website. Open circle: not found on the pages read. Dash: not compared.', { size: 8, color: MUTED, gap: 8 });
    comps.slice(0, 3).forEach((c) => para(`${c.name}${c.url ? ` (${c.url})` : ''}: ${c.rationale}`, { size: 8.5, color: MUTED, gap: 4 }));
    y += 6;
  }

  // 4. Prescriptions by module
  const rx = Array.isArray(content.prescriptions) ? content.prescriptions : [];
  if (rx.length) {
    section(`${num()}  Prescription`, 'What Nova would install');
    rx.forEach((p) => { label(p.label, p.findings.map((x) => `- ${x}`).join('\n')); });
    para('Each module is installed only after you approve its scope, connected accounts and cost.', { size: 9, color: MUTED, gap: 8 });
  }

  // 5. Next steps
  section(`${num()}  Next steps`, 'What to do first');
  if (recs.length) recs.forEach((r, i) => para(`${i + 1}.  ${r.mechanism}${r.effort ? `  (effort: ${r.effort})` : ''}`, { gap: 4 }));
  para(content.next_steps, { gap: 10 });

  // 6. What we checked
  if (checks.length) {
    section(`${num()}  Coverage`, 'What we checked');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED); need(20);
    doc.text('CHECK', M, y); doc.text('RESULT', M + 300, y); doc.text('WHEN', W - M, y, { align: 'right' }); y += 8;
    doc.setDrawColor(...RULE); doc.line(M, y, W - M, y); y += 14;
    for (const c of checks) {
      need(16); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(t(c.label), 280)[0], M, y);
      doc.setTextColor(...(c.result === 'issue' ? [150, 110, 20] : MUTED)); doc.text(c.result === 'issue' ? 'Issue observed' : c.result === 'ok' ? 'No issue seen' : 'Could not check', M + 300, y);
      doc.setTextColor(...MUTED); doc.text(c.checked_at ? fmtDate(c.checked_at) : '', W - M, y, { align: 'right' }); y += 15;
    }
    y += 10;
  }

  // 7. Limitations
  section(`${num()}  Limitations`, 'What this report cannot tell you');
  const rl = Array.isArray(content.research_limitations) ? content.research_limitations.filter(Boolean) : [];
  if (rl.length) label('Not checked in this research', rl.map((x) => `- ${x}`).join('\n'));
  para(content.limitations, { size: 9.5, color: MUTED });

  // Appendix: evidence
  if (evidence.length) {
    section('Appendix', 'Evidence reviewed');
    evidence.forEach((e, i) => {
      need(40);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      doc.text(t(`E${i + 1}  -  ${e.confidence ? `${e.confidence} confidence` : 'confidence not rated'}  -  captured ${e.captured ? fmtDate(e.captured) : 'unknown'}`).toUpperCase(), M, y, { charSpace: 0.5 }); y += 12;
      para(e.source, { size: 8.5, color: MUTED, gap: 2 });
      para(e.observation, { size: 9, gap: 10 });
    });
  }

  // footers: page numbers + content fingerprint on every interior page
  const pages = doc.getNumberOfPages();
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(`Page ${p - 1} of ${pages - 1}`, W - M, H - 22, { align: 'right' });
    if (contentSha256) doc.text(`Content fingerprint ${contentSha256.slice(0, 16)}`, M, H - 22);
  }
  return Buffer.from(doc.output('arraybuffer'));
}
