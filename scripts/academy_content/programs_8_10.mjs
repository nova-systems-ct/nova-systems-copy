// Nova Sales Academy v2 content — programs 8–10. Program 10 is the final assessment: it contains critical questions and, by design,
// carries NO commission percentages — how commission works is taught as a process; rates come only from the owner-approved plan.
export const p8 = {
  slug: 'follow-up-and-scheduling', version: 2,
  objectives: ['Design a follow-up cadence that adds value and does not annoy.', 'Schedule conversations with minimal friction.', 'Handle no-shows, reschedules and silence.', 'Use next actions and reminders so nothing is forgotten.'],
  lessons: [
    { title: 'The Follow-Up Mindset', objectives: ['Explain why most opportunities are lost to silence, not to no.', 'Follow up with purpose.'], body: `Most leads that go quiet are not saying no — they are busy. A good follow-up is a service: it makes it easy for a busy person to respond. A bad one is a nag. The difference is purpose. Before each follow-up, ask "What does this add?" — a clearer question, a helpful observation, a simpler way to reply, or a specific time offered.

PRINCIPLES:
• Every open lead has one next action with a date. That is your follow-up plan.
• Stay useful: reference the last conversation specifically.
• Vary the channel sensibly (email, call, message with consent) rather than repeating the same one.
• Stop gracefully: after a defined number of touches, close the loop with a polite note and set a longer-term check-in or close the lead.

WHAT NOT TO DO: send "just checking in" messages; guilt-trip ("I haven't heard back from you"); invent urgency; contact people who asked to stop; follow up more often than your manager's guidance.

EXAMPLE (fictional): After discovery, two days later: "Hi Dana — thanks for walking me through how calls are handled. As promised, here's what I understood: after-hours calls go to voicemail and get returned next morning. If that's right, the next step would be a written proposal — would Thursday at 10 suit to go through it?"` },
    { title: 'A Cadence That Works', objectives: ['Plan touches across days.', 'Match cadence to lead stage.'], body: `A sensible baseline (your manager may adjust it):
• After a first conversation: a same-day thank-you and next-step note.
• If no reply: a follow-up in two to three business days; another about a week later; then a final closing note; then rest for several weeks.
• After a proposal is sent: check once after two or three days ("Did the proposal reach you? Happy to walk through it"); once more at about a week; then ask whether it makes sense to close the loop.
• After a signature: stay in touch on what happens next, but remember payment and verification are separate steps.

USE THE SYSTEM: set the next action and date after every touch; your Home screen lists overdue follow-ups and stale leads. Overdue follow-ups are visible to your manager — not as punishment, but so help can arrive.

SEASONAL AND TIMING SENSE: avoid Monday mornings and end of day Friday for many service businesses; ask them when they prefer to be contacted, and honour it.

CADENCE LIMITS: never contact the same person on the same day through multiple channels; never exceed the touches your manager sets; and always stop on request.` },
    { title: 'Scheduling Without Friction', objectives: ['Offer specific times.', 'Confirm and remind.', 'Record it correctly.'], body: `Scheduling is where good conversations die. Make it effortless:
1. OFFER TWO SPECIFIC TIMES, in their time zone. Not "when are you free?"
2. CONFIRM in writing: date, time, time zone, who will attend, how you will connect, how long.
3. SEND A REMINDER the day before, short and useful.
4. HAVE A FALLBACK: offer to reschedule in one message if something comes up.

EXAMPLE CONFIRMATION (approved wording): "Hi Dana — confirming Tuesday at 10:00 (Eastern) by phone, 20 minutes. I'll call you at the number I have. Reply if you'd like to move it."

REMINDER: "See you tomorrow at 10 — no preparation needed."

WHEN THE TIME IS SET, in the system: move to Discovery Scheduled with the real future date and time (the system requires it), and add a task or reminder for your preparation.

TIME ZONES: state them explicitly. If the client is in a different zone, write both.

IF A HELPFUL SCHEDULING TOOL IS APPROVED by Nova, use it; otherwise keep to email and phone. Do not send links to unknown tools.` },
    { title: 'No-Shows, Reschedules and Silence', objectives: ['Handle a missed appointment gracefully.', 'Reschedule kindly.', 'Know when to stop.'], body: `People miss appointments; it usually is not personal.

NO-SHOW: wait ten minutes, then send one message: "Hi Dana — I think we missed each other. No problem — would Thursday at 2 or Friday at 10 suit better?" If there is no reply, try once more in a couple of days by a different channel. Two tries, then set a longer check-in or close the lead with a reason.

RESCHEDULE REQUESTS: accept cheerfully; propose two new times; update the date in the system so your calendar and pipeline stay true.

CANCELLATIONS: thank them for the notice; ask if there's a better time, once; then respect the answer.

SILENCE AFTER A PROPOSAL: it is normal. Offer help once — "Would it help if I walked you through it?" — then leave space. Do not pressure. If the proposal expires, it is an opportunity to ask what would make sense, not to argue.

MARK LEADS HONESTLY: a lead that has gone silent for weeks with no reply is either given a dated long-term check-in or closed with a reason (for example no response). Do not leave zombie leads open.

KEEP YOUR DIGNITY: never send irritated messages. A calm, helpful tone today is why someone calls you in six months.` },
    { title: 'Reminders, Tasks and Weekly Rhythm', objectives: ['Use tasks and reminders.', 'Run a weekly review.', 'Keep an honest pipeline.'], body: `A simple weekly rhythm keeps you reliable:
• MONDAY: review overdue follow-ups, today's scheduled conversations, and leads with no next action; plan the week.
• DAILY: log activities as they happen; set a next action every time; do your scheduled calls first.
• FRIDAY: close dead leads with reasons; review what worked; note one improvement; check your training and documents for anything due.

TASKS vs REMINDERS: a task is something you must do (send a proposal); a reminder nudges you at a time. Both need a due date.

TIME BLOCKS: protect an hour a day for outreach when people are most reachable, and another for follow-ups and records.

WHAT YOUR MANAGER SEES: your leads, stages, overdue follow-ups and activity you recorded. They use it to help you, not to spy on you: there is no screen or location tracking.

SELF-CHECK QUESTIONS: Which lead did I forget? Which lead is ready for a proposal but has none? Which lead should I close? What one thing will I do better next week?` },
  ],
  questions: [
    { q: 'What is the difference between a good follow-up and a nag?', choices: ['Frequency', 'A good one adds something — clarity, an observation, a simpler way to reply, specific times', 'The channel used', 'Length'], answer: 1, why: 'Purpose separates service from pressure.' },
    { q: 'How should you offer meeting times?', choices: ['"When are you free?"', 'Two specific times in their time zone', 'Ask them to pick from a long list', 'Only one time, take it or leave it'], answer: 1, why: 'Specific options reduce friction.' },
    { q: 'A prospect misses a scheduled call. What is the right first step?', choices: ['Send an angry message', 'Wait ten minutes, then send one friendly message offering two new times', 'Close the lead', 'Call five times'], answer: 1, why: 'Assume good faith; make it easy.' },
    { q: 'What happens to a lead that has been silent for weeks?', choices: ['It stays open forever', 'Give it a dated long-term check-in or close it with a reason', 'Move it to Won', 'Delete it'], answer: 1, why: 'Zombie leads hide the ones that matter.' },
    { q: 'For Discovery Scheduled, which is required?', choices: ['A signed contract', 'A real future date and time and a named contact', 'Manager approval', 'A price'], answer: 1, why: 'Stage rules keep the pipeline honest.' },
    { q: 'A contact asked you to stop contacting them, and it is time for your follow-up. What do you do?', choices: ['Send it anyway', 'Do not contact; the flag is final', 'Ask a colleague to send it', 'Email instead'], answer: 1, why: 'A request to stop overrides any cadence.' },
    { q: 'Which is an acceptable follow-up?', choices: ['"Just checking in!"', '"Thanks for walking me through how calls are handled. Here\'s what I understood — is that right? Would Thursday at 10 suit to go through a proposal?"', '"Last chance — offer ends today!"', '"Why haven\'t you replied?"'], answer: 1, why: 'Specific, useful, easy to answer.' },
    { q: 'After sending a proposal, what is a sensible cadence?', choices: ['Daily calls', 'One check after two or three days, another at about a week, then ask whether to close the loop', 'Never contact them', 'Twice a day'], answer: 1, why: 'Space and purpose.' },
    { q: 'Who sees your overdue follow-ups?', choices: ['Only you', 'You and your manager, so help can arrive', 'Every representative', 'The client'], answer: 1, why: 'Managers see them to support you; other reps cannot see your leads.' },
    { q: 'A client reschedules twice. What is right?', choices: ['Refuse', 'Accept kindly, update the date in the system, and if it continues ask once what would suit better', 'Charge a fee', 'Close the lead immediately'], answer: 1, why: 'Stay gracious, keep records true.' },
  ],
  exercises: [
    { lesson_order: 3, title: 'Write the confirmation and reminder', prompt: 'Write the confirmation message and the day-before reminder for a 20-minute discovery call.', self_check: ['Do both state date, time and time zone?', 'Is there an easy way to reschedule?', 'Do you say no preparation is needed?'], model_answer: 'Confirmation: "Hi Dana — confirming Tuesday at 10:00 (Eastern) by phone, 20 minutes. I\'ll call the number I have. Reply if you\'d like to move it." Reminder: "See you tomorrow at 10 — no preparation needed."' },
    { lesson_order: 4, title: 'The no-show message', prompt: 'A prospect did not answer your scheduled call. Write your first message.', self_check: ['Is it friendly and blame-free?', 'Does it offer two specific new times?'], model_answer: '"Hi Dana — I think we missed each other. No problem — would Thursday at 2 or Friday at 10 suit better?"' },
  ],
};

