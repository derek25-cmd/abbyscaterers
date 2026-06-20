-- Storage buckets for marketing module file uploads
-- Run this in Supabase SQL editor or via CLI

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'visit-photos',
    'visit-photos',
    false,
    5242880, -- 5MB max per photo
    ARRAY['image/jpeg','image/png','image/webp','image/heic']
  ),
  (
    'voice-notes',
    'voice-notes',
    false,
    20971520, -- 20MB max per voice note
    ARRAY['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav']
  ),
  (
    'company-documents',
    'company-documents',
    false,
    10485760, -- 10MB max per document
    ARRAY['image/jpeg','image/png','image/webp','application/pdf']
  )
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies — only authenticated users can access these buckets.
-- Drop first so this migration can be re-run safely.
DROP POLICY IF EXISTS "Authenticated users can upload visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload company documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read company documents" ON storage.objects;

CREATE POLICY "Authenticated users can upload visit photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'visit-photos');

CREATE POLICY "Authenticated users can read visit photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'visit-photos');

CREATE POLICY "Authenticated users can upload voice notes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice-notes');

CREATE POLICY "Authenticated users can read voice notes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'voice-notes');

CREATE POLICY "Authenticated users can upload company documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-documents');

CREATE POLICY "Authenticated users can read company documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'company-documents');
