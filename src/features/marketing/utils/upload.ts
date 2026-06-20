import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadBucket = "visit-photos" | "voice-notes" | "company-documents";

export interface UploadResult {
  path: string;
  size: number;
  mimeType: string;
}

/** Storage path pattern: {entityId}/{timestamp}-{randomSuffix}.{ext} (bucket is the Supabase Storage bucket itself, not part of the path). */
export function buildStoragePath(entityId: string, file: File): string {
  const ext = file.name.split(".").pop() ?? "bin";
  const timestamp = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${entityId}/${timestamp}-${suffix}.${ext}`;
}

/** Uploads a single file to Supabase Storage. Returns the storage path — never a signed URL, those are generated on read. */
export async function uploadFile(
  supabase: SupabaseClient,
  bucket: UploadBucket,
  path: string,
  file: File
): Promise<{ path: string; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (error) return { path: "", error: error.message };
  return { path: data.path, error: null };
}

/** Generates a signed URL for reading a stored file (default 1 hour expiry). */
export async function getSignedUrl(
  supabase: SupabaseClient,
  bucket: UploadBucket,
  path: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) return null;
  return data.signedUrl;
}

const BUCKET_LIMITS: Record<UploadBucket, { maxBytes: number; types: string[] }> = {
  "visit-photos": {
    maxBytes: 5 * 1024 * 1024,
    types: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  },
  "voice-notes": {
    maxBytes: 20 * 1024 * 1024,
    types: ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"],
  },
  "company-documents": {
    maxBytes: 10 * 1024 * 1024,
    types: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  },
};

/** Validates a file against the target bucket's size/type limits before any network call. */
export function validateFile(file: File, bucket: UploadBucket): { valid: boolean; error?: string } {
  const limit = BUCKET_LIMITS[bucket];
  if (file.size > limit.maxBytes) {
    const mb = (limit.maxBytes / 1024 / 1024).toFixed(0);
    return { valid: false, error: `File too large. Maximum size is ${mb}MB.` };
  }
  if (!limit.types.includes(file.type)) {
    return { valid: false, error: `File type not allowed: ${file.type || "unknown"}` };
  }
  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
