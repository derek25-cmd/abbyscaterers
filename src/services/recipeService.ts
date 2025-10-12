
import { supabase } from '@/lib/supabase-client';
import type { Recipe } from '@/types';
import type { RecipeFormData } from '@/lib/schemas';

export const getRecipes = async (): Promise<Recipe[]> => {
    const { data, error } = await supabase.from('recipes').select('*');
    if (error) {
        console.error('Error fetching recipes:', error);
        return [];
    }
    return data as Recipe[];
};

export const getRecipeById = async (recipeNumber: string): Promise<Recipe | null> => {
    const { data, error } = await supabase.from('recipes').select('*').eq('recipeNumber', recipeNumber).single();
    if (error) {
        console.error('Error fetching recipe by id:', error);
        return null;
    }
    return data as Recipe;
}

export const addRecipe = async (recipeData: RecipeFormData): Promise<Recipe | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error("User not authenticated to add a recipe.");
        return null;
    }

    const settings = JSON.parse(localStorage.getItem('caterSmartAppSettings') || '{}');
    const nextRecipeNumber = settings.nextRecipeNumber || 1;
    const newRecipeNumber = `RN-${String(nextRecipeNumber).padStart(5, '0')}`;

    const now = new Date().toISOString();
    const { recipeName, recipeType, ingredients } = recipeData;
    
    const newRecipeData = { 
        recipeNumber: newRecipeNumber,
        recipeName,
        recipeType,
        ingredients: ingredients || [],
        user_id: user.id,
        createdAt: now, 
        updatedAt: now 
    };

    const { data, error } = await supabase.from('recipes').insert([newRecipeData]).select().single();
    
    if (error) {
        console.error('Error adding recipe:', error);
        return null;
    }

    localStorage.setItem('caterSmartAppSettings', JSON.stringify({ ...settings, nextRecipeNumber: nextRecipeNumber + 1 }));

    return data as Recipe;
};


export const updateRecipe = async (recipeNumber: string, updates: Partial<RecipeFormData>): Promise<boolean> => {
    const { error } = await supabase.from('recipes').update({ ...updates, updatedAt: new Date().toISOString() }).eq('recipeNumber', recipeNumber);
    if (error) {
        console.error('Error updating recipe:', error);
    }
    return !error;
};

export const deleteRecipe = async (recipeNumber: string): Promise<boolean> => {
    const { error } = await supabase.from('recipes').delete().eq('recipeNumber', recipeNumber);
    if (error) {
        console.error('Error deleting recipe:', error);
    }
    return !error;
};
