// Structural + honesty lint for the Academy v2 content. Run by build_academy_content.mjs and verify_local_all.mjs.
//   node scripts/validate_academy_content.mjs
import { programs, toolkit } from './academy_content/index.mjs';

const SLUGS = ['nova-fundamentals', 'prospecting-and-qualification', 'cold-emailing', 'cold-calling', 'cold-messaging', 'in-person-sales', 'discovery-and-diagnostic-selling', 'follow-up-and-scheduling', 'crm-and-data-protection', 'ethics-commission-final-assessment'];
const KINDS = ['script', 'email_template', 'sms_template', 'message_template', 'checklist', 'objection', 'faq', 'guide', 'link'];
// A line that states a dollar figure, a duration, a percentage claim or the word "guarantee" must visibly be an anti-example, a caveat or a fictional sample.
const RISKY = [/\$\s?\d/, /\b\d+\s*(?:-|to|or)?\s*\d*\s*hours?\b/i, /\bguarantee[sd]?\b/i, /\b\d+\s?%/, /\b(?:double|triple|10x)\b/i];
const CAVEAT = /\b(never|do not|don't|dont|not say|wrong|invented|unapproved|not approved|cannot|can't|won't|no guarantee|without|avoid|forbidden|not allowed|not allow|fictional|not one|not promise|promise|only if|unless|nor |wary|rather than|the system rejects|instead|no claim|no figure|no guarantee)\b|["“]/i;

export function validateContent(progs = programs, tk = toolkit) {
  const problems = []; const p = (m) => problems.push(m);
  if (progs.length !== 10) p(`expected 10 programs, found ${progs.length}`);
  progs.forEach((g, i) => {
    const at = `program ${i + 1} (${g.slug})`;
    if (g.slug !== SLUGS[i]) p(`${at}: slug should be ${SLUGS[i]}`);
    if (g.version !== 2) p(`${at}: version must be 2`);
    if ((g.objectives || []).length < 3) p(`${at}: needs at least 3 program objectives`);
    if ((g.lessons || []).length < 4) p(`${at}: needs at least 4 lessons`);
    g.lessons.forEach((l, j) => {
      const words = l.body.trim().split(/\s+/).length;
      if (words < 150) p(`${at} lesson ${j + 1}: only ${words} words`);
      if ((l.objectives || []).length < 2) p(`${at} lesson ${j + 1}: needs at least 2 objectives`);
      l.body.split('\n').forEach((line) => { if (RISKY.some((re) => re.test(line)) && !CAVEAT.test(line)) p(`${at} lesson ${j + 1}: risky claim without a caveat/anti-example marker: "${line.slice(0, 90)}"`); });
    });
    const qs = g.questions || []; const need = g.slug === 'ethics-commission-final-assessment' ? 12 : 10;
    if (qs.length < need) p(`${at}: needs at least ${need} questions (has ${qs.length})`);
    const seen = new Set(); const pos = [0, 0, 0, 0];
    qs.forEach((q, j) => {
      if (seen.has(q.q)) p(`${at} question ${j + 1}: duplicate text`); seen.add(q.q);
      if (!Array.isArray(q.choices) || q.choices.length !== 4) p(`${at} question ${j + 1}: needs exactly 4 choices`);
      else if (new Set(q.choices).size !== 4) p(`${at} question ${j + 1}: choices must be distinct`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) p(`${at} question ${j + 1}: invalid answer index`); else pos[q.answer]++;
      if (!q.why || q.why.length < 15) p(`${at} question ${j + 1}: needs an explanation`);
      [q.q, ...q.choices].forEach((t) => { if (RISKY.some((re) => re.test(t)) && !CAVEAT.test(t) && q.answer !== q.choices.indexOf(t)) return; });
    });
    if (qs.length && Math.max(...pos) / qs.length > 0.6) p(`${at}: correct answers are too concentrated in one position (${pos.join('/')})`);
    const crit = qs.filter((q) => q.critical).length;
    if (['crm-and-data-protection'].includes(g.slug) && crit < 2) p(`${at}: needs at least 2 critical questions`);
    if (g.slug === 'ethics-commission-final-assessment' && crit < 4) p(`${at}: needs at least 4 critical questions`);
    if ((g.exercises || []).length < 2) p(`${at}: needs at least 2 exercises`);
    (g.exercises || []).forEach((e, j) => { if (!e.prompt || !e.model_answer || (e.self_check || []).length < 2) p(`${at} exercise ${j + 1}: needs prompt, model answer and 2+ self-check items`); if (e.lesson_order > g.lessons.length) p(`${at} exercise ${j + 1}: lesson_order out of range`); });
    const needsPractical = ['in-person-sales', 'discovery-and-diagnostic-selling'].includes(g.slug);
    if (needsPractical) { if (!g.practical || g.practical.prompt.length < 300 || (g.practical.rubric || []).length < 4) p(`${at}: needs a practical prompt (300+ chars) and 4+ rubric criteria`); } else if (g.practical) p(`${at}: must not define a practical`);
    if (g.practical) { const keys = g.practical.rubric.map((r) => r.key); if (new Set(keys).size !== keys.length) p(`${at}: rubric keys must be unique`); }
  });
  if (tk.length < 15) p(`toolkit: expected at least 15 items, found ${tk.length}`);
  tk.forEach((t, i) => {
    if (!KINDS.includes(t.kind)) p(`toolkit ${i + 1}: bad kind ${t.kind}`);
    if (t.program && !SLUGS.includes(t.program)) p(`toolkit ${i + 1}: unknown program ${t.program}`);
    if (/\$\s?\d/.test(t.body)) p(`toolkit "${t.title}": contains a dollar figure`);
    t.body.split('\n').forEach((line) => { if (/guarantee/i.test(line) && !CAVEAT.test(line)) p(`toolkit "${t.title}": unqualified guarantee wording: "${line.slice(0, 80)}"`); });
    if (!t.note) p(`toolkit "${t.title}": needs a compliance note`);
  });
  const titles = tk.map((t) => `${t.kind}:${t.title}`); if (new Set(titles).size !== titles.length) p('toolkit: duplicate kind+title');
  return problems;
}
if (process.argv[1] && process.argv[1].endsWith('validate_academy_content.mjs')) {
  const problems = validateContent();
  const totals = { lessons: programs.reduce((s, g) => s + g.lessons.length, 0), questions: programs.reduce((s, g) => s + g.questions.length, 0), exercises: programs.reduce((s, g) => s + g.exercises.length, 0), toolkit: toolkit.length, words: programs.reduce((s, g) => s + g.lessons.reduce((a, l) => a + l.body.trim().split(/\s+/).length, 0), 0) };
  console.log(`Academy v2 content: ${programs.length} programs, ${totals.lessons} lessons (${totals.words} words), ${totals.questions} questions, ${totals.exercises} exercises, ${totals.toolkit} toolkit items`);
  if (problems.length) { problems.forEach((x) => console.log(`FAIL — ${x}`)); process.exitCode = 1; } else console.log('PASS — content meets the structural and honesty rules');
}
