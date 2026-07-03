// Nova Systems careers — job listing + application-form definitions.
//
// Each field descriptor's `column` is the exact Supabase `applications` table
// column its value is written to (see supabase/schema-update.sql). `key` is
// the local form-state key when it needs to differ from `column`.

const YEARS_1_TO_10 = ["1-2 years", "3-5 years", "5-10 years", "10+ years"];
const EXPERIENCE_0_TO_5 = ["None", "1-2 years", "3-5 years", "5+ years"];
const START_TIMES_4 = ["Immediately", "1 week", "2 weeks", "1 month"];
const START_TIMES_3 = ["Immediately", "1 week", "2 weeks"];

export const JOBS = [
  {
    id: "cto",
    title: "Chief Technology Officer",
    shortTitle: "CTO",
    badge: "C-Suite Executive",
    teaser: "Serve as the iron wall of our technology infrastructure — audit code, secure client deployments, and make sure every system runs flawlessly before it goes live.",
    description:
      "Nova Systems is looking for a technically elite CTO to serve as the iron wall of our technology infrastructure. You will audit code, monitor AI workflow logic, oversee automated ecosystems, ensure cybersecurity across all client deployments, and make sure every system runs flawlessly before it goes live. You are the technical authority of the company. Isaac handles the vision and the clients — you make sure everything works perfectly behind the scenes.",
    compensation: "Revenue share per project. Every successful technical contract deployed earns you a percentage. The more we grow, the more you make.",
    requirements: [
      "Strong experience with React, Node.js, Supabase, Vercel, and API integrations",
      "Hands-on experience with AI tools and automation",
      "Ability to audit and improve existing codebases",
      "Cybersecurity awareness",
      "Self-directed and reliable",
    ],
    hasPassword: true,
    hasPortfolio: true,
    portfolioLabel: "Portfolio or Work Samples",
    fields: [
      { column: "linkedin_url", label: "LinkedIn URL", type: "url", required: true, placeholder: "https://linkedin.com/in/…" },
      { column: "github_url", label: "GitHub URL", type: "url", required: true, placeholder: "https://github.com/…" },
      { column: "years_experience", label: "Years of Experience", type: "select", required: true, options: YEARS_1_TO_10 },
      { column: "tech_stack", label: "Tech Stack", type: "textarea", required: true, placeholder: "React, Node.js, Supabase, Vercel…" },
      { column: "ai_tools_experience", label: "Describe your experience with AI systems and automation", type: "textarea", required: true },
      { column: "why_position", label: "Why Nova Systems", type: "textarea", required: true },
    ],
  },
  {
    id: "coo",
    title: "Chief Operating Officer",
    shortTitle: "COO / Chief of Staff",
    badge: "C-Suite Executive",
    teaser: "Be the operational engine of Nova Systems — track the ground team, manage deadlines, and keep daily operations organized so Isaac can focus on the big picture.",
    description:
      "Nova Systems needs an operational engine. As COO you will monitor the entire ground team — tracking sales reps in their territories, managing content creator deadlines, and keeping daily operations organized so Isaac can focus on the big picture. You are the person who makes sure everything that is supposed to happen actually happens. This is a leadership role that requires someone who is organized, firm, and driven.",
    compensation: "Revenue share tied to overall company monthly gross revenue. As Nova Systems grows, your monthly payout scales with it.",
    requirements: [
      "Strong organizational and leadership skills",
      "Experience managing a team or running operations",
      "Self-directed",
      "Professional communicator",
      "Experience with CRM or project management tools preferred",
    ],
    hasPassword: true,
    hasPortfolio: false,
    fields: [
      { column: "linkedin_url", label: "LinkedIn URL", type: "url", required: true, placeholder: "https://linkedin.com/in/…" },
      { column: "management_experience", label: "Experience Managing Teams", type: "select", required: true, options: EXPERIENCE_0_TO_5 },
      { column: "operations_experience", label: "Describe your operational or management experience", type: "textarea", required: true },
      { column: "organization_tools", label: "Tools you use to stay organized", type: "textarea", required: true },
      { column: "why_position", label: "Why Nova Systems", type: "textarea", required: true },
    ],
  },
  {
    id: "cpo",
    title: "Chief Planning Officer",
    shortTitle: "CPO",
    badge: "C-Suite Executive",
    teaser: "Be the tactical architect of Nova Systems — map client roadmaps and engineer the strategic phases of our AI ecosystems before the tech team builds them.",
    description:
      "The CPO is the tactical architect of Nova Systems. Working directly under Isaac, you will map out client project roadmaps, design delivery timelines, and engineer the strategic phases of our AI ecosystems before the tech team builds them. You think in systems, you plan ahead, and you make sure every project is designed to succeed before a single line of code is written.",
    compensation: "Revenue share calculated as a percentage bonus per successful project milestone reached and delivered to a client.",
    requirements: [
      "Strategic thinker with experience in project planning, product management, or business operations",
      "Ability to translate a client vision into a clear, actionable roadmap",
      "Strong written communication",
    ],
    hasPassword: true,
    hasPortfolio: false,
    fields: [
      { column: "linkedin_url", label: "LinkedIn URL", type: "url", required: true, placeholder: "https://linkedin.com/in/…" },
      { column: "planning_experience", label: "Experience with project planning or product management", type: "textarea", required: true },
      { column: "project_example", label: "Describe a project you planned from start to finish", type: "textarea", required: true },
      { column: "why_position", label: "Why Nova Systems", type: "textarea", required: true },
    ],
  },
  {
    id: "cfo",
    title: "Chief Financial Officer",
    shortTitle: "CFO",
    badge: "C-Suite Executive",
    teaser: "Be our numbers guardian — manage financial strategy, coordinate tax filings, issue invoices, and handle payouts so Isaac never has to worry about the math.",
    description:
      "Nova Systems needs a numbers guardian. As CFO you will manage high-level financial strategy, coordinate tax filings, issue client invoices, and handle team payouts so Isaac never has to worry about the math or the legalities. You keep the money organized, the books clean, and the team paid on time.",
    compensation: "Revenue share split taken from company net profits each month.",
    requirements: [
      "Background in accounting, finance, or business management",
      "Experience with invoicing and financial reporting",
      "Knowledge of Connecticut business tax laws preferred",
      "Trustworthy and detail-oriented",
    ],
    hasPassword: true,
    hasPortfolio: false,
    fields: [
      { column: "linkedin_url", label: "LinkedIn URL", type: "url", required: true, placeholder: "https://linkedin.com/in/…" },
      { column: "financial_background", label: "Financial or accounting background", type: "textarea", required: true },
      { column: "invoicing_tax_experience", label: "Experience with business invoicing and tax coordination?", type: "yesno", required: true },
      { column: "invoicing_tax_explain", label: "Explain", type: "textarea", required: false },
      { column: "why_position", label: "Why Nova Systems", type: "textarea", required: true },
    ],
  },
  {
    id: "sales-rep",
    title: "High-Ticket B2B Sales Representative",
    shortTitle: "Sales Rep",
    badge: "Commission Only — No Cap",
    teaser: "Close a $5,000/month client and earn up to 20% of that deal — that's $1,000 from one signature. Full training, territory, and support provided.",
    description:
      "Nova Systems builds AI systems, websites, social media, and full technology infrastructure for Connecticut businesses. We are growing fast and we need closers. Not people who book meetings — people who shake hands, present value, and get contracts signed. You will receive a territory in Connecticut, full training, proposal templates, demo websites, and direct support from Isaac Nova. You find businesses, book the meeting, present Nova Systems, and close the deal. The client signs. You get paid. Simple as that.",
    compensation: "15% on deals under $2,000/month. 20% on deals $2,000/month and above. Commission paid after the client makes their first payment.",
    requirements: [
      "Reliable vehicle and valid Connecticut driver's license",
      "Professional appearance and confidence presenting in person",
      "Phone and laptop",
      "Self-motivated",
      "Spanish speaking is a major plus",
    ],
    hasPassword: false,
    hasPortfolio: false,
    pitch: {
      headline: "Close Deals. Keep the Commission. Build Your Own Income.",
      subheadline: "This is not a salary job. Not hourly. This is 100% commission — which means YOUR effort determines YOUR income. Close a $5,000/month client and earn up to 20% of that deal. That is $1,000 from one signature.",
      commissionStructure: [
        "15% on deals under $2,000/month",
        "20% on deals $2,000/month and above",
        "Commission paid after client makes first payment",
        "$500 retention bonus for every client you close that stays active 6 months",
      ],
      provides: [
        "Full sales training — digital and in person",
        "Proposal and contract templates ready to go",
        "Demo websites to show prospects",
        "Marketing materials",
        "Direct line to Isaac",
        "Territory assignment across Connecticut with priority on Fairfield County",
      ],
      bonus: "First rep to close 25 clients at $1,500/month or above earns a $1,000 cash bonus.",
      topEarner: "Top earner potential: $150,000+ per year with the right hustle.",
    },
    fields: [
      { column: "city", label: "City in CT", type: "text", required: true, placeholder: "Waterbury" },
      { column: "has_transportation_license", label: "Do you have a reliable vehicle and valid CT driver's license?", type: "yesno", required: true },
      { column: "speaks_spanish", label: "Do you speak Spanish?", type: "select", required: true, options: ["Yes, fluently", "Somewhat", "No"] },
      { column: "sales_experience", label: "Sales Experience", type: "select", required: true, options: EXPERIENCE_0_TO_5 },
      { column: "sales_experience_desc", label: "Describe your sales experience", type: "textarea", required: true },
      { column: "why_position", label: "Why do you want this position?", type: "textarea", required: true },
      { column: "start_timing", label: "How soon can you start?", type: "select", required: true, options: START_TIMES_4 },
      { column: "linkedin_url", label: "LinkedIn URL (optional)", type: "url", required: false, placeholder: "https://linkedin.com/in/…" },
    ],
  },
  {
    id: "content-creator",
    title: "Social Media Content Creator",
    shortTitle: "Content Creator",
    badge: "Per Job — Flexible Schedule",
    teaser: "Script, shoot, and edit high-end short-form vertical content for Instagram and TikTok, documenting client business transformations across Connecticut.",
    description:
      "Nova Systems is building a rolling team of 5 to 10 creative content creators deployed in groups of 3 to 5 per client project. You will script, shoot, and edit high-end short-form vertical content for Instagram and TikTok — documenting client business transformations, behind the scenes footage, product reveals, and agency growth content. You must have your own equipment and reliable transportation to travel to client locations across Connecticut with priority in Fairfield County.",
    compensation: "Flat fee per content package completed, or a percentage of the client's monthly social media retainer. As the client roster grows, so does your work volume.",
    requirements: [
      "Own camera, lighting, and microphone equipment",
      "Own reliable vehicle",
      "Experience with CapCut, Premiere Pro, or similar",
      "Portfolio of past content required",
      "Connecticut based preferred",
    ],
    hasPassword: true,
    hasPortfolio: true,
    portfolioLabel: "Portfolio (video files or links)",
    fields: [
      { column: "city", label: "City in CT", type: "text", required: true, placeholder: "Waterbury" },
      { column: "equipment_owned", label: "Equipment Owned", type: "textarea", required: true, placeholder: "Sony A7III, ring light, Rode mic…" },
      { column: "has_transportation", label: "Do you have reliable transportation?", type: "yesno", required: true },
      { column: "platforms", label: "Platforms you create for", type: "checkboxes", required: true, options: ["Instagram", "TikTok", "YouTube", "Facebook"] },
      { column: "instagram_tiktok", label: "Instagram or TikTok Handle", type: "text", required: false, placeholder: "@yourhandle" },
      { column: "editing_software", label: "Software you use for editing", type: "textarea", required: true, placeholder: "CapCut, Premiere Pro…" },
      { column: "bio", label: "Brief Bio", type: "textarea", required: true },
    ],
  },
  {
    id: "lead-gen",
    title: "Outbound Lead Generation Specialist",
    shortTitle: "Lead Gen Specialist",
    badge: "Remote — Commission Per Closed Lead",
    teaser: "100% remote, no experience required — research Connecticut businesses, send outreach emails from our scripts, and get paid when your leads sign.",
    description:
      "This is a 100% remote position. No transportation required. No coding required. Working from home, you will research targeted local businesses in Connecticut, send cold outreach emails using pre-made Nova Systems scripts, and generate interested responses. Your only job is to get a yes I am interested and hand the warm lead to Isaac or a sales rep. You do not need to close anything — just open the door.",
    compensation: "Commission only. You earn a flat referral bonus of $100 to $200 for every lead you generate that signs a contract and pays Nova Systems. No cap on how many leads you can generate.",
    requirements: [
      "Strong written communication",
      "Ability to research businesses online",
      "Organized and consistent",
      "Email and internet access",
      "No experience required — full training provided",
    ],
    hasPassword: false,
    hasPortfolio: false,
    fields: [
      { column: "city", label: "City and State", type: "text", required: true, placeholder: "Anywhere — this role is remote" },
      { column: "reliable_internet", label: "Do you have reliable internet access?", type: "yesno", required: true },
      { column: "outreach_experience", label: "Experience with email outreach or sales", type: "select", required: true, options: ["None", "Some", "Experienced"] },
      { column: "why_position", label: "Why do you want this position?", type: "textarea", required: true },
      { column: "hours_per_week", label: "How many hours per week can you dedicate?", type: "select", required: true, options: ["5-10", "10-20", "20+"] },
      { column: "start_timing", label: "How soon can you start?", type: "select", required: true, options: START_TIMES_3 },
    ],
  },
];

export function getJob(id) {
  return JOBS.find((j) => j.id === id);
}
