"use client";
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useRecipeStorage } from '@/hooks/use-recipe-storage';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Loader2, Save, ArrowLeft, Download, RefreshCw, Plus, Trash2, Utensils, Search, CheckCircle2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import jsPDF from "jspdf";
import "jspdf-autotable";
import { getMenusByDate, bulkUpsertDailyMenus } from '@/services/dailyMenuService';
import { DailyMenu, Region, REGIONS, Recipe } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

// Specific row index ranges for special event storage
const SPECIAL_MEAL_RANGES = {
    'Brunch': { start: 100, end: 110 },
    'Evening Tea': { start: 111, end: 125 },
    'Dinner': { start: 126, end: 145 },
    'Cocktail': { start: 146, end: 165 },
} as const;

type SpecialMealType = keyof typeof SPECIAL_MEAL_RANGES;

interface SpecialEventConfig {
    orderId: string;
    eventId: string;
    clientName: string;
    pax: number;
    mealType: string; // The original meal type string (e.g. "Dinner & Cocktail")
    region: Region;
    activeTypes: SpecialMealType[]; // Which sections to show
    menus: Record<SpecialMealType, { name: string; recipeId?: string }[]>;
}

export default function SpecialMenuPage() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [regionFilter, setRegionFilter] = useState<Region | "All">("All");
    const { orders, isLoading: ordersLoading } = useOrderStorage();
    const { getClientById, isLoading: clientsLoading } = useClientStorage();
    const { recipes: availableRecipes, isLoading: recipesLoading } = useRecipeStorage();
    const { toast } = useToast();

    const [configs, setConfigs] = useState<SpecialEventConfig[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isDirty, setIsDirty] = useState(false);

    const isLoading = ordersLoading || clientsLoading || recipesLoading;

    const initializeConfigs = useCallback(async () => {
        if (isLoading) return;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const todaysOrders = orders.filter(order =>
            order.clientEvents.some(e => e.date?.startsWith(dateStr))
        );

        const savedMenus = await getMenusByDate(dateStr);
        const newConfigs: SpecialEventConfig[] = [];

        todaysOrders.forEach(order => {
            order.clientEvents.forEach((event, eventIndex) => {
                if (event.date?.startsWith(dateStr)) {
                    const mealTypeStr = event.mealType?.toLowerCase() || '';
                    
                    const activeTypes: SpecialMealType[] = [];
                    if (mealTypeStr.includes('brunch')) activeTypes.push('Brunch');
                    if (mealTypeStr.includes('evening tea') || mealTypeStr.includes('tea')) activeTypes.push('Evening Tea');
                    if (mealTypeStr.includes('dinner')) activeTypes.push('Dinner');
                    if (mealTypeStr.includes('cocktail')) activeTypes.push('Cocktail');

                    if (activeTypes.length === 0) return; // Not a special event
                    if (regionFilter !== "All" && event.region !== regionFilter) return;

                    const eventId = event.id || `EVT-${order.id}-${eventIndex}`;
                    const client = getClientById(order.clientId);
                    const savedMenu = savedMenus.find(m => m.event_id === eventId);

                    const menus: Record<SpecialMealType, { name: string; recipeId?: string }[]> = {
                        'Brunch': [],
                        'Evening Tea': [],
                        'Dinner': [],
                        'Cocktail': [],
                    };

                    if (savedMenu) {
                        savedMenu.recipes.forEach(r => {
                            // Find which section this rowIndex belongs to
                            for (const [type, range] of Object.entries(SPECIAL_MEAL_RANGES)) {
                                if (r.rowIndex >= range.start && r.rowIndex <= range.end) {
                                    menus[type as SpecialMealType].push({ name: r.name, recipeId: r.recipeId });
                                    break;
                                }
                            }
                        });
                    } else {
                        // Optional: Auto-populate from order.recipes if they match?
                        // For now we start fresh since it's a "Setup"
                    }

                    newConfigs.push({
                        orderId: order.id,
                        eventId: eventId,
                        clientName: client?.companyName || 'Unknown Client',
                        pax: event.numberOfPeople || 0,
                        mealType: event.mealType || 'Special',
                        region: (event.region || "Dar es Salaam") as Region,
                        activeTypes,
                        menus
                    });
                }
            });
        });

        setConfigs(newConfigs);
        setIsInitialLoad(false);
        setIsDirty(false);
    }, [selectedDate, regionFilter, orders, getClientById, isLoading, availableRecipes]);

    useEffect(() => {
        if (isInitialLoad || !isDirty) {
            initializeConfigs();
        }
    }, [selectedDate, regionFilter, initializeConfigs, isDirty, isInitialLoad]);

    const handleAddItem = (configIndex: number, type: SpecialMealType) => {
        const newConfigs = [...configs];
        newConfigs[configIndex].menus[type].push({ name: '' });
        setConfigs(newConfigs);
        setIsDirty(true);
    };

    const handleRemoveItem = (configIndex: number, type: SpecialMealType, itemIndex: number) => {
        const newConfigs = [...configs];
        newConfigs[configIndex].menus[type].splice(itemIndex, 1);
        setConfigs(newConfigs);
        setIsDirty(true);
    };

    const handleUpdateItem = (configIndex: number, type: SpecialMealType, itemIndex: number, value: { name: string; recipeId?: string }) => {
        const newConfigs = [...configs];
        newConfigs[configIndex].menus[type][itemIndex] = value;
        setConfigs(newConfigs);
        setIsDirty(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const menusToSave: Omit<DailyMenu, 'id' | 'created_at' | 'updated_at'>[] = configs.map(config => {
                const recipes: { rowIndex: number; name: string; recipeId?: string }[] = [];
                
                config.activeTypes.forEach(type => {
                    const range = SPECIAL_MEAL_RANGES[type];
                    config.menus[type].forEach((item, idx) => {
                        if (item.name.trim()) {
                            recipes.push({
                                rowIndex: range.start + idx,
                                name: item.name,
                                recipeId: item.recipeId
                            });
                        }
                    });
                });

                return {
                    event_id: config.eventId,
                    menu_date: format(selectedDate, 'yyyy-MM-dd'),
                    recipes,
                    region: config.region
                };
            });

            const success = await bulkUpsertDailyMenus(menusToSave);
            if (success) {
                toast({ title: 'Success', description: 'Special menus saved successfully.' });
                setIsDirty(false);
            } else {
                throw new Error("Save failed");
            }
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save special menus.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = () => {
        setIsExporting(true);
        try {
            const doc = new jsPDF();
            const EVENTS_PER_PAGE = 5;
            let currentY = 0;

            configs.forEach((config, idx) => {
                const isNewPage = idx % EVENTS_PER_PAGE === 0;
                
                if (isNewPage) {
                    if (idx > 0) doc.addPage();
                    
                    // Page Header
                    doc.setFontSize(18);
                    doc.setTextColor(245, 158, 11); // Amber-500
                    doc.text("Daily Special Menus", 105, 15, { align: 'center' });
                    
                    doc.setFontSize(10);
                    doc.setTextColor(100, 100, 100);
                    doc.text(`${format(selectedDate, "PPPP")} | Page ${Math.floor(idx / EVENTS_PER_PAGE) + 1}`, 105, 22, { align: 'center' });

                    doc.setDrawColor(245, 158, 11);
                    doc.setLineWidth(0.5);
                    doc.line(20, 25, 190, 25);
                    currentY = 35;
                } else {
                    // Separator line between clients on the same page
                    doc.setDrawColor(240, 240, 240);
                    doc.setLineWidth(0.2);
                    doc.line(20, currentY - 5, 190, currentY - 5);
                }

                // Client Info Block
                doc.setFontSize(12);
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text(`${config.clientName} (${config.region})`, 20, currentY);
                
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.text(`Pax: ${config.pax} | Type: ${config.mealType} | ID: ${config.eventId}`, 20, currentY + 5);
                
                currentY += 12;

                config.activeTypes.forEach(type => {
                    const items = config.menus[type];
                    if (items.length === 0) return;

                    doc.setFontSize(9);
                    doc.setTextColor(245, 158, 11);
                    doc.setFont("helvetica", "bold");
                    doc.text(`${type.toUpperCase()} ITEMS`, 25, currentY);
                    currentY += 4;

                    const body = items.map((item, i) => [`${i + 1}.`, item.name]);
                    (doc as any).autoTable({
                        startY: currentY,
                        body: body,
                        theme: 'plain',
                        styles: { fontSize: 9, cellPadding: 1 },
                        columnStyles: { 0: { cellWidth: 10 } },
                        margin: { left: 30, right: 30 },
                        didDrawPage: (data: any) => {
                            // If autoTable caused a page jump, we need to handle that, 
                            // but with 5 events per page and small tables, it's unlikely.
                        }
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 6;
                });

                currentY += 5; // Extra spacing after client block
            });

            doc.save(`Special_Event_Menus_${format(selectedDate, "yyyy-MM-dd")}.pdf`);
            toast({ title: 'Exported!', description: 'Menu PDF has been generated with grouped events.' });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Export Failed' });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50/50">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b p-4 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                            <Link href="/reports/daily-menu"><ArrowLeft className="h-5 w-5" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                                Special Event Menus
                                {isDirty && <Badge variant="destructive" className="animate-pulse">Dirty</Badge>}
                                {!isDirty && !isInitialLoad && configs.length > 0 && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                            </h1>
                            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                Configuration for Brunch, Tea, Dinner & Cocktails
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                         <Select value={regionFilter} onValueChange={(v: string) => setRegionFilter(v as Region | "All")}>
                            <SelectTrigger className="w-[140px] h-10">
                                <SelectValue placeholder="Region" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Regions</SelectItem>
                                {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-10 px-4 font-semibold">
                                    <CalendarIcon className="mr-2 h-4 w-4 text-amber-500" />
                                    {format(selectedDate, "MMM d, yyyy")}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
                            </PopoverContent>
                        </Popover>

                        <div className="h-8 w-px bg-slate-200 mx-1" />

                        <Button onClick={handleSave} disabled={isSaving || !isDirty} variant="default" className="bg-amber-600 hover:bg-amber-700 h-10 px-6 font-bold shadow-lg shadow-amber-600/20">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            SAVE SETUP
                        </Button>

                        <Button onClick={handleExport} variant="outline" className="h-10 border-slate-200 hover:bg-slate-50 font-bold" disabled={isExporting || configs.length === 0}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            EXPORT PDF
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="max-w-7xl mx-auto p-6">
                    {configs.length === 0 ? (
                        <Card className="border-dashed border-2 bg-transparent py-20 text-center">
                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-amber-50 rounded-full mb-4">
                                    <Utensils className="h-10 w-10 text-amber-500 opacity-20" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">No Special Events Found</h3>
                                <p className="text-slate-500 max-w-sm mt-1">
                                    There are no orders with Brunch, Evening Tea, Dinner, or Cocktail scheduled for this day.
                                </p>
                            </div>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {configs.map((config, configIndex) => (
                                <Card key={config.eventId} className="overflow-hidden border-slate-200 shadow-xl hover:shadow-2xl transition-shadow bg-white rounded-3xl">
                                    <CardHeader className="bg-slate-900 text-white p-6">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <CardTitle className="text-xl font-black">{config.clientName}</CardTitle>
                                                    <Badge variant="outline" className="text-amber-400 border-amber-400/50 text-[10px] font-black">{config.region}</Badge>
                                                </div>
                                                <CardDescription className="text-slate-400 text-xs font-mono tracking-widest uppercase">
                                                    EVENT ID: {config.eventId} | {config.pax} PAX
                                                </CardDescription>
                                            </div>
                                            <Utensils className="h-8 w-8 text-amber-500" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="p-6 space-y-8">
                                            {config.activeTypes.map(type => (
                                                <div key={type} className="space-y-4">
                                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                        <h4 className="text-sm font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                            {type} Configuration
                                                        </h4>
                                                        <Button variant="ghost" size="sm" onClick={() => handleAddItem(configIndex, type)} className="h-7 text-[10px] font-bold text-slate-500 hover:text-amber-600">
                                                            <Plus className="w-3.5 h-3.5 mr-1" /> ADD ITEM
                                                        </Button>
                                                    </div>

                                                    <div className="space-y-2.5">
                                                        {config.menus[type].map((item, itemIdx) => (
                                                            <div key={itemIdx} className="flex gap-2 group">
                                                                <div className="flex-1">
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <div className="relative">
                                                                                <Input 
                                                                                    value={item.name} 
                                                                                    readOnly
                                                                                    placeholder="Select a recipe..." 
                                                                                    className="h-11 bg-slate-50 border-slate-100 focus:bg-white focus:border-amber-500/50 font-medium text-sm cursor-pointer pr-10"
                                                                                />
                                                                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                                                                            </div>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-[400px] p-0 shadow-2xl border-amber-500/20" align="start">
                                                                            <Command>
                                                                                <CommandInput placeholder="Search recipes..." />
                                                                                <CommandList className="max-h-[300px]">
                                                                                    <CommandEmpty>No recipes found.</CommandEmpty>
                                                                                    <CommandGroup heading="Available Food Management">
                                                                                        {availableRecipes.map(recipe => (
                                                                                            <CommandItem 
                                                                                                key={recipe.recipeNumber}
                                                                                                onSelect={() => handleUpdateItem(configIndex, type, itemIdx, { name: recipe.recipeName, recipeId: recipe.recipeNumber })}
                                                                                                className="text-xs py-3 px-4 border-b last:border-0 border-slate-50 cursor-pointer"
                                                                                            >
                                                                                                <div className="flex flex-col">
                                                                                                    <span className="font-bold text-slate-700">{recipe.recipeName}</span>
                                                                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">#{recipe.recipeNumber} • {recipe.recipeType}</span>
                                                                                                </div>
                                                                                            </CommandItem>
                                                                                        ))}
                                                                                    </CommandGroup>
                                                                                </CommandList>
                                                                            </Command>
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                </div>
                                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(configIndex, type, itemIdx)} className="h-11 w-11 shrink-0 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        {config.menus[type].length === 0 && (
                                                            <p className="text-[11px] text-slate-400 italic text-center py-4 bg-slate-50/50 rounded-xl border border-dashed">
                                                                No menu items added. Click ADD ITEM to begin.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
