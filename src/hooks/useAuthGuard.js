import { loginRedirect } from '../lib/returnTo.js';
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// Checks for a real Supabase session — not a localStorage flag, which anyone can set from
// devtools. `checking` lets callers avoid flashing protected content before the check resolves.
// Ported from nova-wave-one's hardened implementation.
export function useAuthGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function check() {
      if (!supabase) {
        navigate(loginRedirect(location), { replace: true });
        return;
      }
      let data;
      try { ({ data } = await supabase.auth.getSession()); }
      catch { if (active) navigate(loginRedirect(location), { replace: true }); return; }
      if (!active) return;
      if (!data?.session) {
        navigate(loginRedirect(location), { replace: true });
      } else {
        setChecking(false);
      }
    }
    check();

    const { data: subscription } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate(loginRedirect(location), { replace: true });
    }) || {};

    return () => {
      active = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [navigate, location.pathname, location.search, location.hash]);

  return checking;
}
