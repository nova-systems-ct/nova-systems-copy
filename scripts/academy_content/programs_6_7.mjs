// Nova Sales Academy v2 content — programs 6–7 (in-person sales, discovery and diagnostic selling). Both require a reviewed practical.
export const p6 = {
  slug: 'in-person-sales', version: 2,
  objectives: ['Prepare for and open a face-to-face conversation with respect and honesty.', 'Read the room and know when to leave.', 'Ask diagnostic questions in person and record what you learn.', 'Ask for a clear, small next step and follow up correctly.'],
  practical: {
    prompt: `PRACTICAL — In-Person Conversation (written report + role-play)
With your manager or a peer playing a local business owner (or, if your manager approves in advance, a real conversation with someone who has agreed to talk), run a five-to-ten-minute in-person style conversation. Then submit a written report that includes:
1. PREPARATION — the specific, true observation you prepared and where you saw it.
2. OPENING — the exact words you used to introduce yourself, and how you asked permission.
3. QUESTIONS — the diagnostic questions you asked, in order, and two things you learned from the answers.
4. AN OBJECTION — one objection you received and exactly how you answered it honestly.
5. THE ASK — the small next step you asked for (for example a scheduled discovery conversation) and the reply.
6. RECORD — what you logged in the CRM (activity, outcome, next action) in your own words.
7. REFLECTION — one thing you would do differently.
Do not use invented figures, guarantees, or prices. Do not record anyone without permission.`,
    rubric: [
      { key: 'diagnosis_first', label: 'Diagnosis first', description: 'Asked real questions about how the business handles inquiries before describing any service.' },
      { key: 'honesty_no_promises', label: 'Honesty; no promises', description: 'No guarantees, invented figures, unapproved prices or false claims; used the honest fallback where needed.' },
      { key: 'respect_and_consent', label: 'Respect and consent', description: 'Asked permission, read the situation, accepted a no, respected contact rules.' },
      { key: 'clear_next_step', label: 'Clear next step', description: 'Asked for one small, specific next step and handled the reply appropriately.' },
      { key: 'record_keeping', label: 'Record keeping', description: 'Logged the activity, outcome and next action accurately and factually.' },
    ],
  },
  lessons: [
    { title: 'Preparing to Walk In', objectives: ['Decide whether an in-person visit is appropriate.', 'Prepare an observation, a question and a small ask.'], body: `An unannounced visit is the most personal form of cold outreach, and it can go well when done respectfully — and badly when done carelessly. First decide whether a visit is appropriate: is the business open to walk-in customers, is it a quiet time, and would a call or email be less intrusive? Never visit a home, and never enter areas marked staff-only.

PREPARE: (1) the specific observation you noted; (2) one open question about how customers reach them; (3) one small ask — a scheduled conversation, not a purchase; (4) your business card or the details to leave behind; (5) your Nova identification and manager's contact.

TIMING: avoid the lunch rush and the closing hour; late morning or mid-afternoon on a weekday often works. If it is busy, say so and leave: "I can see you're busy — could I come back Thursday at 10?"

DRESS AND MANNER: neat, unhurried, friendly. You are a guest in their workplace.

SAFETY AND RESPECT: tell your manager where you are going; do not enter if you feel unsafe; never block a doorway or pressure someone to stay. If asked to leave, leave immediately and politely.` },
    { title: 'Opening and Reading the Room', objectives: ['Introduce yourself honestly and ask permission.', 'Read signals that it is the wrong moment.'], body: `The first ten seconds decide whether the rest happens. A good open: "Hi, I'm Sam from Nova Systems. I'm not selling anything today — I look at how local businesses handle new customer inquiries, and I noticed something on your listing. Is there someone I could ask a quick question, if now isn't a bad time?"

READ THE ROOM: if the person is with a customer, on the phone, or stressed, you have your answer — wait, or offer to come back. If they cross their arms and say "not interested", thank them warmly and go. If they lean in and ask questions, slow down and listen.

WHO YOU ARE TALKING TO: ask who handles inquiries; do not demand the owner. Front-desk staff are often the most informed.

BODY LANGUAGE: keep your hands visible, stand at a respectful distance, avoid blocking the exit, and match their pace.

NEVER: claim to be a customer, hand over a leaflet with figures or promises, photograph the premises or staff without permission, or say "I was just in the neighbourhood" if untrue.

EXAMPLE (fictional): At a hair salon: "Hi, I'm Sam from Nova Systems. I noticed the salon's online booking page and your Google listing show different Saturday hours. Who would be the best person to ask which one is correct?"` },
    { title: 'Asking Diagnostic Questions Face to Face', objectives: ['Ask open questions that reveal how inquiries are handled.', 'Listen and record what you hear.'], body: `Face to face you can ask better questions than on a call because you can see the business. Five that work, in this order:
1. "How do new customers usually reach you — phone, walk-in, website, something else?"
2. "What happens when nobody can pick up right away?"
3. "How do you keep track of people who ask for a quote or an appointment?"
4. "What's the most frustrating part of handling new inquiries?"
5. "What have you tried so far?"

LISTEN more than you speak — aim for the owner talking about two-thirds of the time. Take short notes with their permission ("Do you mind if I jot this down?"). Repeat back what you heard: "So calls after 5 go to voicemail and you return them the next morning — is that right?"

DO NOT diagnose out loud ("your system is broken"). Instead: "Thanks — that's helpful. What I do is write this up properly, with evidence. Would it be worth a proper conversation to look at it?"

RECORD immediately afterwards: what they said, in their words; the observations you saw; the decision maker answer; and your next action. Facts only — no guessing about money.` },
    { title: 'Objections and Honest Answers in Person', objectives: ['Handle objections calmly.', 'Never invent claims when pressed.'], body: `In person, objections come with tone and body language. Stay calm, slow down, and answer honestly.

• "We're fine." → "Good to hear. What's working well for you with new customers at the moment?" (Listen. If it truly is fine, thank them.)
• "Who are you with?" → "Nova Systems — we look at how local businesses handle new inquiries and write down what we find. Here's my card."
• "What's this going to cost?" → "The scope decides it, so I won't guess. If we talked properly I'd bring a written proposal."
• "Can you guarantee results?" → "No, and I'd be wary of anyone who does. What I can do is show you what's actually happening today, with evidence."
• "Leave your card and I'll call." → "Of course. Would it be okay if I check back Thursday morning in case I miss you?" Then set the next action.
• "Please leave." → "Of course, thank you for your time." Leave at once; log it.

PRESSURE TACTICS ARE NOT ALLOWED: no fake deadlines, no "everyone else has signed up", no blocking the way, no staying after being asked to leave.

WHEN YOU DON'T KNOW: "I'll find out and follow up." Then do.` },
    { title: 'The Ask, the Exit and the Follow-Up', objectives: ['Ask for a small, clear next step.', 'Exit gracefully.', 'Follow up and record accurately.'], body: `Close a good conversation with one small, specific ask: "Would it be useful to sit down for 20 minutes on Tuesday at 10 so I can ask a few more questions and show you what I look at?" Get a name, best contact route and a time. Read it back.

LEAVE BEHIND: your card, and nothing else that makes claims. Thank them by name.

WITHIN THE HOUR: log the visit — what happened, outcome, next action; add or correct the contact; set a dated next action; move the lead to Contacted (you have made a real attempt) or Qualified/Discovery Scheduled only if the entry rules are truly met.

FOLLOW-UP: send a short thank-you email or message the same day: "Thanks for taking a few minutes today. As agreed, I'll see you Tuesday at 10. — Sam, Nova Systems." Use only approved wording and only channels the person is happy with.

IF THE ANSWER WAS NO: thank them, log a factual note, close the lead with a reason, and do not return without an invitation.

REVIEW: after each visit, note one thing you did well and one to change. Share the change with your manager.` },
  ],
  questions: [
    { q: 'What is the best first move when you arrive and the owner is with a customer?', choices: ['Wait and interrupt when you can', 'Say you can see they are busy and offer to come back at a specific time', 'Start your pitch to the staff', 'Leave a leaflet full of claims'], answer: 1, why: 'Respect their time; offer a specific return.' },
    { q: 'Which is a good honest opening?', choices: ['"I was just in the neighbourhood" (untrue)', '"Hi, I\'m Sam from Nova Systems. I look at how local businesses handle new inquiries, and I noticed something on your listing. Is now a bad time?"', '"Are you the owner? I have a special offer."', '"I\'m a customer with a question." (untrue)'], answer: 1, why: 'Say who you are and why you are there; ask permission.' },
    { q: 'Which is a diagnostic question?', choices: ['"Would you like to buy a website?"', '"What happens when nobody can pick up right away?"', '"Can you sign today?"', '"What is your monthly revenue?"'], answer: 1, why: 'Open questions about how inquiries are handled reveal real problems.' },
    { q: 'Someone says "Please leave." What do you do?', choices: ['Explain more', 'Leave immediately and politely and log it', 'Ask for their manager', 'Wait outside and try again'], answer: 1, why: 'Never stay after being asked to leave.' },
    { q: 'You may photograph the premises or staff…', choices: ['Whenever it helps your notes', 'Only with clear permission', 'Never ask', 'If they are not looking'], answer: 1, why: 'Permission first, always.' },
    { q: 'A prospect asks you to guarantee results. What do you say?', choices: ['"Yes."', '"No, and I\'d be wary of anyone who does; I can show you what is actually happening today with evidence."', '"Ask my manager."', '"Probably."'], answer: 1, why: 'No guarantees; point to evidence.' },
    { q: 'What should you leave behind?', choices: ['A leaflet with promised figures', 'Your card, and nothing that makes claims', 'A contract to sign', 'Nothing, ever'], answer: 1, why: 'Approved, claim-free material only.' },
    { q: 'How soon should you log a visit?', choices: ['End of the month', 'Within the hour, factually — activity, outcome, next action', 'Never', 'Only if it went well'], answer: 1, why: 'Accurate, timely records protect you and the team.' },
    { q: 'After a "no", what is right?', choices: ['Come back daily', 'Thank them, log a factual note, close the lead with a reason, and do not return without an invitation', 'Send a discount by email', 'Ask another rep to try'], answer: 1, why: 'A respectful no today can be a yes later.' },
    { q: 'Which is a pressure tactic that is NOT allowed?', choices: ['Asking one clear question', 'Saying "this offer ends today" when it does not', 'Offering to come back', 'Leaving a card'], answer: 1, why: 'Fake deadlines and hype are forbidden.' },
  ],
  exercises: [
    { lesson_order: 2, title: 'Rehearse your opening', prompt: 'Write the exact words you would use to open at the front desk of a real, public business, including permission and one honest reason.', self_check: ['Do you say who you are and that you are not selling today?', 'Do you give a true reason?', 'Do you ask who would be best to speak to, and leave room to say no?'], model_answer: '"Hi, I\'m Sam from Nova Systems. I look at how local businesses handle new customer inquiries, and I noticed your booking page and Google listing show different hours. Who would be best to ask about that, if now isn\'t a bad time?"' },
    { lesson_order: 4, title: 'Answer "What will it cost?"', prompt: 'A business owner asks "What will this cost?" during a visit and no price is approved. Write your reply and your next step.', self_check: ['Did you avoid a number?', 'Did you offer a written proposal after a proper conversation?', 'Did you propose a specific next step?'], model_answer: '"The scope decides it, so I won\'t guess. If we talk for 20 minutes I\'d bring a written proposal so you can see exactly what it covers. Would Tuesday at 10 work?"' },
  ],
};

