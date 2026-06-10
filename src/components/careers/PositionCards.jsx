import React, { useState } from "react";
import { Camera, Share2, Users } from "lucide-react";

const GOLD = "#D4A030";

const positions = [
  {
    icon: Camera,
    title: "Videographer / Content Creator",
    tag: "CONTENT",
    description:
      "Film client locations, capture before/after content, and shoot social media assets for local businesses across Connecticut.",
    requirements: [
      "Must own camera or phone capable of 1080p",
      "Basic clip editing ability required",
      "Drone experience is a huge plus",
      "Transportation to client locations",
    ],
    highlight: "Drone operators are highly valued",
  },
  {
    icon: Share2,
    title: "Social Media Manager",
    tag: "MARKETING",
    description:
      "Create and schedule posts across Instagram, TikTok, and Facebook for Nova Systems clients. Own the short-form content pipeline end-to-end.",
    requirements: [
      "Must film and edit short-form video",
      "Deep understanding of IG & TikTok algorithms",
      "Must own filming equipment",
      "Strong creative instincts",
    ],
    highlight: null,
  },
  {
    icon: Users,
    title: "Brand Ambassador / Sales",
    tag: "SALES",
    description:
      "Represent Nova Systems in the field. Generate leads, attend client meetings, and create content that showcases our work and mission.",
    requirements: [
      "Outgoing, professional demeanor",
      "Must create video content for outreach",
      "Must own filming equipment",
      "Commission-based with strong upside",
    ],
    highlight: null,
  },
];

export default function PositionCards() {
  const [hovered, setHovered] = useState(null);

  return (
    <section className="py-16 md:py-24 px-6 bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {positions.map((pos, idx) => {
            const Icon = pos.icon;
            const isHovered = hovered === idx;
            return (
              <div
                key={idx}
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered(null)}
                className="rounded-xl p-8 flex flex-col gap-6 transition-all duration-300 cursor-default"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: isHovered ? `1px solid ${GOLD}70` : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: isHovered ? `0 0 32px ${GOLD}18` : "none",
                }}
              >
                {/* Icon + Tag */}
                <div className="flex items-start justify-between">
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}40` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: GOLD }} />
                  </div>
                  <span
                    className="text-[9px] font-bold tracking-[0.22em] px-3 py-1 rounded-full"
                    style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}
                  >
                    {pos.tag}
                  </span>
                </div>

                {/* Title + Description */}
                <div>
                  <h3 className="text-white font-bold text-lg leading-tight mb-3">{pos.title}</h3>
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.7 }}>
                    {pos.description}
                  </p>
                </div>

                {/* Requirements */}
                <ul className="space-y-2 flex-1">
                  {pos.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: GOLD }}
                      />
                      <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{req}</span>
                    </li>
                  ))}
                </ul>

                {/* Highlight badge */}
                {pos.highlight && (
                  <div
                    className="rounded-lg px-4 py-2.5 text-center"
                    style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}35` }}
                  >
                    <p className="text-[11px] font-semibold tracking-wide" style={{ color: GOLD }}>
                      ★ {pos.highlight}
                    </p>
                  </div>
                )}

                {/* Apply anchor */}
                <a
                  href="#apply"
                  className="block text-center py-3 text-[11px] font-bold tracking-[0.18em] uppercase transition-all duration-200"
                  style={{
                    border: `1px solid ${isHovered ? GOLD : "rgba(255,255,255,0.1)"}`,
                    color: isHovered ? GOLD : "rgba(255,255,255,0.35)",
                  }}
                >
                  APPLY FOR THIS ROLE
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}