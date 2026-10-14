import { getAdminClient } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Runs daily at 04:00 UTC, 07:00 in Dar es Salaam (vercel.json), and does the
 * contract housekeeping in one database call (run_contract_expiry_job,
 * supabase/migrations/20261014001700), in this order:
 *  1. 60/30/7-day reminders to HR, then one "overdue" notice, at most once per
 *     contract and threshold (contract_expiry_notices);
 *  2. contracts past their end date are marked expired;
 *  3. offers past their acceptance deadline are marked expired;
 *  4. warnings past their expiry date are marked expired.
 *
 * "Today" is the date in Dar es Salaam. A manual run can pass ?date=YYYY-MM-DD.
 * A repeat run on the same day sends nothing new. It needs the service-role
 * key because the function refuses everyone but HR and the service role.
 */
export async function GET(request: Request) {
  // Same check as the other cron routes.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get('date');
  const today = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && !Number.isNaN(Date.parse(requested))
    ? requested
    : new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dar_es_Salaam' }).format(new Date());

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    logger.error({ err }, 'cron: contract-expiry cannot run without the service-role key');
    return Response.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' }, { status: 500 });
  }

  const { data, error } = await client.rpc('run_contract_expiry_job', { p_today: today });
  if (error) {
    logger.error({ err: error, today }, 'cron: run_contract_expiry_job failed');
    return Response.json({ success: false, today, error: error.message }, { status: 500 });
  }

  logger.info({ today, result: data }, 'cron: contract expiry job done');
  return Response.json({ success: true, today, result: data, timestamp: new Date().toISOString() });
}
