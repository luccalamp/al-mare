CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE IF NOT EXISTS public.organizations (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	nome TEXT NOT NULL,
	slug TEXT NOT NULL,
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug_unique
	ON public.organizations (LOWER(slug));

DROP TRIGGER IF EXISTS trg_organizations_touch_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_touch_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_members (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
	user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	role TEXT NOT NULL DEFAULT 'member',
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT organization_members_role_check CHECK (role IN ('owner', 'admin', 'member'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_org_user_unique
	ON public.organization_members (organization_id, user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_active
	ON public.organization_members (user_id, organization_id)
	WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_organization_members_organization_active
	ON public.organization_members (organization_id, user_id)
	WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_organization_members_touch_updated_at ON public.organization_members;
CREATE TRIGGER trg_organization_members_touch_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.organizations FROM PUBLIC;
REVOKE ALL ON TABLE public.organizations FROM anon;
REVOKE ALL ON TABLE public.organization_members FROM PUBLIC;
REVOKE ALL ON TABLE public.organization_members FROM anon;
GRANT SELECT ON TABLE public.organizations TO authenticated;
GRANT SELECT ON TABLE public.organization_members TO authenticated;

CREATE OR REPLACE FUNCTION private.current_user_organization_ids()
RETURNS SETOF UUID
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
		FROM private.current_user_organization_ids() AS organization_id
		WHERE organization_id = target_organization_id
	);
$$;

CREATE OR REPLACE FUNCTION private.current_user_organization_role(target_organization_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT om.role
	FROM public.organization_members AS om
	JOIN public.organizations AS org
		ON org.id = om.organization_id
	WHERE om.user_id = (SELECT auth.uid())
		AND om.organization_id = target_organization_id
		AND om.is_active = TRUE
		AND org.is_active = TRUE
	LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.current_user_organization_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_user_organization_ids() FROM anon;
GRANT EXECUTE ON FUNCTION private.current_user_organization_ids() TO authenticated;

REVOKE ALL ON FUNCTION private.is_organization_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_organization_member(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.is_organization_member(UUID) TO authenticated;

REVOKE ALL ON FUNCTION private.current_user_organization_role(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_user_organization_role(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION private.current_user_organization_role(UUID) TO authenticated;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename = 'organizations'
			AND policyname = 'organizations_select_member_orgs'
	) THEN
		CREATE POLICY "organizations_select_member_orgs" ON public.organizations
			FOR SELECT TO authenticated
			USING (
				id IN (
					SELECT private.current_user_organization_ids()
				)
			);
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename = 'organization_members'
			AND policyname = 'organization_members_select_own_membership'
	) THEN
		CREATE POLICY "organization_members_select_own_membership" ON public.organization_members
			FOR SELECT TO authenticated
			USING (user_id = (SELECT auth.uid()));
	END IF;
END;
$$;
