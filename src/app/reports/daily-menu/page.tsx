

"use client";
import React, { useMemo, useState, useEffect } from 'react';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useRecipeStorage } from '@/hooks/use-recipe-storage';
import { format, parseISO, startOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Loader2, Save, ArrowLeft, Download, Clipboard, ClipboardCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import jsPDF from "jspdf";
import "jspdf-autotable";
import { getMenusByDate, upsertDailyMenu } from '@/services/dailyMenuService';
import { DailyMenu } from '@/types';


type MenuCell = { content: string; mealType: string };
type OrderMenu = {
  orderId: string;
  clientName: string;
  pax: number;
  mealType: string;
  menu: MenuCell[];
};

const MEAL_SECTIONS = {
  BREAKFAST: { start: 1, end: 12, title: 'Breakfast' },
  LUNCH: { start: 13, end: 28, title: 'Lunch/Dinner' },
  TEA: { start: 29, end: 31, title: 'Evening Tea' },
};

export default function DailyMenuPlannerPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { orders, isLoading: ordersLoading } = useOrderStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { recipes: availableRecipes, isLoading: recipesLoading } = useRecipeStorage();
  const [menuData, setMenuData] = useState<OrderMenu[]>([]);
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

      const initialMenuData: OrderMenu[] = todaysOrders.map(order => {
          const event = order.clientEvents.find(e => e.date.startsWith(dateStr));
          if (!event) return null;

          const client = getClientById(event.clientId);
          const savedMenu = savedMenus.find(m => m.order_id === order.id);
          
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

          return {
              orderId: order.id,
              clientName: client?.companyName || 'Unknown Client',
              pax: event.numberOfPeople,
              mealType: event.mealType,
              menu: menu,
          };
      }).filter((item): item is OrderMenu => item !== null);

      setMenuData(initialMenuData);
      setSelectedColumn(null);
      setClipboard(null);
    }
    fetchAndSetMenuData();
  }, [selectedDate, orders, getClientById, isLoading, availableRecipes]);

  const handleMenuChange = (orderIndex: number, rowIndex: number, value: string) => {
    const newMenuData = [...menuData];
    newMenuData[orderIndex].menu[rowIndex].content = value;
    setMenuData(newMenuData);
  };
  
  const handleSaveMenus = async () => {
    setIsSaving(true);
    try {
        for (const orderMenu of menuData) {
            const getRecipeId = (name: string) => availableRecipes.find(r => r.recipeName === name)?.recipeNumber || null;

            const breakfastRecipes = orderMenu.menu.slice(MEAL_SECTIONS.BREAKFAST.start, MEAL_SECTIONS.BREAKFAST.end).map(cell => getRecipeId(cell.content)).filter(Boolean).map(id => ({ recipeId: id! }));
            const lunchRecipes = orderMenu.menu.slice(MEAL_SECTIONS.LUNCH.start, MEAL_SECTIONS.LUNCH.end).map(cell => getRecipeId(cell.content)).filter(Boolean).map(id => ({ recipeId: id! }));
            const teaRecipes = orderMenu.menu.slice(MEAL_SECTIONS.TEA.start, MEAL_SECTIONS.TEA.end).map(cell => getRecipeId(cell.content)).filter(Boolean).map(id => ({ recipeId: id! }));
            
            const menuToSave: Omit<DailyMenu, 'id' | 'created_at' | 'updated_at'> = {
              order_id: orderMenu.orderId,
              menu_date: format(selectedDate, 'yyyy-MM-dd'),
              recipes: [...breakfastRecipes, ...lunchRecipes, ...teaRecipes]
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
      const totalColumns = menuData.length;
      let startColumn = 0;

      while (startColumn < totalColumns) {
        if (startColumn > 0) {
            doc.addPage();
        }
        
        doc.text(`Daily Menu Report - ${selectedDate ? format(selectedDate, "PPP") : 'N/A'}`, 14, 15);
        
        const endColumn = Math.min(startColumn + COLUMNS_PER_PAGE, totalColumns);
        const pageMenuData = menuData.slice(startColumn, endColumn);

        const head = [pageMenuData.map(order => `${order.clientName} - #${order.pax} pax\n${order.orderId}`)];
        
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

      doc.save(`Daily_Menu_Report_${selectedDate ? format(selectedDate, "yyyy-MM-dd") : 'all_dates'}.pdf`);
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
    setClipboard(null); // Clear clipboard when a new column is selected
  };

  const handleCopy = () => {
    if (selectedColumn !== null) {
      const menuToCopy = menuData[selectedColumn].menu.map(cell => ({...cell}));
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
            // Keep header rows, otherwise clear the cell
            return cell.mealType === 'header' ? cell : { content: '', mealType: '' };
        });

        targetOrder.menu = pastedMenu;
        setMenuData(newMenuData);
        toast({ title: 'Pasted!', description: `Relevant menu items pasted to ${targetOrder.clientName}.` });
        setSelectedColumn(null);
        setClipboard(null);
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
        <div className="flex gap-2">
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
      ) : menuData.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-muted">
                            {menuData.map((order, orderIndex) => (
                                <th key={orderIndex} className={cn("border p-2 font-bold text-center align-top min-w-[200px] cursor-pointer", selectedColumn === orderIndex && "bg-primary/20 ring-2 ring-primary z-10")} onClick={() => handleColumnSelect(orderIndex)}>
                                    <p className="font-semibold text-base">{order.clientName} - #{order.pax} pax</p>
                                    <p className="font-mono text-xs text-muted-foreground">{order.orderId}</p>
                                     <p className="font-sans text-xs text-accent">{order.mealType}</p>
                                    {selectedColumn === orderIndex && (
                                       <div className="mt-2 flex justify-center gap-2">
                                          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
                                               {clipboard ? <ClipboardCheck className="mr-2 h-4 w-4"/> : <Clipboard className="mr-2 h-4 w-4"/>}
                                               Copy
                                           </Button>
                                       </div>
                                    )}
                                     {selectedColumn !== null && selectedColumn !== orderIndex && clipboard && (
                                        <div className="mt-2">
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handlePaste(orderIndex); }}>
                                               <ClipboardCheck className="mr-2 h-4 w-4"/> Paste Here
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
                                    {menuData.map((order, orderIndex) => {

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
        <Card className="flex justify-center items-center h-64">
            <div className="text-center">
                <CardTitle>No Orders Found</CardTitle>
                <CardDescription className="mt-2">There are no orders scheduled for {selectedDate ? format(selectedDate, "PPP") : 'the selected date'}.</CardDescription>
            </div>
        </Card>
      )}
    </div>
  );
}
