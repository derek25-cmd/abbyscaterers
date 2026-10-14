import { supabase } from '@/lib/supabase-client';

export interface HrNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

// Rows are created by database functions (see 20261014000900_hr_notifications.sql)
// and RLS lets each person see and mark only their own.

/** Latest notifications for the signed-in user. Returns [] if the table is not there yet. */
export const getMyNotifications = async (limit = 30): Promise<HrNotification[]> => {
  const { data, error } = await supabase
    .from('hr_notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    // 42P01: migration not applied yet. Not worth a toast: the bell just shows app notices only.
    if (error.code !== '42P01') console.error('Error fetching notifications:', error);
    return [];
  }
  return (data ?? []) as HrNotification[];
};

export const markNotificationRead = async (id: string): Promise<void> => {
  const { error } = await supabase.from('hr_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) console.error('Error marking notification read:', error);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const { error } = await supabase
    .from('hr_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) console.error('Error marking notifications read:', error);
};
