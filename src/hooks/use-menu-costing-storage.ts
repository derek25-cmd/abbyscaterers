
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { MenuType, CateringMenu, CateringMenuRecipe, MenuCalculationResult, PlannedIngredient } from '@/types';
import {
    getMenuTypes as fetchMenuTypes,
    getCateringMenus as fetchMenus,
    getCateringMenuById as fetchMenuById,
    createCateringMenu as createMenu,
    updateCateringMenu as updateMenu,
    deleteCateringMenu as deleteMenu,
    getMenuRecipes as fetchMenuRecipes,
    addRecipeToMenu as addRecipe,
    removeRecipeFromMenu as removeRecipe,
    calculateMenuCost as calculate,
    getPlannedIngredients as fetchPlannedIngredients,
    addPlannedIngredient as addPlanned,
    updatePlannedIngredient as updatePlanned,
    deletePlannedIngredient as deletePlanned,
    syncPlannedIngredientsFromRecipes as syncPlanned,
} from '@/services/menuCostingService';

export function useMenuCostingStorage() {
    const [menuTypes, setMenuTypes] = useState<MenuType[]>([]);
    const [menus, setMenus] = useState<CateringMenu[]>([]);
    const [selectedMenu, setSelectedMenu] = useState<CateringMenu | null>(null);
    const [menuRecipes, setMenuRecipes] = useState<CateringMenuRecipe[]>([]);
    const [plannedIngredients, setPlannedIngredients] = useState<PlannedIngredient[]>([]);
    const [calculationResult, setCalculationResult] = useState<MenuCalculationResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCalculating, setIsCalculating] = useState(false);

    // ─── Load Menu Types ─────────────────────────────────────
    const refreshMenuTypes = useCallback(async () => {
        const data = await fetchMenuTypes();
        setMenuTypes(data);
    }, []);

    // ─── Load Menus ──────────────────────────────────────────
    const refreshMenus = useCallback(async () => {
        setIsLoading(true);
        const data = await fetchMenus();
        setMenus(data);
        setIsLoading(false);
    }, []);

    // ─── Load Recipes for Selected Menu ──────────────────────
    const refreshMenuRecipes = useCallback(async (menuId: string) => {
        const data = await fetchMenuRecipes(menuId);
        setMenuRecipes(data);
    }, []);

    // ─── Load Planned Ingredients for Selected Menu ──────────
    const refreshPlannedIngredients = useCallback(async (menuId: string) => {
        const data = await fetchPlannedIngredients(menuId);
        setPlannedIngredients(data);
    }, []);

    // ─── Initial Load ────────────────────────────────────────
    useEffect(() => {
        refreshMenuTypes();
        refreshMenus();
    }, [refreshMenuTypes, refreshMenus]);

    // ─── Select a Menu ───────────────────────────────────────
    const selectMenu = useCallback(async (menuId: string | null) => {
        if (!menuId) {
            setSelectedMenu(null);
            setMenuRecipes([]);
            setPlannedIngredients([]);
            setCalculationResult(null);
            return;
        }
        const menu = await fetchMenuById(menuId);
        setSelectedMenu(menu);
        if (menu) {
            await refreshMenuRecipes(menu.id);
            await refreshPlannedIngredients(menu.id);
        }
        setCalculationResult(null);
    }, [refreshMenuRecipes, refreshPlannedIngredients]);

    // ─── CRUD: Menus ─────────────────────────────────────────
    const addMenu = useCallback(async (data: Omit<CateringMenu, 'id' | 'created_at' | 'updated_at' | 'menu_type_name' | 'user_id'>) => {
        const newMenu = await createMenu(data);
        if (newMenu) {
            await refreshMenus();
        }
        return newMenu;
    }, [refreshMenus]);

    const editMenu = useCallback(async (id: string, updates: Partial<Omit<CateringMenu, 'id' | 'created_at' | 'updated_at' | 'menu_type_name' | 'user_id'>>) => {
        const success = await updateMenu(id, updates);
        if (success) {
            await refreshMenus();
            if (selectedMenu?.id === id) {
                await selectMenu(id);
            }
        }
        return success;
    }, [refreshMenus, selectMenu, selectedMenu]);

    const removeMenu = useCallback(async (id: string) => {
        const success = await deleteMenu(id);
        if (success) {
            await refreshMenus();
            if (selectedMenu?.id === id) {
                setSelectedMenu(null);
                setMenuRecipes([]);
                setPlannedIngredients([]);
                setCalculationResult(null);
            }
        }
        return success;
    }, [refreshMenus, selectedMenu]);

    // ─── CRUD: Menu Recipes ──────────────────────────────────
    const addRecipeToCurrentMenu = useCallback(async (recipeNumber: string) => {
        if (!selectedMenu) return null;
        const result = await addRecipe(selectedMenu.id, recipeNumber);
        if (result) {
            await refreshMenuRecipes(selectedMenu.id);
        }
        return result;
    }, [selectedMenu, refreshMenuRecipes]);

    const removeRecipeFromCurrentMenu = useCallback(async (id: string) => {
        if (!selectedMenu) return false;
        const success = await removeRecipe(id);
        if (success) {
            await refreshMenuRecipes(selectedMenu.id);
        }
        return success;
    }, [selectedMenu, refreshMenuRecipes]);

    // ─── CRUD: Planned Ingredients ───────────────────────────
    const addPlannedIngredientToMenu = useCallback(async (
        data: { ingredient_name: string; category: 'ingredient' | 'miscellaneous'; planned_quantity: number; unit: string; unit_cost: number }
    ) => {
        if (!selectedMenu) return null;
        const result = await addPlanned(selectedMenu.id, data);
        if (result) {
            await refreshPlannedIngredients(selectedMenu.id);
        }
        return result;
    }, [selectedMenu, refreshPlannedIngredients]);

    const updatePlannedIngredientInMenu = useCallback(async (
        id: string,
        updates: Partial<{ ingredient_name: string; category: 'ingredient' | 'miscellaneous'; planned_quantity: number; unit: string; unit_cost: number }>
    ) => {
        const success = await updatePlanned(id, updates);
        if (success && selectedMenu) {
            await refreshPlannedIngredients(selectedMenu.id);
        }
        return success;
    }, [selectedMenu, refreshPlannedIngredients]);

    const removePlannedIngredientFromMenu = useCallback(async (id: string) => {
        const success = await deletePlanned(id);
        if (success && selectedMenu) {
            await refreshPlannedIngredients(selectedMenu.id);
        }
        return success;
    }, [selectedMenu, refreshPlannedIngredients]);

    const syncPlannedFromCurrentMenu = useCallback(async () => {
        if (!selectedMenu) return false;
        const success = await syncPlanned(selectedMenu.id);
        if (success) {
            await refreshPlannedIngredients(selectedMenu.id);
        }
        return success;
    }, [selectedMenu, refreshPlannedIngredients]);

    // ─── Calculation ─────────────────────────────────────────
    const runCalculation = useCallback(async (people: number, useWastage: boolean) => {
        if (!selectedMenu) return null;
        setIsCalculating(true);
        try {
            const result = await calculate(selectedMenu.id, people, useWastage);
            setCalculationResult(result);
            return result;
        } catch (error) {
            console.error('Calculation error:', error);
            throw error;
        } finally {
            setIsCalculating(false);
        }
    }, [selectedMenu]);

    return {
        menuTypes,
        menus,
        selectedMenu,
        menuRecipes,
        plannedIngredients,
        calculationResult,
        isLoading,
        isCalculating,
        selectMenu,
        addMenu,
        editMenu,
        removeMenu,
        addRecipeToCurrentMenu,
        removeRecipeFromCurrentMenu,
        addPlannedIngredientToMenu,
        updatePlannedIngredientInMenu,
        removePlannedIngredientFromMenu,
        syncPlannedFromCurrentMenu,
        runCalculation,
        refreshMenus,
        setCalculationResult,
    };
}
