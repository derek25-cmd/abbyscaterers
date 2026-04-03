
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { 
    Plus, ChevronRight, Search, LayoutDashboard, Calculator, 
    MoreVertical, Trash2, Edit2, Loader2, ChefHat, ShoppingBasket,
    ArrowRight, Sparkles, Filter, Package, AlertCircle, ShoppingCart,
    Utensils, DollarSign, Calendar, TrendingUp, Info, PlusCircle,
    Check, ChevronsUpDown, Wand2, Users
} from "lucide-react";
import { format } from "date-fns";
import type { CateringMenu, MenuType, CateringMenuRecipe, MenuCalculationResult, PlannedIngredient, Product } from "@/types";
import { 
    getMenuRecipes, 
    getPlannedIngredients, 
    addPlannedIngredient, 
    deletePlannedIngredient, 
    calculateMenuCost, 
    addRecipeToMenu, 
    removeRecipeFromMenu 
} from "@/services/menuCostingService";
import { useMenuCostingStorage } from "@/hooks/use-menu-costing-storage";
import { getRecipeById } from "@/services/recipeService";
import { getProducts } from "@/services/productService";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MenuFormDialog } from "./MenuFormDialog";
import { RecipeSelectionDialog } from "@/components/menu-costing/RecipeSelectionDialog";
import { CostCalculatorPanel } from "./CostCalculatorPanel";
import { cn } from "@/lib/utils";

const UNIT_OPTIONS = ["kg", "g", "l", "ml", "pcs", "pack", "tray", "box", "bunch", "bucket"];

