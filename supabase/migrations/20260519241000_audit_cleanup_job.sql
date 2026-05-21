-- Migration: Audit cleanup job
-- Since pg_cron is not available on this Supabase instance,
-- we create a SQL function that can be called via Edge Function cron schedule.

-- ============================================================
-- 1. Function: purge_old_audit_entries
-- Deletes audit entries older than N days (default: 30 days)
-- ============================================================

CREATE OR REPLACE FUNCTION private.purge_old_audit_entries(
  p_retention_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  deleted_count BIGINT,
  archived_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_deleted BIGINT;
  v_archived BIGINT;
BEGIN
  v_cutoff := NOW() - (p_retention_days || ' days')::INTERVAL;

  -- Archive first (safety net)
  INSERT INTO private.row_change_audit_archive (
    table_schema, table_name, operation, record_identity,
    changed_at, jwt_subject, jwt_role, db_role, transaction_id,
    old_record, new_record
  )
  SELECT
    table_schema, table_name, operation, record_identity,
    changed_at, jwt_subject, jwt_role, db_role, transaction_id,
    old_record, new_record
  FROM private.row_change_audit
  WHERE changed_at < v_cutoff;

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  -- Delete from main table
  DELETE FROM private.row_change_audit
  WHERE changed_at < v_cutoff;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN QUERY SELECT v_deleted, v_archived;
END;
$$;

-- ============================================================
-- 2. Function: purge_old_audit_archive
-- Cleans the archive table itself (entries older than 90 days)
-- ============================================================

CREATE OR REPLACE FUNCTION private.purge_old_audit_archive(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM private.row_change_audit_archive
  WHERE archived_at < NOW() - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================
-- 3. Function: get_audit_stats
-- Returns current audit table statistics
-- ============================================================

CREATE OR REPLACE FUNCTION private.get_audit_stats()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  oldest_entry TIMESTAMPTZ,
  newest_entry TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    table_name,
    count(*) AS row_count,
    min(changed_at) AS oldest_entry,
    max(changed_at) AS newest_entry
  FROM private.row_change_audit
  GROUP BY table_name
  ORDER BY row_count DESC;
$$;
