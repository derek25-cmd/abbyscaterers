
import { supabase } from '@/lib/supabase-client';
import type {
    MenuType,
    CateringMenu,
    CateringMenuRecipe,
    MenuCalculationResult,
    IngredientSummaryItem,
    PlannedIngredient,
    PlannedVsCalculated,
    Ingredient,
    Product,
    Recipe,
} from '@/types';

// ─── Menu Types ──────────────────────────────────────────────

export const getMenuTypes = async (): Promise<MenuType[]> => {
    const { data, error } = await supabase
        .from('menu_types')
        .select('*')
        .order('name');
    if (error) {
        console.error('Error fetching menu types:', error);
        return [];
    }
    return data as MenuType[];
};

// ─── Catering Menus ──────────────────────────────────────────

export const getCateringMenus = async (): Promise<CateringMenu[]> => {
    const { data, error } = await supabase
        .from('catering_menus')
        .select('*, menu_types(name)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching catering menus:', error);
        return [];
    }

    return (data || []).map((row: any) => ({
        ...row,
        menu_type_name: row.menu_types?.name ?? '',
    })) as CateringMenu[];
};

export const getCateringMenuById = async (id: string): Promise<CateringMenu | null> => {
    const { data, error } = await supabase
        .from('catering_menus')
        .select('*, menu_types(name)')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching catering menu:', error);
        return null;
    }

    return {
        ...data,
        menu_type_name: (data as any).menu_types?.name ?? '',
    } as CateringMenu;
};

export const createCateringMenu = async (
    menuData: Omit<CateringMenu, 'id' | 'created_at' | 'updated_at' | 'menu_type_name' | 'user_id'>
): Promise<CateringMenu | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error('User not authenticated');
        return null;
    }

    const { data, error } = await supabase
        .from('catering_menus')
        .insert([{ ...menuData, user_id: user.id }])
        .select('*, menu_types(name)')
        .single();

    if (error) {
        console.error('Error creating catering menu:', error);
        return null;
    }

    return {
        ...data,
        menu_type_name: (data as any).menu_types?.name ?? '',
    } as CateringMenu;
};

export const updateCateringMenu = async (
    id: string,
    updates: Partial<Omit<CateringMenu, 'id' | 'created_at' | 'updated_at' | 'menu_type_name' | 'user_id'>>
): Promise<boolean> => {
    const { error } = await supabase
        .from('catering_menus')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('Error updating catering menu:', error);
    }
    return !error;
};

export const deleteCateringMenu = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('catering_menus')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting catering menu:', error);
    }
    return !error;
};

// ─── Menu Recipes (Junction) ─────────────────────────────────

export const getMenuRecipes = async (menuId: string): Promise<CateringMenuRecipe[]> => {
    const { data, error } = await supabase
        .from('catering_menu_recipes')
        .select('*, recipes:recipe_number("recipeName", "recipeType")')
        .eq('menu_id', menuId)
        .order('created_at');

    if (error) {
        console.error('Error fetching menu recipes:', error);
        return [];
    }

    return (data || []).map((row: any) => ({
        id: row.id,
        menu_id: row.menu_id,
        recipe_number: row.recipe_number,
        recipe_name: row.recipes?.recipeName ?? 'Unknown Recipe',
        recipe_type: row.recipes?.recipeType ?? '',
        created_at: row.created_at,
    })) as CateringMenuRecipe[];
};

export const addRecipeToMenu = async (
    menuId: string,
    recipeNumber: string
): Promise<CateringMenuRecipe | null> => {
    const { data, error } = await supabase
        .from('catering_menu_recipes')
        .insert([{ menu_id: menuId, recipe_number: recipeNumber }])
        .select()
        .single();

    if (error) {
        console.error('Error adding recipe to menu:', error);
        return null;
    }
    return data as CateringMenuRecipe;
};

export const removeRecipeFromMenu = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('catering_menu_recipes')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error removing recipe from menu:', error);
    }
    return !error;
};