export default function MenuCostingDashboard() {
    const { toast } = useToast();
    const {
        menus, menuTypes, isLoading,
        refreshMenus, removeMenu,
        addMenu, editMenu,
        selectMenu, syncPlannedFromCurrentMenu,
        menuRecipes: hookRecipes,
        plannedIngredients: hookPlanned,
        calculationResult: hookCalculation,
        isCalculating: hookIsCalculating,
        runCalculation: hookRunCalculation,
        addRecipeToCurrentMenu,
        removeRecipeFromCurrentMenu,
        addPlannedIngredientToMenu,
        removePlannedIngredientFromMenu,
        setCalculationResult
    } = useMenuCostingStorage();

    const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
    const menuRecipes = hookRecipes;
    const plannedIngredients = hookPlanned;
    const calculationResult = hookCalculation;
    const isCalculating = hookIsCalculating;

    const [products, setProducts] = useState<Product[]>([]);
    const [productsLoading, setProductsLoading] = useState(false);
    
    const [menuFormOpen, setMenuFormOpen] = useState(false);
    const [editingMenu, setEditingMenu] = useState<CateringMenu | null>(null);
    const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);

    const [isSyncing, setIsSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState("composition");

    // Planned Ingredient Form State
    const [addingPlanned, setAddingPlanned] = useState(false);
    const [newIngName, setNewIngName] = useState("");
    const [newIngCategory, setNewIngCategory] = useState<'ingredient' | 'miscellaneous'>('ingredient');
    const [newIngQty, setNewIngQty] = useState(0);
    const [newIngUnit, setNewIngUnit] = useState("kg");
    const [newIngCost, setNewIngCost] = useState(0);
    const [ingredientComboOpen, setIngredientComboOpen] = useState(false);

    const selectedMenu = menus.find(m => m.id === selectedMenuId);

    useEffect(() => {
        if (selectedMenuId) {
            loadMenuDetails(selectedMenuId);
            loadProducts();
        }
    }, [selectedMenuId]);

    const loadMenuDetails = async (id: string) => {
        // Now handled by hook's selectMenu
        await selectMenu(id);
    };

    const loadProducts = async () => {
        setProductsLoading(true);
        try {
            const data = await getProducts();
            setProducts(data);
        } catch (error) {
            console.error("Error loading products:", error);
        } finally {
            setProductsLoading(false);
        }
    };

    const handleSelectProductForPlanned = (name: string) => {
        const product = products.find(p => p.name === name);
        if (product) {
            setNewIngName(product.name);
            setNewIngUnit(product.unit);
            setNewIngCost(Number(product.unitPrice));
            setIngredientComboOpen(false);
        }
    };

    const handleAddPlannedIngredient = async () => {
        if (!selectedMenuId || !newIngName.trim()) return;
        setAddingPlanned(true);
        try {
            await addPlannedIngredientToMenu({
                ingredient_name: newIngName,
                category: newIngCategory,
                planned_quantity: newIngQty,
                unit: newIngUnit,
                unit_cost: newIngCost
            });
            // State is updated automatically by hook after addPlannedIngredientToMenu
            setNewIngName("");
            setNewIngQty(0);
            toast({ title: "Added to Budget", description: `${newIngName} has been added.` });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setAddingPlanned(false);
        }
    };

    const handleRemovePlannedIngredient = async (item: PlannedIngredient) => {
        try {
            await removePlannedIngredientFromMenu(item.id);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to remove item." });
        }
    };

    const handleSyncPlanned = async () => {
        if (!selectedMenuId) return;
        setIsSyncing(true);
        try {
            await syncPlannedFromCurrentMenu();
            await loadMenuDetails(selectedMenuId);
            toast({ title: "Smart Sync Complete", description: "Budget updated from recipes and catalog." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Sync Failed", description: error.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleMenuFormSubmit = async (data: any) => {
        if (editingMenu) {
            await editMenu(editingMenu.id, data);
            toast({ title: "Menu Updated", description: "Package details have been saved." });
        } else {
            const newMenu = await addMenu(data);
            if (newMenu) {
                setSelectedMenuId(newMenu.id);
                toast({ title: "Menu Created", description: "Select recipes to begin costing." });
            }
        }
        setMenuFormOpen(false);
        setEditingMenu(null);
    };

    const handleAddRecipe = async (recipeId: string) => {
        if (!selectedMenuId) return;
        try {
            await addRecipeToCurrentMenu(recipeId);
            toast({ title: "Recipe Added", description: "Dish linked to menu." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Dish already in menu or error occurred." });
        }
    };

    const handleRemoveRecipe = async (mrId: string) => {
        try {
            await removeRecipeFromCurrentMenu(mrId);
            toast({ title: "Recipe Removed", description: "Dish unlinked from menu." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to remove recipe." });
        }
    };

    const runCalculation = async (people: number, useWastage: boolean) => {
        if (!selectedMenuId) return null;
        try {
            return await hookRunCalculation(people, useWastage);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Calculation Failed", description: error.message });
            return null;
        }
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.1)] ring-1 ring-muted">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <LayoutDashboard className="h-6 w-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground">Menu Costing</h1>
                    </div>
                    <p className="text-muted-foreground font-medium ml-11">Precision analysis & recipe-based financial modeling.</p>
                </div>
                <div className="flex items-center gap-3 self-end md:self-center">
                    <Button 
                        onClick={() => { setEditingMenu(null); setMenuFormOpen(true); }}
                        className="rounded-2xl h-14 px-8 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 gap-2 font-black text-sm uppercase tracking-widest"
                    >
                        <Plus className="h-5 w-5" />
                        New Master Menu
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* ─── SIDEBAR: Menu List ─── */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-muted">
                        <CardHeader className="pb-4 pt-8 px-8">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl font-black">All Menus</CardTitle>
                                <Badge variant="secondary" className="rounded-lg px-2 py-0.5 font-bold text-[10px] uppercase">
                                    {menus.length} Packages
                                </Badge>
                            </div>
                            <div className="relative mt-4">
                                <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                                <Input 
                                    placeholder="Quick search menus..." 
                                    className="pl-10 h-11 bg-muted/30 border-none rounded-xl focus-visible:ring-primary/20 font-medium"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-6">
                            <ScrollArea className="h-[600px] pr-4">
                                <div className="space-y-2">
                                    {menus.map((menu) => (
                                        <motion.div
                                            key={menu.id}
                                            whileHover={{ x: 4 }}
                                            className={cn(
                                                "group relative flex items-center gap-4 p-4 rounded-3xl transition-all border-2 cursor-pointer",
                                                selectedMenuId === menu.id 
                                                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/25" 
                                                    : "bg-white border-transparent hover:bg-muted/50 hover:border-muted"
                                            )}
                                            onClick={() => setSelectedMenuId(menu.id)}
                                        >
                                            <div className={cn(
                                                "p-3 rounded-2xl transition-colors",
                                                selectedMenuId === menu.id ? "bg-white/20" : "bg-muted group-hover:bg-white shadow-sm"
                                            )}>
                                                <ChefHat className={cn("h-5 w-5", selectedMenuId === menu.id ? "text-white" : "text-primary")} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black truncate text-sm tracking-tight">{menu.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5 opacity-70">
                                                    <span className="text-[10px] font-black uppercase tracking-wider">
                                                        {menuTypes.find(t => t.id === menu.menu_type_id)?.name || "Menu"}
                                                    </span>
                                                    <div className="h-1 w-1 rounded-full bg-current" />
                                                    <span className="text-[10px] font-black">{menu.base_people} PAX</span>
                                                </div>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ChevronRight className="h-5 w-5" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* ─── MAIN: Menu Details & Tabs ─── */}
                <div className="lg:col-span-8">
                    {!selectedMenu ? (
                        <div className="h-full flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-muted/50 space-y-6">
                            <div className="p-6 bg-muted/30 rounded-[2.5rem]">
                                <Utensils className="h-16 w-16 text-muted-foreground/20" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black text-muted-foreground/60">No Menu Selected</h3>
                                <p className="text-muted-foreground/40 font-medium max-w-[300px] mx-auto text-sm leading-relaxed text-balance">
                                    Select a catering package from the sidebar or create a new one to begin dynamic costing.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedMenu.id}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-8"
                            >
                                {/* Active Menu Detail Card */}
                                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl ring-1 ring-muted relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                                        <ChefHat className="h-48 w-48" />
                                    </div>
                                    <div className="relative z-10 space-y-6">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="space-y-3">
                                                <Badge variant="outline" className="rounded-lg px-3 py-1 bg-white border-muted shadow-sm text-[10px] font-black uppercase tracking-widest text-primary">
                                                    {menuTypes.find(t => t.id === selectedMenu.menu_type_id)?.name} Package
                                                </Badge>
                                                <h2 className="text-4xl font-black tracking-tighter text-foreground">{selectedMenu.name}</h2>
                                                <div className="flex items-center gap-4 text-muted-foreground font-bold">
                                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-black/5 rounded-full text-xs">
                                                        <Users className="h-3.5 w-3.5" />
                                                        {selectedMenu.base_people} PAX Base
                                                    </span>
                                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-black/10 rounded-full text-xs">
                                                        <DollarSign className="h-3.5 w-3.5" />
                                                        TZS {Number(selectedMenu.price_per_person).toLocaleString()} / Guest
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="outline" size="sm" 
                                                    onClick={() => { setEditingMenu(selectedMenu); setMenuFormOpen(true); }}
                                                    className="rounded-xl h-11 px-6 font-bold border-muted hover:bg-muted"
                                                >
                                                    <Edit2 className="h-4 w-4 mr-2" />
                                                    Edit Package
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-destructive hover:bg-red-50 hover:text-red-600">
                                                            <Trash2 className="h-5 w-5" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-3xl">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-xl font-bold">Delete Menu Package?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently remove "{selectedMenu.name}" and all associated costing data.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => removeMenu(selectedMenu.id)} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">Delete Menu</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabs Navigation - Modern Style */}
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                                    <TabsList className="bg-white p-2 rounded-2xl h-16 shadow-lg shadow-black/5 ring-1 ring-muted w-full md:w-fit gap-2">
                                        <TabsTrigger value="composition" className="rounded-xl px-8 h-12 font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white">
                                            Composition
                                        </TabsTrigger>
                                        <TabsTrigger value="budget" className="rounded-xl px-8 h-12 font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white">
                                            Planned Budget
                                        </TabsTrigger>
                                        <TabsTrigger value="analysis" className="rounded-xl px-8 h-12 font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white">
                                            Analysis
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* ─── TAB: Composition (Recipes) ─── */}
                                    <TabsContent value="composition">
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-6"
                                        >
                                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-muted">
                                                <CardHeader className="flex flex-row items-center justify-between px-8 pt-8">
                                                    <div>
                                                        <CardTitle className="text-xl">Associated Dishes</CardTitle>
                                                        <CardDescription>Select recipes to include in this menu package.</CardDescription>
                                                    </div>
                                                    <Button onClick={() => setRecipeDialogOpen(true)} className="rounded-xl h-11 px-6 font-bold shadow-lg shadow-primary/10">
                                                        <PlusCircle className="h-4 w-4 mr-2" />
                                                        Add Recipe
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="px-8 pb-8 pt-4">
                                                    {menuRecipes.length === 0 ? (
                                                        <div className="text-center py-12 bg-muted/20 rounded-[2rem] border-2 border-dashed border-muted space-y-4">
                                                            <Package className="h-10 w-10 mx-auto text-muted-foreground/30" />
                                                            <p className="text-sm font-bold text-muted-foreground/60">No recipes added yet.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {menuRecipes.map((mr) => (
                                                                <div key={mr.id} className="group relative flex items-center gap-4 p-5 rounded-[2rem] bg-muted/30 border border-muted/50 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all">
                                                                    <div className="p-3 bg-white rounded-2xl shadow-sm text-primary">
                                                                        <ChefHat className="h-5 w-5" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-black text-sm tracking-tight truncate">{mr.recipe_name}</p>
                                                                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{mr.recipe_type}</p>
                                                                    </div>
                                                                    <Button 
                                                                        variant="ghost" size="icon" 
                                                                        onClick={() => handleRemoveRecipe(mr.id)}
                                                                        className="h-9 w-9 rounded-full text-destructive opacity-0 group-hover:opacity-100 hover:bg-red-50"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                            <RecipeSelectionDialog 
                                                open={recipeDialogOpen} 
                                                onOpenChange={setRecipeDialogOpen} 
                                                onSelect={handleAddRecipe} 
                                                existingRecipeIds={menuRecipes.map(mr => mr.recipe_number)}
                                            />
                                        </motion.div>
                                    </TabsContent>

                                    {/* ─── TAB: Budget (Planned Ingredients) ─── */}
                                    <TabsContent value="budget">
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-6"
                                        >
                                            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-muted">
                                                <CardHeader className="flex flex-row items-center justify-between px-8 pt-8">
                                                    <div className="space-y-1">
                                                        <CardTitle className="text-xl">Planned Budget</CardTitle>
                                                        <CardDescription>Set your expected ingredient usage for comparison.</CardDescription>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button 
                                                                    variant="outline" 
                                                                    className="rounded-xl gap-2 h-10 border-primary/20 text-primary hover:bg-primary/5 font-bold"
                                                                    disabled={menuRecipes.length === 0 || isSyncing}
                                                                >
                                                                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                                                    Smart Sync
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="rounded-3xl">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="flex items-center gap-2">
                                                                        <Sparkles className="h-5 w-5 text-primary" />
                                                                        Clear & Sync with Recipes?
                                                                    </AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This will clear all current planned ingredients and auto-populate the budget based on the attached recipes at the base headcount ({selectedMenu.base_people} PAX).
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={handleSyncPlanned} className="bg-primary text-white rounded-xl text-xs font-bold px-6">Clear & Sync</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="pt-6 space-y-6 px-8 pb-8">
                                                    {/* Add Row - Exceptional Form UI */}
                                                    <div className="p-5 rounded-[2rem] bg-muted/30 border border-muted ring-1 ring-white/50 shadow-sm relative z-20">
                                                        <div className="grid grid-cols-12 gap-4 items-end">
                                                            {/* CATEGORY SELECTOR */}
                                                            <div className="col-span-12 md:col-span-2 space-y-1.5">
                                                                <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Type</label>
                                                                <Tabs 
                                                                    value={newIngCategory} 
                                                                    onValueChange={(v) => setNewIngCategory(v as any)}
                                                                    className="w-full"
                                                                >
                                                                    <TabsList className="grid grid-cols-2 h-11 bg-white border border-muted rounded-xl p-1 shrink-0 overflow-hidden">
                                                                        <TabsTrigger value="ingredient" className="rounded-lg text-[9px] font-black uppercase data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                                                                            <ChefHat className="h-3 w-3 mr-1" /> Food
                                                                        </TabsTrigger>
                                                                        <TabsTrigger value="miscellaneous" className="rounded-lg text-[9px] font-black uppercase data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                                                                            <Package className="h-3 w-3 mr-1" /> Misc
                                                                        </TabsTrigger>
                                                                    </TabsList>
                                                                </Tabs>
                                                            </div>

                                                            {/* WIDENED INGREDIENT FIELD */}
                                                            <div className="col-span-12 md:col-span-4 space-y-1.5">
                                                                <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">
                                                                    {newIngCategory === 'ingredient' ? "Ingredient" : "Cost Item Name"}
                                                                </label>
                                                                {newIngCategory === 'ingredient' ? (
                                                                    <Popover open={ingredientComboOpen} onOpenChange={setIngredientComboOpen}>
                                                                        <PopoverTrigger asChild>
                                                                            <Button
                                                                                variant="outline"
                                                                                role="combobox"
                                                                                className={cn("w-full justify-between text-sm h-11 rounded-xl bg-white border-muted shadow-sm", !newIngName && "text-muted-foreground")}
                                                                                disabled={productsLoading}
                                                                            >
                                                                                <span className="truncate">{newIngName || "Search catalog..."}</span>
                                                                                <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                                                                            </Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-2xl border-none" align="start">
                                                                            <Command>
                                                                                <CommandInput placeholder="Search products..." className="h-11" />
                                                                                <CommandList className="max-h-60">
                                                                                    <CommandEmpty>
                                                                                        <div className="p-4 text-center">
                                                                                            <p className="text-xs font-bold text-muted-foreground">Not found in catalog?</p>
                                                                                            <Button 
                                                                                                variant="link" size="sm" 
                                                                                                className="text-[10px] font-black uppercase h-auto p-0"
                                                                                                onClick={() => {
                                                                                                    const query = (document.querySelector('[cmdk-input]') as HTMLInputElement)?.value;
                                                                                                    if (query) setNewIngName(query);
                                                                                                    setIngredientComboOpen(false);
                                                                                                }}
                                                                                            >
                                                                                                Use custom name
                                                                                            </Button>
                                                                                        </div>
                                                                                    </CommandEmpty>
                                                                                    <CommandGroup>
                                                                                        {products.map(p => (
                                                                                            <CommandItem
                                                                                                key={p.id}
                                                                                                value={p.name}
                                                                                                onSelect={() => handleSelectProductForPlanned(p.name)}
                                                                                                className="py-3 px-4"
                                                                                            >
                                                                                                <Check className={cn("mr-2 h-4 w-4", newIngName.toLowerCase() === p.name.toLowerCase() ? "opacity-100" : "opacity-0")} />
                                                                                                <div className="flex-1">
                                                                                                    <span className="text-sm font-bold">{p.name}</span>
                                                                                                    <span className="text-[10px] text-muted-foreground ml-2 opacity-60">
                                                                                                        TZS {Number(p.unitPrice).toLocaleString()}/{p.unit}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </CommandItem>
                                                                                        ))}
                                                                                    </CommandGroup>
                                                                                </CommandList>
                                                                            </Command>
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                ) : (
                                                                    <Input 
                                                                        placeholder="e.g. Transport or Charcoal"
                                                                        value={newIngName}
                                                                        onChange={e => setNewIngName(e.target.value)}
                                                                        className="h-11 rounded-xl bg-white border-muted shadow-sm"
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="col-span-4 md:col-span-1 space-y-1.5">
                                                                <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Qty</label>
                                                                <Input
                                                                    type="number" step="any" min={0}
                                                                    value={newIngQty || ''}
                                                                    onChange={e => setNewIngQty(parseFloat(e.target.value) || 0)}
                                                                    className="h-11 rounded-xl bg-white border-muted text-center px-1"
                                                                />
                                                            </div>
                                                            <div className="col-span-4 md:col-span-1.5 space-y-1.5">
                                                                <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Unit</label>
                                                                <Select value={newIngUnit} onValueChange={setNewIngUnit}>
                                                                    <SelectTrigger className="h-11 rounded-xl bg-white border-muted">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        {UNIT_OPTIONS.map(u => (
                                                                            <SelectItem key={u} value={u} className="rounded-lg">{u}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="col-span-4 md:col-span-2 space-y-1.5">
                                                                <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Unit Cost</label>
                                                                <Input
                                                                    type="number" step="0.01" min={0}
                                                                    value={newIngCost || ''}
                                                                    onChange={e => setNewIngCost(parseFloat(e.target.value) || 0)}
                                                                    className="h-11 rounded-xl bg-white border-muted"
                                                                />
                                                            </div>
                                                            <div className="col-span-12 md:col-span-1.5">
                                                                <Button
                                                                    onClick={handleAddPlannedIngredient}
                                                                    disabled={addingPlanned || !newIngName.trim()}
                                                                    className="w-full h-11 rounded-xl shadow-md gap-2"
                                                                >
                                                                    {addingPlanned ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Budget List */}
                                                    {plannedIngredients.length > 0 ? (
                                                        <div className="space-y-8">
                                                            {['ingredient', 'miscellaneous'].map(cat => {
                                                                const items = plannedIngredients.filter(i => (i.category || 'ingredient') === cat);
                                                                if (items.length === 0) return null;

                                                                return (
                                                                    <div key={cat} className="space-y-4">
                                                                        <div className="flex items-center gap-3 px-4">
                                                                            <div className="flex-1 h-px bg-muted" />
                                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 shrink-0">
                                                                                {cat === 'ingredient' ? "Food Ingredients" : "Miscellaneous Costs"}
                                                                            </span>
                                                                            <div className="flex-1 h-px bg-muted" />
                                                                        </div>
                                                                        
                                                                        <div className="rounded-[2rem] border border-muted bg-white shadow-sm overflow-hidden relative z-10">
                                                                            <div className="grid grid-cols-12 gap-2 px-8 py-3 bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 border-b border-muted">
                                                                                <div className="col-span-5">Item</div>
                                                                                <div className="col-span-2 text-right">Base Qty</div>
                                                                                <div className="col-span-2 text-right">Unit Cost</div>
                                                                                <div className="col-span-3 text-right">Total Budget</div>
                                                                            </div>
                                                                            <div className="divide-y divide-muted/50 max-h-[400px] overflow-y-auto custom-scrollbar">
                                                                                <AnimatePresence mode="popLayout">
                                                                                    {items.map(ing => (
                                                                                        <motion.div 
                                                                                            key={ing.id} 
                                                                                            layout
                                                                                            initial={{ opacity: 0 }}
                                                                                            animate={{ opacity: 1 }}
                                                                                            exit={{ opacity: 0 }}
                                                                                            className="grid grid-cols-12 gap-2 px-8 py-4 items-center hover:bg-muted/10 transition-colors group"
                                                                                        >
                                                                                            <div className="col-span-5">
                                                                                                <p className="text-sm font-bold tracking-tight">{ing.ingredient_name}</p>
                                                                                            </div>
                                                                                            <div className="col-span-2 text-right">
                                                                                                <span className="font-mono text-xs uppercase tracking-tighter opacity-60">
                                                                                                    {ing.planned_quantity.toLocaleString()} {ing.unit}
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="col-span-2 text-right">
                                                                                                <span className="font-mono text-xs opacity-60">
                                                                                                    {Number(ing.unit_cost).toLocaleString()}
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="col-span-3 flex items-center justify-end gap-3">
                                                                                                <span className="font-black text-sm tracking-tight text-primary">
                                                                                                    {(ing.planned_quantity * ing.unit_cost).toLocaleString()}
                                                                                                </span>
                                                                                                <Button 
                                                                                                    variant="ghost" size="icon" 
                                                                                                    onClick={() => handleRemovePlannedIngredient(ing)}
                                                                                                    className="h-8 w-8 rounded-full text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                                                                                >
                                                                                                    <Trash2 className="h-4 w-4" />
                                                                                                </Button>
                                                                                            </div>
                                                                                        </motion.div>
                                                                                    ))}
                                                                                </AnimatePresence>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}

                                                            <div className="grid grid-cols-12 gap-2 px-8 py-6 bg-primary/[0.03] rounded-[2rem] border border-primary/10 font-bold">
                                                                <div className="col-span-9 text-right text-muted-foreground uppercase text-[10px] tracking-widest mt-1.5">Total Planned Budget:</div>
                                                                <div className="col-span-3 text-right text-xl font-black text-primary font-mono">
                                                                    TZS {plannedIngredients.reduce((sum, i) => sum + Number(i.planned_quantity) * Number(i.unit_cost), 0).toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-20 bg-muted/10 rounded-[2rem] border-2 border-dashed border-muted space-y-4">
                                                            <div className="p-4 bg-white rounded-full w-fit mx-auto shadow-sm">
                                                                <ShoppingBasket className="h-10 w-10 text-muted-foreground/20" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-black text-muted-foreground uppercase tracking-tight">No ingredients in budget.</p>
                                                                <p className="text-[10px] text-muted-foreground/60 px-12 font-medium">Use Smart Sync to auto-fill or add items manually from the catalog. Use TZS prices for analysis.</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    </TabsContent>

                                    {/* ─── TAB: Analysis (Calculator) ─── */}
                                    <TabsContent value="analysis">
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <CostCalculatorPanel
                                                menu={selectedMenu}
                                                menuRecipes={menuRecipes}
                                                calculationResult={calculationResult}
                                                isCalculating={isCalculating}
                                                onCalculate={runCalculation}
                                                onClearResults={() => setCalculationResult(null)}
                                            />
                                        </motion.div>
                                    </TabsContent>
                                </Tabs>
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </div>

            {/* Menu Form Dialog */}
            <MenuFormDialog
                open={menuFormOpen}
                onOpenChange={setMenuFormOpen}
                menuTypes={menuTypes}
                menu={editingMenu}
                onSubmit={handleMenuFormSubmit}
            />
        </div>
    );
}
