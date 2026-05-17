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
				'touch_updated_at',
				'sync_pre_consultation_state',
				'sync_client_photo_category',
				'update_updated_at_column'
			)
	LOOP
		EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog', function_identifier);
	END LOOP;
END;
$$;
