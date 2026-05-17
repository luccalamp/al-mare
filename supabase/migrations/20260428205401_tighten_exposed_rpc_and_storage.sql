DROP POLICY IF EXISTS "allow_company_documents_select" ON storage.objects;

DO $$
DECLARE
	function_identifier text;
BEGIN
	FOR function_identifier IN
		SELECT p.oid::regprocedure::text
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public'
			AND p.proname IN (
				'get_pre_consultation_session',
				'issue_pre_consultation_link',
				'deactivate_pre_consultation_link'
			)
	LOOP
		EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', function_identifier);
	END LOOP;

	IF EXISTS (
		SELECT 1
		FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public'
			AND p.proname = 'rls_auto_enable'
			AND p.pronargs = 0
	) THEN
		EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
	END IF;
END;
$$;
