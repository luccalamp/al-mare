DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM public.organizations
		WHERE user_id IS NOT NULL
			AND is_active = TRUE
		GROUP BY user_id
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'multiple_active_organizations_per_user_detected';
	END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_single_active_owner_idx
	ON public.organizations (user_id)
	WHERE user_id IS NOT NULL
		AND is_active = TRUE;
