// Full contract text shown on /sign/:contract_id and baked into the signed PDF.
// Keyed by the contract_type value stored on the `contracts` row.

const DIGITAL_FOUNDATION = {
  title: 'Nova Systems — Digital Foundation Agreement',
  intro: 'This agreement is between Nova Systems LLC, Waterbury Connecticut and the client named above.',
  sections: [
    {
      heading: 'What Nova Systems Will Build',
      body: 'Professional website with home page, menu page, and contact page. Mobile optimized. Google optimized. SSL secured. Google Business Profile setup and optimization. WhatsApp Business setup with catalog, greeting message, away message, and QR code. QR codes for menu and ordering. Contact forms. Basic SEO. Business email setup. Google Maps integration. Social media links.',
    },
    {
      heading: 'What Is Not Included',
      body: 'E-commerce store, custom apps, AI automation, unlimited pages, paid advertising, and content creation. These are available as separate services.',
    },
    {
      heading: 'Investment',
      body: 'One-time setup fee: $320.00. A deposit of 50% ($160.00) is due before work begins. The remaining 50% ($160.00) is due before the website goes live. Monthly maintenance: $50.00 per month starting 30 days after launch. Covers hosting, SSL, security updates, and basic maintenance.',
    },
    {
      heading: 'Timeline',
      body: '7 to 30 business days depending on timely receipt of all required materials from the client.',
    },
    {
      heading: 'Client Responsibilities',
      body: 'Client must provide logos, photos, pricing, menu items, and all written content within 7 days of signing. Delays caused by the client may extend the timeline. Nova Systems is not responsible for missed deadlines caused by late client materials.',
    },
    {
      heading: 'Revisions',
      body: 'Two rounds of revisions are included during testing. Additional revisions after launch are billed at $150 per hour.',
    },
    {
      heading: 'Refund Policy',
      body: 'The deposit is non-refundable once work has started. Completed custom work is non-refundable. Third-party costs including domains, hosting, and printing are non-refundable after purchase.',
    },
    {
      heading: 'Non-Payment',
      body: 'If monthly payment is more than 7 days late Nova Systems will suspend the website and all services until payment is received. A $100 reconnection fee applies to restore suspended services. If payment is more than 30 days late the contract is terminated and website files may be deleted.',
    },
    {
      heading: 'Ownership',
      body: 'Client owns their domain name, brand content, and customer data. Nova Systems retains ownership of all code, templates, and systems built. Client receives a license to use the website while the monthly subscription is active.',
    },
    {
      heading: 'No Guarantees',
      body: 'Nova Systems does not guarantee specific search rankings, revenue increases, or business growth. Google controls its own algorithm and search results independently.',
    },
    {
      heading: 'Cancellation',
      body: 'Either party may cancel monthly services with 30 days written notice sent to hello@nova-systems.app.',
    },
    {
      heading: 'Governing Law',
      body: 'This agreement is governed by the laws of the State of Connecticut. Any disputes must be resolved in Waterbury, Connecticut.',
    },
    {
      heading: 'Electronic Signature',
      body: 'By signing below the client agrees to all terms above. This electronic signature is legally binding under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and Connecticut state law.',
    },
  ],
}

