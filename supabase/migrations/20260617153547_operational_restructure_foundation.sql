-- Operational restructure foundation
-- Additive migration to normalize ownership, indexes, operational metadata,
-- and safe reporting helpers without dropping or renaming existing columns.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.sync_child_user_id_from_client()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  resolved_user_id uuid;
BEGIN
  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id
    INTO resolved_user_id
    FROM public.clientes
   WHERE id = NEW.cliente_id;

  IF resolved_user_id IS NOT NULL THEN
    NEW.user_id = resolved_user_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.sync_document_user_id_from_folder()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  resolved_user_id uuid;
BEGIN
  IF NEW.folder_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id
    INTO resolved_user_id
    FROM public.company_document_folders
   WHERE id = NEW.folder_id;

  IF resolved_user_id IS NOT NULL THEN
    NEW.user_id = resolved_user_id;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_child_user_id_from_client() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_child_user_id_from_client() FROM anon;
REVOKE ALL ON FUNCTION private.sync_child_user_id_from_client() FROM authenticated;
GRANT EXECUTE ON FUNCTION private.sync_child_user_id_from_client() TO service_role;

REVOKE ALL ON FUNCTION private.sync_document_user_id_from_folder() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_document_user_id_from_folder() FROM anon;
REVOKE ALL ON FUNCTION private.sync_document_user_id_from_folder() FROM authenticated;
GRANT EXECUTE ON FUNCTION private.sync_document_user_id_from_folder() TO service_role;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  reset_at bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.rate_limits FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.rate_limits FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.rate_limits FROM authenticated;
GRANT ALL PRIVILEGES ON TABLE public.rate_limits TO service_role;

DROP POLICY IF EXISTS service_role_manage_rate_limits ON public.rate_limits;
CREATE POLICY service_role_manage_rate_limits
  ON public.rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms bigint
)
RETURNS TABLE(count integer, reset_at bigint, allowed boolean)
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  normalized_key text;
  current_ms bigint;
  next_reset_ms bigint;
  current_count integer;
  current_reset_at bigint;
BEGIN
  normalized_key := btrim(coalesce(p_key, ''));
  IF normalized_key = '' THEN
    RAISE EXCEPTION 'p_key is required';
  END IF;

  IF coalesce(p_limit, 0) <= 0 THEN
    RAISE EXCEPTION 'p_limit must be greater than zero';
  END IF;

  IF coalesce(p_window_ms, 0) <= 0 THEN
    RAISE EXCEPTION 'p_window_ms must be greater than zero';
  END IF;

  current_ms := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  next_reset_ms := current_ms + p_window_ms;

  INSERT INTO public.rate_limits AS rate_limit (key, count, reset_at, created_at, updated_at)
  VALUES (normalized_key, 1, next_reset_ms, timezone('utc', now()), timezone('utc', now()))
  ON CONFLICT (key) DO UPDATE
  SET count = CASE
      WHEN rate_limit.reset_at <= current_ms THEN 1
      ELSE rate_limit.count + 1
    END,
    reset_at = CASE
      WHEN rate_limit.reset_at <= current_ms THEN next_reset_ms
      ELSE rate_limit.reset_at
    END,
    updated_at = timezone('utc', now())
  RETURNING rate_limit.count, rate_limit.reset_at
  INTO current_count, current_reset_at;

  count := current_count;
  reset_at := current_reset_at;
  allowed := current_count <= p_limit;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, bigint) FROM anon;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, bigint) TO service_role;

