


export interface DietaryClassification {
  restriction: string;
  category: string;
  isAmbiguous: boolean;
}

export interface Client {
  id: string;
  companyName: string;
  companyEmail: string;
  phoneNumber: string;
  address1: string;
  address2?: string;
  primaryLocation: string;
  lastContacted: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface Equipment {
  equipmentNumber: string; // User-facing "No." and unique ID
  equipmentName: string;
  oem?: string;
  model?: string;
  powerRating?: string;
  quantity: number;
  yearOfManufacture?: string;
  equipmentSource?: string;
  capacity?: string;
  commitment?: string;
  registrationNumber?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export const ITEM_CLASSIFICATIONS = [
  "Herbes & Spices",
  "Fruits",
  "Vegetables",
  "Starch",
  "Protein",
  "Ingredient",
  "Cereal",
] as const;

export type ItemClassification = (typeof ITEM_CLASSIFICATIONS)[number];

export const UNITS_OF_MEASURE = ["kg", "gms", "bunch", "item"] as const;
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

export interface UnitAndPrice {
  unit: UnitOfMeasure;
  price: number;
}

export interface Ingredient {
  itemNumber: string; // User-facing "No." and unique ID
  itemDescription: string;
  itemClassification: ItemClassification;
  units: UnitAndPrice[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  quantityUsed?: number; // Ephemeral property for costing
}

export interface RecipeIngredientItem {
  ingredientId: string; // References Ingredient.itemNumber
  quantity: number;
  unit: UnitOfMeasure;
}

export interface Recipe {
  recipeNumber: string; // User-facing unique ID
  recipeName: string; // "Food created"
  ingredients: RecipeIngredientItem[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export const MEAL_TYPES = [
    "Breakfast only", 
    "Lunch only", 
    "Dinner only", 
    "Breakfast and lunch", 
    "Brunch", 
    "Breakfast, lunch and evening tea", 
    "Breakfast, lunch and dinner", 
    "Evening tea"
] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export interface ClientEvent {
  clientId: string; // References Client.id
  date: string; // ISO date string
  numberOfPeople: number;
  mealType: MealType;
  recipes: { recipeId: string }[]; // References Recipe.recipeNumber
  unitPrice: number;
  vatType: 'inclusive' | 'exclusive';
}

export interface DailyMenu {
  id: string; // User-facing unique ID
  name: string;
  clientEvents: ClientEvent[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// Shared Invoice Item Type
export interface InvoiceItem {
  id: string;
  eventType: string;
  customEventType?: string;
  mealType: string;
  pax: number;
  unitPrice: number;
  total: number;
  date?: string; // ISO string
  particularType: 'event' | 'meal';
  particularDescription?: string;
}

// Proforma Invoice Types
export interface ProformaInvoice {
  id: string; // The invoice number
  invoiceDate?: string; // ISO string
  clientId: string | null;
  receiverName: string;
  receiverPosition: string;
  lpoNumber: string;
  location: string;
  numberOfDays: number;
  multiplyByDays: boolean;
  serviceCharge: number;
  transportCosts: number;
  vatType: 'inclusive' | 'exclusive';
  selectedEventType: string;
  customEventType: string;
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  serviceFields: Record<string, boolean>;
  serviceDesc: string;
  items: InvoiceItem[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}


// Final Invoice Types
export interface Invoice {
  id: string; // The final invoice number
  proformaId?: string; // Optional link to the source proforma
  invoiceDate: string; // ISO string
  clientId: string | null;
  receiverName: string;
  receiverPosition: string;
  lpoNumber: string;
  location: string;
  numberOfDays: number;
  multiplyByDays: boolean;
  serviceCharge: number;
  transportCosts: number;
  vatType: 'inclusive' | 'exclusive';
  selectedEventType: string;
  customEventType: string;
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  serviceFields: Record<string, boolean>;
  serviceDesc: string;
  items: InvoiceItem[];
  signedAtDate?: string; // ISO string
  signedAtLocation?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// Daily Costing Snapshot
export interface DailyCosting {
    date: string; // YYYY-MM-DD format
    totalIngredientCost: number;
    totalEventIncome: number;
    netProfitLoss: number;
    createdAt: string; // ISO string
}
