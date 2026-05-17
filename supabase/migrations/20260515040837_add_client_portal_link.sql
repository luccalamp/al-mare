-- Add portal link columns to clientes table
-- These enable the client portal feature where clients can view their
-- homecare, gallery photos, and upcoming appointments via a unique token link.

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_token UUID;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_active BOOLEAN DEFAULT false;

-- Add index for fast portal token lookups
CREATE INDEX IF NOT EXISTS idx_clientes_portal_token ON clientes (portal_token) WHERE portal_token IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN clientes.portal_token IS 'Unique token for client portal access (no login required)';
COMMENT ON COLUMN clientes.portal_active IS 'Whether the portal link is currently active';
