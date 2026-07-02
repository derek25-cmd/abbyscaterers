import { supabase } from '@/lib/supabase-client';
import type { Order } from '@/types';
import type { OrderFormData } from '@/lib/schemas';
import { format } from 'date-fns';

const mapDbToOrder = (dbOrder: any): Order => {
  if (!dbOrder) return null as any;
  return {
    id: dbOrder.id,
    name: dbOrder.name,
    clientId: dbOrder.client_id || '', // Map from snake_case db column
    startDate: dbOrder.start_date || '', // Map from snake_case db column
    endDate: dbOrder.end_date || '', // Map from snake_case db column
    description: dbOrder.description || '',
    proformaId: dbOrder.proforma_id || '', // Map from snake_case db column
    booking_id: dbOrder.booking_id,
    clientEvents: dbOrder.clientEvents || [], // Database column is camelCase
    createdAt: dbOrder.createdAt,
    updatedAt: dbOrder.updatedAt,
  };
};

export const getOrders = async (): Promise<Order[]> => {
    // Supabase's default page size is 1 000 rows. With 1 000+ orders in the
    // database the un-paginated select silently truncates, causing the oldest
    // entries to vanish from the Sync Orders dialog. Paginate until exhausted.
    const PAGE = 1000;
    const all: Order[] = [];
    let page = 0;

    while (true) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('createdAt', { ascending: false })
            .range(page * PAGE, (page + 1) * PAGE - 1);

        if (error) {
            console.error('Error fetching orders:', JSON.stringify(error, null, 2));
            break;
        }

        if (!data || data.length === 0) break;
        all.push(...(data as any[]).map(mapDbToOrder));
        if (data.length < PAGE) break; // last page
        page++;
    }

    return all;
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
    try {
        const now = new Date().toISOString();
        const clientId = orderData.clientId && orderData.clientId.trim() !== '' ? orderData.clientId : null;

        let orderId = orderData.id;
        if (!orderId || orderId.startsWith('ORD-17')) { // Ensure timestamp-based IDs are replaced
            let nextNum = await getLatestOrderNumber();
            orderId = `ORD-${String(nextNum).padStart(5, '0')}`;
        }

        // Ensure every client event has a unique ID (EVT-XXXXX)
        let nextEvtNum = await getLatestEventNumber();
        const processedEvents = (orderData.clientEvents || []).map(event => {
            if (event.id && event.id.startsWith('EVT-') && !event.id.includes('EVT-17')) {
                return event;
            }
            return {
                ...event,
                id: `EVT-${String(nextEvtNum++).padStart(5, '0')}`
            };
        });

        const payload = {
            id: orderId,
            name: orderData.name,
            client_id: clientId,
            start_date: orderData.startDate,
            end_date: orderData.endDate,
            description: orderData.description,
            proforma_id: orderData.proformaId,
            booking_id: orderData.booking_id,
            clientEvents: processedEvents,
            createdAt: now,
            updatedAt: now,
        };

        const { data, error } = await supabase.from('orders').insert([payload]).select().single();
        
        if (error) {
            console.error('Error adding order:', JSON.stringify(error, null, 2));
            return null;
        }

        return mapDbToOrder(data);
    } catch (err) {
        console.error('Unexpected error adding order:', err);
        return null;
    }
};

export const updateOrder = async (id: string, updates: Partial<OrderFormData>): Promise<Order | null> => {
    try {
        const payload: any = {
            updatedAt: new Date().toISOString()
        };

        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.clientId !== undefined) payload.client_id = updates.clientId.trim() !== '' ? updates.clientId : null;
        if (updates.startDate !== undefined) payload.start_date = updates.startDate;
        if (updates.endDate !== undefined) payload.end_date = updates.endDate;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.proformaId !== undefined) payload.proforma_id = updates.proformaId;
        if (updates.booking_id !== undefined) payload.booking_id = updates.booking_id;
        
        if (updates.clientEvents !== undefined) {
             let nextEvtNum = await getLatestEventNumber();
             payload.clientEvents = (updates.clientEvents || []).map(event => {
                 if (event.id && event.id.startsWith('EVT-') && !event.id.includes('EVT-17')) {
                    return event;
                }
                return {
                    ...event,
                    id: `EVT-${String(nextEvtNum++).padStart(5, '0')}`
                };
            });
        }
        
        const { data, error } = await supabase.from('orders').update(payload).eq('id', id).select().single();
        if (error) {
            console.error('Error updating order:', JSON.stringify(error, null, 2));
            return null;
        }
        return mapDbToOrder(data);
    } catch (err) {
        console.error('Unexpected error updating order:', err);
        return null;
    }
};

