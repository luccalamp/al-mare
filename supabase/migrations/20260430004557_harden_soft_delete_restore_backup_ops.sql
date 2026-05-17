CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;

CREATE OR REPLACE FUNCTION private.extract_public_storage_path(public_url TEXT, bucket_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
	marker TEXT;
	marker_position INTEGER;
BEGIN
	IF public_url IS NULL OR bucket_name IS NULL OR bucket_name = '' THEN
		RETURN NULL;
	END IF;

	marker := '/storage/v1/object/public/' || bucket_name || '/';
	marker_position := position(marker IN public_url);

	IF marker_position = 0 THEN
		RETURN NULL;
	END IF;

	RETURN substring(public_url FROM marker_position + char_length(marker));
END;
$$;

REVOKE ALL ON FUNCTION private.extract_public_storage_path(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.extract_public_storage_path(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION private.extract_public_storage_path(TEXT, TEXT) FROM authenticated;

ALTER TABLE public.clientes
	ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS deleted_by TEXT,
	ADD COLUMN IF NOT EXISTS delete_reason TEXT,
	ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS restored_by TEXT,
	ADD COLUMN IF NOT EXISTS profile_photo_storage_bucket TEXT NOT NULL DEFAULT 'anamnese-fotos',
	ADD COLUMN IF NOT EXISTS profile_photo_storage_path TEXT,
	ADD COLUMN IF NOT EXISTS profile_photo_quarantined_bucket TEXT,
	ADD COLUMN IF NOT EXISTS profile_photo_quarantined_path TEXT;

UPDATE public.clientes
SET
	profile_photo_storage_bucket = COALESCE(profile_photo_storage_bucket, 'anamnese-fotos'),
	profile_photo_storage_path = COALESCE(
		profile_photo_storage_path,
		private.extract_public_storage_path(photo_url, 'anamnese-fotos')
	)
WHERE photo_url IS NOT NULL;

CREATE OR REPLACE FUNCTION private.is_client_active(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.clientes AS clientes
		WHERE clientes.id = target_client_id
			AND clientes.deleted_at IS NULL
	);
$$;

REVOKE ALL ON FUNCTION private.is_client_active(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_client_active(UUID) FROM anon;
REVOKE ALL ON FUNCTION private.is_client_active(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.is_client_active(UUID) TO anon;
GRANT EXECUTE ON FUNCTION private.is_client_active(UUID) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_clientes_deleted_at
	ON public.clientes (deleted_at)
	WHERE deleted_at IS NOT NULL;

ALTER TABLE public.client_photos
	ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS deleted_by TEXT,
	ADD COLUMN IF NOT EXISTS delete_reason TEXT,
	ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS restored_by TEXT,
	ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'anamnese-fotos',
	ADD COLUMN IF NOT EXISTS storage_path TEXT,
	ADD COLUMN IF NOT EXISTS quarantined_bucket TEXT,
	ADD COLUMN IF NOT EXISTS quarantined_storage_path TEXT;

UPDATE public.client_photos
SET
	storage_bucket = COALESCE(storage_bucket, 'anamnese-fotos'),
	storage_path = COALESCE(
		storage_path,
		private.extract_public_storage_path(url, 'anamnese-fotos')
	)
WHERE url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_photos_deleted_at
	ON public.client_photos (deleted_at)
	WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_photos_cliente_active
	ON public.client_photos (cliente_id, created_at DESC)
	WHERE deleted_at IS NULL;

ALTER TABLE public.company_documents
	ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS deleted_by TEXT,
	ADD COLUMN IF NOT EXISTS delete_reason TEXT,
	ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS restored_by TEXT,
	ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'company-documents',
	ADD COLUMN IF NOT EXISTS quarantined_bucket TEXT,
	ADD COLUMN IF NOT EXISTS quarantined_storage_path TEXT;

UPDATE public.company_documents
SET storage_bucket = COALESCE(storage_bucket, 'company-documents');

CREATE INDEX IF NOT EXISTS idx_company_documents_deleted_at
	ON public.company_documents (deleted_at)
	WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_documents_folder_active
	ON public.company_documents (folder_id, created_at DESC)
	WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.backup_run_history (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	trigger_source TEXT NOT NULL,
	destination TEXT NOT NULL,
	storage_bucket TEXT,
	storage_path TEXT,
	s3_bucket TEXT,
	s3_key TEXT,
	checksum TEXT,
	payload_bytes BIGINT NOT NULL DEFAULT 0,
	table_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
	started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	completed_at TIMESTAMPTZ,
	status TEXT NOT NULL DEFAULT 'running',
	error_message TEXT,
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	CONSTRAINT backup_run_history_status_check CHECK (status IN ('running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_backup_run_history_started_at
	ON public.backup_run_history (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_backup_run_history_status
	ON public.backup_run_history (status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.restore_drill_history (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	trigger_source TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'running',
	started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	completed_at TIMESTAMPTZ,
	latest_backup_run_id UUID REFERENCES public.backup_run_history(id) ON DELETE SET NULL,
	latest_backup_path TEXT,
	verified_transaction_id BIGINT,
	verified_record_identity JSONB,
	result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
	error_message TEXT,
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	CONSTRAINT restore_drill_history_status_check CHECK (status IN ('running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_restore_drill_history_started_at
	ON public.restore_drill_history (started_at DESC);

REVOKE ALL ON TABLE public.backup_run_history FROM PUBLIC;
REVOKE ALL ON TABLE public.backup_run_history FROM anon;
REVOKE ALL ON TABLE public.backup_run_history FROM authenticated;

REVOKE ALL ON TABLE public.restore_drill_history FROM PUBLIC;
REVOKE ALL ON TABLE public.restore_drill_history FROM anon;
REVOKE ALL ON TABLE public.restore_drill_history FROM authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
	'recovery-quarantine',
	'recovery-quarantine',
	false,
	52428800,
	ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/json', 'text/plain']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
		file_size_limit = EXCLUDED.file_size_limit,
		allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
	'ops-backups',
	'ops-backups',
	false,
	262144000,
	ARRAY['application/json', 'application/gzip', 'text/plain']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
		file_size_limit = EXCLUDED.file_size_limit,
		allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.admin_list_row_change_audit(
	p_table_name TEXT DEFAULT NULL,
	p_record_identity JSONB DEFAULT NULL,
	p_transaction_id BIGINT DEFAULT NULL,
	p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
	audit_id BIGINT,
	table_name TEXT,
	operation TEXT,
	changed_at TIMESTAMPTZ,
	transaction_id BIGINT,
	jwt_subject TEXT,
	jwt_role TEXT,
	record_identity JSONB,
	old_record JSONB,
	new_record JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT
		audit.id AS audit_id,
		audit.table_name,
		audit.operation,
		audit.changed_at,
		audit.transaction_id,
		audit.jwt_subject,
		audit.jwt_role,
		audit.record_identity,
		audit.old_record,
		audit.new_record
	FROM private.row_change_audit AS audit
	WHERE (p_table_name IS NULL OR audit.table_name = p_table_name)
		AND (p_transaction_id IS NULL OR audit.transaction_id = p_transaction_id)
		AND (p_record_identity IS NULL OR audit.record_identity @> p_record_identity)
	ORDER BY audit.changed_at DESC, audit.id DESC
	LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
$$;

REVOKE ALL ON FUNCTION public.admin_list_row_change_audit(TEXT, JSONB, BIGINT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_row_change_audit(TEXT, JSONB, BIGINT, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.admin_list_row_change_audit(TEXT, JSONB, BIGINT, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_row_change_audit(TEXT, JSONB, BIGINT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.submit_pre_consultation(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_pre_consultation(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.submit_pre_consultation(UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_pre_consultation(UUID, JSONB) TO service_role;

DROP POLICY IF EXISTS "allow_all_agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "allow_all_for_photos" ON public.client_photos;
DROP POLICY IF EXISTS "allow_all_for_basic" ON public.clientes;
DROP POLICY IF EXISTS "allow_all_clinic_preferences" ON public.clinic_preferences;
DROP POLICY IF EXISTS "allow_all_company_document_folders" ON public.company_document_folders;
DROP POLICY IF EXISTS "allow_all_company_documents" ON public.company_documents;
DROP POLICY IF EXISTS "allow_all_for_diagnosis" ON public.diagnostico_capilar;
DROP POLICY IF EXISTS "allow_all_ficha_anamnese" ON public.ficha_anamnese_capilar;
DROP POLICY IF EXISTS "owner_only_formulas" ON public.historico_procedimentos;
DROP POLICY IF EXISTS "no_anon_formulas" ON public.historico_procedimentos;
DROP POLICY IF EXISTS "allow_all_manutencao_homecare" ON public.manutencao_homecare;
DROP POLICY IF EXISTS "authenticated_pre_consulta_envios" ON public.pre_consulta_envios;
DROP POLICY IF EXISTS "allow_authenticated_all" ON public.services;

CREATE POLICY "clientes_select_active" ON public.clientes
	FOR SELECT TO anon, authenticated
	USING (deleted_at IS NULL);

CREATE POLICY "clientes_insert_active" ON public.clientes
	FOR INSERT TO anon, authenticated
	WITH CHECK (
		deleted_at IS NULL
		AND char_length(btrim(nome)) > 0
		AND char_length(btrim(whatsapp)) > 0
	);

CREATE POLICY "clientes_update_active" ON public.clientes
	FOR UPDATE TO anon, authenticated
	USING (deleted_at IS NULL)
	WITH CHECK (
		char_length(btrim(nome)) > 0
		AND char_length(btrim(whatsapp)) > 0
		AND (deleted_at IS NULL OR deleted_at >= created_at)
	);

CREATE POLICY "client_photos_select_active" ON public.client_photos
	FOR SELECT TO anon, authenticated
	USING (
		deleted_at IS NULL
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "client_photos_insert_active" ON public.client_photos
	FOR INSERT TO anon, authenticated
	WITH CHECK (
		deleted_at IS NULL
		AND cliente_id IS NOT NULL
		AND COALESCE(storage_bucket, '') <> ''
		AND COALESCE(storage_path, '') <> ''
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "client_photos_update_active" ON public.client_photos
	FOR UPDATE TO anon, authenticated
	USING (
		deleted_at IS NULL
		AND (SELECT private.is_client_active(cliente_id))
	)
	WITH CHECK (
		cliente_id IS NOT NULL
		AND COALESCE(storage_bucket, '') <> ''
		AND COALESCE(storage_path, '') <> ''
		AND (
			(deleted_at IS NULL AND (SELECT private.is_client_active(cliente_id)))
			OR (deleted_at IS NOT NULL AND COALESCE(quarantined_storage_path, '') <> '' AND COALESCE(quarantined_bucket, '') <> '')
		)
	);

CREATE POLICY "clinic_preferences_select" ON public.clinic_preferences
	FOR SELECT TO anon, authenticated
	USING (char_length(btrim(preference_key)) > 0);

CREATE POLICY "clinic_preferences_insert" ON public.clinic_preferences
	FOR INSERT TO anon, authenticated
	WITH CHECK (
		char_length(btrim(preference_key)) > 0
		AND jsonb_typeof(payload) = 'object'
	);

CREATE POLICY "clinic_preferences_update" ON public.clinic_preferences
	FOR UPDATE TO anon, authenticated
	USING (char_length(btrim(preference_key)) > 0)
	WITH CHECK (
		char_length(btrim(preference_key)) > 0
		AND jsonb_typeof(payload) = 'object'
	);

CREATE POLICY "company_document_folders_select" ON public.company_document_folders
	FOR SELECT TO anon, authenticated
	USING (char_length(btrim(nome)) > 0);

CREATE POLICY "company_document_folders_insert" ON public.company_document_folders
	FOR INSERT TO anon, authenticated
	WITH CHECK (char_length(btrim(nome)) > 0);

CREATE POLICY "company_document_folders_update" ON public.company_document_folders
	FOR UPDATE TO anon, authenticated
	USING (char_length(btrim(nome)) > 0)
	WITH CHECK (char_length(btrim(nome)) > 0);

CREATE POLICY "company_documents_select_active" ON public.company_documents
	FOR SELECT TO anon, authenticated
	USING (deleted_at IS NULL);

CREATE POLICY "company_documents_insert_active" ON public.company_documents
	FOR INSERT TO anon, authenticated
	WITH CHECK (
		deleted_at IS NULL
		AND folder_id IS NOT NULL
		AND COALESCE(storage_bucket, '') <> ''
		AND COALESCE(storage_path, '') <> ''
		AND COALESCE(public_url, '') <> ''
	);

CREATE POLICY "company_documents_update_active" ON public.company_documents
	FOR UPDATE TO anon, authenticated
	USING (deleted_at IS NULL)
	WITH CHECK (
		folder_id IS NOT NULL
		AND COALESCE(storage_bucket, '') <> ''
		AND COALESCE(storage_path, '') <> ''
		AND (
			deleted_at IS NULL
			OR (COALESCE(quarantined_storage_path, '') <> '' AND COALESCE(quarantined_bucket, '') <> '')
		)
	);

CREATE POLICY "diagnostico_capilar_select_active_client" ON public.diagnostico_capilar
	FOR SELECT TO anon, authenticated
	USING ((SELECT private.is_client_active(cliente_id)));

CREATE POLICY "diagnostico_capilar_insert_active_client" ON public.diagnostico_capilar
	FOR INSERT TO anon, authenticated
	WITH CHECK (
		cliente_id IS NOT NULL
		AND elasticidade BETWEEN 1 AND 3
		AND porosidade BETWEEN 1 AND 5
		AND char_length(COALESCE(resultado_teste_mecha, '')) > 0
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "diagnostico_capilar_update_active_client" ON public.diagnostico_capilar
	FOR UPDATE TO anon, authenticated
	USING ((SELECT private.is_client_active(cliente_id)))
	WITH CHECK (
		cliente_id IS NOT NULL
		AND elasticidade BETWEEN 1 AND 3
		AND porosidade BETWEEN 1 AND 5
		AND char_length(COALESCE(resultado_teste_mecha, '')) > 0
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "ficha_anamnese_select_active_client" ON public.ficha_anamnese_capilar
	FOR SELECT TO anon, authenticated
	USING ((SELECT private.is_client_active(cliente_id)));

CREATE POLICY "ficha_anamnese_insert_active_client" ON public.ficha_anamnese_capilar
	FOR INSERT TO anon, authenticated
	WITH CHECK (
		cliente_id IS NOT NULL
		AND jsonb_typeof(dados) = 'object'
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "ficha_anamnese_update_active_client" ON public.ficha_anamnese_capilar
	FOR UPDATE TO anon, authenticated
	USING ((SELECT private.is_client_active(cliente_id)))
	WITH CHECK (
		cliente_id IS NOT NULL
		AND jsonb_typeof(dados) = 'object'
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "historico_procedimentos_select_active_client" ON public.historico_procedimentos
	FOR SELECT TO anon, authenticated
	USING ((SELECT private.is_client_active(cliente_id)));

CREATE POLICY "historico_procedimentos_insert_active_client" ON public.historico_procedimentos
	FOR INSERT TO anon, authenticated
	WITH CHECK (
		cliente_id IS NOT NULL
		AND char_length(btrim(tecnica_utilizada)) > 0
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "historico_procedimentos_update_active_client" ON public.historico_procedimentos
	FOR UPDATE TO anon, authenticated
	USING ((SELECT private.is_client_active(cliente_id)))
	WITH CHECK (
		cliente_id IS NOT NULL
		AND char_length(btrim(tecnica_utilizada)) > 0
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "manutencao_homecare_select_active_client" ON public.manutencao_homecare
	FOR SELECT TO anon, authenticated
	USING ((SELECT private.is_client_active(cliente_id)));

CREATE POLICY "manutencao_homecare_insert_active_client" ON public.manutencao_homecare
	FOR INSERT TO anon, authenticated
	WITH CHECK (
		cliente_id IS NOT NULL
		AND char_length(btrim(produtos_recomendados)) > 0
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "manutencao_homecare_update_active_client" ON public.manutencao_homecare
	FOR UPDATE TO anon, authenticated
	USING ((SELECT private.is_client_active(cliente_id)))
	WITH CHECK (
		cliente_id IS NOT NULL
		AND char_length(btrim(produtos_recomendados)) > 0
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "agendamentos_select_active_client" ON public.agendamentos
	FOR SELECT TO anon, authenticated
	USING (
		cliente_id IS NULL OR (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "agendamentos_insert_active_client" ON public.agendamentos
	FOR INSERT TO anon, authenticated
	WITH CHECK (
		char_length(btrim(titulo)) > 0
		AND fim_em > inicio_em
		AND (cliente_id IS NULL OR (SELECT private.is_client_active(cliente_id)))
	);

CREATE POLICY "agendamentos_update_active_client" ON public.agendamentos
	FOR UPDATE TO anon, authenticated
	USING (
		cliente_id IS NULL OR (SELECT private.is_client_active(cliente_id))
	)
	WITH CHECK (
		char_length(btrim(titulo)) > 0
		AND fim_em > inicio_em
		AND (cliente_id IS NULL OR (SELECT private.is_client_active(cliente_id)))
	);

CREATE POLICY "pre_consulta_envios_select_active_client" ON public.pre_consulta_envios
	FOR SELECT TO authenticated
	USING ((SELECT private.is_client_active(cliente_id)));

CREATE POLICY "pre_consulta_envios_insert_active_client" ON public.pre_consulta_envios
	FOR INSERT TO authenticated
	WITH CHECK (
		cliente_id IS NOT NULL
		AND jsonb_typeof(payload) = 'object'
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "pre_consulta_envios_update_active_client" ON public.pre_consulta_envios
	FOR UPDATE TO authenticated
	USING ((SELECT private.is_client_active(cliente_id)))
	WITH CHECK (
		cliente_id IS NOT NULL
		AND jsonb_typeof(payload) = 'object'
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "services_select_catalog" ON public.services
	FOR SELECT TO anon, authenticated
	USING (char_length(btrim(name)) > 0);

CREATE POLICY "services_insert_catalog" ON public.services
	FOR INSERT TO authenticated
	WITH CHECK (
		char_length(btrim(name)) > 0
		AND duration_minutes > 0
		AND price >= 0
	);

CREATE POLICY "services_update_catalog" ON public.services
	FOR UPDATE TO authenticated
	USING (char_length(btrim(name)) > 0)
	WITH CHECK (
		char_length(btrim(name)) > 0
		AND duration_minutes > 0
		AND price >= 0
	);
