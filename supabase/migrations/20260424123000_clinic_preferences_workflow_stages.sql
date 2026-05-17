CREATE TABLE IF NOT EXISTS public.clinic_preferences (
  preference_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clinic_preferences ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_clinic_preferences_touch_updated_at ON public.clinic_preferences;
CREATE TRIGGER trg_clinic_preferences_touch_updated_at
BEFORE UPDATE ON public.clinic_preferences
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clinic_preferences'
      AND policyname = 'allow_all_clinic_preferences'
  ) THEN
    CREATE POLICY "allow_all_clinic_preferences" ON public.clinic_preferences
      FOR ALL TO anon, authenticated
      USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;