"use client";
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useRecipeStorage } from '@/hooks/use-recipe-storage';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Loader2, Save, ArrowLeft, Download, Clipboard, ClipboardCheck, Filter, X, Utensils, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import jsPDF from "jspdf";
import "jspdf-autotable";
import { getMenusByDate, bulkUpsertDailyMenus } from '@/services/dailyMenuService';
import { DailyMenu, REGIONS, Region } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type MenuCell = { content: string; mealType: string };
type EventMenu = {
  eventId: string;
  orderId: string;
  eventIndex: number;
  clientName: string;
  pax: number;
  mealType: string;
  region: Region;
  menu: MenuCell[];
};

const MEAL_SECTIONS = {
  BREAKFAST: { start: 1, end: 11, title: 'Breakfast' }, // 1 Header + 10 Rows = 11
  LUNCH: { start: 12, end: 27, title: 'Lunch' },      // 1 Header + 15 Rows = 16 (Total 27)
};

export default function DailyMenuPlannerPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [regionFilter, setRegionFilter] = useState<Region | "All">("All");
  const { orders, isLoading: ordersLoading } = useOrderStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { recipes: availableRecipes, isLoading: recipesLoading } = useRecipeStorage();

  const [menuData, setMenuData] = useState<EventMenu[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();

  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [clipboard, setClipboard] = useState<MenuCell[] | null>(null);

  const isLoading = ordersLoading || clientsLoading || recipesLoading;

  // Track if we have already initialized for the current date/region
  const lastInitializedKey = useRef<string>("");

  const initializeMenuData = useCallback(async (force = false) => {
    if (isLoading) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const key = `${dateStr}-${regionFilter}`;

    // Prevent auto-resetting if already initialized, unless forced
    if (!force && lastInitializedKey.current === key) return;

    const todaysOrders = orders.filter(order =>
      order.clientEvents.some(e => e.date?.startsWith(dateStr))
    );

    const savedMenus = await getMenusByDate(dateStr);
    const eventMenus: EventMenu[] = [];

    todaysOrders.forEach(order => {
      order.clientEvents.forEach((event, eventIndex) => {
        if (event.date?.startsWith(dateStr)) {
          // Filter for ONLY Breakfast and Lunch (No Brunch, Dinner, Tea, or Cocktail)
          const orderMealType = event.mealType?.toLowerCase() || '';
          const isSpecial = orderMealType.includes('brunch') || 
                           orderMealType.includes('dinner') || 
                           orderMealType.includes('tea') || 
                           orderMealType.includes('cocktail');
          
          const isMain = orderMealType.includes('breakfast') || orderMealType.includes('lunch');
          
          if (isSpecial || !isMain) return;

          // Apply region filter
          if (regionFilter !== "All" && event.region !== regionFilter) return;

          const region = (event.region || "Dar es Salaam") as Region;
          const eventId = event.id || `EVT-${order.id}-${eventIndex}`; // Fallback for old data
          const client = getClientById(order.clientId);
          const savedMenu = savedMenus.find(m => m.event_id === eventId);

          const menu: MenuCell[] = Array(27).fill(null).map(() => ({ content: '', mealType: '' }));

          menu[MEAL_SECTIONS.BREAKFAST.start - 1] = { content: 'Breakfast', mealType: 'header' };
          menu[MEAL_SECTIONS.LUNCH.start - 1] = { content: 'Lunch', mealType: 'header' };

          if (savedMenu) {
            savedMenu.recipes.forEach(r => {
              if (menu[r.rowIndex]) {
                menu[r.rowIndex].content = r.name;
              }
            });
          }

          const newEventMenu: EventMenu = {
            eventId: eventId,
            orderId: order.id,
            eventIndex,
            clientName: client?.companyName || 'Unknown Client',
            pax: event.numberOfPeople || 0,
            mealType: event.mealType || 'N/A',
            region: region,
            menu: menu,
          };

          // Auto-fill recipes from the event if no saved menu exists
          if (!savedMenu) {
            const recipesToUse = event.recipes?.map(r => r.recipeId) || [];

            const getRecipesForMealType = (mealType: 'Breakfast' | 'Lunch') => {
              return recipesToUse
                .map(recipeId => {
                  const recipe = availableRecipes.find(dbRecipe => dbRecipe.recipeNumber === recipeId);
                  const isMatch = (mealType === 'Breakfast' && recipe?.recipeType === 'Breakfast') ||
                                 (mealType === 'Lunch' && recipe?.recipeType === 'Lunch');
                  return isMatch ? recipe?.recipeName : null;
                })
                .filter((name): name is string => name !== null);
            };

            const addRecipesToMenu = (section: keyof typeof MEAL_SECTIONS, recipes: string[]) => {
              recipes.forEach((recipeName, i) => {
                const rowIndex = MEAL_SECTIONS[section].start + i;
                if (rowIndex < MEAL_SECTIONS[section].end) {
                  // Only add if the cell is currently empty
                  if (!newEventMenu.menu[rowIndex].content) {
                    newEventMenu.menu[rowIndex] = { content: recipeName, mealType: MEAL_SECTIONS[section].title };
                  }
                }
              })
            }

            if (orderMealType.includes('breakfast')) {
              addRecipesToMenu('BREAKFAST', getRecipesForMealType('Breakfast'));
            }
            if (orderMealType.includes('lunch')) {
              addRecipesToMenu('LUNCH', getRecipesForMealType('Lunch'));
            }
          }

          eventMenus.push(newEventMenu);
        }
      });
    });

    setMenuData(eventMenus);
    setIsDirty(false);
    setIsInitialLoad(false);
    lastInitializedKey.current = key;
  }, [selectedDate, regionFilter, orders, getClientById, isLoading, availableRecipes]);

  useEffect(() => {
    // Only auto-initialize on first load or date change if NOT dirty
    if (!isDirty || isInitialLoad) {
      initializeMenuData();
    }
  }, [selectedDate, regionFilter, initializeMenuData, isDirty, isInitialLoad]);

  const handleMenuChange = (orderIndex: number, rowIndex: number, value: string) => {
    const newMenuData = [...menuData];
    // Find the actual order in the unfiltered list
    // (Note: we use filteredMenuData in the UI, but menuData is our point of truth)
    newMenuData[orderIndex].menu[rowIndex].content = value;
    setMenuData(newMenuData);
    setIsDirty(true);
  };

  const handleSaveMenus = async () => {
    setIsSaving(true);
    try {
      const menusToSave: Omit<DailyMenu, 'id' | 'created_at' | 'updated_at'>[] = menuData.map(orderMenu => {
        const recipesToSave = orderMenu.menu.flatMap((cell, index) => {
          if (!cell.content || cell.content.trim() === '' || cell.mealType === 'header') return [];
          const recipeId = availableRecipes.find(r => r.recipeName === cell.content)?.recipeNumber;
          return [{
            rowIndex: index,
            name: cell.content,
            recipeId: recipeId
          }];
        });

        return {
          order_id: orderMenu.orderId,
          event_id: orderMenu.eventId,
          menu_date: format(selectedDate, 'yyyy-MM-dd'),
          recipes: recipesToSave,
          region: orderMenu.region
        };
      });

      const success = await bulkUpsertDailyMenus(menusToSave);
      if (success) {
        toast({ title: 'Success', description: 'All menus for the selected date have been saved.' });
        setIsDirty(false);
      } else {
        throw new Error("Bulk save failed");
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save menus.' });
    } finally {
      setIsSaving(false);
    }
  }

  const handlePdfExport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const COLUMNS_PER_PAGE = 5;
      const breakfastEvents = menuData.filter(e => e.mealType.toLowerCase().includes('breakfast'));
      const lunchEvents = menuData.filter(e => e.mealType.toLowerCase().includes('lunch'));

      let isFirstPage = true;

      // --- GENERATE BREAKFAST PAGES ---
      for (let i = 0; i < breakfastEvents.length; i += COLUMNS_PER_PAGE) {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;
        
        const pageMenuData = breakfastEvents.slice(i, i + COLUMNS_PER_PAGE);
        const head = [pageMenuData.map(order => `${order.clientName.toUpperCase()}\n# ${order.pax} PAX`)];
        const breakfastBody = Array.from({ length: 11 }).map((_, rowIndex) =>
          pageMenuData.map(order => order.menu[rowIndex]?.content || '')
        );

        (doc as any).autoTable({
          head: head,
          body: breakfastBody,
          startY: 10,
          theme: 'grid',
          headStyles: { fillColor: [244, 244, 245], textColor: [0, 0, 0], fontSize: 11, fontStyle: 'bold', halign: 'center', minCellHeight: 15 },
          styles: { 
            cellPadding: 4, 
            fontSize: 16, 
            fontStyle: 'bold', 
            halign: 'center', 
            valign: 'middle', 
            textColor: [0, 0, 0], 
            lineWidth: 0.2,
            minCellHeight: 16 // Ensures all rows stay on one page
          },
          didParseCell: function (data: any) {
            if (data.row.section === 'head') return;
            if (data.row.index === 0) { // Header row "Breakfast"
               data.cell.styles.fillColor = [254, 249, 195];
               data.cell.styles.textColor = [161, 98, 7];
               data.cell.styles.fontSize = 12;
            }
          }
        });
      }

      // --- GENERATE LUNCH PAGES ---
      for (let i = 0; i < lunchEvents.length; i += COLUMNS_PER_PAGE) {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        const pageMenuData = lunchEvents.slice(i, i + COLUMNS_PER_PAGE);
        const head = [pageMenuData.map(order => `${order.clientName.toUpperCase()}\n# ${order.pax} PAX`)];
        const lunchBody = Array.from({ length: 16 }).map((_, rowIndex) =>
          pageMenuData.map(order => order.menu[rowIndex + 11]?.content || '')
        );

        (doc as any).autoTable({
          head: head,
          body: lunchBody,
          startY: 10,
          theme: 'grid',
          headStyles: { fillColor: [244, 244, 245], textColor: [0, 0, 0], fontSize: 11, fontStyle: 'bold', halign: 'center', minCellHeight: 15 },
          styles: { 
            cellPadding: 4, 
            fontSize: 16, 
            fontStyle: 'bold', 
            halign: 'center', 
            valign: 'middle', 
            textColor: [0, 0, 0], 
            lineWidth: 0.2,
            minCellHeight: 12 // Adjusted for 16 rows to fit A4
          },
          didParseCell: function (data: any) {
            if (data.row.section === 'head') return;
            if (data.row.index === 0) { // Header row "Lunch"
               data.cell.styles.fillColor = [254, 249, 195];
               data.cell.styles.textColor = [161, 98, 7];
               data.cell.styles.fontSize = 12;
            }
          }
        });
      }

      doc.save(`Daily_Menu_Report_${regionFilter}_${selectedDate ? format(selectedDate, "yyyy-MM-dd") : 'all_dates'}.pdf`);
      toast({ title: "Export Successful", description: "Report exported to PDF." });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleColumnSelect = (index: number) => {
    setSelectedColumn(index);
    setClipboard(null);
  };

  const handleCopy = () => {
    if (selectedColumn !== null) {
      const menuToCopy = menuData[selectedColumn].menu.map(cell => ({ ...cell }));
      setClipboard(menuToCopy);
      toast({ title: 'Copied!', description: `Menu for ${menuData[selectedColumn].clientName} has been copied.` });
    }
  };

  const handlePaste = (targetIndex: number) => {
    if (clipboard) {
      const newMenuData = [...menuData];
      const targetOrder = newMenuData[targetIndex];
      const targetMealType = targetOrder.mealType.toLowerCase();

      const pastedMenu = targetOrder.menu.map((cell, index) => {
        const row = index + 1;
        const copiedCell = clipboard[index];

        if (!copiedCell.content || copiedCell.content.trim() === '' || copiedCell.mealType === 'header') {
          return cell;
        }

        const isBreakfastSection = row >= MEAL_SECTIONS.BREAKFAST.start && row < MEAL_SECTIONS.LUNCH.start;
        const isLunchSection = row >= MEAL_SECTIONS.LUNCH.start;

        if (isBreakfastSection && targetMealType.includes('breakfast')) {
          return { ...copiedCell };
        }
        if (isLunchSection && targetMealType.includes('lunch')) {
          return { ...copiedCell };
        }
        return cell;
      });

      newMenuData[targetIndex].menu = pastedMenu;
      setMenuData(newMenuData);
      setIsDirty(true);
      toast({ title: 'Pasted!', description: `Relevant menu items pasted to ${targetOrder.clientName}.` });
      setSelectedColumn(null);
      setClipboard(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Sticky Header Action Bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <Link href="/reports"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Daily Menu Planner
                {isDirty && <Badge variant="destructive" className="animate-pulse">Unsaved Changes</Badge>}
                {!isDirty && !isInitialLoad && menuData.length > 0 && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <CalendarIcon className="h-3 w-3" />
                {selectedDate ? format(selectedDate, "PP") : "No date"}
                <span className="mx-1">•</span>
                <Filter className="h-3 w-3" />
                {regionFilter}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={regionFilter} onValueChange={(v: string) => setRegionFilter(v as Region | "All")}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Regions</SelectItem>
                {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
              </PopoverContent>
            </Popover>

            <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => initializeMenuData(true)}
              disabled={isLoading}
              title="Refresh from database"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Sync
            </Button>

            <Button asChild variant="ghost" size="sm" className="h-9 relative">
              <Link href="/reports/special-menu">
                <Utensils className="mr-2 h-4 w-4 text-amber-500" />
                Special Menus
                <Badge className="absolute -top-2 -right-2 px-1 py-0 h-4 min-w-4 text-[10px] bg-amber-500">New</Badge>
              </Link>
            </Button>

            <Button onClick={handlePdfExport} variant="outline" size="sm" className="h-9" disabled={isExporting || isLoading || menuData.length === 0}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export
            </Button>

            <Button onClick={handleSaveMenus} size="sm" className="h-9 bg-primary hover:bg-primary/90" disabled={isSaving || isLoading || menuData.length === 0 || !isDirty}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 bg-muted/20">
        {isDirty && (
          <Alert className="mb-6 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-800 dark:text-amber-300">Unsaved Changes</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              You have modified the menu. Please save your changes before leaving or refreshing to prevent data loss.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex flex-col justify-center items-center h-64 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
            <p className="text-sm text-muted-foreground animate-pulse">Loading menu data...</p>
          </div>
        ) : menuData.length > 0 ? (
          <div className="min-w-full inline-block align-middle">
            <div className="border rounded-xl shadow-sm bg-background overflow-hidden">
              <table className="w-full border-collapse text-sm text-left">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    {menuData.map((order, orderIndex) => (
                      <th
                        key={`${order.orderId}-${order.eventIndex}`}
                        className={cn(
                          "border-r p-3 font-medium align-top min-w-[220px] transition-all cursor-pointer",
                          selectedColumn === orderIndex ? "bg-primary/10 ring-2 ring-primary inset-0 z-10" : "hover:bg-muted/30"
                        )}
                        onClick={() => handleColumnSelect(orderIndex)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-sm leading-tight text-foreground/90">{order.clientName}</p>
                            <Badge variant="secondary" className="text-[9px] px-1.5 font-bold uppercase shrink-0">
                              {order.region.substring(0, 3)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1 font-mono uppercase bg-muted px-1 rounded">#{order.orderId.split('-')[1]}</span>
                            <span>{order.pax} pax</span>
                            <span className="font-medium text-amber-700 dark:text-amber-400 uppercase tracking-tighter">{order.mealType}</span>
                          </div>
                        </div>

                        <div className={cn(
                          "mt-3 overflow-hidden transition-all duration-300",
                          selectedColumn === orderIndex ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
                        )}>
                          <div className="flex gap-2 p-1 bg-background/50 rounded-lg border border-primary/20 shadow-inner">
                            <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 border-primary/20" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
                              {clipboard ? <ClipboardCheck className="mr-1 h-3 w-3 text-green-500" /> : <Clipboard className="mr-1 h-3 w-3" />}
                              Copy
                            </Button>
                            {clipboard && (
                              <Button size="sm" variant="default" className="h-7 text-[10px] flex-1" onClick={(e) => { e.stopPropagation(); handlePaste(orderIndex); }}>
                                <ClipboardCheck className="mr-1 h-3 w-3" /> Paste
                              </Button>
                            )}
                          </div>
                        </div>

                        {selectedColumn !== null && selectedColumn !== orderIndex && clipboard && (
                          <div className="mt-3">
                            <Button size="sm" variant="secondary" className="w-full h-8 text-[11px] border-dashed border-primary/40 hover:border-primary" onClick={(e) => { e.stopPropagation(); handlePaste(orderIndex); }}>
                              <ClipboardCheck className="mr-1 h-3.5 w-3.5 text-primary" /> Paste To {order.clientName.split(' ')[0]}
                            </Button>
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 27 }).map((_, rowIndex) => {
                    const isHeaderRow = (
                      rowIndex + 1 === MEAL_SECTIONS.BREAKFAST.start ||
                      rowIndex + 1 === MEAL_SECTIONS.LUNCH.start
                    );

                    return (
                      <tr key={rowIndex} className={cn(isHeaderRow ? "bg-muted/30 h-10" : "h-14 hover:bg-muted/10 transition-colors")}>
                        {menuData.map((order, orderIndex) => {
                          const mealType = order.mealType.toLowerCase();
                          const row = rowIndex + 1;

                          const isBreakfastSection = row >= MEAL_SECTIONS.BREAKFAST.start && row < MEAL_SECTIONS.LUNCH.start;
                          const isLunchSection = row >= MEAL_SECTIONS.LUNCH.start;

                          const isDisabled = !isHeaderRow && (
                            (isBreakfastSection && !mealType.includes('breakfast')) ||
                            (isLunchSection && !mealType.includes('lunch'))
                          );

                          return (
                            <td key={orderIndex} className={cn(
                              "border-r border-b p-0 align-top transition-colors",
                              isHeaderRow && 'bg-primary/5',
                              isDisabled && 'bg-muted/20 opacity-40 grayscale-[50%]'
                            )}>
                              <Popover>
                                <PopoverTrigger asChild disabled={isDisabled}>
                                  <div className="w-full h-full min-h-[56px] flex flex-col group relative">
                                    <input
                                      type="text"
                                      value={order.menu[rowIndex]?.content || ''}
                                      onChange={(e) => handleMenuChange(orderIndex, rowIndex, e.target.value)}
                                      className={cn(
                                        "w-full h-full p-2.5 bg-transparent border-none focus:ring-1 focus:ring-primary/40 outline-none transition-all text-center",
                                        isHeaderRow ? 'font-black text-xs uppercase tracking-widest text-primary/70' : 'text-sm font-bold',
                                        isDisabled && 'cursor-not-allowed pointer-events-none'
                                      )}
                                      placeholder={isHeaderRow ? '' : isDisabled ? '' : '...'}
                                      disabled={isDisabled || isHeaderRow}
                                    />
                                    {!isDisabled && !isHeaderRow && (
                                      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Utensils className="h-3 w-3 text-muted-foreground/40" />
                                      </div>
                                    )}
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl border-primary/20" side="bottom" align="start">
                                  <Command className="rounded-lg border-none shadow-none">
                                    <div className="p-2 border-b bg-muted/20 flex items-center gap-2">
                                      <Utensils className="h-3.5 w-3.5 text-primary" />
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recipe Selector</span>
                                    </div>
                                    <CommandInput placeholder="Type to search..." className="h-9 border-none focus:ring-0 shadow-none" />
                                    <CommandList className="max-h-[300px]">
                                      <CommandEmpty className="py-6 text-xs text-muted-foreground text-center">No recipes found.</CommandEmpty>
                                      <CommandGroup heading="Available Recipes">
                                        {availableRecipes.map((recipe) => (
                                          <CommandItem
                                            key={recipe.recipeNumber}
                                            value={recipe.recipeName}
                                            className="text-xs py-2 px-3 aria-selected:bg-primary/10 aria-selected:text-primary cursor-pointer"
                                            onSelect={() => {
                                              handleMenuChange(orderIndex, rowIndex, recipe.recipeName);
                                            }}
                                          >
                                            <div className="flex flex-col">
                                              <span className="font-semibold">{recipe.recipeName}</span>
                                              <span className="text-[9px] opacity-60">#{recipe.recipeNumber} • {recipe.recipeType}</span>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed rounded-3xl bg-background/50 p-12 text-center">
            <div className="p-6 bg-primary/5 rounded-full mb-6 relative">
              <Utensils className="h-12 w-12 text-primary opacity-40 rotate-12" />
              <div className="absolute -top-1 -right-1">
                <AlertCircle className="h-6 w-6 text-amber-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">No Scheduled Events</h2>
            <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
              We couldn&apos;t find any catering orders for {format(selectedDate, "PPP")} {regionFilter !== "All" && `in ${regionFilter}`}.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRegionFilter("All")} className="rounded-xl">
                <Filter className="mr-2 h-4 w-4" /> All Regions
              </Button>
              <Button variant="secondary" onClick={() => setSelectedDate(new Date())} className="rounded-xl">
                <CalendarIcon className="mr-2 h-4 w-4" /> Return to Today
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Persistence Safety Barrier */}
      {isDirty && (
        <div className="p-3 bg-primary text-primary-foreground text-center text-xs font-bold animate-in slide-in-from-bottom fixed bottom-0 w-full z-50">
          ⚠️ YOU HAVE UNSAVED CHANGES • CLICK SAVE IN THE TOP RIGHT TO PERSIST DATA
        </div>
      )}
    </div>
  );
}
