
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

export const addProduct = async (product: Omit<Product, 'id' | 'sku' | 'createdAt' | 'updatedAt'>): Promise<Product | null> => {
    const { name, category, quantity, unit, unitPrice, minStock, maxStock, expiryDate } = product;

    const productDataForSupabase = {
      name,
      category,
      quantity,
      unit,
      unitPrice,
      minStock,
      maxStock,
      expiryDate,
      sku: `SKU-${Date.now()}`
    };

    const { data, error } = await supabase.from('products').insert([productDataForSupabase]).select();
    if (error) {
        console.error('Error adding product:', JSON.stringify(error, null, 2));
        return null;
    }
    return data?.[0] as Product;
};


export const updateProduct = async (id: string, updatedProduct: Partial<Product>): Promise<boolean> => {
    const { error } = await supabase.from('products').update(updatedProduct).eq('id', id);
    if (error) {
        console.error('Error updating product:', error);
    }
    return !error;
};
