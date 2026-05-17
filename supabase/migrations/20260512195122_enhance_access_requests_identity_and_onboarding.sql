ALTER TABLE public.access_requests
	ADD COLUMN IF NOT EXISTS requester_user_id UUID,
	ADD COLUMN IF NOT EXISTS full_name TEXT,
	ADD COLUMN IF NOT EXISTS phone TEXT,
	ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
	ADD COLUMN IF NOT EXISTS auth_provider TEXT,
	ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS avatar_url TEXT,
	ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
	ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
	ADD COLUMN IF NOT EXISTS password_setup_email_sent_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_requester_user_id_unique
ON public.access_requests (requester_user_id)
WHERE requester_user_id IS NOT NULL;

UPDATE public.access_requests
SET approved_at = COALESCE(approved_at, updated_at)
WHERE status = 'approved'
	AND approved_at IS NULL;
