-- Migration: Google Drive file references table
-- Stores metadata for files uploaded to Google Drive,
-- keeping only lightweight references in Supabase.

CREATE TABLE IF NOT EXISTS public.google_drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  cliente_id UUID REFERENCES clientes(id),

  -- Google Drive identifiers
  drive_file_id TEXT NOT NULL,
  drive_web_view_link TEXT,
  drive_thumbnail_link TEXT,

  -- File metadata
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT DEFAULT 0,
  md5_checksum TEXT,

  -- Clinical context
  category TEXT DEFAULT 'referencia' CHECK (category IN ('antes', 'depois', 'referencia', 'anamnese', 'documento')),
  caption TEXT,
  anotacao_tecnica TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),

  -- Folder structure in Drive (e.g., "clientes/{cliente_id}/fotos")
  drive_folder_path TEXT,

  -- Sync status
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed', 'deleted')),
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  delete_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_gdrive_cliente ON google_drive_files(cliente_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gdrive_user ON google_drive_files(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gdrive_drive_id ON google_drive_files(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_gdrive_category ON google_drive_files(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gdrive_sync_status ON google_drive_files(sync_status) WHERE sync_status != 'synced';

-- RLS policies
ALTER TABLE public.google_drive_files ENABLE ROW LEVEL SECURITY;

-- Users can only see their own files
CREATE POLICY "Users can view own google drive files"
  ON public.google_drive_files
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own files
CREATE POLICY "Users can insert own google drive files"
  ON public.google_drive_files
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own files
CREATE POLICY "Users can update own google drive files"
  ON public.google_drive_files
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can soft-delete their own files
CREATE POLICY "Users can delete own google drive files"
  ON public.google_drive_files
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Trigger: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gdrive_touch_updated_at ON google_drive_files;
CREATE TRIGGER trg_gdrive_touch_updated_at
  BEFORE UPDATE ON google_drive_files
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();
