
"use client";
import React, { useMemo, useState, useEffect } from 'react';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { useClientStorage } from '@/hooks/use-client-storage';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Loader2, Save, ArrowLeft } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

type MenuCell = { content: string; mealType: string };
type OrderMenu = {
  orderId: string;
  clientName: string;
  pax: number;
  menu: MenuCell[];
};

const MEAL_SECTIONS = {
  BREAKFAST: { start: 1, end: 12, title: 'Breakfast' },
  LUNCH: { start: 13, end: 28, title: 'Lunch/Dinner' },
  TEA: { start: 29, end: 31, title: 'Evening Tea' },
};

export default function DailyMenuPlannerPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { orders, isLoading: ordersLoading, updateOrder } = useOrderStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const [menuData, setMenuData] = useState<OrderMenu[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const isLoading = ordersLoading || clientsLoading;

  useEffect(() => {
    if (isLoading) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const todaysOrders = orders.filter(order => order.clientEvents.some(e => e.date.startsWith(dateStr)));

    const initialMenuData: OrderMenu[] = todaysOrders.map(order => {
        const event = order.clientEvents.find(e => e.date.startsWith(dateStr));
        if (!event) return null;

        const client = getClientById(event.clientId);
        
        const menu: MenuCell[] = Array(32).fill(null).map(() => ({ content: '', mealType: '' }));

        const mealTitleMap: { [key: string]: string } = {
          'Breakfast only': 'Breakfast',
          'Brunch': 'Brunch',
          'Lunch only': 'Lunch',
          'Dinner only': 'Dinner',
          'Breakfast and lunch': 'Breakfast & Lunch',
          'Breakfast, lunch and evening tea': 'Full Day',
          'Breakfast, lunch and dinner': 'Full Day',
          'Evening tea': 'Evening Tea'
        };

        const getRecipesForMeal = (meal: string) => {
            const recipeTypeMap: {[key:string]: string} = {
                'Breakfast': 'Breakfast',
                'Brunch': 'Breakfast',
                'Lunch': 'Lunch/Dinner',
                'Dinner': 'Lunch/Dinner',
                'Evening Tea': 'Evening Tea'
            }
            return event.recipes
                .map(r => r.recipeId)
                .filter(Boolean);
        }

        const addRecipesToMenu = (mealTitle: string, section: keyof typeof MEAL_SECTIONS, recipes: string[]) => {
             menu[MEAL_SECTIONS[section].start -1] = { content: mealTitle, mealType: 'header' };
             recipes.forEach((recipe, i) => {
                 if(MEAL_SECTIONS[section].start + i < MEAL_SECTIONS[section].end) {
                    menu[MEAL_SECTIONS[section].start + i] = { content: recipe, mealType: mealTitle };
                 }
             })
        }
        
        const mealTitle = mealTitleMap[event.mealType] || 'Menu';
        if (event.mealType.includes('Breakfast') || event.mealType.includes('Brunch')) {
            addRecipesToMenu(event.mealType.includes('Brunch') ? 'Brunch' : 'Breakfast', 'BREAKFAST', getRecipesForMeal('Breakfast'));
        }
        if (event.mealType.includes('Lunch') || event.mealType.includes('Dinner')) {
            addRecipesToMenu(event.mealType.includes('Dinner') ? 'Dinner' : 'Lunch', 'LUNCH', getRecipesForMeal('Lunch/Dinner'));
        }
        if (event.mealType.includes('Evening tea')) {
            addRecipesToMenu('Evening Tea', 'TEA', getRecipesForMeal('Evening Tea'));
        }


        return {
            orderId: order.id,
            clientName: client?.companyName || 'Unknown Client',
            pax: event.numberOfPeople,
            menu: menu,
        };
    }).filter((item): item is OrderMenu => item !== null);

    setMenuData(initialMenuData);
  }, [selectedDate, orders, getClientById, isLoading]);

  const handleMenuChange = (orderIndex: number, rowIndex: number, value: string) => {
    const newMenuData = [...menuData];
    newMenuData[orderIndex].menu[rowIndex].content = value;
    setMenuData(newMenuData);
  };
  
  const handleSaveMenus = async () => {
    setIsSaving(true);
    try {
        for (const orderMenu of menuData) {
            const originalOrder = orders.find(o => o.id === orderMenu.orderId);
            if (!originalOrder) continue;
            
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const eventIndex = originalOrder.clientEvents.findIndex(e => e.date.startsWith(dateStr));
            if (eventIndex === -1) continue;

            const updatedEvents = [...originalOrder.clientEvents];
            
            const breakfastRecipes = orderMenu.menu.slice(MEAL_SECTIONS.BREAKFAST.start, MEAL_SECTIONS.BREAKFAST.end).filter(cell => cell.content).map(cell => ({ recipeId: cell.content }));
            const lunchRecipes = orderMenu.menu.slice(MEAL_SECTIONS.LUNCH.start, MEAL_SECTIONS.LUNCH.end).filter(cell => cell.content).map(cell => ({ recipeId: cell.content }));
            const teaRecipes = orderMenu.menu.slice(MEAL_SECTIONS.TEA.start, MEAL_SECTIONS.TEA.end).filter(cell => cell.content).map(cell => ({ recipeId: cell.content }));

            updatedEvents[eventIndex] = {
                ...updatedEvents[eventIndex],
                recipes: [...breakfastRecipes, ...lunchRecipes, ...teaRecipes]
            };
            
            await updateOrder(originalOrder.id, { clientEvents: updatedEvents } as any);
        }
        toast({ title: 'Success', description: 'All menus for the selected date have been saved.' });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save menus.' });
    } finally {
        setIsSaving(false);
    }
  }


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
            <Button onClick={handleSaveMenus} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Save Menus
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
                                <th key={orderIndex} className="border p-2 font-bold text-center align-top min-w-[200px]">
                                    <p className="font-semibold text-base">{order.clientName} - #{order.pax} pax</p>
                                    <p className="font-mono text-xs text-muted-foreground">{order.orderId}</p>
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
                            
                            let sectionTitle = '';
                            if (rowIndex + 1 === MEAL_SECTIONS.BREAKFAST.start) sectionTitle = 'Breakfast / Brunch';
                            if (rowIndex + 1 === MEAL_SECTIONS.LUNCH.start) sectionTitle = 'Lunch / Dinner';
                            if (rowIndex + 1 === MEAL_SECTIONS.TEA.start) sectionTitle = 'Evening Tea';
                            
                            return (
                                <tr key={rowIndex}>
                                    {menuData.map((order, orderIndex) => (
                                        <td key={orderIndex} className={cn("border p-0 align-top", isHeaderRow && 'bg-primary/10')}>
                                            <input
                                                type="text"
                                                value={order.menu[rowIndex]?.content || ''}
                                                onChange={(e) => handleMenuChange(orderIndex, rowIndex, e.target.value)}
                                                className={cn(
                                                    "w-full h-full p-2 bg-transparent focus:outline-none focus:bg-amber-100 dark:focus:bg-amber-900",
                                                    isHeaderRow ? 'text-center font-bold text-primary' : ''
                                                )}
                                                placeholder={isHeaderRow ? sectionTitle : 'Enter menu item...'}
                                            />
                                        </td>
                                    ))}
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
