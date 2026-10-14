-- Phase 2: private storage for leave supporting documents (medical
-- certificates, birth certificates, ...). These are health and family records,
-- so unlike the public app-images bucket this one is NOT public and files are
-- only ever opened through short-lived signed URLs.
--
-- Object path convention: <uploader auth uid>/<random>-<filename>. The first
-- folder is the uploader's id, which is what the policies below key on, and
-- leave_requests.attachment_path stores this path (never a URL).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'leave-attachments', 'leave-attachments', false,
  5242880, -- 5 MB per document
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "leave_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "leave_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "leave_attachments_delete" ON storage.objects;

-- Any active staff member may upload, but only into their own folder.
CREATE POLICY "leave_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'leave-attachments'
    AND public.is_active_staff()
    AND (storage.foldername(name))[1] = public.safe_auth_uid()::text
  );

-- Readable (and so signable) only by the uploader and by HR. Other staff get
-- nothing, even though they can see that a request exists.
CREATE POLICY "leave_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'leave-attachments'
    AND (public.can_manage_hr() OR (storage.foldername(name))[1] = public.safe_auth_uid()::text)
  );

-- No UPDATE policy: documents are not edited in place. Only HR may delete.
CREATE POLICY "leave_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'leave-attachments' AND public.can_manage_hr());
