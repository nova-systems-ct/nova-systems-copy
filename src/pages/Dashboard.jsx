import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from "recharts";
import {
  LayoutDashboard, Users, TrendingUp, CheckSquare, Zap, BarChart3,
  Bell, MessageSquare, Plug, Settings, ChevronDown, Search, ArrowUpRight,
  Phone, Clock, AlertTriangle, Star, ExternalLink,
} from "lucide-react";

const GOLD = "#D4A030";
const GOLD_BRIGHT = "#C8921A";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, ${GOLD_BRIGHT} 55%, ${GOLD} 80%, #8a6200 100%)`;

// â”€â”€ Fake data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const leadFlowData = [
  { day: "May 8", incoming: 42, contacted: 31, converted: 9 },
  { day: "May 9", incoming: 58, contacted: 44, converted: 14 },
  { day: "May 10", incoming: 51, contacted: 38, converted: 11 },
  { day: "May 11", incoming: 67, contacted: 52, converted: 18 },
  { day: "May 12", incoming: 73, contacted: 59, converted: 22 },
  { day: "May 13", incoming: 48, contacted: 37, converted: 13 },
  { day: "May 14", incoming: 85, contacted: 68, converted: 26 },
  { day: "May 15", incoming: 91, contacted: 74, converted: 29 },
];

const channelData = [
  { name: "Phone", value: 45, color: GOLD },
  { name: "Email", value: 32, color: "#C8921A" },
  { name: "Web Form", value: 15, color: "#B8860B" },
  { name: "Other", value: 8, color: "#6B5000" },
];

const recentAlerts = [
  { type: "missed_call", icon: Phone, msg: "3 missed calls â€” +1 (860) 234-5511", time: "2 min ago", sev: "high" },
  { type: "followup", icon: Clock, msg: "Email opened, no follow-up in 24hrs", time: "18 min ago", sev: "med" },
  { type: "missed_call", icon: Phone, msg: "2 missed calls after hours", time: "1 hr ago", sev: "high" },
  { type: "delay", icon: AlertTriangle, msg: "High-value lead not contacted â€” $3,200", time: "2 hrs ago", sev: "high" },
  { type: "followup", icon: Clock, msg: "Workflow automation failed for lead #4821", time: "3 hrs ago", sev: "med" },
];

const recentActivity = [
  { icon: Star, msg: "New lead from web form: Sarah M.", time: "5 min ago" },
  { icon: Phone, msg: "AI attendant booked appt â€” Tom R. Â· 3:00 PM", time: "12 min ago" },
  { icon: TrendingUp, msg: "Lead converted: Eastside HVAC â€” $4,200", time: "41 min ago" },
  { icon: MessageSquare, msg: "SMS follow-up sent to 14 leads", time: "1 hr ago" },
  { icon: CheckSquare, msg: "Task completed: Follow up with Pinnacle", time: "2 hrs ago" },
];

const tasks = [
  { label: "Follow up with 3 missed calls", priority: "high" },
  { label: "Review lead report â€” May 15", priority: "med" },
  { label: "Call back Sarah M. (web form)", priority: "high" },
  { label: "Check automation workflow #7", priority: "med" },
  { label: "Update CRM â€” Johnson account", priority: "low" },
];

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Users, label: "Leads" },
  { icon: TrendingUp, label: "Conversions" },
  { icon: CheckSquare, label: "Tasks & Follow-ups" },
  { icon: Zap, label: "Automations" },
  { icon: BarChart3, label: "Reports" },
  { icon: Bell, label: "Alerts" },
  { icon: MessageSquare, label: "Communications" },
  { icon: Plug, label: "Integrations" },
  { icon: Settings, label: "Settings" },
];

const kpis = [
  { label: "Total Leads", value: "2,453", delta: "+12.4%", sub: "vs last month", up: true },
  { label: "Converted Leads", value: "623", delta: "+8.2%", sub: "vs last month", up: true },
  { label: "Conversion Rate", value: "25.4%", delta: "+2.1%", sub: "vs last month", up: true },
  { label: "Revenue Recovered", value: "$142,830", delta: "+18.7%", sub: "vs last month", up: true },
];

