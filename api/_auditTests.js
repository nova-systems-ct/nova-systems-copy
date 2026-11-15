// Nova Audit, beyond reading the website: act like a customer and record what happened.
//
// Three things live here, all pure (no network, no database):
//   1. detectPaidTools      — which paid marketing, ad, chat and review tools a page loads.
//   2. customerTestToEvidence — turns one customer-style test (a call, a form, a message) that a
//      person ran into an evidence record the existing audit workspace accepts.
//   3. leakEstimate         — turns test results plus three numbers from the owner into a dollar
//      RANGE with its assumptions spelled out. It refuses when it has too little to go on.
//
// Nothing here phones, texts or submits forms to another business by itself. A person runs each
// test and records the outcome; the audit only reports what that person observed.

const TOOLS = [
  // [name, category, pattern]
  ['Meta Pixel', 'advertising', /connect\.facebook\.net\/[a-z_]+\/fbevents\.js|fbq\(\s*['"]init/i],
  ['Google Ads tag', 'advertising', /googleadservices\.com|gtag\(\s*['"]config['"]\s*,\s*['"]AW-/i],
  ['TikTok Pixel', 'advertising', /analytics\.tiktok\.com/i],
  ['Microsoft Ads tag', 'advertising', /bat\.bing\.com/i],
  ['Google Analytics', 'measurement', /googletagmanager\.com\/gtag\/js\?id=G-|google-analytics\.com\/(analytics|ga)\.js/i],
  ['Google Tag Manager', 'measurement', /googletagmanager\.com\/gtm\.js/i],
  ['HubSpot', 'marketing', /js\.hs-scripts\.com|js\.hsforms\.net/i],
  ['Mailchimp', 'marketing', /chimpstatic\.com|list-manage\.com/i],
  ['Klaviyo', 'marketing', /static\.klaviyo\.com/i],
  ['Podium', 'reviews_and_messaging', /connect\.podium\.com/i],
  ['Birdeye', 'reviews_and_messaging', /birdeye\.com\/embed|birdeye\.com\/widget/i],
  ['Yelp reservations', 'booking', /yelp\.com\/reservations/i],
  ['Housecall Pro', 'booking', /housecallpro\.com/i],
  ['Jobber', 'booking', /clienthub\.getjobber\.com|getjobber\.com/i],
  ['ServiceTitan', 'booking', /servicetitan\.com/i],
  ['CallRail', 'call_tracking', /cdn\.callrail\.com/i],
];

export function detectPaidTools(html) {
  const h = String(html || '');
  return TOOLS.filter(([, , re]) => re.test(h)).map(([name, category]) => ({ name, category }));
}

// One evidence record listing the tools a page loads. A tool being present is an observation;
// whether it is paid for, working or producing anything is NOT claimed here.
export function paidToolsEvidence(tools, url, retrievedAt) {
  if (!tools.length) return null;
  const byCategory = {};
  for (const t of tools) (byCategory[t.category] ||= []).push(t.name);
  const list = Object.entries(byCategory).map(([c, names]) => `${c.replace(/_/g, ' ')}: ${names.join(', ')}`).join('; ');
  return {
    source: `Public web page ${url} (retrieved ${retrievedAt})`, method: 'automated_public_page_fetch',
    observation: `Third-party tool references found in the page HTML — ${list}. This shows the tools are loaded on the page. It does not show what the business pays for them or whether they are producing results; each should be tested as a customer would use it.`,
    source_quality: 'medium', confidence: 'medium', privacy_level: 'internal',
  };
}

// The customer-style tests. `responded` means a person at the business (or its system) actually
// dealt with the request, not merely that something rang or auto-replied.
export const CUSTOMER_TESTS = {
  phone_open_hours: { label: 'Phone call during posted opening hours', unit: 'seconds', did: 'called the listed phone number during the hours the business says it is open' },
  phone_after_hours: { label: 'Phone call after hours', unit: 'seconds', did: 'called the listed phone number outside posted opening hours' },
  web_form: { label: 'Website contact form', unit: 'hours', did: 'sent an inquiry through the contact form on the business\'s website' },
  text_message: { label: 'Text message to the listed number', unit: 'hours', did: 'sent a text message to the listed phone number' },
  social_message: { label: 'Direct message on a social profile', unit: 'hours', did: 'sent a direct message to the business\'s public social profile' },
  online_booking: { label: 'Booking without calling', unit: null, did: 'tried to book an appointment online without phoning' },
  quote_follow_up: { label: 'Follow-up after asking for a quote', unit: 'days', did: 'asked for a quote and then did not reply, to see whether the business followed up' },
};

// input: { kind, performed_at (ISO), performed_by, target, responded (boolean), response_time (number|null), notes }
// Returns { record } ready for audit_evidence, or { error }.
export function customerTestToEvidence(input, now = new Date()) {
  const test = Object.hasOwn(CUSTOMER_TESTS, input?.kind) ? CUSTOMER_TESTS[input.kind] : null;
  if (!test) return { error: `kind must be one of: ${Object.keys(CUSTOMER_TESTS).join(', ')}` };
  const at = new Date(input.performed_at);
  if (Number.isNaN(at.getTime()) || at > now) return { error: 'performed_at must be the real date and time the test was run' };
  const by = String(input.performed_by || '').trim();
  if (by.length < 2) return { error: 'performed_by is required: evidence needs to say who ran the test' };
  const target = String(input.target || '').trim();
  if (target.length < 3) return { error: 'target is required: the number, page or profile that was tested' };
  if (typeof input.responded !== 'boolean') return { error: 'responded must be true or false' };
  const time = input.response_time == null || input.response_time === '' ? null : Number(input.response_time);
  if (time !== null && (!Number.isFinite(time) || time < 0)) return { error: 'response_time must be a number' };
  if (input.responded && test.unit && time === null) return { error: `response_time (${test.unit}) is required when the business responded` };

  const when = at.toISOString();
  const outcome = input.responded
    ? `The business responded${test.unit ? ` after ${time} ${test.unit}` : ''}.`
    : `No response was received${time !== null && test.unit ? ` within ${time} ${test.unit}, when the test was closed` : ''}.`;
  const notes = String(input.notes || '').trim().slice(0, 1500);
  return {
    record: {
      source: `Customer-style test: ${test.label} — ${target}`.slice(0, 300),
      method: `customer_style_test:${input.kind}`,
      capture_date: when,
      observation: `On ${when}, ${by} ${test.did} (${target}). ${outcome}${notes ? ` Notes: ${notes}` : ''} This is one test at one moment; it does not by itself show how the business usually responds.`.slice(0, 3000),
      source_quality: 'high', confidence: 'high', privacy_level: 'internal',
    },
    summary: { kind: input.kind, responded: input.responded, response_time: time, unit: test.unit },
  };
}

// A dollar range for inquiries that go unanswered, from the owner's three numbers and the share
// of customer-style tests that got no response. Returns { estimate_low, estimate_high,
// estimate_assumptions } in whole dollars per month, shaped for validateFinding(), or
// { refused: reason }. The range is wide on purpose: a handful of tests cannot pin a rate down.
export function leakEstimate({ inquiriesPerWeek, avgJobCents, closeRatePct, testsRun, testsUnanswered }) {
  const n = Number(testsRun), missed = Number(testsUnanswered);
  if (!Number.isInteger(n) || n < 3) return { refused: 'At least three customer-style tests are needed before putting a dollar figure on unanswered inquiries.' };
  if (!Number.isInteger(missed) || missed < 0 || missed > n) return { refused: 'testsUnanswered must be between 0 and testsRun.' };
  const perWeek = Number(inquiriesPerWeek), job = Number(avgJobCents), close = Number(closeRatePct);
  if (!(perWeek > 0) || !(job > 0) || !(close > 0 && close <= 100)) return { refused: 'Three numbers from the owner are needed: inquiries per week, average job value, and the share of inquiries that become jobs.' };
  if (missed === 0) return { refused: 'Every test was answered, so there is no unanswered-inquiry loss to estimate.' };

  const rate = missed / n;
  // With few tests the true rate is uncertain: take half the observed rate as the low end, and the
  // observed rate (capped) as the high end.
  const low = rate * 0.5, high = Math.min(rate, 0.9);
  const monthly = (r) => Math.round(perWeek * 4.33 * r * (close / 100) * (job / 100));
  return {
    estimate_low: monthly(low), estimate_high: monthly(high),
    estimate_assumptions: `Based on ${missed} of ${n} customer-style tests receiving no response, and the owner's figures: about ${perWeek} inquiries a week, an average job of $${(job / 100).toFixed(0)}, and ${close}% of inquiries becoming jobs. Low end assumes half the tested rate of unanswered inquiries; high end assumes the tested rate. Assumes an unanswered inquiry is lost, which will not always be true. ${n} tests is a small sample.`,
  };
}
