import React from "react";
import { Link } from "react-router-dom";
import { Search, MessageSquareText, RotateCcw, Activity } from "lucide-react";

const GOLD = "#C9A84C";

// The four Nova pillars in plain language. Claims here must match what the product actually does today.
const PILLARS = [
  {
    icon: Search, name: "Nova Audit", plain: "Find out what happens to your inquiries",
    body: "We review your public website, listings and contact paths, and — with your written permission — test how calls and forms are answered. You get a report that separates what we observed from what we estimate, with the source of every number.",
    note: "Delivered within an agreed 48–72 hour window once your inputs are in.",
  },
  {
    icon: MessageSquareText, name: "Nova Core", plain: "Answer, qualify and book — with your prices",
    body: "Customers who text or fill in your form get a prompt reply, choose a service from your approved price list, pick a real open time, sign your agreement and pay a deposit through Stripe. The assistant never invents prices or discounts.",
    note: "Anything unusual, upset or urgent goes to a person on your team.",
  },
  {
    icon: RotateCcw, name: "Nova Harvest", plain: "Follow up on the customers you already have",
    body: "A missed call can get one text back where the caller has given permission. Past customers who agreed to hear from you can be invited back, after you approve the list, the message and the schedule. Feedback requests are neutral and go to every customer.",
    note: "Opt-outs are honored immediately, including messages already queued.",
  },
  {
    icon: Activity, name: "Nova Sentry", plain: "Know it is working — every week",
    body: "We monitor the system's health and alert a person when something fails. Every Sunday evening you get a short report of inquiries, bookings, signed agreements and confirmed deposits, built from recorded events.",
    note: "If something cannot be measured, the report says so instead of guessing.",
  },
];

export default function FourPillarsSection() {
  return (
    <section id="services" className="py-24 px-6 bg-navy border-t scroll-mt-16" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-5" style={{ color: GOLD }}>What Nova does</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">From the first inquiry to a booked, paid job</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Nova Systems is an operations firm for local service businesses. We help you respond to inquiries, book appointments, send approved agreements, collect deposits, follow up, and check that it all keeps working. We are not an advertising agency, and this is not a chatbot that only talks.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {PILLARS.map(({ icon: Icon, name, plain, body, note }) => (
            <article key={name} className="rounded-xl p-7" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${GOLD}55` }}><Icon className="w-5 h-5" style={{ color: GOLD }} /></span>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: GOLD }}>{name}</p>
                  <h3 className="text-lg font-bold text-white">{plain}</h3>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.65)" }}>{body}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{note}</p>
            </article>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link to="/welcome" className="inline-flex items-center gap-2.5 px-8 py-3.5 text-[11px] font-bold tracking-[0.15em] uppercase" style={{ background: GOLD, color: "#0A0A0A" }}>Request an audit</Link>
        </div>
      </div>
    </section>
  );
}
