import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, TrendingUp, DollarSign, FileText, Plus, ArrowRight } from "lucide-react";
import CRMSidebar from "@/components/crm/CRMSidebar";
import { getClients, getLeads, getActivity, STAGE_LABELS, STAGE_COLORS } from "@/lib/crmData";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function CRMHome() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [leads, setLeads] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    setClients(getClients());
    setLeads(getLeads());
    setActivity(getActivity());
  }, []);

  const activeLeads = leads.filter(l => !["closed_won","closed_lost"].includes(l.stage));
  const revenue = clients.reduce((s, c) => s + (Number(c.monthly_rate) || 0), 0);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const pipeline = Object.entries(STAGE_LABELS).map(([key, label]) => ({
    key, label,
    count: leads.filter(l => l.stage === key).length,
    ...STAGE_COLORS[key],
  }));

  const QUICK_ACTIONS = [
    { label: "Add Client",   action: () => navigate("/dashboard/clients"),   icon: Users },
    { label: "Add Lead",     action: () => navigate("/dashboard/leads"),     icon: TrendingUp },
    { label: "Generate Doc", action: () => navigate("/dashboard/documents"), icon: FileText },
    { label: "Newsletter",   action: () => navigate("/dashboard/newsletter"),icon: Plus },
  ];

  return (
    <CRMSidebar>
      <div className="p-6 md:p-10">
        {/* Header */}
        <div className="mb-10">
          <p className="text-[9px] tracking-[0.35em] uppercase mb-2" style={{ color: GOLD }}>{today}</p>
          <h1 className="text-3xl font-black text-white">{greeting()}, Isaac.</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Here's what's happening with Nova Systems.</p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Clients",       value: clients.length,        icon: Users,       sub: "active accounts" },
            { label: "Active Leads",        value: activeLeads.length,    icon: TrendingUp,  sub: "in pipeline" },
            { label: "Revenue / Month",     value: `$${revenue.toLocaleString()}`, icon: DollarSign, sub: "recurring" },
            { label: "Open Invoices",       value: 0,                     icon: FileText,    sub: "pending payment" },
          ].map(({ label, value, icon: Icon, sub }) => (
            <div key={label} className="rounded-xl p-5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[9px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}22` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: GOLD }} />
                </div>
              </div>
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Pipeline */}
          <div className="md:col-span-2 rounded-xl p-6"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-5">
              <p className="text-[9px] tracking-[0.22em] uppercase font-bold" style={{ color: GOLD }}>LEAD PIPELINE</p>
              <button onClick={() => navigate("/dashboard/leads")}
                className="flex items-center gap-1 text-[10px]"
                style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {pipeline.map(({ key, label, count, bg, border, color }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap w-28 text-center"
                    style={{ background: bg, border: `1px solid ${border}`, color }}>
                    {label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${leads.length ? (count / leads.length) * 100 : 0}%`, background: color }} />
                  </div>
                  <span className="text-xs font-bold text-white w-4 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl p-6"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-5" style={{ color: GOLD }}>QUICK ACTIONS</p>
            <div className="space-y-2">
              {QUICK_ACTIONS.map(({ label, action, icon: Icon }) => (
                <button key={label} onClick={action}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold transition-all hover:opacity-80 text-left"
                  style={{ border: `1px solid ${GOLD}30`, color: GOLD, background: `${GOLD}08`, cursor: "pointer" }}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6 rounded-xl p-6"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[9px] tracking-[0.22em] uppercase font-bold mb-4" style={{ color: GOLD }}>RECENT ACTIVITY</p>
          {activity.length === 0 ? (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>No activity yet. Start adding clients and leads.</p>
          ) : (
            <div className="space-y-2">
              {activity.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: GOLD }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{a.message}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                      {new Date(a.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CRMSidebar>
  );
}