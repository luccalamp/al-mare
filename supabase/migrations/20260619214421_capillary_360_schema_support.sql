-- Capillary 360 support
-- Additive migration: keeps ficha_anamnese_capilar.dados as the source of truth
-- while adding searchable triage metadata and a secure table for future photo links.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $block$
BEGIN
  IF to_regclass('public.ficha_anamnese_capilar') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS capilar360_status text NOT NULL DEFAULT ''rascunho''';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS capilar360_attention_level text';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS capilar360_red_flags_count integer NOT NULL DEFAULT 0';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS capilar360_pending_questions_count integer NOT NULL DEFAULT 0';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS capilar360_summary text';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS capilar360_last_triage_at timestamptz';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS capilar360_reviewed_at timestamptz';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS capilar360_reviewed_by uuid';
    EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD COLUMN IF NOT EXISTS capilar360_metadata jsonb NOT NULL DEFAULT ''{}''::jsonb';

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ficha_anamnese_capilar_schema_version_check'
    ) THEN
      EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD CONSTRAINT ficha_anamnese_capilar_schema_version_check CHECK (schema_version >= 1)';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ficha_anamnese_capilar_capilar360_status_check'
    ) THEN
      EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD CONSTRAINT ficha_anamnese_capilar_capilar360_status_check CHECK (capilar360_status IN (''rascunho'', ''em_andamento'', ''revisada'', ''arquivada''))';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ficha_anamnese_capilar_capilar360_attention_check'
    ) THEN
      EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD CONSTRAINT ficha_anamnese_capilar_capilar360_attention_check CHECK (capilar360_attention_level IS NULL OR capilar360_attention_level IN (''baixo'', ''moderado'', ''alto''))';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ficha_anamnese_capilar_capilar360_counts_check'
    ) THEN
      EXECUTE 'ALTER TABLE public.ficha_anamnese_capilar ADD CONSTRAINT ficha_anamnese_capilar_capilar360_counts_check CHECK (capilar360_red_flags_count >= 0 AND capilar360_pending_questions_count >= 0)';
    END IF;

    UPDATE public.ficha_anamnese_capilar
       SET schema_version = GREATEST(
             COALESCE(schema_version, 1),
             CASE
               WHEN dados ? 'schemaVersion' AND (dados ->> 'schemaVersion') ~ '^[0-9]+$'
                 THEN (dados ->> 'schemaVersion')::integer
               WHEN dados ? 'capilar360'
                 THEN 2
               ELSE 1
             END
           ),
           capilar360_status = CASE
             WHEN dados ? 'capilar360' AND capilar360_status = 'rascunho' THEN 'em_andamento'
             ELSE capilar360_status
           END
     WHERE dados IS NOT NULL
       AND (
         dados ? 'schemaVersion'
         OR dados ? 'capilar360'
         OR schema_version IS NULL
       );

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_capilar_schema_version ON public.ficha_anamnese_capilar (user_id, deleted_at, schema_version, updated_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_capilar_capilar360_attention ON public.ficha_anamnese_capilar (user_id, deleted_at, capilar360_attention_level, updated_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_capilar_capilar360_review ON public.ficha_anamnese_capilar (user_id, deleted_at, capilar360_status, capilar360_reviewed_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_capilar_dados_gin ON public.ficha_anamnese_capilar USING gin (dados jsonb_path_ops) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ficha_anamnese_capilar_capilar360_gin ON public.ficha_anamnese_capilar USING gin ((dados -> ''capilar360'') jsonb_path_ops) WHERE deleted_at IS NULL AND dados ? ''capilar360''';
  END IF;
END;
$block$;