export const p9 = {
  slug: 'crm-and-data-protection', version: 2,
  objectives: ['Record leads, contacts and activities accurately in the Nova CRM.', 'Protect prospect and client data and Nova\'s confidential information.', 'Recognise sensitive data you must never collect or store.', 'Report mistakes and suspected breaches immediately.'],
  lessons: [
    { title: 'Why Records Matter', objectives: ['Explain what the CRM is for.', 'Write factual, useful records.'], body: `The CRM is Nova's memory. It lets a manager help you, lets a colleague cover for you, protects you if a dispute arises, and is the basis for verification and commission. Records must be true, factual and useful.

GOOD RECORD: "Called 10:05, spoke with Dana (owner). She said after-hours calls go to voicemail and she returns them next morning. Asked for a 20-minute conversation; agreed Tuesday 10:00. Next action: send confirmation today."
BAD RECORD: "Good call, she loves us."

WHAT TO RECORD: date and time, channel, who you spoke to, what they said in their words, what you observed, the outcome, and the next action with a date.
WHAT NOT TO RECORD: guesses about money, personal opinions about people, health, family or other private details, and anything discriminatory.

ONE RECORD, NOT MANY: there is one CRM. Do not keep parallel spreadsheets or notes in personal apps with prospect data. If you need a private reminder, use the CRM's task or reminder feature.

ACCURACY BELONGS TO YOU: if you realise you recorded something wrong, correct it and add a note. Never edit history to look better.` },
    { title: 'Leads, Contacts, Stages and Duplicates', objectives: ['Use stages according to their entry rules.', 'Avoid duplicates and stolen leads.', 'Use lost reasons honestly.'], body: `Each lead is a business plus a contact plus a pipeline stage. The stages are New, Contacted, Qualified, Discovery Scheduled, Discovery Completed, Proposal, Awaiting Signature/Payment, Submitted for Verification, Won and Lost. Some you set yourself with evidence (Contacted needs a logged attempt; Qualified needs a summary and a decision-maker answer; Discovery Scheduled needs a future time; Discovery Completed needs real discovery notes). Others happen through their own steps (Proposal, Awaiting, Submitted, Won).

DUPLICATES: before creating a prospect, the system checks whether the business is already being worked; you will see a neutral message. Do not try to alter names, websites or phone numbers to slip past it. If it seems wrong, ask your manager.

LOST: choose a reason code and write what happened. You can reopen your own lost lead with a real reason, unless the contact asked not to be contacted or another rep now has the prospect.

DO-NOT-CONTACT: mark it the moment someone asks. Only the owner can clear it, and only with documented permission from the contact.

CONSENT FLAGS: you cannot set them. They come from the contact.

CHECK: before you close a lead as lost, ask "Is my reason true and complete?" A vague reason hurts your manager's ability to help.` },
    { title: 'Protecting Data', objectives: ['Handle personal and business data carefully.', 'Never collect sensitive identifiers.', 'Use approved tools and channels only.'], body: `You will handle names, phone numbers, emails, business details and notes. Protect them:
• NEVER collect or store: social security numbers, government ID numbers, driver's licence details, bank account or routing numbers, card numbers, passwords, tax identifiers. If a person volunteers one, tell them not to, do not write it down, and tell your manager if it was sent to you in writing.
• Use only Nova-approved tools; do not copy lead data into personal notes, chat apps or unapproved spreadsheets; do not forward lead data to personal email.
• Log in only on devices you control; never share your login; use a strong password; sign out on shared computers.
• Do not discuss one client's or prospect's information with another. Do not post about clients on social media.
• Confidential Nova information (pricing decisions, commission plans, internal documents) stays inside Nova.
• Keep screens private in public places.

CLIENT PAYMENTS: card or bank details are entered only on the payment provider's hosted page. You never see or store them.

PROSPECT RIGHTS: if a person asks what you hold about them or asks to be deleted, do not promise anything you cannot do; tell your manager, who will handle it through Nova's process.

CHECK: If this data was leaked, could it harm someone? If yes, it needs extra care.` },
    { title: 'Documents, Signatures and Records of Consent', objectives: ['Understand your own agreements and their versions.', 'Sign only what you have read.', 'Know what stays private.'], body: `In Nova you will sign agreements electronically: the working agreement, compensation schedule, confidentiality and acceptable-use policies. Each is a specific version; if Nova changes one materially, you must sign the new version.

HOW SIGNING WORKS: open the document (this is recorded), read it, agree to sign electronically, type your full name (and optionally draw your signature), and submit. The server records the time, the version and a fingerprint of what you signed. You can download a copy. Nova countersigns some documents. Ask questions before you sign; do not sign something you do not understand.

WHAT STAYS PRIVATE: your signed documents, your compensation details and your application are visible to you, your manager and Nova's owner as needed — not to other representatives. Do not share them.

CLIENT SIGNATURES: clients sign proposals through a personal link. You cannot sign for a client, cannot mark a signature as genuine, and must never pressure a client to sign quickly. If a client says they signed offline, submit it with detailed evidence — the owner must verify it.

RETENTION: do not delete records to hide mistakes. Nova keeps history so that everything can be reviewed fairly.

BEFORE YOU SIGN: (1) Have I read it? (2) Do I understand the compensation and conditions? (3) Have I asked about anything unclear?` },
    { title: 'Mistakes, Incidents and Reporting', objectives: ['Report errors and suspected breaches at once.', 'Understand that early reporting is protected.'], body: `Mistakes happen. What matters is how quickly you report them. Tell your manager immediately if you: sent a message to the wrong person; contacted someone who asked to stop; received or stored sensitive information; lost a device with Nova access; clicked something suspicious; noticed someone else's data you should not see; or believe an account has been misused.

WHAT TO DO: (1) stop; (2) do not try to hide or fix it silently; (3) write down what happened factually; (4) tell your manager; (5) follow their instructions.

NO PUNISHMENT FOR EARLY, HONEST REPORTING: the aim is to protect people. Concealment is what creates serious problems.

PHISHING AND IMPERSONATION: Nova will never ask you by message for your password, payment codes or to change payout details. If you receive such a request, report it.

SUSPENDED ACCOUNTS: if your access is suspended, do not try to work around it; contact your manager. Your history is kept.

MONITORING: Nova looks at what you record in the platform. It does not record your screen, track your location or read personal messages.` },
  ],
  questions: [
    { q: 'Which is the best CRM note?', choices: ['"Good call, she loves us."', '"Called 10:05, spoke with Dana (owner). After-hours calls go to voicemail; she returns them next morning. Agreed Tuesday 10:00. Next: send confirmation."', '"Probably losing money."', '"Try again."'], answer: 1, why: 'Factual, specific, with a next action.' },
    { q: 'A prospect volunteers their social security number. What do you do?', choices: ['Write it in the notes', 'Tell them not to share it, do not record it, and tell your manager if it arrived in writing', 'Ask them to email it', 'Store it in a spreadsheet'], answer: 1, why: 'Sensitive identifiers are never collected in sales.', critical: true },
    { q: 'Where may you enter a client\'s card details?', choices: ['In the CRM notes', 'In an email to yourself', 'Only on the payment provider\'s hosted payment page — never in Nova systems or notes', 'In a spreadsheet'], answer: 2, why: 'Nova and reps never see or store card data.', critical: true },
    { q: 'The system says a business is already being worked. What do you do?', choices: ['Change the website spelling and retry', 'Ask your manager; never try to bypass the check', 'Use another rep\'s account', 'Contact them anyway'], answer: 1, why: 'The check protects owners and other reps.' },
    { q: 'You made an error in a record. What now?', choices: ['Delete the record', 'Correct it and add a note; never rewrite history to look better', 'Ignore it', 'Blame a colleague'], answer: 1, why: 'Records are honest; history is kept.' },
    { q: 'Where may you keep lead data?', choices: ['A personal notes app', 'Personal email', 'Only in the Nova CRM and Nova-approved tools', 'A shared public document'], answer: 2, why: 'One CRM; no personal copies.' },
    { q: 'Someone emails claiming to be Nova and asks for your password. What do you do?', choices: ['Send it', 'Do not; report it to your manager — Nova never asks for passwords by message', 'Reply asking why', 'Forward it to a colleague'], answer: 1, why: 'Phishing and impersonation must be reported.' },
    { q: 'A client says they signed a paper copy. How do you record the sale?', choices: ['Mark it Won', 'Submit it for verification with detailed evidence; the owner must verify', 'Sign it yourself', 'Ignore it'], answer: 1, why: 'Only verified signatures count; reps cannot mark them genuine.' },
    { q: 'What does Nova monitor about you?', choices: ['Screen, location and messages', 'Only the activity you record in the platform', 'Your personal phone', 'Nothing at all'], answer: 1, why: 'No covert surveillance.' },
    { q: 'You realise you emailed a prospect who had asked to stop. What do you do?', choices: ['Hope they don\'t notice', 'Tell your manager right away, write down what happened, and make sure the flag is set', 'Delete the email', 'Send an apology every day'], answer: 1, why: 'Early honest reporting protects everyone.' },
  ],
  exercises: [
    { lesson_order: 1, title: 'Rewrite a weak note', prompt: 'Rewrite this into a good CRM note: "Talked to the owner, seems interested, they lose a lot of business, follow up soon." Use only facts you would plausibly know from a real conversation (invent plausible neutral details clearly as an example).', self_check: ['Does it include date, channel, who and what was said?', 'Did you remove guesses about losses?', 'Is there a dated next action?'], model_answer: '"Called Tue 10:05, spoke with Dana (owner). She said after-hours calls go to voicemail and she calls back next morning. She agreed to a 20-minute conversation Thu 10:00. Next action: send confirmation today."' },
    { lesson_order: 3, title: 'What do you do with this?', prompt: 'A client emails you a photo of their driver\'s licence "to prove who they are." What are your next three steps?', self_check: ['Do you avoid saving or forwarding it?', 'Do you tell your manager?', 'Do you reply explaining Nova does not need it?'], model_answer: '1) Do not save, forward or store it. 2) Tell your manager right away so it is handled properly. 3) Reply kindly: "Thanks — we don\'t need identification documents. Please don\'t send any; we\'ll confirm details another way."' },
  ],
};

