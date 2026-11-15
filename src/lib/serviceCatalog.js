// Nova's customer-facing service catalog: the single source for the homepage, /services and
// SERVICE_CATALOG.md. Plain language only. No prices live here — every service is "Request a
// quote" until Isaac confirms pricing.
//
// `availability` is deliberately conservative and must match what can be delivered today:
//   ready   — the request action leads to work Nova can start now.
//   scoped  — Nova agrees the work with the customer first; nothing here is automatic yet.
// `requestKey` is the value the request form (public/sms-program) already accepts in production
// (nova_launch_request allows: calls, messages, booking, follow_up, systems, not_sure). The
// service's own name travels in the customer's note, so no database change is needed.

export const AVAILABILITY = Object.freeze({
  ready: 'Ready to start',
  scoped: 'Scoped with you first',
});

export const SERVICE_CATALOG = Object.freeze([
  {
    key: 'customer-care',
    name: 'Customer care',
    summary: 'Customers get an answer and a next step, even when you are busy.',
    helps: 'Owners who miss inquiries while they are on a job, with a customer or closed for the day.',
    included: ['Receive customer inquiries in one place', 'Answer the questions you have approved', 'Collect the details your team needs', 'Pass anything unusual to the right person'],
    youSupply: 'Your services, hours, common questions and who should hear about exceptions.',
    deliverable: 'Every inquiry saved with the customer’s details, what they asked and what happens next.',
    escalation: 'If the answer is not one you approved, the customer is told a team member will follow up, and you are told.',
    availability: 'ready',
    availabilityNote: 'Ready for website requests. Phone and text answering are set up for each business and confirmed with you before they go on.',
    requestKey: 'messages',
  },
  {
    key: 'scheduling',
    name: 'Scheduling',
    summary: 'Appointments booked, confirmed and kept in order.',
    helps: 'Businesses that lose time going back and forth to find a time that works.',
    included: ['Show customers the times you actually have', 'Reserve a time once, so it cannot be double booked', 'Send a confirmation and a calendar file', 'Handle changes and cancellations on the same booking'],
    youSupply: 'The days and times you are available and how long each appointment takes.',
    deliverable: 'A confirmed appointment on your calendar with the customer’s details attached.',
    escalation: 'If no published time fits, the request is saved and Nova arranges a time with the customer.',
    availability: 'ready',
    availabilityNote: 'Reminders by text depend on your text-message setup, which we confirm with you.',
    requestKey: 'booking',
  },
  {
    key: 'sales-support',
    name: 'Sales support',
    summary: 'Leads followed up, so interested customers do not go quiet.',
    helps: 'Teams with more inquiries than time to chase them.',
    included: ['Find out what each lead needs', 'Prepare quotes from prices you have approved', 'Follow up at agreed times', 'Keep every lead’s status up to date'],
    youSupply: 'Your approved prices or quoting rules, and how you want leads followed up.',
    deliverable: 'A current list of leads showing who was contacted, what was said and what is next.',
    escalation: 'A quote outside your approved prices waits for your decision. Nova does not invent a price.',
    availability: 'scoped',
    availabilityNote: '',
    requestKey: 'follow_up',
  },
  {
    key: 'marketing',
    name: 'Marketing',
    summary: 'Plans, scripts, posts and videos produced for your business, and results reviewed.',
    helps: 'Owners who know they should be visible and do not have time to make the content.',
    included: ['A plan built around one offer and one audience', 'Scripts, captions and short videos', 'Posting where your accounts allow it', 'A plain review of what the numbers show'],
    youSupply: 'Your offer, photos or footage you own, and access to the accounts you want used.',
    deliverable: 'Finished, reviewed content ready to post, and a short report on what happened.',
    escalation: 'Nothing is published until you approve the exact version.',
    availability: 'scoped',
    availabilityNote: '',
    requestKey: 'systems',
  },
  {
    key: 'daily-operations',
    name: 'Daily operations',
    summary: 'Work assigned, tracked and finished, with proof it was done.',
    helps: 'Teams where jobs slip because nobody is sure who has them.',
    included: ['Assign each job to a person', 'Set deadlines and checklists', 'Hand work from one person to the next', 'Record what was completed and when'],
    youSupply: 'Who is on your team, the work you repeat most and what “done” means for each job.',
    deliverable: 'One list of open work showing the owner, the deadline and the result.',
    escalation: 'Late or stuck work is brought to the person you name.',
    availability: 'scoped',
    availabilityNote: '',
    requestKey: 'systems',
  },
  {
    key: 'administration',
    name: 'Administration',
    summary: 'Forms, documents and routine office tasks taken off your desk.',
    helps: 'Owners doing paperwork at night.',
    included: ['Customer and staff forms', 'Documents kept organized and easy to find', 'Messages you have approved, sent on schedule', 'Recurring office tasks'],
    youSupply: 'The forms and documents you use now and the wording you approve.',
    deliverable: 'Completed forms and organized records you can open at any time.',
    escalation: 'Anything that needs a signature or a judgment call is sent to you.',
    availability: 'scoped',
    availabilityNote: '',
    requestKey: 'systems',
  },
  {
    key: 'finance-support',
    name: 'Finance support',
    summary: 'Invoices, payments and what is still owed, made easy to understand.',
    helps: 'Owners who are not sure who has paid and who has not.',
    included: ['Track invoices and due dates', 'Record payments that have been confirmed', 'Remind customers about overdue invoices', 'Prepare exports for your accountant'],
    youSupply: 'Your invoices and payment records, and how you want reminders worded.',
    deliverable: 'A clear view of what was billed, what was paid and what is outstanding.',
    escalation: 'Nova does not file taxes, sign financial documents or move money. Questions for an accountant go to your accountant.',
    availability: 'scoped',
    availabilityNote: '',
    requestKey: 'systems',
  },
  {
    key: 'business-improvement',
    name: 'Business improvement',
    summary: 'A review of how customers reach you and what happens next, with practical fixes.',
    helps: 'Owners who sense customers are slipping away and want to see where.',
    included: ['A look at how inquiries, booking and follow-up work today', 'Findings tied to what was actually observed', 'Recommended fixes in order of usefulness', 'A check that each fix worked'],
    youSupply: 'Your website and public pages, and any notes or records you choose to share.',
    deliverable: 'A written review you approve before it is final, with the evidence behind each finding.',
    escalation: 'If a page cannot be read or evidence is thin, the review says so instead of guessing.',
    availability: 'ready',
    availabilityNote: '',
    requestKey: 'not_sure',
  },
]);

export const requestLink = (service) => `/service-request?service=${service.key}`;
