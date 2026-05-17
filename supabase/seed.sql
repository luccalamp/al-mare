-- Seed data for Iluminare Studio / Al'Mare
-- This seed runs after migrations during supabase db reset.
-- Data is owned per-user (user_id), so seeds cannot create operational data
-- without knowing real auth user IDs. This seed focuses on shared reference data.

-- Enable required extensions (if not already enabled by Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- Placeholder: add shared reference/catalog data here when needed.
-- Example: service catalog templates, clinical reference values, etc.
--
-- INSERT INTO public.services (name, description, duration_minutes, price)
-- VALUES ('Corte', 'Corte de cabelo', 30, 50)
-- ON CONFLICT DO NOTHING;
--
-- NOTE: Services now require user_id (NOT NULL). Seed data requires a known user.
-- To seed operational data, use the provision_organization_for_user() function
-- via an API call after the first user signs up.