import React from "react";
import { X } from "lucide-react";

export default function CRMModal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl max-h-[90vh] overflow-y-auto`}
        style={{ background: "#0d0c09", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between p-6 pb-0 sticky top-0"
          style={{ background: "#0d0c09", borderBottom: "none" }}>
          <h3 className="font-bold text-white text-base">{title}</h3>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}