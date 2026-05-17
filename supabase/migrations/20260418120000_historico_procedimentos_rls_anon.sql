-- Permite leitura/escrita em historico_procedimentos com a mesma chave anon usada no app (paridade com diagnostico_capilar).
DROP POLICY IF EXISTS "no_anon_formulas" ON historico_procedimentos;
DROP POLICY IF EXISTS "owner_only_formulas" ON historico_procedimentos;

CREATE POLICY "allow_all_historico_procedimentos" ON historico_procedimentos
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
