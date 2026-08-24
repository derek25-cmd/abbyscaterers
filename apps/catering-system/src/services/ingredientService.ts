
import { supabase } from '@/lib/supabase-client';
import type { Ingredient } from '@/types';
import type { IngredientFormData } from '@/lib/schemas';

export const getIngredients = async (): Promise<Ingredient[]> => {
    const { data, error } = await supabase.from('ingredients').select('*');
    if (error) {
        console.error('Error fetching ingredients:', error);
        return [];
    }
    return data as Ingredient[];
};

export const getIngredientById = async (itemNumber: string): Promise<Ingredient | null> => {
    const { data, error } = await supabase.from('ingredients').select('*').eq('itemNumber', itemNumber).single();
    if (error) {
        console.error('Error fetching ingredient by id:', error);
        return null;
    }
    return data as Ingredient;
}

export const addIngredient = async (ingredientData: IngredientFormData): Promise<Ingredient | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error("User not authenticated to add an ingredient.");
        return null;
    }
    const now = new Date().toISOString();
    const newIngredientData = { 
        ...ingredientData,
        user_id: user.id,
        createdAt: now, 
        updatedAt: now,
        quantityUsed: 0 
    };
    const { data, error } = await supabase.from('ingredients').insert([newIngredientData]).select();
    if (error) {
        console.error('Error adding ingredient:', error);
        return null;
    }
    return data?.[0] as Ingredient;
};

export const addBulkIngredients = async (ingredientDataList: IngredientFormData[]): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error("User not authenticated to add ingredients.");
        return false;
    }
    const now = new Date().toISOString();
    const newIngredients = ingredientDataList.map(ing => ({
        ...ing,
        user_id: user.id,
        createdAt: now,
        updatedAt: now,
        quantityUsed: 0
    }));

    const { error } = await supabase.from('ingredients').insert(newIngredients);
    if(error){
        console.error('Error bulk adding ingredients:', error);
    }
    return !error;
}

export const updateIngredient = async (itemNumber: string, updates: Partial<IngredientFormData>): Promise<boolean> => {
    const { error } = await supabase.from('ingredients').update({ ...updates, updatedAt: new Date().toISOString() }).eq('itemNumber', itemNumber);
    if (error) {
        console.error('Error updating ingredient:', error);
    }
    return !error;
};

export const deleteIngredient = async (itemNumber: string): Promise<boolean> => {
    const { error } = await supabase.from('ingredients').delete().eq('itemNumber', itemNumber);
    if (error) {
        console.error('Error deleting ingredient:', error);
    }
    return !error;
};