CREATE TABLE IF NOT EXISTS public.ficha_capilar_360_photo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  cliente_id uuid NOT NULL,
  ficha_id uuid,
  photo_id uuid NOT NULL,
  section text NOT NULL,
  section_item_id text,
  label text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text
);

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ficha_capilar_360_photo_links_section_check'
  ) THEN
    ALTER TABLE public.ficha_capilar_360_photo_links
      ADD CONSTRAINT ficha_capilar_360_photo_links_section_check
      CHECK (section IN (
        'tricoscopia',
        'evolucao',
        'plano',
        'comparativo',
        'antes_protocolo',
        'resultado_parcial',
        'resultado_final'
      ));
  END IF;

  IF to_regclass('public.clientes') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ficha_capilar_360_photo_links_cliente_id_fkey'
  ) THEN
    ALTER TABLE public.ficha_capilar_360_photo_links
      ADD CONSTRAINT ficha_capilar_360_photo_links_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.ficha_anamnese_capilar') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'ficha_anamnese_capilar'
         AND column_name = 'id'
     )
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'ficha_capilar_360_photo_links_ficha_id_fkey'
     ) THEN
    ALTER TABLE public.ficha_capilar_360_photo_links
      ADD CONSTRAINT ficha_capilar_360_photo_links_ficha_id_fkey
      FOREIGN KEY (ficha_id) REFERENCES public.ficha_anamnese_capilar(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.client_photos') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ficha_capilar_360_photo_links_photo_id_fkey'
  ) THEN
    ALTER TABLE public.ficha_capilar_360_photo_links
      ADD CONSTRAINT ficha_capilar_360_photo_links_photo_id_fkey
      FOREIGN KEY (photo_id) REFERENCES public.client_photos(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.clientes') IS NOT NULL THEN
    UPDATE public.ficha_capilar_360_photo_links link_row
       SET user_id = client_row.user_id
      FROM public.clientes client_row
     WHERE link_row.cliente_id = client_row.id
       AND (link_row.user_id IS NULL OR link_row.user_id IS DISTINCT FROM client_row.user_id);
  END IF;

  IF to_regprocedure('private.sync_child_user_id_from_client()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_ficha_capilar_360_photo_links_sync_user_id ON public.ficha_capilar_360_photo_links;
    CREATE TRIGGER trg_ficha_capilar_360_photo_links_sync_user_id
      BEFORE INSERT OR UPDATE OF cliente_id
      ON public.ficha_capilar_360_photo_links
      FOR EACH ROW
      EXECUTE FUNCTION private.sync_child_user_id_from_client();
  END IF;

  IF to_regprocedure('public.touch_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_ficha_capilar_360_photo_links_touch_updated_at ON public.ficha_capilar_360_photo_links;
    CREATE TRIGGER trg_ficha_capilar_360_photo_links_touch_updated_at
      BEFORE UPDATE
      ON public.ficha_capilar_360_photo_links
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END;
$block$;

CREATE INDEX IF NOT EXISTS idx_ficha_capilar_360_photo_links_client_section
  ON public.ficha_capilar_360_photo_links (cliente_id, section, deleted_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ficha_capilar_360_photo_links_user_section
  ON public.ficha_capilar_360_photo_links (user_id, section, deleted_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ficha_capilar_360_photo_links_photo
  ON public.ficha_capilar_360_photo_links (photo_id, deleted_at);

ALTER TABLE public.ficha_capilar_360_photo_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ficha_capilar_360_photo_links FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ficha_capilar_360_photo_links TO authenticated;

DROP POLICY IF EXISTS ficha_capilar_360_photo_links_select_own ON public.ficha_capilar_360_photo_links;
CREATE POLICY ficha_capilar_360_photo_links_select_own
  ON public.ficha_capilar_360_photo_links
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS ficha_capilar_360_photo_links_insert_own ON public.ficha_capilar_360_photo_links;
CREATE POLICY ficha_capilar_360_photo_links_insert_own
  ON public.ficha_capilar_360_photo_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.clientes client_row
      WHERE client_row.id = cliente_id
        AND client_row.user_id = (select auth.uid())
        AND client_row.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.client_photos photo_row
      WHERE photo_row.id = photo_id
        AND photo_row.cliente_id = cliente_id
        AND photo_row.deleted_at IS NULL
    )
    AND (
      ficha_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.ficha_anamnese_capilar ficha_row
        WHERE ficha_row.id = ficha_id
          AND ficha_row.cliente_id = cliente_id
          AND ficha_row.user_id = (select auth.uid())
          AND ficha_row.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS ficha_capilar_360_photo_links_update_own ON public.ficha_capilar_360_photo_links;
CREATE POLICY ficha_capilar_360_photo_links_update_own
  ON public.ficha_capilar_360_photo_links
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid())
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.clientes client_row
      WHERE client_row.id = cliente_id
        AND client_row.user_id = (select auth.uid())
        AND client_row.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.client_photos photo_row
      WHERE photo_row.id = photo_id
        AND photo_row.cliente_id = cliente_id
        AND photo_row.deleted_at IS NULL
    )
    AND (
      ficha_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.ficha_anamnese_capilar ficha_row
        WHERE ficha_row.id = ficha_id
          AND ficha_row.cliente_id = cliente_id
          AND ficha_row.user_id = (select auth.uid())
          AND ficha_row.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS ficha_capilar_360_photo_links_delete_own ON public.ficha_capilar_360_photo_links;
CREATE POLICY ficha_capilar_360_photo_links_delete_own
  ON public.ficha_capilar_360_photo_links
  FOR DELETE
  TO authenticated
  USING (
    user_id = (select auth.uid())
  );

COMMIT;
