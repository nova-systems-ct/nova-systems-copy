import React from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    heading: "1. Information We Collect",
    body: "We collect information you provide directly to us, including your name, email address, phone number, business information, the answers you provide in our Business Intelligence Assessment (business story, goals, customers, services, marketing, technology, team, reputation, financials, competitors, and similar business details), documents and photos you upload, your digital signature, and payment details. We also automatically collect basic usage data when you visit our website.",
  },
  {
    heading: "2. How We Use It",
    body: "We use your information to respond to inquiries, run Nova Audit and prepare custom proposals and growth plans, train your Nova AI agents to represent your business accurately, deliver contracted services, process payments, and communicate with you about your account or engagement with Nova Systems.",
  },
  {
    heading: "3. SMS and Email Consent",
    body: "By submitting a form on our website, you consent to be contacted by Nova Systems and its AI systems via phone call, text message, WhatsApp, and email for business purposes, including appointment reminders, follow-ups, and marketing communications, in accordance with the Telephone Consumer Protection Act (TCPA) and the CAN-SPAM Act. Message and data rates may apply. You can opt out of SMS communications at any time by replying STOP, and out of email communications using the unsubscribe link in any email.",
  },
  {
    heading: "4. Data Storage",
    body: "Your information is stored securely using Supabase, a hosted database service operated by Supabase Inc. Uploaded documents and files are stored in a Supabase storage bucket. Access to client data is restricted to Nova Systems personnel who need it to perform their role.",
  },
  {
    heading: "5. Third-Party Services",
    body: "We use the following third-party services to operate our business and deliver Services:\n\nTwilio — for sending SMS text messages and phone communications.\nResend — for sending transactional and marketing email.\nStripe — for securely processing and storing payment information. Nova Systems never stores your raw card details.\nAnthropic (Claude) — for AI-assisted analysis of the business information you submit, used to help prepare growth plans, proposals, and your Nova AI agents.\nGoogle — for business and location data used as part of Nova Audit (e.g. Google Business Profile and mapping information).\nSupabase Inc — for hosting our database and file storage.\n\nEach of these providers has its own privacy practices governing the data they process on our behalf.",
  },
  {
    heading: "6. How to Opt Out",
    body: "You may opt out of SMS communications at any time by replying STOP to any text message. You may opt out of email communications using the unsubscribe link included in our emails. You may also contact us directly to request that we stop contacting you or delete your information, subject to any records we are required to retain by law.",
  },
  {
    heading: "7. Data Retention",
    body: "We retain your information for as long as reasonably necessary to provide Services, maintain business records, and comply with legal, tax, and accounting obligations. If you ask us to delete your information, we will do so except where we are required or permitted to retain it by law.",
  },
  {
    heading: "8. Contact Information",
    body: "For privacy-related questions or requests, contact us at hello@nova-systems.app or by text at (203) 706-0504.",
  },
];

export default function Privacy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      effectiveDate="January 1, 2026"
      sections={SECTIONS}
      seoDescription="Nova Systems Privacy Policy — how we collect, use, and protect your information."
    />
  );
}
