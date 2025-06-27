
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
