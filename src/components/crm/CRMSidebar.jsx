import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, TrendingUp, Briefcase, FileText, Mail, Settings, LogOut, Menu, X, ChevronRight } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const NAV = [
  { label: "Home",       path: "/dashboard",             icon: LayoutDashboard },
  { label: "Clients",    path: "/dashboard/clients",     icon: Users },
  { label: "Leads",      path: "/dashboard/leads",       icon: TrendingUp },
  { label: "Jobs",       path: "/dashboard/jobs",        icon: Briefcase },
  { label: "Documents",  path: "/dashboard/documents",   icon: FileText },
  { label: "Newsletter", path: "/dashboard/newsletter",  icon: Mail },
  { label: "Settings",   path: "/dashboard/settings",    icon: Settings },
];

export default function CRMSidebar({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path) =>
    path === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(path);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-3 mb-10 px-1" onClick={() => setMobileOpen(false)}>
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
          <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
        </svg>
        <div>
          <p className="text-[10px] font-black tracking-[0.2em] uppercase leading-none" style={{ color: GOLD }}>NOVA SYSTEMS</p>
          <p className="text-[8px] tracking-[0.18em] uppercase leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>CRM</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {NAV.map(({ label, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Link key={path} to={path} onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group"
              style={{
                background: active ? `${GOLD}12` : "transparent",
                color: active ? GOLD : "rgba(255,255,255,0.38)",
                border: active ? `1px solid ${GOLD}28` : "1px solid transparent",
              }}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-6 pt-5 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3 mb-4 px-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
            style={{ background: GOLD_GRADIENT, color: "#0a0800" }}>I</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white leading-none">Isaac Nova</p>
            <p className="text-[9px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.3)" }}>Isaac_0427@icloud.com</p>
          </div>
        </div>
        <button onClick={() => navigate("/")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all hover:opacity-70"
          style={{ color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer" }}>
          <LogOut className="w-3.5 h-3.5" /> Back to Site
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "#060504" }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 border-r px-5 py-8"
        style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}>
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 border-b"
        style={{ background: "#060504", borderColor: "rgba(255,255,255,0.07)" }}>
        <Link to="/dashboard" className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
            <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
          </svg>
          <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA CRM</span>
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} style={{ color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer" }}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setMobileOpen(false)}>
          <div className="absolute left-0 top-14 bottom-0 w-64 px-5 py-6 border-r overflow-y-auto"
            style={{ background: "#060504", borderColor: "rgba(255,255,255,0.07)" }}
            onClick={(e) => e.stopPropagation()}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:overflow-x-hidden pt-14 md:pt-0 min-w-0">
        {children}
      </main>
    </div>
  );
}