import { NextRequest, NextResponse } from 'next/server';
import { getRouteClient } from '@/features/marketing/api/route-client';
import { buildStoragePath, getSignedUrl, uploadFile, type UploadBucket } from '@/features/marketing/utils/upload';

export const dynamic = 'force-dynamic';

const VISIT_FIELD_BY_DOCUMENT_TYPE: Record<string, string> = {
  SELFIE: 'selfie_url',
  GATE_PHOTO: 'gate_photo_url',
  VOICE_NOTE: 'voice_note_url',
};

export async function POST(request: NextRequest) {
  const client = getRouteClient(request.headers.get('authorization'));
  const formData = await request.formData();

  const file = formData.get('file');
  const bucket = formData.get('bucket') as UploadBucket | null;
  const entityType = formData.get('entityType') as 'visit' | 'company' | null;
  const entityId = formData.get('entityId') as string | null;
  const documentType = (formData.get('documentType') as string | null) ?? 'OTHER';
  const uploadedBy = formData.get('uploadedBy') as string | null;

  if (!(file instanceof File) || !bucket || !entityType || !entityId || !uploadedBy) {
    return NextResponse.json({ error: 'file, bucket, entityType, entityId and uploadedBy are required' }, { status: 400 });
  }

  const path = buildStoragePath(entityId, file);
  const { path: storedPath, error: uploadError } = await uploadFile(client, bucket, path, file);

  if (uploadError) {
    return NextResponse.json({ error: uploadError }, { status: 500 });
  }

  const table = entityType === 'visit' ? 'visit_documents' : 'company_documents';
  const insertRow: Record<string, unknown> = {
    name: file.name,
    type: documentType,
    url: storedPath, // storage path, not a signed URL — signed URLs are generated on read only
    uploaded_by: uploadedBy,
  };
  if (entityType === 'visit') insertRow.visit_id = entityId;
  else insertRow.company_id = entityId;

  const { data: docRow, error: insertError } = await client.from(table).insert([insertRow]).select().single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (entityType === 'visit') {
    const visitField = VISIT_FIELD_BY_DOCUMENT_TYPE[documentType];
    if (visitField) {
      await client.from('visits').update({ [visitField]: storedPath }).eq('id', entityId);
    }
  }

  const url = await getSignedUrl(client, bucket, storedPath);

  return NextResponse.json({ success: true, data: { id: docRow.id, path: storedPath, url } }, { status: 201 });
}
