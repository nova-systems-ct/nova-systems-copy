import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// Checks for a real Supabase session — not a localStorage flag, which anyone can set from
// devtools. `checking` lets callers avoid flashing protected content before the check resolves.
// Ported from nova-wave-one's hardened implementation.
export function useAuthGuard() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function check() {
      if (!supabase) {
        navigate("/login");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data?.session) {
        navigate("/login");
      } else {
        setChecking(false);
      }
    }
    check();

    const { data: subscription } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/login");
    }) || {};

    return () => {
      active = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  return checking;
}
