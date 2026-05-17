-- Remove the legacy multi-tenant SaaS layer after simplifying access control to user_id ownership.

DROP TRIGGER IF EXISTS on_auth_user_created_tenant_provisioning ON auth.users;

DROP TRIGGER IF EXISTS trg_agendamentos_assign_organization_id ON public.agendamentos;
DROP TRIGGER IF EXISTS trg_client_photos_assign_organization_id ON public.client_photos;
DROP TRIGGER IF EXISTS trg_company_document_folders_assign_organization_id ON public.company_document_folders;
DROP TRIGGER IF EXISTS trg_company_documents_assign_organization_id ON public.company_documents;
DROP TRIGGER IF EXISTS trg_diagnostico_capilar_assign_organization_id ON public.diagnostico_capilar;
DROP TRIGGER IF EXISTS trg_ficha_anamnese_assign_organization_id ON public.ficha_anamnese_capilar;
DROP TRIGGER IF EXISTS trg_historico_procedimentos_assign_organization_id ON public.historico_procedimentos;
DROP TRIGGER IF EXISTS trg_manutencao_homecare_assign_organization_id ON public.manutencao_homecare;
DROP TRIGGER IF EXISTS trg_pre_consulta_envios_assign_organization_id ON public.pre_consulta_envios;
DROP TRIGGER IF EXISTS trg_services_assign_organization_id ON public.services;

DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

DROP FUNCTION IF EXISTS private.handle_new_auth_user_tenant_provisioning();
DROP FUNCTION IF EXISTS private.provision_organization_for_user(UUID, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS private.ensure_default_company_folder(UUID);
DROP FUNCTION IF EXISTS private.current_user_primary_organization_id();
DROP FUNCTION IF EXISTS private.current_user_organization_ids();
DROP FUNCTION IF EXISTS private.current_user_organization_role(UUID);
DROP FUNCTION IF EXISTS private.is_organization_member(UUID);
DROP FUNCTION IF EXISTS private.can_access_organization(UUID);
DROP FUNCTION IF EXISTS private.resolve_client_organization_id(UUID);
DROP FUNCTION IF EXISTS private.resolve_company_document_folder_organization_id(UUID);
DROP FUNCTION IF EXISTS private.assign_current_organization_id();
DROP FUNCTION IF EXISTS private.assign_client_child_organization_id();
DROP FUNCTION IF EXISTS private.assign_agendamento_organization_id();
DROP FUNCTION IF EXISTS private.assign_company_document_organization_id();
DROP FUNCTION IF EXISTS private.resolve_organization_owner_user_id(UUID);

ALTER TABLE IF EXISTS public.agendamentos
	DROP COLUMN IF EXISTS organization_id CASCADE;

ALTER TABLE IF EXISTS public.client_photos
	DROP COLUMN IF EXISTS organization_id CASCADE;

ALTER TABLE IF EXISTS public.clinic_preferences
	DROP COLUMN IF EXISTS organization_id CASCADE;

ALTER TABLE IF EXISTS public.company_document_folders
	DROP COLUMN IF EXISTS organization_id CASCADE;

ALTER TABLE IF EXISTS public.company_documents
	DROP COLUMN IF EXISTS organization_id CASCADE;

ALTER TABLE IF EXISTS public.diagnostico_capilar
	DROP COLUMN IF EXISTS organization_id CASCADE;

ALTER TABLE IF EXISTS public.ficha_anamnese_capilar
	DROP COLUMN IF EXISTS organization_id CASCADE;

ALTER TABLE IF EXISTS public.historico_procedimentos
	DROP COLUMN IF EXISTS organization_id CASCADE;

ALTER TABLE IF EXISTS public.manutencao_homecare
	DROP COLUMN IF EXISTS organization_id CASCADE;

ALTER TABLE IF EXISTS public.pre_consulta_envios
	DROP COLUMN IF EXISTS organization_id CASCADE;

ALTER TABLE IF EXISTS public.services
	DROP COLUMN IF EXISTS organization_id CASCADE;
