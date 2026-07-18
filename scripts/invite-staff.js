/**
 * Admin-only staff provisioning, replacing the open public sign-up removed
 * from src/app/login/page.tsx. Requires SUPABASE_SERVICE_ROLE_KEY, so this
 * must only ever be run from a trusted machine/CI, never shipped client-side.
 *
 * Usage: node scripts/invite-staff.js someone@abbyscaterers.com [role]
 *   role defaults to "staff"; valid values: admin, finance, staff
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const email = process.argv[2];
const role = process.argv[3] || 'staff';

if (!email) {
  console.error('Usage: node scripts/invite-staff.js <email> [role]');
  process.exit(1);
}
if (!['admin', 'finance', 'staff'].includes(role)) {
  console.error(`Invalid role "${role}". Must be one of: admin, finance, staff.`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) {
    console.error('Invite failed:', error.message);
    process.exit(1);
  }

  const { error: staffError } = await admin
    .from('staff_users')
    .upsert({ id: data.user.id, email, role, is_active: true }, { onConflict: 'id' });
  if (staffError) {
    console.error('Invited the user but failed to add them to staff_users:', staffError.message);
    process.exit(1);
  }

  console.log(`Invited ${email} as "${role}" and added to staff_users.`);
}

main();
