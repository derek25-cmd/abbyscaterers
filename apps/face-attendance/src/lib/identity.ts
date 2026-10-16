import type { FaceIdentity } from '@abbyscaterers/types';
import { FaceIdentitySchema } from '@abbyscaterers/validation';
import type { SupabaseClient } from '@abbyscaterers/database';

/**
 * Who the signed-in user is for this app, decided by the database
 * (face_whoami(), 20261016000400_face_attendance_access.sql), never by
 * reading staff_users or attendance_devices from the client:
 *   'hr'     active staff who can manage HR (admin, hr_manager, general_manager)
 *   'device' an active kiosk device login
 *   'none'   anyone else, including a failed lookup
 */
export async function whoami(supabase: SupabaseClient): Promise<FaceIdentity> {
  const { data, error } = await supabase.rpc('face_whoami');
  if (error) {
    console.error('face_whoami failed:', error.message);
    return 'none';
  }
  const parsed = FaceIdentitySchema.safeParse(data);
  return parsed.success ? parsed.data : 'none';
}

/** Where each identity lands after sign-in. */
export const HOME_FOR: Record<FaceIdentity, string> = {
  hr: '/review',
  device: '/kiosk',
  none: '/not-allowed',
};

/** Which identities may open each area. HR may open the kiosk for testing. */
export const AREA_ACCESS: { prefix: string; allowed: readonly FaceIdentity[] }[] = [
  { prefix: '/review', allowed: ['hr'] },
  { prefix: '/enroll', allowed: ['hr'] },
  { prefix: '/kiosk', allowed: ['device', 'hr'] },
];

export function allowedFor(pathname: string): readonly FaceIdentity[] | null {
  const area = AREA_ACCESS.find(a => pathname === a.prefix || pathname.startsWith(a.prefix + '/'));
  return area ? area.allowed : null;
}
