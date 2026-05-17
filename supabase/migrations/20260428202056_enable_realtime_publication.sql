DO $$
DECLARE
	table_name text;
BEGIN
	FOREACH table_name IN ARRAY ARRAY[
		'clinic_preferences',
		'clientes',
		'diagnostico_capilar',
		'historico_procedimentos',
		'manutencao_homecare',
		'client_photos',
		'agendamentos',
		'ficha_anamnese_capilar',
		'company_document_folders',
		'company_documents'
	]
	LOOP
		IF EXISTS (
			SELECT 1
			FROM pg_class c
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public'
				AND c.relname = table_name
		) AND NOT EXISTS (
			SELECT 1
			FROM pg_publication_tables
			WHERE pubname = 'supabase_realtime'
				AND schemaname = 'public'
				AND tablename = table_name
		) THEN
			EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
		END IF;
	END LOOP;
END;
$$;
