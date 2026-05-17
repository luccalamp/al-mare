-- Complementos de perfil do cliente para a anamnese importar dados sem duplicar campos.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS perfil_complementar JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.clientes
SET perfil_complementar = '{}'::jsonb
WHERE perfil_complementar IS NULL;

UPDATE public.clientes AS clientes
SET perfil_complementar = jsonb_strip_nulls(
  COALESCE(clientes.perfil_complementar, '{}'::jsonb)
  || jsonb_build_object(
    'endereco', NULLIF(ficha.dados #>> '{identificacao,endereco}', ''),
    'bairro', NULLIF(ficha.dados #>> '{identificacao,bairro}', ''),
    'cidadeEstado', NULLIF(ficha.dados #>> '{identificacao,cidadeEstado}', ''),
    'cep', NULLIF(ficha.dados #>> '{identificacao,cep}', ''),
    'telResidencial', NULLIF(ficha.dados #>> '{identificacao,telRes}', ''),
    'telComercial', NULLIF(ficha.dados #>> '{identificacao,telCom}', ''),
    'email', NULLIF(ficha.dados #>> '{identificacao,email}', ''),
    'profissao', NULLIF(ficha.dados #>> '{identificacao,profissao}', ''),
    'estadoCivil', NULLIF(ficha.dados #>> '{identificacao,estadoCivil}', ''),
    'assinatura', CASE
      WHEN NULLIF(ficha.dados #>> '{assinatura,assinaturaBD}', '') IS NOT NULL THEN jsonb_build_object(
        'imageDataUrl', ficha.dados #>> '{assinatura,assinaturaBD}',
        'signedAt', NULLIF(ficha.dados #>> '{assinatura,dataAssinatura}', '')
      )
      ELSE NULL
    END
  )
)
FROM public.ficha_anamnese_capilar AS ficha
WHERE ficha.cliente_id = clientes.id;

CREATE INDEX IF NOT EXISTS idx_clientes_perfil_complementar_gin
  ON public.clientes
  USING gin (perfil_complementar);