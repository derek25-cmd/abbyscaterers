import { supabase } from '@/lib/supabase-client';
import type { Order } from '@/types';
import type { OrderFormData } from '@/lib/schemas';
import { format } from 'date-fns';

const mapDbToOrder = (dbOrder: any): Order => {
  if (!dbOrder) return null as any;
  return {
    id: dbOrder.id,
    name: dbOrder.name,
    clientId: dbOrder.client_id, // Map from snake_case db column
    startDate: dbOrder.start_date, // Map from snake_case db column
    endDate: dbOrder.end_date, // Map from snake_case db column
    description: dbOrder.description,
    proformaId: dbOrder.proforma_id, // Map from snake_case db column
    booking_id: dbOrder.booking_id,
    clientEvents: dbOrder.clientEvents || [], // Database column is camelCase
    createdAt: dbOrder.createdAt,
    updatedAt: dbOrder.updatedAt,
  };
};

export const getOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').order('createdAt', { ascending: false });
    if (error) {
        console.error('Error fetching orders:', JSON.stringify(error, null, 2));
        return [];
    }
    const orders = data as any[];
    return orders.map(mapDbToOrder);
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

    const payload = {
        name: orderData.name,
        client_id: orderData.clientId, // Map to snake_case db column
        start_date: orderData.startDate, // Map to snake_case db column
        end_date: orderData.endDate, // Map to snake_case db column
        description: orderData.description,
        proforma_id: orderData.proformaId, // Map to snake_case db column
        booking_id: orderData.bookingId,
        clientEvents: orderData.clientEvents, // Database column is camelCase
        createdAt: now,
        updatedAt: now,
    };
    
    if(orderData.id){
      (payload as any).id = orderData.id;
    }

    const { data, error } = await supabase.from('orders').insert([payload]).select().single();
    
    if (error) {
        console.error('Error adding order:', JSON.stringify(error, null, 2));
        return null;
    }

    return mapDbToOrder(data);
};


export const updateOrder = async (id: string, updates: Partial<OrderFormData>): Promise<Order | null> => {
    const payload = {
      name: updates.name,
      client_id: updates.clientId, // Map to snake_case db column
      start_date: updates.startDate, // Map to snake_case db column
      end_date: updates.endDate, // Map to snake_case db column
      description: updates.description,
      proforma_id: updates.proformaId, // Map to snake_case db column
      booking_id: updates.bookingId,
      clientEvents: updates.clientEvents, // Database column is camelCase
      updatedAt: new Date().toISOString()
    };
    
    const { data, error } = await supabase.from('orders').update(payload).eq('id', id).select().single();
    if (error) {
        console.error('Error updating order:', JSON.stringify(error, null, 2));
        return null;
    }
    return mapDbToOrder(data);
};

export const deleteOrder = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
        console.error('Error deleting order:', error);
    }
    return !error;
};

export const getLatestOrderNumber = async (): Promise<number> => {
    const { data, error } = await supabase
        .from('orders')
        .select('id')
        .order('createdAt', { ascending: false })
        .limit(1)
        .single();
    
    if (error || !data) {
        if(error && error.code !== 'PGRST116') { // PGRST116 = no rows found
             console.error("Error fetching latest order number", error);
        }
        return 1;
    }
    
    const match = data.id.match(/ORD-(\d+)/);
    if (match && match[1]) {
        return parseInt(match[1], 10) + 1;
    }

    return 1; // Default if no matching format is found
}