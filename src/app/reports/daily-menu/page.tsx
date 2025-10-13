
"use client";
import React, { useMemo, useState } from 'react';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { useClientStorage } from '@/hooks/use-client-storage';
import { useRecipeStorage } from '@/hooks/use-recipe-storage';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Download, Loader2, Printer } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type OrderWithClient = {
  orderId: string;
  clientName: string;
  pax: number;
  breakfast: string[];
  lunch: string[];
  eveningTea: string[];
};

export default function DailyMenuReport() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isPrinting, setIsPrinting] = useState(false);
  const { orders, isLoading: ordersLoading } = useOrderStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const { getRecipeById, isLoading: recipesLoading } = useRecipeStorage();

  const isLoading = ordersLoading || clientsLoading || recipesLoading;

  const dailyMenuData: OrderWithClient[] = useMemo(() => {
    if (isLoading) return [];
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const todaysOrders = orders.filter(order => order.clientEvents.some(e => e.date.startsWith(dateStr)));

    return todaysOrders.map(order => {
      const event = order.clientEvents.find(e => e.date.startsWith(dateStr));
      if (!event) return null;

      const client = getClientById(event.clientId);
      const getRecipeNames = (mealType: string) => event.recipes
          .map(r => getRecipeById(r.recipeId))
          .filter(Boolean)
          .filter(r => r.recipeType === mealType)
          .map(r => r!.recipeName);

      const breakfastRecipes = getRecipeNames("Breakfast");
      const lunchDinnerRecipes = getRecipeNames("Lunch/Dinner");
      const eveningTeaRecipes = getRecipeNames("Evening Tea");

      return {
        orderId: order.id,
        clientName: client?.companyName || "Unknown Client",
        pax: event.numberOfPeople,
        breakfast: breakfastRecipes,
        lunch: lunchDinnerRecipes,
        eveningTea: eveningTeaRecipes,
      };
    }).filter((item): item is OrderWithClient => item !== null);
  }, [selectedDate, orders, getClientById, getRecipeById, isLoading]);

  const allMealItems = useMemo(() => {
    const mealMap = new Map<string, string[][]>();
    mealMap.set('Breakfast', []);
    mealMap.set('Lunch', []);
    mealMap.set('Evening Tea', []);

    dailyMenuData.forEach(order => {
        mealMap.get('Breakfast')!.push(order.breakfast);
        mealMap.get('Lunch')!.push(order.lunch);
        mealMap.get('Evening Tea')!.push(order.eveningTea);
    });

    const maxRows = Math.max(
      ...Array.from(mealMap.values()).map(arrays => Math.max(...arrays.map(arr => arr.length)))
    );

    const transposed: { mealType: string; items: string[][] }[] = [];
    mealMap.forEach((orders, mealType) => {
      const rows: string[][] = [];
      for (let i = 0; i < maxRows; i++) {
          const row: string[] = [];
          for (let j = 0; j < dailyMenuData.length; j++) {
              row.push(orders[j]?.[i] || '');
          }
          if(row.some(item => item !== '')) rows.push(row);
      }
      if(rows.length > 0) {
        transposed.push({ mealType, items: rows });
      }
    });

    return transposed;
  }, [dailyMenuData]);
  
  const handlePrint = async () => {
    const content = document.getElementById('print-area');
    if (!content) return;
    setIsPrinting(true);
    try {
        const canvas = await html2canvas(content, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape' });
        const imgProps= pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Daily_Menu_${format(selectedDate, 'yyyy-MM-dd')}.pdf`);
    } catch(e) {
        console.error(e);
    } finally {
        setIsPrinting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold">Daily Menu Report</h1>
            <p className="text-muted-foreground">Consolidated menu for all orders on a selected date.</p>
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
            <Button onClick={handlePrint} disabled={isPrinting}>
                {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Printer className="mr-2 h-4 w-4" />}
                Print / PDF
            </Button>
        </div>
      </div>
      
      {isLoading ? (
          <div className="flex justify-center items-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
          </div>
      ) : dailyMenuData.length > 0 ? (
        <Card id="print-area" className="p-4">
            <h2 className="text-center text-xl font-bold mb-4">Daily Menu for {format(selectedDate, "PPP")}</h2>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
                            {dailyMenuData.map((order) => (
                                <th key={order.orderId} className="border p-2 font-bold text-center">
                                    Client: {order.clientName} - #{order.pax} pax
                                    <br />
                                    Order ID - #{order.orderId}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {allMealItems.map(({mealType, items}) => (
                            <React.Fragment key={mealType}>
                                <tr>
                                    <td colSpan={dailyMenuData.length} className="bg-primary/80 text-primary-foreground font-bold p-2 text-center">{mealType}</td>
                                </tr>
                                {items.map((row, rowIndex) => (
                                    <tr key={`${mealType}-${rowIndex}`}>
                                        {row.map((item, itemIndex) => (
                                            <td key={itemIndex} className="border p-2 align-top">{item}</td>
                                        ))}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
      ) : (
        <Card className="flex justify-center items-center h-64">
            <p className="text-muted-foreground">No orders found for the selected date.</p>
        </Card>
      )}

    </div>
  );
}
