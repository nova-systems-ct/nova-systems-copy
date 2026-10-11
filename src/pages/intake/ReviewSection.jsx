import React from "react";
import { GOLD } from "./ui";

const truncate = (s, n = 140) => (s && s.length > n ? `${s.slice(0, n)}…` : s);
const dash = (v) => (v === undefined || v === null || v === "" ? "—" : v);

function buildSummary(form) {
  const checkedList = (obj) => Object.keys(obj || {}).filter((k) => obj[k]?.active).join(", ") || "None selected";
  const docCount = Object.values(form.document_urls || {}).reduce((n, arr) => n + (arr?.length || 0), 0);

  return [
    {
      title: "About You", step: 0,
      rows: [["Name", form.name], ["Email", form.email], ["Phone", form.phone], ["Best Time", form.best_time], ["Preferred Contact", form.preferred_contact]],
    },
    {
      title: "Your Business", step: 1,
      rows: form.businesses.map((b, i) => [`Business ${i + 1}`, [b.business_name, b.industry].filter(Boolean).join(" — ") || "—"]),
    },
    {
      title: "Your Story", step: 2,
      rows: [["Business Story", truncate(form.story.business_story)], ["Differentiation", truncate(form.story.differentiation)]],
    },
    {
      title: "Your Goals", step: 3,
      rows: [["12-Month Revenue Goal", form.goals.revenue_goal_12mo], ["One Problem to Solve", truncate(form.goals.one_problem_to_solve)]],
    },
    {
      title: "Your Customers", step: 4,
      rows: [["Ideal Customer", truncate(form.customers.ideal_customer)], ["Why They Leave", truncate(form.customers.why_leave)]],
    },
    {
      title: "Products & Services", step: 5,
      rows: form.services.map((s, i) => [`Service ${i + 1}`, [s.name, s.price].filter(Boolean).join(" — ") || "—"]),
    },
    {
      title: "Sales Process", step: 6,
      rows: [["How They Find You", truncate(form.sales_process.how_found)], ["Where Leads Disappear", truncate(form.sales_process.where_leads_disappear)]],
    },
    { title: "Marketing", step: 7, rows: [["Platforms In Use", checkedList(form.marketing)]] },
    { title: "Technology", step: 8, rows: [["Tools In Use", checkedList(form.technology)]] },
    { title: "Communication", step: 9, rows: [["Channels Used", checkedList(form.communication)]] },
    {
      title: "Team", step: 10,
      rows: [["Full Time / Part Time", `${dash(form.team.full_time_count)} / ${dash(form.team.part_time_count)}`], ["Biggest Time Waster", truncate(form.team.biggest_time_waster)]],
    },
    {
      title: "Reputation", step: 11,
      rows: [["Google Rating", form.reputation.google_rating], ["Facebook Rating", form.reputation.facebook_rating]],
    },
    {
      title: "Financial Snapshot", step: 12,
      rows: [["Monthly Revenue Range", form.financials.monthly_revenue_range], ["Marketing Budget", form.financials.marketing_budget]],
    },
    {
      title: "Competitors", step: 13,
      rows: [["Listed Competitors", (form.competitors.list || []).map((c) => c.name).filter(Boolean).join(", ") || "None"]],
    },
    {
      title: "AI Knowledge Base", step: 14,
      rows: [["Brand Personality", form.ai_knowledge.brand_personality], ["Hours", form.ai_knowledge.hours]],
    },
    { title: "Document Upload", step: 15, rows: [["Files Uploaded", `${docCount} file${docCount === 1 ? "" : "s"}`]] },
    {
      title: "Final Questions", step: 16,
      rows: [["Biggest Fix", truncate(form.final_questions.fix_one_thing)], ["Losing Money Where", truncate(form.final_questions.losing_money_where)]],
    },
  ];
}

export default function ReviewSection({ form, goToStep }) {
  const blocks = buildSummary(form);
  return (
    <>
      <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginTop: -8, marginBottom: 4 }}>
        Confirm everything below is accurate before continuing. Use Edit to jump back to any section.
      </p>
      {blocks.map((b) => (
        <div key={b.title} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{b.title}</p>
            <button
              type="button"
              onClick={() => goToStep(b.step)}
              style={{ background: "none", border: "none", color: GOLD, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              Edit
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {b.rows.map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12 }}>
                <span style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>{label}</span>
                <span style={{ color: "rgba(255,255,255,0.75)", textAlign: "right" }}>{dash(value)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
