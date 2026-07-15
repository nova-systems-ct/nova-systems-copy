import React, { useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { GOLD } from "./ui";
import { DOCUMENT_CATEGORIES, MAX_UPLOAD_BYTES } from "./constants";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DocumentUploadSection({ documentUrls, onChange, email }) {
  const [uploading, setUploading] = useState({});
  const [errors, setErrors] = useState({});

  const filesFor = (category) => documentUrls[category] || [];

  const handleFiles = async (category, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErrors((e) => ({ ...e, [category]: "" }));

    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        setErrors((e) => ({ ...e, [category]: `"${file.name}" is too large. Please keep files under 4MB.` }));
        continue;
      }
      setUploading((u) => ({ ...u, [category]: (u[category] || 0) + 1 }));
      try {
        const file_base64 = await fileToBase64(file);
        const res = await fetch("/api/business-intake?action=upload-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, filename: file.name, content_type: file.type, file_base64, email }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
        onChange({
          ...documentUrls,
          [category]: [...filesFor(category), { url: data.url, filename: file.name, content_type: file.type }],
        });
      } catch (err) {
        setErrors((e) => ({ ...e, [category]: err.message || "Upload failed. Please try again." }));
      }
      setUploading((u) => ({ ...u, [category]: Math.max(0, (u[category] || 1) - 1) }));
    }
  };

  const removeFile = (category, url) => {
    onChange({ ...documentUrls, [category]: filesFor(category).filter((f) => f.url !== url) });
  };

  return (
    <>
      <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginTop: -8 }}>
        Nothing here is required — upload whatever you have and skip the rest.
      </p>

      {DOCUMENT_CATEGORIES.map((cat) => {
        const files = filesFor(cat.key);
        const isUploading = (uploading[cat.key] || 0) > 0;
        return (
          <div key={cat.key} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 16 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{cat.label}</p>

            {files.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                {files.map((f) => (
                  <div key={f.url} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 10px" }}>
                    {f.content_type?.startsWith("image/") ? (
                      <img src={f.url} alt={f.filename} style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4 }} />
                    ) : (
                      <FileText style={{ width: 16, height: 16, color: GOLD }} />
                    )}
                    <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</span>
                    <button type="button" onClick={() => removeFile(cat.key, f.url)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}>
                      <X style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px",
              borderRadius: 7, border: "1px dashed rgba(255,255,255,0.25)", cursor: isUploading ? "wait" : "pointer",
              fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.6)",
            }}>
              {isUploading ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <Upload style={{ width: 13, height: 13 }} />}
              {isUploading ? "Uploading..." : "Choose Files"}
              <input type="file" multiple hidden disabled={isUploading} onChange={(e) => handleFiles(cat.key, e.target.files)} />
            </label>

            {errors[cat.key] && <p style={{ color: "#e05252", fontSize: 11.5, marginTop: 8 }}>{errors[cat.key]}</p>}
          </div>
        );
      })}
    </>
  );
}
