
import { supabase } from '@/lib/supabase-client';
import type { Order, ClientEvent } from '@/types';
import type { OrderFormData } from '@/lib/schemas';
import { format } from 'date-fns';

// This function maps the camelCase fields from the database to the camelCase fields in the application's Order type.
const mapDbToOrder = (dbOrder: any): Order => {
    return {
        id: dbOrder.id,
        name: dbOrder.name,
        description: dbOrder.description,
        proformaId: dbOrder.proformaId, 
        booking_id: dbOrder.bookingId, 
        clientEvents: dbOrder.clientEvents || [],
        createdAt: dbOrder.createdAt,
        updatedAt: dbOrder.updatedAt,
    };
}

export const getOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').order('createdAt', { ascending: false });
    if (error) {
        console.error('Error fetching orders:', JSON.stringify(error, null, 2));
        return [];
    }
    return (data || []).map(mapDbToOrder);
};

export const getOrderById = async (id: string): Promise<Order | null> => {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
    if (error) {
        if (error.code !== 'PGRST116') { 
            console.error('Error fetching order by id:', error);
        }
        return null;
    }
    return mapDbToOrder(data);
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
    
    const name = orderData.name || `Daily Order for ${orderData.clientEvents && orderData.clientEvents.length > 0 ? format(new Date(orderData.clientEvents[0].date), 'PPP') : 'Unknown Date'}`;
    
    const newOrderData = {
        id: orderData.id || newOrderId,
        name: name,
        description: orderData.description,
        proformaId: orderData.proformaId,
        bookingId: orderData.booking_id,
        createdAt: now,
        updatedAt: now,
    };

    const { data, error } = await supabase.from('orders').insert([newOrderData]).select().single();
    
    if (error) {
        console.error('Error adding order:', JSON.stringify(error, null, 2));
        return null;
    }
    
    const resultOrder = mapDbToOrder(data);
    resultOrder.clientEvents = orderData.clientEvents || [];

    return resultOrder;
};

export const updateOrder = async (id: string, updates: Partial<OrderFormData>): Promise<boolean> => {
    const updatePayload: { [key: string]: any } = {
      name: updates.name,
      description: updates.description,
      proformaId: updates.proformaId,
      bookingId: updates.booking_id,
      updatedAt: new Date().toISOString()
    };
    
    Object.keys(updatePayload).forEach(key => updatePayload[key] === undefined && delete updatePayload[key]);
    
    const { error } = await supabase.from('orders').update(updatePayload).eq('id', id);
    if (error) {
        console.error('Error updating order:', JSON.stringify(error, null, 2));
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
