CREATE TABLE IF NOT EXISTS public.company_document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_document_folders_nome_unique
  ON public.company_document_folders (LOWER(nome));

DROP TRIGGER IF EXISTS trg_company_document_folders_touch_updated_at ON public.company_document_folders;
CREATE TRIGGER trg_company_document_folders_touch_updated_at
BEFORE UPDATE ON public.company_document_folders
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES public.company_document_folders(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_documents_folder_created_at
  ON public.company_documents (folder_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_company_documents_touch_updated_at ON public.company_documents;
CREATE TRIGGER trg_company_documents_touch_updated_at
BEFORE UPDATE ON public.company_documents
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.company_document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_document_folders'
      AND policyname = 'allow_all_company_document_folders'
  ) THEN
    CREATE POLICY "allow_all_company_document_folders" ON public.company_document_folders
      FOR ALL TO anon, authenticated
      USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_documents'
      AND policyname = 'allow_all_company_documents'
  ) THEN
    CREATE POLICY "allow_all_company_documents" ON public.company_documents
      FOR ALL TO anon, authenticated
      USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

INSERT INTO public.company_document_folders (nome)
SELECT 'Geral'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_document_folders
  WHERE LOWER(nome) = 'geral'
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-documents',
  'company-documents',
  true,
  15728640,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "allow_company_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "allow_company_documents_upload" ON storage.objects;
DROP POLICY IF EXISTS "allow_company_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "allow_company_documents_delete" ON storage.objects;

CREATE POLICY "allow_company_documents_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'company-documents');

CREATE POLICY "allow_company_documents_upload" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'company-documents');

CREATE POLICY "allow_company_documents_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'company-documents')
  WITH CHECK (bucket_id = 'company-documents');

CREATE POLICY "allow_company_documents_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'company-documents');