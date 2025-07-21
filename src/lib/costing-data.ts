// Mock database for development - replace with real database later
export interface Event {
  id: number;
  event_name: string;
  client_name: string;
  event_date: Date;
  amount_paid: number;
}

export interface Ingredient {
  id: number;
  name: string;
  unit_of_measure: string;
  unit_price: number;
  stock_quantity_used?: number;
}

// Initial ingredient database
export const initialIngredients: Ingredient[] = [
  { id: 1, name: "Chicken Breast", unit_of_measure: "kg", unit_price: 12.50, stock_quantity_used: 5 },
  { id: 2, name: "Rice", unit_of_measure: "kg", unit_price: 3.20, stock_quantity_used: 10 },
  { id: 3, name: "Tomatoes", unit_of_measure: "kg", unit_price: 4.50, stock_quantity_used: 3 },
  { id: 4, name: "Onions", unit_of_measure: "bunches", unit_price: 2.30, stock_quantity_used: 4 },
  { id: 5, name: "Olive Oil", unit_of_measure: "grams", unit_price: 0.008, stock_quantity_used: 500 },
  { id: 6, name: "Bell Peppers", unit_of_measure: "kg", unit_price: 5.80, stock_quantity_used: 2 },
  { id: 7, name: "Garlic", unit_of_measure: "bunches", unit_price: 1.50, stock_quantity_used: 2 },
  { id: 8, name: "Pasta", unit_of_measure: "kg", unit_price: 2.80, stock_quantity_used: 8 }
];

// Events database with various dates
export const eventsDatabase: Event[] = [
  // Today's events
  { id: 1, event_name: "Wedding Reception", client_name: "Smith Family", event_date: new Date(), amount_paid: 2500 },
  { id: 2, event_name: "Corporate Lunch", client_name: "Tech Corp Ltd", event_date: new Date(), amount_paid: 800 },
  { id: 3, event_name: "Birthday Party", client_name: "Johnson Family", event_date: new Date(), amount_paid: 450 },
  
  // Yesterday's events
  { id: 4, event_name: "Anniversary Dinner", client_name: "Brown Family", event_date: new Date(Date.now() - 24 * 60 * 60 * 1000), amount_paid: 1200 },
  { id: 5, event_name: "Business Meeting", client_name: "StartUp Inc", event_date: new Date(Date.now() - 24 * 60 * 60 * 1000), amount_paid: 350 },
  
  // Tomorrow's events
  { id: 6, event_name: "Graduation Party", client_name: "Davis Family", event_date: new Date(Date.now() + 24 * 60 * 60 * 1000), amount_paid: 1800 },
  { id: 7, event_name: "Conference Catering", client_name: "Global Solutions", event_date: new Date(Date.now() + 24 * 60 * 60 * 1000), amount_paid: 3200 },
  
  // Other dates
  { id: 8, event_name: "Baby Shower", client_name: "Miller Family", event_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), amount_paid: 650 },
  { id: 9, event_name: "Team Building Event", client_name: "Creative Agency", event_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), amount_paid: 950 }
];

// Helper function to get events for a specific date
export const getEventsForDate = (date: Date): Event[] => {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  return eventsDatabase.filter(event => {
    const eventDate = new Date(event.event_date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate.getTime() === targetDate.getTime();
  });
};
