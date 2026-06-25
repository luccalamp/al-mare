-- Follow-up hardening after storage migration advisors.
-- Keeps behavior unchanged while removing linter warnings.

ALTER FUNCTION public.submit_pre_consultation(uuid, jsonb)
  SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_backup_run_history_status;
DROP INDEX IF EXISTS public.idx_clinic_preferences_user_key_unique;
