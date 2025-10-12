
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

export const getLatestRecipeNumber = async (): Promise<number> => {
    const { data, error } = await supabase
        .from('recipes')
        .select('recipeNumber')
        .order('createdAt', { ascending: false })
        .limit(1)
        .single();
    
    if(error || !data) {
        if(error && error.code !== 'PGRST116') { // PGRST116 = no rows found
             console.error("Error fetching latest recipe number", error);
        }
        return 1;
    }

    const match = data.recipeNumber.match(/RN-(\d+)/);
    if (match) {
        return parseInt(match[1], 10) + 1;
    }

    return 1; // Default if no matching format is found
}

export const addRecipe = async (recipeData: Omit<RecipeFormData, 'recipeNumber'>): Promise<Recipe | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error("User not authenticated to add a recipe.");
        return null;
    }

    const now = new Date().toISOString();
    const { recipeName, recipeType, ingredients } = recipeData;
    
    // The recipeNumber is now handled by the database, so we don't include it here.
    const newRecipeData = { 
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

    return data as Recipe;
};


export const updateRecipe = async (recipeNumber: string, updates: Partial<RecipeFormData>): Promise<boolean> => {
    // Exclude recipeNumber from the update payload as it should not be changed.
    const { recipeNumber: _, ...updatePayload } = updates;
    
    const { error } = await supabase.from('recipes').update({ ...updatePayload, updatedAt: new Date().toISOString() }).eq('recipeNumber', recipeNumber);
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
