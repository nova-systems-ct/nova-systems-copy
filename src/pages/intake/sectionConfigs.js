import {
  REVENUE_RANGES, BUDGET_RANGES, YES_NO, BRAND_PERSONALITIES,
  FREQUENCY_OPTIONS, BRINGS_CUSTOMERS_OPTIONS, RESPONSE_TIME_OPTIONS,
  WHO_RESPONDS_OPTIONS, FREQUENCY_MISS_OPTIONS,
} from "./constants";

// Field shape: { key, label, type: 'text'|'textarea'|'select'|'pills', required, minChars, options, placeholder }
// Drives SimpleSection.jsx for the sections that are pure text/select/pills forms.

export const STORY_FIELDS = [
  { key: "business_story", label: "Tell us your business story", type: "textarea", minChars: 500, rows: 7, required: true },
  { key: "why_started", label: "Why did you start it?", type: "textarea" },
  { key: "differentiation", label: "What makes you different from competitors?", type: "textarea" },
  { key: "strengths", label: "What are your biggest strengths?", type: "textarea" },
  { key: "weaknesses", label: "What are your biggest weaknesses?", type: "textarea" },
  { key: "proudest", label: "What are you most proud of?", type: "textarea" },
  { key: "compliments", label: "What do customers compliment most?", type: "textarea" },
  { key: "frustrations", label: "What frustrates you most about running this business?", type: "textarea" },
];

export const GOALS_FIELDS = [
  { key: "revenue_goal_12mo", label: "Revenue goal for the next 12 months", type: "text" },
  { key: "customer_goal", label: "Customer count goal", type: "text" },
  { key: "employee_goal", label: "Employee goal", type: "text" },
  { key: "biggest_challenge", label: "Biggest challenge today", type: "textarea" },
  { key: "biggest_opportunity", label: "Biggest opportunity you see", type: "textarea" },
  { key: "one_problem_to_solve", label: "If Nova Systems could solve ONE problem, what would it be?", type: "textarea" },
  { key: "success_1yr", label: "What does success look like in one year?", type: "textarea" },
  { key: "success_3yr", label: "What does success look like in three years?", type: "textarea" },
];

export const CUSTOMERS_FIELDS = [
  { key: "ideal_customer", label: "Who is your ideal customer?", type: "textarea" },
  { key: "not_ideal_customer", label: "Who is NOT your ideal customer?", type: "textarea" },
  { key: "avg_age_range", label: "Average customer age range", type: "text" },
  { key: "geography", label: "Where do they live?", type: "pills", options: ["Local", "Regional", "National"] },
  { key: "avg_order_value", label: "Average order or transaction value", type: "text" },
  { key: "repeat_or_one_time", label: "Repeat customers or one-time?", type: "pills", options: ["Mostly Repeat", "Mostly One-Time", "Even Mix"] },
  { key: "why_buy", label: "Why do customers buy from you?", type: "textarea" },
  { key: "why_leave", label: "Why do customers leave?", type: "textarea" },
  { key: "objections", label: "What objections do customers have?", type: "textarea" },
  { key: "lose_to", label: "Do you lose more customers to price, competition, slow response, or something else?", type: "pills", options: ["Price", "Competition", "Slow Response", "Something Else"] },
];

export const SALES_PROCESS_FIELDS = [
  { key: "journey", label: "Walk us through what happens from when someone discovers you until they become a client", type: "textarea", minChars: 200, rows: 7 },
  { key: "how_found", label: "How do people usually find you?", type: "textarea" },
  { key: "after_call", label: "What happens after they call?", type: "textarea" },
  { key: "after_email", label: "What happens after they email?", type: "textarea" },
  { key: "after_form", label: "What happens after they submit a form?", type: "textarea" },
  { key: "who_follows_up", label: "Who follows up?", type: "text" },
  { key: "follow_up_time", label: "How long does it take?", type: "text" },
  { key: "software_used", label: "What software do you use?", type: "text" },
  { key: "people_involved", label: "How many people are involved?", type: "text" },
  { key: "where_leads_disappear", label: "Where do most leads disappear?", type: "textarea" },
];

export const TEAM_FIELDS = [
  { key: "full_time_count", label: "Number of full time employees", type: "text" },
  { key: "part_time_count", label: "Number of part time employees", type: "text" },
  { key: "who_answers_phones", label: "Who answers phones?", type: "text" },
  { key: "who_replies_emails", label: "Who replies to emails?", type: "text" },
  { key: "who_handles_social", label: "Who handles social media?", type: "text" },
  { key: "who_books_appointments", label: "Who books appointments?", type: "text" },
  { key: "biggest_time_waster", label: "What is the biggest time waster in your business?", type: "textarea" },
  { key: "biggest_training_issue", label: "What is the biggest training issue?", type: "textarea" },
  { key: "well_trained", label: "Would you say your team is well trained?", type: "pills", options: ["Yes", "Somewhat", "No"] },
  { key: "hire_first_for", label: "What would you hire for first if you could?", type: "text" },
];

