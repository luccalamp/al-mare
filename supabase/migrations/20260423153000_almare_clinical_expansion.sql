-- Expansão clínica Al'maré: agenda, pré-consulta, avatar e evolução fotográfica.
-- Esta migration é incremental e preserva dados existentes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'photo_category'
  ) THEN
    CREATE TYPE public.photo_category AS ENUM ('antes', 'depois', 'referencia');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'appointment_status'
  ) THEN
    CREATE TYPE public.appointment_status AS ENUM ('agendado', 'confirmado', 'realizado', 'cancelado', 'faltou');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'appointment_origin'
  ) THEN
    CREATE TYPE public.appointment_origin AS ENUM ('interno', 'google_calendar', 'n8n', 'manual');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_client_photo_category()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_category public.photo_category;
BEGIN
  normalized_category := CASE LOWER(COALESCE(NEW.categoria::text, NEW.type, 'referencia'))
    WHEN 'antes' THEN 'antes'::public.photo_category
    WHEN 'depois' THEN 'depois'::public.photo_category
    ELSE 'referencia'::public.photo_category
  END;

  NEW.categoria = normalized_category;
  NEW.type = normalized_category::text;
  NEW.captured_at = COALESCE(NEW.captured_at, NEW.created_at, NOW());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_pre_consultation_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.token_pre_consulta, NULL) IS NULL THEN
    NEW.link_ativo = FALSE;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.token_pre_consulta IS DISTINCT FROM OLD.token_pre_consulta
     AND COALESCE(NEW.link_ativo, FALSE) THEN
    NEW.pre_consulta_respondida_em = NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  instagram_handle VARCHAR(100),
  data_aniversario DATE,
  photo_url TEXT,
  canal_aquisicao TEXT,
  token_pre_consulta UUID,
  link_ativo BOOLEAN NOT NULL DEFAULT FALSE,
  pre_consulta_respondida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS canal_aquisicao TEXT,
  ADD COLUMN IF NOT EXISTS token_pre_consulta UUID,
  ADD COLUMN IF NOT EXISTS link_ativo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pre_consulta_respondida_em TIMESTAMPTZ;

ALTER TABLE public.clientes
  ALTER COLUMN link_ativo SET DEFAULT FALSE,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.clientes
SET link_ativo = FALSE
WHERE link_ativo IS NULL;

ALTER TABLE public.clientes
  ALTER COLUMN link_ativo SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_token_pre_consulta
  ON public.clientes (token_pre_consulta)
  WHERE token_pre_consulta IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_canal_aquisicao
  ON public.clientes (canal_aquisicao);

CREATE INDEX IF NOT EXISTS idx_clientes_created_at
  ON public.clientes (created_at DESC);

DROP TRIGGER IF EXISTS trg_clientes_touch_updated_at ON public.clientes;
CREATE TRIGGER trg_clientes_touch_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_clientes_pre_consultation_state ON public.clientes;
CREATE TRIGGER trg_clientes_pre_consultation_state
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.sync_pre_consultation_state();

CREATE TABLE IF NOT EXISTS public.client_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'referencia',
  categoria public.photo_category NOT NULL DEFAULT 'referencia',
  caption TEXT,
  anotacao_tecnica TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.client_photos
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'referencia',
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS anotacao_tecnica TEXT,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_photos'
      AND column_name = 'categoria'
  ) THEN
    ALTER TABLE public.client_photos
      ADD COLUMN categoria public.photo_category NOT NULL DEFAULT 'referencia';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_photos'
      AND column_name = 'categoria'
      AND udt_name <> 'photo_category'
  ) THEN
    ALTER TABLE public.client_photos
      ALTER COLUMN categoria TYPE public.photo_category
      USING CASE LOWER(COALESCE(categoria::text, 'referencia'))
        WHEN 'antes' THEN 'antes'::public.photo_category
        WHEN 'depois' THEN 'depois'::public.photo_category
        ELSE 'referencia'::public.photo_category
      END;
  END IF;
END $$;

ALTER TABLE public.client_photos
  ALTER COLUMN categoria SET DEFAULT 'referencia',
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN captured_at SET DEFAULT NOW();

UPDATE public.client_photos
SET
  categoria = CASE LOWER(COALESCE(categoria::text, type, 'referencia'))
    WHEN 'antes' THEN 'antes'::public.photo_category
    WHEN 'depois' THEN 'depois'::public.photo_category
    ELSE 'referencia'::public.photo_category
  END,
  type = CASE LOWER(COALESCE(categoria::text, type, 'referencia'))
    WHEN 'antes' THEN 'antes'
    WHEN 'depois' THEN 'depois'
    ELSE 'referencia'
  END,
  captured_at = COALESCE(captured_at, created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());

