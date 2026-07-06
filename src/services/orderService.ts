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
    region: dbOrder.region,
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

// ── ID counter helper ──────────────────────────────────────────────────────
// Calls the DB-side claim_ids() function which atomically increments a
// named counter and returns the first ID in the claimed range.  Because the
// counter only ever increases, IDs are never reused after deletion.
async function claimIds(counterName: string, count: number = 1): Promise<number> {
    const { data, error } = await supabase.rpc('claim_ids', {
        counter_name: counterName,
        count,
    });
    if (error) throw new Error(`Could not claim ${counterName} IDs: ${error.message}`);
    return Number(data);
}

export const addOrder = async (orderData: Partial<OrderFormData>): Promise<Order | null> => {
    try {
        const now = new Date().toISOString();
        const clientId = orderData.clientId && orderData.clientId.trim() !== '' ? orderData.clientId : null;

        // Use the DB counter for order IDs so deleted IDs are never reissued.
        let orderId = orderData.id;
        if (!orderId || orderId.startsWith('ORD-17')) {
            const nextNum = await claimIds('order_id');
            orderId = `ORD-${String(nextNum).padStart(5, '0')}`;
        }

        // Claim exactly as many event IDs as there are events that need one.
        const eventsNeedingId = (orderData.clientEvents || []).filter(
            e => !e.id || e.id.startsWith('EVT-17')
        ).length;
        let nextEvtNum = eventsNeedingId > 0 ? await claimIds('event_id', eventsNeedingId) : 0;
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
            region: orderData.region,
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
        if (updates.region !== undefined) payload.region = updates.region;
        
        if (updates.clientEvents !== undefined) {
            const eventsNeedingId = (updates.clientEvents || []).filter(
                (e: any) => !e.id || e.id.startsWith('EVT-17')
            ).length;
            let nextEvtNum = eventsNeedingId > 0 ? await claimIds('event_id', eventsNeedingId) : 0;
            payload.clientEvents = (updates.clientEvents || []).map((event: any) => {
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

// getLatestOrderNumber / getLatestEventNumber are intentionally removed.
// All ID generation now goes through claimIds() → claim_ids() DB function.

export const bulkAddOrders = async (ordersData: Partial<OrderFormData>[]): Promise<Order[]> => {
    if (ordersData.length === 0) return [];

    try {
        const now = new Date().toISOString();

        // Claim all order IDs and event IDs atomically in two round-trips.
        let nextNum = await claimIds('order_id', ordersData.length);
        const totalEventsNeedingId = ordersData.reduce((sum, od) => {
            return sum + (od.clientEvents || []).filter(
                (e: any) => !e.id || e.id.startsWith('EVT-17')
            ).length;
        }, 0);
        let nextEvtNum = totalEventsNeedingId > 0
            ? await claimIds('event_id', totalEventsNeedingId)
            : 0;

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