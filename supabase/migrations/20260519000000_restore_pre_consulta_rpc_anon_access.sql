-- Restaurar permissão de execução do RPC submit_pre_consultation para anon/authenticated
-- O portal do cliente precisa chamar este RPC sem autenticação de staff

GRANT EXECUTE ON FUNCTION public.submit_pre_consultation(UUID, JSONB) TO anon, authenticated;
