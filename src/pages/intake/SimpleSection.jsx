import React from "react";
import { Field, TextInput, TextArea, Select, PillGroup } from "./ui";

// Renders a flat text/textarea/select/pills form from a field config array.
// data/onChange operate on the section's plain object (e.g. form.story).
export default function SimpleSection({ config, data, onChange, hint }) {
  return (
    <>
      {hint && <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginTop: -8 }}>{hint}</p>}
      {config.map((f) => (
        <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
          {f.type === "textarea" && (
            <TextArea
              value={data[f.key] || ""}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              minChars={f.minChars}
              rows={f.rows}
            />
          )}
          {f.type === "text" && (
            <TextInput
              value={data[f.key] || ""}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              placeholder={f.placeholder}
            />
          )}
          {f.type === "select" && (
            <Select
              value={data[f.key] || ""}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              options={f.options}
            />
          )}
          {f.type === "pills" && (
            <PillGroup
              value={data[f.key] || ""}
              onChange={(v) => onChange({ [f.key]: v })}
              options={f.options}
            />
          )}
        </Field>
      ))}
    </>
  );
}
