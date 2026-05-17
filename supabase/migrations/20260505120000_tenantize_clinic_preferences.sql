ALTER TABLE public.clinic_preferences
	ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

DO $$
DECLARE
	legacy_organization_id UUID;
BEGIN
	SELECT om.organization_id
	INTO legacy_organization_id
	FROM public.organization_members AS om
	JOIN public.organizations AS org
		ON org.id = om.organization_id
	JOIN auth.users AS user_row
		ON user_row.id = om.user_id
	WHERE om.is_active = TRUE
		AND org.is_active = TRUE
	ORDER BY user_row.created_at ASC, om.created_at ASC
	LIMIT 1;

	IF legacy_organization_id IS NULL THEN
		RAISE EXCEPTION 'legacy_organization_bootstrap_failed';
	END IF;

	UPDATE public.clinic_preferences
	SET organization_id = legacy_organization_id
	WHERE organization_id IS NULL;
END;
$$;

ALTER TABLE public.clinic_preferences
	ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.clinic_preferences
	DROP CONSTRAINT IF EXISTS clinic_preferences_pkey;

ALTER TABLE public.clinic_preferences
	ADD PRIMARY KEY (organization_id, preference_key);

CREATE INDEX IF NOT EXISTS idx_clinic_preferences_organization_id
	ON public.clinic_preferences (organization_id);

DROP POLICY IF EXISTS clinic_preferences_select ON public.clinic_preferences;
DROP POLICY IF EXISTS clinic_preferences_insert ON public.clinic_preferences;
DROP POLICY IF EXISTS clinic_preferences_update ON public.clinic_preferences;

CREATE POLICY clinic_preferences_select ON public.clinic_preferences
	FOR SELECT TO authenticated
	USING (private.is_organization_member(organization_id));

CREATE POLICY clinic_preferences_insert ON public.clinic_preferences
	FOR INSERT TO authenticated
	WITH CHECK (private.is_organization_member(organization_id));

CREATE POLICY clinic_preferences_update ON public.clinic_preferences
	FOR UPDATE TO authenticated
	USING (private.is_organization_member(organization_id))
	WITH CHECK (private.is_organization_member(organization_id));