DO $block$
BEGIN
  IF to_regclass('public.clientes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS perfil_complementar jsonb NOT NULL DEFAULT ''{}''::jsonb';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS portal_active boolean NOT NULL DEFAULT false';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS link_ativo boolean NOT NULL DEFAULT false';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS portal_token uuid';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS token_pre_consulta uuid';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS pre_consulta_respondida_em timestamptz';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS profile_photo_storage_bucket text';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS profile_photo_storage_path text';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS profile_photo_quarantined_bucket text';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS profile_photo_quarantined_path text';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS deleted_at timestamptz';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS deleted_by uuid';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS delete_reason text';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS restored_at timestamptz';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS restored_by uuid';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'UPDATE public.clientes SET perfil_complementar = ''{}''::jsonb WHERE perfil_complementar IS NULL';
    EXECUTE 'UPDATE public.clientes SET portal_active = COALESCE(portal_active, false), link_ativo = COALESCE(link_ativo, false), updated_at = COALESCE(updated_at, created_at, timezone(''utc'', now()))';
  END IF;

  IF to_regclass('public.company_document_folders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.company_document_folders ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.company_document_folders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
  END IF;

  IF to_regclass('public.company_documents') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS user_id uuid';
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS storage_bucket text';
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS quarantined_bucket text';
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS quarantined_storage_path text';
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz';
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS deleted_by uuid';
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS delete_reason text';
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS restored_at timestamptz';
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS restored_by uuid';
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE '
      UPDATE public.company_documents document_row
         SET user_id = folder_row.user_id
        FROM public.company_document_folders folder_row
       WHERE document_row.folder_id = folder_row.id
         AND (document_row.user_id IS NULL OR document_row.user_id IS DISTINCT FROM folder_row.user_id)
    ';
  END IF;

  IF to_regclass('public.client_photos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS user_id uuid';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS categoria text';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS anotacao_tecnica text';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS captured_at timestamptz';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS storage_bucket text';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS storage_path text';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS quarantined_bucket text';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS quarantined_storage_path text';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS deleted_at timestamptz';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS deleted_by uuid';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS delete_reason text';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS restored_at timestamptz';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS restored_by uuid';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.client_photos ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE '
      UPDATE public.client_photos child_row
         SET user_id = client_row.user_id
        FROM public.clientes client_row
       WHERE child_row.cliente_id = client_row.id
         AND (child_row.user_id IS NULL OR child_row.user_id IS DISTINCT FROM client_row.user_id)
    ';
  END IF;

  IF to_regclass('public.diagnostico_capilar') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD COLUMN IF NOT EXISTS user_id uuid';
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD COLUMN IF NOT EXISTS deleted_at timestamptz';
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD COLUMN IF NOT EXISTS deleted_by uuid';
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD COLUMN IF NOT EXISTS delete_reason text';
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD COLUMN IF NOT EXISTS restored_at timestamptz';
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD COLUMN IF NOT EXISTS restored_by uuid';
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD COLUMN IF NOT EXISTS presenca_metais boolean NOT NULL DEFAULT false';
    EXECUTE '
      UPDATE public.diagnostico_capilar child_row
         SET user_id = client_row.user_id
        FROM public.clientes client_row
       WHERE child_row.cliente_id = client_row.id
         AND (child_row.user_id IS NULL OR child_row.user_id IS DISTINCT FROM client_row.user_id)
    ';
  END IF;

  IF to_regclass('public.historico_procedimentos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.historico_procedimentos ADD COLUMN IF NOT EXISTS user_id uuid';
    EXECUTE 'ALTER TABLE public.historico_procedimentos ADD COLUMN IF NOT EXISTS deleted_at timestamptz';
    EXECUTE 'ALTER TABLE public.historico_procedimentos ADD COLUMN IF NOT EXISTS deleted_by uuid';
    EXECUTE 'ALTER TABLE public.historico_procedimentos ADD COLUMN IF NOT EXISTS delete_reason text';
    EXECUTE 'ALTER TABLE public.historico_procedimentos ADD COLUMN IF NOT EXISTS restored_at timestamptz';
    EXECUTE 'ALTER TABLE public.historico_procedimentos ADD COLUMN IF NOT EXISTS restored_by uuid';
    EXECUTE 'ALTER TABLE public.historico_procedimentos ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.historico_procedimentos ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE '
      UPDATE public.historico_procedimentos child_row
         SET user_id = client_row.user_id
        FROM public.clientes client_row
       WHERE child_row.cliente_id = client_row.id
         AND (child_row.user_id IS NULL OR child_row.user_id IS DISTINCT FROM client_row.user_id)
    ';
  END IF;

  IF to_regclass('public.manutencao_homecare') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.manutencao_homecare ADD COLUMN IF NOT EXISTS user_id uuid';
    EXECUTE 'ALTER TABLE public.manutencao_homecare ADD COLUMN IF NOT EXISTS deleted_at timestamptz';
    EXECUTE 'ALTER TABLE public.manutencao_homecare ADD COLUMN IF NOT EXISTS deleted_by uuid';
    EXECUTE 'ALTER TABLE public.manutencao_homecare ADD COLUMN IF NOT EXISTS delete_reason text';
    EXECUTE 'ALTER TABLE public.manutencao_homecare ADD COLUMN IF NOT EXISTS restored_at timestamptz';
    EXECUTE 'ALTER TABLE public.manutencao_homecare ADD COLUMN IF NOT EXISTS restored_by uuid';
    EXECUTE 'ALTER TABLE public.manutencao_homecare ADD COLUMN IF NOT EXISTS pago boolean NOT NULL DEFAULT false';
    EXECUTE 'ALTER TABLE public.manutencao_homecare ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.manutencao_homecare ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE '
      UPDATE public.manutencao_homecare child_row
         SET user_id = client_row.user_id
        FROM public.clientes client_row
       WHERE child_row.cliente_id = client_row.id
         AND (child_row.user_id IS NULL OR child_row.user_id IS DISTINCT FROM client_row.user_id)
    ';
  END IF;

  IF to_regclass('public.ficha_anamnese_capilar') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS user_id uuid';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS dados jsonb NOT NULL DEFAULT ''{}''::jsonb';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS deleted_at timestamptz';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS deleted_by uuid';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS delete_reason text';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS restored_at timestamptz';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS restored_by uuid';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'UPDATE public.ficha_anamnese_capilar SET dados = ''{}''::jsonb WHERE dados IS NULL';
    EXECUTE '
      UPDATE public.ficha_anamnese_capilar child_row
         SET user_id = client_row.user_id
        FROM public.clientes client_row
       WHERE child_row.cliente_id = client_row.id
         AND (child_row.user_id IS NULL OR child_row.user_id IS DISTINCT FROM client_row.user_id)
    ';
  END IF;

  IF to_regclass('public.agendamentos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS user_id uuid';
    EXECUTE 'ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT ''{}''::jsonb';
    EXECUTE 'ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS deleted_at timestamptz';
    EXECUTE 'ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS deleted_by uuid';
    EXECUTE 'ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS delete_reason text';
    EXECUTE 'ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS restored_at timestamptz';
    EXECUTE 'ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS restored_by uuid';
    EXECUTE 'ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'UPDATE public.agendamentos SET metadata = ''{}''::jsonb WHERE metadata IS NULL';
    EXECUTE '
      UPDATE public.agendamentos child_row
         SET user_id = client_row.user_id
        FROM public.clientes client_row
       WHERE child_row.cliente_id = client_row.id
         AND (child_row.user_id IS NULL OR child_row.user_id IS DISTINCT FROM client_row.user_id)
    ';
  END IF;

  IF to_regclass('public.clinic_preferences') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.clinic_preferences ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT ''{}''::jsonb';
    EXECUTE 'ALTER TABLE public.clinic_preferences ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.clinic_preferences ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'UPDATE public.clinic_preferences SET payload = ''{}''::jsonb WHERE payload IS NULL';
  END IF;

  IF to_regclass('public.access_requests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'UPDATE public.access_requests SET email = lower(btrim(email)) WHERE email IS NOT NULL AND email <> lower(btrim(email))';
  END IF;

  IF to_regclass('public.auth_verification_codes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.auth_verification_codes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.auth_verification_codes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
  END IF;

  IF to_regclass('public.backup_run_history') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT ''{}''::jsonb';
    EXECUTE 'ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS table_counts jsonb NOT NULL DEFAULT ''{}''::jsonb';
    EXECUTE 'ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.backup_run_history ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
  END IF;

  IF to_regclass('public.restore_drill_history') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.restore_drill_history ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT ''{}''::jsonb';
    EXECUTE 'ALTER TABLE public.restore_drill_history ADD COLUMN IF NOT EXISTS result_summary jsonb NOT NULL DEFAULT ''{}''::jsonb';
    EXECUTE 'ALTER TABLE public.restore_drill_history ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
    EXECUTE 'ALTER TABLE public.restore_drill_history ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now())';
  END IF;
END;
$block$;

DO $block$
BEGIN
  IF to_regclass('public.diagnostico_capilar') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnostico_capilar_porosidade_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD CONSTRAINT diagnostico_capilar_porosidade_check CHECK (porosidade BETWEEN 1 AND 5)';
  END IF;

  IF to_regclass('public.diagnostico_capilar') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnostico_capilar_elasticidade_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.diagnostico_capilar ADD CONSTRAINT diagnostico_capilar_elasticidade_check CHECK (elasticidade BETWEEN 1 AND 3)';
  END IF;

  IF to_regclass('public.manutencao_homecare') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manutencao_homecare_forma_pagamento_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.manutencao_homecare ADD CONSTRAINT manutencao_homecare_forma_pagamento_check CHECK (forma_pagamento IS NULL OR forma_pagamento IN (''normal'', ''avista'', ''parcelado''))';
  END IF;

  IF to_regclass('public.agendamentos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agendamentos_status_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.agendamentos ADD CONSTRAINT agendamentos_status_check CHECK (status IN (''agendado'', ''confirmado'', ''realizado'', ''cancelado'', ''faltou''))';
  END IF;

  IF to_regclass('public.agendamentos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agendamentos_origem_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.agendamentos ADD CONSTRAINT agendamentos_origem_check CHECK (origem IN (''interno'', ''google_calendar'', ''n8n'', ''manual''))';
  END IF;

  IF to_regclass('public.company_documents') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_documents_tamanho_bytes_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.company_documents ADD CONSTRAINT company_documents_tamanho_bytes_check CHECK (tamanho_bytes >= 0)';
  END IF;
END;
$block$;

DO $block$
BEGIN
  IF to_regclass('public.clientes') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clientes_user_deleted_updated ON public.clientes (user_id, deleted_at, updated_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clientes_portal_token ON public.clientes (portal_token)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clientes_pre_consulta_token ON public.clientes (token_pre_consulta)';
  END IF;

  IF to_regclass('public.client_photos') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_client_photos_cliente_deleted_created ON public.client_photos (cliente_id, deleted_at, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_client_photos_user_deleted_created ON public.client_photos (user_id, deleted_at, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_client_photos_storage_path ON public.client_photos (storage_path)';
  END IF;

  IF to_regclass('public.diagnostico_capilar') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_diagnostico_capilar_cliente_deleted_created ON public.diagnostico_capilar (cliente_id, deleted_at, created_at DESC)';
  END IF;

  IF to_regclass('public.historico_procedimentos') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_historico_procedimentos_cliente_deleted_created ON public.historico_procedimentos (cliente_id, deleted_at, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_historico_procedimentos_user_deleted_created ON public.historico_procedimentos (user_id, deleted_at, created_at DESC)';
  END IF;

  IF to_regclass('public.manutencao_homecare') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_manutencao_homecare_cliente_deleted_created ON public.manutencao_homecare (cliente_id, deleted_at, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_manutencao_homecare_user_deleted_created ON public.manutencao_homecare (user_id, deleted_at, created_at DESC)';
  END IF;

  IF to_regclass('public.ficha_anamnese_capilar') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_capilar_user_deleted_updated ON public.ficha_anamnese_capilar (user_id, deleted_at, updated_at DESC)';
    IF NOT EXISTS (
      SELECT 1
        FROM public.ficha_anamnese_capilar
       WHERE deleted_at IS NULL
       GROUP BY cliente_id
      HAVING COUNT(*) > 1
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_ficha_anamnese_capilar_cliente_unique ON public.ficha_anamnese_capilar (cliente_id) WHERE deleted_at IS NULL';
    ELSE
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_capilar_cliente_lookup ON public.ficha_anamnese_capilar (cliente_id)';
    END IF;
  END IF;

  IF to_regclass('public.agendamentos') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente_deleted_inicio ON public.agendamentos (cliente_id, deleted_at, inicio_em DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_agendamentos_user_deleted_inicio ON public.agendamentos (user_id, deleted_at, inicio_em DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_agendamentos_google_event ON public.agendamentos (google_event_id)';
  END IF;

  IF to_regclass('public.company_document_folders') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_company_document_folders_user_created ON public.company_document_folders (user_id, created_at ASC)';
  END IF;

  IF to_regclass('public.company_documents') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_company_documents_user_deleted_created ON public.company_documents (user_id, deleted_at, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_company_documents_folder_deleted_created ON public.company_documents (folder_id, deleted_at, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_company_documents_storage_path ON public.company_documents (storage_path)';
  END IF;

  IF to_regclass('public.clinic_preferences') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.clinic_preferences
       GROUP BY user_id, preference_key
      HAVING COUNT(*) > 1
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_clinic_preferences_user_key_unique ON public.clinic_preferences (user_id, preference_key)';
    ELSE
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clinic_preferences_user_key_lookup ON public.clinic_preferences (user_id, preference_key)';
    END IF;
  END IF;

  IF to_regclass('public.access_requests') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_access_requests_status_created ON public.access_requests (status, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_access_requests_email_lookup ON public.access_requests (email)';
  END IF;

  IF to_regclass('public.auth_verification_codes') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_auth_verification_codes_email_expires ON public.auth_verification_codes (email, expires_at DESC)';
  END IF;

  IF to_regclass('public.backup_run_history') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_backup_run_history_status_started ON public.backup_run_history (status, started_at DESC)';
  END IF;

  IF to_regclass('public.restore_drill_history') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_restore_drill_history_status_started ON public.restore_drill_history (status, started_at DESC)';
  END IF;
END;
$block$;

DO $block$
BEGIN
  IF to_regclass('public.client_photos') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_client_photos_sync_user_id ON public.client_photos';
    EXECUTE 'CREATE TRIGGER trg_client_photos_sync_user_id BEFORE INSERT OR UPDATE OF cliente_id ON public.client_photos FOR EACH ROW EXECUTE FUNCTION private.sync_child_user_id_from_client()';
  END IF;

  IF to_regclass('public.diagnostico_capilar') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_diagnostico_capilar_sync_user_id ON public.diagnostico_capilar';
    EXECUTE 'CREATE TRIGGER trg_diagnostico_capilar_sync_user_id BEFORE INSERT OR UPDATE OF cliente_id ON public.diagnostico_capilar FOR EACH ROW EXECUTE FUNCTION private.sync_child_user_id_from_client()';
  END IF;

  IF to_regclass('public.historico_procedimentos') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_historico_procedimentos_sync_user_id ON public.historico_procedimentos';
    EXECUTE 'CREATE TRIGGER trg_historico_procedimentos_sync_user_id BEFORE INSERT OR UPDATE OF cliente_id ON public.historico_procedimentos FOR EACH ROW EXECUTE FUNCTION private.sync_child_user_id_from_client()';
  END IF;

  IF to_regclass('public.manutencao_homecare') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_manutencao_homecare_sync_user_id ON public.manutencao_homecare';
    EXECUTE 'CREATE TRIGGER trg_manutencao_homecare_sync_user_id BEFORE INSERT OR UPDATE OF cliente_id ON public.manutencao_homecare FOR EACH ROW EXECUTE FUNCTION private.sync_child_user_id_from_client()';
  END IF;

  IF to_regclass('public.ficha_anamnese_capilar') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_ficha_anamnese_capilar_sync_user_id ON public.ficha_anamnese_capilar';
    EXECUTE 'CREATE TRIGGER trg_ficha_anamnese_capilar_sync_user_id BEFORE INSERT OR UPDATE OF cliente_id ON public.ficha_anamnese_capilar FOR EACH ROW EXECUTE FUNCTION private.sync_child_user_id_from_client()';
  END IF;

  IF to_regclass('public.agendamentos') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_agendamentos_sync_user_id ON public.agendamentos';
    EXECUTE 'CREATE TRIGGER trg_agendamentos_sync_user_id BEFORE INSERT OR UPDATE OF cliente_id ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION private.sync_child_user_id_from_client()';
  END IF;

  IF to_regclass('public.company_documents') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_company_documents_sync_user_id ON public.company_documents';
    EXECUTE 'CREATE TRIGGER trg_company_documents_sync_user_id BEFORE INSERT OR UPDATE OF folder_id ON public.company_documents FOR EACH ROW EXECUTE FUNCTION private.sync_document_user_id_from_folder()';
  END IF;
END;
$block$;

DO $block$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'clientes',
    'company_document_folders',
    'company_documents',
    'client_photos',
    'diagnostico_capilar',
    'historico_procedimentos',
    'manutencao_homecare',
    'ficha_anamnese_capilar',
    'agendamentos',
    'clinic_preferences',
    'access_requests',
    'auth_verification_codes',
    'backup_run_history',
    'restore_drill_history',
    'rate_limits'
  ]
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL AND EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = target_table
         AND column_name = 'updated_at'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON public.%I', target_table, target_table);
      EXECUTE format('CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', target_table, target_table);
    END IF;
  END LOOP;
END;
$block$;

DO $block$
BEGIN
  IF to_regclass('public.clientes') IS NOT NULL
     AND to_regclass('public.client_photos') IS NOT NULL
     AND to_regclass('public.diagnostico_capilar') IS NOT NULL
     AND to_regclass('public.historico_procedimentos') IS NOT NULL
     AND to_regclass('public.manutencao_homecare') IS NOT NULL
     AND to_regclass('public.agendamentos') IS NOT NULL THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW private.client_operational_summary
      WITH (security_invoker = true) AS
      SELECT
        client_row.id AS client_id,
        client_row.user_id,
        client_row.nome,
        client_row.whatsapp,
        client_row.created_at,
        client_row.updated_at,
        client_row.link_ativo AS pre_consulta_link_active,
        client_row.pre_consulta_respondida_em,
        client_row.portal_active,
        COALESCE(photo_totals.total_photos, 0) AS total_photos,
        COALESCE(diagnostic_totals.total_diagnostics, 0) AS total_diagnostics,
        COALESCE(procedure_totals.total_procedures, 0) AS total_procedures,
        COALESCE(homecare_totals.total_homecare, 0) AS total_homecare,
        COALESCE(appointment_totals.total_appointments, 0) AS total_appointments,
        appointment_totals.next_appointment_at,
        procedure_totals.last_procedure_at,
        homecare_totals.last_homecare_at
      FROM public.clientes client_row
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::bigint AS total_photos
        FROM public.client_photos child_row
        WHERE child_row.cliente_id = client_row.id
          AND child_row.deleted_at IS NULL
      ) photo_totals ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::bigint AS total_diagnostics
        FROM public.diagnostico_capilar child_row
        WHERE child_row.cliente_id = client_row.id
          AND child_row.deleted_at IS NULL
      ) diagnostic_totals ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::bigint AS total_procedures,
          MAX(child_row.created_at) AS last_procedure_at
        FROM public.historico_procedimentos child_row
        WHERE child_row.cliente_id = client_row.id
          AND child_row.deleted_at IS NULL
      ) procedure_totals ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::bigint AS total_homecare,
          MAX(child_row.created_at) AS last_homecare_at
        FROM public.manutencao_homecare child_row
        WHERE child_row.cliente_id = client_row.id
          AND child_row.deleted_at IS NULL
      ) homecare_totals ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::bigint AS total_appointments,
          MIN(child_row.inicio_em) FILTER (
            WHERE child_row.deleted_at IS NULL
              AND child_row.status IN ('agendado', 'confirmado')
              AND child_row.inicio_em >= timezone('utc', now())
          ) AS next_appointment_at
        FROM public.agendamentos child_row
        WHERE child_row.cliente_id = client_row.id
      ) appointment_totals ON true
      WHERE client_row.deleted_at IS NULL
    $view$;
  END IF;

  IF to_regclass('public.clientes') IS NOT NULL
     AND to_regclass('public.historico_procedimentos') IS NOT NULL
     AND to_regclass('public.manutencao_homecare') IS NOT NULL THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW private.client_financial_summary
      WITH (security_invoker = true) AS
      SELECT
        client_row.id AS client_id,
        client_row.user_id,
        client_row.nome,
        COALESCE(procedure_totals.procedure_revenue_total, 0::numeric) AS procedure_revenue_total,
        COALESCE(homecare_totals.homecare_revenue_total, 0::numeric) AS homecare_revenue_total,
        COALESCE(homecare_totals.homecare_revenue_paid, 0::numeric) AS homecare_revenue_paid,
        COALESCE(homecare_totals.homecare_revenue_pending, 0::numeric) AS homecare_revenue_pending,
        COALESCE(procedure_totals.total_procedures, 0) AS total_procedures,
        COALESCE(homecare_totals.total_homecare, 0) AS total_homecare
      FROM public.clientes client_row
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::bigint AS total_procedures,
          COALESCE(SUM(COALESCE(child_row.valor_procedimento, 0)), 0)::numeric AS procedure_revenue_total
        FROM public.historico_procedimentos child_row
        WHERE child_row.cliente_id = client_row.id
          AND child_row.deleted_at IS NULL
      ) procedure_totals ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::bigint AS total_homecare,
          COALESCE(SUM(COALESCE(child_row.valor_total, 0)), 0)::numeric AS homecare_revenue_total,
          COALESCE(SUM(COALESCE(child_row.valor_total, 0)) FILTER (WHERE child_row.pago IS TRUE), 0)::numeric AS homecare_revenue_paid,
          COALESCE(SUM(COALESCE(child_row.valor_total, 0)) FILTER (WHERE COALESCE(child_row.pago, false) IS FALSE), 0)::numeric AS homecare_revenue_pending
        FROM public.manutencao_homecare child_row
        WHERE child_row.cliente_id = client_row.id
          AND child_row.deleted_at IS NULL
      ) homecare_totals ON true
      WHERE client_row.deleted_at IS NULL
    $view$;
  END IF;
END;
$block$;

COMMIT;
