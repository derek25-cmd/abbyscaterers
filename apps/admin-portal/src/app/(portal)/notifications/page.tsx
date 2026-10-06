'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { AlertTriangle, Bell, BellOff } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-client';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  rfq_id: string | null;
  proforma_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface DeadlineRfq {
  id: string;
  title: string;
  proforma_required_by: string;
  status: string;
}

export default function NotificationsPage() {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const push = usePushNotifications();

  const notificationsQuery = useQuery({
    queryKey: ['portal-notifications-all', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_notifications')
        .select('id, type, title, body, rfq_id, proforma_id, is_read, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NotificationRow[];
    },
  });

  // Deadline approaching is a derived/live condition (proforma_required_by
  // within 24h, not yet answered) rather than a stored notification — no
  // sweep/cron needed, it's just always current when this page loads.
  const deadlinesQuery = useQuery({
    queryKey: ['rfq-deadlines-approaching'],
    queryFn: async () => {
      const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('rfqs')
        .select('id, title, proforma_required_by, status')
        .in('status', ['submitted', 'in_review'])
        .not('proforma_required_by', 'is', null)
        .lte('proforma_required_by', in24h)
        .order('proforma_required_by', { ascending: true });
      if (error) throw error;
      return data as DeadlineRfq[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('portal-notifications-page-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['portal-notifications-all', user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, user]);

  const markAllRead = async () => {
    await supabase.from('portal_notifications').update({ is_read: true }).eq('is_read', false);
    queryClient.invalidateQueries({ queryKey: ['portal-notifications-all', user?.id] });
  };

  const openNotification = async (n: NotificationRow) => {
    if (!n.is_read) {
      await supabase.from('portal_notifications').update({ is_read: true }).eq('id', n.id);
      queryClient.invalidateQueries({ queryKey: ['portal-notifications-all', user?.id] });
    }
    if (n.proforma_id) router.push(`/proformas/${n.proforma_id}`);
    else if (n.rfq_id) router.push(`/rfqs/${n.rfq_id}`);
  };

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">Email and SMS aren&apos;t set up yet — in-app and push only.</p>
        </div>
        <div className="flex items-center gap-2">
          {push.supported && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={push.subscribed ? push.disable : push.enable}
              disabled={push.loading}
            >
              {push.subscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {push.subscribed ? 'Disable push' : 'Enable push'}
            </Button>
          )}
          {unreadCount > 0 && (
            <Button type="button" variant="outline" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
      </div>
      {push.error && <p className="text-sm text-destructive">{push.error}</p>}

      {push.showContextualPrompt && (
        <Card className="border-primary/30 bg-primary/5">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-primary shrink-0" />
              Get notified when proformas need your approval — turn on notifications?
            </div>
            <div className="flex gap-2 shrink-0">
              <Button type="button" size="sm" onClick={push.enable} disabled={push.loading}>
                Enable
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={push.dismissContextualPrompt}>
                Not now
              </Button>
            </div>
          </div>
        </Card>
      )}

      {deadlinesQuery.data && deadlinesQuery.data.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <div className="p-4 space-y-2">
            <h2 className="font-medium flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="h-4 w-4" /> Deadlines approaching (next 24h)
            </h2>
            <ul className="text-sm space-y-1">
              {deadlinesQuery.data.map((r) => (
                <li key={r.id}>
                  <button onClick={() => router.push(`/rfqs/${r.id}`)} className="text-primary hover:underline">
                    {r.title}
                  </button>{' '}
                  <span className="text-muted-foreground">
                    — proforma required by {new Date(r.proforma_required_by).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Card className="divide-y divide-border">
        {notifications.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => openNotification(n)}
              className={`block w-full text-left p-4 text-sm hover:bg-muted/40 ${n.is_read ? 'opacity-60' : ''}`}
            >
              <p className="font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </button>
          ))
        )}
      </Card>
    </div>
  );
}
