
"use client";

import { useState, useEffect, useCallback } from 'react';
import { initialIngredients, eventsDatabase, getEventsForDate as getEvents } from '@/lib/costing-data';
import type { Ingredient, Event } from '@/lib/costing-data';

const INGREDIENTS_STORAGE_KEY = "caterSmartCostingIngredients";
const EVENTS_STORAGE_KEY = "caterSmartCostingEvents";


export function useCostingData() {
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const getIngredientsFromStorage = (): Ingredient[] => {
        if (typeof window === "undefined") return initialIngredients;
        const data = localStorage.getItem(INGREDIENTS_STORAGE_KEY);
        return data ? JSON.parse(data) : initialIngredients;
    };
    
    const getEventsFromStorage = (): Event[] => {
        if (typeof window === "undefined") return eventsDatabase;
        const data = localStorage.getItem(EVENTS_STORAGE_KEY);
         if (data) {
            try {
                // Dates are stored as strings, need to convert back to Date objects
                return JSON.parse(data).map((event: any) => ({
                    ...event,
                    event_date: new Date(event.event_date)
                }));
            } catch (error) {
                console.error("Error parsing events from localStorage", error);
                return eventsDatabase;
            }
        }
        return eventsDatabase;
    }

    useEffect(() => {
        if (typeof window !== "undefined") {
            setIngredients(getIngredientsFromStorage());
            setEvents(getEventsFromStorage());
            setIsLoading(false);
        }
    }, []);

    const updateIngredients = (newIngredients: Ingredient[]) => {
        if (typeof window !== "undefined") {
            localStorage.setItem(INGREDIENTS_STORAGE_KEY, JSON.stringify(newIngredients));
            setIngredients(newIngredients);
        }
    };
    
    const getEventsForDate = useCallback((date: Date): Event[] => {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        
        return events.filter(event => {
            const eventDate = new Date(event.event_date);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate.getTime() === targetDate.getTime();
        });
    }, [events]);


    return {
        ingredients,
        events,
        isLoading,
        updateIngredients,
        getEventsForDate
    };
}