const CHART_TOOLTIP_STYLE = {
  contentStyle: { background: "#0f0d06", border: `1px solid ${GOLD}30`, borderRadius: 8, fontSize: 11, color: "#fff" },
  itemStyle: { color: "rgba(255,255,255,0.7)" },
  labelStyle: { color: GOLD, fontWeight: 700 },
};

// â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Sidebar({ mobile, onClose }) {
  return (
    <aside
      className={mobile ? "fixed inset-0 z-50 flex" : "hidden lg:flex flex-col w-52 flex-shrink-0"}
      style={mobile ? undefined : { background: "#050400", borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {mobile && <div className="absolute inset-0 bg-black/70" onClick={onClose} />}
      <div
        className={mobile ? "relative z-10 w-52 flex flex-col h-full" : "flex flex-col h-full"}
        style={{ background: "#050400", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] uppercase leading-none" style={{ color: GOLD }}>NOVA</p>
            <p className="text-[8px] tracking-[0.1em] uppercase leading-none" style={{ color: "rgba(255,255,255,0.3)" }}>SYSTEMS</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto space-y-0.5">
          {navItems.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-xs font-medium"
              style={active
                ? { background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}25` }
                : { color: "rgba(255,255,255,0.35)", border: "1px solid transparent" }
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </div>
          ))}
        </nav>

        {/* Upgrade CTA */}
        <div className="p-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="rounded-xl p-4" style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}25` }}>
            <p className="text-[9px] font-black tracking-[0.15em] uppercase mb-1" style={{ color: GOLD }}>Upgrade Plan</p>
            <p className="text-[9px] mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
              Unlock AI call handling &amp; unlimited leads.
            </p>
            <Link to="/pricing">
              <button
                className="w-full py-2 text-[9px] font-bold tracking-wider uppercase rounded-lg transition-all hover:opacity-85"
                style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
              >
                UPGRADE NOW
              </button>
            </Link>
          </div>
          <div className="flex items-center gap-2 mt-3 px-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>
              NS
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-white truncate">Nova Systems Demo</p>
              <p className="text-[9px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>demo@novasystems.ai</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// â”€â”€ Main dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Dashboard() {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#080600", color: "white" }}>
      <Sidebar />
      {mobileNav && <Sidebar mobile onClose={() => setMobileNav(false)} />}

      {/* â”€â”€ Main content â”€â”€ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 py-3 flex-shrink-0 gap-4"
          style={{ background: "#080600", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden text-white/50" onClick={() => setMobileNav(true)}>
              <LayoutDashboard className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[9px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>Welcome back</p>
              <p className="text-sm font-bold text-white truncate">Nova Systems Demo</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Searchâ€¦</span>
            </div>
            <div
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] font-medium"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
            >
              May 8 â€“ May 15, 2025 <ChevronDown className="w-3 h-3 ml-1" />
            </div>
            <div className="relative">
              <Bell className="w-5 h-5" style={{ color: "rgba(255,255,255,0.4)" }} />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black" style={{ background: GOLD, color: "#0a0800" }}>3</div>
            </div>
            <button
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg transition-all hover:opacity-85"
              style={{ background: GOLD_GRADIENT, color: "#0a0800" }}
            >
              <ExternalLink className="w-3 h-3" /> Export
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* KPI Row */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl p-5"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-[9px] tracking-[0.2em] uppercase mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>{kpi.label}</p>
                <p className="text-2xl font-black text-white mb-1">{kpi.value}</p>
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-3 h-3" style={{ color: "#4ade80" }} />
                  <span className="text-[10px] font-semibold" style={{ color: "#4ade80" }}>{kpi.delta}</span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{kpi.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Health badge */}
          <div className="flex justify-end">
            <div
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}
            >
              <div className="text-center">
                <p className="text-[9px] tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>Operational Health</p>
                <p className="text-xl font-black" style={{ color: "#4ade80" }}>92</p>
              </div>
              <div className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>
                Excellent
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid lg:grid-cols-3 gap-4">

            {/* Lead Flow */}
            <div
              className="lg:col-span-2 rounded-xl p-5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-white">Lead Flow</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Incoming Â· Contacted Â· Converted</p>
                </div>
                <div
                  className="text-[9px] px-2 py-1 rounded"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  Daily
                </div>
              </div>
              <div className="flex items-center gap-5 mb-4">
                {[
                  { label: "Incoming", color: GOLD },
                  { label: "Contacted", color: GOLD_BRIGHT },
                  { label: "Converted", color: "#4ade80" },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={leadFlowData}>
                  <defs>
                    <linearGradient id="gIncoming" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gContacted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD_BRIGHT} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={GOLD_BRIGHT} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gConverted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }} axisLine={false} tickLine={false} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="incoming" stroke={GOLD} strokeWidth={1.5} fill="url(#gIncoming)" />
                  <Area type="monotone" dataKey="contacted" stroke={GOLD_BRIGHT} strokeWidth={1.5} fill="url(#gContacted)" />
                  <Area type="monotone" dataKey="converted" stroke="#4ade80" strokeWidth={1.5} fill="url(#gConverted)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Channel Performance */}
            <div
              className="rounded-xl p-5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-sm font-bold text-white mb-1">Channel Performance</p>
              <p className="text-[10px] mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>Lead sources this week</p>
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={channelData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="value">
                        {channelData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-xl font-black text-white">2,453</p>
                    <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>total</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {channelData.map((ch) => (
                  <div key={ch.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ch.color }} />
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>{ch.name}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-white">{ch.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid lg:grid-cols-3 gap-4">

            {/* Recent Alerts */}
            <div
              className="rounded-xl p-5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-white">Recent Alerts</p>
                <button className="text-[10px] font-semibold" style={{ color: GOLD }}>View all</button>
              </div>
              <div className="space-y-3">
                {recentAlerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: alert.sev === "high" ? "rgba(239,68,68,0.12)" : `${GOLD}12`,
                        border: `1px solid ${alert.sev === "high" ? "rgba(239,68,68,0.3)" : GOLD + "25"}`,
                      }}
                    >
                      <alert.icon className="w-3.5 h-3.5" style={{ color: alert.sev === "high" ? "#f87171" : GOLD }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white leading-snug">{alert.msg}</p>
                      <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{alert.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div
              className="rounded-xl p-5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-white">Recent Activity</p>
                <button className="text-[10px] font-semibold" style={{ color: GOLD }}>View all</button>
              </div>
              <div className="space-y-3">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}>
                      <item.icon className="w-3.5 h-3.5" style={{ color: GOLD }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white leading-snug">{item.msg}</p>
                      <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Response Time */}
              <div
                className="mt-5 p-4 rounded-xl text-center"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Avg Response Time</p>
                <p className="text-2xl font-black" style={{ color: GOLD }}>18m 42s</p>
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>â†“ 6.2% vs last week</p>
              </div>
            </div>

            {/* Tasks Due Today */}
            <div
              className="rounded-xl p-5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-white">Tasks Due Today</p>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${GOLD}20`, color: GOLD }}
                >
                  {tasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ border: `1px solid ${task.priority === "high" ? "rgba(239,68,68,0.5)" : GOLD + "40"}`, background: "transparent" }}
                    />
                    <span className="text-xs text-white flex-1">{task.label}</span>
                    <div
                      className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{
                        background: task.priority === "high" ? "rgba(239,68,68,0.12)" : task.priority === "med" ? `${GOLD}12` : "rgba(255,255,255,0.05)",
                        color: task.priority === "high" ? "#f87171" : task.priority === "med" ? GOLD : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {task.priority}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="w-full mt-5 py-2.5 text-[10px] font-bold tracking-wider uppercase transition-all hover:opacity-85"
                style={{ border: `1px solid ${GOLD}40`, color: GOLD, borderRadius: 8 }}
              >
                + ADD TASK
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

