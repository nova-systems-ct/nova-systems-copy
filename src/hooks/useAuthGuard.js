import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { safeReturnTo } from "../lib/returnTo";

// Checks for a real Supabase session — not a localStorage flag, which anyone can set from
// devtools. `checking` lets callers avoid flashing protected content before the check resolves.
// Ported from nova-wave-one's hardened implementation.
export function useAuthGuard() {
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const returnTo = safeReturnTo(pathname + search + hash);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const goToLogin = () => navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });

    async function check() {
      if (!supabase) {
        goToLogin();
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (!data?.session) goToLogin();
        else setChecking(false);
      } catch {
        if (active) goToLogin();
      }
    }
    check();

    const { data: subscription } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (active && !session) goToLogin();
    }) || {};

    return () => {
      active = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [navigate, returnTo]);

  return checking;
}
