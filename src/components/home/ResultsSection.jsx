import React from "react";

const stats = [
  { value: "35%", label: "Increase in booked calls within the first 30 days" },
  { value: "28%", label: "more conversations recovered" },
  { value: "$240K+", label: "in revenue recovered in 90 days" },
];

export default function ResultsSection() {
  return (
    <section className="py-20 px-6 bg-card border-y border-border/50">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4">REAL RESULTS</p>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          More visibility. More conversations. More revenue.
        </h2>

        <div className="grid md:grid-cols-2 gap-8 mt-10">
          {/* Stats */}
          <div className="flex gap-4">
            {stats.map((s) => (
              <div
                key={s.value}
                className="flex-1 border border-border rounded-xl p-4 text-center"
              >
                <p className="text-2xl md:text-3xl font-bold text-primary">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-3xl text-primary font-serif leading-none">"</p>
            <p className="text-sm text-muted-foreground italic leading-relaxed mt-2">
              NOVA Pulse gave us the visibility we never had. We found leaks we didn't even know existed.
            </p>
            <p className="text-sm text-foreground mt-4 font-medium">– Jason M.</p>
            <p className="text-xs text-muted-foreground">CEO, Summit Financial</p>
          </div>
        </div>
      </div>
    </section>
  );
}