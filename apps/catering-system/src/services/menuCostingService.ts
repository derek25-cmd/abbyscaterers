
import { supabase } from '@/lib/supabase-client';
import { toPriceUnit, UnitError } from '@/lib/costing/units';
import { BRANCH_KEYS } from '@/types';
import type {
    Branch,
    MenuType,
    CateringMenu,
    CateringMenuRecipe,
    MenuCalculationResult,
    IngredientSummaryItem,
    PlannedIngredient,
    PlannedVsCalculated,
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
    data: { ingredient_name: string; category: 'ingredient' | 'miscellaneous'; planned_quantity: number; unit: string; unit_cost: number }
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
    updates: Partial<{ ingredient_name: string; category: 'ingredient' | 'miscellaneous'; planned_quantity: number; unit: string; unit_cost: number }>
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

    // 3. Products: recipe lines link to them directly (line.productId).
    const { data: productsData } = await supabase
        .from('products')
        .select('id, name, unit, base_unit, grams_per_item, "unitPrice_dar"');
    const productById = new Map<string, any>();
    (productsData || []).forEach((p: any) => productById.set(p.id, p));

    // 4. Aggregate 1:1 (base headcount) per product, in the product's price
    // unit so planned quantity x unit cost is right. Lines without a product,
    // or whose unit cannot be converted, keep their own quantity and unit with
    // unit cost 0 for the user to complete in the planned list (as before).
    // TODO(data-readiness Step 9): the sync has no branch context, so it uses
    // the Dar es Salaam price; use the menu's branch once the region-to-branch
    // map exists.
    const aggregated = new Map<string, { name: string; quantity: number; unit: string; unitCost: number }>();

    for (const recipe of recipes) {
        const recipeLines = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
        for (const line of recipeLines) {
            const product = line.productId ? productById.get(line.productId) : undefined;
            const priceUnit = product ? String(product.base_unit || product.unit || '').trim().toLowerCase() : '';
            let quantity = line.quantity;
            let unit: string = line.unit;
            let unitCost = 0;
            if (product) {
                try {
                    quantity = toPriceUnit(line.quantity, line.unit, priceUnit, product.grams_per_item);
                    unit = priceUnit;
                    unitCost = Number(product.unitPrice_dar) > 0 ? Number(product.unitPrice_dar) : 0;
                } catch (error) {
                    if (!(error instanceof UnitError)) throw error;
                }
            }
            const name = product ? String(product.name || product.id).trim() : (line.ingredientId || 'Unnamed line');
            const key = `${product ? product.id : name}__${unit}`;
            const existing = aggregated.get(key);
            if (existing) {
                existing.quantity += quantity;
            } else {
                aggregated.set(key, { name, quantity, unit, unitCost });
            }
        }
    }

    const toInsert = Array.from(aggregated.values()).map(item => ({
        menu_id: menuId,
        ingredient_name: item.name,
        planned_quantity: Math.round(item.quantity * 1000) / 1000,
        unit: item.unit || 'kg',
        unit_cost: item.unitCost,
    }));

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

// ─── Calculation Engine ──────────────────────────────────────

/**
 * Calculates a dynamic efficiency factor based on group size.
 * Rule: "Food is always profitable with large numbers of people".
 * Meaning: Unit cost decreases for larger groups and increases for smaller ones.
 */
const getEfficiencyInfo = (currentPax: number, basePax: number) => {
    if (basePax <= 0) return { factor: 1.0, status: "Neutral" };
    const ratio = currentPax / basePax;
    
    let factor = 1.0;
    let status = "Standard Group Size";

    if (ratio < 1) {
        // Smaller than benchmark: Inefficiency penalty (max 20% at 0 pax)
        factor = 1.0 + (1 - ratio) * 0.2;
        status = "Small Group Inefficiency";
    } else if (ratio > 1) {
        // Larger than benchmark: Bulk savings (max 10%)
        const savingsRatio = Math.min(ratio - 1, 4); // Cap savings at 5x group size
        factor = 1.0 - (savingsRatio * 0.02); // 2.0% saving per multiple of group size
        factor = Math.max(factor, 0.90); // Cap at 10% total savings
        status = "Bulk Scale Efficiency";
    }

    return { factor, status };
};

/**
 * Costs a catering menu for a number of people at one branch.
 *
 * Each recipe ingredient is priced through its linked product
 * (ingredients.product_id) at that branch's price, with the quantity
 * converted into the unit the product is priced in (products.base_unit,
 * falling back to products.unit). Nothing is ever costed at zero: an
 * ingredient with no product, a product with no price at the branch, or a
 * unit that cannot be converted is left out of the total and listed in
 * missingPrices instead, so the total is visibly incomplete rather than
 * silently too low. Scaling, wastage, efficiency and the planned comparison
 * are unchanged.
 */
export const calculateMenuCost = async (
    menuId: string,
    selectedPeople: number,
    useWastage: boolean,
    branch: Branch = 'Dar es Salaam'
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
            plannedTotalCost: 0,
            revenue: selectedPeople * Number(menu.price_per_person),
            profit: selectedPeople * Number(menu.price_per_person),
            plannedProfit: selectedPeople * Number(menu.price_per_person),
            margin: 100,
            plannedMargin: 100,
            efficiencyFactor: 1.0,
            efficiencyStatus: "No Recipes Added",
            missingPrices: [],
            branch,
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

    // 4. Fetch products: name, price unit, piece weight and per-branch prices.
    // Recipe lines link to products directly (line.productId).
    const { data: productsData } = await supabase
        .from('products')
        .select('id, name, unit, base_unit, grams_per_item, "unitPrice_dar", "unitPrice_arusha", "unitPrice_dodoma"');
    const productById = new Map<string, any>();
    (productsData || []).forEach((p: any) => {
        productById.set(p.id, p);
    });
    const priceKey = BRANCH_KEYS[branch].price;

    // 5. Compute scaling factor and efficiency
    const { factor: efficiencyFactor, status: efficiencyStatus } = getEfficiencyInfo(selectedPeople, menu.base_people);
    const scalingFactor = selectedPeople / menu.base_people;
    const wastageFactor = useWastage ? 1.1 : 1.0;
    
    // Total combined scaling per item
    const totalItemScaling = scalingFactor * wastageFactor * efficiencyFactor;

    // 6. Aggregate ingredients across all recipes. Lines that cannot be
    // priced are collected in missingPrices and never added at zero.
    const aggregated = new Map<string, IngredientSummaryItem>();
    const missing = new Set<string>();

    // A recipe that contributes nothing would otherwise make the total look
    // complete at zero: one that cannot be read (recipes are owner-only under
    // RLS) or one with no ingredient lines yet.
    const foundRecipes = new Set(recipes.map(r => r.recipeNumber));
    for (const mr of menuRecipes) {
        if (!foundRecipes.has(mr.recipe_number)) {
            // The name may be unreadable too, so name it by its number.
            missing.add(`${mr.recipe_number} (recipe not found)`);
        }
    }

    for (const recipe of recipes) {
        const recipeIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
        if (recipeIngredients.length === 0) {
            missing.add(`${recipe.recipeName || recipe.recipeNumber} (no ingredients)`);
            continue;
        }
        for (const line of recipeIngredients) {
            const product = line.productId ? productById.get(line.productId) : undefined;
            if (!product) {
                // No catalog product: a line saved before recipes used products
                // (ingredientId only), or a product that has since been deleted.
                missing.add(line.productId
                    ? `${line.productId} (product not found)`
                    : `${line.ingredientId || 'Unnamed line'} (no product)`);
                continue;
            }
            const productName = String(product.name || product.id).trim();

            const unitCost = Number(product[priceKey]);
            if (!(unitCost > 0)) {
                missing.add(productName);
                continue;
            }

            const priceUnit = String(product.base_unit || product.unit || '').trim().toLowerCase();
            const scaledQty = line.quantity * totalItemScaling;
            let quantity: number;
            try {
                quantity = toPriceUnit(scaledQty, line.unit, priceUnit, product.grams_per_item);
            } catch (error) {
                if (error instanceof UnitError) {
                    missing.add(`${productName} (unit)`);
                    continue;
                }
                throw error;
            }

            // One line per product across all recipes. The planned comparison
            // matches on this name (planned rows synced from recipes use it too).
            const key = product.id;
            const existing = aggregated.get(key);

            if (existing) {
                existing.totalQuantity += quantity;
                existing.totalCost = existing.totalQuantity * existing.unitCost;
            } else {
                aggregated.set(key, {
                    ingredient: productName,
                    totalQuantity: quantity,
                    unit: priceUnit,
                    unitCost,
                    totalCost: quantity * unitCost,
                });
            }
        }
    }
    const missingPrices = Array.from(missing).sort((a, b) => a.localeCompare(b));

    // 7. Compute totals
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

    const plannedIngredients = await getPlannedIngredients(menuId);
    let plannedComparison: PlannedVsCalculated[] | undefined;
    
    // Sum of planned costs (manually listed by user)
    // IMPORTANT: Applying the same dynamic efficiency/scaling to the user's manual list
    // so it reflects the headcount reality.
    const plannedTotalCost = plannedIngredients.reduce((sum, pi) => {
        const cost = Number(pi.planned_quantity) * Number(pi.unit_cost) * totalItemScaling;
        return sum + cost;
    }, 0);

    const plannedProfit = revenue - plannedTotalCost;
    const plannedMargin = revenue > 0 ? Math.round(((plannedProfit / revenue) * 100) * 100) / 100 : 0;

    if (plannedIngredients.length > 0) {
        // ... (rest of the comparison logic)
        // Adjust plannedComparison loops to use scaled cost
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
            const scaledPlannedQty = plannedQty * totalItemScaling;
            const calculatedQty = calculated ? calculated.totalQuantity : 0;
            const plannedUnitCost = planned ? Number(planned.unit_cost) : 0;
            const calculatedUnitCost = calculated ? calculated.unitCost : 0;

            const plannedCost = Math.round(plannedQty * plannedUnitCost * totalItemScaling * 100) / 100;
            const calculatedCost = calculated ? calculated.totalCost : 0;

            return {
                ingredient: planned?.ingredient_name || calculated?.ingredient || name,
                category: planned?.category || 'ingredient',
                unit: planned?.unit || calculated?.unit || 'kg',
                plannedQty: Math.round(scaledPlannedQty * 100) / 100,
                calculatedQty: Math.round(calculatedQty * 100) / 100,
                difference: Math.round((calculatedQty - scaledPlannedQty) * 100) / 100,
                plannedCost,
                calculatedCost: Math.round(calculatedCost * 100) / 100,
                costDifference: Math.round((calculatedCost - plannedCost) * 100) / 100,
            };
        });
    }

    return {
        ingredientsSummary,
        totalCost: Math.round(totalCost * 100) / 100,
        plannedTotalCost: Math.round(plannedTotalCost * 100) / 100,
        revenue: Math.round(revenue * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        plannedProfit: Math.round(plannedProfit * 100) / 100,
        margin,
        plannedMargin,
        efficiencyFactor,
        efficiencyStatus,
        plannedComparison,
        missingPrices,
        branch,
    };
};
