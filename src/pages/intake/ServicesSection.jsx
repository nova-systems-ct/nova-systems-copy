import React from "react";
import { Plus, X } from "lucide-react";
import { Field, TextInput, PillGroup, GOLD } from "./ui";
import { YES_NO, emptyService } from "./constants";

export default function ServicesSection({ services, onChange }) {
  const update = (id, patch) => onChange(services.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const add = () => onChange([...services, emptyService()]);
  const remove = (id) => onChange(services.filter((s) => s.id !== id));

  return (
    <>
      {services.map((svc, i) => (
        <div key={svc.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 20, position: "relative" }}>
          {services.length > 1 && (
            <button type="button" onClick={() => remove(svc.id)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          )}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: 16 }}>
            Service {i + 1}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Name" required={i === 0}>
              <TextInput value={svc.name} onChange={(e) => update(svc.id, { name: e.target.value })} placeholder="Service or product name" />
            </Field>
            <Field label="Price">
              <TextInput value={svc.price} onChange={(e) => update(svc.id, { price: e.target.value })} placeholder="e.g. $150" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Is this your best seller?">
                <PillGroup value={svc.best_seller} onChange={(v) => update(svc.id, { best_seller: v })} options={YES_NO} />
              </Field>
              <Field label="Is this your highest profit?">
                <PillGroup value={svc.highest_profit} onChange={(v) => update(svc.id, { highest_profit: v })} options={YES_NO} />
              </Field>
            </div>
            <Field label="Which service do you wish sold more?">
              <TextInput value={svc.wish_sold_more} onChange={(e) => update(svc.id, { wish_sold_more: e.target.value })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Is it seasonal?">
                <PillGroup value={svc.seasonal} onChange={(v) => update(svc.id, { seasonal: v })} options={YES_NO} />
              </Field>
              <Field label="How long to deliver?">
                <TextInput value={svc.delivery_time} onChange={(e) => update(svc.id, { delivery_time: e.target.value })} placeholder="e.g. 2 days" />
              </Field>
            </div>
            <Field label="Common upsells">
              <TextInput value={svc.upsells} onChange={(e) => update(svc.id, { upsells: e.target.value })} />
            </Field>
            <Field label="Common customer questions about this service">
              <TextInput value={svc.common_questions} onChange={(e) => update(svc.id, { common_questions: e.target.value })} />
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
        <Plus style={{ width: 14, height: 14 }} /> Add Service
      </button>
    </>
  );
}
