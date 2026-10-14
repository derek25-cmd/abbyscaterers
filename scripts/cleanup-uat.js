/**
 * Removes the UAT test data before go-live (cleanup_uat_data, migration
 * 20261014002100), then the test files in storage, which Supabase only allows
 * through the Storage API.
 *
 *   node scripts/cleanup-uat.js                     dry run: prints what would be removed
 *   node scripts/cleanup-uat.js --confirm           removes the rows (one transaction), then the files
 *   node scripts/cleanup-uat.js --files-from-audit  only the files, listed by the last 'uat.cleanup'
 *                                                   (use this if the rows were removed in the SQL editor)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
// Environment: real variables first, then .env and apps/catering-system/.env.local if present (Node 20.12+).
for (const file of ['.env', 'apps/catering-system/.env.local']) {
  try { process.loadEnvFile(file); } catch { /* not there: fine */ }
}
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const confirm = process.argv.includes('--confirm');
const filesOnly = process.argv.includes('--files-from-audit');

async function removeFiles(files) {
  const byBucket = new Map();
  for (const f of files || []) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) || []), f.path]);
  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { data, error } = await db.storage.from(bucket).remove(chunk);
      if (error) { console.error(`  ${bucket}: ${error.message}`); continue; }
      removed += (data || []).length;
    }
  }
  console.log(`Files removed: ${removed} of ${(files || []).length}.`);
}

(async () => {
  if (filesOnly) {
    const { data, error } = await db.from('audit_log').select('metadata, created_at')
      .eq('action', 'uat.cleanup').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error || !data) { console.error('No uat.cleanup entry found in the Audit Trail.', error ? error.message : ''); process.exit(1); }
    console.log(`Removing the files listed by the cleanup of ${data.created_at}.`);
    await removeFiles(data.metadata.files);
    return;
  }

  const { data, error } = await db.rpc('cleanup_uat_data', { p_dry_run: !confirm });
  if (error) { console.error('Cleanup failed, nothing was removed:', error.message); process.exit(1); }
  console.log(JSON.stringify({ ...data, files: `${(data.files || []).length} file(s)` }, null, 2));
  if (!confirm) {
    console.log('\nDry run: nothing was removed. Check the employees, logins and candidates above are ALL test data,');
    console.log('then run again with --confirm.');
    return;
  }
  await removeFiles(data.files);
  console.log('Done. Now run docs/hr-ops/postflight.sql: the "UAT data" checks must all PASS.');
})().catch((err) => { console.error(err); process.exit(1); });
