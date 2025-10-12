
'use client';

import { useState, useMemo } from 'react';
import { useOrderStorage } from '@/hooks/use-order-storage';
import { useRecipeStorage } from '@/hooks/use-recipe-storage';
import { useClientStorage } from '@/hooks/use-client-storage';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import type { Client, Order, Recipe, ClientEvent, RecipeType } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Utensils, Users, Save } from 'lucide-react';

type RecipeWithSelection = Recipe & { isSelected: boolean };

const OrderCard = ({ order, client, onSave }: { order: Order; client: Client | undefined; onSave: (orderId: string, eventIndex: number, recipeIds: string[]) => void; }) => {
    const { recipes: allRecipes, isLoading: recipesLoading } = useRecipeStorage();
    const { toast } = useToast();

    const [selectedRecipes, setSelectedRecipes] = useState<Record<string, Set<string>>>(() => {
        const initialState: Record<string, Set<string>> = {};
        order.clientEvents.forEach((event, index) => {
            initialState[`${order.id}-${index}`] = new Set(event.recipes.map(r => r.recipeId));
        });
        return initialState;
    });
    
    const [isSaving, setIsSaving] = useState(false);

    const handleRecipeToggle = (eventKey: string, recipeId: string) => {
        setSelectedRecipes(prev => {
            const newSet = new Set(prev[eventKey]);
            if (newSet.has(recipeId)) {
                newSet.delete(recipeId);
            } else {
                newSet.add(recipeId);
            }
            return { ...prev, [eventKey]: newSet };
        });
    };
    
    const handleSave = async (eventIndex: number) => {
        setIsSaving(true);
        const eventKey = `${order.id}-${eventIndex}`;
        const recipeIds = Array.from(selectedRecipes[eventKey] || []);
        try {
            await onSave(order.id, eventIndex, recipeIds);
            toast({ title: 'Menu Saved', description: `Menu for order ${order.id} has been updated.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not update the menu.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const getFilteredRecipes = (event: ClientEvent): RecipeWithSelection[] => {
        const eventKey = `${order.id}-${order.clientEvents.indexOf(event)}`;
        const selected = selectedRecipes[eventKey] || new Set();

        const filterMap: Record<string, RecipeType[]> = {
            'Breakfast only': ['Breakfast'],
            'Lunch only': ['Lunch/Dinner'],
            'Dinner only': ['Lunch/Dinner'],
            'Breakfast and lunch': ['Breakfast', 'Lunch/Dinner'],
            'Brunch': ['Breakfast', 'Lunch/Dinner'],
            'Breakfast, lunch and evening tea': ['Breakfast', 'Lunch/Dinner', 'Evening Tea'],
            'Breakfast, lunch and dinner': ['Breakfast', 'Lunch/Dinner'],
            'Evening tea': ['Evening Tea'],
        };

        const validTypes = filterMap[event.mealType] || [];
        
        return allRecipes
            .filter(recipe => validTypes.includes(recipe.recipeType as any))
            .map(recipe => ({
                ...recipe,
                isSelected: selected.has(recipe.recipeNumber!)
            }));
    };

    if (recipesLoading) {
        return <Card><CardContent className="p-4"><Loader2 className="animate-spin" /></CardContent></Card>;
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>{client?.companyName || 'Unknown Client'}</CardTitle>
                <CardDescription>Order ID: {order.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {order.clientEvents.map((event, index) => {
                    const eventKey = `${order.id}-${index}`;
                    const recipesForEvent = getFilteredRecipes(event);
                    return (
                        <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold flex items-center gap-2"><Utensils className="h-4 w-4 text-primary"/>{event.mealType}</h4>
                                <Badge variant="secondary" className="flex items-center gap-2"><Users className="h-4 w-4"/>{event.numberOfPeople} Pax</Badge>
                            </div>
                            <ScrollArea className="h-48">
                                <div className="space-y-2">
                                    {recipesForEvent.map(recipe => (
                                        <div key={recipe.recipeNumber} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${eventKey}-${recipe.recipeNumber}`}
                                                checked={recipe.isSelected}
                                                onCheckedChange={() => handleRecipeToggle(eventKey, recipe.recipeNumber!)}
                                            />
                                            <label htmlFor={`${eventKey}-${recipe.recipeNumber}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                {recipe.recipeName}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="flex justify-end mt-4">
                                <Button size="sm" onClick={() => handleSave(index)} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                                    <span className="ml-2">Save Menu</span>
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};

export default function MenuPlannerPage() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const { orders, isLoading: ordersLoading, updateOrder } = useOrderStorage();
    const { getClientById, isLoading: clientsLoading } = useClientStorage();

    const dailyOrders = useMemo(() => {
        const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
        return orders.filter(order =>
            order.clientEvents.some(event => event.date.startsWith(targetDateStr))
        );
    }, [selectedDate, orders]);

    const handleSaveMenu = async (orderId: string, eventIndex: number, recipeIds: string[]) => {
        const orderToUpdate = orders.find(o => o.id === orderId);
        if (!orderToUpdate) return;
        
        const updatedEvents = [...orderToUpdate.clientEvents];
        updatedEvents[eventIndex] = {
            ...updatedEvents[eventIndex],
            recipes: recipeIds.map(id => ({ recipeId: id }))
        };

        await updateOrder(orderId, { ...orderToUpdate, clientEvents: updatedEvents });
    };

    const isLoading = ordersLoading || clientsLoading;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1 sticky top-20">
                <Card>
                    <CardHeader>
                        <CardTitle>Select a Date</CardTitle>
                        <CardDescription>Choose a date to plan the menus for all scheduled orders.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            className="rounded-md border"
                        />
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2 space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : dailyOrders.length > 0 ? (
                    dailyOrders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            client={getClientById(order.clientEvents[0].clientId)}
                            onSave={handleSaveMenu}
                        />
                    ))
                ) : (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                           <p>No orders scheduled for {format(selectedDate, 'PPP')}.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
