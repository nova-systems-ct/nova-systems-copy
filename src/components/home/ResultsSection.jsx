import React from "react";

const GOLD = "#D4A030";

const stats = [
  { value: "35%", label: "Increase in booked calls within the first 30 days" },
  { value: "28%", label: "more conversations recovered" },
  { value: "$240K+", label: "in revenue recovered in 90 days" },
];

export default function ResultsSection() {
  return (
    <section className="py-24 px-6 bg-black border-y" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
      <div className="max-w-5xl mx-auto">
        <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: GOLD }}>
          REAL RESULTS
        </p>
        <h2 className="text-2xl md:text-4xl font-bold text-white">
          More visibility. More conversations. More revenue.
        </h2>

        <div className="grid md:grid-cols-2 gap-8 mt-12">
          {/* Stats */}
          <div className="flex gap-4">
            {stats.map((s) => (
              <div
                key={s.value}
                className="flex-1 rounded-xl p-5 text-center"
                style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
              >
                <p className="text-2xl md:text-3xl font-bold" style={{ color: GOLD }}>{s.value}</p>
                <p className="text-xs text-white/40 mt-2 leading-relaxed">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div
            className="rounded-xl p-6"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-4xl font-serif leading-none" style={{ color: GOLD }}>"</p>
            <p className="text-sm text-white/50 italic leading-relaxed mt-2">
              NOVA Pulse gave us the visibility we never had. We found leaks we didn't even know existed.
            </p>
            <p className="text-sm text-white mt-4 font-medium">– Jason M.</p>
            <p className="text-xs text-white/35">CEO, Summit Financial</p>
          </div>
        </div>
      </div>
    </section>
  );
}