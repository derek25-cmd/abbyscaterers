
import { supabase } from '@/lib/supabase-client';
import type { Order, ClientEvent } from '@/types';
import type { OrderFormData } from '@/lib/schemas';
import { format } from 'date-fns';

// This function is no longer needed as the frontend and DB schema for client_events match.
// const mapClientEventToDb = (event: ClientEvent) => ({...});

export const getOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
    const orders = data as any[];
    return orders.map(o => ({...o, clientEvents: o.clientEvents || []})) as Order[];
};

export const getOrderById = async (id: string): Promise<Order | null> => {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
    if (error) {
        if (error.code !== 'PGRST116') {
            console.error('Error fetching order by id:', error);
        }
        return null;
    }
    const order = data as any;
    return {...order, clientEvents: order.clientEvents || []} as Order;
};

export const addOrder = async (orderData: Partial<OrderFormData>): Promise<Order | null> => {
    const now = new Date().toISOString();

    const { count, error: countError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Error counting orders:', countError);
        throw new Error("Could not count existing orders to generate a new ID.");
    }
    
    const nextIdNumber = (count ?? 0) + 1;
    const newOrderId = `ORD-${String(nextIdNumber).padStart(5, '0')}`;

    // Use a descriptive name if not provided, good for daily orders
    const name = orderData.name || `Daily Order for ${orderData.clientEvents && orderData.clientEvents.length > 0 ? format(new Date(orderData.clientEvents[0].date), 'PPP') : 'Unknown Date'}`;
    
    const newOrderData = {
        id: orderData.id || newOrderId,
        name: name,
        description: orderData.description,
        proformaId: orderData.proformaId,
        clientEvents: orderData.clientEvents, // Pass camelCase directly, Supabase client handles JSONB mapping
        booking_id: orderData.booking_id,
        created_at: now,
        updated_at: now,
    };

    const { data, error } = await supabase.from('orders').insert([newOrderData]).select();
    
    if (error) {
        console.error('Error adding order:', JSON.stringify(error, null, 2));
        return null;
    }
    return data?.[0] as Order;
};


export const updateOrder = async (id: string, updates: Partial<OrderFormData>): Promise<boolean> => {
    const updatePayload: { [key: string]: any } = {
      name: updates.name,
      description: updates.description,
      proformaId: updates.proformaId,
      booking_id: updates.booking_id,
      clientEvents: updates.clientEvents, // Pass camelCase directly
      updated_at: new Date().toISOString()
    };
    
    Object.keys(updatePayload).forEach(key => updatePayload[key] === undefined && delete updatePayload[key]);
    
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
