import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, CheckSquare, Square, Clock, AlertCircle } from "lucide-react";

const GOLD = "#D4A030";
const GOLD_GRADIENT = `linear-gradient(135deg, #8a6200 0%, ${GOLD} 35%, #C8921A 55%, ${GOLD} 80%, #8a6200 100%)`;

const TASK_STATUS = {
  pending:     { label: "Pending",     color: "rgba(255,255,255,0.4)",  bg: "rgba(255,255,255,0.05)" },
  in_progress: { label: "In Progress", color: "#60a5fa",               bg: "rgba(59,130,246,0.08)" },
  done:        { label: "Done",        color: "#4ade80",               bg: "rgba(34,197,94,0.08)" },
};

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [application, setApplication] = useState(null);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    const s = JSON.parse(localStorage.getItem("nova_applicant_session") || "null");
    if (!s || !s.isEmployee) { navigate("/applicant-login"); return; }
    setSession(s);

    const apps = JSON.parse(localStorage.getItem("nova_applications") || "[]");
    const app = apps.find((a) => a.id === s.applicationId);
    setApplication(app || null);

    const allAssignments = JSON.parse(localStorage.getItem("nova_assignments") || "[]");
    setAssignments(allAssignments.filter((a) => a.employeeId === s.applicationId));
  }, []);

  const markDone = (assignmentId) => {
    const all = JSON.parse(localStorage.getItem("nova_assignments") || "[]");
    const updated = all.map((a) =>
      a.id === assignmentId ? { ...a, status: a.status === "done" ? "in_progress" : "done" } : a
    );
    localStorage.setItem("nova_assignments", JSON.stringify(updated));
    setAssignments(updated.filter((a) => a.employeeId === session.applicationId));
  };

  const logout = () => {
    localStorage.removeItem("nova_applicant_session");
    navigate("/applicant-login");
  };

  if (!session) return null;

  const pending = assignments.filter((a) => a.status !== "done");
  const done = assignments.filter((a) => a.status === "done");

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <a href="/" className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="4" stroke={GOLD} strokeWidth="1.5" fill="none" />
              <text x="16" y="23" textAnchor="middle" fontFamily="'Arial Black',Arial,sans-serif" fontWeight="900" fontSize="18" fill={GOLD}>N</text>
            </svg>
            <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: GOLD }}>NOVA SYSTEMS</span>
          </a>
          <button onClick={logout} className="flex items-center gap-2 text-xs transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>

        {/* Welcome */}
        <div className="rounded-2xl p-8 mb-8"
          style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}>
          <p className="text-[9px] tracking-[0.3em] uppercase mb-2" style={{ color: GOLD }}>EMPLOYEE PORTAL</p>
          <h1 className="text-3xl font-black text-white mb-1">
            Hey, {application?.name?.split(" ")[0] || "there"}.
          </h1>
          <div className="flex flex-wrap gap-4 mt-4">
            {[
              ["Position", application?.position || "—"],
              ["Status", "Active"],
              ["Pay", application?.position?.toLowerCase().includes("video") ? "$20/hour" : "Commission-based"],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-[9px] tracking-[0.18em] uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
                <p className="text-sm font-semibold text-white">{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Assignments */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[9px] tracking-[0.28em] uppercase" style={{ color: GOLD }}>ASSIGNMENTS</p>
            {pending.length > 0 && (
              <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                style={{ background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}35` }}>
                {pending.length} pending
              </span>
            )}
          </div>

          {assignments.length === 0 ? (
            <div className="rounded-xl p-12 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-sm text-white/40">No assignments yet. Isaac will assign tasks soon.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...pending, ...done].map((task) => {
                const ts = TASK_STATUS[task.status] || TASK_STATUS.pending;
                const isDone = task.status === "done";
                const overdue = task.dueDate && !isDone && new Date(task.dueDate) < new Date();
                return (
                  <div key={task.id} className="rounded-xl p-5 flex items-start gap-4 transition-all"
                    style={{
                      background: isDone ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isDone ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.09)"}`,
                      opacity: isDone ? 0.6 : 1,
                    }}>
                    <button onClick={() => markDone(task.id)}
                      className="mt-0.5 flex-shrink-0 transition-all"
                      style={{ color: isDone ? "#4ade80" : "rgba(255,255,255,0.2)", background: "none", border: "none", cursor: "pointer" }}>
                      {isDone ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className={`font-semibold text-sm ${isDone ? "line-through text-white/30" : "text-white"}`}>
                          {task.title}
                        </p>
                        <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.color}30` }}>
                          {ts.label}
                        </span>
                        {overdue && (
                          <span className="flex items-center gap-1 text-[9px] font-bold text-red-400">
                            <AlertCircle className="w-3 h-3" /> OVERDUE
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{task.description}</p>
                      )}
                      {task.dueDate && (
                        <p className="text-[10px] mt-1.5" style={{ color: overdue ? "#f87171" : "rgba(255,255,255,0.25)" }}>
                          Due: {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      )}
                    </div>
                    {!isDone && (
                      <button onClick={() => markDone(task.id)}
                        className="text-[9px] font-bold tracking-wider px-3 py-1.5 rounded-lg flex-shrink-0 transition-all hover:opacity-80"
                        style={{ background: GOLD_GRADIENT, color: "#0a0800", border: "none", cursor: "pointer" }}>
                        MARK DONE
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>
          Questions? Contact Isaac at hello@nova-systems.app
        </p>
      </div>
    </div>
  );
}