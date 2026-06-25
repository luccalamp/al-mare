-- Supabase Storage-only hardening for Al Mare media.
-- This migration is intentionally additive/idempotent: it creates private buckets
-- and metadata columns needed by the server-side upload/migration pipeline without
-- deleting or rewriting existing photo/document rows.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'anamnese-fotos',
    'anamnese-fotos',
    false,
    26214400,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
  ),
  (
    'company-documents',
    'company-documents',
    false,
    15728640,
    ARRAY[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/avif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ]::text[]
  ),
  (
    'recovery-quarantine',
    'recovery-quarantine',
    false,
    26214400,
    NULL
  ),
  (
    'ops-backups',
    'ops-backups',
    false,
    104857600,
    ARRAY['application/json']::text[]
  )
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at = timezone('utc', now());

DO $$
BEGIN
  IF to_regclass('public.client_photos') IS NOT NULL THEN
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS optimized_storage_path text;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS thumbnail_storage_path text;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS mime_type text;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS original_mime_type text;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS tamanho_original_bytes bigint;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS tamanho_otimizado_bytes bigint;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS largura integer;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS altura integer;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS formato_final text;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS original_storage_provider text;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS migration_status text NOT NULL DEFAULT 'native';
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS migrated_from text;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS migrated_at timestamptz;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS migration_error text;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS legacy_s3_bucket text;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS legacy_s3_key text;
    ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS legacy_url text;

    CREATE INDEX IF NOT EXISTS idx_client_photos_optimized_storage_path
      ON public.client_photos (optimized_storage_path)
      WHERE optimized_storage_path IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_photos_thumbnail_storage_path
      ON public.client_photos (thumbnail_storage_path)
      WHERE thumbnail_storage_path IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_client_photos_migration_status
      ON public.client_photos (migration_status);

    UPDATE public.client_photos
    SET
      migration_status = 'pending',
      original_storage_provider = COALESCE(original_storage_provider, storage_bucket, 'legacy'),
      legacy_s3_bucket = CASE
        WHEN COALESCE(legacy_s3_bucket, '') = '' AND COALESCE(storage_bucket, '') NOT IN ('', 'anamnese-fotos')
          THEN storage_bucket
        ELSE legacy_s3_bucket
      END,
      legacy_s3_key = CASE
        WHEN COALESCE(legacy_s3_key, '') = '' AND COALESCE(storage_bucket, '') NOT IN ('', 'anamnese-fotos')
          THEN storage_path
        ELSE legacy_s3_key
      END
    WHERE deleted_at IS NULL
      AND (
        COALESCE(storage_bucket, '') NOT IN ('', 'anamnese-fotos')
        OR COALESCE(legacy_s3_bucket, '') <> ''
        OR COALESCE(legacy_s3_key, '') <> ''
        OR COALESCE(url, '') ~* '(amazonaws\.com|s3[.-]|^s3://)'
      );
  END IF;

  IF to_regclass('public.company_documents') IS NOT NULL THEN
    ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS storage_bucket text;
    ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS storage_path text;
    ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS quarantined_bucket text;
    ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS quarantined_storage_path text;

    CREATE INDEX IF NOT EXISTS idx_company_documents_storage_bucket_path
      ON public.company_documents (storage_bucket, storage_path)
      WHERE storage_bucket IS NOT NULL AND storage_path IS NOT NULL;
  END IF;

  IF to_regclass('public.backup_run_history') IS NOT NULL THEN
    ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS destination text NOT NULL DEFAULT 'supabase-storage';
    ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS storage_bucket text;
    ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS storage_path text;
    ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS s3_bucket text;
    ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS s3_key text;
    ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS checksum text;
    ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS payload_bytes bigint NOT NULL DEFAULT 0;
    ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS table_counts jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
