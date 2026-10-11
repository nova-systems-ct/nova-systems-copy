// Nova Sales Academy v2 content — programs 1–3. Written for Nova's diagnosis-first approach.
// Rules every line here follows: no invented revenue-loss figures, no guaranteed outcomes, no unapproved prices or turnaround times,
// no testimonial-required pilots, no estimates presented as revenue. Anti-examples are always marked "NEVER SAY".
// Content is loaded as PENDING OWNER REVIEW; nothing is "approved" until the owner approves each program.

export const p1 = {
  slug: 'nova-fundamentals', version: 2,
  objectives: ['Explain what Nova sells and how the diagnostic-first approach differs from a typical agency pitch.', 'Describe the operating loop and where a representative fits inside it.', 'State exactly what a representative may and may not say, promise, quote or collect.', 'Use the Product Catalog readiness labels to decide what may be proposed.'],
  lessons: [
    { title: 'What Nova Sells — and What It Does Not', objectives: ['Explain Nova\'s core loop: Observe, Diagnose, Prioritize, Act, Measure, Learn.', 'Tell Nova apart from a generic website agency, chatbot vendor or AI-phone company.', 'Say what a representative opens with: an evidence-based diagnostic, not a finished solution.'], body: `Nova Systems helps small and mid-sized businesses find out where their customer journey leaks and then, if the owner wants it, fixes those specific things. The word that matters is "find out". A representative does not open with a product. A representative opens with a question: "How do new customers reach you today, and what happens to the ones who don't get an answer?"

Nova's operating loop is Observe → Diagnose → Prioritize → Act → Measure → Learn. Almost all of a representative's work lives in the first step: earning permission to look. Diagnosis, prioritisation and delivery belong to Nova's delivery team, and they only happen once the owner agrees to a scope.

WHY THIS ORDER: a business owner has heard "we build websites" and "we run ads" a hundred times. What they rarely hear is "before you spend anything, let us show you what is actually happening to your inquiries, with evidence." That is a different conversation, and it is the one Nova has.

EXAMPLE (fictional): A weak opening is "We do websites, social media and AI phone answering for small businesses." A Nova opening is "I look at how a local business handles a new customer today — the phone, the website, the follow-up — and write down what I find so you can decide what, if anything, is worth fixing."

CHECKLIST — you are on track when your first sentence: (1) is about the prospect's customers, not Nova's services; (2) promises nothing; (3) asks for a short conversation, not a purchase.` },
    { title: 'Where the Representative Fits in the Process', objectives: ['Map the journey from first contact to delivered work.', 'Identify the exact handoffs between representative, reviewer and delivery team.', 'Recognise which steps need the owner\'s approval.'], body: `The journey has these steps: first contact → discovery conversation → proposal → client signature → payment → Nova verifies the sale → fulfilment begins → commission is calculated under the approved plan. A representative owns the first three steps and supports the fourth. After the client signs, three separate things must happen and none of them is decided by the representative: payment has to be received, Nova has to verify the sale, and fulfilment has to start.

WHAT "CLOSED" MEANS: in Nova's system a sale is not closed because you say it is. "Rep reported close", "client signed", "payment received", "Nova verified" and "fulfilment started" are five different facts, each recorded by a different step. You will see them side by side on every deal. This protects clients (nobody starts work before it is real) and it protects you (your commission rests on verified facts).

WHAT YOU CANNOT DO: set or change a price, approve your own discount, mark a signature or payment as genuine, mark a deal Won, start fulfilment, or approve commission. If you find yourself wishing you could, that is the system working as intended — send the question to your manager.

SCRIPT for a client who asks "When does work start?": "Once you've signed and the payment is in, our team verifies everything on our side and then schedules the work. I'll tell you as soon as that's confirmed — I don't want to promise a date I don't control."` },
    { title: 'What You May Say — and What You Must Never Say', objectives: ['List the claims a representative may make.', 'Recognise the five forbidden kinds of statement.', 'Use the honest fallback when you do not know.'], body: `You MAY say: what Nova looks at (website, mobile experience, listings, reviews, how calls and inquiries are handled, follow-up); that findings are written down with evidence; that the owner decides what happens next; and the factual product descriptions in the Product Catalog for offerings marked Available for Sale.

You must NEVER say or imply:
1. A guaranteed result. NEVER SAY "we guarantee more customers" or "this will double your leads".
2. An invented number about the prospect's business. NEVER SAY "you're losing thousands a month" — nobody knows that until an investigation supports it, and even then Nova states it with its evidence, not you.
3. A price that is not shown as approved in the Product Catalog. If there is no approved price, say the scope decides it and that you will bring a written proposal.
4. A turnaround time Nova has not approved. If the owner has approved audit terms they appear in the Sales Toolkit; if not, say "I'll confirm the timing and get back to you."
5. A "free pilot in exchange for a testimonial", a made-up case study, or a claim about another client's results.

THE HONEST FALLBACK: "I don't know that yet — let me find out and come back to you." It is never wrong, it builds trust, and it is always allowed.

PRACTICE: read your last three messages to prospects (or write three imaginary ones). Underline any sentence that fits one of the five categories. Rewrite it.` },
    { title: 'The Product Catalog and Readiness Labels', objectives: ['Read the readiness label on an offering.', 'Know when a proposal is allowed and when it is blocked.', 'Handle a request for something not available to sell.'], body: `Every offering in the Product Catalog carries one readiness label set by the owner: Draft, Internal Test, Pilot Approved, Available for Sale, or Paused. The label is the only thing that decides whether you may sell it.

• Available for Sale — you may include it in a proposal at the price shown in the catalog.
• Pilot Approved — you may include it only with the owner's pilot terms, which will be printed on the proposal as a pilot. Say plainly that it is a pilot.
• Draft, Internal Test or Paused — you may not put it in a proposal. If the client needs it, ask the owner to approve a custom scope for that one deal; the proposal will then carry a clear "custom scope" label.

Some offerings you will be trained on: Nova Audit (a written diagnostic — remote, or with an in-person discovery visit), Wave One, call handling including AI voice, missed-call follow-up, SMS follow-up, CRM and pipeline setup, lead capture, and booking with reminders. Their descriptions, prerequisites, what they include and exclude, and discovery questions live in the catalog. Read the catalog entry before you talk about an offering.

SCENARIO: a prospect asks for AI voice answering and the catalog says Internal Test. Right answer: "That's something we're still testing internally, so I can't sell it today. What I can do is look at how your calls are handled now and tell you what would help most." Then ask your manager whether a pilot is possible.` },
    { title: 'Consent, Contact Rules and Respect', objectives: ['Explain why consent and do-not-contact rules come first.', 'Log and honour a request to stop.', 'Never collect sensitive identifiers.'], body: `A representative talks to strangers for a living, so the rules about who you may contact, how, and what you may ask for are part of the job, not paperwork.

1. If anyone says "stop", "remove me" or "don't contact me", you stop, immediately. Use Mark do-not-contact on the lead. The system then blocks logging further outreach to that person. A lost sale is cheaper than a complaint.
2. Text messages and marketing emails need recorded consent from the person themselves. You cannot grant consent on someone's behalf, and importing a list does not create consent.
3. Never ask a prospect, client or fellow applicant for a social security number, a bank account or card number, a driver's licence or other government ID, or a tax identifier. Nova collects payment only through its payment provider's hosted page, and identity documents are never requested in sales.
4. Be truthful about who you are and why you are calling.

SCRIPT — the moment someone says stop: "Understood — I'll take you off my list and won't contact you again. Sorry for the interruption." Then mark it. Do not try one more pitch.

CHECK YOURSELF: before every outreach, ask (a) Am I allowed to contact this person this way? (b) Is anything about this message untrue or unprovable? (c) Would I be comfortable if this person read my CRM notes?` },
  ],
  questions: [
    { q: 'What does a Nova representative open a conversation with?', choices: ['A finished website mock-up', 'A question about how the prospect\'s customers reach them and what happens to missed inquiries', 'A discount code', 'A guarantee of more leads'], answer: 1, why: 'Nova opens with the prospect\'s customer journey and earns permission to look; solutions come after evidence.' },
    { q: 'In which step of Nova\'s loop does most of a representative\'s work sit?', choices: ['Measure', 'Learn', 'Observe — earning permission to look', 'Act'], answer: 2, why: 'Diagnosis, prioritising and delivery belong to the delivery team once a scope is agreed.' },
    { q: 'A client has signed a proposal. Which statement is correct?', choices: ['The deal is Won because the client signed', 'The sale still needs payment and Nova\'s verification; a signature alone is not a verified sale', 'The representative marks it Won', 'Fulfilment has automatically started'], answer: 1, why: 'Rep-reported close, signature, payment, verification and fulfilment are separate facts recorded by separate steps.' },
    { q: 'A prospect asks "How much will I make from this?" What is the honest answer?', choices: ['"Most clients see their revenue double."', '"I can\'t know that yet; the diagnostic shows what is actually happening and the owner decides what is worth fixing."', '"Around ten thousand more per month."', '"I never discuss results."'], answer: 1, why: 'No invented figures and no promised results; the honest answer points to evidence.' },
    { q: 'An offering is labelled "Internal Test". What may you do?', choices: ['Include it in a proposal at a price you estimate', 'Tell the client it is available now', 'Not propose it; explain it is still being tested and ask your manager about an owner-approved pilot or custom scope', 'Offer it free in exchange for a testimonial'], answer: 2, why: 'Only Available for Sale (or an owner-approved pilot/custom scope with its label) may be proposed.' },
    { q: 'Which of these may a representative say?', choices: ['"Nova looks at your website, phone handling, listings, reviews and follow-up and writes down what it finds."', '"We guarantee you\'ll rank first on Google."', '"Our other client in your industry tripled their sales."', '"The price will be about a thousand — I\'ll make it work."'], answer: 0, why: 'Factual descriptions of what Nova investigates are allowed; guarantees, invented case studies and unapproved prices are not.' },
    { q: 'You cannot set a price yourself because…', choices: ['You are not good at maths', 'Prices come only from the approved catalog or an owner decision, so no one sells a price Nova has not approved', 'Clients prefer round numbers', 'Prices are secret from clients'], answer: 1, why: 'Price authority sits with the owner; the system derives prices from approved catalog data.' },
    { q: 'A contact says "please stop calling me." What do you do?', choices: ['Ask why, then continue', 'Mark do-not-contact immediately and do not reach out again', 'Wait a month and try email', 'Pass the lead to a colleague'], answer: 1, why: 'A request to stop is honoured at once and recorded so it cannot be ignored.' },
    { q: 'A prospect offers their social security number "to verify who they are". What do you do?', choices: ['Write it in the CRM notes', 'Decline; Nova never collects government or tax identifiers in sales, and payment is only taken on the payment provider\'s hosted page', 'Ask them to email it to you', 'Store it in a spreadsheet for later'], answer: 1, why: 'Sensitive identifiers are never requested or stored in sales conversations.' },
    { q: 'Which is NOT one of the five kinds of forbidden statement?', choices: ['A guaranteed result', 'An invented number about the prospect\'s business', 'A description of what Nova investigates', 'A made-up case study'], answer: 2, why: 'Describing what Nova investigates is exactly what you are allowed to do.' },
  ],
  exercises: [
    { lesson_order: 1, title: 'Your two-sentence opening', prompt: 'Write a two-sentence answer to "What does Nova do?" that starts with the prospect\'s customers, not with a deliverable, and promises nothing.', self_check: ['Does the first sentence mention the prospect\'s customers or inquiries?', 'Is there any promise, number or guarantee? (There should be none.)', 'Does it end by asking for a short conversation rather than a purchase?'], model_answer: 'I look at how a local business handles a new customer today — the phone, the website, the follow-up — and write down what I find, with evidence. Would you be open to a short conversation so I can see whether it is worth a closer look at your business?' },
    { lesson_order: 3, title: 'Rewrite the risky sentence', prompt: 'A colleague drafted: "We guarantee you\'ll stop losing customers — most of our clients make thousands more every month." Rewrite it so it is honest and allowed.', self_check: ['Did you remove the guarantee?', 'Did you remove the invented figure and the claim about other clients?', 'Does your version describe what Nova actually does?'], model_answer: 'We look at where customers may be slipping through — missed calls, slow replies, unclear booking — and show you what we find with evidence, so you can decide what is worth fixing.' },
    { lesson_order: 5, title: 'The stop request', prompt: 'A business owner says "I told your colleague not to call again. Take me off." Write exactly what you say and the two things you do in the system afterwards.', self_check: ['Do you apologise briefly and confirm you will not contact them again?', 'Do you avoid any last pitch?', 'Do you name marking do-not-contact and writing an honest note?'], model_answer: 'Say: "Understood — I\'ll take you off my list now and you won\'t hear from me again. Sorry for the interruption." Then: (1) mark the contact do-not-contact on the lead; (2) note what happened factually.' },
  ],
};

