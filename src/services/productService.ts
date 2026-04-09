
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

    const now = new Date().toISOString();

    const productDataForSupabase = {
      name: product.name,
      category: product.category,
      unit: product.unit,
      // Legacy aggregate fields — sum of all branches
      quantity: Number(product.quantity_dar || 0) + Number(product.quantity_arusha || 0) + Number(product.quantity_dodoma || 0),
      unitPrice: Number(product.unitPrice_dar || 0), // Default to Dar price for legacy
      // Per-branch quantities
      quantity_dar: Number(product.quantity_dar || 0),
      quantity_arusha: Number(product.quantity_arusha || 0),
      quantity_dodoma: Number(product.quantity_dodoma || 0),
      // Per-branch prices
      unitPrice_dar: Number(product.unitPrice_dar || 0),
      unitPrice_arusha: Number(product.unitPrice_arusha || 0),
      unitPrice_dodoma: Number(product.unitPrice_dodoma || 0),
      minStock: Number(product.minStock),
      maxStock: product.maxStock ? Number(product.maxStock) : null,
      expiryDate: product.expiryDate,
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
    
    // Ensure numeric fields are properly cast
    const numericFields = [
        'quantity', 'unitPrice', 'minStock',
        'quantity_dar', 'quantity_arusha', 'quantity_dodoma',
        'unitPrice_dar', 'unitPrice_arusha', 'unitPrice_dodoma'
    ];
    numericFields.forEach(field => {
        if (updatePayload[field] !== undefined) {
            updatePayload[field] = Number(updatePayload[field]);
        }
    });

    // Recalculate legacy aggregate quantity if any branch qty changed
    if (updatePayload.quantity_dar !== undefined || updatePayload.quantity_arusha !== undefined || updatePayload.quantity_dodoma !== undefined) {
        // We need to fetch current values to compute the aggregate
        const { data: currentProduct } = await supabase.from('products').select('quantity_dar, quantity_arusha, quantity_dodoma').eq('id', id).single();
        if (currentProduct) {
            const qDar = updatePayload.quantity_dar ?? currentProduct.quantity_dar ?? 0;
            const qArusha = updatePayload.quantity_arusha ?? currentProduct.quantity_arusha ?? 0;
            const qDodoma = updatePayload.quantity_dodoma ?? currentProduct.quantity_dodoma ?? 0;
            updatePayload.quantity = Number(qDar) + Number(qArusha) + Number(qDodoma);
        }
    }

    const { error } = await supabase.from('products').update(updatePayload).eq('id', id);
    if (error) {
        console.error('Error updating product:', error);
    }
    return !error;
};
