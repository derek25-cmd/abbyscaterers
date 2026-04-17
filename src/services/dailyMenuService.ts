
import { supabase } from '@/lib/supabase-client';
import { DailyMenu } from '@/types';

export const getMenusByDate = async (date: string): Promise<DailyMenu[]> => {
    const { data, error } = await supabase
        .from('daily_menus')
        .select('*')
        .eq('menu_date', date);

    if (error) {
        console.error('Error fetching daily menus:', error);
        return [];
    }
    return data as DailyMenu[];
};

export const upsertDailyMenu = async (menuData: Omit<DailyMenu, 'id' | 'created_at' | 'updated_at'>): Promise<DailyMenu | null> => {
    try {
        const { order_id, event_id, menu_date, recipes, region } = menuData;
        
        const { data, error } = await supabase
            .from('daily_menus')
            .upsert(
                { 
                    order_id,
                    event_id, 
                    menu_date, 
                    recipes, 
                    region, 
                    updated_at: new Date().toISOString() 
                },
                { onConflict: 'event_id, menu_date' }
            )
            .select()
            .single();
        
        if (error) {
            console.error('Error upserting daily menu:', JSON.stringify(error, null, 2));
            return null;
        }
        return data as DailyMenu;
    } catch (err) {
        console.error('Unexpected error upserting daily menu:', err);
        return null;
    }
}

export const bulkUpsertDailyMenus = async (menus: Omit<DailyMenu, 'id' | 'created_at' | 'updated_at'>[]): Promise<boolean> => {
    if (menus.length === 0) return true;

    try {
        const uniqueMenus = new Map();
        const now = new Date().toISOString();

        menus.forEach(m => {
            const key = `${m.event_id}-${m.menu_date}`;
            uniqueMenus.set(key, {
                order_id: m.order_id,
                event_id: m.event_id,
                menu_date: m.menu_date,
                recipes: m.recipes,
                region: m.region,
                updated_at: now
            });
        });

        const payload = Array.from(uniqueMenus.values());

        const { error } = await supabase
            .from('daily_menus')
            .upsert(payload, { onConflict: 'event_id, menu_date' });

        if (error) {
            console.error('Error bulk upserting daily menus:', JSON.stringify(error, null, 2));
            return false;
        }
        return true;
    } catch (err) {
        console.error('Unexpected error bulk upserting daily menus:', err);
        return false;
    }
};

export const getMenusByOrderId = async (orderId: string): Promise<DailyMenu[]> => {
    const { data, error } = await supabase
        .from('daily_menus')
        .select('*')
        .eq('order_id', orderId);

    if (error) {
        console.error('Error fetching menus by order ID:', error);
        return [];
    }
    return data as DailyMenu[];
};

export const getMenusByClientAndRange = async (clientId: string, startDate: string, endDate: string): Promise<DailyMenu[]> => {
    try {
        // 1. Get all order IDs belonging to this client
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id')
            .eq('client_id', clientId);

        if (ordersError || !orders || orders.length === 0) {
            return [];
        }

        const orderIds = orders.map(o => o.id);

        // 2. Fetch daily menus for these orders within the date range
        const { data, error } = await supabase
            .from('daily_menus')
            .select('*')
            .in('order_id', orderIds)
            .gte('menu_date', startDate)
            .lte('menu_date', endDate)
            .order('menu_date', { ascending: true });

        if (error) {
            console.error('Error fetching menus by client and range:', JSON.stringify(error, null, 2));
            return [];
        }

        return (data || []) as DailyMenu[];
    } catch (err) {
        console.error('Unexpected error in getMenusByClientAndRange:', err);
        return [];
    }
};
