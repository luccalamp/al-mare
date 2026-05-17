CREATE OR REPLACE FUNCTION public.sync_client_photo_category()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  raw_category TEXT;
  normalized_category public.photo_category;
BEGIN
  raw_category := CASE
    WHEN LOWER(COALESCE(NEW.type, '')) IN ('antes', 'depois') THEN LOWER(NEW.type)
    WHEN LOWER(COALESCE(NEW.categoria::text, '')) IN ('antes', 'depois', 'referencia') THEN LOWER(NEW.categoria::text)
    WHEN LOWER(COALESCE(NEW.type, '')) = 'referencia' THEN 'referencia'
    ELSE ''
  END;

  IF raw_category = '' THEN
    raw_category := CASE
      WHEN LOWER(COALESCE(NEW.url, '')) LIKE '%captura-antes%' OR LOWER(COALESCE(NEW.url, '')) LIKE '%/antes/%' THEN 'antes'
      WHEN LOWER(COALESCE(NEW.url, '')) LIKE '%captura-depois%' OR LOWER(COALESCE(NEW.url, '')) LIKE '%/depois/%' THEN 'depois'
      ELSE 'referencia'
    END;
  END IF;

  normalized_category := CASE raw_category
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

UPDATE public.client_photos
SET
  categoria = CASE
    WHEN LOWER(COALESCE(type, '')) = 'antes'
      OR LOWER(COALESCE(url, '')) LIKE '%captura-antes%'
      OR LOWER(COALESCE(url, '')) LIKE '%/antes/%'
      THEN 'antes'::public.photo_category
    WHEN LOWER(COALESCE(type, '')) = 'depois'
      OR LOWER(COALESCE(url, '')) LIKE '%captura-depois%'
      OR LOWER(COALESCE(url, '')) LIKE '%/depois/%'
      THEN 'depois'::public.photo_category
    ELSE 'referencia'::public.photo_category
  END,
  type = CASE
    WHEN LOWER(COALESCE(type, '')) = 'antes'
      OR LOWER(COALESCE(url, '')) LIKE '%captura-antes%'
      OR LOWER(COALESCE(url, '')) LIKE '%/antes/%'
      THEN 'antes'
    WHEN LOWER(COALESCE(type, '')) = 'depois'
      OR LOWER(COALESCE(url, '')) LIKE '%captura-depois%'
      OR LOWER(COALESCE(url, '')) LIKE '%/depois/%'
      THEN 'depois'
    ELSE 'referencia'
  END,
  updated_at = NOW();

DROP POLICY IF EXISTS "allow_public_anamnese_fotos_deletes" ON storage.objects;

CREATE POLICY "allow_public_anamnese_fotos_deletes" ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'anamnese-fotos');