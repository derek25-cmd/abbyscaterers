'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { Bell } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

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
    if (n.proforma_id) router.push(`/proformas/${n.proforma_id}`);
    else if (n.rfq_id) router.push(`/rfqs/${n.rfq_id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!notifications || notifications.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleOpenNotification(n)}
              className={`block w-full text-left p-2 rounded-sm text-sm hover:bg-accent ${
                n.is_read ? 'opacity-60' : ''
              }`}
            >
              <p className="font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </button>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
