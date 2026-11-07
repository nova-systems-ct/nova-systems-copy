import React from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    "heading": "1. Information we collect",
    "body": "We collect the contact and business details you submit, audit goals and answers, documents or photos you upload, inquiry and booking records, agreement signatures, and service communications. Public-first audits also collect business website content, public listings, email-domain records and competitor information, with source references. Connected client systems can provide additional records only within the agreed scope. Website requests and service providers may process technical information such as IP addresses, device information, timestamps and error logs."
  },
  {
    "heading": "2. How we use information",
    "body": "We use information to respond to requests, research and deliver Nova Audits, prepare reports and proposals, operate authorized business workflows, maintain account security, and provide contracted services. Client records are used to carry out the client's instructions. We do not sell personal information. Do not upload payment card numbers, government identification, health records or other sensitive material unless a separate approved workflow specifically requires it."
  },
  {
    "heading": "3. Contact preferences and marketing",
    "body": "Submitting a request lets us respond about that request; it does not by itself authorize unrelated marketing calls, texts or WhatsApp messages. The optional marketing checkbox on our inquiry form applies to marketing email. Promotional phone or text campaigns require the applicable, separately recorded permission before activation. You can withdraw marketing permission using an available unsubscribe link, replying STOP to texts, or contacting isaac@nova-systems.app. Necessary account or requested service messages are handled separately from marketing."
  },
  {
    "heading": "4. AI and communications",
    "body": "Where enabled for an agreed service, AI providers process the relevant information needed to analyze evidence or handle a business workflow. AI output may be incomplete or incorrect and is subject to review and the configured approval rules. Voice recordings and transcripts, if enabled, require an appropriate notice and consent process before recording. A client's customer list is not permission to contact everyone on it."
  },
  {
    "heading": "5. Service providers and public research",
    "body": "Our application uses Supabase for database, authentication and file storage, and Vercel or Render for website hosting, depending on the deployment. Depending on the services enabled, providers may include Resend for email, Twilio for communications, Stripe for payments and Anthropic for AI processing. Public research requests can reach the business website, public listing services such as OpenStreetMap, and DNS providers. Optional integrations are not all active for every account. Each provider processes information under its own applicable terms and our service configuration. Card entry is handled by the payment provider; do not send card numbers to Nova by email or chat."
  },
  {
    "heading": "6. Storage and safeguards",
    "body": "We use access controls, organization-scoped authorization and private storage for audit reports, agreements and non-public uploads. Access is limited to authorized people and service components that need it. Public marketing assets are handled separately. No internet service can guarantee absolute security; report a suspected exposure to isaac@nova-systems.app. Do not place sensitive information in a publicly shared link."
  },
  {
    "heading": "7. Retention and your requests",
    "body": "We retain records for the service purpose, account administration, security, dispute handling and applicable legal obligations. Contact isaac@nova-systems.app to request access, correction, a copy or deletion of your information, to withdraw consent, or to raise a privacy concern. We may verify your identity and the authority to act for a business before responding. Applicable legal rights, response periods and permitted retention exceptions depend on the request and jurisdiction; account closure does not promise immediate deletion of backups or legally required records."
  },
  {
    "heading": "8. Job applicants",
    "body": "Application details, resumes, portfolios and references are used for recruitment and related communications. Applicant information is not used as a marketing list. Provide reference contact information only when authorized to do so. Requests about an application or its personal information can be sent to isaac@nova-systems.app."
  },
  {
    "heading": "9. Browser storage and connected services",
    "body": "The application uses essential browser storage for authentication sessions, selected organization, display preferences and unsaved form drafts. A saved draft may later be sent when you submit the form. Our reviewed source does not include advertising pixels or a general-purpose analytics tag. Hosting, fonts, payments and other enabled providers may still receive technical requests. See the Cookie Policy for the distinction between essential storage and optional tracking."
  },
  {
    "heading": "10. Contact and changes",
    "body": "Nova Systems operates from Waterbury, Connecticut. Contact Isaac at isaac@nova-systems.app or (203) 706-0504. We update this notice when our practices change and display the current version date. If we process personal information for a client business, that business may also provide its own privacy notice and instructions."
  }
];

export default function Privacy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      effectiveDate="November 1, 2026"
      sections={SECTIONS}
      seoDescription="Nova Systems Privacy Policy \u2014 service scope, information practices and your choices."
    />
  );
}
