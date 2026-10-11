import React from "react";
import LegalPageLayout from "@/components/LegalPageLayout";

const SECTIONS = [
  {
    heading: "1. Services Provided",
    body: "Nova Systems provides digital infrastructure and AI automation services, including but not limited to website design and development, social media management, AI voice and text agents, business intelligence audits, and related growth services (\"Services\"). The specific Services provided to a client are defined in a separate Service Agreement or proposal prepared after Nova Systems reviews the client's Business Intelligence Assessment.",
  },
  {
    heading: "2. Payment Terms",
    body: "Unless otherwise stated in a signed Service Agreement, project-based work is billed as 50% deposit due before work begins and the remaining 50% due upon completion of the agreed deliverables. Ongoing monthly services are billed in advance on a recurring basis. Nova Systems may save a payment method on file to streamline this process — no charge is made to a payment method on file until a proposal has been approved and a service agreement signed. Late payments may result in a pause of active services until the account is brought current.",
  },
  {
    heading: "3. Cancellation Policy",
    body: "New clients have a 10 calendar day review period after submitting a Business Intelligence Assessment to decide whether to move forward, during which no fee applies. If a client authorizes work to begin and then cancels after that 10 day period, an administrative fee of up to $25 may apply to help cover the time spent researching the business and preparing its proposal, as described in the Service Agreement. Once services are active, either party may cancel with 30 days written notice to hello@nova-systems.app. Fees for work already performed, and for the notice period, remain due. No refunds are issued for partial periods of service already rendered.",
  },
  {
    heading: "4. Intellectual Property",
    body: "Nova Systems owns all rights to the tools, systems, templates, frameworks, source code libraries, and methodologies it builds and uses to deliver Services, and may reuse non-client-specific components in work for other clients. The client owns their own business content and data — including their brand assets, business information, and the information submitted through the Business Intelligence Assessment — and grants Nova Systems a license to use that content and data solely to deliver and improve the Services.",
  },
  {
    heading: "5. Limitation of Liability",
    body: "Nova Systems will perform Services with reasonable skill and care. To the maximum extent permitted by law, Nova Systems' total liability arising out of or related to the Services is limited to the amount paid by the client for the Services in the three months preceding the claim. Nova Systems is not liable for indirect, incidental, or consequential damages, including lost profits or lost data.",
  },
  {
    heading: "6. Governing Law",
    body: "These Terms of Service are governed by the laws of the State of Connecticut, without regard to its conflict of law principles. Any dispute arising under these terms will be resolved in the state or federal courts located in Connecticut.",
  },
  {
    heading: "7. Contact",
    body: "Questions about these Terms of Service can be sent to hello@nova-systems.app or by text to (203) 706-0504.",
  },
];

export default function Terms() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      effectiveDate="January 1, 2026"
      sections={SECTIONS}
      seoDescription="Nova Systems Terms of Service — the rules and guidelines for working with Nova Systems."
    />
  );
}
