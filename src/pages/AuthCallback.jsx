import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { safeReturnTo } from "@/lib/returnTo";
import { useSEO } from "@/hooks/useSEO";

const GOLD = "#C9A84C";

// Canonical landing point for every Supabase Auth redirect: magic links, signup confirmation, and
// password-recovery links all land here. supabase-js's `detectSessionInUrl` (on by default)
// parses whatever token/code is in the URL automatically; this page just waits for that to
// resolve via onAuthStateChange and then routes to the right place — a real PASSWORD_RECOVERY
// session goes to /reset-password, everything else goes to the validated returnTo destination.
export default function AuthCallback() {
  useSEO({ title: "Signing In — Nova Systems" });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("working"); // working | error
  const destination = safeReturnTo(searchParams.get("returnTo"));

  useEffect(() => {
    if (!supabase) {
      setStatus("error");
      return;
    }
    let settled = false;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return;
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        navigate(`/reset-password?returnTo=${encodeURIComponent(destination)}`, { replace: true });
      } else if (session) {
        settled = true;
        navigate(destination, { replace: true });
      }
    });

    // Covers the case where the session was already established synchronously by the time this
    // effect runs (detectSessionInUrl can resolve before the listener above attaches).
    supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      if (data?.session) {
        settled = true;
        navigate(destination, { replace: true });
      }
    });

    const timeout = setTimeout(() => {
      if (!settled) setStatus("error");
    }, 8000);

    return () => {
      clearTimeout(timeout);
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#0A0A0A" }}>
      <div className="text-center">
        {status === "working" ? (
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: GOLD }}>Signing you in…</p>
        ) : (
          <>
            <p className="text-sm mb-4 text-white">That link has expired or is no longer valid.</p>
            <a href="/login" className="text-xs uppercase tracking-[0.2em]" style={{ color: GOLD }}>Return to login</a>
          </>
        )}
      </div>
    </div>
  );
}
