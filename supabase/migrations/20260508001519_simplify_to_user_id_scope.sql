DROP TRIGGER IF EXISTS on_auth_user_created_tenant_provisioning ON auth.users;

DROP INDEX IF EXISTS public.organizations_single_active_owner_idx;

ALTER TABLE public.client_photos
	ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.ficha_anamnese_capilar
	ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.agendamentos
	ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.pre_consulta_envios
	ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.diagnostico_capilar
	ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.historico_procedimentos
	ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.manutencao_homecare
	ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.company_document_folders
	ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.company_documents
	ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.services
	ALTER COLUMN organization_id DROP NOT NULL;

DROP TRIGGER IF EXISTS trg_clientes_assign_organization_id ON public.clientes;
DROP INDEX IF EXISTS public.idx_clientes_organization_id;

ALTER TABLE public.clientes
	DROP COLUMN IF EXISTS organization_id;

CREATE OR REPLACE FUNCTION private.resolve_client_organization_id(target_client_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT NULL::UUID;
$$;

CREATE OR REPLACE FUNCTION private.assign_current_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	IF TG_OP = 'UPDATE' AND OLD.organization_id IS NOT NULL THEN
		NEW.organization_id := OLD.organization_id;
	END IF;

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
		RETURN NEW;
	END IF;

	resolved_organization_id := private.resolve_client_organization_id(NEW.cliente_id);
	NEW.organization_id := COALESCE(OLD.organization_id, resolved_organization_id, NEW.organization_id);
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
	ELSE
		resolved_organization_id := NULL;
	END IF;

	NEW.organization_id := COALESCE(OLD.organization_id, resolved_organization_id, NEW.organization_id);
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
		RETURN NEW;
	END IF;

	resolved_organization_id := private.resolve_company_document_folder_organization_id(NEW.folder_id);
	NEW.organization_id := COALESCE(OLD.organization_id, resolved_organization_id, NEW.organization_id);
	RETURN NEW;
END;
$$;

WITH ranked_preferences AS (
	SELECT
		ctid,
		ROW_NUMBER() OVER (
			PARTITION BY user_id, preference_key
			ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, ctid DESC
		) AS row_rank
	FROM public.clinic_preferences
)
DELETE FROM public.clinic_preferences AS preference
USING ranked_preferences
WHERE preference.ctid = ranked_preferences.ctid
	AND ranked_preferences.row_rank > 1;

ALTER TABLE public.clinic_preferences
	DROP CONSTRAINT IF EXISTS clinic_preferences_pkey;

ALTER TABLE public.clinic_preferences
	ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.clinic_preferences
	ADD PRIMARY KEY (user_id, preference_key);

DROP INDEX IF EXISTS public.idx_clinic_preferences_organization_id;
CREATE INDEX IF NOT EXISTS idx_clinic_preferences_user_id
	ON public.clinic_preferences (user_id);

DROP INDEX IF EXISTS public.idx_company_document_folders_nome_unique;
CREATE UNIQUE INDEX idx_company_document_folders_nome_unique
	ON public.company_document_folders (user_id, LOWER(nome));
