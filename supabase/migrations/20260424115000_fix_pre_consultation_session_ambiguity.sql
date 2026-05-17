CREATE OR REPLACE FUNCTION public.get_pre_consultation_session(p_token UUID)
RETURNS TABLE (
  status TEXT,
  client_id UUID,
  patient_name TEXT,
  whatsapp TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_cliente RECORD;
BEGIN
  SELECT c.id, c.nome, c.whatsapp, COALESCE(c.link_ativo, FALSE) AS link_ativo
  INTO target_cliente
  FROM public.clientes AS c
  WHERE c.token_pre_consulta = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 'not_found'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, 'Este link nao foi encontrado ou ja expirou.'::TEXT;
    RETURN;
  END IF;

  IF NOT target_cliente.link_ativo THEN
    RETURN QUERY
    SELECT 'inactive'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, 'Este link de pre-consulta ja foi encerrado pela clinica.'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'ready'::TEXT, target_cliente.id, target_cliente.nome::TEXT, target_cliente.whatsapp::TEXT, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pre_consultation_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pre_consultation_session(UUID) TO anon, authenticated;