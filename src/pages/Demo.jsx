import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle, Circle, Search, Workflow, ArrowRight, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { BLACK, WHITE, GOLD, GOLD_GRADIENT } from "@/lib/theme";

const API = (op, { method = "POST", body, token } = {}) =>
  fetch(`/api/client?resource=demo&op=${op}${method === "GET" && token ? `&token=${encodeURIComponent(token)}` : ""}`, {
    method, headers: { "Content-Type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body || {}),
  }).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || "Something went wrong."), { fields: j.fields, status: r.status, reason: j.reason }); return j; });

const STEP_KEYS = ["inquiry", "qualify", "price", "availability", "hold", "agreement", "monitor"];
const CONCERNS = ["Missed calls or slow replies", "Website inquiries that go nowhere", "Booking and scheduling", "Follow-up with past customers or old quotes", "Payments, deposits or checkout", "Something else"];
const muted = "rgba(250,250,250,0.6)";
const card = { background: "rgba(250,250,250,0.03)", border: "1px solid rgba(250,250,250,0.09)", borderRadius: 16, padding: 24 };
const input = { width: "100%", padding: "12px 14px", background: "rgba(250,250,250,0.04)", border: "1px solid rgba(250,250,250,0.14)", borderRadius: 8, color: WHITE, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const label = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: muted, marginBottom: 6 };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

function StateIcon({ s }) {
  if (s === "completed" || s === "ok") return <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: GOLD }} aria-label="completed" />;
  if (s === "processing") return <Loader2 className="w-5 h-5 shrink-0 animate-spin" style={{ color: GOLD }} aria-label="processing" />;
  if (s === "failed" || s === "issue") return <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "#E8B04B" }} aria-label={s} />;
  if (s === "awaiting_action" || s === "unknown") return <Clock className="w-5 h-5 shrink-0" style={{ color: muted }} aria-label={s} />;
  return <Circle className="w-5 h-5 shrink-0" style={{ color: "rgba(250,250,250,0.25)" }} aria-label="waiting" />;
}
const STATE_WORD = { pending: "Waiting", processing: "Working…", completed: "Done", failed: "Failed", awaiting_action: "Needs a person" };

