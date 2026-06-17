BEGIN;

CREATE INDEX IF NOT EXISTS idx_row_change_audit_archive_archived_at
  ON private.row_change_audit_archive (archived_at);

CREATE INDEX IF NOT EXISTS idx_row_change_audit_archive_table_changed_at
  ON private.row_change_audit_archive (table_name, changed_at DESC);

CREATE OR REPLACE FUNCTION private.purge_old_audit_entries(
  p_retention_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  deleted_count BIGINT,
  archived_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, private
AS $function$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_deleted BIGINT;
  v_archived BIGINT;
BEGIN
  v_cutoff := timezone('utc', now()) - (p_retention_days || ' days')::INTERVAL;

  INSERT INTO private.row_change_audit_archive (
    table_schema, table_name, operation, record_identity,
    changed_at, jwt_subject, jwt_role, db_role, transaction_id,
    old_record, new_record
  )
  SELECT
    audit_row.table_schema,
    audit_row.table_name,
    audit_row.operation,
    audit_row.record_identity,
    audit_row.changed_at,
    audit_row.jwt_subject,
    audit_row.jwt_role,
    audit_row.db_role,
    audit_row.transaction_id,
    audit_row.old_record,
    audit_row.new_record
  FROM private.row_change_audit AS audit_row
  WHERE audit_row.changed_at < v_cutoff;

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  DELETE FROM private.row_change_audit AS audit_row
  WHERE audit_row.changed_at < v_cutoff;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN QUERY SELECT v_deleted, v_archived;
END;
$function$;

CREATE OR REPLACE FUNCTION private.purge_old_audit_archive(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, private
AS $function$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM private.row_change_audit_archive AS archive_row
  WHERE archive_row.archived_at < timezone('utc', now()) - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

CREATE OR REPLACE FUNCTION private.get_audit_stats()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  oldest_entry TIMESTAMPTZ,
  newest_entry TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO pg_catalog, private
AS $function$
  SELECT
    audit_row.table_name,
    count(*) AS row_count,
    min(audit_row.changed_at) AS oldest_entry,
    max(audit_row.changed_at) AS newest_entry
  FROM private.row_change_audit AS audit_row
  GROUP BY audit_row.table_name
  ORDER BY row_count DESC;
$function$;

CREATE OR REPLACE FUNCTION private.cleanup_quarantine_db_records(
  p_retention_hours INTEGER DEFAULT 48
)
RETURNS TABLE (
  table_name TEXT,
  cleared_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private
AS $function$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_cleared BIGINT;
BEGIN
  v_cutoff := timezone('utc', now()) - (p_retention_hours || ' hours')::INTERVAL;

  UPDATE public.client_photos
     SET quarantined_bucket = NULL,
         quarantined_storage_path = NULL
   WHERE quarantined_bucket IS NOT NULL
     AND deleted_at < v_cutoff;

  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RETURN QUERY SELECT 'client_photos'::TEXT, v_cleared;

  UPDATE public.company_documents
     SET quarantined_bucket = NULL,
         quarantined_storage_path = NULL
   WHERE quarantined_bucket IS NOT NULL
     AND deleted_at < v_cutoff;

  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RETURN QUERY SELECT 'company_documents'::TEXT, v_cleared;

  UPDATE public.clientes
     SET profile_photo_quarantined_bucket = NULL,
         profile_photo_quarantined_path = NULL
   WHERE profile_photo_quarantined_bucket IS NOT NULL
     AND deleted_at < v_cutoff;

  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RETURN QUERY SELECT 'clientes'::TEXT, v_cleared;
END;
$function$;

CREATE OR REPLACE FUNCTION private.get_quarantine_stats()
RETURNS TABLE (
  bucket_name TEXT,
  object_count BIGINT,
  oldest_object TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO pg_catalog, storage
AS $function$
  SELECT
    bucket_row.name AS bucket_name,
    count(object_row.id) AS object_count,
    min(object_row.created_at) AS oldest_object
  FROM storage.buckets AS bucket_row
  LEFT JOIN storage.objects AS object_row
    ON bucket_row.id = object_row.bucket_id
  WHERE bucket_row.name IN ('recovery-quarantine', 'ops-backups')
  GROUP BY bucket_row.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_audit_stats()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  oldest_entry TIMESTAMPTZ,
  newest_entry TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private
AS $function$
  SELECT * FROM private.get_audit_stats();
$function$;

CREATE OR REPLACE FUNCTION public.purge_old_audit_entries(
  p_retention_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  deleted_count BIGINT,
  archived_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private
AS $function$
  SELECT * FROM private.purge_old_audit_entries(p_retention_days);
$function$;

CREATE OR REPLACE FUNCTION public.purge_old_audit_archive(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private
AS $function$
  SELECT private.purge_old_audit_archive(p_retention_days);
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_quarantine_db_records(
  p_retention_hours INTEGER DEFAULT 48
)
RETURNS TABLE (
  table_name TEXT,
  cleared_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private
AS $function$
  SELECT * FROM private.cleanup_quarantine_db_records(p_retention_hours);
$function$;

CREATE OR REPLACE FUNCTION public.get_quarantine_stats()
RETURNS TABLE (
  bucket_name TEXT,
  object_count BIGINT,
  oldest_object TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private, storage
AS $function$
  SELECT * FROM private.get_quarantine_stats();
$function$;

CREATE OR REPLACE FUNCTION public.list_quarantine_storage_candidates(
  p_retention_hours INTEGER DEFAULT 48
)
RETURNS TABLE (
  bucket_name TEXT,
  object_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO pg_catalog, public, storage
AS $function$
  SELECT
    object_row.bucket_id AS bucket_name,
    object_row.name AS object_name,
    object_row.created_at
  FROM storage.objects AS object_row
  WHERE object_row.bucket_id IN ('recovery-quarantine', 'ops-backups')
    AND object_row.created_at < timezone('utc', now()) - (p_retention_hours || ' hours')::INTERVAL
  ORDER BY object_row.bucket_id, object_row.created_at;
$function$;

REVOKE ALL ON FUNCTION public.get_audit_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_audit_stats() FROM anon;
REVOKE ALL ON FUNCTION public.get_audit_stats() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_stats() TO service_role;

REVOKE ALL ON FUNCTION public.purge_old_audit_entries(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_old_audit_entries(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.purge_old_audit_entries(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_audit_entries(INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.purge_old_audit_archive(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_old_audit_archive(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.purge_old_audit_archive(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_audit_archive(INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_quarantine_db_records(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_quarantine_db_records(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_quarantine_db_records(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_quarantine_db_records(INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.get_quarantine_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_quarantine_stats() FROM anon;
REVOKE ALL ON FUNCTION public.get_quarantine_stats() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_quarantine_stats() TO service_role;

REVOKE ALL ON FUNCTION public.list_quarantine_storage_candidates(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_quarantine_storage_candidates(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.list_quarantine_storage_candidates(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.list_quarantine_storage_candidates(INTEGER) TO service_role;

COMMIT;
