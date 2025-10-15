
import { supabase } from '@/lib/supabase-client';
import { DailyMenu } from '@/types';
import { format } from 'date-fns';

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
    const { order_id, menu_date, recipes } = menuData;
    
    const { data, error } = await supabase
        .from('daily_menus')
        .upsert(
            { order_id, menu_date, recipes, updated_at: new Date().toISOString() },
            { onConflict: 'order_id, menu_date' }
        )
        .select()
        .single();
    
    if (error) {
        console.error('Error upserting daily menu:', error);
        return null;
    }
    return data as DailyMenu;
}
