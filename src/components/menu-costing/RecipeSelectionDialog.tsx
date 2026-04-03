
"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Recipe } from "@/types";
import { getRecipes } from "@/services/recipeService";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Search, Utensils, ChefHat, Plus, 
    Check, X, Loader2, Filter, Sparkles 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RecipeSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (recipeNumber: string) => Promise<void>;
    existingRecipeIds: string[];
}

export function RecipeSelectionDialog({ 
    open, onOpenChange, onSelect, existingRecipeIds 
}: RecipeSelectionDialogProps) {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("All");

    useEffect(() => {
        if (open) {
            loadRecipes();
        }
    }, [open]);

    const loadRecipes = async () => {
        setLoading(true);
        try {
            const data = await getRecipes();
            setRecipes(data);
        } catch (error) {
            console.error("Error loading recipes:", error);
        } finally {
            setLoading(false);
        }
    };

    const categories = ["All", ...Array.from(new Set(recipes.map(r => r.recipeType).filter(Boolean)))];

    const filteredRecipes = recipes.filter(r => {
        const matchesSearch = r.recipeName.toLowerCase().includes(search.toLowerCase()) ||
                            r.recipeNumber.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === "All" || r.recipeType === selectedCategory;
        const isNotAdded = !existingRecipeIds.includes(r.recipeNumber);
        return matchesSearch && matchesCategory && isNotAdded;
    });

    const handleSelect = async (recipeNumber: string) => {
        await onSelect(recipeNumber);
        // We keep it open if the user wants to add multiple, 
        // or close it if that's the preferred UX. 
        // Dashboard usually handles multiple.
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] rounded-[2.5rem] bg-white">
                <div className="bg-primary p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <ChefHat className="h-24 w-24" />
                    </div>
                    <DialogHeader className="relative z-10">
                        <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                            <Sparkles className="h-6 w-6" />
                            Select Dishes
                        </DialogTitle>
                        <DialogDescription className="text-primary-foreground/70 font-medium">
                            Choose from your global recipe database to add to this menu package.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-8 space-y-6">
                    {/* Search and Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Search by name or RN number..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 h-12 rounded-xl border-muted bg-muted/20 focus:bg-white transition-all font-bold"
                            />
                        </div>
                        <div className="flex gap-2 p-1 bg-muted/30 rounded-xl overflow-x-auto min-w-fit">
                            {categories.map(cat => (
                                <button
                                    key={cat as string}
                                    onClick={() => setSelectedCategory(cat as string)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                        selectedCategory === cat 
                                            ? "bg-white text-primary shadow-sm" 
                                            : "text-muted-foreground hover:bg-white/50"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Recipe List */}
                    <ScrollArea className="h-[400px] pr-4 -mr-4">
                        {loading ? (
                            <div className="h-full flex items-center justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                            </div>
                        ) : filteredRecipes.length === 0 ? (
                            <div className="text-center py-20 bg-muted/10 rounded-[2rem] border-2 border-dashed border-muted space-y-4">
                                <Utensils className="h-12 w-12 mx-auto text-muted-foreground/20" />
                                <div className="space-y-1">
                                    <p className="text-sm font-black text-muted-foreground uppercase tracking-tight">No available dishes found</p>
                                    <p className="text-[10px] text-muted-foreground/60 px-12 font-medium">Try adjusting your search or category filter. Dishes already in your menu are hidden.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                                <AnimatePresence mode="popLayout">
                                    {filteredRecipes.map((recipe) => (
                                        <motion.div
                                            key={recipe.recipeNumber}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="group relative p-5 rounded-[2rem] bg-white border border-muted hover:border-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer"
                                            onClick={() => handleSelect(recipe.recipeNumber)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-muted group-hover:bg-primary/10 rounded-2xl transition-colors">
                                                    <ChefHat className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-sm tracking-tight truncate">{recipe.recipeName}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <Badge variant="outline" className="h-4 px-1.5 text-[8px] uppercase tracking-tighter opacity-60 rounded-[4px] border-muted">
                                                            {recipe.recipeNumber}
                                                        </Badge>
                                                        {recipe.recipeType && (
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                                                                {recipe.recipeType}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Plus className="h-4 w-4 text-primary" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <div className="p-8 border-t border-muted/50 flex justify-end">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl h-12 px-8 font-black text-xs uppercase tracking-widest text-muted-foreground"
                    >
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
