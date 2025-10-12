
import { supabase } from '@/lib/supabase-client';
import type { Order } from '@/types';
import type { OrderFormData } from '@/lib/schemas';
import { format } from 'date-fns';

const mapDbToOrder = (dbOrder: any): Order => {
  if (!dbOrder) return null as any;
  return {
    id: dbOrder.id,
    name: dbOrder.name,
    description: dbOrder.description,
    proformaId: dbOrder.proformaId,
    booking_id: dbOrder.booking_id,
    clientEvents: dbOrder.clientEvents || [],
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

export const getLatestOrderNumber = async (): Promise<number> => {
    const { data, error } = await supabase
        .from('orders')
        .select('id')
        .order('createdAt', { ascending: false })
        .limit(1)
        .single();
    
    if(error || !data) {
        if(error && error.code !== 'PGRST116') {
             console.error("Error fetching latest order number", error);
        }
        return 1;
    }

    const match = data.id.match(/ORD-(\d+)/);
    if (match) {
        return parseInt(match[1], 10) + 1;
    }

    return 1;
}

export const addOrder = async (orderData: Partial<OrderFormData>): Promise<Order | null> => {
    const now = new Date().toISOString();

    const settings = JSON.parse(localStorage.getItem('caterSmartAppSettings') || '{}');
    const nextOrderNumber = settings.nextOrderNumber || 1;
    const newOrderId = `ORD-${String(nextOrderNumber).padStart(5, '0')}`;
    
    const name = orderData.name || `Daily Order for ${orderData.clientEvents && orderData.clientEvents.length > 0 ? format(new Date(orderData.clientEvents[0].date), 'PPP') : 'Unknown Date'}`;
    
    const newOrderData = {
        ...orderData,
        id: newOrderId,
        name: name,
        createdAt: now,
        updatedAt: now,
    };

    const { data, error } = await supabase.from('orders').insert([newOrderData]).select().single();
    
    if (error) {
        console.error('Error adding order:', JSON.stringify(error, null, 2));
        return null;
    }
    
    localStorage.setItem('caterSmartAppSettings', JSON.stringify({ ...settings, nextOrderNumber: nextOrderNumber + 1 }));

    return mapDbToOrder(data);
};


export const updateOrder = async (id: string, updates: Partial<OrderFormData>): Promise<Order | null> => {
    const updatePayload: { [key: string]: any } = {
      name: updates.name,
      description: updates.description,
      proformaId: updates.proformaId,
      booking_id: updates.booking_id,
      clientEvents: updates.clientEvents,
      updatedAt: new Date().toISOString()
    };
    
    Object.keys(updatePayload).forEach(key => updatePayload[key] === undefined && delete updatePayload[key]);
    
    const { data, error } = await supabase.from('orders').update(updatePayload).eq('id', id).select().single();
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