ALTER TABLE public.client_photos
  ALTER COLUMN categoria SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_photos_cliente_categoria
  ON public.client_photos (cliente_id, categoria, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_photos_captured_at
  ON public.client_photos (captured_at DESC);

DROP TRIGGER IF EXISTS trg_client_photos_touch_updated_at ON public.client_photos;
CREATE TRIGGER trg_client_photos_touch_updated_at
BEFORE UPDATE ON public.client_photos
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_client_photos_sync_category ON public.client_photos;
CREATE TRIGGER trg_client_photos_sync_category
BEFORE INSERT OR UPDATE ON public.client_photos
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_photo_category();

WITH preferred_photo AS (
  SELECT DISTINCT ON (p.cliente_id)
    p.cliente_id,
    p.url
  FROM public.client_photos p
  ORDER BY
    p.cliente_id,
    CASE p.categoria
      WHEN 'referencia' THEN 0
      WHEN 'depois' THEN 1
      ELSE 2
    END,
    COALESCE(p.captured_at, p.created_at) DESC
)
UPDATE public.clientes c
SET photo_url = preferred_photo.url
FROM preferred_photo
WHERE c.id = preferred_photo.cliente_id
  AND c.photo_url IS NULL;

CREATE TABLE IF NOT EXISTS public.ficha_anamnese_capilar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_cliente
  ON public.ficha_anamnese_capilar (cliente_id);

DROP TRIGGER IF EXISTS trg_ficha_anamnese_touch_updated_at ON public.ficha_anamnese_capilar;
CREATE TRIGGER trg_ficha_anamnese_touch_updated_at
BEFORE UPDATE ON public.ficha_anamnese_capilar
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  inicio_em TIMESTAMPTZ NOT NULL,
  fim_em TIMESTAMPTZ NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'agendado',
  origem public.appointment_origin NOT NULL DEFAULT 'interno',
  google_event_id TEXT,
  google_calendar_id TEXT,
  n8n_workflow_id TEXT,
  n8n_execution_id TEXT,
  observacoes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agendamentos_time_range CHECK (fim_em > inicio_em)
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente_inicio
  ON public.agendamentos (cliente_id, inicio_em DESC);

CREATE INDEX IF NOT EXISTS idx_agendamentos_status_inicio
  ON public.agendamentos (status, inicio_em DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamentos_google_event_id
  ON public.agendamentos (google_event_id)
  WHERE google_event_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_agendamentos_touch_updated_at ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_touch_updated_at
BEFORE UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.pre_consulta_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  token UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  consentimento_dados BOOLEAN NOT NULL DEFAULT FALSE,
  consentimento_imagem BOOLEAN NOT NULL DEFAULT FALSE,
  origem TEXT NOT NULL DEFAULT 'link_publico',
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pre_consulta_envios_cliente
  ON public.pre_consulta_envios (cliente_id, enviado_em DESC);

CREATE INDEX IF NOT EXISTS idx_pre_consulta_envios_token
  ON public.pre_consulta_envios (token)
  WHERE token IS NOT NULL;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha_anamnese_capilar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pre_consulta_envios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ficha_anamnese_capilar' AND policyname = 'allow_all_ficha_anamnese'
  ) THEN
    CREATE POLICY "allow_all_ficha_anamnese" ON public.ficha_anamnese_capilar
      FOR ALL TO anon, authenticated
      USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agendamentos' AND policyname = 'allow_all_agendamentos'
  ) THEN
    CREATE POLICY "allow_all_agendamentos" ON public.agendamentos
      FOR ALL TO anon, authenticated
      USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pre_consulta_envios' AND policyname = 'authenticated_pre_consulta_envios'
  ) THEN
    CREATE POLICY "authenticated_pre_consulta_envios" ON public.pre_consulta_envios
      FOR ALL TO authenticated
      USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

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
  SELECT id, nome, whatsapp, COALESCE(link_ativo, FALSE) AS link_ativo
  INTO target_cliente
  FROM public.clientes
  WHERE token_pre_consulta = p_token
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
  SELECT 'ready'::TEXT, target_cliente.id, target_cliente.nome, target_cliente.whatsapp, NULL::TEXT;
END;
$$;

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
      'identificacao',
      COALESCE(existing_data -> 'identificacao', '{}'::jsonb)
      || jsonb_build_object(
        'nome', COALESCE(payload_nome, target_cliente.nome),
        'celular', COALESCE(payload_whatsapp, target_cliente.whatsapp, COALESCE(existing_data #>> '{identificacao,celular}', ''))
      ),
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
    link_ativo = FALSE,
    pre_consulta_respondida_em = NOW(),
    updated_at = NOW()
  WHERE id = target_cliente.id;

  RETURN QUERY
  SELECT 'submitted'::TEXT, target_cliente.nome, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_pre_consultation_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pre_consultation_session(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_pre_consultation(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_pre_consultation(UUID, JSONB) TO anon, authenticated;