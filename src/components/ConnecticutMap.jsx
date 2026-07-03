import React from "react";

const GOLD = "#D4A030";

const ALL_CITIES = [
  { name: "Hartford",    x: 168, y: 92 },
  { name: "Avon",        x: 140, y: 88 },
  { name: "Simsbury",    x: 146, y: 68 },
  { name: "Waterbury",   x: 120, y: 138 },
  { name: "New Haven",   x: 132, y: 190 },
  { name: "Bridgeport",  x: 96,  y: 202 },
  { name: "Fairfield",   x: 80,  y: 206 },
  { name: "Westport",    x: 64,  y: 210 },
  { name: "Stamford",    x: 42,  y: 218 },
  { name: "Greenwich",   x: 24,  y: 224 },
];

// Simplified, stylized outline — decorative, not to scale.
const CT_PATH = "M20,150 C15,110 40,60 90,40 C140,20 200,15 240,35 C265,48 270,75 258,100 C270,110 275,130 260,150 C250,165 235,175 230,195 C225,215 200,235 170,232 C160,231 150,225 140,232 C120,246 90,244 70,228 C50,214 30,205 22,185 C15,172 22,160 20,150 Z";

export default function ConnecticutMap({ cities, height = 280 }) {
  const shown = cities ? ALL_CITIES.filter((c) => cities.includes(c.name)) : ALL_CITIES;
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <svg viewBox="0 0 300 260" width="100%" height={height} style={{ maxWidth: 420 }}>
        <path d={CT_PATH} fill="rgba(212,160,48,0.06)" stroke={GOLD} strokeWidth="1.5" strokeOpacity="0.5" />
        {shown.map((c) => (
          <g key={c.name}>
            <circle cx={c.x} cy={c.y} r="8" fill={GOLD} fillOpacity="0.15">
              <animate attributeName="r" values="6;10;6" dur="2.4s" repeatCount="indefinite" begin={`${Math.random()}s`} />
              <animate attributeName="fill-opacity" values="0.2;0.02;0.2" dur="2.4s" repeatCount="indefinite" begin={`${Math.random()}s`} />
            </circle>
            <circle cx={c.x} cy={c.y} r="3.5" fill={GOLD} stroke="#000" strokeWidth="1" />
            <text x={c.x} y={c.y - 12} textAnchor="middle" fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.55)" fontFamily="inherit">
              {c.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