export const deleteOrder = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase.from('orders').delete().eq('id', id);
        if (error) {
            console.error('Error deleting order:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Unexpected error deleting order:', err);
        return false;
    }
};

export const bulkDeleteOrders = async (ids: string[]): Promise<boolean> => {
    if (ids.length === 0) return true;
    try {
        const { error } = await supabase.from('orders').delete().in('id', ids);
        if (error) {
            console.error('Error bulk deleting orders:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Unexpected error bulk deleting orders:', err);
        return false;
    }
};

export const getLatestOrderNumber = async (): Promise<number> => {
    try {
        // Scan ALL orders — the old .limit(500) caused ORD-ID collisions once
        // the database grew beyond 500 entries.
        const PAGE = 1000;
        let maxNum = 0;
        let page = 0;

        while (true) {
            const { data, error } = await supabase
                .from('orders')
                .select('id')
                .order('createdAt', { ascending: false })
                .range(page * PAGE, (page + 1) * PAGE - 1);

            if (error || !data || data.length === 0) break;

            for (const row of data) {
                const match = row.id.match(/ORD-(\d{5})$/);
                if (match && match[1]) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) maxNum = num;
                }
            }

            if (data.length < PAGE) break;
            page++;
        }

        return maxNum > 0 ? maxNum + 1 : 1;
    } catch (err) {
        console.error('Error in getLatestOrderNumber:', err);
        return 1;
    }
}

export const getLatestEventNumber = async (): Promise<number> => {
    try {
        // Scan ALL orders for the highest EVT-XXXXX sequence number so we
        // never generate a duplicate. The old .limit(100) caused duplicate IDs
        // once the database exceeded 100 orders.
        const PAGE = 1000;
        let maxNum = 0;
        let page = 0;

        while (true) {
            const { data, error } = await supabase
                .from('orders')
                .select('clientEvents')
                .order('createdAt', { ascending: false })
                .range(page * PAGE, (page + 1) * PAGE - 1);

            if (error || !data) break;

            data.forEach((order: any) => {
                (order.clientEvents || []).forEach((evt: any) => {
                    const match = evt.id?.match(/EVT-(\d+)/);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                });
            });

            if (data.length < PAGE) break;
            page++;
        }

        return maxNum + 1;
    } catch (err) {
        console.error('Error in getLatestEventNumber:', err);
        return 1;
    }
}

export const bulkAddOrders = async (ordersData: Partial<OrderFormData>[]): Promise<Order[]> => {
    if (ordersData.length === 0) return [];

    try {
        const now = new Date().toISOString();
        let nextNum = await getLatestOrderNumber();
        let nextEvtNum = await getLatestEventNumber();

        const payloads = ordersData.map((orderData) => {
            const orderId = `ORD-${String(nextNum++).padStart(5, '0')}`;
            const clientId = orderData.clientId && orderData.clientId.trim() !== '' ? orderData.clientId : null;

            const processedEvents = (orderData.clientEvents || []).map(event => {
                 if (event.id && event.id.startsWith('EVT-') && !event.id.includes('EVT-17')) {
                    return event;
                }
                return {
                    ...event,
                    id: `EVT-${String(nextEvtNum++).padStart(5, '0')}`
                };
            });

            return {
                id: orderId,
                name: orderData.name,
                client_id: clientId,
                start_date: orderData.startDate,
                end_date: orderData.endDate,
                description: orderData.description,
                proforma_id: orderData.proformaId,
                booking_id: orderData.booking_id,
                clientEvents: processedEvents,
                createdAt: now,
                updatedAt: now,
            };
        });

        const { data, error } = await supabase.from('orders').insert(payloads).select();

        if (error) {
            console.error('Error bulk adding orders:', JSON.stringify(error, null, 2));
            return [];
        }

        return (data as any[]).map(mapDbToOrder);
    } catch (err) {
        console.error('Unexpected error in bulkAddOrders:', err);
        return [];
    }
};