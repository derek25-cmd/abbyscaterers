
import { supabase } from '@/lib/supabase-client';
import type { Order, ClientEvent } from '@/types';
import type { OrderFormData } from '@/lib/schemas';
import { format } from 'date-fns';

// Maps frontend camelCase event object to backend snake_case
const mapClientEventToDb = (event: ClientEvent) => ({
  client_id: event.clientId,
  date: event.date,
  number_of_people: event.numberOfPeople,
  meal_type: event.mealType,
  recipes: event.recipes,
  unit_price: event.unitPrice,
  vat_type: event.vatType,
});

export const getOrders = async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*');
    if (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
    // This is a workaround to ensure clientEvents is always an array
    const orders = data as any[];
    return orders.map(o => ({...o, clientEvents: o.clientEvents || []})) as Order[];
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
    const order = data as any;
    return {...order, clientEvents: order.clientEvents || []} as Order;
};

export const addOrder = async (orderData: Partial<OrderFormData>): Promise<Order | null> => {
    const now = new Date().toISOString();

    const name = orderData.name || `Daily Order for ${orderData.clientEvents && orderData.clientEvents.length > 0 ? format(new Date(orderData.clientEvents[0].date), 'PPP') : 'Unknown Date'}`;
    
    // Construct the payload with correct snake_case keys for the database
    const newOrderData = {
        id: orderData.id,
        name: name,
        description: orderData.description,
        proformaId: orderData.proformaId,
        clientEvents: orderData.clientEvents,
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
      clientEvents: updates.clientEvents,
      updated_at: new Date().toISOString()
    };
    
    // Remove undefined keys to avoid overwriting existing data with null
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
