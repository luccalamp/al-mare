DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'agendamentos',
    'client_photos',
    'clientes',
    'clinic_preferences',
    'company_document_folders',
    'company_documents',
    'diagnostico_capilar',
    'ficha_anamnese_capilar',
    'historico_procedimentos',
    'manutencao_homecare',
    'pre_consulta_envios',
    'services'
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
  function_identifier TEXT;
BEGIN
  FOR function_identifier IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_pre_consultation_session',
        'issue_pre_consultation_link',
        'deactivate_pre_consultation_link',
        'submit_pre_consultation'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', function_identifier);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pre_consultation_session(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pre_consultation_session(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.issue_pre_consultation_link(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_pre_consultation_link(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.deactivate_pre_consultation_link(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_pre_consultation_link(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.submit_pre_consultation(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_pre_consultation(UUID, JSONB) TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rls_auto_enable'
      AND p.pronargs = 0
  ) THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "allow_company_documents_select" ON storage.objects;

DO $$
DECLARE
  policy_rec RECORD;
BEGIN
  FOR policy_rec IN
    SELECT pol.policyname, pol.tablename
    FROM pg_policies AS pol
    WHERE pol.schemaname = 'storage'
      AND pol.tablename = 'objects'
      AND pol.roles @> ARRAY['anon'::name]
      AND (pol.cmd IS NULL OR pol.cmd IN ('SELECT', 'ALL'))
  LOOP
    IF policy_rec.policyname ILIKE '%company%' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.%I', policy_rec.policyname, policy_rec.tablename);
    END IF;
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
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
  END LOOP;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
  policy_exists BOOLEAN;
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
      'SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = ''public'' AND tablename = %L AND policyname = %L)',
      table_name, table_name || '_select_owner'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id)',
        table_name || '_select_owner', table_name
      );
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = ''public'' AND tablename = %L AND policyname = %L)',
      table_name, table_name || '_insert_owner'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id)',
        table_name || '_insert_owner', table_name
      );
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = ''public'' AND tablename = %L AND policyname = %L)',
      table_name, table_name || '_update_owner'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)',
        table_name || '_update_owner', table_name
      );
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = ''public'' AND tablename = %L AND policyname = %L)',
      table_name, table_name || '_delete_owner'
    ) INTO policy_exists;

    IF NOT policy_exists THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id)',
        table_name || '_delete_owner', table_name
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  policy_exists BOOLEAN;
BEGIN
  policy_exists := EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'organization_members_select_owner'
  );
  IF NOT policy_exists THEN
    CREATE POLICY organization_members_select_owner
      ON public.organization_members
      FOR SELECT TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;

  policy_exists := EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'organization_members_insert_owner'
  );
  IF NOT policy_exists THEN
    CREATE POLICY organization_members_insert_owner
      ON public.organization_members
      FOR INSERT TO authenticated
      WITH CHECK (
        user_id = (SELECT auth.uid())
        AND private.can_access_organization(organization_id)
      );
  END IF;

  policy_exists := EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'organization_members_update_owner'
  );
  IF NOT policy_exists THEN
    CREATE POLICY organization_members_update_owner
      ON public.organization_members
      FOR UPDATE TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (
        user_id = (SELECT auth.uid())
        AND private.can_access_organization(organization_id)
      );
  END IF;

  policy_exists := EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'organization_members_delete_owner'
  );
  IF NOT policy_exists THEN
    CREATE POLICY organization_members_delete_owner
      ON public.organization_members
      FOR DELETE TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
END;
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_preferences ENABLE ROW LEVEL SECURITY;