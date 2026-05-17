ALTER TABLE public.clientes
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.client_photos
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.ficha_anamnese_capilar
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.agendamentos
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.pre_consulta_envios
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.diagnostico_capilar
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.historico_procedimentos
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.manutencao_homecare
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.company_document_folders
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.company_documents
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.services
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION private.current_user_primary_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT om.organization_id
	FROM public.organization_members AS om
	JOIN public.organizations AS org
		ON org.id = om.organization_id
	WHERE om.user_id = (SELECT auth.uid())
		AND om.is_active = TRUE
		AND org.is_active = TRUE
	ORDER BY
		CASE om.role
			WHEN 'owner' THEN 0
			WHEN 'admin' THEN 1
			ELSE 2
		END,
		om.created_at ASC,
		org.created_at ASC
	LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.can_access_organization(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT (
		(SELECT auth.uid()) IS NULL
		OR COALESCE((SELECT auth.role()), '') = 'service_role'
		OR private.is_organization_member(target_organization_id)
	);
$$;

CREATE OR REPLACE FUNCTION private.resolve_client_organization_id(target_client_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT c.organization_id
	FROM public.clientes AS c
	WHERE c.id = target_client_id
	LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.resolve_company_document_folder_organization_id(target_folder_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT folder.organization_id
	FROM public.company_document_folders AS folder
	WHERE folder.id = target_folder_id
	LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.current_user_primary_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_user_primary_organization_id() FROM anon;
GRANT EXECUTE ON FUNCTION private.current_user_primary_organization_id() TO authenticated;

REVOKE ALL ON FUNCTION private.can_access_organization(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_organization(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.can_access_organization(UUID) TO authenticated;

REVOKE ALL ON FUNCTION private.resolve_client_organization_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.resolve_client_organization_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.resolve_client_organization_id(UUID) TO authenticated;

REVOKE ALL ON FUNCTION private.resolve_company_document_folder_organization_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.resolve_company_document_folder_organization_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.resolve_company_document_folder_organization_id(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION private.ensure_default_company_folder(target_organization_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	ensured_folder_id UUID;
BEGIN
	SELECT folder.id
	INTO ensured_folder_id
	FROM public.company_document_folders AS folder
	WHERE folder.organization_id = target_organization_id
		AND LOWER(folder.nome) = 'geral'
	LIMIT 1;

	IF ensured_folder_id IS NOT NULL THEN
		RETURN ensured_folder_id;
	END IF;

	INSERT INTO public.company_document_folders (organization_id, nome)
	SELECT target_organization_id, 'Geral'
	WHERE NOT EXISTS (
		SELECT 1
		FROM public.company_document_folders AS folder
		WHERE folder.organization_id = target_organization_id
			AND LOWER(folder.nome) = 'geral'
	)
	RETURNING id INTO ensured_folder_id;

	IF ensured_folder_id IS NOT NULL THEN
		RETURN ensured_folder_id;
	END IF;

	SELECT folder.id
	INTO ensured_folder_id
	FROM public.company_document_folders AS folder
	WHERE folder.organization_id = target_organization_id
		AND LOWER(folder.nome) = 'geral'
	LIMIT 1;

	RETURN ensured_folder_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.provision_organization_for_user(
	target_user_id UUID,
	target_email TEXT,
	target_display_name TEXT DEFAULT NULL,
	seed_default_folder BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	existing_organization_id UUID;
	generated_slug TEXT;
	generated_name TEXT;
BEGIN
	SELECT om.organization_id
	INTO existing_organization_id
	FROM public.organization_members AS om
	JOIN public.organizations AS org
		ON org.id = om.organization_id
	WHERE om.user_id = target_user_id
		AND om.is_active = TRUE
		AND org.is_active = TRUE
	ORDER BY
		CASE om.role
			WHEN 'owner' THEN 0
			WHEN 'admin' THEN 1
			ELSE 2
		END,
		om.created_at ASC,
		org.created_at ASC
	LIMIT 1;

	IF existing_organization_id IS NOT NULL THEN
		IF seed_default_folder THEN
			PERFORM private.ensure_default_company_folder(existing_organization_id);
		END IF;
		RETURN existing_organization_id;
	END IF;

	generated_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(target_email, target_user_id::TEXT), '@', 1), '[^a-z0-9]+', '-', 'g'));
	generated_slug := REGEXP_REPLACE(generated_slug, '(^-+|-+$)', '', 'g');
	IF generated_slug = '' THEN
		generated_slug := 'empresa';
	END IF;
	generated_slug := LEFT(generated_slug, 40) || '-' || LEFT(REPLACE(target_user_id::TEXT, '-', ''), 8);

	generated_name := COALESCE(
		NULLIF(BTRIM(target_display_name), ''),
		NULLIF(BTRIM(SPLIT_PART(COALESCE(target_email, ''), '@', 1)), ''),
		'Empresa'
	);
	generated_name := INITCAP(REPLACE(REPLACE(REPLACE(generated_name, '.', ' '), '-', ' '), '_', ' '));

	INSERT INTO public.organizations (nome, slug, metadata)
	VALUES (
		generated_name,
		generated_slug,
		jsonb_strip_nulls(
			jsonb_build_object(
				'provisioned_from_email', NULLIF(target_email, ''),
				'provisioned_for_user_id', target_user_id
			)
		)
	)
	RETURNING id INTO existing_organization_id;

	INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
	VALUES (existing_organization_id, target_user_id, 'owner', TRUE)
	ON CONFLICT (organization_id, user_id)
	DO UPDATE SET
		role = 'owner',
		is_active = TRUE,
		updated_at = NOW();

	IF seed_default_folder THEN
		PERFORM private.ensure_default_company_folder(existing_organization_id);
	END IF;

	RETURN existing_organization_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.handle_new_auth_user_tenant_provisioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	PERFORM private.provision_organization_for_user(
		NEW.id,
		NEW.email,
		COALESCE(
			NEW.raw_user_meta_data ->> 'clinicName',
			NEW.raw_user_meta_data ->> 'clinic_name',
			NEW.raw_user_meta_data ->> 'company',
			NEW.raw_user_meta_data ->> 'company_name',
			NEW.raw_user_meta_data ->> 'full_name'
		),
		TRUE
	);
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_current_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	resolved_organization_id UUID;
BEGIN
	resolved_organization_id := COALESCE(NEW.organization_id, private.current_user_primary_organization_id());

	IF resolved_organization_id IS NULL THEN
		RAISE EXCEPTION 'organization_context_required';
	END IF;

	IF NOT private.can_access_organization(resolved_organization_id) THEN
		RAISE EXCEPTION 'not_authorized_for_organization';
	END IF;

	NEW.organization_id := resolved_organization_id;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_client_child_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	resolved_organization_id UUID;
BEGIN
	IF NEW.cliente_id IS NULL THEN
		RAISE EXCEPTION 'client_id_required_for_tenant_binding';
	END IF;

	resolved_organization_id := private.resolve_client_organization_id(NEW.cliente_id);
	IF resolved_organization_id IS NULL THEN
		RAISE EXCEPTION 'client_organization_not_found';
	END IF;

	IF NEW.organization_id IS NOT NULL AND NEW.organization_id <> resolved_organization_id THEN
		RAISE EXCEPTION 'organization_mismatch_with_client';
	END IF;

	IF NOT private.can_access_organization(resolved_organization_id) THEN
		RAISE EXCEPTION 'not_authorized_for_organization';
	END IF;

	NEW.organization_id := resolved_organization_id;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_agendamento_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	resolved_organization_id UUID;
BEGIN
	IF NEW.cliente_id IS NOT NULL THEN
		resolved_organization_id := private.resolve_client_organization_id(NEW.cliente_id);
		IF resolved_organization_id IS NULL THEN
			RAISE EXCEPTION 'client_organization_not_found';
		END IF;
	ELSE
		resolved_organization_id := COALESCE(NEW.organization_id, private.current_user_primary_organization_id());
	END IF;

	IF resolved_organization_id IS NULL THEN
		RAISE EXCEPTION 'organization_context_required';
	END IF;

	IF NEW.organization_id IS NOT NULL AND NEW.organization_id <> resolved_organization_id THEN
		RAISE EXCEPTION 'organization_mismatch_with_client';
	END IF;

	IF NOT private.can_access_organization(resolved_organization_id) THEN
		RAISE EXCEPTION 'not_authorized_for_organization';
	END IF;

	NEW.organization_id := resolved_organization_id;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_company_document_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	resolved_organization_id UUID;
BEGIN
	IF NEW.folder_id IS NULL THEN
		RAISE EXCEPTION 'folder_id_required_for_tenant_binding';
	END IF;

	resolved_organization_id := private.resolve_company_document_folder_organization_id(NEW.folder_id);
	IF resolved_organization_id IS NULL THEN
		RAISE EXCEPTION 'folder_organization_not_found';
	END IF;

	IF NEW.organization_id IS NOT NULL AND NEW.organization_id <> resolved_organization_id THEN
		RAISE EXCEPTION 'organization_mismatch_with_folder';
	END IF;

	IF NOT private.can_access_organization(resolved_organization_id) THEN
		RAISE EXCEPTION 'not_authorized_for_organization';
	END IF;

	NEW.organization_id := resolved_organization_id;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_assign_organization_id ON public.clientes;
CREATE TRIGGER trg_clientes_assign_organization_id
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION private.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_client_photos_assign_organization_id ON public.client_photos;
CREATE TRIGGER trg_client_photos_assign_organization_id
BEFORE INSERT OR UPDATE ON public.client_photos
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_organization_id();

DROP TRIGGER IF EXISTS trg_ficha_anamnese_assign_organization_id ON public.ficha_anamnese_capilar;
CREATE TRIGGER trg_ficha_anamnese_assign_organization_id
BEFORE INSERT OR UPDATE ON public.ficha_anamnese_capilar
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_organization_id();

DROP TRIGGER IF EXISTS trg_diagnostico_capilar_assign_organization_id ON public.diagnostico_capilar;
CREATE TRIGGER trg_diagnostico_capilar_assign_organization_id
BEFORE INSERT OR UPDATE ON public.diagnostico_capilar
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_organization_id();

DROP TRIGGER IF EXISTS trg_historico_procedimentos_assign_organization_id ON public.historico_procedimentos;
CREATE TRIGGER trg_historico_procedimentos_assign_organization_id
BEFORE INSERT OR UPDATE ON public.historico_procedimentos
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_organization_id();

DROP TRIGGER IF EXISTS trg_manutencao_homecare_assign_organization_id ON public.manutencao_homecare;
CREATE TRIGGER trg_manutencao_homecare_assign_organization_id
BEFORE INSERT OR UPDATE ON public.manutencao_homecare
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_organization_id();

DROP TRIGGER IF EXISTS trg_agendamentos_assign_organization_id ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_assign_organization_id
BEFORE INSERT OR UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION private.assign_agendamento_organization_id();

DROP TRIGGER IF EXISTS trg_pre_consulta_envios_assign_organization_id ON public.pre_consulta_envios;
CREATE TRIGGER trg_pre_consulta_envios_assign_organization_id
BEFORE INSERT OR UPDATE ON public.pre_consulta_envios
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_organization_id();

DROP TRIGGER IF EXISTS trg_company_document_folders_assign_organization_id ON public.company_document_folders;
CREATE TRIGGER trg_company_document_folders_assign_organization_id
BEFORE INSERT OR UPDATE ON public.company_document_folders
FOR EACH ROW
EXECUTE FUNCTION private.assign_current_organization_id();

DROP TRIGGER IF EXISTS trg_company_documents_assign_organization_id ON public.company_documents;
CREATE TRIGGER trg_company_documents_assign_organization_id
BEFORE INSERT OR UPDATE ON public.company_documents
FOR EACH ROW
EXECUTE FUNCTION private.assign_company_document_organization_id();

DROP TRIGGER IF EXISTS trg_services_assign_organization_id ON public.services;
CREATE TRIGGER trg_services_assign_organization_id
BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION private.assign_current_organization_id();

DO $$
DECLARE
	legacy_organization_id UUID;
	auth_user RECORD;
BEGIN
	FOR auth_user IN
		SELECT
			user_row.id,
			user_row.email,
			COALESCE(
				user_row.raw_user_meta_data ->> 'clinicName',
				user_row.raw_user_meta_data ->> 'clinic_name',
				user_row.raw_user_meta_data ->> 'company',
				user_row.raw_user_meta_data ->> 'company_name',
				user_row.raw_user_meta_data ->> 'full_name'
			) AS display_name
		FROM auth.users AS user_row
	LOOP
		PERFORM private.provision_organization_for_user(auth_user.id, auth_user.email, auth_user.display_name, FALSE);
	END LOOP;

	SELECT om.organization_id
	INTO legacy_organization_id
	FROM public.organization_members AS om
	JOIN auth.users AS user_row
		ON user_row.id = om.user_id
	JOIN public.organizations AS org
		ON org.id = om.organization_id
	WHERE om.is_active = TRUE
		AND org.is_active = TRUE
	ORDER BY user_row.created_at ASC, om.created_at ASC
	LIMIT 1;

	IF legacy_organization_id IS NULL THEN
		RAISE EXCEPTION 'legacy_organization_bootstrap_failed';
	END IF;

	UPDATE public.clientes AS cliente
	SET organization_id = legacy_organization_id
	WHERE cliente.organization_id IS NULL;

	UPDATE public.client_photos AS photo
	SET organization_id = cliente.organization_id
	FROM public.clientes AS cliente
	WHERE photo.cliente_id = cliente.id
		AND photo.organization_id IS DISTINCT FROM cliente.organization_id;

	UPDATE public.ficha_anamnese_capilar AS ficha
	SET organization_id = cliente.organization_id
	FROM public.clientes AS cliente
	WHERE ficha.cliente_id = cliente.id
		AND ficha.organization_id IS DISTINCT FROM cliente.organization_id;

	UPDATE public.diagnostico_capilar AS diagnostico
	SET organization_id = cliente.organization_id
	FROM public.clientes AS cliente
	WHERE diagnostico.cliente_id = cliente.id
		AND diagnostico.organization_id IS DISTINCT FROM cliente.organization_id;

	UPDATE public.historico_procedimentos AS historico
	SET organization_id = cliente.organization_id
	FROM public.clientes AS cliente
	WHERE historico.cliente_id = cliente.id
		AND historico.organization_id IS DISTINCT FROM cliente.organization_id;

	UPDATE public.manutencao_homecare AS homecare
	SET organization_id = cliente.organization_id
	FROM public.clientes AS cliente
	WHERE homecare.cliente_id = cliente.id
		AND homecare.organization_id IS DISTINCT FROM cliente.organization_id;

	UPDATE public.pre_consulta_envios AS envio
	SET organization_id = cliente.organization_id
	FROM public.clientes AS cliente
	WHERE envio.cliente_id = cliente.id
		AND envio.organization_id IS DISTINCT FROM cliente.organization_id;

	UPDATE public.agendamentos AS agendamento
	SET organization_id = cliente.organization_id
	FROM public.clientes AS cliente
	WHERE agendamento.cliente_id = cliente.id
		AND agendamento.organization_id IS DISTINCT FROM cliente.organization_id;

	UPDATE public.agendamentos AS agendamento
	SET organization_id = legacy_organization_id
	WHERE agendamento.organization_id IS NULL;

	UPDATE public.company_document_folders AS folder
	SET organization_id = legacy_organization_id
	WHERE folder.organization_id IS NULL;

	UPDATE public.company_documents AS document
	SET organization_id = folder.organization_id
	FROM public.company_document_folders AS folder
	WHERE document.folder_id = folder.id
		AND document.organization_id IS DISTINCT FROM folder.organization_id;

	UPDATE public.services AS service
	SET organization_id = legacy_organization_id
	WHERE service.organization_id IS NULL;

	DROP INDEX IF EXISTS public.idx_company_document_folders_nome_unique;
	CREATE UNIQUE INDEX idx_company_document_folders_nome_unique
		ON public.company_document_folders (organization_id, LOWER(nome));

	PERFORM private.ensure_default_company_folder(org.id)
	FROM public.organizations AS org
	WHERE org.is_active = TRUE;
END;
$$;

ALTER TABLE public.clientes
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.client_photos
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.ficha_anamnese_capilar
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.agendamentos
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.pre_consulta_envios
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.diagnostico_capilar
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.historico_procedimentos
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.manutencao_homecare
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.company_document_folders
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.company_documents
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.services
	ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_organization_id
	ON public.clientes (organization_id);

CREATE INDEX IF NOT EXISTS idx_client_photos_organization_id
	ON public.client_photos (organization_id);

CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_organization_id
	ON public.ficha_anamnese_capilar (organization_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_organization_id
	ON public.agendamentos (organization_id);

CREATE INDEX IF NOT EXISTS idx_pre_consulta_envios_organization_id
	ON public.pre_consulta_envios (organization_id);

CREATE INDEX IF NOT EXISTS idx_diagnostico_capilar_organization_id
	ON public.diagnostico_capilar (organization_id);

CREATE INDEX IF NOT EXISTS idx_historico_procedimentos_organization_id
	ON public.historico_procedimentos (organization_id);

CREATE INDEX IF NOT EXISTS idx_manutencao_homecare_organization_id
	ON public.manutencao_homecare (organization_id);

CREATE INDEX IF NOT EXISTS idx_company_document_folders_organization_id
	ON public.company_document_folders (organization_id);

CREATE INDEX IF NOT EXISTS idx_company_documents_organization_id
	ON public.company_documents (organization_id);

CREATE INDEX IF NOT EXISTS idx_services_organization_id
	ON public.services (organization_id);

ALTER TABLE public.diagnostico_capilar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencao_homecare ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_select_active" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert_active" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update_active" ON public.clientes;
DROP POLICY IF EXISTS "client_photos_select_active" ON public.client_photos;
DROP POLICY IF EXISTS "client_photos_insert_active" ON public.client_photos;
DROP POLICY IF EXISTS "client_photos_update_active" ON public.client_photos;
DROP POLICY IF EXISTS "company_document_folders_select" ON public.company_document_folders;
DROP POLICY IF EXISTS "company_document_folders_insert" ON public.company_document_folders;
DROP POLICY IF EXISTS "company_document_folders_update" ON public.company_document_folders;
DROP POLICY IF EXISTS "company_documents_select_active" ON public.company_documents;
DROP POLICY IF EXISTS "company_documents_insert_active" ON public.company_documents;
DROP POLICY IF EXISTS "company_documents_update_active" ON public.company_documents;
DROP POLICY IF EXISTS "diagnostico_capilar_select_active_client" ON public.diagnostico_capilar;
DROP POLICY IF EXISTS "diagnostico_capilar_insert_active_client" ON public.diagnostico_capilar;
DROP POLICY IF EXISTS "diagnostico_capilar_update_active_client" ON public.diagnostico_capilar;
DROP POLICY IF EXISTS "ficha_anamnese_select_active_client" ON public.ficha_anamnese_capilar;
DROP POLICY IF EXISTS "ficha_anamnese_insert_active_client" ON public.ficha_anamnese_capilar;
DROP POLICY IF EXISTS "ficha_anamnese_update_active_client" ON public.ficha_anamnese_capilar;
DROP POLICY IF EXISTS "historico_procedimentos_select_active_client" ON public.historico_procedimentos;
DROP POLICY IF EXISTS "historico_procedimentos_insert_active_client" ON public.historico_procedimentos;
DROP POLICY IF EXISTS "historico_procedimentos_update_active_client" ON public.historico_procedimentos;
DROP POLICY IF EXISTS "manutencao_homecare_select_active_client" ON public.manutencao_homecare;
DROP POLICY IF EXISTS "manutencao_homecare_insert_active_client" ON public.manutencao_homecare;
DROP POLICY IF EXISTS "manutencao_homecare_update_active_client" ON public.manutencao_homecare;
DROP POLICY IF EXISTS "agendamentos_select_active_client" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_insert_active_client" ON public.agendamentos;
DROP POLICY IF EXISTS "agendamentos_update_active_client" ON public.agendamentos;
DROP POLICY IF EXISTS "pre_consulta_envios_select_active_client" ON public.pre_consulta_envios;
DROP POLICY IF EXISTS "pre_consulta_envios_insert_active_client" ON public.pre_consulta_envios;
DROP POLICY IF EXISTS "pre_consulta_envios_update_active_client" ON public.pre_consulta_envios;
DROP POLICY IF EXISTS "services_select_catalog" ON public.services;
DROP POLICY IF EXISTS "services_insert_catalog" ON public.services;
DROP POLICY IF EXISTS "services_update_catalog" ON public.services;

CREATE POLICY "clientes_select_active" ON public.clientes
	FOR SELECT TO authenticated
	USING (
		deleted_at IS NULL
		AND private.is_organization_member(organization_id)
	);

CREATE POLICY "clientes_insert_active" ON public.clientes
	FOR INSERT TO authenticated
	WITH CHECK (
		deleted_at IS NULL
		AND char_length(btrim(nome)) > 0
		AND char_length(btrim(whatsapp)) > 0
		AND private.is_organization_member(organization_id)
	);

CREATE POLICY "clientes_update_active" ON public.clientes
	FOR UPDATE TO authenticated
	USING (
		deleted_at IS NULL
		AND private.is_organization_member(organization_id)
	)
	WITH CHECK (
		char_length(btrim(nome)) > 0
		AND char_length(btrim(whatsapp)) > 0
		AND (deleted_at IS NULL OR deleted_at >= created_at)
		AND private.is_organization_member(organization_id)
	);

CREATE POLICY "client_photos_select_active" ON public.client_photos
	FOR SELECT TO authenticated
	USING (
		deleted_at IS NULL
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "client_photos_insert_active" ON public.client_photos
	FOR INSERT TO authenticated
	WITH CHECK (
		deleted_at IS NULL
		AND cliente_id IS NOT NULL
		AND COALESCE(storage_bucket, '') <> ''
		AND COALESCE(storage_path, '') <> ''
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "client_photos_update_active" ON public.client_photos
	FOR UPDATE TO authenticated
	USING (
		deleted_at IS NULL
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	)
	WITH CHECK (
		cliente_id IS NOT NULL
		AND COALESCE(storage_bucket, '') <> ''
		AND COALESCE(storage_path, '') <> ''
		AND private.is_organization_member(organization_id)
		AND (
			(deleted_at IS NULL AND (SELECT private.is_client_active(cliente_id)))
			OR (deleted_at IS NOT NULL AND COALESCE(quarantined_storage_path, '') <> '' AND COALESCE(quarantined_bucket, '') <> '')
		)
	);

CREATE POLICY "company_document_folders_select" ON public.company_document_folders
	FOR SELECT TO authenticated
	USING (
		char_length(btrim(nome)) > 0
		AND private.is_organization_member(organization_id)
	);

CREATE POLICY "company_document_folders_insert" ON public.company_document_folders
	FOR INSERT TO authenticated
	WITH CHECK (
		char_length(btrim(nome)) > 0
		AND private.is_organization_member(organization_id)
	);

CREATE POLICY "company_document_folders_update" ON public.company_document_folders
	FOR UPDATE TO authenticated
	USING (
		char_length(btrim(nome)) > 0
		AND private.is_organization_member(organization_id)
	)
	WITH CHECK (
		char_length(btrim(nome)) > 0
		AND private.is_organization_member(organization_id)
	);

CREATE POLICY "company_documents_select_active" ON public.company_documents
	FOR SELECT TO authenticated
	USING (
		deleted_at IS NULL
		AND private.is_organization_member(organization_id)
	);

CREATE POLICY "company_documents_insert_active" ON public.company_documents
	FOR INSERT TO authenticated
	WITH CHECK (
		deleted_at IS NULL
		AND folder_id IS NOT NULL
		AND COALESCE(storage_bucket, '') <> ''
		AND COALESCE(storage_path, '') <> ''
		AND COALESCE(public_url, '') <> ''
		AND private.is_organization_member(organization_id)
	);

CREATE POLICY "company_documents_update_active" ON public.company_documents
	FOR UPDATE TO authenticated
	USING (
		deleted_at IS NULL
		AND private.is_organization_member(organization_id)
	)
	WITH CHECK (
		folder_id IS NOT NULL
		AND COALESCE(storage_bucket, '') <> ''
		AND COALESCE(storage_path, '') <> ''
		AND private.is_organization_member(organization_id)
		AND (
			deleted_at IS NULL
			OR (COALESCE(quarantined_storage_path, '') <> '' AND COALESCE(quarantined_bucket, '') <> '')
		)
	);

CREATE POLICY "diagnostico_capilar_select_active_client" ON public.diagnostico_capilar
	FOR SELECT TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "diagnostico_capilar_insert_active_client" ON public.diagnostico_capilar
	FOR INSERT TO authenticated
	WITH CHECK (
		cliente_id IS NOT NULL
		AND elasticidade BETWEEN 1 AND 3
		AND porosidade BETWEEN 1 AND 5
		AND char_length(COALESCE(resultado_teste_mecha, '')) > 0
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "diagnostico_capilar_update_active_client" ON public.diagnostico_capilar
	FOR UPDATE TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	)
	WITH CHECK (
		cliente_id IS NOT NULL
		AND elasticidade BETWEEN 1 AND 3
		AND porosidade BETWEEN 1 AND 5
		AND char_length(COALESCE(resultado_teste_mecha, '')) > 0
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "ficha_anamnese_select_active_client" ON public.ficha_anamnese_capilar
	FOR SELECT TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "ficha_anamnese_insert_active_client" ON public.ficha_anamnese_capilar
	FOR INSERT TO authenticated
	WITH CHECK (
		cliente_id IS NOT NULL
		AND jsonb_typeof(dados) = 'object'
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "ficha_anamnese_update_active_client" ON public.ficha_anamnese_capilar
	FOR UPDATE TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	)
	WITH CHECK (
		cliente_id IS NOT NULL
		AND jsonb_typeof(dados) = 'object'
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "historico_procedimentos_select_active_client" ON public.historico_procedimentos
	FOR SELECT TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "historico_procedimentos_insert_active_client" ON public.historico_procedimentos
	FOR INSERT TO authenticated
	WITH CHECK (
		cliente_id IS NOT NULL
		AND char_length(btrim(tecnica_utilizada)) > 0
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "historico_procedimentos_update_active_client" ON public.historico_procedimentos
	FOR UPDATE TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	)
	WITH CHECK (
		cliente_id IS NOT NULL
		AND char_length(btrim(tecnica_utilizada)) > 0
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "manutencao_homecare_select_active_client" ON public.manutencao_homecare
	FOR SELECT TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "manutencao_homecare_insert_active_client" ON public.manutencao_homecare
	FOR INSERT TO authenticated
	WITH CHECK (
		cliente_id IS NOT NULL
		AND char_length(btrim(produtos_recomendados)) > 0
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "manutencao_homecare_update_active_client" ON public.manutencao_homecare
	FOR UPDATE TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	)
	WITH CHECK (
		cliente_id IS NOT NULL
		AND char_length(btrim(produtos_recomendados)) > 0
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "agendamentos_select_active_client" ON public.agendamentos
	FOR SELECT TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (cliente_id IS NULL OR (SELECT private.is_client_active(cliente_id)))
	);

CREATE POLICY "agendamentos_insert_active_client" ON public.agendamentos
	FOR INSERT TO authenticated
	WITH CHECK (
		char_length(btrim(titulo)) > 0
		AND fim_em > inicio_em
		AND private.is_organization_member(organization_id)
		AND (cliente_id IS NULL OR (SELECT private.is_client_active(cliente_id)))
	);

CREATE POLICY "agendamentos_update_active_client" ON public.agendamentos
	FOR UPDATE TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (cliente_id IS NULL OR (SELECT private.is_client_active(cliente_id)))
	)
	WITH CHECK (
		char_length(btrim(titulo)) > 0
		AND fim_em > inicio_em
		AND private.is_organization_member(organization_id)
		AND (cliente_id IS NULL OR (SELECT private.is_client_active(cliente_id)))
	);

CREATE POLICY "pre_consulta_envios_select_active_client" ON public.pre_consulta_envios
	FOR SELECT TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "pre_consulta_envios_insert_active_client" ON public.pre_consulta_envios
	FOR INSERT TO authenticated
	WITH CHECK (
		cliente_id IS NOT NULL
		AND jsonb_typeof(payload) = 'object'
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "pre_consulta_envios_update_active_client" ON public.pre_consulta_envios
	FOR UPDATE TO authenticated
	USING (
		private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	)
	WITH CHECK (
		cliente_id IS NOT NULL
		AND jsonb_typeof(payload) = 'object'
		AND private.is_organization_member(organization_id)
		AND (SELECT private.is_client_active(cliente_id))
	);

CREATE POLICY "services_select_catalog" ON public.services
	FOR SELECT TO authenticated
	USING (
		char_length(btrim(name)) > 0
		AND private.is_organization_member(organization_id)
	);

CREATE POLICY "services_insert_catalog" ON public.services
	FOR INSERT TO authenticated
	WITH CHECK (
		char_length(btrim(name)) > 0
		AND duration_minutes > 0
		AND price >= 0
		AND private.is_organization_member(organization_id)
	);

CREATE POLICY "services_update_catalog" ON public.services
	FOR UPDATE TO authenticated
	USING (
		char_length(btrim(name)) > 0
		AND private.is_organization_member(organization_id)
	)
	WITH CHECK (
		char_length(btrim(name)) > 0
		AND duration_minutes > 0
		AND price >= 0
		AND private.is_organization_member(organization_id)
	);

DROP TRIGGER IF EXISTS on_auth_user_created_tenant_provisioning ON auth.users;
CREATE TRIGGER on_auth_user_created_tenant_provisioning
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.handle_new_auth_user_tenant_provisioning();
