CREATE OR REPLACE FUNCTION public.submit_pre_consultation(p_token UUID, p_payload JSONB)
RETURNS TABLE (
  status TEXT,
  patient_name TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_cliente RECORD;
  existing_data JSONB := '{}'::jsonb;
  next_data JSONB := '{}'::jsonb;
  payload_nome TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'nome', '')), '');
  payload_whatsapp TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'whatsapp', '')), '');
  payload_queixa TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'queixaPrincipal', '')), '');
  payload_objetivo TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'objetivoTratamento', '')), '');
  payload_alergias TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'alergias', '')), '');
  payload_medicacoes TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'medicacoes', '')), '');
  payload_observacoes TEXT := NULLIF(BTRIM(COALESCE(p_payload ->> 'observacoes', '')), '');
  consentimento_dados BOOLEAN := COALESCE((p_payload ->> 'consentimentoDados')::BOOLEAN, FALSE);
  consentimento_imagem BOOLEAN := COALESCE((p_payload ->> 'consentimentoImagem')::BOOLEAN, FALSE);
  next_patient_name TEXT;
  notes TEXT;
BEGIN
  SELECT id, nome, whatsapp, COALESCE(link_ativo, FALSE) AS link_ativo
  INTO target_cliente
  FROM public.clientes
  WHERE token_pre_consulta = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 'not_found'::TEXT, NULL::TEXT, 'Este link nao foi encontrado ou ja expirou.'::TEXT;
    RETURN;
  END IF;

  IF NOT target_cliente.link_ativo THEN
    RETURN QUERY
    SELECT 'inactive'::TEXT, NULL::TEXT, 'Este link de pre-consulta ja foi encerrado pela clinica.'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(dados, '{}'::jsonb)
  INTO existing_data
  FROM public.ficha_anamnese_capilar
  WHERE cliente_id = target_cliente.id;

  notes := ARRAY_TO_STRING(
    ARRAY_REMOVE(
      ARRAY[
        CASE WHEN payload_objetivo IS NOT NULL THEN FORMAT('Objetivo: %s', payload_objetivo) END,
        CASE WHEN payload_observacoes IS NOT NULL THEN FORMAT('Observacoes: %s', payload_observacoes) END,
        FORMAT('Consentimento de dados: %s', CASE WHEN consentimento_dados THEN 'sim' ELSE 'nao' END),
        FORMAT('Consentimento de imagem: %s', CASE WHEN consentimento_imagem THEN 'sim' ELSE 'nao' END),
        FORMAT('Pre-consulta enviada em %s', TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI'))
      ],
      NULL
    ),
    E'\n\n'
  );

  next_data := existing_data
    || jsonb_build_object(
      'queixa',
      COALESCE(existing_data -> 'queixa', '{}'::jsonb)
      || jsonb_build_object(
        'queixaPrincipal', COALESCE(payload_queixa, COALESCE(existing_data #>> '{queixa,queixaPrincipal}', ''))
      ),
      'historicoPessoal',
      COALESCE(existing_data -> 'historicoPessoal', '{}'::jsonb)
      || jsonb_build_object(
        'alergia', CASE
          WHEN payload_alergias IS NOT NULL THEN TRUE
          WHEN LOWER(COALESCE(existing_data #>> '{historicoPessoal,alergia}', '')) IN ('true', 't', '1', 'sim') THEN TRUE
          ELSE FALSE
        END,
        'alergiaQual', COALESCE(payload_alergias, COALESCE(existing_data #>> '{historicoPessoal,alergiaQual}', '')),
        'medicacao', CASE
          WHEN payload_medicacoes IS NOT NULL THEN TRUE
          WHEN LOWER(COALESCE(existing_data #>> '{historicoPessoal,medicacao}', '')) IN ('true', 't', '1', 'sim') THEN TRUE
          ELSE FALSE
        END,
        'medicacaoQual', COALESCE(payload_medicacoes, COALESCE(existing_data #>> '{historicoPessoal,medicacaoQual}', ''))
      ),
      'evolucao',
      COALESCE(existing_data -> 'evolucao', '{}'::jsonb)
      || jsonb_build_object('notas', notes)
    );

  INSERT INTO public.ficha_anamnese_capilar (cliente_id, dados, updated_at)
  VALUES (target_cliente.id, next_data, NOW())
  ON CONFLICT (cliente_id)
  DO UPDATE SET
    dados = EXCLUDED.dados,
    updated_at = NOW();

  INSERT INTO public.pre_consulta_envios (
    cliente_id,
    token,
    payload,
    consentimento_dados,
    consentimento_imagem,
    enviado_em
  )
  VALUES (
    target_cliente.id,
    p_token,
    p_payload,
    consentimento_dados,
    consentimento_imagem,
    NOW()
  );

  UPDATE public.clientes
  SET
    nome = COALESCE(payload_nome, nome),
    whatsapp = COALESCE(payload_whatsapp, whatsapp),
    link_ativo = FALSE,
    pre_consulta_respondida_em = NOW(),
    updated_at = NOW()
  WHERE id = target_cliente.id
  RETURNING nome INTO next_patient_name;

  RETURN QUERY
  SELECT 'submitted'::TEXT, next_patient_name, NULL::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_pre_consultation_link(p_client_id UUID)
RETURNS TABLE (
  token UUID,
  link_active BOOLEAN,
  responded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_token UUID := gen_random_uuid();
BEGIN
  UPDATE public.clientes
  SET
    token_pre_consulta = next_token,
    link_ativo = TRUE,
    updated_at = NOW()
  WHERE id = p_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao encontrado para emitir link de pre-consulta.';
  END IF;

  RETURN QUERY
  SELECT next_token, TRUE, NULL::TIMESTAMPTZ;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_pre_consultation_link(p_client_id UUID)
RETURNS TABLE (
  token UUID,
  link_active BOOLEAN,
  responded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.clientes
  SET
    link_ativo = FALSE,
    updated_at = NOW()
  WHERE id = p_client_id
  RETURNING token_pre_consulta, FALSE, pre_consulta_respondida_em;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao encontrado para encerrar link de pre-consulta.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_pre_consultation(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_pre_consultation(UUID, JSONB) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.issue_pre_consultation_link(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_pre_consultation_link(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.deactivate_pre_consultation_link(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_pre_consultation_link(UUID) TO anon, authenticated;