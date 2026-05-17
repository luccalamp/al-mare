-- Ficha de anamnese capilar (questionário clínico completo em JSONB)
CREATE TABLE IF NOT EXISTS ficha_anamnese_capilar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL UNIQUE REFERENCES clientes(id) ON DELETE CASCADE,
    dados JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_cliente ON ficha_anamnese_capilar (cliente_id);

ALTER TABLE ficha_anamnese_capilar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_ficha_anamnese" ON ficha_anamnese_capilar
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
