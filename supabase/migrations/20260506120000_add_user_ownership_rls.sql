ALTER TABLE public.organizations
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.clientes
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.client_photos
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.ficha_anamnese_capilar
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.agendamentos
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.pre_consulta_envios
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.diagnostico_capilar
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.historico_procedimentos
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.manutencao_homecare
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.company_document_folders
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.company_documents
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.services
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.clinic_preferences
	ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION private.resolve_organization_owner_user_id(target_organization_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT org.user_id
	FROM public.organizations AS org
	WHERE org.id = target_organization_id
	LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.resolve_client_user_id(target_client_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT cliente.user_id
	FROM public.clientes AS cliente
	WHERE cliente.id = target_client_id
	LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.resolve_company_document_folder_user_id(target_folder_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT folder.user_id
	FROM public.company_document_folders AS folder
	WHERE folder.id = target_folder_id
	LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT org.id
	FROM public.organizations AS org
	WHERE org.user_id = (SELECT auth.uid())
		AND org.is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION private.is_organization_member(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT EXISTS (
		SELECT 1
		FROM public.organizations AS org
		WHERE org.id = target_organization_id
			AND org.user_id = (SELECT auth.uid())
			AND org.is_active = TRUE
	);
$$;

CREATE OR REPLACE FUNCTION private.current_user_organization_role(target_organization_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT CASE
		WHEN private.is_organization_member(target_organization_id) THEN 'owner'
		ELSE NULL
	END;
$$;

CREATE OR REPLACE FUNCTION private.current_user_primary_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT org.id
	FROM public.organizations AS org
	WHERE org.user_id = (SELECT auth.uid())
		AND org.is_active = TRUE
	ORDER BY org.created_at ASC
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
		COALESCE((SELECT auth.role()), '') = 'service_role'
		OR EXISTS (
			SELECT 1
			FROM public.organizations AS org
			WHERE org.id = target_organization_id
				AND org.user_id = (SELECT auth.uid())
				AND org.is_active = TRUE
		)
	);
$$;

CREATE OR REPLACE FUNCTION private.ensure_default_company_folder(target_organization_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	ensured_folder_id UUID;
	organization_user_id UUID;
BEGIN
	SELECT org.user_id
	INTO organization_user_id
	FROM public.organizations AS org
	WHERE org.id = target_organization_id
	LIMIT 1;

	IF organization_user_id IS NULL THEN
		RAISE EXCEPTION 'organization_owner_not_found';
	END IF;

	SELECT folder.id
	INTO ensured_folder_id
	FROM public.company_document_folders AS folder
	WHERE folder.organization_id = target_organization_id
		AND LOWER(folder.nome) = 'geral'
	LIMIT 1;

	IF ensured_folder_id IS NOT NULL THEN
		RETURN ensured_folder_id;
	END IF;

	INSERT INTO public.company_document_folders (organization_id, user_id, nome)
	SELECT target_organization_id, organization_user_id, 'Geral'
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
	SELECT org.id
	INTO existing_organization_id
	FROM public.organizations AS org
	WHERE org.user_id = target_user_id
		AND org.is_active = TRUE
	ORDER BY org.created_at ASC
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

	INSERT INTO public.organizations (nome, slug, metadata, user_id)
	VALUES (
		generated_name,
		generated_slug,
		jsonb_strip_nulls(
			jsonb_build_object(
				'provisioned_from_email', NULLIF(target_email, ''),
				'provisioned_for_user_id', target_user_id
			)
		),
		target_user_id
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

REVOKE ALL ON FUNCTION private.resolve_organization_owner_user_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.resolve_organization_owner_user_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.resolve_organization_owner_user_id(UUID) TO authenticated;

REVOKE ALL ON FUNCTION private.resolve_client_user_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.resolve_client_user_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.resolve_client_user_id(UUID) TO authenticated;

REVOKE ALL ON FUNCTION private.resolve_company_document_folder_user_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.resolve_company_document_folder_user_id(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.resolve_company_document_folder_user_id(UUID) TO authenticated;

WITH owner_members AS (
	SELECT DISTINCT ON (om.organization_id)
		om.organization_id,
		om.user_id
	FROM public.organization_members AS om
	WHERE om.is_active = TRUE
	ORDER BY
		om.organization_id,
		CASE om.role
			WHEN 'owner' THEN 0
			WHEN 'admin' THEN 1
			ELSE 2
		END,
		om.created_at ASC
)
UPDATE public.organizations AS org
SET user_id = owner_members.user_id
FROM owner_members
WHERE org.id = owner_members.organization_id
	AND org.user_id IS DISTINCT FROM owner_members.user_id;

INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT org.id, org.user_id, 'owner', TRUE
FROM public.organizations AS org
WHERE org.user_id IS NOT NULL
ON CONFLICT (organization_id, user_id)
DO UPDATE SET
	role = 'owner',
	is_active = TRUE,
	updated_at = NOW();

UPDATE public.organization_members AS om
SET is_active = (om.user_id = org.user_id),
	role = CASE
		WHEN om.user_id = org.user_id THEN 'owner'
		ELSE om.role
	END,
	updated_at = NOW()
FROM public.organizations AS org
WHERE om.organization_id = org.id
	AND (
		om.is_active IS DISTINCT FROM (om.user_id = org.user_id)
		OR (om.user_id = org.user_id AND om.role <> 'owner')
	);

DO $$
DECLARE
	table_name TEXT;
BEGIN
	FOREACH table_name IN ARRAY ARRAY[
		'clientes',
		'client_photos',
		'ficha_anamnese_capilar',
		'agendamentos',
		'pre_consulta_envios',
		'diagnostico_capilar',
		'historico_procedimentos',
		'manutencao_homecare',
		'company_document_folders',
		'company_documents',
		'services',
		'clinic_preferences'
	]
	LOOP
		EXECUTE format(
			'ALTER TABLE public.%I DISABLE TRIGGER USER',
			table_name
		);
	END LOOP;

	FOREACH table_name IN ARRAY ARRAY[
		'clientes',
		'client_photos',
		'ficha_anamnese_capilar',
		'agendamentos',
		'pre_consulta_envios',
		'diagnostico_capilar',
		'historico_procedimentos',
		'manutencao_homecare',
		'company_document_folders',
		'company_documents',
		'services',
		'clinic_preferences'
	]
	LOOP
		EXECUTE format(
			'UPDATE public.%I AS target SET user_id = org.user_id FROM public.organizations AS org WHERE target.organization_id = org.id AND target.user_id IS DISTINCT FROM org.user_id',
			table_name
		);
	END LOOP;

	FOREACH table_name IN ARRAY ARRAY[
		'clientes',
		'client_photos',
		'ficha_anamnese_capilar',
		'agendamentos',
		'pre_consulta_envios',
		'diagnostico_capilar',
		'historico_procedimentos',
		'manutencao_homecare',
		'company_document_folders',
		'company_documents',
		'services',
		'clinic_preferences'
	]
	LOOP
		EXECUTE format(
			'ALTER TABLE public.%I ENABLE TRIGGER USER',
			table_name
		);
	END LOOP;
END;
$$;

DO $$
DECLARE
	table_name TEXT;
	missing_rows BIGINT;
BEGIN
	FOREACH table_name IN ARRAY ARRAY[
		'organizations',
		'clientes',
		'client_photos',
		'ficha_anamnese_capilar',
		'agendamentos',
		'pre_consulta_envios',
		'diagnostico_capilar',
		'historico_procedimentos',
		'manutencao_homecare',
		'company_document_folders',
		'company_documents',
		'services',
		'clinic_preferences'
	]
	LOOP
		EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id IS NULL', table_name) INTO missing_rows;
		IF missing_rows > 0 THEN
			RAISE EXCEPTION 'user_id_backfill_failed_for_%', table_name;
		END IF;
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_current_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	resolved_user_id UUID;
BEGIN
	IF TG_OP = 'UPDATE' THEN
		resolved_user_id := OLD.user_id;
	END IF;

	resolved_user_id := COALESCE(resolved_user_id, NEW.user_id);

	IF resolved_user_id IS NULL AND NEW.organization_id IS NOT NULL THEN
		resolved_user_id := private.resolve_organization_owner_user_id(NEW.organization_id);
	END IF;

	resolved_user_id := COALESCE(resolved_user_id, (SELECT auth.uid()));

	IF resolved_user_id IS NULL THEN
		RAISE EXCEPTION 'user_context_required';
	END IF;

	IF COALESCE((SELECT auth.role()), '') <> 'service_role' AND resolved_user_id <> (SELECT auth.uid()) THEN
		RAISE EXCEPTION 'not_authorized_for_user';
	END IF;

	NEW.user_id := resolved_user_id;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_client_child_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	resolved_user_id UUID;
BEGIN
	IF NEW.cliente_id IS NULL THEN
		RAISE EXCEPTION 'client_id_required_for_user_binding';
	END IF;

	resolved_user_id := private.resolve_client_user_id(NEW.cliente_id);
	IF resolved_user_id IS NULL THEN
		RAISE EXCEPTION 'client_owner_not_found';
	END IF;

	IF COALESCE((SELECT auth.role()), '') <> 'service_role' AND resolved_user_id <> (SELECT auth.uid()) THEN
		RAISE EXCEPTION 'not_authorized_for_user';
	END IF;

	NEW.user_id := resolved_user_id;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_agendamento_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	resolved_user_id UUID;
BEGIN
	IF NEW.cliente_id IS NOT NULL THEN
		resolved_user_id := private.resolve_client_user_id(NEW.cliente_id);
	ELSE
		IF TG_OP = 'UPDATE' THEN
			resolved_user_id := OLD.user_id;
		END IF;

		resolved_user_id := COALESCE(resolved_user_id, NEW.user_id);

		IF resolved_user_id IS NULL AND NEW.organization_id IS NOT NULL THEN
			resolved_user_id := private.resolve_organization_owner_user_id(NEW.organization_id);
		END IF;

		resolved_user_id := COALESCE(resolved_user_id, (SELECT auth.uid()));
	END IF;

	IF resolved_user_id IS NULL THEN
		RAISE EXCEPTION 'user_context_required';
	END IF;

	IF COALESCE((SELECT auth.role()), '') <> 'service_role' AND resolved_user_id <> (SELECT auth.uid()) THEN
		RAISE EXCEPTION 'not_authorized_for_user';
	END IF;

	NEW.user_id := resolved_user_id;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_company_document_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	resolved_user_id UUID;
BEGIN
	IF NEW.folder_id IS NULL THEN
		RAISE EXCEPTION 'folder_id_required_for_user_binding';
	END IF;

	resolved_user_id := private.resolve_company_document_folder_user_id(NEW.folder_id);
	IF resolved_user_id IS NULL THEN
		RAISE EXCEPTION 'folder_owner_not_found';
	END IF;

	IF COALESCE((SELECT auth.role()), '') <> 'service_role' AND resolved_user_id <> (SELECT auth.uid()) THEN
		RAISE EXCEPTION 'not_authorized_for_user';
	END IF;

	NEW.user_id := resolved_user_id;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_assign_user_id ON public.organizations;
CREATE TRIGGER trg_organizations_assign_user_id
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION private.assign_current_user_id();

DROP TRIGGER IF EXISTS trg_clientes_assign_user_id ON public.clientes;
CREATE TRIGGER trg_clientes_assign_user_id
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION private.assign_current_user_id();

DROP TRIGGER IF EXISTS trg_client_photos_assign_user_id ON public.client_photos;
CREATE TRIGGER trg_client_photos_assign_user_id
BEFORE INSERT OR UPDATE ON public.client_photos
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_user_id();

DROP TRIGGER IF EXISTS trg_ficha_anamnese_assign_user_id ON public.ficha_anamnese_capilar;
CREATE TRIGGER trg_ficha_anamnese_assign_user_id
BEFORE INSERT OR UPDATE ON public.ficha_anamnese_capilar
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_user_id();

DROP TRIGGER IF EXISTS trg_diagnostico_capilar_assign_user_id ON public.diagnostico_capilar;
CREATE TRIGGER trg_diagnostico_capilar_assign_user_id
BEFORE INSERT OR UPDATE ON public.diagnostico_capilar
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_user_id();

DROP TRIGGER IF EXISTS trg_historico_procedimentos_assign_user_id ON public.historico_procedimentos;
CREATE TRIGGER trg_historico_procedimentos_assign_user_id
BEFORE INSERT OR UPDATE ON public.historico_procedimentos
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_user_id();

DROP TRIGGER IF EXISTS trg_manutencao_homecare_assign_user_id ON public.manutencao_homecare;
CREATE TRIGGER trg_manutencao_homecare_assign_user_id
BEFORE INSERT OR UPDATE ON public.manutencao_homecare
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_user_id();

DROP TRIGGER IF EXISTS trg_agendamentos_assign_user_id ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_assign_user_id
BEFORE INSERT OR UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION private.assign_agendamento_user_id();

DROP TRIGGER IF EXISTS trg_pre_consulta_envios_assign_user_id ON public.pre_consulta_envios;
CREATE TRIGGER trg_pre_consulta_envios_assign_user_id
BEFORE INSERT OR UPDATE ON public.pre_consulta_envios
FOR EACH ROW
EXECUTE FUNCTION private.assign_client_child_user_id();

DROP TRIGGER IF EXISTS trg_company_document_folders_assign_user_id ON public.company_document_folders;
CREATE TRIGGER trg_company_document_folders_assign_user_id
BEFORE INSERT OR UPDATE ON public.company_document_folders
FOR EACH ROW
EXECUTE FUNCTION private.assign_current_user_id();

DROP TRIGGER IF EXISTS trg_company_documents_assign_user_id ON public.company_documents;
CREATE TRIGGER trg_company_documents_assign_user_id
BEFORE INSERT OR UPDATE ON public.company_documents
FOR EACH ROW
EXECUTE FUNCTION private.assign_company_document_user_id();

DROP TRIGGER IF EXISTS trg_services_assign_user_id ON public.services;
CREATE TRIGGER trg_services_assign_user_id
BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION private.assign_current_user_id();

DROP TRIGGER IF EXISTS trg_clinic_preferences_assign_user_id ON public.clinic_preferences;
CREATE TRIGGER trg_clinic_preferences_assign_user_id
BEFORE INSERT OR UPDATE ON public.clinic_preferences
FOR EACH ROW
EXECUTE FUNCTION private.assign_current_user_id();

ALTER TABLE public.organizations
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.clientes
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.client_photos
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.ficha_anamnese_capilar
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.agendamentos
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.pre_consulta_envios
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.diagnostico_capilar
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.historico_procedimentos
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.manutencao_homecare
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.company_document_folders
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.company_documents
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.services
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.clinic_preferences
	ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_user_id
	ON public.organizations (user_id);

CREATE INDEX IF NOT EXISTS idx_clientes_user_id
	ON public.clientes (user_id);

CREATE INDEX IF NOT EXISTS idx_client_photos_user_id
	ON public.client_photos (user_id);

CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_user_id
	ON public.ficha_anamnese_capilar (user_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_user_id
	ON public.agendamentos (user_id);

CREATE INDEX IF NOT EXISTS idx_pre_consulta_envios_user_id
	ON public.pre_consulta_envios (user_id);

CREATE INDEX IF NOT EXISTS idx_diagnostico_capilar_user_id
	ON public.diagnostico_capilar (user_id);

CREATE INDEX IF NOT EXISTS idx_historico_procedimentos_user_id
	ON public.historico_procedimentos (user_id);

CREATE INDEX IF NOT EXISTS idx_manutencao_homecare_user_id
	ON public.manutencao_homecare (user_id);

CREATE INDEX IF NOT EXISTS idx_company_document_folders_user_id
	ON public.company_document_folders (user_id);

CREATE INDEX IF NOT EXISTS idx_company_documents_user_id
	ON public.company_documents (user_id);

CREATE INDEX IF NOT EXISTS idx_services_user_id
	ON public.services (user_id);

CREATE INDEX IF NOT EXISTS idx_clinic_preferences_user_id
	ON public.clinic_preferences (user_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_preferences ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
	table_name TEXT;
	policy_name TEXT;
BEGIN
	FOREACH table_name IN ARRAY ARRAY[
		'organizations',
		'organization_members',
		'clientes',
		'client_photos',
		'ficha_anamnese_capilar',
		'agendamentos',
		'pre_consulta_envios',
		'diagnostico_capilar',
		'historico_procedimentos',
		'manutencao_homecare',
		'company_document_folders',
		'company_documents',
		'services',
		'clinic_preferences'
	]
	LOOP
		FOR policy_name IN
			SELECT pol.policyname
			FROM pg_policies AS pol
			WHERE pol.schemaname = 'public'
				AND pol.tablename = table_name
		LOOP
			EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
		END LOOP;
	END LOOP;
END;
$$;

DO $$
DECLARE
	table_name TEXT;
BEGIN
	FOREACH table_name IN ARRAY ARRAY[
		'organizations',
		'organization_members',
		'clientes',
		'client_photos',
		'ficha_anamnese_capilar',
		'agendamentos',
		'pre_consulta_envios',
		'diagnostico_capilar',
		'historico_procedimentos',
		'manutencao_homecare',
		'company_document_folders',
		'company_documents',
		'services',
		'clinic_preferences'
	]
	LOOP
		EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
		EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
		EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
	END LOOP;
END;
$$;

DO $$
DECLARE
	table_name TEXT;
BEGIN
	FOREACH table_name IN ARRAY ARRAY[
		'organizations',
		'clientes',
		'client_photos',
		'ficha_anamnese_capilar',
		'agendamentos',
		'pre_consulta_envios',
		'diagnostico_capilar',
		'historico_procedimentos',
		'manutencao_homecare',
		'company_document_folders',
		'company_documents',
		'services',
		'clinic_preferences'
	]
	LOOP
		EXECUTE format(
			'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id)',
			table_name || '_select_owner',
			table_name
		);
		EXECUTE format(
			'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id)',
			table_name || '_insert_owner',
			table_name
		);
		EXECUTE format(
			'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)',
			table_name || '_update_owner',
			table_name
		);
		EXECUTE format(
			'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id)',
			table_name || '_delete_owner',
			table_name
		);
	END LOOP;
END;
$$;

CREATE POLICY organization_members_select_owner
	ON public.organization_members
	FOR SELECT TO authenticated
	USING (user_id = (SELECT auth.uid()));

CREATE POLICY organization_members_insert_owner
	ON public.organization_members
	FOR INSERT TO authenticated
	WITH CHECK (
		user_id = (SELECT auth.uid())
		AND private.can_access_organization(organization_id)
	);

CREATE POLICY organization_members_update_owner
	ON public.organization_members
	FOR UPDATE TO authenticated
	USING (user_id = (SELECT auth.uid()))
	WITH CHECK (
		user_id = (SELECT auth.uid())
		AND private.can_access_organization(organization_id)
	);

CREATE POLICY organization_members_delete_owner
	ON public.organization_members
	FOR DELETE TO authenticated
	USING (user_id = (SELECT auth.uid()));