import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const PUSH_WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:admin@abbyscaterers.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface NotificationRecord {
  portal_user_id: string;
  type: string;
  title: string;
  body: string | null;
  rfq_id: string | null;
  proforma_id: string | null;
}

// Shape Supabase's Database Webhooks POST on table events.
interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: NotificationRecord;
}

// Called by a Supabase Database Webhook (configured in the dashboard, not
// in a migration — see the setup checklist) on INSERT into
// portal_notifications. Not Clerk-gated (exempted in middleware.ts) since
// the caller has no user session; a shared secret stands in for auth.
export async function POST(req: Request) {
  if (!PUSH_WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Push not configured (missing VAPID keys)' }, { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (payload.table !== 'portal_notifications' || payload.type !== 'INSERT') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { record } = payload;
  const supabase = createSupabaseAdminClient();
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('portal_user_id', record.portal_user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const url = record.proforma_id
    ? `/proformas/${record.proforma_id}`
    : record.rfq_id
      ? `/rfqs/${record.rfq_id}`
      : '/notifications';

  const notificationPayload = JSON.stringify({
    title: record.title,
    body: record.body ?? '',
    url,
  });

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notificationPayload
        );
        sent += 1;
      } catch (err) {
        // 410 Gone (or 404) means the subscription is no longer valid on
        // the push service's end — clean it up rather than retrying forever.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    })
  );

  return NextResponse.json({ ok: true, sent });
}
