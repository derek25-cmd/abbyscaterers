"use client";
import React, { useMemo, useState, useEffect } from 'react';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useRecipeStorage } from '@/hooks/use-recipe-storage';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Loader2, Save, ArrowLeft, Download, Clipboard, ClipboardCheck, Filter, X, Utensils } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import jsPDF from "jspdf";
import "jspdf-autotable";
import { getMenusByDate, upsertDailyMenu } from '@/services/dailyMenuService';
import { DailyMenu, REGIONS, Region } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type MenuCell = { content: string; mealType: string };
type EventMenu = {
  orderId: string;
  eventIndex: number;
  clientName: string;
  pax: number;
  mealType: string;
  region: Region;
  menu: MenuCell[];
};

const MEAL_SECTIONS = {
  BREAKFAST: { start: 1, end: 12, title: 'Breakfast' },
  LUNCH: { start: 13, end: 28, title: 'Lunch/Dinner' },
  TEA: { start: 29, end: 31, title: 'Evening Tea' },
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
  const { toast } = useToast();

  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [clipboard, setClipboard] = useState<MenuCell[] | null>(null);

  const isLoading = ordersLoading || clientsLoading || recipesLoading;

  useEffect(() => {
    const fetchAndSetMenuData = async () => {
      if (isLoading) return;
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const todaysOrders = orders.filter(order => 
          order.clientEvents.some(e => e.date.startsWith(dateStr))
      );
      
      const savedMenus = await getMenusByDate(dateStr);
      const allEventMenus: EventMenu[] = [];

      todaysOrders.forEach(order => {
          order.clientEvents.forEach((event, eventIndex) => {
              if (event.date.startsWith(dateStr)) {
                  const client = getClientById(order.clientId);
                  const savedMenu = savedMenus.find(m => m.order_id === order.id && m.region === event.region);
                  
                  const menu: MenuCell[] = Array(32).fill(null).map(() => ({ content: '', mealType: '' }));

                  menu[MEAL_SECTIONS.BREAKFAST.start - 1] = { content: 'Breakfast', mealType: 'header' };
                  menu[MEAL_SECTIONS.LUNCH.start - 1] = { content: 'Lunch/Dinner', mealType: 'header' };
                  menu[MEAL_SECTIONS.TEA.start - 1] = { content: 'Evening Tea', mealType: 'header' };

                  const recipesToUse = savedMenu ? savedMenu.recipes.map(r => r.recipeId) : event.recipes.map(r => r.recipeId);
                  
                  const getRecipesForMealType = (mealType: 'Breakfast' | 'Lunch/Dinner' | 'Evening Tea') => {
                    return recipesToUse
                      .map(recipeId => {
                          const recipe = availableRecipes.find(dbRecipe => dbRecipe.recipeNumber === recipeId);
                          return recipe && recipe.recipeType === mealType ? recipe.recipeName : null;
                      })
                      .filter((name): name is string => name !== null);
                  };

                  const addRecipesToMenu = (section: keyof typeof MEAL_SECTIONS, recipes: string[]) => {
                      recipes.forEach((recipeName, i) => {
                          if(MEAL_SECTIONS[section].start + i < MEAL_SECTIONS[section].end) {
                              menu[MEAL_SECTIONS[section].start + i] = { content: recipeName, mealType: MEAL_SECTIONS[section].title };
                          }
                      })
                  }
                  
                  const orderMealType = event.mealType.toLowerCase();

                  if (orderMealType.includes('breakfast') || orderMealType.includes('brunch')) {
                      addRecipesToMenu('BREAKFAST', getRecipesForMealType('Breakfast'));
                  }
                  if (orderMealType.includes('lunch') || orderMealType.includes('dinner')) {
                      addRecipesToMenu('LUNCH', getRecipesForMealType('Lunch/Dinner'));
                  }
                  if (orderMealType.includes('evening tea')) {
                      addRecipesToMenu('TEA', getRecipesForMealType('Evening Tea'));
                  }

                  allEventMenus.push({
                      orderId: order.id,
                      eventIndex,
                      clientName: client?.companyName || 'Unknown Client',
                      pax: event.numberOfPeople,
                      mealType: event.mealType,
                      region: event.region || "Dar es Salaam",
                      menu: menu,
                  });
              }
          });
      });

      setMenuData(allEventMenus);
      setSelectedColumn(null);
      setClipboard(null);
    }
    fetchAndSetMenuData();
  }, [selectedDate, orders, getClientById, isLoading, availableRecipes]);

  const filteredMenuData = useMemo(() => {
      if (regionFilter === "All") return menuData;
      return menuData.filter(m => m.region === regionFilter);
  }, [menuData, regionFilter]);

  const handleMenuChange = (orderIndex: number, rowIndex: number, value: string) => {
    const newMenuData = [...menuData];
    const targetOrder = filteredMenuData[orderIndex];
    const actualIndex = menuData.indexOf(targetOrder);
    if (actualIndex !== -1) {
        newMenuData[actualIndex].menu[rowIndex].content = value;
        setMenuData(newMenuData);
    }
  };
  
  const handleSaveMenus = async () => {
    setIsSaving(true);
    try {
        // Save every event menu in the list
        for (const orderMenu of menuData) {
            const getRecipeId = (name: string) => availableRecipes.find(r => r.recipeName === name)?.recipeNumber || null;

            const breakfastRecipes = orderMenu.menu.slice(MEAL_SECTIONS.BREAKFAST.start, MEAL_SECTIONS.BREAKFAST.end).map(cell => getRecipeId(cell.content)).filter(Boolean).map(id => ({ recipeId: id! }));
            const lunchRecipes = orderMenu.menu.slice(MEAL_SECTIONS.LUNCH.start, MEAL_SECTIONS.LUNCH.end).map(cell => getRecipeId(cell.content)).filter(Boolean).map(id => ({ recipeId: id! }));
            const teaRecipes = orderMenu.menu.slice(MEAL_SECTIONS.TEA.start, MEAL_SECTIONS.TEA.end).map(cell => getRecipeId(cell.content)).filter(Boolean).map(id => ({ recipeId: id! }));
            
            const menuToSave: Omit<DailyMenu, 'id' | 'created_at' | 'updated_at'> = {
              order_id: orderMenu.orderId,
              menu_date: format(selectedDate, 'yyyy-MM-dd'),
              recipes: [...breakfastRecipes, ...lunchRecipes, ...teaRecipes],
              region: orderMenu.region
            };

            await upsertDailyMenu(menuToSave);
        }
        toast({ title: 'Success', description: 'All menus for the selected date have been saved.' });
    } catch(e) {
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
      const totalColumns = filteredMenuData.length;
      let startColumn = 0;

      while (startColumn < totalColumns) {
        if (startColumn > 0) {
            doc.addPage();
        }
        
        doc.text(`Daily Menu Report (${regionFilter}) - ${selectedDate ? format(selectedDate, "PPP") : 'N/A'}`, 14, 15);
        
        const endColumn = Math.min(startColumn + COLUMNS_PER_PAGE, totalColumns);
        const pageMenuData = filteredMenuData.slice(startColumn, endColumn);

        const head = [pageMenuData.map(order => `${order.clientName} (${order.region})\n#${order.pax} pax | ${order.orderId}`)];
        
        const body = Array.from({ length: 32 }).map((_, rowIndex) => 
          pageMenuData.map(order => order.menu[rowIndex]?.content || '')
        );

        (doc as any).autoTable({
          head: head,
          body: body,
          startY: 25,
          theme: 'grid',
          headStyles: {
              fillColor: [244, 244, 245], 
              textColor: [10, 10, 10],
              fontStyle: 'bold',
              halign: 'center'
          },
          styles: {
              cellPadding: 1,
              fontSize: 7,
          },
          didParseCell: function(data: any) {
              if (data.row.section === 'head') return;
              const rowIndex = data.row.index;
              if (
                  rowIndex + 1 === MEAL_SECTIONS.BREAKFAST.start ||
                  rowIndex + 1 === MEAL_SECTIONS.LUNCH.start ||
                  rowIndex + 1 === MEAL_SECTIONS.TEA.start
              ) {
                  data.cell.styles.fontStyle = 'bold';
                  data.cell.styles.fillColor = [254, 249, 195]; 
              }
          },
        });
        startColumn = endColumn;
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
      const menuToCopy = filteredMenuData[selectedColumn].menu.map(cell => ({...cell}));
      setClipboard(menuToCopy);
      toast({ title: 'Copied!', description: `Menu for ${filteredMenuData[selectedColumn].clientName} has been copied.` });
    }
  };

  const handlePaste = (targetIndex: number) => {
    if (clipboard) {
        const targetOrder = filteredMenuData[targetIndex];
        const actualIndex = menuData.indexOf(targetOrder);
        
        if (actualIndex !== -1) {
            const newMenuData = [...menuData];
            const targetMealType = targetOrder.mealType.toLowerCase();

            const pastedMenu = targetOrder.menu.map((cell, index) => {
                const row = index + 1;
                const isBreakfastSection = row >= MEAL_SECTIONS.BREAKFAST.start && row < MEAL_SECTIONS.LUNCH.start;
                const isLunchSection = row >= MEAL_SECTIONS.LUNCH.start && row < MEAL_SECTIONS.TEA.start;
                const isTeaSection = row >= MEAL_SECTIONS.TEA.start;

                const copiedCell = clipboard[index];

                if (isBreakfastSection && (targetMealType.includes('breakfast') || targetMealType.includes('brunch'))) {
                    return { ...copiedCell };
                }
                if (isLunchSection && (targetMealType.includes('lunch') || targetMealType.includes('dinner'))) {
                    return { ...copiedCell };
                }
                if (isTeaSection && targetMealType.includes('tea')) {
                    return { ...copiedCell };
                }
                return cell.mealType === 'header' ? cell : { content: '', mealType: '' };
            });

            newMenuData[actualIndex].menu = pastedMenu;
            setMenuData(newMenuData);
            toast({ title: 'Pasted!', description: `Relevant menu items pasted to ${targetOrder.clientName}.` });
            setSelectedColumn(null);
            setClipboard(null);
        }
    }
  };


  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
            <Button asChild variant="outline" size="sm" className="mb-2">
                 <Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link>
            </Button>
            <h1 className="text-2xl font-bold">Daily Menu Planner</h1>
            <p className="text-muted-foreground">Create and manage daily menus for all orders on a selected date.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <Select value={regionFilter} onValueChange={(v) => setRegionFilter(v as Region | "All")}>
                <SelectTrigger className="w-[180px]">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Filter by Region" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="All">All Regions</SelectItem>
                    {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
             <Button onClick={handlePdfExport} variant="outline" disabled={isExporting || isLoading}>
                 {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                 Export PDF
             </Button>
            <Button onClick={handleSaveMenus} disabled={isSaving || isLoading}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Save / Update Menus
            </Button>
        </div>
      </div>
      
      {isLoading ? (
          <div className="flex justify-center items-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
          </div>
      ) : filteredMenuData.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-muted">
                            {filteredMenuData.map((order, orderIndex) => (
                                <th key={`${order.orderId}-${order.eventIndex}`} className={cn("border p-2 font-bold text-center align-top min-w-[200px] cursor-pointer", selectedColumn === orderIndex && "bg-primary/20 ring-2 ring-primary z-10")} onClick={() => handleColumnSelect(orderIndex)}>
                                    <div className="space-y-1">
                                        <p className="font-semibold text-base">{order.clientName}</p>
                                        <div className="flex items-center justify-center gap-2">
                                            <Badge variant="outline" className="text-[10px] uppercase">{order.region}</Badge>
                                            <span className="text-[10px] text-muted-foreground">#{order.pax} pax</span>
                                        </div>
                                        <p className="font-mono text-[10px] text-muted-foreground">{order.orderId}</p>
                                        <p className="font-sans text-[10px] text-accent font-medium uppercase">{order.mealType}</p>
                                    </div>
                                    {selectedColumn === orderIndex && (
                                       <div className="mt-2 flex justify-center gap-2">
                                          <Button size="sm" variant="secondary" className="h-7 text-[10px]" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
                                               {clipboard ? <ClipboardCheck className="mr-1 h-3 w-3"/> : <Clipboard className="mr-1 h-3 w-3"/>}
                                               Copy
                                           </Button>
                                       </div>
                                    )}
                                     {selectedColumn !== null && selectedColumn !== orderIndex && clipboard && (
                                        <div className="mt-2">
                                            <Button size="sm" className="h-7 text-[10px]" onClick={(e) => { e.stopPropagation(); handlePaste(orderIndex); }}>
                                               <ClipboardCheck className="mr-1 h-3 w-3"/> Paste Here
                                            </Button>
                                        </div>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: 32 }).map((_, rowIndex) => {
                             const isHeaderRow = (
                                rowIndex + 1 === MEAL_SECTIONS.BREAKFAST.start ||
                                rowIndex + 1 === MEAL_SECTIONS.LUNCH.start ||
                                rowIndex + 1 === MEAL_SECTIONS.TEA.start
                            );
                            
                            return (
                                <tr key={rowIndex}>
                                    {filteredMenuData.map((order, orderIndex) => {

                                        const getIsDisabled = () => {
                                            if (isHeaderRow) return false;
                                            const mealType = order.mealType.toLowerCase();
                                            const row = rowIndex + 1;
                                            const isBreakfastSection = row > MEAL_SECTIONS.BREAKFAST.start && row <= MEAL_SECTIONS.BREAKFAST.end;
                                            const isLunchSection = row > MEAL_SECTIONS.LUNCH.start && row <= MEAL_SECTIONS.TEA.end;
                                            const isTeaSection = row > MEAL_SECTIONS.TEA.start && row <= MEAL_SECTIONS.TEA.end;
                                            
                                            if (isBreakfastSection && !mealType.includes('breakfast') && !mealType.includes('brunch')) return true;
                                            if (isLunchSection && !mealType.includes('lunch') && !mealType.includes('dinner')) return true;
                                            if (isTeaSection && !mealType.includes('tea')) return true;

                                            return false;
                                        }
                                        const isDisabled = getIsDisabled();

                                        return (
                                        <td key={orderIndex} className={cn("border p-0 align-top", isHeaderRow && 'bg-primary/10', isDisabled && 'bg-muted/50', selectedColumn === orderIndex && "bg-primary/5")}>
                                            <Popover>
                                                <PopoverTrigger asChild disabled={isDisabled}>
                                                    <input
                                                        type="text"
                                                        value={order.menu[rowIndex]?.content || ''}
                                                        onChange={(e) => handleMenuChange(orderIndex, rowIndex, e.target.value)}
                                                        className={cn(
                                                            "w-full h-full p-2 bg-transparent focus:outline-none focus:bg-amber-100 dark:focus:bg-amber-900",
                                                             isHeaderRow ? 'text-center font-bold text-primary' : '',
                                                             isDisabled && 'cursor-not-allowed text-muted-foreground'
                                                        )}
                                                        placeholder={isHeaderRow ? '' : 'Enter item...'}
                                                        disabled={isDisabled || isHeaderRow}
                                                    />
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search recipes..." />
                                                        <CommandList>
                                                            <CommandEmpty>No recipes found.</CommandEmpty>
                                                            <CommandGroup>
                                                            {availableRecipes.map((recipe) => (
                                                                <CommandItem
                                                                    key={recipe.recipeNumber}
                                                                    value={recipe.recipeName}
                                                                    onSelect={() => handleMenuChange(orderIndex, rowIndex, recipe.recipeName)}
                                                                >
                                                                    {recipe.recipeName}
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
          </CardContent>
        </Card>
      ) : (
        <Card className="flex flex-col justify-center items-center h-64 space-y-4">
            <div className="p-4 bg-muted rounded-full">
                <Utensils className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
                <CardTitle>No Events Found</CardTitle>
                <CardDescription className="mt-2">
                    {regionFilter !== "All" 
                        ? `There are no events scheduled for ${regionFilter} on ${format(selectedDate, "PPP")}.`
                        : `There are no events scheduled for ${format(selectedDate, "PPP")}.`
                    }
                </CardDescription>
            </div>
            {regionFilter !== "All" && (
                <Button variant="outline" size="sm" onClick={() => setRegionFilter("All")}>
                    <X className="mr-2 h-4 w-4" /> Clear Filter
                </Button>
            )}
        </Card>
      )}
    </div>
  );
}
