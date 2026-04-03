
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error("User not authenticated to add a product.");
        return null;
    }

    const { name, category, quantity, unit, unitPrice, minStock, maxStock, expiryDate } = product;
    const now = new Date().toISOString();

    const productDataForSupabase = {
      name,
      category,
      quantity: Number(quantity),
      unit,
      unitPrice: Number(unitPrice),
      minStock: Number(minStock),
      maxStock: maxStock ? Number(maxStock) : null,
      expiryDate,
      sku: `SKU-${Date.now()}`,
      user_id: user.id,
      createdAt: now,
      updatedAt: now
    };

    const { data, error } = await supabase.from('products').insert([productDataForSupabase]).select();
    if (error) {
        console.error('Error adding product:', JSON.stringify(error, null, 2));
        return null;
    }
    return data?.[0] as Product;
};


export const updateProduct = async (id: string, updatedProduct: Partial<Product>): Promise<boolean> => {
    const updatePayload: { [key: string]: any } = { ...updatedProduct };
    
    if (updatePayload.quantity !== undefined) {
        updatePayload.quantity = Number(updatePayload.quantity);
    }
    if (updatePayload.unitPrice !== undefined) {
        updatePayload.unitPrice = Number(updatePayload.unitPrice);
    }
     if (updatePayload.minStock !== undefined) {
        updatePayload.minStock = Number(updatePayload.minStock);
    }

    const { error } = await supabase.from('products').update(updatePayload).eq('id', id);
    if (error) {
        console.error('Error updating product:', error);
    }
    return !error;
};

