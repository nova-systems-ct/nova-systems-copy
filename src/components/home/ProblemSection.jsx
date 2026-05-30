import React from "react";
import { Phone, Clock, Eye } from "lucide-react";

const problems = [
  {
    icon: Phone,
    title: "Leads go dark",
    desc: "Missed calls and forms never get followed up.",
    color: "text-primary",
  },
  {
    icon: Clock,
    title: "Slow responses",
    desc: "Delays in response time kill your chances.",
    color: "text-destructive",
  },
  {
    icon: Eye,
    title: "No visibility",
    desc: "You can't fix what you can't see.",
    color: "text-primary",
  },
];

export default function ProblemSection() {
  return (
    <section className="py-20 px-6 bg-background">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-xs tracking-[0.25em] uppercase text-primary mb-4">THE PROBLEM</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          Revenue slips through the cracks
        </h2>
        <p className="text-muted-foreground mt-3 text-sm max-w-md mx-auto leading-relaxed">
          Leads go unanswered. Follow-ups fall through.<br />
          And your team doesn't even know it's happening.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {problems.map((p) => (
            <div
              key={p.title}
              className="bg-card border border-border rounded-xl p-6 text-left"
            >
              <p.icon className={`w-5 h-5 ${p.color} mb-3`} />
              <h3 className={`font-semibold text-sm ${p.color}`}>{p.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}