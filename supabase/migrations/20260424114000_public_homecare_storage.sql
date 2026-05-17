-- Align public client writes with the current salon app behavior.

DROP POLICY IF EXISTS "owner_only_homecare" ON public.manutencao_homecare;
DROP POLICY IF EXISTS "no_anon_homecare" ON public.manutencao_homecare;
DROP POLICY IF EXISTS "allow_all_manutencao_homecare" ON public.manutencao_homecare;

CREATE POLICY "allow_all_manutencao_homecare" ON public.manutencao_homecare
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anamnese-fotos',
  'anamnese-fotos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "allow_public_anamnese_fotos_uploads" ON storage.objects;

CREATE POLICY "allow_public_anamnese_fotos_uploads" ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'anamnese-fotos');