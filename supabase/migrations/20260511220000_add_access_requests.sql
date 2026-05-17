-- Access request approval flow for the app.
-- All reads and writes go through server-side APIs using service_role.

CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_email_unique ON public.access_requests (lower(email));
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests (status);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Service role can read access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Service role can update access requests" ON public.access_requests;

DROP INDEX IF EXISTS public.idx_access_requests_email;

-- Enable realtime for access_requests so the admin page refreshes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'access_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.access_requests;
  END IF;
END;
$$;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION private.set_access_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_access_requests_updated_at ON public.access_requests;
CREATE TRIGGER trg_access_requests_updated_at
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW
  EXECUTE FUNCTION private.set_access_request_updated_at();