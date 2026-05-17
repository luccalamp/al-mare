CREATE OR REPLACE FUNCTION private.storage_object_client_owned(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	target_client_id UUID;
BEGIN
	BEGIN
		target_client_id := NULLIF(split_part(object_name, '/', 1), '')::UUID;
	EXCEPTION WHEN invalid_text_representation THEN
		RETURN FALSE;
	END;

	IF target_client_id IS NULL THEN
		RETURN FALSE;
	END IF;

	RETURN EXISTS (
		SELECT 1
		FROM public.clientes AS client
		WHERE client.id = target_client_id
			AND client.user_id = auth.uid()
			AND client.deleted_at IS NULL
	);
END;
$$;

CREATE OR REPLACE FUNCTION private.storage_object_company_folder_owned(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	target_folder_id UUID;
BEGIN
	BEGIN
		target_folder_id := NULLIF(split_part(object_name, '/', 1), '')::UUID;
	EXCEPTION WHEN invalid_text_representation THEN
		RETURN FALSE;
	END;

	IF target_folder_id IS NULL THEN
		RETURN FALSE;
	END IF;

	RETURN EXISTS (
		SELECT 1
		FROM public.company_document_folders AS folder
		WHERE folder.id = target_folder_id
			AND folder.user_id = auth.uid()
	);
END;
$$;

REVOKE ALL ON FUNCTION private.storage_object_client_owned(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.storage_object_client_owned(TEXT) FROM anon;
REVOKE ALL ON FUNCTION private.storage_object_client_owned(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.storage_object_client_owned(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.storage_object_client_owned(TEXT) TO service_role;

REVOKE ALL ON FUNCTION private.storage_object_company_folder_owned(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.storage_object_company_folder_owned(TEXT) FROM anon;
REVOKE ALL ON FUNCTION private.storage_object_company_folder_owned(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.storage_object_company_folder_owned(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.storage_object_company_folder_owned(TEXT) TO service_role;

UPDATE storage.buckets
SET public = FALSE
WHERE id IN ('anamnese-fotos', 'company-documents');

DROP POLICY IF EXISTS "allow_public_anamnese_fotos_uploads" ON storage.objects;
DROP POLICY IF EXISTS "allow_public_anamnese_fotos_deletes" ON storage.objects;
DROP POLICY IF EXISTS "allow_company_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "allow_company_documents_upload" ON storage.objects;
DROP POLICY IF EXISTS "allow_company_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "allow_company_documents_delete" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_anamnese_fotos_select" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_anamnese_fotos_upload" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_anamnese_fotos_update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_anamnese_fotos_delete" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_company_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_company_documents_upload" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_company_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_company_documents_delete" ON storage.objects;

CREATE POLICY "authenticated_anamnese_fotos_select" ON storage.objects
	FOR SELECT TO authenticated
	USING (
		bucket_id = 'anamnese-fotos'
		AND private.storage_object_client_owned(name)
	);

CREATE POLICY "authenticated_anamnese_fotos_upload" ON storage.objects
	FOR INSERT TO authenticated
	WITH CHECK (
		bucket_id = 'anamnese-fotos'
		AND private.storage_object_client_owned(name)
	);

CREATE POLICY "authenticated_anamnese_fotos_update" ON storage.objects
	FOR UPDATE TO authenticated
	USING (
		bucket_id = 'anamnese-fotos'
		AND private.storage_object_client_owned(name)
	)
	WITH CHECK (
		bucket_id = 'anamnese-fotos'
		AND private.storage_object_client_owned(name)
	);

CREATE POLICY "authenticated_anamnese_fotos_delete" ON storage.objects
	FOR DELETE TO authenticated
	USING (
		bucket_id = 'anamnese-fotos'
		AND private.storage_object_client_owned(name)
	);

CREATE POLICY "authenticated_company_documents_select" ON storage.objects
	FOR SELECT TO authenticated
	USING (
		bucket_id = 'company-documents'
		AND private.storage_object_company_folder_owned(name)
	);

CREATE POLICY "authenticated_company_documents_upload" ON storage.objects
	FOR INSERT TO authenticated
	WITH CHECK (
		bucket_id = 'company-documents'
		AND private.storage_object_company_folder_owned(name)
	);

CREATE POLICY "authenticated_company_documents_update" ON storage.objects
	FOR UPDATE TO authenticated
	USING (
		bucket_id = 'company-documents'
		AND private.storage_object_company_folder_owned(name)
	)
	WITH CHECK (
		bucket_id = 'company-documents'
		AND private.storage_object_company_folder_owned(name)
	);

CREATE POLICY "authenticated_company_documents_delete" ON storage.objects
	FOR DELETE TO authenticated
	USING (
		bucket_id = 'company-documents'
		AND private.storage_object_company_folder_owned(name)
	);
