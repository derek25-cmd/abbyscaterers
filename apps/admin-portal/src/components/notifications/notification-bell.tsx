'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { Bell } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-client';

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  rfq_id: string | null;
  proforma_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ['portal-notifications', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_notifications')
        .select('id, title, body, rfq_id, proforma_id, is_read, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as NotificationRow[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('portal-notifications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['portal-notifications', user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, user]);

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  const handleOpenNotification = async (n: NotificationRow) => {
    if (!n.is_read) {
      await supabase.from('portal_notifications').update({ is_read: true }).eq('id', n.id);
      queryClient.invalidateQueries({ queryKey: ['portal-notifications', user?.id] });
    }
    setOpen(false);
    if (n.proforma_id) router.push(`/proformas/${n.proforma_id}`);
    else if (n.rfq_id) router.push(`/rfqs/${n.rfq_id}`);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-md border border-border bg-card shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-border text-sm font-medium">Notifications</div>
          {!notifications || notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleOpenNotification(n)}
                className={`block w-full text-left p-3 text-sm border-b border-border last:border-0 hover:bg-muted/60 ${
                  n.is_read ? 'opacity-60' : ''
                }`}
              >
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
