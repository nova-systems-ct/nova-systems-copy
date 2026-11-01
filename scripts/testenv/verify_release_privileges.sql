-- Run on staging after the canonical migrations, as an administrator.
-- Read-only assertions: no users, memberships, jobs or customer data are created.
DO $$
DECLARE f record;
BEGIN
  IF has_function_privilege('anon', 'public.claim_next_job(text,text[],integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_next_job(text,text[],integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client roles can claim jobs';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.claim_next_job(text,text[],integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Background worker cannot claim jobs';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Public table without RLS';
  END IF;
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname IN ('has_permission','is_org_member','is_platform_owner') LOOP
    IF has_function_privilege('anon', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Anonymous callers can invoke %', f.proname;
    END IF;
    IF NOT has_function_privilege('authenticated', f.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Signed-in membership checks broken for %', f.proname;
    END IF;
  END LOOP;
END $$;
SELECT 'release privilege assertions passed' AS result;