// Sales Representative Agreement (2026-09-23) — used for the hiring workflow's "approved working
// agreement" step (api/contracts.js, application_id-linked). Deliberately does NOT state a
// commission percentage, classification (employee/contractor), or any other business fact this
// codebase has no authorization to invent — those are covered by "your individual compensation
// agreement" and flagged below as pending Isaac's/counsel's completion, per the master build
// prompt's explicit rule against inventing missing business facts and its legal-matrix guidance
// that generated text is not legal advice.
const SALES_REP_AGREEMENT = {
  title: 'Nova Systems — Sales Representative Working Agreement',
  intro: 'This agreement is between Nova Systems LLC, Waterbury Connecticut and the representative named above, confirming the terms of their work representing Nova Systems.',
  sections: [
    {
      heading: 'Role',
      body: 'The representative will identify, qualify, and pursue prospective Nova Systems clients, following the standards and process covered in the Nova Sales Academy (Nova Fundamentals through Ethics, Commission Rules, and Final Assessment) and Nova’s current approved scripts, pricing, and positioning.',
    },
    {
      heading: 'Relationship and Classification',
      body: 'The specific nature of this working relationship (including employee vs. independent contractor classification, hours, and exclusivity) is defined in a separate, individually reviewed compensation and classification schedule provided to the representative — not stated generically here — and should be confirmed with Nova Systems and, where appropriate, independent counsel before relying on it.',
    },
    {
      heading: 'Compensation',
      body: 'Commission rates, payment triggers, and payout timing are governed entirely by the representative’s individual signed compensation schedule, not by this agreement or by anything stated informally. Commission is owed only on deals that are verified and, where applicable, actually collected — never on a verbal agreement alone. A representative may not self-approve, alter, or influence their own commission record.',
    },
    {
      heading: 'Conduct and Ethics',
      body: 'The representative agrees to Nova’s ethics standards covered in Academy Program 10: no false claims, invented results, fabricated urgency, or unapproved guarantees, and no pricing, timeline, or outcome promises beyond what Nova has actually approved for the relevant scope.',
    },
    {
      heading: 'Data Protection and Confidentiality',
      body: 'The representative agrees to handle all prospect and client data exclusively within Nova’s own systems — never exporting or sharing it to a personal device, personal account, or outside party — and to keep confidential any non-public information about Nova’s business, pricing, or clients encountered while representing Nova Systems.',
    },
    {
      heading: 'Training Requirement',
      body: 'Representative status depends on satisfactory completion of the applicable Nova Sales Academy programs, including any practical assessment a program requires, subject to Nova’s review. Completing training does not, by itself, guarantee continued engagement, a specific commission rate, or any particular classification.',
    },
    {
      heading: 'Termination',
      body: 'Either party may end this working relationship at any time, consistent with the classification and terms defined in the representative’s individual compensation and classification schedule referenced above.',
    },
    {
      heading: 'Electronic Signature',
      body: 'By signing below the representative agrees to all terms above. This electronic signature is legally binding under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and Connecticut state law.',
    },
  ],
}

// No canned legal text was provided for these tiers yet — the specifics of
// scope and pricing live in the custom_notes Isaac fills in when sending the
// contract, and are rendered as their own section below the intro.
function customNotesTemplate(title) {
  return {
    title,
    intro: 'This agreement is between Nova Systems LLC, Waterbury Connecticut and the client named above.',
    sections: [
      { heading: 'Scope and Terms', body: '{{custom_notes}}' },
      {
        heading: 'Electronic Signature',
        body: 'By signing below the client agrees to all terms above. This electronic signature is legally binding under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and Connecticut state law.',
      },
    ],
  }
}

export const CONTRACT_TYPES = ['Digital Foundation', 'Growth Package', 'Custom', 'Sales Representative Agreement']

export const CONTRACT_TEMPLATES = {
  'Digital Foundation': DIGITAL_FOUNDATION,
  'Growth Package': customNotesTemplate('Nova Systems — Growth Package Agreement'),
  Custom: customNotesTemplate('Nova Systems — Custom Agreement'),
  'Sales Representative Agreement': SALES_REP_AGREEMENT,
}

// Resolves a contract's template, substituting the {{custom_notes}} placeholder
// (used by the Growth Package / Custom templates) with the contract's actual notes.
export function getContractContent(contractType, customNotes) {
  const template = CONTRACT_TEMPLATES[contractType] || CONTRACT_TEMPLATES.Custom
  return {
    title: template.title,
    intro: template.intro,
    sections: template.sections.map((s) => ({
      ...s,
      body: s.body.replace('{{custom_notes}}', customNotes?.trim() || 'Terms to be provided by Nova Systems.'),
    })),
  }
}