export default function Demo() {
  useSEO({ title: "Five-Minute Demo — Nova Systems", description: "See one evidenced check of your public website and watch Nova Core's workers handle a made-up inquiry in a demo workspace — in about five minutes." });
  const [params, setParams] = useSearchParams();
  const token = params.get("session");
  const [form, setForm] = useState({ name: "", business_name: "", website: "", email: "", concern: CONCERNS[0], concern_detail: "", marketing_consent: false, company_url_confirm: "" });
  const submissionId = useMemo(newId, []);
  const [errors, setErrors] = useState({}); const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  const [session, setSession] = useState(null); const [running, setRunning] = useState(null); const [workersAvailable, setWorkersAvailable] = useState(null);
  const [now, setNow] = useState(Date.now()); const started = useRef(false);

  useEffect(() => { API("status", { method: "GET" }).then((j) => setWorkersAvailable(!!j.workers_available)).catch(() => setWorkersAvailable(false)); }, []);
  useEffect(() => { if (!token) return; API("session", { method: "GET", token }).then(setSession).catch((e) => setError(e.message)); }, [token]);
  useEffect(() => { if (!session || session.completed_at) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [session]);

  // Drive the demo: scan, then each worker step in order, then finish. Each call is a real backend action.
  useEffect(() => {
    if (!token || !session || started.current || session.completed_at) return;
    started.current = true;
    (async () => {
      let s = session;
      try {
        if (!s.scan) { setRunning("scan"); s = await API("scan", { body: { token } }); setSession(s); }
        if (workersAvailable !== false) {
          for (const k of STEP_KEYS) {
            const cur = s.steps.find((x) => x.key === k);
            if (cur && cur.status === "completed") continue;
            setRunning(k);
            try { s = await API("step", { body: { token, step: k } }); setSession(s); }
            catch (e) { if (e.reason) { setWorkersAvailable(false); break; } throw e; }
            if (s.steps.find((x) => x.key === k)?.status !== "completed") break;
          }
        }
        setRunning("finish"); s = await API("finish", { body: { token } }); setSession(s);
      } catch (e) { setError(e.message); }
      finally { setRunning(null); }
    })();
  }, [token, session, workersAvailable]);

  const submit = async (e) => {
    e.preventDefault(); if (busy) return; setBusy(true); setErrors({}); setError(null);
    try {
      const j = await API("start", { body: { ...form, concern: form.concern_detail.trim() ? `${form.concern}: ${form.concern_detail.trim()}` : form.concern, submission_id: submissionId } });
      started.current = false; setSession(j.session); setParams({ session: j.token }, { replace: true });
    } catch (err) { setErrors(err.fields || {}); setError(err.status === 409 ? "This form was already sent — your demo is running." : err.message); }
    finally { setBusy(false); }
  };

  const elapsed = session ? Math.round(((session.completed_at ? new Date(session.completed_at).getTime() : now) - new Date(session.submitted_at).getTime()) / 1000) : 0;
  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }), style: { ...input, borderColor: errors[k] ? "#E8B04B" : input.border.split(" ").pop() } });

  return (
    <div className="min-h-screen" style={{ background: BLACK, color: WHITE }}>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <p className="text-xs font-bold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>Five-minute demo</p>
        <h1 className="font-black leading-tight mb-4" style={{ fontSize: "clamp(1.9rem, 5vw, 3rem)" }}>See where an inquiry can slip — then watch the workers handle one.</h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: muted }}>
          First, Nova checks a few public pages of your website and shows you one thing it can actually verify — or tells you honestly that nothing was found. Then you watch Nova Core's workers take a made-up inquiry from arrival to a prepared agreement, in a demo workspace. This is not the full Nova Audit, which takes 48–72 hours once scope, access and inputs are confirmed.
        </p>

        {!token && (
          <form onSubmit={submit} noValidate style={card} aria-label="Start the demo">
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label style={label} htmlFor="d-name">Your name</label><input id="d-name" autoComplete="name" {...f("name")} />{errors.name && <p role="alert" className="text-xs mt-1" style={{ color: "#E8B04B" }}>{errors.name}</p>}</div>
              <div><label style={label} htmlFor="d-biz">Business name</label><input id="d-biz" autoComplete="organization" {...f("business_name")} />{errors.business_name && <p role="alert" className="text-xs mt-1" style={{ color: "#E8B04B" }}>{errors.business_name}</p>}</div>
              <div><label style={label} htmlFor="d-web">Business website (optional)</label><input id="d-web" inputMode="url" placeholder="yourbusiness.com" {...f("website")} />{errors.website && <p role="alert" className="text-xs mt-1" style={{ color: "#E8B04B" }}>{errors.website}</p>}</div>
              <div><label style={label} htmlFor="d-email">Email</label><input id="d-email" type="email" autoComplete="email" {...f("email")} />{errors.email && <p role="alert" className="text-xs mt-1" style={{ color: "#E8B04B" }}>{errors.email}</p>}</div>
              <div className="sm:col-span-2"><label style={label} htmlFor="d-concern">Main concern</label>
                <select id="d-concern" {...f("concern")}>{CONCERNS.map((c) => <option key={c} style={{ background: BLACK }}>{c}</option>)}</select>
                <input aria-label="Add a detail (optional)" placeholder="Add a detail (optional)" className="mt-2" {...f("concern_detail")} />
                {errors.concern && <p role="alert" className="text-xs mt-1" style={{ color: "#E8B04B" }}>{errors.concern}</p>}
              </div>
            </div>
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.company_url_confirm} onChange={(e) => setForm({ ...form, company_url_confirm: e.target.value })} style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
            <label className="flex items-start gap-3 mt-6 text-sm cursor-pointer" style={{ color: muted }}>
              <input type="checkbox" checked={form.marketing_consent} onChange={(e) => setForm({ ...form, marketing_consent: e.target.checked })} className="mt-1" />
              <span>Optional: Nova Systems may email me about Nova products and services. I can unsubscribe at any time. (The demo works either way.)</span>
            </label>
            <div className="mt-6 text-xs leading-relaxed" style={{ color: "rgba(250,250,250,0.5)" }}>
              <p><strong style={{ color: WHITE }}>What you get:</strong> one evidenced observation from your public website (or an honest "nothing verified"), a live run of the workers, and a saved summary you can reopen from this page's link.</p>
              <p className="mt-2"><strong style={{ color: WHITE }}>How your information is used:</strong> Nova saves it as a request in its own records so the team can follow up about this demo. Nova reads only the public pages of the website you give. Nothing is sent to your customers or staff, no call or booking is made at your business, and no payment is taken. See the <Link to="/privacy" style={{ color: GOLD }}>privacy policy</Link>.</p>
            </div>
            {error && <p role="alert" className="mt-4 text-sm" style={{ color: "#E8B04B" }}>{error}</p>}
            <button type="submit" disabled={busy} className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-xs font-bold tracking-[0.15em] uppercase rounded-lg" style={{ background: GOLD_GRADIENT, color: BLACK, opacity: busy ? 0.6 : 1 }}>
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</> : <>Start the demo <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {token && !session && !error && <p className="flex items-center gap-2" style={{ color: muted }}><Loader2 className="w-4 h-4 animate-spin" /> Loading your demo…</p>}
        {token && error && !session && <div style={card}><p role="alert">{error}</p><Link to="/demo" onClick={() => setParams({})} style={{ color: GOLD }}>Start a new demo</Link></div>}

        {session && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: muted }}>
              <span>Demo for <strong style={{ color: WHITE }}>{session.business_name}</strong></span>
              <span aria-live="polite"><Clock className="inline w-4 h-4 mr-1" />{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}{session.completed_at ? " — finished" : ""}</span>
            </div>

            <section style={card} aria-labelledby="part1">
              <h2 id="part1" className="flex items-center gap-2 text-lg font-black mb-1"><Search className="w-5 h-5" style={{ color: GOLD }} /> Part 1 — a quick look at your public website</h2>
              {!session.scan ? <p className="flex items-center gap-2 mt-3" style={{ color: muted }}><Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} /> Checking {session.website || "…"}</p> : <ScanResult scan={session.scan} />}
            </section>

            <section style={card} aria-labelledby="part2">
              <h2 id="part2" className="flex items-center gap-2 text-lg font-black mb-1"><Workflow className="w-5 h-5" style={{ color: GOLD }} /> Part 2 — Nova Core's workers, live</h2>
              <p className="text-sm mb-4" style={{ color: muted }}>A made-up customer sends an inquiry to a made-up business in Nova's DEMO workspace. Each line below is a real action Nova's system performs and records as it happens — made-up prices, a demo calendar, no real appointment, no money.</p>
              {workersAvailable === false && !session.steps.some((s) => s.status !== "pending") ? <p className="text-sm" style={{ color: "#E8B04B" }}>The worker demo is not available right now, so it is not shown. Nothing has been simulated in its place.</p> : (
                <ol className="space-y-3">
                  {session.steps.map((s) => { const st = running === s.key ? "processing" : s.status; return (
                    <li key={s.key} className="flex gap-3">
                      <StateIcon s={st} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{s.label} <span className="font-normal" style={{ color: muted }}>· {STATE_WORD[st] || st}</span></p>
                        {s.detail && <p className="text-sm leading-relaxed" style={{ color: muted }}>{s.detail}</p>}
                        {s.customer_link && <a href={s.customer_link} target="_blank" rel="noreferrer" className="text-sm" style={{ color: GOLD }}>Open the made-up customer's signing page (test mode)</a>}
                      </div>
                    </li>); })}
                </ol>
              )}
            </section>

            {session.completed_at && session.summary && (
              <section style={{ ...card, borderColor: `${GOLD}66` }} aria-labelledby="summary">
                <h2 id="summary" className="text-lg font-black mb-2">Your demo summary (saved)</h2>
                <p className="text-sm" style={{ color: muted }}>{session.summary.finding ? <>Verified on your site: <span style={{ color: WHITE }}>{session.summary.finding.observation}</span></> : session.summary.limitation}</p>
                <p className="text-sm mt-2" style={{ color: muted }}>Workers: {session.summary.workers_completed} of {session.summary.workers_total} steps completed. {session.summary.demo_note}</p>
                <p className="text-sm mt-4">{session.summary.next_step}</p>
                <div className="flex flex-col sm:flex-row gap-3 mt-5">
                  <Link to={session.audit_request_url || "/intake"} className="inline-flex items-center justify-center gap-2 px-7 py-4 text-xs font-bold tracking-[0.15em] uppercase rounded-lg" style={{ background: GOLD_GRADIENT, color: BLACK }}>Request the full Nova Audit <ArrowRight className="w-4 h-4" /></Link>
                </div>
                <p className="text-xs mt-3" style={{ color: "rgba(250,250,250,0.45)" }}>Keep this page's link to reopen the summary for 30 days.</p>
              </section>
            )}
            {error && <p role="alert" className="text-sm" style={{ color: "#E8B04B" }}>{error}</p>}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ScanResult({ scan }) {
  const finding = scan.finding;
  return (
    <div className="mt-3">
      {finding ? (
        <div className="rounded-xl p-4 mb-4" style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}55` }}>
          <p className="text-xs font-bold uppercase tracking-[0.12em] mb-1" style={{ color: GOLD }}>Verified observation</p>
          <p className="font-bold">{finding.observation}</p>
          <p className="text-sm mt-2" style={{ color: muted }}><strong style={{ color: WHITE }}>Why it may matter:</strong> {finding.why}</p>
          <p className="text-sm mt-1" style={{ color: muted }}><strong style={{ color: WHITE }}>Needs confirming:</strong> {finding.confirm}</p>
          <p className="text-sm mt-1" style={{ color: muted }}><strong style={{ color: WHITE }}>Next action:</strong> {finding.next}</p>
          <p className="text-xs mt-2 break-all" style={{ color: "rgba(250,250,250,0.45)" }}>Source: {finding.url} · checked {new Date(finding.checked_at).toLocaleString()}</p>
        </div>
      ) : null}
      {scan.limitation && <p className="text-sm mb-3" style={{ color: muted }}>{scan.limitation}</p>}
      {scan.checks?.length > 0 && (
        <details>
          <summary className="text-sm cursor-pointer" style={{ color: GOLD }}>What was checked ({scan.checks.length})</summary>
          <ul className="mt-2 space-y-2">
            {scan.checks.map((c, i) => <li key={i} className="flex gap-2 text-sm"><StateIcon s={c.result} /><span><strong>{c.label}</strong> — <span style={{ color: muted }}>{c.observation}</span><br /><span className="text-xs break-all" style={{ color: "rgba(250,250,250,0.4)" }}>{c.url}</span></span></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
