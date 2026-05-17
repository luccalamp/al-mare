-- ============================================================
-- ILUMINARE STUDIO OPERATIONAL SCHEMA - REFATORAÇÃO DE LUXO
-- ============================================================

-- Limpeza de tabelas antigas para evitar conflitos de nomes
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS technical_sheets CASCADE;
DROP TABLE IF EXISTS hair_diagnostics CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS client_photos CASCADE;

-- 1. Módulo de Identidade (clientes)
-- Foco: Contato e Social. Exclusivamente feminino.
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    instagram_handle VARCHAR(100),
    data_aniversario DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Módulo de Diagnóstico (diagnostico_capilar)
-- Registrado em cada consulta técnica.
CREATE TABLE diagnostico_capilar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    elasticidade INTEGER CHECK (elasticidade BETWEEN 1 AND 3), -- Escala 1-3
    porosidade INTEGER CHECK (porosidade BETWEEN 1 AND 5), -- Escala 1-5
    historia_quimica_previa TEXT,
    presenca_metais BOOLEAN DEFAULT FALSE,
    resultado_teste_mecha TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Módulo de Colorimetria (historico_procedimentos)
-- Propriedade Intelectual do Iluminare Studio (Fórmulas Secretas)
CREATE TABLE historico_procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tecnica_utilizada VARCHAR(150), -- ex: Contour, Ombré, Global
    altura_clareamento INTEGER CHECK (altura_clareamento BETWEEN 1 AND 10),
    fundo_clareamento_obtido VARCHAR(10), -- ex: 9.3, 10.0
    mistura_tonalizante TEXT, -- Receita Exata
    volumagem_ox VARCHAR(50), -- ex: 7vol, 20vol
    valor_procedimento DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Módulo de Pós-Venda (manutencao_homecare)
CREATE TABLE manutencao_homecare (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    produtos_recomendados TEXT,
    data_retorno_sugerida DATE,
    obs_cuidados TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Galeria de Fotos (Mantendo integração com Storage)
CREATE TABLE client_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'referencia',
    caption TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- ARQUITETURA DE SEGURANÇA (RLS)
-- ============================================================

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostico_capilar ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencao_homecare ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_photos ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Público (anon/authenticated) para cadastro e diagnóstico básico
CREATE POLICY "allow_all_for_basic" ON clientes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_for_diagnosis" ON diagnostico_capilar FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_for_photos" ON client_photos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Polística de Segurança Estrita: Apenas o DONO (usuário autenticado) vê fórmulas de cor e manutenção
CREATE POLICY "owner_only_formulas" ON historico_procedimentos 
    FOR ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "owner_only_homecare" ON manutencao_homecare 
    FOR ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Impedir acesso anon às fórmulas
CREATE POLICY "no_anon_formulas" ON historico_procedimentos 
    FOR SELECT TO anon 
    USING (false);

CREATE POLICY "no_anon_homecare" ON manutencao_homecare 
    FOR SELECT TO anon 
    USING (false);
