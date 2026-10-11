import React from "react";
import { Plus, X } from "lucide-react";
import { Field, TextInput, TextArea, PillGroup, Select, GOLD } from "./ui";
import { emptyCompetitor } from "./constants";
import { COMPETITOR_FIELDS } from "./sectionConfigs";

export default function CompetitorsSection({ competitors, onChange }) {
  const list = competitors.list || [];
  const updateList = (next) => onChange({ ...competitors, list: next });
  const updateField = (patch) => onChange({ ...competitors, ...patch });

  const updateCompetitor = (id, patch) => updateList(list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const add = () => { if (list.length < 5) updateList([...list, emptyCompetitor()]); };
  const remove = (id) => updateList(list.filter((c) => c.id !== id));

  return (
    <>
      <Field label="Your Top Competitors (up to 5)">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((c, i) => (
            <div key={c.id} className="grid sm:grid-cols-2 gap-3" style={{ position: "relative" }}>
              <TextInput value={c.name} onChange={(e) => updateCompetitor(c.id, { name: e.target.value })} placeholder={`Competitor ${i + 1} name`} />
              <div style={{ display: "flex", gap: 8 }}>
                <TextInput value={c.website} onChange={(e) => updateCompetitor(c.id, { website: e.target.value })} placeholder="Website" />
                {list.length > 1 && (
                  <button type="button" onClick={() => remove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                    <X style={{ width: 16, height: 16 }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {list.length < 5 && (
          <button
            type="button"
            onClick={add}
            style={{
              marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6,
              background: "none", border: "none", color: GOLD, fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Plus style={{ width: 13, height: 13 }} /> Add Competitor
          </button>
        )}
      </Field>

      {COMPETITOR_FIELDS.map((f) => (
        <Field key={f.key} label={f.label}>
          {f.type === "textarea" && (
            <TextArea value={competitors[f.key] || ""} onChange={(e) => updateField({ [f.key]: e.target.value })} />
          )}
          {f.type === "text" && (
            <TextInput value={competitors[f.key] || ""} onChange={(e) => updateField({ [f.key]: e.target.value })} />
          )}
          {f.type === "select" && (
            <Select value={competitors[f.key] || ""} onChange={(e) => updateField({ [f.key]: e.target.value })} options={f.options} />
          )}
          {f.type === "pills" && (
            <PillGroup value={competitors[f.key] || ""} onChange={(v) => updateField({ [f.key]: v })} options={f.options} />
          )}
        </Field>
      ))}
    </>
  );
}
