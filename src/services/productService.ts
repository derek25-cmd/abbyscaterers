
import { supabase } from '@/lib/supabase-client';
import { Product } from '@/types';

export const getProducts = async (): Promise<Product[]> => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
        console.error('Error fetching products:', error);
        return [];
    }
    return data as Product[];
};

export const addProduct = async (product: Omit<Product, 'id' | 'sku' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
    const productDataForSupabase = {
      ...product,
      sku: `SKU-${Date.now()}` // Generate SKU server-side or here
    };
    const { data, error } = await supabase.from('products').insert([productDataForSupabase]).select();
    if (error) {
        console.error('Error adding product:', error);
        return null;
    }
    return data?.[0]?.id;
};

export const updateProduct = async (id: string, updatedProduct: Partial<Product>): Promise<boolean> => {
    const { error } = await supabase.from('products').update(updatedProduct).eq('id', id);
    if (error) {
        console.error('Error updating product:', error);
    }
    return !error;
};
