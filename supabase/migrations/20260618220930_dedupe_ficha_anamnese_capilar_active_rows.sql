CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.jsonb_merge_missing_keys(primary_value jsonb, fallback_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb := COALESCE(primary_value, 'null'::jsonb);
  fallback_entry record;
  current_value jsonb;
BEGIN
  IF result = 'null'::jsonb THEN
    RETURN COALESCE(fallback_value, '{}'::jsonb);
  END IF;

  IF fallback_value IS NULL OR fallback_value = 'null'::jsonb THEN
    RETURN result;
  END IF;

  IF jsonb_typeof(result) <> 'object' OR jsonb_typeof(fallback_value) <> 'object' THEN
    RETURN result;
  END IF;

  FOR fallback_entry IN
    SELECT key, value
    FROM jsonb_each(fallback_value)
  LOOP
    current_value := result -> fallback_entry.key;

    IF current_value IS NULL OR current_value = 'null'::jsonb THEN
      result := jsonb_set(result, ARRAY[fallback_entry.key], fallback_entry.value, true);
    ELSIF jsonb_typeof(current_value) = 'object' AND jsonb_typeof(fallback_entry.value) = 'object' THEN
      result := jsonb_set(
        result,
        ARRAY[fallback_entry.key],
        private.jsonb_merge_missing_keys(current_value, fallback_entry.value),
        true
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

DO $$
DECLARE
  canonical record;
  duplicate record;
  merged_dados jsonb;
  dedup_reason constant text := 'deduplicated_active_record_20260618';
  dedup_timestamp constant timestamptz := timezone('utc', now());
BEGIN
  IF to_regclass('public.ficha_anamnese_capilar') IS NULL THEN
    RAISE NOTICE 'Skipping ficha_anamnese_capilar dedupe because the table does not exist.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ficha_anamnese_capilar'
      AND column_name IN ('cliente_id', 'dados', 'deleted_at')
    GROUP BY table_name
    HAVING COUNT(*) = 3
  ) THEN
    RAISE NOTICE 'Skipping ficha_anamnese_capilar dedupe because the table is missing required columns.';
    RETURN;
  END IF;

  FOR canonical IN
    WITH ranked AS (
      SELECT
        ctid AS row_ref,
        cliente_id,
        dados,
        ROW_NUMBER() OVER (
          PARTITION BY cliente_id
          ORDER BY COALESCE(updated_at, created_at, dedup_timestamp) DESC, created_at DESC, ctid DESC
        ) AS row_rank,
        COUNT(*) OVER (PARTITION BY cliente_id) AS active_count
      FROM public.ficha_anamnese_capilar
      WHERE deleted_at IS NULL
    )
    SELECT row_ref, cliente_id, dados
    FROM ranked
    WHERE row_rank = 1
      AND active_count > 1
  LOOP
    merged_dados := COALESCE(canonical.dados, '{}'::jsonb);

    FOR duplicate IN
      SELECT ctid AS row_ref, dados
      FROM public.ficha_anamnese_capilar
      WHERE cliente_id = canonical.cliente_id
        AND deleted_at IS NULL
        AND ctid <> canonical.row_ref
      ORDER BY COALESCE(updated_at, created_at, dedup_timestamp) DESC, created_at DESC, ctid DESC
    LOOP
      merged_dados := private.jsonb_merge_missing_keys(merged_dados, COALESCE(duplicate.dados, '{}'::jsonb));
    END LOOP;

    UPDATE public.ficha_anamnese_capilar
    SET dados = merged_dados,
        updated_at = dedup_timestamp
    WHERE ctid = canonical.row_ref;

    UPDATE public.ficha_anamnese_capilar
    SET deleted_at = COALESCE(deleted_at, dedup_timestamp),
        delete_reason = CASE
          WHEN delete_reason IS NULL OR btrim(delete_reason) = '' THEN dedup_reason
          WHEN delete_reason LIKE '%' || dedup_reason || '%' THEN delete_reason
          ELSE delete_reason || ' | ' || dedup_reason
        END
    WHERE cliente_id = canonical.cliente_id
      AND deleted_at IS NULL
      AND ctid <> canonical.row_ref;
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS private.jsonb_merge_missing_keys(jsonb, jsonb);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ficha_anamnese_capilar_cliente_unique
  ON public.ficha_anamnese_capilar (cliente_id)
  WHERE deleted_at IS NULL;