export const REPUTATION_FIELDS = [
  { key: "google_rating", label: "Current Google rating", type: "select", options: ["1", "2", "3", "4", "5", "Not Sure"] },
  { key: "google_review_count", label: "Number of Google reviews", type: "text" },
  { key: "facebook_rating", label: "Current Facebook rating", type: "text" },
  { key: "common_complaint", label: "Most common complaint in reviews", type: "textarea" },
  { key: "common_compliment", label: "Most common compliment in reviews", type: "textarea" },
  { key: "review_ask_method", label: "How do you currently ask for reviews?", type: "pills", options: ["You Don't", "Manually", "Automated"] },
  { key: "respond_to_reviews", label: "Do you respond to reviews?", type: "pills", options: ["Always", "Sometimes", "Never"] },
  { key: "lost_customer_to_review", label: "Have you ever lost a customer because of a bad review?", type: "pills", options: YES_NO },
];

export const FINANCIALS_FIELDS = [
  { key: "monthly_revenue_range", label: "Monthly revenue range", type: "select", options: REVENUE_RANGES },
  { key: "avg_sale_range", label: "Average sale amount range", type: "text" },
  { key: "new_customers_per_month", label: "New customers per month range", type: "text" },
  { key: "repeat_customers_per_month", label: "Repeat customers per month range", type: "text" },
  { key: "marketing_budget", label: "Monthly marketing budget", type: "select", options: BUDGET_RANGES },
  { key: "biggest_expense", label: "Biggest monthly expense category", type: "text" },
  { key: "highest_profit_item", label: "Highest profit service or product", type: "text" },
  { key: "lowest_profit_item", label: "Lowest profit service or product", type: "text" },
];

export const AI_KNOWLEDGE_FIELDS = [
  { key: "pricing", label: "Your pricing", type: "textarea" },
  { key: "policies", label: "Your policies", type: "textarea" },
  { key: "guarantees", label: "Your guarantees", type: "textarea" },
  { key: "refund_policy", label: "Your refund policy", type: "textarea" },
  { key: "common_qa", label: "Common customer questions and answers", type: "textarea" },
  { key: "brand_personality", label: "Your brand personality — how do you want to sound?", type: "pills", options: BRAND_PERSONALITIES },
  { key: "never_say", label: "Things AI should NEVER say", type: "textarea" },
  { key: "always_say", label: "Things AI should ALWAYS say or include", type: "textarea" },
  { key: "hours", label: "Your hours of operation", type: "text" },
  { key: "emergency_contact", label: "Emergency or after hours contact", type: "text" },
];

// Detail fields shown beneath each checked item in ChecklistSection (sections 8, 9, 10).
export const MARKETING_DETAIL_FIELDS = [
  { key: "frequency", label: "How often do you post or run it?", type: "pills", options: FREQUENCY_OPTIONS },
  { key: "brings_customers", label: "Does it bring customers?", type: "pills", options: BRINGS_CUSTOMERS_OPTIONS },
  { key: "happy", label: "Happy with results?", type: "pills", options: YES_NO },
  { key: "budget", label: "Monthly budget", type: "select", options: BUDGET_RANGES },
  { key: "frustration", label: "Biggest frustration with it", type: "text" },
];

export const TECHNOLOGY_DETAIL_FIELDS = [
  { key: "software_name", label: "What software specifically?", type: "text" },
  { key: "love", label: "What do you love about it?", type: "text" },
  { key: "hate", label: "What do you hate about it?", type: "text" },
  { key: "cost_range", label: "Monthly cost range", type: "select", options: BUDGET_RANGES },
];

export const COMMUNICATION_DETAIL_FIELDS = [
  { key: "response_time", label: "Average response time", type: "pills", options: RESPONSE_TIME_OPTIONS },
  { key: "who_responds", label: "Who responds?", type: "pills", options: WHO_RESPONDS_OPTIONS },
  { key: "miss_messages", label: "Do you miss messages?", type: "pills", options: FREQUENCY_MISS_OPTIONS },
  { key: "complaints", label: "Do customers complain about response time?", type: "pills", options: FREQUENCY_MISS_OPTIONS },
];

// Section 14 fields other than the repeatable competitor list.
export const COMPETITOR_FIELDS = [
  { key: "admire_who", label: "Who do you admire most in your industry?", type: "text" },
  { key: "admire_why", label: "Why do you admire them?", type: "textarea" },
  { key: "threat_who", label: "Who do you see as your biggest threat?", type: "text" },
  { key: "threat_why", label: "Why do you see them as a threat?", type: "textarea" },
  { key: "what_they_do_better", label: "What do competitors do better than you?", type: "textarea" },
  { key: "what_we_do_better", label: "What do you do better than competitors?", type: "textarea" },
  { key: "path_to_number_one", label: "What would it take to become the number one business in your area?", type: "textarea" },
];

export const FINAL_QUESTIONS_FIELDS = [
  { key: "fix_one_thing", label: "If you could fix one thing in your business tomorrow, what would it be?", type: "textarea" },
  { key: "losing_money_where", label: "Where do you think you are losing the most money?", type: "textarea" },
  { key: "time_waster", label: "What takes up most of your time that should not?", type: "textarea" },
  { key: "extra_employee_task", label: "If you had one extra employee, what would they do?", type: "textarea" },
  { key: "phone_50_more_calls", label: "If your phone rang 50 more times this month, could you handle it?", type: "pills", options: ["Yes", "No", "Maybe"] },
  { key: "secret_shopper_criticism", label: "If someone secretly followed your business for a week, what would they criticize?", type: "textarea" },
  { key: "keeps_up_at_night", label: "What part of running this business keeps you up at night?", type: "textarea" },
  { key: "tried_before", label: "What have you already tried that did not work?", type: "textarea" },
  { key: "worth_it_definition", label: "What would make you say Nova Systems was worth every penny six months from now?", type: "textarea" },
];