export const p2 = {
  slug: 'prospecting-and-qualification', version: 2,
  objectives: ['Find businesses by observable, factual signals rather than guesses.', 'Source contacts legitimately and respect suppression rules.', 'Qualify with a short checklist before spending outreach time.', 'Record prospects without creating duplicates or crossing another representative\'s lead.'],
  lessons: [
    { title: 'Facts, Not Guesses: Finding a Prospect Worth a Conversation', objectives: ['Recognise observable signals of a leaking customer journey.', 'Separate what you observed from what you assume.'], body: `Good prospecting starts with something you can actually see. Signals worth noting: a listing whose phone number or hours differ between sites; a website with no working contact form or booking path; a business that never seems to reply to reviews; a phone number that rings out with no voicemail; an "open" sign with nobody answering. Each is a fact you can write down.

What you do NOT know: how many customers the business loses, how much money that costs, or what happens inside their office. NEVER SAY "you're losing half your leads." SAY "I noticed your listing shows two different phone numbers — is that something you're aware of?"

HOW TO NOTE A SIGNAL: write it as an observation with where you saw it — "Google listing lists 203-555-0100; website footer lists 203-555-0199 (fictional numbers, seen today)". A note like that survives a manager's review; "seems disorganised" does not.

EXAMPLE (fictional): A plumbing company's site has a "Request a quote" form that returns an error page. That is worth mentioning once, kindly, as something you noticed — never as proof they lose work.

CHECKLIST: for each prospect you should be able to point to (1) one observable signal, (2) where you saw it, (3) a neutral question it lets you ask.` },
    { title: 'Sourcing Contacts Legitimately', objectives: ['Use only legitimate channels for contact details.', 'Respect do-not-contact and consent rules.', 'Avoid scraping and misuse of data.'], body: `Contact details must come from places the business itself publishes for contact: its website, its public listing, a referral, a chamber-of-commerce directory, a person you met. Do not scrape, buy lists of unknown origin, guess personal email addresses, or use data you were given for another purpose.

Two rules that protect everyone:
1. A business phone number published for customers may be called during business hours for a business-to-business conversation; texting a number needs the person's recorded consent first. Ask your manager if you are unsure — the system will not stop you from importing a list, but importing never creates consent.
2. If a contact is flagged do-not-contact, that flag is final. You cannot clear it; only the owner can, with documented written permission from the contact.

DUPLICATES: before you add a prospect, Nova's system checks whether that business (by website, phone or name and city) is already being worked by anyone. If it is, you will see a neutral message and no details — this prevents two representatives contacting the same owner and protects everyone's leads. If you believe the match is wrong, ask your manager; do not try to work around it.

SCRIPT for a referral: "[Name] suggested I reach out. I look at how local businesses handle new inquiries — would it be okay to ask you two questions about yours?"` },
    { title: 'Qualifying Before You Pitch', objectives: ['Apply a four-point qualification checklist.', 'Identify who can authorise a diagnostic.', 'Decide honestly where to spend your time.'], body: `Before you invest effort, check four things loosely: (1) PROBLEM — is there a real, observable sign of a gap? (2) AUTHORITY — are you speaking with someone who can say yes (owner, manager, marketing lead)? (3) TIMING — is there any reason to act soon (new location, slow season, a run of poor reviews)? (4) REACHABILITY — do they answer through any channel?

You do not need all four to start a conversation. If none are true, spend your time elsewhere. Qualification is not about rejecting people; it is about being honest with yourself about where your effort will land.

WHAT TO RECORD when you move a lead to Qualified: a short summary in your own words (who they are and why they may benefit from a look) and whether you have spoken with the decision maker — yes, no, or unknown. The system requires both, because "Qualified" must mean something a manager can trust.

EXAMPLE (fictional): "Two-location dental office. Owner-dentist answers the phone himself. Google listing shows Saturday hours the website does not. Spoke to the office manager; the owner decides on vendors. Decision maker: no." That is a good qualified note — and it honestly says you have not reached the owner yet.

SCORE IT: rate each of the four 0 or 1, add them up, and contact the highest first.` },
    { title: 'Organising Your Prospect List', objectives: ['Keep a clean, honest pipeline.', 'Use the next-action habit.', 'Know what stale leads cost you.'], body: `A pipeline is only useful if it is truthful. Habits that keep it that way:
• Every open lead has a next action with a date. If it does not, you have forgotten it.
• Log an activity the moment it happens — a call, an email, a text, a visit — with a few words about what was said. The stage "Contacted" requires at least one real logged attempt; you cannot move a card there on a hunch.
• Close leads that are truly dead, with a reason code and a short note. A pipeline padded with leads you will never call hides the ones that matter, and managers can see stale leads.
• Do not "park" a lead by leaving it in a stage. Set a next action or close it.

STAGES: New → Contacted → Qualified → Discovery Scheduled → Discovery Completed → Proposal → Awaiting Signature/Payment → Submitted for Verification → Won / Lost. Each step has an entry rule; the system will tell you what is missing.

WEEKLY CHECK (10 minutes): (1) any follow-up overdue? (2) any lead with no next action? (3) any lead untouched for two weeks? Fix or close each one.` },
    { title: 'Working with Managers and Other Representatives', objectives: ['Know what a manager can and cannot see.', 'Ask for help without exposing other reps\' leads.'], body: `Your manager can see your leads, activity and pipeline — that is what managers are for. Other representatives cannot see yours, and you cannot see theirs. If the system says a prospect is already being worked, you will not be told by whom; ask your manager to look into it.

What managers do NOT do: monitor your screen, track your location, or read your private messages. Nova's monitoring is limited to the activity you record inside the platform: leads, activities, stages, documents and training. There is no covert screen recording, device surveillance or location tracking.

Use your manager for: an unclear qualification, a prospect asking for something not available to sell, a discount request, a client who seems confused or upset, or anything that feels ethically off. Asking early is a strength.

SCRIPT to your manager: "I have a prospect at [business] who wants [thing]. The catalog shows it as [state]. Can we discuss whether a pilot or custom scope is possible, or how I should explain it's not available?"` },
  ],
  questions: [
    { q: 'Which is an observable signal you can safely mention to a prospect?', choices: ['"You are clearly losing half your leads."', '"Your Google listing shows a different phone number than your website."', '"Your competitors are crushing you."', '"Your staff obviously ignores calls."'], answer: 1, why: 'Observations you can point to are facts; claims about losses or staff are guesses.' },
    { q: 'What is the right way to note a signal?', choices: ['"Seems disorganised."', '"Website form errors — seen today on the Request a Quote page."', '"They probably lose money."', '"Bad vibes."'], answer: 1, why: 'A good note says what you saw and where, so a manager can verify it.' },
    { q: 'Which source of contact details is acceptable?', choices: ['A purchased list of unknown origin', 'Guessing a personal email address', 'The business\'s own public website or listing, a referral or a person you met', 'Scraping social profiles in bulk'], answer: 2, why: 'Contact details must come from legitimate channels the business or person made available.' },
    { q: 'You import a list of prospects. What does that do to consent for texting?', choices: ['It grants consent for texting', 'Nothing — importing never creates consent; texting needs the person\'s own recorded consent', 'It grants consent for email only', 'It grants consent for 30 days'], answer: 1, why: 'Consent must be recorded from the person themselves; a rep cannot grant it on their behalf.' },
    { q: 'The system says a business is already being worked. What should you do?', choices: ['Contact the owner anyway, quickly', 'Use a different spelling of the business name', 'Ask your manager; do not try to work around the check', 'Ask other reps who has it'], answer: 2, why: 'The duplicate check protects owners from being contacted by two people and protects each rep\'s leads.' },
    { q: 'What must a Qualified note contain?', choices: ['Only the business name', 'A short summary in your own words and whether you spoke with the decision maker (yes/no/unknown)', 'A guess at monthly revenue', 'A promise the owner made'], answer: 1, why: 'Qualified must be something a manager can trust; both parts are required.' },
    { q: 'A lead has no next action and has not been touched for three weeks. What is the right move?', choices: ['Leave it; it will come back', 'Set a dated next action or close it with a reason', 'Move it to Qualified', 'Delete it'], answer: 1, why: 'Every open lead needs a dated next action; dead leads are closed with a reason.' },
    { q: 'What does Nova monitor about a representative?', choices: ['Screen recordings of their computer', 'Their physical location throughout the day', 'Only the activity they record in the platform — leads, activities, stages, documents, training', 'Their personal messages'], answer: 2, why: 'There is no covert screen recording, device surveillance or location tracking.' },
    { q: 'You reach the office manager, not the owner. How do you record decision maker?', choices: ['"yes" so the lead looks better', '"no" or "unknown" — honestly', 'Leave it blank and move on', 'Ask the office manager to sign as the owner'], answer: 1, why: 'Honest qualification is the point; "no" simply tells the next step.' },
    { q: 'A rep says "I\'ll just mark it Contacted; I\'ll call tomorrow." Why is that wrong?', choices: ['It is fine', 'Contacted requires at least one real, logged outreach attempt', 'Only managers can mark Contacted', 'Contacted can only be set by email'], answer: 1, why: 'Stages must reflect what actually happened.' },
  ],
  exercises: [
    { lesson_order: 1, title: 'Two neutral observations', prompt: 'Pick a real, public local business listing (do not contact them). Write two neutral, fact-based observations — each with where you saw it — that you could use to open a conversation. Then write the question each one lets you ask.', self_check: ['Is each observation a fact you can point to?', 'Did you avoid guesses about lost customers or money?', 'Is each question open and neutral?'], model_answer: 'Observation: the Google listing shows closing time 5 pm, the website says 6 pm (seen today). Question: "I noticed two different closing times — which is right, and do customers ever get confused?" Observation: the contact form page shows an error. Question: "When someone fills in your quote form, where does it go?"' },
    { lesson_order: 3, title: 'Score three prospects', prompt: 'Take three prospects (real or fictional) and score each 0–1 on Problem, Authority, Timing, Reachability. Which do you contact first and why? Write a two-line qualification note for that one, including the decision-maker answer.', self_check: ['Did you score each of the four criteria for each prospect?', 'Does your note say whether you spoke to the decision maker, honestly?', 'Is your reasoning about effort, not about revenue guesses?'], model_answer: 'Prospect B scores 3/4 (observable listing conflict, owner reachable, new location opening) so I contact B first. Note: "Owner-run auto shop, new second location opening next month. Listing and website hours differ. Spoke with the owner. Decision maker: yes."' },
  ],
};

