-- Fix Supabase advisor findings without mutating client data.
-- Scope: tighten grants/policies on operational tables, restore intended RPC grants,
-- add the missing backup drill FK index, and harden the updated_at trigger function.

BEGIN;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_run_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restore_drill_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.access_requests FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.access_requests FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.access_requests FROM authenticated;
GRANT ALL PRIVILEGES ON TABLE public.access_requests TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.auth_verification_codes FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.auth_verification_codes FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.auth_verification_codes FROM authenticated;
GRANT ALL PRIVILEGES ON TABLE public.auth_verification_codes TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.backup_run_history FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.backup_run_history FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.backup_run_history FROM authenticated;
GRANT ALL PRIVILEGES ON TABLE public.backup_run_history TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.restore_drill_history FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.restore_drill_history FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.restore_drill_history FROM authenticated;
GRANT ALL PRIVILEGES ON TABLE public.restore_drill_history TO service_role;

DROP POLICY IF EXISTS service_role_manage_access_requests ON public.access_requests;
CREATE POLICY service_role_manage_access_requests
  ON public.access_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS service_role_manage_auth_verification_codes ON public.auth_verification_codes;
CREATE POLICY service_role_manage_auth_verification_codes
  ON public.auth_verification_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS service_role_manage_backup_run_history ON public.backup_run_history;
CREATE POLICY service_role_manage_backup_run_history
  ON public.backup_run_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS service_role_manage_restore_drill_history ON public.restore_drill_history;
CREATE POLICY service_role_manage_restore_drill_history
  ON public.restore_drill_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_restore_drill_history_latest_backup_run_id
  ON public.restore_drill_history (latest_backup_run_id);

ALTER FUNCTION public.touch_updated_at() SET search_path TO pg_catalog, public;

REVOKE ALL ON FUNCTION public.submit_pre_consultation(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_pre_consultation(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.submit_pre_consultation(UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_pre_consultation(UUID, JSONB) TO service_role;

COMMIT;