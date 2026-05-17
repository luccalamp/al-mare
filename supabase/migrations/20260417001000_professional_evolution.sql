-- Historical placeholder for the original professional-evolution step.
--
-- The original SQL in this version still targeted the pre-refactor English schema
-- (`clients`, `hair_diagnostics`, `appointments`, `technical_sheets`).
-- The immediately previous migration `20260417000000_iluminare_operational.sql`
-- replaces that structure with the current Portuguese tables (`clientes`,
-- `diagnostico_capilar`, `historico_procedimentos`, `manutencao_homecare`).
--
-- Keeping this version as a no-op preserves migration history compatibility for
-- local resets and linked environments without reintroducing the obsolete schema.
DO $$
BEGIN
    NULL;
END;
$$;
