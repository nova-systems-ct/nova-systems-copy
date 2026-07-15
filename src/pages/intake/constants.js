// Nova Business Intelligence Assessment — shared constants + empty-state factories.
// Field/section names here are the source of truth for the Supabase intake_submissions
// JSONB columns (story, goals, customers, services, sales_process, marketing,
// technology, communication, team, reputation, financials, competitors,
// ai_knowledge, final_questions, document_urls) — keep in sync with api/business-intake.js.

export const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const SECTION_TITLES = [
  "About You",
  "Your Business",
  "Your Story",
  "Your Goals",
  "Your Customers",
  "Products & Services",
  "Sales Process",
  "Marketing",
  "Technology",
  "Communication",
  "Team",
  "Reputation",
  "Financial Snapshot",
  "Competitors",
  "AI Knowledge Base",
  "Document Upload",
  "Final Questions",
  "Review Your Submission",
  "Reserve Your Spot",
  "Agreements & Signature",
];

export const BEST_TIMES = ["Morning (8am-12pm)", "Afternoon (12pm-5pm)", "Evening (5pm-9pm)"];
export const CONTACT_METHODS = ["Call", "Text", "WhatsApp", "Email"];

export const INDUSTRIES = [
  "Restaurant", "Barbershop", "Salon", "Medical", "Dental", "Retail", "Contractor",
  "Nonprofit", "Technology", "Fitness", "Food and Beverage", "Real Estate", "Law",
  "Finance", "Auto Services", "Home Services", "Professional Services", "Education",
  "Hospitality", "Other",
];

export const REVENUE_RANGES = ["$0-1k", "$1k-5k", "$5k-10k", "$10k-25k", "$25k-50k", "$50k-100k", "$100k+"];

export const emptyBusiness = () => ({
  id: uid("biz"), business_name: "", industry: "", address: "", website: "",
  years_in_business: "", employee_count: "", locations: "", monthly_revenue: "",
});

export const emptyService = () => ({
  id: uid("svc"), name: "", price: "", best_seller: "", highest_profit: "",
  wish_sold_more: "", seasonal: "", delivery_time: "", upsells: "", common_questions: "",
});

export const MARKETING_PLATFORMS = [
  "Website", "Google Business Profile", "Facebook", "Instagram", "TikTok", "LinkedIn",
  "YouTube", "Email Marketing", "SMS Marketing", "Google Ads", "Facebook Ads", "SEO",
  "Referrals", "Networking", "Flyers", "Billboards", "Radio", "TV", "Direct Mail", "Other",
];
export const FREQUENCY_OPTIONS = ["Daily", "Weekly", "Monthly", "Rarely"];
export const BRINGS_CUSTOMERS_OPTIONS = ["Yes", "Somewhat", "No"];
export const YES_NO = ["Yes", "No"];
export const BUDGET_RANGES = ["$0-100", "$100-500", "$500-1000", "$1000-2500", "$2500-5000", "$5000+"];

export const TECH_TOOLS = [
  "CRM", "Scheduling software", "POS system", "Online booking", "Chatbot",
  "Email marketing software", "Phone system", "Review software", "Inventory software",
  "Accounting software", "Automation software", "None of the above",
];

export const COMM_CHANNELS = [
  "Phone", "Text", "Email", "Facebook Messenger", "Instagram DM", "WhatsApp",
  "TikTok", "Website form", "Google", "Walk-in",
];
export const RESPONSE_TIME_OPTIONS = ["Under 5 min", "Under 1 hour", "Same day", "Next day", "Longer"];
export const WHO_RESPONDS_OPTIONS = ["Owner", "Employee", "Nobody consistently"];
export const FREQUENCY_MISS_OPTIONS = ["Never", "Sometimes", "Often"];

export const emptyCompetitor = () => ({ id: uid("comp"), name: "", website: "" });

export const BRAND_PERSONALITIES = ["Professional", "Friendly", "Casual", "Luxury", "Other"];

