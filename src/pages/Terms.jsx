import React from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    "heading": "1. Services and agreed scope",
    "body": "Nova Systems provides business audits and authorized systems, integrations and operational services. Each engagement must identify its scope, deliverables, timing, approvals and any external providers in an accepted proposal or service agreement. A feature shown as unavailable, in testing or awaiting setup is not a promise that it is live. A complimentary audit authorization does not purchase an installation or authorize charges."
  },
  {
    "heading": "2. Audit evidence and authorization",
    "body": "Public research findings identify their sources and distinguish observations, estimates and information that could not be checked. Exact lost revenue cannot be established from public website observations alone. Testing calls, emails, private systems or security controls requires authorization covering the method and system. An audit does not authorize intrusion into third-party systems or a production change outside the agreed scope."
  },
  {
    "heading": "3. Pricing and changes",
    "body": "The accepted proposal or service agreement sets the price, deposit, recurring charges, provider costs, cancellation terms and refund policy. We do not impose a research fee or other charge solely because you submit an inquiry or receive a complimentary audit. Additional work, spending or subscriptions require approval under the applicable agreement. Any saved payment method must be handled by the payment provider through the agreed authorization process."
  },
  {
    "heading": "4. Client responsibilities and integrations",
    "body": "Clients must have authority over the systems, accounts and materials they connect, provide accurate approved business information, and identify the people responsible for decisions and escalations. Provider access, permissions, technical compatibility and any provider approval must be checked before installation. Availability of a third-party platform or approval of an integration is not controlled by Nova."
  },
  {
    "heading": "5. Automation and communications",
    "body": "Automation operates within the approved playbook, access permissions, budget and escalation rules. Clients must approve their offers, prices, marketing claims and appropriate communication permissions. Nova and the client each retain their applicable legal responsibilities; hiring a service provider does not remove them. AI-generated results may require human review. Payments, bookings, communications and other external actions are subject to the configured authorization and provider readiness."
  },
  {
    "heading": "6. Ownership and confidentiality",
    "body": "Clients retain ownership of their business information and supplied brand assets. Nova uses that material for the authorized engagement and protects non-public information according to the service agreement and Privacy Policy. Ownership or licensing of custom deliverables, source code and reusable Nova components must be specified in the service agreement; no broader transfer is implied by an inquiry."
  },
  {
    "heading": "7. Security and service concerns",
    "body": "Do not use Nova to access systems without permission, send unlawful messages, impersonate someone deceptively or upload material you are not entitled to use. Tell us promptly about a suspected security incident or incorrect external action so the affected workflow can be paused and investigated. Review the agreed acceptance tests before relying on a newly installed workflow."
  },
  {
    "heading": "8. Results, disputes and applicable law",
    "body": "Nova will perform the agreed work with reasonable care, but an audit or automation cannot guarantee a particular revenue figure, customer count, uninterrupted third-party service or legal outcome. Any warranties, remedies and limitations must be stated in the accepted service agreement and remain subject to rights that cannot lawfully be excluded. Connecticut law applies except where mandatory law or the signed agreement provides otherwise. Contact us first to discuss a service concern."
  },
  {
    "heading": "9. Contact",
    "body": "Questions about an engagement or these terms: isaac@nova-systems.app, (203) 706-0504, Nova Systems, Waterbury, Connecticut. Review these website terms together with the engagement-specific agreement and Privacy Policy."
  }
];

export default function Terms() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      effectiveDate="November 1, 2026"
      sections={SECTIONS}
      seoDescription="Nova Systems Terms of Service \u2014 service scope, information practices and your choices."
    />
  );
}
