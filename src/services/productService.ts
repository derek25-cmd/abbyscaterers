
import { supabase } from '@/lib/supabase-client';

export const getProducts = async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
        console.error('Error fetching products:', error);
        return [];
    }
    return data;
};

export const addProduct = async (product: Omit<any, 'id'>) => {
    const { data, error } = await supabase.from('products').insert([product]).select();
    if (error) {
        console.error('Error adding product:', error);
        return null;
    }
    return data?.[0]?.id;
};

export const updateProduct = async (id: string, updatedProduct: Partial<any>) => {
    const { error } = await supabase.from('products').update(updatedProduct).eq('id', id);
    if (error) {
        console.error('Error updating product:', error);
    }
    return !error;
};
