import { supabase } from '@/lib/supabase-client';
import type { Order } from '@/types';
import type { OrderFormData } from '@/lib/schemas';
import { format } from 'date-fns';

export const getOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*');
    if (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
    return data as Order[];
};

export const getOrderById = async (id: string): Promise<Order | null> => {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
    if (error) {
        // Don't log "no rows found" as an error
        if (error.code !== 'PGRST116') {
            console.error('Error fetching order by id:', error);
        }
        return null;
    }
    return data as Order;
};

export const addOrder = async (orderData: OrderFormData): Promise<Order | null> => {
    const now = new Date().toISOString();

    // Auto-generate a name if it's not provided, which is the case for daily orders.
    const name = orderData.name || `Daily Order for ${format(new Date(orderData.clientEvents[0].date), 'PPP')}`;

    const newOrderData = { ...orderData, name, created_at: now, updated_at: now };

    const { data, error } = await supabase.from('orders').insert([newOrderData]).select();
    if (error) {
        console.error('Error adding order:', error);
        return null;
    }
    return data?.[0] as Order;
};

export const updateOrder = async (id: string, updates: Partial<OrderFormData>): Promise<boolean> => {
    const { error } = await supabase.from('orders').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
        console.error('Error updating order:', error);
    }
    return !error;
};

export const deleteOrder = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
        console.error('Error deleting order:', error);
    }
    return !error;
};