export const p10 = {
  slug: 'ethics-commission-final-assessment', version: 2,
  objectives: ['Apply Nova\'s sales ethics to real situations.', 'Explain how commission works as a process — plan, conditions, verification, approval, payout — without assuming any rate.', 'Show consistent judgment across everything in the Academy.', 'Handle critical-compliance questions correctly.'],
  lessons: [
    { title: 'Nova\'s Sales Ethics in One Page', objectives: ['State the core rules.', 'Apply them under pressure.'], body: `The core rules, everywhere and always:
1. TELL THE TRUTH. No guarantees, no invented figures, no fake case studies, no pretending.
2. DIAGNOSE BEFORE YOU PRESCRIBE. Ask, listen, record, then propose.
3. RESPECT PEOPLE'S "NO". Stop when asked, mark it, do not return without an invitation.
4. COLLECT NO SENSITIVE IDENTIFIERS. Never government IDs, tax IDs, bank or card numbers.
5. QUOTE ONLY WHAT IS APPROVED. Prices, timelines, terms and offerings come from what the owner approved.
6. LET THE SYSTEM BE THE RECORD. Do not claim a close, a signature or a payment the system has not recorded.
7. DO NOT WORK AROUND CONTROLS. Do not bypass duplicate checks, stage rules, approvals or permissions.
8. SPEAK UP. Tell your manager when something feels wrong.

UNDER PRESSURE: a hard month, a demanding client or a tempting shortcut is exactly when these rules matter. If a shortcut would make you uncomfortable if the owner watched, it is the wrong shortcut.

SCENARIO: a client says "I'll sign today if you guarantee I'll get twice the customers." Correct response: "I can't promise that and I wouldn't trust anyone who did. What I can promise is a clear written scope and that we'll show you what we find with evidence. Would you like me to send the proposal to review?" Then stop pressing.

REMEMBER: the company you represent is trusted because its people are honest. Every honest "I don't know" is an investment in that trust.` },
    { title: 'How Commission Works — the Process', objectives: ['Trace a commission from sale to payout.', 'Explain conditions and who approves what.', 'Avoid assuming any rate or promising pay.'], body: `THIS LESSON TEACHES THE PROCESS, NOT THE NUMBERS. Rates and conditions come only from the commission plan the owner has approved; if you are told a rate by anyone else, it is not authoritative. Never state or promise a rate to anyone.

THE PATH:
1. You submit a closed sale for verification. The system may show an ESTIMATED commission if an approved plan exists. Estimated commission is not earned; it can change or be cancelled.
2. The owner VERIFIES the sale. The entry becomes PENDING CONDITIONS.
3. CONDITIONS are those in your approved plan — for example that the client's payment has been received, and any hold-back period the plan defines. When they are met the entry becomes ELIGIBLE.
4. Finance/owner APPROVES eligible entries (OWNER APPROVED). You cannot approve your own.
5. The owner approves a concrete PAYOUT BATCH; entries become SCHEDULED.
6. Payment is made. It becomes PAID only when a payment provider confirms it or the owner records an external payment with evidence (labelled as recorded by Nova, not provider-confirmed).

IF SOMETHING GOES WRONG: a refund or dispute before payment reverses the entry; after payment it creates an adjustment that the owner decides, never a silent deduction. A failed payout shows as Failed and is retried by the owner.

YOUR EARNINGS SCREEN keeps Estimated, Pending, Eligible, Approved and Paid separate. Do not add them together and call it income.

YOU MAY NOT: change your commission, approve it, record a payment, or promise anyone pay. Questions go to your manager or the owner.

PAYOUT ACCOUNT: if payouts go through a provider, you complete a provider-hosted onboarding page; Nova never sees your bank details.` },
    { title: 'Conflicts of Interest, Gifts and Honesty With Clients', objectives: ['Recognise conflicts.', 'Handle gifts and side deals.', 'Stay honest when it costs you.'], body: `Conflicts of interest arise when a personal interest could influence your judgment for Nova or a client. Examples: selling to a friend or family member's business without telling your manager; taking a payment or gift from a client; steering a client to a decision because of how you would be paid; offering a side deal outside Nova's system.

RULES:
• Disclose any personal connection to a prospect before working the lead.
• Do not accept gifts beyond token courtesy; never accept money or favours.
• Do not make private arrangements with a client outside the platform, including payment.
• Do not discourage a client from something that would be good for them because it pays you less.
• Do not discuss commission with clients or promise anything about how you are paid.

WHEN YOU MAKE A MISTAKE WITH A CLIENT: tell them honestly and tell your manager. A fixed mistake is forgiven; a hidden one is not.

WHEN A CLIENT WOULD BE BETTER OFF WITHOUT US: say so. Nova's reputation grows from clients who were told the truth.

DO NOT SELL WHAT DOES NOT EXIST: if an offering is not available, do not sell it, even if the client would pay. Ask your manager about an owner-approved pilot or custom scope.

SCENARIO: a friend's restaurant wants a discount because "we're friends." Correct response: disclose the connection to your manager, request any discount through the system with an honest reason, and let the owner decide.` },
    { title: 'Putting It All Together: Case Studies', objectives: ['Apply the Academy to end-to-end scenarios.', 'Identify errors and better choices.'], body: `Read each case, decide what you would do, then compare.

CASE 1 — "Free pilot, testimonial required." A client wants a discount; a colleague suggests "free pilot if they give us a glowing testimonial." Correct: do not. Discounts and pilots are owner decisions, and testimonial-for-discount arrangements are not allowed. Request the discount through the system with an honest reason.

CASE 2 — Paper signature. A client hands you a signed paper agreement. Correct: do not mark anything won. Submit for verification with detailed evidence; the owner verifies. Do not scan or upload identity documents.

CASE 3 — Missed quota pressure. It is the last day of the month; a lead says "maybe next week." Correct: log it truthfully; do not submit a sale that has not closed; do not invent urgency.

CASE 4 — Text without consent. A contact gave their mobile number on the phone. Correct: confirm by email or ask for consent on the call so it is recorded; do not text until it is.

CASE 5 — Delayed audit. A client asks "When will I get the audit?" and no turnaround is approved. Correct: "I'll confirm the timing and get back to you" — then ask your manager. Do not quote 24 or 72 hours unless the owner has approved that statement in the toolkit.

CASE 6 — Wrong send. You emailed a proposal to the wrong address. Correct: tell your manager immediately; recall the proposal so the link stops working; do not hide it.

CASE 7 — Client asks for a price you don't have. Correct: the scope decides it; a written proposal will contain the price; only approved prices are quoted.

Use these cases as a self-test before the final assessment.` },
    { title: 'Final Assessment: What to Expect', objectives: ['Understand the rules of the final assessment.', 'Know how critical questions work.'], body: `The final assessment covers the whole Academy. It is graded by the server against a stored answer key you never see; your score, the pass mark, and the number of attempts follow the Academy policy the owner has approved. If that policy is still pending, results are shown as provisional and the certificate will say so.

CRITICAL QUESTIONS test the rules that must never be broken: stopping when asked, never collecting sensitive identifiers, never guaranteeing results, never quoting unapproved prices, and never claiming a sale the system has not recorded. If you miss a critical question you cannot pass on score alone. A reviewer will look at the result and talk with you; the owner decides whether you retake or can proceed. This is not a punishment — it is how Nova makes sure the essentials are understood.

PRACTICAL ASSESSMENTS in Programs 6 and 7 must be approved by a reviewer before you can be certified in those programs. Completing training never activates an account: activation is a separate decision by the owner after your agreements are signed and setup is verified.

HOW TO PREPARE: re-read the lessons you found hardest; redo the exercises; walk through the seven cases; ask your manager about anything you are unsure of. Do not memorise answers — the questions test judgment.

CERTIFICATES: when you complete a program you can download an internal Nova certificate with a unique ID. Anyone can verify its validity with the verification code. It is a Nova training record — not an accredited or third-party credential and not an authorisation to act for Nova.` },
  ],
  questions: [
    { q: 'A client says "I\'ll sign today if you guarantee twice the customers." What do you say?', choices: ['"I guarantee it."', '"I can\'t promise that; what I can offer is a clear written scope and evidence-based findings. Shall I send the proposal to review?"', '"Yes, probably."', '"Sign now and I\'ll make it happen."'], answer: 1, why: 'Never guarantee results.', critical: true },
    { q: 'A contact tells you to stop contacting them. What do you do?', choices: ['Finish your pitch', 'Stop, mark do-not-contact, and do not contact again', 'Send one more email', 'Ask a colleague to try'], answer: 1, why: 'A request to stop is final.', critical: true },
    { q: 'A client offers to email a photo of their government ID "for verification". What do you do?', choices: ['Accept and store it', 'Decline; sales never collects government or tax identifiers; tell your manager if it was sent', 'Ask them to also send a bank statement', 'Forward it to the owner'], answer: 1, why: 'Sensitive identifiers are never collected.', critical: true },
    { q: 'A client asks the price of an offering that has no approved price. What do you do?', choices: ['Quote what you think', 'Say the scope decides it, and that a written proposal will show the price; do not quote an unapproved figure', 'Guess a range', 'Say it is free'], answer: 1, why: 'Only approved prices.', critical: true },
    { q: 'A client says they signed a paper agreement. What do you do?', choices: ['Mark the lead Won', 'Submit it for verification with detailed evidence and let the owner verify; never mark it won or genuine yourself', 'Sign for them', 'Ignore it'], answer: 1, why: 'Reps cannot mark signatures genuine or sales won.', critical: true },
    { q: 'Where does the commission rate come from?', choices: ['Your manager\'s promise', 'A colleague', 'Only the commission plan the owner has approved', 'What you estimate'], answer: 2, why: 'Never assume or state a rate.' },
    { q: 'An estimated commission is…', choices: ['Earned', 'Not earned; it can change or be cancelled', 'Guaranteed', 'Paid'], answer: 1, why: 'Estimated ≠ earned.' },
    { q: 'When does a commission become "Paid"?', choices: ['When you say so', 'When a payment provider confirms it, or when the owner records an externally made payment with evidence (labelled as recorded by Nova)', 'When the client signs', 'When it is eligible'], answer: 1, why: 'No button manufactures success.' },
    { q: 'A client refunds after your commission was paid. What happens?', choices: ['Nothing', 'An adjustment is recorded and the owner decides; it is never a silent deduction', 'You must repay immediately', 'The client is charged'], answer: 1, why: 'Clawbacks are explicit owner decisions.' },
    { q: 'You are related to a business owner you would like to sell to. What do you do?', choices: ['Sell quietly', 'Disclose to your manager before working the lead and let them decide', 'Give a private discount', 'Sell outside the platform'], answer: 1, why: 'Disclose conflicts of interest first.' },
    { q: 'A client asks "When will I get the audit?" and no turnaround is approved. What do you say?', choices: ['"24 hours."', '"72 hours."', '"I\'ll confirm the timing and get back to you."', '"Immediately."'], answer: 2, why: 'Turnaround times must be approved before they are promised.' },
    { q: 'Training is complete and all your quizzes are passed. What happens to your account?', choices: ['It is activated automatically', 'Nothing automatically: the owner activates it after agreements are signed and setup is verified', 'You can start selling anyway', 'The manager activates it'], answer: 1, why: 'Training never activates an account.' },
  ],
  exercises: [
    { lesson_order: 2, title: 'Explain commission to a friend', prompt: 'A friend asks how you get paid. Write a short, honest answer that does not state any rate or promise any amount.', self_check: ['Did you avoid numbers and promises?', 'Did you describe verification and conditions?', 'Did you say it comes from the owner-approved plan?'], model_answer: '"I\'m paid a commission under a plan Nova has approved. A sale has to be verified and the client\'s payment received before it becomes eligible, then it\'s approved and paid. I can\'t promise any amount — it depends on real, verified sales."' },
    { lesson_order: 4, title: 'Choose your response', prompt: 'Pick two of the seven cases and write in two sentences what you would do and why.', self_check: ['Do your choices follow the ethics rules?', 'Did you say who you would tell (manager/owner)?'], model_answer: 'Case 4: I would confirm by email and ask for consent on the call so it is recorded, because texting without recorded consent is not allowed. Case 6: I would tell my manager at once and recall the proposal so the link stops working, because hiding it would be worse.' },
  ],
};