// ─── Planned Ingredients ─────────────────────────────────────

export const getPlannedIngredients = async (menuId: string): Promise<PlannedIngredient[]> => {
    const { data, error } = await supabase
        .from('menu_planned_ingredients')
        .select('*')
        .eq('menu_id', menuId)
        .order('ingredient_name');

    if (error) {
        console.error('Error fetching planned ingredients:', error);
        return [];
    }
    return data as PlannedIngredient[];
};

export const addPlannedIngredient = async (
    menuId: string,
    data: { ingredient_name: string; planned_quantity: number; unit: string; unit_cost: number }
): Promise<PlannedIngredient | null> => {
    const { data: result, error } = await supabase
        .from('menu_planned_ingredients')
        .insert([{ menu_id: menuId, ...data }])
        .select()
        .single();

    if (error) {
        console.error('Error adding planned ingredient:', error);
        return null;
    }
    return result as PlannedIngredient;
};

export const updatePlannedIngredient = async (
    id: string,
    updates: Partial<{ ingredient_name: string; planned_quantity: number; unit: string; unit_cost: number }>
): Promise<boolean> => {
    const { error } = await supabase
        .from('menu_planned_ingredients')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('Error updating planned ingredient:', error);
    }
    return !error;
};

export const deletePlannedIngredient = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('menu_planned_ingredients')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting planned ingredient:', error);
    }
    return !error;
};

export const syncPlannedIngredientsFromRecipes = async (menuId: string): Promise<boolean> => {
    // 1. Fetch menu recipes
    const menuRecipes = await getMenuRecipes(menuId);
    if (menuRecipes.length === 0) return true;

    // 2. Fetch full recipe data
    const recipeNumbers = menuRecipes.map(mr => mr.recipe_number);
    const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .in('recipeNumber', recipeNumbers);

    if (recipesError) {
        console.error('Error fetching recipes for sync:', recipesError);
        return false;
    }

    const recipes = (recipesData || []) as Recipe[];

    // 3. Aggregate 1:1 (base headcount)
    const aggregated = new Map<string, { quantity: number; unit: string }>();

    for (const recipe of recipes) {
        const recipeIngredients = recipe.ingredients || [];
        for (const ing of recipeIngredients) {
            const key = ing.ingredientId; // Using ingredientId (itemNumber) for aggregation
            const existing = aggregated.get(key);
            if (existing) {
                // Simplified: just assuming same units for now (normalization happens in billing usually)
                existing.quantity += ing.quantity;
            } else {
                aggregated.set(key, { quantity: ing.quantity, unit: ing.unit });
            }
        }
    }

    // 4. Resolve Names & Prices from Products catalog
    const { data: productsData } = await supabase
        .from('products')
        .select('name, "unitPrice", unit');
    
    // We need to match ingredientId (itemNumber) or name.
    // In our system, ingredients table maps itemNumber -> itemDescription (which matches product name)
    const { data: ingredientsData } = await supabase
        .from('ingredients')
        .select('"itemNumber", "itemDescription"');
    
    const ingredientLookup = new Map<string, string>();
    (ingredientsData || []).forEach((ing: any) => {
        ingredientLookup.set(ing.itemNumber, ing.itemDescription);
    });

    const productLookup = new Map<string, { unitPrice: number; unit: string }>();
    (productsData || []).forEach((p: any) => {
        productLookup.set(p.name.toLowerCase().trim(), {
            unitPrice: Number(p.unitPrice),
            unit: p.unit,
        });
    });

    const toInsert = Array.from(aggregated.entries()).map(([itemNumber, data]) => {
        const name = ingredientLookup.get(itemNumber) || itemNumber;
        const product = productLookup.get(name.toLowerCase().trim());
        
        return {
            menu_id: menuId,
            ingredient_name: name,
            planned_quantity: data.quantity,
            unit: product?.unit || data.unit || 'kg',
            unit_cost: product?.unitPrice || 0,
        };
    });

    if (toInsert.length === 0) return true;

    // 5. Clear old and insert new (Atomic-like)
    const { error: deleteError } = await supabase
        .from('menu_planned_ingredients')
        .delete()
        .eq('menu_id', menuId);

    if (deleteError) {
        console.error('Error clearing old planned ingredients:', deleteError);
        return false;
    }

    const { error: insertError } = await supabase
        .from('menu_planned_ingredients')
        .insert(toInsert);

    if (insertError) {
        console.error('Error inserting synced planned ingredients:', insertError);
        return false;
    }

    return true;
};

