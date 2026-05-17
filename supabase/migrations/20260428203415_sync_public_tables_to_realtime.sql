DO $$
DECLARE
	table_name text;
BEGIN
	FOR table_name IN
		SELECT t.table_name
		FROM information_schema.tables AS t
		WHERE t.table_schema = 'public'
			AND t.table_type = 'BASE TABLE'
			AND t.table_name NOT IN ('spatial_ref_sys')
			AND NOT EXISTS (
				SELECT 1
				FROM pg_publication_tables AS p
				WHERE p.pubname = 'supabase_realtime'
					AND p.schemaname = 'public'
					AND p.tablename = t.table_name
			)
	LOOP
		EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
	END LOOP;
END;
$$;