export const DOCUMENT_CATEGORIES = [
  { key: "logo", label: "Logo (PNG or SVG preferred)" },
  { key: "price_list", label: "Price List or Menu" },
  { key: "brochure", label: "Brochure or Service Catalog" },
  { key: "photos", label: "Photos of Business" },
  { key: "brand_guide", label: "Brand Guide" },
  { key: "employee_handbook", label: "Employee Handbook" },
  { key: "faqs", label: "FAQs Document" },
  { key: "other", label: "Any Other Relevant Files" },
];
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // ~4MB — stays under Vercel's default JSON body limit once base64-encoded

export const emptyForm = () => ({
  // Section 1 — About You
  name: "", email: "", phone: "", best_time: "", preferred_contact: "",

  // Section 2 — Your Business
  businesses: [emptyBusiness()],

  // Section 3 — Your Story
  story: {
    business_story: "", why_started: "", differentiation: "", strengths: "",
    weaknesses: "", proudest: "", compliments: "", frustrations: "",
  },

  // Section 4 — Your Goals
  goals: {
    revenue_goal_12mo: "", customer_goal: "", employee_goal: "", biggest_challenge: "",
    biggest_opportunity: "", one_problem_to_solve: "", success_1yr: "", success_3yr: "",
  },

  // Section 5 — Your Customers
  customers: {
    ideal_customer: "", not_ideal_customer: "", avg_age_range: "", geography: "",
    avg_order_value: "", repeat_or_one_time: "", why_buy: "", why_leave: "",
    objections: "", lose_to: "",
  },

  // Section 6 — Products & Services
  services: [emptyService()],

  // Section 7 — Sales Process
  sales_process: {
    journey: "", how_found: "", after_call: "", after_email: "", after_form: "",
    who_follows_up: "", follow_up_time: "", software_used: "", people_involved: "",
    where_leads_disappear: "",
  },

  // Section 8/9/10 — checklist-with-detail sections, keyed by option label
  marketing: {},
  technology: {},
  communication: {},

  // Section 11 — Team
  team: {
    full_time_count: "", part_time_count: "", who_answers_phones: "", who_replies_emails: "",
    who_handles_social: "", who_books_appointments: "", biggest_time_waster: "",
    biggest_training_issue: "", well_trained: "", hire_first_for: "",
  },

  // Section 12 — Reputation
  reputation: {
    google_rating: "", google_review_count: "", facebook_rating: "", common_complaint: "",
    common_compliment: "", review_ask_method: "", respond_to_reviews: "", lost_customer_to_review: "",
  },

  // Section 13 — Financial Snapshot
  financials: {
    monthly_revenue_range: "", avg_sale_range: "", new_customers_per_month: "",
    repeat_customers_per_month: "", marketing_budget: "", biggest_expense: "",
    highest_profit_item: "", lowest_profit_item: "",
  },

  // Section 14 — Competitors
  competitors: {
    list: [emptyCompetitor()], admire_who: "", admire_why: "", threat_who: "", threat_why: "",
    what_they_do_better: "", what_we_do_better: "", path_to_number_one: "",
  },

  // Section 15 — AI Knowledge Base
  ai_knowledge: {
    pricing: "", policies: "", guarantees: "", refund_policy: "", common_qa: "",
    brand_personality: "", never_say: "", always_say: "", hours: "", emergency_contact: "",
  },

  // Section 16 — Document Upload
  document_urls: {},

  // Section 17 — Final Questions
  final_questions: {
    fix_one_thing: "", losing_money_where: "", time_waster: "", extra_employee_task: "",
    phone_50_more_calls: "", secret_shopper_criticism: "", keeps_up_at_night: "",
    tried_before: "", worth_it_definition: "",
  },

  // Section 19 — Payment
  no_card_on_file: false,

  // Section 20 — Agreements & Signature
  agree_terms: false, agree_privacy: false, agree_audit_authorization: false,
  agree_no_services_until_signed: false, agree_no_charge_today: false, agree_cancellation_policy: false,
  sms_consent: false, email_consent: false, call_consent: false,
  ai_authorization: false,
  digital_signature: "", signature_date: "", signature_image: "",

  // Linked /welcome lead, populated from URL params when present
  lead_id: "",
});
