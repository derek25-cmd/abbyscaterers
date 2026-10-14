import { supabase } from '@/lib/supabase-client';

// Leave documents are medical/family records: the bucket is private and a file
// is only ever opened through a short-lived signed URL, never getPublicUrl
// (which is what storageService.ts returns and is why it is not used here).
// See supabase/migrations/20261014000800_leave_attachments.sql.

export const LEAVE_ATTACHMENT_BUCKET = 'leave-attachments';
export const LEAVE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const LEAVE_ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const SIGNED_URL_SECONDS = 60;

/** Why a file cannot be attached, in plain words, or null if it is fine. */
export function validateLeaveAttachment(file: { size: number; type: string }): string | null {
  if (!LEAVE_ATTACHMENT_TYPES.includes(file.type)) return 'Please attach a PDF or a photo (JPG, PNG, WEBP or HEIC).';
  if (file.size > LEAVE_ATTACHMENT_MAX_BYTES) return 'This file is larger than 5 MB. Please attach a smaller file or a clearer scan.';
  return null;
}

/**
 * Uploads into the caller's own folder and returns the object PATH to store on
 * the request (not a URL). The storage policy only allows <your user id>/....
 */
export async function uploadLeaveAttachment(file: File): Promise<string> {
  const problem = validateLeaveAttachment(file);
  if (problem) throw new Error(problem);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You are signed out. Please sign in again to upload a document.');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(LEAVE_ATTACHMENT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Could not upload the document: ${error.message}`);
  return path;
}

/** A link that works for one minute. Only the uploader and HR can create it. */
export async function getLeaveAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(LEAVE_ATTACHMENT_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error('You do not have permission to open this document, or it no longer exists.');
  }
  return data.signedUrl;
}
