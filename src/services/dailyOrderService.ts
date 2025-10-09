
import { supabase } from '@/lib/supabase-client';
import type { DailyOrder } from '@/types';
import type { DailyOrderFormData } from '@/lib/schemas';

export const getDailyOrdersForBooking = async (bookingId: string): Promise<DailyOrder[]> => {
    const { data, error } = await supabase.from('daily_orders').select('*').eq('bookingId', bookingId).order('orderDate', { ascending: true });
    if (error) {
        console.error('Error fetching daily orders:', error);
        return [];
    }
    return data as DailyOrder[];
};

export const addDailyOrder = async (orderData: DailyOrderFormData): Promise<DailyOrder | null> => {
    const now = new Date().toISOString();
    const newOrderData = { ...orderData, createdAt: now, updatedAt: now };

    const { data, error } = await supabase.from('daily_orders').insert([newOrderData]).select();
    if (error) {
        console.error('Error adding daily order:', error);
        return null;
    }
    return data?.[0] as DailyOrder;
};

export const updateDailyOrder = async (id: string, updates: Partial<DailyOrderFormData>): Promise<boolean> => {
    const { error } = await supabase.from('daily_orders').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) {
        console.error('Error updating daily order:', error);
    }
    return !error;
};

export const deleteDailyOrder = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('daily_orders').delete().eq('id', id);
    if (error) {
        console.error('Error deleting daily order:', error);
    }
    return !error;
};
