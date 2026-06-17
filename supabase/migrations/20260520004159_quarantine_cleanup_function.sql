-- Migration: Quarantine cleanup functions

CREATE OR REPLACE FUNCTION private.cleanup_quarantine_files(
  p_retention_hours INTEGER DEFAULT 48
)
RETURNS TABLE (
  bucket_name TEXT,
  deleted_count INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_bucket RECORD;
  v_cutoff TIMESTAMPTZ;
  v_deleted INTEGER := 0;
  v_error TEXT;
BEGIN
  v_cutoff := NOW() - (p_retention_hours || ' hours')::INTERVAL;

  FOR v_bucket IN
    SELECT name AS bucket_name
    FROM storage.buckets
    WHERE name IN ('recovery-quarantine', 'ops-backups')
  LOOP
    BEGIN
      DELETE FROM storage.objects
      WHERE bucket_id = v_bucket.bucket_name
        AND created_at < v_cutoff;

      GET DIAGNOSTICS v_deleted = ROW_COUNT;

      RETURN QUERY SELECT v_bucket.bucket_name, v_deleted, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
      v_error := SQLERRM;
      RETURN QUERY SELECT v_bucket.bucket_name, 0, v_error;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.cleanup_quarantine_db_records(
  p_retention_hours INTEGER DEFAULT 48
)
RETURNS TABLE (
  table_name TEXT,
  cleared_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_cleared BIGINT;
BEGIN
  v_cutoff := NOW() - (p_retention_hours || ' hours')::INTERVAL;

  UPDATE client_photos
  SET quarantined_bucket = NULL,
      quarantined_storage_path = NULL
  WHERE quarantined_bucket IS NOT NULL
    AND deleted_at < v_cutoff;

  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RETURN QUERY SELECT 'client_photos'::TEXT, v_cleared;

  UPDATE company_documents
  SET quarantined_bucket = NULL,
      quarantined_storage_path = NULL
  WHERE quarantined_bucket IS NOT NULL
    AND deleted_at < v_cutoff;

  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RETURN QUERY SELECT 'company_documents'::TEXT, v_cleared;

  UPDATE clientes
  SET profile_photo_quarantined_bucket = NULL,
      profile_photo_quarantined_path = NULL
  WHERE profile_photo_quarantined_bucket IS NOT NULL
    AND deleted_at < v_cutoff;

  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RETURN QUERY SELECT 'clientes'::TEXT, v_cleared;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_quarantine_stats()
RETURNS TABLE (
  bucket_name TEXT,
  object_count BIGINT,
  oldest_object TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    b.name AS bucket_name,
    count(o.id) AS object_count,
    min(o.created_at) AS oldest_object
  FROM storage.buckets b
  LEFT JOIN storage.objects o ON b.id = o.bucket_id
  WHERE b.name IN ('recovery-quarantine', 'ops-backups')
  GROUP BY b.name;
$$;
