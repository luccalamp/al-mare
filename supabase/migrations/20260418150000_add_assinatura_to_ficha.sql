-- Adicionar coluna de assinatura à ficha de anamnese capilar
ALTER TABLE ficha_anamnese_capilar
  ADD COLUMN assinatura_base64 TEXT,
  ADD COLUMN data_assinatura TIMESTAMPTZ;

-- Índice para otimizar buscas por ficha com assinatura
CREATE INDEX IF NOT EXISTS idx_ficha_assinatura_exists ON ficha_anamnese_capilar (cliente_id) 
  WHERE assinatura_base64 IS NOT NULL;