// ─── Unit Normalization ──────────────────────────────────────

/**
 * Normalize a quantity to a base unit (kg for mass, liters for volume, pcs for count).
 * Returns { quantity, unit } in normalized form.
 */
function normalizeUnit(quantity: number, unit: string): { quantity: number; unit: string } {
    const u = unit.toLowerCase().trim();
    switch (u) {
        case 'g':
        case 'gms':
        case 'grams':
            return { quantity: quantity / 1000, unit: 'kg' };
        case 'ml':
        case 'milliliters':
            return { quantity: quantity / 1000, unit: 'liters' };
        case 'kg':
        case 'liters':
        case 'pcs':
        case 'bunch':
        case 'item':
            return { quantity, unit: u === 'item' ? 'pcs' : u };
        default:
            return { quantity, unit: u };
    }
}

// ─── Calculation Engine ──────────────────────────────────────

export const calculateMenuCost = async (
    menuId: string,
    selectedPeople: number,
    useWastage: boolean
): Promise<MenuCalculationResult> => {
    // Validate inputs
    if (selectedPeople < 1) {
        throw new Error('Number of people must be at least 1');
    }

    // 1. Fetch the menu
    const menu = await getCateringMenuById(menuId);
    if (!menu) {
        throw new Error('Menu not found');
    }
    if (menu.base_people < 1) {
        throw new Error('Menu base_people must be at least 1');
    }

    // 2. Fetch recipes attached to this menu
    const menuRecipes = await getMenuRecipes(menuId);
    if (menuRecipes.length === 0) {
        return {
            ingredientsSummary: [],
            totalCost: 0,
            revenue: selectedPeople * Number(menu.price_per_person),
            profit: selectedPeople * Number(menu.price_per_person),
            margin: 100,
        };
    }

    // 3. Fetch full recipe data (with ingredients JSONB)
    const recipeNumbers = menuRecipes.map(mr => mr.recipe_number);
    const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .in('recipeNumber', recipeNumbers);

    if (recipesError) {
        console.error('Error fetching recipes for calculation:', recipesError);
        throw new Error('Failed to fetch recipe data');
    }

    const recipes = (recipesData || []) as Recipe[];

    // 4. Fetch all ingredients (for name lookup: ingredientId → itemDescription)
    const { data: ingredientsData } = await supabase
        .from('ingredients')
        .select('"itemNumber", "itemDescription"');
    const ingredientLookup = new Map<string, string>();
    (ingredientsData || []).forEach((ing: any) => {
        ingredientLookup.set(ing.itemNumber, ing.itemDescription);
    });

    // 5. Fetch all products (for pricing: name → unitPrice)
    const { data: productsData } = await supabase
        .from('products')
        .select('name, "unitPrice", unit');
    const productLookup = new Map<string, { unitPrice: number; unit: string }>();
    (productsData || []).forEach((p: any) => {
        productLookup.set(p.name.toLowerCase().trim(), {
            unitPrice: Number(p.unitPrice),
            unit: p.unit,
        });
    });

    // 6. Compute scaling factor
    const scalingFactor = selectedPeople / menu.base_people;
    const wastageFactor = useWastage ? 1.1 : 1.0;

    // 7. Aggregate ingredients across all recipes
    const aggregated = new Map<string, IngredientSummaryItem>();

    for (const recipe of recipes) {
        const recipeIngredients = recipe.ingredients || [];
        for (const ing of recipeIngredients) {
            // Resolve ingredient name
            const ingredientName = ingredientLookup.get(ing.ingredientId) || ing.ingredientId;

            // Scale quantity
            const scaledQty = ing.quantity * scalingFactor * wastageFactor;

            // Normalize units
            const normalized = normalizeUnit(scaledQty, ing.unit);

            // Look up pricing from products
            const productMatch = productLookup.get(ingredientName.toLowerCase().trim());
            const unitCost = productMatch ? productMatch.unitPrice : 0;

            // Aggregate
            const key = `${ingredientName.toLowerCase().trim()}__${normalized.unit}`;
            const existing = aggregated.get(key);

            if (existing) {
                existing.totalQuantity += normalized.quantity;
                existing.totalCost = existing.totalQuantity * existing.unitCost;
            } else {
                aggregated.set(key, {
                    ingredient: ingredientName,
                    totalQuantity: normalized.quantity,
                    unit: normalized.unit,
                    unitCost,
                    totalCost: normalized.quantity * unitCost,
                });
            }
        }
    }

    // 8. Compute totals
    const ingredientsSummary = Array.from(aggregated.values()).sort((a, b) =>
        a.ingredient.localeCompare(b.ingredient)
    );

    // Round quantities to 2 decimal places for cleanliness
    ingredientsSummary.forEach(item => {
        item.totalQuantity = Math.round(item.totalQuantity * 100) / 100;
        item.totalCost = Math.round(item.totalCost * 100) / 100;
    });

    const totalCost = ingredientsSummary.reduce((sum, item) => sum + item.totalCost, 0);
    const revenue = selectedPeople * Number(menu.price_per_person);
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? Math.round(((profit / revenue) * 100) * 100) / 100 : 0;

    // 9. Build planned vs calculated comparison
    const plannedIngredients = await getPlannedIngredients(menuId);
    let plannedComparison: PlannedVsCalculated[] | undefined;

    if (plannedIngredients.length > 0) {
        // Build a combined set of all ingredient names
        const allNames = new Set<string>();
        plannedIngredients.forEach(pi => allNames.add(pi.ingredient_name.toLowerCase().trim()));
        ingredientsSummary.forEach(is => allNames.add(is.ingredient.toLowerCase().trim()));

        // Build lookup maps
        const plannedMap = new Map<string, PlannedIngredient>();
        plannedIngredients.forEach(pi => plannedMap.set(pi.ingredient_name.toLowerCase().trim(), pi));

        const calculatedMap = new Map<string, IngredientSummaryItem>();
        ingredientsSummary.forEach(is => calculatedMap.set(is.ingredient.toLowerCase().trim(), is));

        plannedComparison = Array.from(allNames).sort().map(name => {
            const planned = plannedMap.get(name);
            const calculated = calculatedMap.get(name);

            const plannedQty = planned ? Number(planned.planned_quantity) : 0;
            const calculatedQty = calculated ? calculated.totalQuantity : 0;
            const plannedUnitCost = planned ? Number(planned.unit_cost) : 0;
            const calculatedUnitCost = calculated ? calculated.unitCost : 0;

            const plannedCost = Math.round(plannedQty * plannedUnitCost * 100) / 100;
            const calculatedCost = calculated ? calculated.totalCost : 0;

            return {
                ingredient: planned?.ingredient_name || calculated?.ingredient || name,
                unit: planned?.unit || calculated?.unit || 'kg',
                plannedQty: Math.round(plannedQty * 100) / 100,
                calculatedQty: Math.round(calculatedQty * 100) / 100,
                difference: Math.round((calculatedQty - plannedQty) * 100) / 100,
                plannedCost,
                calculatedCost: Math.round(calculatedCost * 100) / 100,
                costDifference: Math.round((calculatedCost - plannedCost) * 100) / 100,
            };
        });
    }

    return {
        ingredientsSummary,
        totalCost: Math.round(totalCost * 100) / 100,
        revenue: Math.round(revenue * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin,
        plannedComparison,
    };
};
