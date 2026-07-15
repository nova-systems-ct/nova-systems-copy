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

export const CONTRACT_TYPES = ['Digital Foundation', 'Growth Package', 'Custom']

export const CONTRACT_TEMPLATES = {
  'Digital Foundation': DIGITAL_FOUNDATION,
  'Growth Package': customNotesTemplate('Nova Systems — Growth Package Agreement'),
  Custom: customNotesTemplate('Nova Systems — Custom Agreement'),
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
