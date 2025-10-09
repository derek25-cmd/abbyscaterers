
import { supabase } from '@/lib/supabase-client';
import type { Order, ClientEvent } from '@/types';
import type { OrderFormData } from '@/lib/schemas';
import { format } from 'date-fns';

const mapOrderFromDb = (dbOrder: any): Order => {
    return {
        id: dbOrder.id,
        name: dbOrder.name,
        description: dbOrder.description,
        proformaId: dbOrder.proforma_id,
        booking_id: dbOrder.booking_id,
        clientEvents: (dbOrder.client_events || []).map((event: any) => ({
            clientId: event.client_id,
            date: event.date,
            numberOfPeople: event.number_of_people,
            mealType: event.meal_type,
            recipes: event.recipes || [],
            unitPrice: event.unit_price,
            vatType: event.vat_type,
        })),
        createdAt: dbOrder.created_at,
        updatedAt: dbOrder.updated_at,
    };
}

export const getOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*').order('createdAt', { ascending: false });
    if (error) {
        console.error('Error fetching orders:', JSON.stringify(error, null, 2));
        return [];
    }
    return data as Order[];
};

export const getOrderById = async (id: string): Promise<Order | null> => {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
    if (error) {
        if (error.code !== 'PGRST116') { // Ignore "no rows found" error
            console.error('Error fetching order by id:', error);
        }
        return null;
    }
    return data as Order;
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
        proforma_id: orderData.proformaId,
        client_events: orderData.clientEvents,
        booking_id: orderData.booking_id,
        createdAt: now,
        updatedAt: now,
    };

    const { data, error } = await supabase.from('orders').insert([newOrderData]).select().single();
    
    if (error) {
        console.error('Error adding order:', JSON.stringify(error, null, 2));
        return null;
    }
    return data as Order;
};


export const updateOrder = async (id: string, updates: Partial<OrderFormData>): Promise<boolean> => {
    const updatePayload: { [key: string]: any } = {
      name: updates.name,
      description: updates.description,
      proforma_id: updates.proformaId,
      booking_id: updates.booking_id,
      client_events: updates.clientEvents,
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
