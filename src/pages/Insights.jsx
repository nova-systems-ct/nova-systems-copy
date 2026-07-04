import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Clock } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#D4A030";

function readTime(content) {
  const words = (content || "").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default function Insights() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: "Nova Insights — AI and Business Growth Strategies for Connecticut",
    description: "Digital architecture, AI strategy, and growth intelligence for Connecticut businesses — from Nova Systems, Waterbury CT's AI and technology agency.",
  });

  useEffect(() => {
    fetch("/api/client?resource=blog&op=posts")
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-16">
        <section className="py-20 px-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="max-w-6xl mx-auto">
            <p style={{ color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>NOVA INSIGHTS</p>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight max-w-2xl mb-4">Nova Insights</h1>
            <p className="text-sm max-w-lg" style={{ color: "rgba(255,255,255,0.4)" }}>
              Digital architecture, AI strategy, and growth intelligence for Connecticut businesses.
            </p>
          </div>
        </section>

        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            {loading ? (
              <div className="grid md:grid-cols-3 gap-8">
                {[0, 1, 2].map((i) => <div key={i} className="rounded-2xl animate-pulse" style={{ height: 340, background: "rgba(255,255,255,0.03)" }} />)}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-24">
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>No insights published yet — check back soon.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map((post) => <PostCard key={post.id} post={post} />)}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function PostCard({ post }) {
  return (
    <Link to={`/insights/${post.slug}`} className="group block rounded-2xl overflow-hidden transition-all duration-300"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ height: 160, background: post.thumbnail_color || GOLD, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 100%)" }} />
        {post.category && (
          <span style={{ position: "absolute", top: 14, left: 14, fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", padding: "5px 12px", borderRadius: 20, background: "rgba(0,0,0,0.55)", color: "#fff", backdropFilter: "blur(4px)" }}>
            {post.category}
          </span>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-white font-bold text-lg leading-snug mb-3 group-hover:text-[#D4A030] transition-colors">{post.title}</h3>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>{post.excerpt}</p>
        <div className="flex items-center justify-between text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          <span>{post.created_at ? new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {readTime(post.content)} min read</span>
        </div>
      </div>
    </Link>
  );
}
