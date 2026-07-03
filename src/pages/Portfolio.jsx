import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { X, Loader2, MapPin } from "lucide-react";
import ConnecticutMap from "@/components/ConnecticutMap";

const GOLD = "#D4A030";
const TABS = ["All", "Websites", "Social Media", "Branding", "AI Systems", "Signage and Print", "Apparel and Uniforms"];
const CAT_COLORS = { Websites: '#60a5fa', Branding: '#a78bfa', 'Social Media': '#4ade80', 'AI Systems': '#22d3ee', 'Signage and Print': '#f97316', 'Apparel and Uniforms': '#f472b6', Other: GOLD };

export default function Portfolio() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetch("/api/portfolio-items")
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tab === "All" ? items : items.filter((i) => i.category === tab);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">
        <section className="py-20 px-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-6xl mx-auto">
            <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>OUR WORK</p>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight max-w-2xl">Real Results for Real Connecticut Businesses.</h1>
          </div>
        </section>

        <section className="py-14 px-6">
          <div className="max-w-6xl mx-auto">
            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2 mb-12">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  style={{
                    padding: "9px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    borderRadius: 20, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    background: tab === t ? GOLD : "rgba(255,255,255,0.05)",
                    color: tab === t ? "#0a0800" : "rgba(255,255,255,0.5)",
                    border: `1px solid ${tab === t ? GOLD : "rgba(255,255,255,0.1)"}`,
                  }}>
                  {t}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-24"><Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: GOLD }} /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24">
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>No work in this category yet — check back soon.</p>
              </div>
            ) : (
              <div style={{ columns: "3 280px", columnGap: 16 }}>
                {filtered.map((item) => (
                  <MasonryCard key={item.id} item={item} onClick={() => setLightbox(item)} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Connecticut Focus */}
        <section className="py-24 px-6 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", background: "linear-gradient(180deg, transparent 0%, rgba(212,160,48,0.03) 100%)" }}>
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-14 items-center">
            <div>
              <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 14 }}>
                <MapPin className="w-3 h-3 inline mr-2" />CONNECTICUT FOCUS
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-5">
                Built for CT, One Business at a Time.
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                Nova Systems serves businesses across Connecticut — from Waterbury to Greenwich, Hartford to New Haven. Every project on this page was built for a real local business, not a template.
              </p>
            </div>
            <ConnecticutMap />
          </div>
        </section>
      </main>
      <Footer />

      {/* Lightbox */}
      {lightbox && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.94)", backdropFilter: "blur(8px)" }}
          onClick={(e) => e.target === e.currentTarget && setLightbox(null)}>
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, cursor: "pointer", color: "#fff", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X className="w-4 h-4" />
          </button>
          <div style={{ maxWidth: 800, width: "100%" }}>
            <img src={lightbox.image_url} alt={lightbox.title} style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: 10, display: "block" }} />
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <p style={{ color: "#fff", fontSize: 17, fontWeight: 800, flex: 1 }}>{lightbox.title}</p>
                {lightbox.category && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${CAT_COLORS[lightbox.category] || GOLD}18`, color: CAT_COLORS[lightbox.category] || GOLD, border: `1px solid ${CAT_COLORS[lightbox.category] || GOLD}30`, textTransform: "uppercase", letterSpacing: "0.1em" }}>{lightbox.category}</span>
                )}
              </div>
              {lightbox.client_name && <p style={{ color: GOLD, fontSize: 12, marginBottom: 8 }}>{lightbox.client_name}</p>}
              {lightbox.description && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.7 }}>{lightbox.description}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MasonryCard({ item, onClick }) {
  const [hov, setHov] = useState(false);
  const catColor = CAT_COLORS[item.category] || GOLD;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ breakInside: "avoid", marginBottom: 16, borderRadius: 14, overflow: "hidden", position: "relative", cursor: "zoom-in", border: `1px solid ${hov ? GOLD + "40" : "rgba(255,255,255,0.07)"}`, transition: "border-color 0.2s" }}>
      <img src={item.image_url} alt={item.title} style={{ width: "100%", display: "block", transform: hov ? "scale(1.03)" : "scale(1)", transition: "transform 0.3s" }} />
      <div style={{ position: "absolute", inset: 0, background: hov ? "rgba(0,0,0,0.65)" : "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.7) 100%)", transition: "background 0.2s", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 16 }}>
        {hov && item.description && (
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>{item.description}</p>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{item.title}</p>
          <span style={{ fontSize: 8, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: `${catColor}25`, color: catColor, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.category}</span>
        </div>
      </div>
    </div>
  );
}
