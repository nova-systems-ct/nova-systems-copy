import React from "react";
import { Link } from "react-router-dom";

const GOLD = "#C9A84C";

// Plain statement of what is available now, what is a limited pilot, and what is not live yet.
// Update this list only from the product's readiness matrix — never ahead of it.
const STATUS = [
  ["Nova Audit — evidence review and report", "Available", "Public-information review, permission-based response tests, and a written report with sourced figures."],
  ["Text and web-form inquiry handling, booking and agreements", "Limited pilot", "Set up per business. Uses only your approved prices and agreement."],
  ["Deposits", "Limited pilot", "Through Stripe-hosted checkout. Paying into your own Stripe account requires a connection we set up with you."],
  ["AI phone receptionist", "Not live yet", "Built and tested, waiting on phone-number setup. Until then, calls forward to a person on your team."],
  ["Missed-call text-back and past-customer follow-up", "Limited pilot", "Only where customers have given permission, after you approve every message and list."],
  ["Monitoring and the Sunday report", "Limited pilot", "Measured from recorded events; anything not measurable is labeled as such."],
];

export default function AvailabilitySection() {
  return (
    <section id="availability" className="py-24 px-6 bg-navy border-t scroll-mt-16" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>Straight answers</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">What is available today</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Nova is new. We would rather tell you exactly what works now than promise what does not exist yet.</p>
        </div>
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <tbody>
              {STATUS.map(([what, status, detail]) => (
                <tr key={what} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <td className="p-4 text-white font-semibold align-top" style={{ minWidth: 200 }}>{what}</td>
                  <td className="p-4 align-top whitespace-nowrap"><span className="text-[11px] font-bold px-2 py-1 rounded" style={{ color: status === "Available" ? "#7BD389" : status === "Limited pilot" ? GOLD : "#F07167", border: "1px solid currentColor" }}>{status}</span></td>
                  <td className="p-4 align-top" style={{ color: "rgba(255,255,255,0.55)", minWidth: 220 }}>{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid md:grid-cols-2 gap-5 mt-10">
          <div className="rounded-xl p-6" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 className="text-base font-bold text-white mb-2">A person is always in the loop</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>When a customer is upset, asks for a person, needs a custom quote, or the system is unsure, the conversation goes to your team and automation pauses. The assistant does not handle emergencies or give medical or legal advice. Systems and phone carriers can have outages; when they do, we tell you.</p>
          </div>
          <div className="rounded-xl p-6" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 className="text-base font-bold text-white mb-2">Your customers' data</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>Each business's records are kept separate and visible only to that business and the Nova staff working on it. Signed agreements and documents are opened through short-lived private links. Card details are entered on Stripe's page, never given to Nova. We do not sell data. Read our <Link to="/privacy" style={{ color: GOLD }}>privacy policy</Link>.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
