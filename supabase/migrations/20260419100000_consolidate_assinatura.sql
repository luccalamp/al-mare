-- Consolidar assinatura: remover redundância e adicionar restrição de tamanho
-- Eliminar colunas separadas que eram redundantes com o JSONB
-- Manter a assinatura apenas no campo JSONB dados.assinatura

-- Remover o índice antigo
DROP INDEX IF EXISTS idx_ficha_assinatura_exists;

-- Remover as colunas separadas (dados já estão preservados no JSONB)
ALTER TABLE ficha_anamnese_capilar
  DROP COLUMN IF EXISTS assinatura_base64,
  DROP COLUMN IF EXISTS data_assinatura;

-- Criar novo índice para otimizar buscas de fichas com assinatura (no JSONB)
CREATE INDEX IF NOT EXISTS idx_ficha_assinatura_exists_jsonb ON ficha_anamnese_capilar (cliente_id) 
  WHERE dados ->'assinatura'->>'assinaturaBD' IS NOT NULL;

-- Comentário sobre limites de tamanho
-- PostgreSQL TEXT pode armazenar até 1GB
-- Base64 é ~33% maior que dados binários, então:
-- - Imagem de 500KB = ~667KB base64 ✓ (sem problema)
-- - Imagem de 1MB = ~1.3MB base64 ✓ (ainda OK)
-- Recomendação: Validar no frontend que imagem tenha máximo 1MB ANTES de converter para base64
-- A função handleFileSelect já valida: if (file.size > 1024 * 1024)

-- Garantir que RLS está habilitado e permite UPDATE
-- (já está configurado em 20260418140000_ficha_anamnese_capilar.sql)