export const p7 = {
  slug: 'discovery-and-diagnostic-selling', version: 2,
  objectives: ['Plan and run a discovery conversation that diagnoses before prescribing.', 'Ask layered questions, listen, and record findings accurately.', 'Recognise when Nova can help and when it cannot.', 'Translate what you learned into an honest, scoped proposal.'],
  practical: {
    prompt: `PRACTICAL — Discovery Conversation (plan + role-play write-up)
With your manager or a peer playing a business owner (a real business only if your manager approves in advance), run a 15–20 minute discovery conversation. Submit:
1. PLAN — your goals and the questions you prepared, in the order you intended to ask them.
2. TRANSCRIPT OR DETAILED NOTES — what you actually asked and what was said, including at least one follow-up question you asked because of an answer.
3. FINDINGS — what you learned, written in your own words, separating what the owner said, what you observed, and what you assume (mark assumptions as such).
4. WHAT YOU DID NOT DO — one moment you resisted pitching before you understood the problem.
5. RECOMMENDED NEXT STEP — honest and scoped: does Nova's diagnostic fit? Which offering (by its readiness label) might be relevant, and what would you need to confirm first?
6. THE RECORD — the discovery notes you would enter in the CRM (the six discovery fields and your findings).
Do not include invented figures, guarantees, prices, or revenue estimates presented as fact.`,
    rubric: [
      { key: 'question_quality', label: 'Question quality', description: 'Open, layered questions that uncover how inquiries are actually handled, including follow-ups triggered by answers.' },
      { key: 'listens_before_prescribing', label: 'Listens before prescribing', description: 'Did not pitch or diagnose out loud before understanding the situation; reflected back what was heard.' },
      { key: 'evidence_notes', label: 'Evidence in notes', description: 'Findings clearly separate what was said, what was observed and what is assumed; nothing invented.' },
      { key: 'honest_scoping', label: 'Honest scoping', description: 'Recommends a next step that fits, states what must be confirmed, respects readiness labels, no unapproved prices or guarantees.' },
      { key: 'no_premature_pitch', label: 'No premature pitch', description: 'Held back the solution until the problem was understood and the owner agreed to a next step.' },
    ],
  },
  lessons: [
    { title: 'Diagnosis Before Prescription', objectives: ['Explain why discovery comes first.', 'State the goals of a discovery conversation.'], body: `A doctor who prescribes before examining is dangerous; a salesperson who pitches before asking is just annoying. Discovery is the examination. Its goals: understand how the business gets and handles new inquiries today; find the real frustrations in the owner's own words; learn who decides and how; and decide honestly whether Nova can help.

WHAT DISCOVERY IS NOT: a demo, a pitch, or a chance to show off product knowledge. Every minute you spend explaining Nova is a minute you are not learning.

THE SIX DISCOVERY AREAS you will record in the CRM: (1) how customers reach them; (2) what happens to missed inquiries; (3) the current follow-up process; (4) the main frustration; (5) what they have tried; (6) who decides. You need real answers to at least three, plus your own findings, before the system lets you mark Discovery Completed — because a note like "they seem interested" proves nothing.

MINDSET: you may discover Nova is not a fit. Saying so is a strength; it builds trust and saves everyone time.

HONEST FRAMING at the start: "I'd like to ask some questions about how new customers reach you and what happens next. I'm not here to pitch — afterwards I'll tell you honestly whether I think a closer look would be useful. Is that okay?"` },
    { title: 'Planning and Opening the Conversation', objectives: ['Prepare goals and questions.', 'Set expectations and agree the agenda.'], body: `PREPARE: review your notes on the business (listing, site, reviews, your prior conversations); write three goals; choose eight to ten questions; decide the honest next step you will propose; check the Product Catalog for what is currently available to sell.

OPEN: thank them; state the time you asked for; agree the plan ("I'll ask questions for about fifteen minutes, then tell you what I think, then we decide together whether to do anything"); ask permission to take notes.

FRAME THE OUTCOME: they can say no at any point. That lowers defences and produces more honest answers.

ENVIRONMENT: remote or in person, use a quiet place; close other tabs; put your phone away; have the CRM open only to record afterwards, not to distract you mid-conversation.

REMOTE vs IN-PERSON: the same questions work; in person you can observe the premises (how the phone is answered, where messages are kept), while remotely you rely on their description. Note which you observed and which you were told.

DO NOT record the conversation without permission and Nova's approval of the rules for your location.` },
    { title: 'Asking Layered Questions', objectives: ['Move from broad to specific questions.', 'Use follow-ups to reach the real issue.'], body: `Start broad and open, then narrow with follow-ups. A ladder:
1. SITUATION: "Walk me through what happens when a new customer contacts you."
2. PROBLEM: "What part of that doesn't work as well as you'd like?"
3. IMPACT (in their words, not yours): "What does that mean for you day to day?" — Do not supply a dollar figure. If they offer one, note it as "owner states" and do not repeat it as fact.
4. HISTORY: "What have you tried?" "What happened?"
5. DECISION: "If something were worth changing, who would decide, and how?"

FOLLOW-UP PROMPTS: "Tell me more about that." "What happens next?" "How often does that happen?" "How do you know?" (this last one separates facts from guesses).

LISTEN FOR: workarounds, frustration, missed calls, duplicated work, unanswered messages, no follow-up routine. NOTE their exact words.

AVOID: leading questions ("Wouldn't it be better if…?"), stacking questions, finishing their sentences, and interrupting.

REFLECT: "So if I've got this right, calls after five go to voicemail and you call back next morning when you remember. Is that fair?" Correct anything you got wrong.` },
    { title: 'Recording Findings Honestly', objectives: ['Separate said, observed and assumed.', 'Write findings a manager could rely on.'], body: `Findings are the value you create. Keep three columns in your notes: WHAT THEY SAID (quotes or close paraphrase), WHAT I OBSERVED (things you saw or verified), and WHAT I ASSUME (mark clearly). Only the first two go in as findings; assumptions go in as questions to check.

EXAMPLE (fictional):
Said: "Calls after five go to voicemail; I call back in the morning if I remember."
Observed: Google listing shows open until 6 pm; the site has no booking form.
Assume (to check): some callers do not leave a message.

NEVER convert an owner's estimate into a fact ("owner says they lose about ten jobs a month" stays "owner states…"). NEVER produce revenue-loss figures yourself. The diagnostic, with evidence, is where Nova states findings.

In the CRM, fill the six discovery areas in the owner's terms and write your findings in one to three sentences. The system requires real content: at least three areas answered and a findings sentence.

END OF THE CONVERSATION: summarise back; say honestly whether you think a closer look is worthwhile; if yes, propose the small next step (for example the diagnostic proposal) — the owner decides.` },
    { title: 'Honest Scoping and Moving to a Proposal', objectives: ['Match findings to what is actually available.', 'Never sell beyond the catalog.', 'Prepare an honest written proposal.'], body: `A proposal is the written result of a good discovery, not a reward for a good pitch. Steps:
1. Review your findings and choose only offerings whose readiness label allows a proposal (Available for Sale, or Pilot Approved with the owner's pilot terms shown as a pilot).
2. Use only prices shown as approved in the catalog. If a line has no approved price, the proposal cannot be sent until the owner sets one and records why.
3. Write the scope summary in your own words, describing what the client and Nova will do — not what results they will get. The system rejects promises like "will double your leads".
4. If you want to offer a discount, request it with a reason; only the owner can approve it.
5. If something the client needs is not available (Draft, Internal Test or Paused), tell them honestly and ask your manager whether a pilot or custom scope is possible.

WHEN NOVA IS NOT THE ANSWER: say so and stay friendly. You may leave the lead open with a dated check-in or close it with a reason.

SCRIPT: "From what you've told me, the main gap is evening calls with no callback routine. Nova can look at that in detail and write it up with evidence. I'll send a written proposal so you can see exactly what's included and what it costs before you decide anything."

REMEMBER: the client, not you, signs the proposal; payment goes through Nova's payment page; and Nova verifies the sale before work begins.` },
  ],
  questions: [
    { q: 'What is the primary goal of a discovery conversation?', choices: ['To present Nova\'s services', 'To understand how the business gets and handles inquiries and decide honestly whether Nova can help', 'To get a signature', 'To collect a deposit'], answer: 1, why: 'Diagnosis before prescription.' },
    { q: 'How many discovery areas need real answers before you can mark Discovery Completed?', choices: ['None', 'At least three, plus your written findings', 'All ten', 'Only the decision maker'], answer: 1, why: 'The system requires substance, not a note that says they seemed interested.' },
    { q: 'Which is the better question?', choices: ['"Wouldn\'t it be great if you never missed a call?"', '"What happens when nobody can pick up right away?"', '"Are you ready to buy today?"', '"How much are you losing?"'], answer: 1, why: 'Open, non-leading, invites their real answer.' },
    { q: 'The owner says "I lose about ten jobs a month." How do you record it?', choices: ['"Business loses ten jobs a month."', '"Owner states about ten jobs a month" — labelled as their statement, not fact', 'Ignore it', 'Double it'], answer: 1, why: 'Owner statements are recorded as such; you never present them as verified facts.' },
    { q: 'What separates a finding from an assumption?', choices: ['Confidence', 'Whether the owner said it or you observed it, versus something you guessed', 'Length of the note', 'Who wrote it'], answer: 1, why: 'Said and observed go in as findings; assumptions are marked as things to check.' },
    { q: 'A client needs an offering marked Internal Test. What do you do?', choices: ['Put it in the proposal', 'Tell them it isn\'t available to sell yet and ask your manager about an owner-approved pilot or custom scope', 'Promise it for next month', 'Offer it free'], answer: 1, why: 'Only allowed offerings can be proposed.' },
    { q: 'A line in your proposal has no approved price. What happens?', choices: ['You enter a price you think is fair', 'It cannot be sent until the owner sets a price and records a reason', 'The client sets it', 'The system guesses'], answer: 1, why: 'Prices come only from approved sources.' },
    { q: 'Which scope sentence is allowed?', choices: ['"This will double your inquiries."', '"Nova will review how calls and inquiries are handled and write up findings with evidence."', '"You will never miss a call again."', '"We guarantee a 30% increase."'], answer: 1, why: 'Scopes describe what will be done, not promised results.' },
    { q: 'You realise midway that Nova is not a fit. What is right?', choices: ['Keep pitching', 'Say so honestly and stay friendly; leave the lead open with a dated check-in or close it with a reason', 'Push a different product', 'End the call abruptly'], answer: 1, why: 'Honesty builds trust and saves time.' },
    { q: 'Who can approve a discount on a proposal?', choices: ['The representative', 'The client', 'Only the owner', 'Any manager'], answer: 2, why: 'Discounts are owner decisions.' },
  ],
  exercises: [
    { lesson_order: 3, title: 'Build a question ladder', prompt: 'Write five layered questions (situation, problem, impact, history, decision) for a discovery conversation with a local service business. For each, add one follow-up prompt.', self_check: ['Are the questions open and non-leading?', 'Does any question supply a number or assume the answer?', 'Does each have a natural follow-up?'], model_answer: '1) "Walk me through what happens when a new customer contacts you." Follow-up: "What happens next?" 2) "What part of that doesn\'t work as well as you\'d like?" Follow-up: "How often?" 3) "What does that mean for you day to day?" Follow-up: "How do you know?" 4) "What have you tried?" Follow-up: "What happened?" 5) "If something were worth changing, who would decide?" Follow-up: "How does that usually work?"' },
    { lesson_order: 4, title: 'Sort said, observed and assumed', prompt: 'Read this: "The owner says calls after 5 go to voicemail. The listing says open till 6. I think he loses customers." Rewrite it as three labelled lines: Said / Observed / Assume (to check).', self_check: ['Did you keep "loses customers" as an assumption to check?', 'Did you avoid adding any figure?'], model_answer: 'Said: calls after 5 go to voicemail. Observed: the listing shows open until 6 pm. Assume (to check): some callers do not leave a message and may not call back.' },
  ],
};
