
import { supabase } from '@/lib/supabase-client';

export const getOrders = async () => {
    const { data, error } = await supabase.from('orders').select('*');
    if (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
    return data;
};
