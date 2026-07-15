import React from "react";
import { Checkbox, Field, TextInput, Select, PillGroup } from "./ui";

// Shared shape for sections 8 (Marketing), 9 (Technology), 10 (Communication):
// a checklist of options where checking one reveals a small detail sub-form.
// data: { [optionLabel]: { active: true, ...detailValues } }
export default function ChecklistSection({ options, data, onChange, detailFields }) {
  const toggle = (label) => {
    const current = data[label];
    if (current?.active) {
      const next = { ...data };
      delete next[label];
      onChange(next);
    } else {
      onChange({ ...data, [label]: { active: true } });
    }
  };

  const updateDetail = (label, patch) => {
    onChange({ ...data, [label]: { ...data[label], ...patch } });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {options.map((label) => {
        const item = data[label];
        const active = !!item?.active;
        return (
          <div key={label} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: active ? 18 : 12, paddingTop: 12 }}>
            <Checkbox checked={active} onChange={() => toggle(label)}>{label}</Checkbox>
            {active && (
              <div style={{ marginTop: 14, marginLeft: 28, display: "flex", flexDirection: "column", gap: 14 }}>
                {detailFields.map((f) => (
                  <Field key={f.key} label={f.label}>
                    {f.type === "text" && (
                      <TextInput value={item[f.key] || ""} onChange={(e) => updateDetail(label, { [f.key]: e.target.value })} />
                    )}
                    {f.type === "select" && (
                      <Select value={item[f.key] || ""} onChange={(e) => updateDetail(label, { [f.key]: e.target.value })} options={f.options} />
                    )}
                    {f.type === "pills" && (
                      <PillGroup value={item[f.key] || ""} onChange={(v) => updateDetail(label, { [f.key]: v })} options={f.options} />
                    )}
                  </Field>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
        Check every option that applies — details will appear below each one you select.
      </p>
    </div>
  );
}
