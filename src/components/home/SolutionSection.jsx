import React from "react";
import { Activity, Bell, BarChart3, RefreshCw } from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Real-time monitoring",
    desc: "Track leads, calls, and conversations as they happen.",
  },
  {
    icon: Bell,
    title: "Instant alerts",
    desc: "Get notified the moment an opportunity is at risk.",
  },
  {
    icon: BarChart3,
    title: "Performance insights",
    desc: "See what's working, what's not, and what to fix.",
  },
  {
    icon: RefreshCw,
    title: "Recover lost revenue",
    desc: "Turn missed opportunities into new customers.",
  },
];

export default function SolutionSection() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4">THE SOLUTION</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">NOVA Pulse</h2>
        <p className="text-muted-foreground mt-3 text-sm">
          See every leak. Fix every gap. Close every opportunity.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-14">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-xl border border-primary/30 flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-primary">{f.title}</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-[180px]">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}