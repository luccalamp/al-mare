-- Stores email verification codes for the custom password + 2FA flow.
-- Access is restricted to server-side APIs using service_role.

CREATE TABLE IF NOT EXISTS public.auth_verification_codes (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	email TEXT NOT NULL,
	code TEXT NOT NULL CHECK (code ~ '^[0-9]{6}$'),
	expires_at TIMESTAMPTZ NOT NULL,
	used BOOLEAN NOT NULL DEFAULT false,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_verification_codes_lookup
	ON public.auth_verification_codes (email, code, used, expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_verification_codes_expiry
	ON public.auth_verification_codes (expires_at);

ALTER TABLE public.auth_verification_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.auth_verification_codes FROM PUBLIC, anon, authenticated;
