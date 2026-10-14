import { getAdminClient } from '@/lib/supabase-admin';
import { logger } from '@/lib/logger';
import { isHrModuleOnServer } from '@/lib/hr-modules-server';

export const dynamic = 'force-dynamic';

/**
 * Runs at 01:00 UTC on 1 January (vercel.json) and opens the new leave year:
 * creates every active employee's balances and carries unused days over up to
 * each leave type's limit (open_leave_year, supabase/migrations/20261014000700).
 *
 * At that moment the new leave year is the current calendar year, so that is
 * what is opened. open_leave_year only adds missing rows, so a repeat run, or a
 * manual one with ?year=2027, is harmless. It needs the service-role key
 * because the function refuses everyone but HR and the service role.
 */
export async function GET(request: Request) {
  // Same check as the other cron routes.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requested = Number(new URL(request.url).searchParams.get('year'));
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100
    ? requested
    : new Date().getUTCFullYear();

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    logger.error({ err }, 'cron: leave-year-end cannot run without the service-role key');
    return Response.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' }, { status: 500 });
  }

  // HR module switch (app_settings.hr_modules): when 'leave' is off, do nothing.
  if (!(await isHrModuleOnServer(client, 'leave'))) {
    logger.info({ module: 'leave' }, 'cron: module switched off, nothing done');
    return Response.json({ success: true, skipped: 'The leave module is switched off.' });
  }

  const { data, error } = await client.rpc('open_leave_year', { p_year: year });
  if (error) {
    logger.error({ err: error, year }, 'cron: open_leave_year failed');
    return Response.json({ success: false, year, error: error.message }, { status: 500 });
  }

  logger.info({ year, created: data }, 'cron: leave year opened');
  return Response.json({ success: true, year, balancesCreated: data ?? 0, timestamp: new Date().toISOString() });
}
