
import { supabase } from '@/lib/supabase-client';
import type { Order, ClientEvent } from '@/types';
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

export const addOrder = async (orderData: Partial<OrderFormData>): Promise<Order | null> => {
    const now = new Date().toISOString();

    const name = orderData.name || `Daily Order for ${orderData.clientEvents && orderData.clientEvents.length > 0 ? format(new Date(orderData.clientEvents[0].date), 'PPP') : 'Unknown Date'}`;
    
    // Ensure the payload matches the database schema exactly, including the JSONB structure.
    // The database expects a column named 'client_events' and the JSON within it should have camelCase keys.
    const newOrderData = {
        id: orderData.id,
        name: name,
        description: orderData.description,
        proformaId: orderData.proformaId,
        client_events: orderData.clientEvents, // Pass the array directly as it is already in the correct camelCase format for the JSONB column.
        booking_id: orderData.booking_id,
        created_at: now,
        updated_at: now,
    };

    const { data, error } = await supabase.from('orders').insert([newOrderData]).select();
    if (error) {
        console.error('Error adding order:', error);
        return null;
    }
    return data?.[0] as Order;
};


export const updateOrder = async (id: string, updates: Partial<OrderFormData>): Promise<boolean> => {
    const updatePayload = {
      ...updates,
      client_events: updates.clientEvents, // Pass camelCase data directly
      updated_at: new Date().toISOString()
    };
    
    // Remove clientEvents if it's in the updates to avoid sending both camel/snake case
    delete (updatePayload as any).clientEvents;
    
    const { error } = await supabase.from('orders').update(updatePayload).eq('id', id);
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
