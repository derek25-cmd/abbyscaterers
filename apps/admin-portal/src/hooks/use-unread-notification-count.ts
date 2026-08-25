'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useSupabaseClient } from '@/lib/supabase-client';

/**
 * Shared between NotificationBell (desktop top bar) and BottomTabBar
 * (mobile) so both badges come from one query/cache entry instead of two
 * independent fetches racing each other.
 */
export function useUnreadNotificationCount() {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const queryClient = useQueryClient();

  const { data: count } = useQuery({
    queryKey: ['portal-notifications-unread-count', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('portal_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('portal-notifications-unread-count-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['portal-notifications-unread-count', user.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, user]);

  return count ?? 0;
}
