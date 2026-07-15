import React from "react";
import { Plus, X } from "lucide-react";
import { Field, TextInput, Select, GOLD } from "./ui";
import { INDUSTRIES, REVENUE_RANGES, emptyBusiness } from "./constants";

export default function BusinessesSection({ businesses, onChange }) {
  const update = (id, patch) => onChange(businesses.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const add = () => onChange([...businesses, emptyBusiness()]);
  const remove = (id) => onChange(businesses.filter((b) => b.id !== id));

  return (
    <>
      {businesses.map((biz, i) => (
        <div key={biz.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 20, position: "relative" }}>
          {businesses.length > 1 && (
            <button type="button" onClick={() => remove(biz.id)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          )}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: 16 }}>
            Business {i + 1}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Business Name" required={i === 0}>
              <TextInput value={biz.business_name} onChange={(e) => update(biz.id, { business_name: e.target.value })} placeholder="Your business name" />
            </Field>
            <Field label="Industry">
              <Select value={biz.industry} onChange={(e) => update(biz.id, { industry: e.target.value })} options={INDUSTRIES} />
            </Field>
            <Field label="Business Address">
              <TextInput value={biz.address} onChange={(e) => update(biz.id, { address: e.target.value })} placeholder="Street, City, State" />
            </Field>
            <Field label="Website URL">
              <TextInput value={biz.website} onChange={(e) => update(biz.id, { website: e.target.value })} placeholder="yourbusiness.com" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Years in Business">
                <TextInput value={biz.years_in_business} onChange={(e) => update(biz.id, { years_in_business: e.target.value })} placeholder="e.g. 3" />
              </Field>
              <Field label="Number of Employees">
                <TextInput value={biz.employee_count} onChange={(e) => update(biz.id, { employee_count: e.target.value })} placeholder="e.g. 5" />
              </Field>
            </div>
            <Field label="Number of Locations">
              <TextInput value={biz.locations} onChange={(e) => update(biz.id, { locations: e.target.value })} placeholder="e.g. 1" />
            </Field>
            <Field label="Monthly Revenue Range">
              <Select value={biz.monthly_revenue} onChange={(e) => update(biz.id, { monthly_revenue: e.target.value })} options={REVENUE_RANGES} />
            </Field>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px", borderRadius: 8, border: `1px dashed ${GOLD}66`,
          background: "transparent", color: GOLD, fontSize: 12.5, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <Plus style={{ width: 14, height: 14 }} /> Add Another Business
      </button>
    </>
  );
}