export const p3 = {
  slug: 'cold-emailing', version: 2,
  objectives: ['Write a cold email with one specific observation and one clear ask.', 'Keep emails short, honest and easy to answer.', 'Follow up without pressure and stop when asked.', 'Use only owner-approved templates for anything with claims.'],
  lessons: [
    { title: 'The Anatomy of a Cold Email That Gets Read', objectives: ['Write a subject line and opening that earn a read.', 'Keep to one clear ask.'], body: `A cold email has seconds to earn a second look. The structure that works, and that Nova teaches:
1. SUBJECT — short, specific, honest. A real observation beats a trick. "Two phone numbers on your listing" is better than "Quick question!!!".
2. LINE ONE — the one real observation you made, and where.
3. LINE TWO — connect it to a possible cost in plain words, without a number: "Customers might not know which one to call."
4. ONE ASK — a short call, or a reply with a good time. Not three asks.
5. SIGN-OFF — your name, Nova Systems, and a simple way to say no.

Keep it under about 120 words. If you cannot find a real specific to mention, the email is not ready — go back to prospecting.

EXAMPLE (fictional):
Subject: Two phone numbers on your listing
"Hi Dana — I noticed the Google listing for Riverside Auto shows 203-555-0100 and your website shows 203-555-0199. Customers may not know which one reaches you. I look at how local businesses handle new inquiries and write down what I find. Would a 15-minute call this week be useful? If it isn't, just tell me and I won't follow up. — Sam, Nova Systems"

NEVER SAY in a cold email: guarantees, invented figures, claims about other clients, or "free" offers you have not been approved to make.` },
    { title: 'Personalisation Without Fabrication', objectives: ['Personalise using verified facts only.', 'Avoid fake familiarity and merge-tag mistakes.'], body: `Personalisation means referring to something true and specific about their business. It does not mean flattering them, pretending to know them, or inventing a detail.

Rules:
• Only mention what you verified. If you are not sure the detail is current, say "your website currently shows…".
• Do not claim you "recently used" their service or "know a customer of theirs" unless it is true.
• Merge-fields can embarrass you: read every email in full before sending; never send a template with brackets still in it.
• Do not use the recipient's personal social media, family or private details.

TEST: could a stranger reading your first line tell you looked at THIS business? If the line would fit any business, it is not personalisation.

EXERCISE IDEA: take a template and replace every generic phrase with a specific fact. If you cannot replace a phrase with a fact, delete the phrase.

WHEN YOU HAVE NOTHING SPECIFIC: send nothing. A short, honest referral request or a visit is better than a fabricated compliment.` },
    { title: 'Follow-Up Without Being Pushy', objectives: ['Plan a respectful follow-up cadence.', 'Add value or clarity, not pressure.', 'Stop when asked or when the sequence ends.'], body: `Most replies come after a follow-up, and most annoyance comes from bad follow-ups. A respectful cadence: a first email; one follow-up two or three business days later; one more about a week after that; then stop, with a polite closing note if you like. Three touches, then rest.

Each follow-up should add something: a clearer question, a second observation, or an easier way to reply ("Reply 'yes' and I'll send two times"). "Just checking in" adds nothing.

SCRIPT — second touch: "Hi Dana — following up on the two phone numbers on your listing. If it's already sorted, no need to reply. If it's useful to talk for 15 minutes, tell me a time that suits you."

SCRIPT — closing note: "I'll stop here so I don't clutter your inbox. If handling new inquiries ever becomes a priority, I'm happy to look at it with you."

IF SOMEONE SAYS STOP or "unsubscribe": stop at once, mark the contact do-not-contact, and do not send anything else. Log the follow-ups you send so your manager can see the cadence.` },
    { title: 'Deliverability, Honesty and the Rules of the Road', objectives: ['Avoid practices that harm deliverability and trust.', 'Include honest sender identification.', 'Respect opt-out requests.'], body: `Sending email is a privilege you can lose. Simple practices:
• Send from your real Nova identity; say who you are and what Nova Systems is.
• Do not use misleading subjects, fake "Re:" or "Fwd:", or pretend an existing relationship.
• Do not attach files in a cold email; a link to nothing suspicious is enough, and only if approved.
• Send at human volumes. Your manager will tell you the sensible daily limit; do not try to beat it.
• Include an easy way to decline in the text of the email (for example "Reply 'no thanks' and I will not email again.") and honour it immediately.
• Never email a contact marked do-not-contact.

BUSINESS EMAIL vs CONSUMER: cold emails to businesses about business services are handled differently from marketing to consumers, and the rules differ by place. Nova's approved templates in the Sales Toolkit have been reviewed for the basics; use them. If you want to change wording that makes any claim, ask your manager first.

CHECKLIST BEFORE SEND: (1) real specific observation; (2) one ask; (3) no claim, figure or guarantee; (4) opt-out sentence; (5) contact is not do-not-contact; (6) logged as an activity.` },
    { title: 'Turning a Reply Into a Conversation', objectives: ['Answer replies quickly and honestly.', 'Move a warm reply to a short call.', 'Handle "not interested" and "send me info" gracefully.'], body: `A reply is the start, not the finish. Answer the same day if you can. Keep it short, answer the question they asked, and propose one next step.

COMMON REPLIES:
• "Sounds interesting — tell me more." → Do not send a brochure. "Happy to. It's easiest to ask you two quick questions first so I show you something relevant: how do customers usually reach you, and what happens when nobody picks up? Could we speak for 15 minutes on [two times]?"
• "Send me some info." → "Sure — so I send something relevant rather than generic, what's the main thing you'd want to fix or know more about?" (Then follow up with the approved material.)
• "Not interested." → "Thanks for letting me know — I won't follow up. If things change, I'm around." Log it and close.
• "How much is it?" → "The scope decides the price, so I don't want to guess. After a short conversation I can bring a written proposal." (Never quote a price that is not approved.)
• "Take me off your list." → stop, apologise briefly, mark do-not-contact.

BOOKING: offer two specific times, confirm by email, and put the discovery in your pipeline as Discovery Scheduled once it is real.` },
  ],
  questions: [
    { q: 'What makes the best cold-email subject line?', choices: ['A trick like "Re: our conversation"', 'Short, specific and honest, based on a real observation', 'ALL CAPS urgency', 'A promise of results'], answer: 1, why: 'Honest, specific subjects earn reads without misleading anyone.' },
    { q: 'How many asks should a cold email contain?', choices: ['Three, so one lands', 'One clear ask', 'None', 'As many as fit'], answer: 1, why: 'One clear ask is easier to answer and to say yes to.' },
    { q: 'You cannot find anything specific about a business. What do you do?', choices: ['Invent a compliment', 'Send a generic template anyway', 'Do not send an email; go back to prospecting or use a referral or visit', 'Copy another rep\'s email'], answer: 2, why: 'If there is no real specific, the email is not ready.' },
    { q: 'Which line is acceptable in a cold email?', choices: ['"Our clients typically see revenue double."', '"I noticed your listing and website show different closing times."', '"We guarantee more customers."', '"You are definitely losing money."'], answer: 1, why: 'Only verified observations are allowed; results, guarantees and losses are not.' },
    { q: 'What is a respectful follow-up cadence?', choices: ['Daily until they answer', 'A first email, a follow-up in 2–3 business days, another about a week later, then stop', 'One email every hour', 'Only one email ever'], answer: 1, why: 'Three touches with added value, then rest.' },
    { q: 'What should every follow-up do?', choices: ['Say "just checking in"', 'Add something — a clearer question, a second observation or an easier way to reply', 'Threaten to close the offer', 'Copy the manager'], answer: 1, why: '"Just checking in" adds nothing.' },
    { q: 'A recipient replies "unsubscribe". What do you do?', choices: ['Send one last email', 'Stop immediately, mark do-not-contact, log it', 'Wait 30 days', 'Ask them why'], answer: 1, why: 'A request to stop is final and must be recorded.' },
    { q: 'A prospect replies "How much is it?" and there is no approved price. What is the honest answer?', choices: ['Guess a friendly number', '"Around a thousand"', '"The scope decides it, so I won\'t guess. After a short conversation I can bring a written proposal."', '"I can\'t tell you anything."'], answer: 2, why: 'No unapproved prices; the proposal carries the price.' },
    { q: 'Which is a misleading practice?', choices: ['Saying who you are and what Nova is', 'A subject line beginning "Re:" for an email that is not a reply', 'An easy opt-out sentence', 'Reading every email before sending'], answer: 1, why: 'Fake replies mislead the recipient and damage deliverability and trust.' },
    { q: 'A rep changes an approved template to add "we typically save clients thousands." What is wrong?', choices: ['Nothing', 'It adds an unapproved claim and an invented figure; wording with claims needs owner approval', 'It is too short', 'It is too personal'], answer: 1, why: 'Invented figures and unapproved claims are forbidden.' },
  ],
  exercises: [
    { lesson_order: 1, title: 'Draft a four-line cold email', prompt: 'Using the structure from the lesson, draft a cold email of four to six short lines for a real, public local business (do not send it). Include an honest opt-out sentence.', self_check: ['Is line one a real, verifiable observation?', 'Is there exactly one ask?', 'Is there any figure, guarantee or claim? (There should be none.)', 'Is there an easy way to say no?'], model_answer: 'Subject: Two closing times on your listing\nHi Dana — the Google listing for Riverside Auto shows a 5 pm close; your website says 6 pm. Customers may not know which is right. I look at how local businesses handle new inquiries and write down what I find. Could we talk for 15 minutes this week? If not, reply "no thanks" and I won\'t email again. — Sam, Nova Systems' },
    { lesson_order: 3, title: 'Write the second touch', prompt: 'You emailed a prospect four days ago and heard nothing. Write the follow-up that adds something and is easy to answer.', self_check: ['Does it add a clearer question or second observation?', 'Does it avoid "just checking in" and pressure?', 'Is there an easy, low-effort way to reply?'], model_answer: 'Hi Dana — following up on the closing times. One more thing I noticed: the phone number on the site goes to voicemail after 5 pm. Is that intentional? If it would help to talk for 15 minutes, tell me a time that suits you; if it\'s all sorted, no need to reply.' },
  ],
};
